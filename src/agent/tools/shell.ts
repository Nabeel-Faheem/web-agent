import { tool } from "ai";
import { z } from "zod";
import shell from "shelljs";

export const runShellCommand = tool({
  description: `Execute a shell/terminal command and return it's output. Use this for system operations, file manipulations and other shell/terminal tasks. Be cautious with commands that can modify the system or have side effects.`,
  inputSchema: z.object({
    command: z.string().describe("The shell/terminal command to execute"),
  }),
  execute: async ({ command }) => {
    const result = shell.exec(command, { silent: true });

    let output = "";

    if (result.stdout) {
      output += result.stdout;
    }

    if (result.stderr) {
      output += result.stderr;
    }

    if (result.code !== 0) {
      return `Command failed (exit code ${result.code}):\n ${output}`;
    }

    return output || "Command executed successfully with no output";
  },
});
