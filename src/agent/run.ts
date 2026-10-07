import "dotenv/config";
import { streamText, type ModelMessage } from "ai";
import { groqModel, DEFAULT_MODEL } from "./groq.ts";
import { getTracer, Laminar } from "@lmnr-ai/lmnr";

import { SYSTEM_PROMPT } from "./system/prompt.ts";
import type { AgentCallbacks, ToolCallInfo } from "../types.ts";
import { tools } from "./tools/index.ts";
import { executeTool } from "./executeTool.ts";
import { filterCompatibleMessages } from "./system/filterMessages.ts";
import {
  estimateMessagesTokens,
  getModelLimits,
  isOverThreshold,
  calculateUsagePercentage,
  compactConversation,
  DEFAULT_THRESHOLD,
} from "./context/index.ts";

const MODEL_NAME = DEFAULT_MODEL;

// strip `execute` so the SDK only reports tool calls instead of running them before the user approves
const toolSchemas = Object.fromEntries(
  Object.entries(tools).map(([name, { execute, ...schema }]) => [name, schema]),
) as typeof tools;
Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
  // export traces over HTTPS (443) instead of gRPC (8443), which is blocked on this network
  forceHttp: true,
});

export const runAgent = async (
  userMessage: string,
  conversationHistory: ModelMessage[] = [],
  callbacks: AgentCallbacks = {} as AgentCallbacks,
): Promise<ModelMessage[]> => {
  const modelLimits = getModelLimits(MODEL_NAME);

  // remove the messages that are not compatible with the model
  const workingHistory: ModelMessage[] =
    filterCompatibleMessages(conversationHistory);

  // prepare messages to be sent to the LLM
  let messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...workingHistory,
    {
      role: "user",
      content: userMessage,
    },
  ] as ModelMessage[];

  // check conversation threshold
  const precheckedTokens = estimateMessagesTokens(messages);
  if (isOverThreshold(precheckedTokens.total, modelLimits.contextWindow)) {
    // compact messages
    messages = await compactConversation(messages, MODEL_NAME);
  }

  // setup agent loop to handle tool calls and LLM responses
  let fullResponse = "";
  while (true) {
    const { fullStream, finishReason, response } = streamText({
      model: groqModel(MODEL_NAME),
      messages,
      allowSystemInMessages: true,
      tools: toolSchemas,
      // needed to see Groq's `executed_tools` (provider-run web search), which the SDK doesn't surface as tool-call chunks
      includeRawChunks: true,
      experimental_telemetry: {
        isEnabled: true,
        tracer: getTracer(),
      },
    });

    const reportTokenUsage = () => {
      if (callbacks.onTokenUsage) {
        const usage = estimateMessagesTokens(messages);
        callbacks.onTokenUsage({
          inputTokens: usage.input,
          outputTokens: usage.output,
          totalTokens: usage.total,
          contextWindow: modelLimits.contextWindow,
          threshold: DEFAULT_THRESHOLD,
          percentage: calculateUsagePercentage(
            usage.total,
            modelLimits.contextWindow,
          ),
        });
      }
    };

    const toolCalls: ToolCallInfo[] = [];
    let currentText = "";
    let streamError: Error | null = null;

    try {
      for await (const chunk of fullStream) {
        // append to the currentText if chunk has text
        if (chunk.type === "text-delta") {
          currentText += chunk.text;
          callbacks.onToken(chunk.text);
        }

        // prepare tool calls because will be passed to the LLM later
        if (chunk.type === "tool-call") {
          const input = "input" in chunk ? chunk.input : {};

          toolCalls.push({
            toolCallId: chunk.toolCallId, // tool id necessary to associate because this is how llm associates tool calls
            toolName: chunk.toolName,
            args: input as keyof (typeof chunk)["input"],
          });

          callbacks.onToolCallStart(chunk.toolName, input);
        }

        // provider-executed web search: Groq sends each step twice, first without `output` (started), then with it (done)
        if (chunk.type === "raw") {
          const executedTools =
            (chunk.rawValue as any)?.choices?.[0]?.delta?.executed_tools ?? [];

          for (const executedTool of executedTools) {
            if (executedTool.output === undefined) {
              callbacks.onToolCallStart("webSearch", executedTool.arguments);
            } else {
              callbacks.onToolCallEnd("webSearch", executedTool.output);
            }
          }
        }
      }
    } catch (err) {
      streamError = err as Error;

      if (
        !currentText &&
        !streamError.message.includes("No output generated")
      ) {
        throw streamError;
      }
    }

    fullResponse += currentText;

    if (streamError && !currentText) {
      fullResponse = "Sorry about that, could not generate a response";
      callbacks.onToken(fullResponse);
      break;
    }

    const reasonToFinish = await finishReason;
    const { messages: resMessages } = await response;

    // handle the scenario when there were no tool calls
    if (reasonToFinish !== "tool-calls" || toolCalls.length === 0) {
      messages.push(...resMessages);
      reportTokenUsage();
      break;
    }

    // handle the scenario when it's a tool calls
    messages.push(...resMessages);

    // execute the tool calls and get the results
    let isDisapproved = false;
    for (const toolCall of toolCalls) {
      // asynchronous approval check for every tool call (skipped once the user has denied one)
      const isApproved =
        !isDisapproved &&
        (await callbacks.onToolApproval(toolCall.toolName, toolCall.args));

      // tell the LLM the call was denied so it asks again next time instead of assuming it ran
      if (!isApproved) {
        isDisapproved = true;
        messages.push({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              output: {
                type: "text",
                value: "The user denied this tool call, it was not executed",
              },
            },
          ],
        });
        continue;
      }

      // execute the current tool
      const result = await executeTool(toolCall.toolName, toolCall.args);

      // singal the frontend that the tool call has ended and pass the result
      callbacks.onToolCallEnd(toolCall.toolName, result);

      // push to the messages the result of the tool call so that the LLM can use it in the next iteration
      messages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            output: { type: "text", value: JSON.stringify(result) },
          },
        ],
      });
      reportTokenUsage();
    }

    if (isDisapproved) {
      break;
    }
  }

  // signal the frontend that the agent has completed its response
  callbacks.onComplete(fullResponse);

  return messages;
};
