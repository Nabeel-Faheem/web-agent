import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import type {
  EvalTarget,
  SingleTurnResult,
  MultiTurnTarget,
  MultiTurnResult,
} from "./types.ts";

/**
 * Evaluator is actually an assertion or a test that will convert a qualitative thing into a quantitative one
 * We can only evaluate single turns like testing if a tools was called or not using quantitative score approach because
 * we only get to know if a tool was called or not - a boolean either true or false and it can be quantified
 * but multi-turn evaluations can't be performed using quantitative scoring
 */

/**
 * Single-Turn Evaluator: Precision/recall score for tool selection.
 * Returns a score between 0 and 1 based on correct selections.
 */
export function scoreToolSelection(
  output: SingleTurnResult,
  target: EvalTarget,
): number {
  if (!target.expectedTools?.length) {
    return output.selectedAny ? 0.5 : 1;
  }

  const expected = new Set(target.expectedTools);
  const selected = new Set(output.toolNames);

  const hits = output.toolNames.filter((t) => expected.has(t)).length;
  const precision = selected.size > 0 ? hits / selected.size : 0;
  const recall = expected.size > 0 ? hits / expected.size : 0;

  // simple F1-ish score
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

/**
 * Multi-Turn Evaluator: LLM-based judgment for multi-turn conversations.
 * Returns a score between 0 and 1 based on the LLM's evaluation.
 */
// schema for the LLM response to judge the multi-turn evaluation
const judgeSchema = z.object({
  score: z
    .number()
    .min(1)
    .max(10)
    .describe("Score from 1 to 10 where 10 is perfect"),
  reason: z.string().describe("Brief explanation of the score"),
});

export const getJudgedByLLM = async (
  output: MultiTurnResult,
  target: MultiTurnTarget,
) => {
  // it's the same like generateText but it is used to get the strucuted output from the LLM
  const { object } = await generateObject({
    model: openai.chat("gemini-2.5-flash"),
    schema: judgeSchema,
    schemaName: "evaluation",
    schemaDescription: "Evaluation of an AI agent response",
    // plain JSON mode: Gemini's OpenAI-compatible endpoint is picky about json_schema response_format
    mode: "json",
    messages: [
      {
        role: "system",
        content: `You are an evaluation judge. Score the agent's response on a scale of 1-10.
          Scoring criteria:
          - 10: Response fully addresses the task using tool results correctly
          - 7-9: Response is mostly correct with minor issues
          - 4-6: Response partially addresses the task
          - 1-3: Response is mostly incorrect or irrelevant
        `,
      },
      {
        role: "user",
        content: `Task: ${target.originalTask}
          Tools Called: ${output.toolCallOrder}
          Tool Results Provided: ${JSON.stringify(target.mockToolResults)}
          
          Agent's Final Response: ${output.text}

          Evaluate if this response correctly uses the tool results to answer the task
        `,
      },
    ],
  });

  return object.score / 10;
};
