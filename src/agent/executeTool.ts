import { tools } from "./tools";

export type Toolname = keyof typeof tools;

// make sure executeTool returns strings since the result will be passed to the LLM
export const executeTool = async (name: string, args: any) => {
  const tool = tools[name as Toolname];

  if (!tool) {
    return "Unknown tools, this does not exist";
  }

  const execute = tool.execute;

  // all tools might not have the execute since it's optional
  if (!execute) {
    return "This is not a registered tool";
  }

  const result = await execute(args, {
    toolCallId: "",
    messages: [],
  });

  return String(result);
};
