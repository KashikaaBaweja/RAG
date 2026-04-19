"use client";

import { useMemo, useState } from "react";
import { listRecentQueries, listUploadedDocs } from "@/lib/client/doc-store";
import { ChatPanel } from "@/components/ChatPanel";
import { DocManager } from "@/components/DocManager";
import { UploadZone } from "@/components/UploadZone";

export default function DashboardPage() {
  const [orgId, setOrgId] = useState("dev-org");
  const [docRefresh, setDocRefresh] = useState(0);
  const [uiTick, setUiTick] = useState(0);

  const stats = useMemo(() => {
    const docs = listUploadedDocs().filter((d) => d.orgId === orgId);
    const queries = listRecentQueries();
    return {
      documents: docs.length,
      queries: queries.length,
    };
  }, [orgId, docRefresh, uiTick]);

  const recent = useMemo(() => listRecentQueries().slice(0, 6), [docRefresh, uiTick]);

  const kbs = useMemo(
    () => [
      {
        id: "default",
        name: "Main knowledge base",
        description: "Vectors in Pinecone namespace = org id",
        docs: stats.documents,
      },
    ],
    [stats.documents]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Uploads, chat, and document list are tracked in this browser until Prisma metadata ships.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Org id
          <input
            value={orgId}
            onChange={(e) => setOrgId(e.target.value || "dev-org")}
            className="w-48 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Documents (this browser)" value={stats.documents} />
        <StatCard label="Recent questions stored" value={stats.queries} />
        <StatCard label="Knowledge bases" value={kbs.length} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Knowledge bases</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {kbs.map((kb) => (
            <article
              key={kb.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
            >
              <h3 className="font-medium text-zinc-100">{kb.name}</h3>
              <p className="mt-1 text-xs text-zinc-500">{kb.description}</p>
              <p className="mt-3 text-xs text-zinc-400">{kb.docs} local upload record(s)</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Recent queries</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">No queries yet — ask something in chat.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/20">
            {recent.map((q) => (
              <li key={q.id} className="px-4 py-3">
                <p className="text-sm text-zinc-200">{q.query}</p>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{q.preview}</p>
                <p className="mt-1 text-[11px] text-zinc-600">{new Date(q.at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <UploadZone
          orgId={orgId}
          onUploaded={() => setDocRefresh((n) => n + 1)}
        />
        <DocManager orgId={orgId} refreshKey={docRefresh} />
      </div>

      <ChatPanel orgId={orgId} onActivity={() => setUiTick((n) => n + 1)} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-50">{value}</p>
    </div>
  );
}
