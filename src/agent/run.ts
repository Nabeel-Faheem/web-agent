import "dotenv/config";
import { generateText, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { getTracer, Laminar } from "@lmnr-ai/lmnr";

import { SYSTEM_PROMPT } from "./system/prompt";
import type { AgentCallbacks } from "../types";
import { tools } from "./tools";
import { executeTool } from "./executeTool";

const MODEL_NAME = "gemini-2.5-flash";
Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
});

export const runAgent = async (
  userMessage: string,
  conversationHistory: ModelMessage[] = [],
  callbacks: AgentCallbacks = {} as AgentCallbacks,
) => {
  const {
    text,
    // toolCalls
  } = await generateText({
    model: openai.chat(MODEL_NAME), // @ai-sdk/openai v2 defaults to the responses AI which gemini doesn't support so just openai() will not work
    prompt: userMessage,
    system: SYSTEM_PROMPT,
    tools,
    experimental_telemetry: {
      isEnabled: true,
      tracer: getTracer(),
    },
  });

  await Laminar.flush();

  // console.log({ text, toolCalls }); // text will be empty when we pass tools as argument to the LLM because LLM provides each tool and its args etc. in response
  // // so that we could call it

  // // call/execute the required tools
  // const toolCallResponses = await Promise.all(
  //   toolCalls.map(async (toolCall) =>
  //     executeTool(toolCall.toolName, toolCall.input),
  //   ),
  // );
  // toolCallResponses.map((res) => console.log({ res }));
};

runAgent("What is the current date and time?");
