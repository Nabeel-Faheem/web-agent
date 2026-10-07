import { dateTime } from "./dateTime.ts";
import { readFile, writeFile, listFiles, deleteFile } from "./file.ts";
import { webSearch } from "./webSearch.ts";
import { runShellCommand } from "./shell.ts";

// all tools combined for the agent
export const tools = {
  dateTime,
  readFile,
  writeFile,
  listFiles,
  deleteFile,
  webSearch,
  runShellCommand,
};

export { readFile, writeFile, listFiles, deleteFile } from "./file.ts";
export { webSearch } from "./webSearch.ts";
export { runShellCommand } from "./shell.ts";

export const fileTools = {
  readFile,
  writeFile,
  listFiles,
  deleteFile,
};

export const shellTools = {
  runShellCommand,
};
