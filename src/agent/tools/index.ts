import { dateTime } from "./dateTime.ts";
import { readFile, writeFile, listFiles, deleteFile } from "./file.ts";

// all tools combined for the agent
export const tools = {
  dateTime,
  readFile,
  writeFile,
  listFiles,
  deleteFile,
};

export { readFile, writeFile, listFiles, deleteFile } from "./file.ts";

export const fileTools = {
  readFile,
  writeFile,
  listFiles,
  deleteFile,
};
