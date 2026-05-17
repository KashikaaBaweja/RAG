"use client";

import { useCallback, useEffect, useState } from "react";
import { removeUploadedDoc } from "@/lib/client/doc-store";

export type ApiDocument = {
  id: string;
  docId: string;
  orgId: string;
  knowledgeBaseId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  status: string;
  createdAt: string;
};

type Props = {
  orgId: string;
  refreshKey?: number;
};

export function DocManager({ orgId, refreshKey = 0 }: Props) {
  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!orgId) {
      setDocs([]);
      setLoadErr(null);
      return;
    }
    setLoadErr(null);
    try {
      const res = await fetch(`/api/documents?orgId=${encodeURIComponent(orgId)}`, {
        credentials: "include",
        headers: { "x-org-id": orgId },
      });
      const data = (await res.json()) as { documents?: ApiDocument[]; error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDocs(data.documents ?? []);
    } catch (e) {
      setDocs([]);
      setLoadErr(e instanceof Error ? e.message : "Failed to load documents");
    }
  }, [orgId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const onDelete = async (docId: string) => {
    setMsg(null);
    try {
      const res = await fetch(
        `/api/documents?orgId=${encodeURIComponent(orgId)}&docId=${encodeURIComponent(docId)}`,
        { method: "DELETE", credentials: "include", headers: { "x-org-id": orgId } }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      removeUploadedDoc(docId);
      await reload();
      setMsg("Document removed from catalog (Pinecone vectors not purged).");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    }
    setTimeout(() => setMsg(null), 5000);
  };

  const onReindex = async (doc: ApiDocument) => {
    setBusy(doc.docId);
    setMsg(null);
    try {
      const res = await fetch("/api/reindex", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-org-id": orgId },
        body: JSON.stringify({
          storageKey: doc.storageKey,
          docId: doc.docId,
          orgId: doc.orgId,
          mimeType: doc.mimeType,
          filename: doc.filename,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMsg("Re-index job queued.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Re-index failed");
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(null), 5000);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="mb-3 text-sm font-medium text-zinc-200">Documents</h2>
      {msg && <p className="mb-3 text-xs text-zinc-400">{msg}</p>}
      {loadErr && <p className="mb-3 text-xs text-red-400">{loadErr}</p>}
      {docs.length === 0 ? (
        <p className="text-sm text-zinc-500">No documents for this org yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">{d.filename}</p>
                <p className="font-mono text-[11px] text-zinc-500">
                  {d.docId} · {d.status}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busy === d.docId}
                  onClick={() => void onReindex(d)}
                  className="rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                >
                  Re-index
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(d.docId)}
                  className="rounded-md border border-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
