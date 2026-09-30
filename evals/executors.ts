import { generateText, stepCountIs, tool, type ToolSet } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import type {
  EvalData,
  SingleTurnResult,
  MultiTurnEvalData,
  MultiTurnResult,
} from "./types.ts";
import { buildMessages } from "./utils";

// these executors are the test runners around different evaluations like file-tools.json, shell-tools.json etc.
// will not execute the tools rather mock them just like test driven development - we don't need to call tools realistically causing the executors to be slow
// and changing our data or adding cost to the AI

// tool mocks/fakes
const TOOL_DEFINITIONS: Record<
  string,
  { description: string; parameters: z.ZodTypeAny }
> = {
  // file tools
  writeFile: {
    description: "Write given content to the file at the specified path",
    parameters: z.object({
      path: z.string().describe("the path to the file you want to write to"),
      content: z.string().describe("the content you want to write to the file"),
    }),
  },
  readFile: {
    description: "Read the contents of a file at the specified path",
    parameters: z.object({
      path: z.string().describe("the path to the file that you want to read"),
    }),
  },
  deleteFile: {
    description: "Delete a file at the given path",
    parameters: z.object({
      path: z.string().describe("the path to the file you want to delete"),
    }),
  },
  listFiles: {
    description: "List all the files in the specified directory",
    parameters: z.object({
      path: z
        .string()
        .describe(
          "the path to the directory for which you want to list the files",
        ),
    }),
  },
  // shell tools
  runCommand: {
    description: "Execute the given shell command and return the output",
    parameters: z.object({
      command: z.string().describe("the shell command to execute"),
    }),
  },
};

// execture single/standalone turn
export const executeSingleTurnWithMocks = async (data: EvalData) => {
  // build messages that will be passed to the LLM - "user" message should be the last one to make LLM to respond
  const messages = buildMessages(data);

  // hash map to store tools
  const tools: ToolSet = {};

  // iterate over each tool to populate tools variable that will be passed to the LLM
  for (const toolName of data.tools) {
    const toolDefinition =
      TOOL_DEFINITIONS[toolName as keyof typeof TOOL_DEFINITIONS];

    if (toolDefinition) {
      tools[toolName] = tool({
        description: toolDefinition.description,
        inputSchema: toolDefinition.parameters,
      });
    }
  }

  // call LLM with the prepared tools, messages and config
  // openai.chat() because the responses API (default in v2) isn't supported by gemini's OpenAI-compatible endpoint
  const { toolCalls } = await generateText({
    model: openai.chat(data?.config?.model ?? "gemini-2.5-flash"),
    messages,
    tools,
    stopWhen: stepCountIs(1), // stop on single turn
    temperature: data?.config?.temperature ?? undefined,
  });

  // map to store minimal tool calls data from LLM tools
  const calls = toolCalls.map((toolCall) => ({
    toolName: toolCall.toolName,
    args: toolCall.input ?? {},
  }));

  // store tool names from LLM tools
  const toolNames = toolCalls.map((toolCall) => toolCall.toolName);

  return {
    calls,
    toolNames,
    selectedAny: toolNames.length > 0,
  };
};
