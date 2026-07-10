/** Resolve vector DB with Pinecone preferred when credentials are present. */
export function resolveVectorProvider(
  explicit = process.env.RAG_VECTOR_PROVIDER,
  pineconeApiKey = process.env.PINECONE_API_KEY,
  pineconeIndexName = process.env.PINECONE_INDEX_NAME
): "pinecone" | "qdrant" {
  const key = pineconeApiKey?.trim();
  const index = pineconeIndexName?.trim();
  const hasPinecone = Boolean(key && index);

  // Explicit override always wins.
  if (explicit === "pinecone") return "pinecone";
  if (explicit === "qdrant") return "qdrant";

  // Priority: Pinecone when configured, otherwise local Qdrant.
  return hasPinecone ? "pinecone" : "qdrant";
}
