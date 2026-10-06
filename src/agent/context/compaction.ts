import { generateText, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { extractMessageText } from "./tokenEstimator.ts";
import { groqModel } from "../groq.ts";

const SUMMARIZATION_PROMPT = `
  You are a conversation summarizer. Your task it to create a concise summary of the conversation so far, that preserves:
  1. Key decisions and conclusions reached
  2. Important context and facts mentioned
  3. Any pending tasks or questions
  4. The overall goal of the conversation

  Be concise but complete. The summary should allow the conversation to continue naturally.

  Conversation to summarize:
`;

/**
 * Format messages array as readable text for summarization
 */
function messagesToText(messages: ModelMessage[]): string {
  return messages
    .map((msg) => {
      const role = msg.role.toUpperCase();
      const content = extractMessageText(msg);
      return `[${role}]: ${content}`;
    })
    .join("\n\n");
}

/**
 * Compact a conversation by summarizing it with an LLM.
 *
 * Takes the current messages (excluding system prompt) and returns a new
 * messages array with:
 * - A user message containing the summary
 * - An assistant acknowledgment
 *
 * The system prompt should be prepended by the caller.
 */
export async function compactConversation(
  messages: ModelMessage[],
  model: string = "gpt-5-mini",
): Promise<any> {
  // filter out the non conversational messages (system prompt, tool calls, etc.)
  const conversationalMessages = messages.filter(
    (msg) => msg.role !== "system",
  );

  if (conversationalMessages.length === 0) {
    return [];
  }

  // format the messages as text for summarization
  const conversationText = messagesToText(conversationalMessages);

  // generate the summary using the LLM
  const summaryResponse = await generateText({
    model: groqModel(),
    prompt: `${SUMMARIZATION_PROMPT}\n\n${conversationText}`,
  });

  // prepare compacted messages
  const compactedMessages: ModelMessage[] = [
    {
      role: "user",
      content: `[CONVERSATION SUMMARY]\n The following content is the summary of the conversation so far:\n\n${summaryResponse.text}`,
    },
    {
      role: "assistant",
      content:
        "I understand. I have reviwed the summary of our conversation and I am ready to continue. How can I help?",
    },
  ];

  return compactedMessages;
}
