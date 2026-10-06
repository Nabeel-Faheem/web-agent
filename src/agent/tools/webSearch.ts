import { groq } from "../groq.ts";

// provider tool: the search runs on Groq's servers, not in our app.
// there is no `execute` here, the provider returns the results along with the response
// only supported on openai/gpt-oss-* models
export const webSearch = groq.tools.browserSearch({});
