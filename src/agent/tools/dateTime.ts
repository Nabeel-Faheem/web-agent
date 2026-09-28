import { tool } from "ai";
import { z } from "zod";

// a tool normally has 3 things:
// 1. description - LLM needs this to understand what the tools is all about and when to use it
// 2. inputSchema - A contract that makes sure the LLM passes arguments to the tool function in a particular format
// 3. execute - The function that is passed with the arguments by the LLM and we execute it and the result is sent back to the LLM
export const dateTime = tool({
  description:
    "Returns the current time and date, use this tool before any time related task", // suggesting the LLM to use it at a particular event
  inputSchema: z.object({}), // empty object since we don't need any parameters from LLM
  execute: () => new Date().toISOString(), // tool function is never executed on the provider's side, rather it happens on our application side and return type of this function should always be a string since this will be passed to the LLM
});
