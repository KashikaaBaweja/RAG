"use client";

import { useCallback, useEffect, useState } from "react";
import { listUploadedDocs, removeUploadedDoc } from "@/lib/client/doc-store";
import type { UploadedDocRecord } from "@/lib/client/types";

type Props = {
  orgId: string;
  refreshKey?: number;
};

export function DocManager({ orgId, refreshKey = 0 }: Props) {
  const [docs, setDocs] = useState<UploadedDocRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(() => {
    setDocs(listUploadedDocs().filter((d) => d.orgId === orgId));
  }, [orgId]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const onDelete = (docId: string) => {
    removeUploadedDoc(docId);
    reload();
    setMsg("Removed from this device list (vectors unchanged until you add a delete API).");
    setTimeout(() => setMsg(null), 4000);
  };

  const onReindex = async (doc: UploadedDocRecord) => {
    setBusy(doc.docId);
    setMsg(null);
    try {
      const res = await fetch("/api/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      {docs.length === 0 ? (
        <p className="text-sm text-zinc-500">No uploads yet for this org on this browser.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.docId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">{d.filename}</p>
                <p className="font-mono text-[11px] text-zinc-500">{d.docId}</p>
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
                  onClick={() => onDelete(d.docId)}
                  className="rounded-md border border-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
