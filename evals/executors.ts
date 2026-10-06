import { generateText, stepCountIs, tool, type ToolSet } from "ai";
import { groqModel } from "../src/agent/groq.ts";
import { z } from "zod";

import type {
  EvalData,
  SingleTurnResult,
  MultiTurnEvalData,
  MultiTurnResult,
} from "./types.ts";
import { buildMessages, buildMockedTools } from "./utils";
import { SYSTEM_PROMPT } from "../src/agent/system/prompt.ts";

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
  const { toolCalls } = await generateText({
    model: groqModel(data?.config?.model),
    messages,
    allowSystemInMessages: true,
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

// execute multi-turn conversation with mocks
export const executeMultiTurnWithMocks = async (data: MultiTurnEvalData) => {
  // prepare mock tools that will be passed to the LLM
  const tools = buildMockedTools(data.mockTools);

  // prepare messages that will be passed to the LLM
  const messages = data.messages ?? [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: data.prompt!,
    },
  ];

  // mock the agent loop to handle tool calls and LLM responses - using vercel ai library's built-in agent loop without writing custom loop
  // the loop is turned on by adding stopWhen
  const result = await generateText({
    model: groqModel(data?.config?.model),
    messages,
    allowSystemInMessages: true,
    tools,
    stopWhen: stepCountIs(data?.config?.maxSteps ?? 20), // stop on max steps
  });

  // prepare the data to return to the caller - this is the data that will be used for evaluation
  const toolCallOrder: string[] = [];
  const steps = result.steps.map((step) => ({
    toolCalls: step.toolCalls?.map((toolCall) => {
      toolCallOrder.push(toolCall.toolName);
      return {
        toolName: toolCall.toolName,
        args: "args" in toolCall ? toolCall.args : {},
      };
    }),
    toolResults: step.staticToolResults?.map((toolResult) => ({
      toolName: toolResult.toolName,
      result: "results" in toolResult ? toolResult.results : toolResult,
    })),
    text: step.text,
  }));

  const toolsUsed = new Set(toolCallOrder);

  return {
    text: result.text,
    steps,
    toolsUsed,
    toolCallOrder,
  };
};
