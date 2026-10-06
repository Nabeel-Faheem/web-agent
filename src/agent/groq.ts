import "dotenv/config";
import { createGroq } from "@ai-sdk/groq";

// native Groq provider, needed for Groq's provider tools (e.g. browser search)
export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const DEFAULT_MODEL = "openai/gpt-oss-120b";

export const groqModel = (model: string = DEFAULT_MODEL) => groq(model);
