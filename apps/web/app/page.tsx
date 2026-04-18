export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">RAG monorepo</h1>
      <p className="text-zinc-400">
        Phase 1 scaffold and Phase 2 ingestion are wired: POST multipart files to{" "}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm">/api/upload</code>{" "}
        with field <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm">file</code>.
        Run Redis (and Postgres for later metadata) via{" "}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm">docker compose up -d</code>,{" "}
        then start the worker app to process BullMQ jobs.
      </p>
    </main>
  );
}
