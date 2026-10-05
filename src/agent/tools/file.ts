import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import nodePath from "node:path";

export const readFile = tool({
  // be passive about using this tool becaus other similar tools or MCP tools could contradict LLM decision
  // and might pick the wrong tool
  description:
    "Read the full contents of a file at the given path, always use this tool to read a file",
  inputSchema: z.object({
    path: z.string(),
  }),
  execute: async ({ path }) => {
    try {
      const content = await fs.readFile(path, "utf-8");
      return content;
    } catch (error) {
      // the error here is simple and maybe enough for the LLM to understand what went wrong!
      // it can be improved in the future to provide more context about the error
      // For example, we can get the error code from the error object and provide a more specific message based on that code.
      // or we can suggest the LLM to use listFiles tool to check if the file exists or not before trying to read it.
      // or any other suggestions that can help the LLM to understand the error better and take appropriate action.
      return `There was an error reading the file, here is the native error from node.js: ${error}`;
    }
  },
});

export const writeFile = tool({
  description:
    "Write content to a file at the specified path. Create the file if it does not exist, and overwrite it if it does.",
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: async ({ path, content }) => {
    try {
      // filter out the directory name from the path
      const dir = nodePath.dirname(path);
      // create all the directories in the path if they do not exist
      await fs.mkdir(dir, { recursive: true });
      // write the content to the file, creating it if it does not exist and overwriting it if it does
      await fs.writeFile(path, content, "utf-8");

      return `Successfully wrote ${content.length} characters to ${path}`;
    } catch (error) {
      // we can improve the error message here to provide more context about the error
      // For example, maybe instructing the LLM to go, do a web search from node.js docs and fix the error that occured etc.
      return `There was an error writing the file, here is the native error from node.js: ${error}`;
    }
  },
});

export const listFiles = tool({
  description: "List all files and directories at the specified directory",
  inputSchema: z.object({
    directory: z
      .string()
      .describe("The directory path to list the content of")
      .default("."),
  }),
  execute: async ({ directory }) => {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      // format the entries to easy language for LLM to understand
      const items = entries.map((entry) => {
        const type = entry.isDirectory() ? "directory" : "file";
        return `${type}: ${entry.name}`;
      });

      return items.length > 0
        ? items.join("\n")
        : `Directory ${directory} is empty.`;
    } catch (error) {
      return `Could not list the files in the directory ${directory}, here is the native error from node.js: ${error}`;
    }
  },
});

export const deleteFile = tool({
  description: "Delete the file at the specified path",
  inputSchema: z.object({
    path: z.string().describe("The path to the file to be deleted"),
  }),
  execute: async ({ path }) => {
    try {
      await fs.unlink(path);
      return `Successfully deleted the file ${path}`;
    } catch (error) {
      return `Could not delete the file ${path}, here is the native error from node.js: ${error}`;
    }
  },
});
