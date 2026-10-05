import { evaluate } from "@lmnr-ai/lmnr";
import { getJudgedByLLM } from "./evaluators";

import type {
  MultiTurnEvalData,
  MultiTurnDatasetEntry,
  MultiTurnResult,
  MultiTurnTarget,
} from "./types";
import dataset from "./data/agent-multiturn.json" with { type: "json" };
import { executeMultiTurnWithMocks } from "./executors";

const executor = async (data: MultiTurnEvalData) => {
  return executeMultiTurnWithMocks(data);
};

/**
 * the evaluation below is called an experiment
 * evaluate will run equal to the length of the data (dataset) i.e. for each sample inside the dataset
 */
evaluate({
  data: dataset as any,
  executor,
  evaluators: {
    // name of the property will be the evaluator name on laminar dashboard
    outputQuality: async (output: any, target: any) => {
      if (!target) return 1;

      return getJudgedByLLM(output, target);
    },
  },
  groupName: "agent-multi-turn",
  config: {
    concurrencyLimit: 1, // avoid 429 rate limits from the LLM provider
    projectApiKey: process.env.LMNR_PROJECT_API_KEY, // set your Laminar project API key in the .env file
  },
});
