# DocMind

**AI knowledge base for your documents** — upload PDFs, ask questions, get cited answers.

## Product

- Marketing site + auth at `/`
- Workspace dashboard at `/dashboard`
- Document upload, ingestion, and RAG chat

## Quick start (local)

```bash
docker compose up -d
pnpm dev:stack
```

Open **http://127.0.0.1:3000**

## Stack

Next.js · Postgres · Redis · Qdrant · Ollama (or OpenAI + Pinecone)

## Latest release

See [commits on `main`](https://github.com/KashikaaBaweja/RAG/commits/main).
