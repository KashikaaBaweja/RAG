import { BufferWindowMemory } from "langchain/memory";
import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";

/**
 * Per-request BufferWindowMemory (last `k` turns). In serverless Next.js,
 * hydrate from the client `history` array each request — no server session required.
 */
export function createRagBufferWindowMemory(k = 6) {
  return new BufferWindowMemory({
    k,
    returnMessages: true,
    memoryKey: "chat_history",
    inputKey: "input",
    outputKey: "answer",
  });
}

export async function hydrateBufferWindowFromTranscript(
  memory: BufferWindowMemory,
  turns: { role: "user" | "assistant"; content: string }[]
) {
  await memory.clear();
  for (const t of turns) {
    if (t.role === "user") {
      await memory.chatHistory.addMessage(new HumanMessage(t.content));
    } else {
      await memory.chatHistory.addMessage(new AIMessage(t.content));
    }
  }
}

/** Convert client history to LangChain messages (alternative to BufferWindow hydration). */
export function transcriptToMessages(
  turns: { role: "user" | "assistant"; content: string }[] | undefined,
  windowPairs = 6
): BaseMessage[] {
  if (!turns?.length) return [];
  const maxMessages = windowPairs * 2;
  const slice = turns.slice(-maxMessages);
  const out: BaseMessage[] = [];
  for (const t of slice) {
    out.push(t.role === "user" ? new HumanMessage(t.content) : new AIMessage(t.content));
  }
  return out;
}
