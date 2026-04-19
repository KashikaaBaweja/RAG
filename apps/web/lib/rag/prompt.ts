import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from "@langchain/core/prompts";

/** How each retrieved chunk is rendered into the stuffed `context` string. */
export const ragDocumentPrompt = PromptTemplate.fromTemplate(
  `[SOURCE:{chunkId}] doc={docId} page={page}
{page_content}`
);

/** System rules + citation template (answer must reference [SOURCE:…] ids from context). */
export const RAG_SYSTEM_PROMPT = `You are a careful assistant answering from the provided sources only.
Rules:
- Use ONLY information found in the retrieved chunks. If the answer is not in the sources, say you do not know.
- Every factual claim must cite the chunk id in-line using exactly this form: [SOURCE:chunkId] where chunkId matches a label from context (e.g. [SOURCE:uuid:0]).
- Do not invent chunk ids.
- Be concise.`;

/** Prompt for LangChain createStuffDocumentsChain (requires {context}, {chat_history}, {input}). */
export function createRagCombineChatPrompt() {
  return ChatPromptTemplate.fromMessages([
    ["system", `${RAG_SYSTEM_PROMPT}\n\nChunks:\n{context}`],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);
}
