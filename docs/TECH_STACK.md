# DocMind — Tech Stack & Architecture

DocMind is a **RAG (Retrieval-Augmented Generation)** product: upload documents, index them into a vector store, then chat with cited answers from your own files.

This document explains **what technologies the project uses** and **how they fit together**.  
It does **not** contain secrets. Real keys live only in local `.env` / `.env.local` (never commit those).

---

## High-level architecture

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Browser (UI)   │────▶│  Next.js (web)   │────▶│  PostgreSQL     │
│  React + Tailwind│     │  API + Auth      │     │  (metadata)     │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌─────────┐  ┌─────────┐  ┌──────────┐
              │  Redis  │  │ Qdrant  │  │ Uploads  │
              │ BullMQ  │  │ vectors │  │ disk/S3  │
              └────┬────┘  └────▲────┘  └────▲─────┘
                   │            │            │
                   ▼            │            │
              ┌─────────────────┴────────────┘
              │  Worker (ingestion)
              │  parse → chunk → embed → upsert
              └─────────────────┬─────────────
                                ▼
                         ┌─────────────┐
                         │ Gemini API  │
                         │ chat+embed  │
                         └─────────────┘
```

**User flow**

1. Register / sign in  
2. Upload a PDF (or DOCX / TXT / Markdown)  
3. Worker extracts text, chunks it, embeds with Gemini, stores vectors in Qdrant  
4. Ask a question in chat → search Qdrant → Gemini answers using retrieved chunks + citations  

---

## Monorepo layout

| Path | Role |
|------|------|
| `apps/web` | Next.js app — UI, auth, REST/SSE APIs |
| `apps/worker` | Background ingestion worker (BullMQ consumer) |
| `packages/ingestion` | Shared parse / chunk / embed / upsert library |
| `docker-compose.yml` | Local Postgres, Redis, Qdrant |
| `.env` / `apps/web/.env.local` | Local secrets & provider config (**gitignored**) |

Package manager: **pnpm** workspaces + **Turborepo**.

---

## Frontend

| Technology | Why we use it |
|------------|----------------|
| **Next.js 14** (App Router) | Full-stack React framework: pages + API routes |
| **React 18** | Dashboard, upload zone, document list, chat panel |
| **Tailwind CSS** | Fast, consistent DocMind UI styling |
| **next-auth** | Email/password auth with JWT sessions |

Main UI surfaces: marketing home, login/register, dashboard (upload + documents + AI chat).

---

## Backend & APIs

| Technology | Why we use it |
|------------|----------------|
| **Next.js Route Handlers** | `/api/upload`, `/api/query`, `/api/documents`, `/api/orgs`, etc. |
| **Prisma** | Type-safe access to Postgres models (User, Org, Document, Query) |
| **BullMQ** | Reliable async jobs so uploads don’t block the HTTP request |
| **SSE (Server-Sent Events)** | Streams chat tokens to the browser |

Auth is enforced in API routes (and dashboard redirects). Org membership scopes documents and queries.

---

## Data stores

| Technology | Stores | How it runs locally |
|------------|--------|---------------------|
| **PostgreSQL 16** | Users, orgs, memberships, document status, query history | Docker (`5433` → container `5432`) |
| **Redis 7** | BullMQ job queues | Docker (`6379`) |
| **Qdrant** | Vector embeddings + chunk payloads | Docker (`6333`) |
| **Local disk** (`uploads/`) | Raw uploaded files | Shared folder for web + worker |
| **S3** (optional) | Same files in cloud object storage | Via `RAG_USE_S3=true` |

---

## AI / RAG stack

| Technology | Role |
|------------|------|
| **Gemini** (Google AI Studio) | **Primary** chat model + embeddings (free-tier friendly) |
| **LangChain** | Retrieval chain, prompts, streaming answers |
| **Hybrid retrieval** | Dense vector search (Pinecone preferred, Qdrant fallback) + light lexical re-ranking |
| **Citations** | Answers reference source chunks (`[SOURCE:…]` style chips) |

### Vector DB priority

1. **Pinecone** — used automatically when `PINECONE_API_KEY` + `PINECONE_INDEX_NAME` are set  
2. **Qdrant** — local Docker fallback when Pinecone is not configured  
3. Optional force: `RAG_VECTOR_PROVIDER=pinecone|qdrant`

### Optional / alternate providers

| Provider | Use when |
|----------|----------|
| **Ollama** | Fully local models (no cloud API) |
| **OpenAI** | Paid cloud alternative |

Configured with env flags such as:

- `RAG_CHAT_PROVIDER=gemini|ollama|openai`
- `RAG_EMBEDDING_PROVIDER=gemini|ollama|openai`
- `RAG_VECTOR_PROVIDER=` (empty = auto; Pinecone wins when keys exist)

---

## Ingestion pipeline (worker)

Separate Node process so heavy PDF work stays off the web server.

1. **Read file** from upload dir (or S3)  
2. **Parse** — `pdf-parse` (PDF), `mammoth` (DOCX), plain text / Markdown  
3. **Chunk** — split into overlapping text segments  
4. **Scrub PII** (best-effort) before embedding  
5. **Embed** — Gemini `gemini-embedding-001` (768 dims; match your Pinecone index)  
6. **Upsert** vectors into **Pinecone** when configured, otherwise **Qdrant** (payload includes `orgId`, `docId`, text, page)  
7. **Update status** in Postgres — `PENDING` → `READY` or `FAILED`  

---

## DevOps & quality

| Technology | Role |
|------------|------|
| **Docker Compose** | One-command local infra |
| **GitHub Actions** | CI: lint, build, unit tests |
| **TypeScript** | End-to-end typing |
| **ESLint** | Code quality |
| **Vitest** | Unit tests |
| **Playwright** | End-to-end tests |

---

## Runtime map (local)

| Service | URL / port |
|---------|------------|
| Web app | http://127.0.0.1:3000 |
| Postgres | `127.0.0.1:5433` |
| Redis | `127.0.0.1:6379` |
| Qdrant | http://127.0.0.1:6333 |
| Ollama (optional) | http://127.0.0.1:11434 |
| Gemini | Cloud API (key in `.env` only) |

---

## Typical local start

```bash
cd /Users/kashika/dev/RAG   # preferred working copy (outside iCloud Desktop)
docker compose up -d

# terminal 1 — website
cd apps/web && pnpm exec next dev -H 127.0.0.1 -p 3000

# terminal 2 — ingestion worker
cd apps/worker && RAG_UPLOAD_DIR=/Users/kashika/dev/RAG/uploads pnpm exec tsx src/index.ts
```

Open **http://127.0.0.1:3000/dashboard**.

---

## Security notes

- Keep `.env` and `apps/web/.env.local` **out of git** (already gitignored).  
- Never paste API keys into README, commits, or screenshots.  
- Use `.env.example` for variable **names** and safe placeholders only.  
- Prefer `127.0.0.1` over `localhost` so NextAuth cookies match `NEXTAUTH_URL`.

---

## Stack in one sentence

**Next.js + Prisma/Postgres + Redis/BullMQ + Qdrant + Gemini**, with a dedicated TypeScript ingestion worker, packaged as a pnpm/Turborepo monorepo and run locally with Docker.
