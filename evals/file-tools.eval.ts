import { evaluate } from "@lmnr-ai/lmnr";

import { scoreToolSelection } from "./evaluators";
import type { EvalData, EvalTarget } from "./types";
import dataset from "./data/file-tools.json" with { type: "json" };
import { executeSingleTurnWithMocks } from "./executors";

const executor = async (data: EvalData) => {
  return executeSingleTurnWithMocks(data);
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
    selectionScore: (output: any, target: any) => {
      if (target.category === "secondary") return 1;

      return scoreToolSelection(output, target);
    },
  },
  groupName: "file-tools-selection",
  config: {
    concurrencyLimit: 1, // avoid 429 rate limits from the LLM provider
  },
});
