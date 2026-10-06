import "dotenv/config";
import { streamText, type ModelMessage } from "ai";
import { groqModel, DEFAULT_MODEL } from "./groq.ts";
import { getTracer, Laminar } from "@lmnr-ai/lmnr";

import { SYSTEM_PROMPT } from "./system/prompt.ts";
import type { AgentCallbacks, ToolCallInfo } from "../types.ts";
import { tools } from "./tools/index.ts";
import { executeTool } from "./executeTool.ts";
import { filterCompatibleMessages } from "./system/filterMessages.ts";

const MODEL_NAME = DEFAULT_MODEL;
Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
});

export const runAgent = async (
  userMessage: string,
  conversationHistory: ModelMessage[] = [],
  callbacks: AgentCallbacks = {} as AgentCallbacks,
): Promise<ModelMessage[]> => {
  // remove the messages that are not compatible with the model
  const workingHistory: ModelMessage[] =
    filterCompatibleMessages(conversationHistory);

  // prepare messages to be sent to the LLM
  const messages = [
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

  // setup agent loop to handle tool calls and LLM responses
  let fullResponse = "";
  while (true) {
    const { fullStream, finishReason, response } = streamText({
      model: groqModel(MODEL_NAME),
      messages,
      allowSystemInMessages: true,
      tools,
      experimental_telemetry: {
        isEnabled: true,
        tracer: getTracer(),
      },
    });

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
      break;
    }

    // handle the scenario when it's a tool calls
    messages.push(...resMessages);

    // execute the tool calls and get the results
    for (const toolCall of toolCalls) {
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
    }
  }

  // signal the frontend that the agent has completed its response
  callbacks.onComplete(fullResponse);

  return messages;
};
