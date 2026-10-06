import { dateTime } from "./dateTime.ts";
import { readFile, writeFile, listFiles, deleteFile } from "./file.ts";
import { webSearch } from "./webSearch.ts";

// all tools combined for the agent
export const tools = {
  dateTime,
  readFile,
  writeFile,
  listFiles,
  deleteFile,
  webSearch,
};

export { readFile, writeFile, listFiles, deleteFile } from "./file.ts";
export { webSearch } from "./webSearch.ts";

export const fileTools = {
  readFile,
  writeFile,
  listFiles,
  deleteFile,
};
