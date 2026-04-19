"use client";

import { useEffect } from "react";
import type { CitationPayload } from "@/lib/client/types";

type Props = {
  open: boolean;
  onClose: () => void;
  citation: CitationPayload | null;
  /** Optional signed URL later (Phase 5); when absent, snippet-only view. */
  pdfUrl?: string | null;
};

/**
 * Slide-over source panel. PDF iframe when `pdfUrl` is provided; otherwise
 * highlighted chunk text from the citation payload.
 */
export function SourceDrawer({ open, onClose, citation, pdfUrl }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Source</p>
            <p className="font-mono text-sm text-zinc-200">
              {citation?.docId?.slice(0, 8) ?? "—"}… · page {citation?.page ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {pdfUrl ? (
            <div className="h-[70vh] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
              <iframe title="PDF preview" src={pdfUrl} className="h-full w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                Full PDF preview will use a signed document URL once metadata storage lands (Phase 5).
                Below is the cited chunk text.
              </p>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 text-sm leading-relaxed text-zinc-200">
                <p className="mb-2 font-mono text-xs text-emerald-400/90">
                  chunk {citation?.chunkIndex ?? "—"} · id {citation?.chunkId ?? "—"}
                </p>
                <p className="whitespace-pre-wrap">
                  {citation?.snippet ? (
                    <mark className="rounded bg-amber-500/25 px-0.5 text-zinc-100">{citation.snippet}</mark>
                  ) : (
                    <span className="text-zinc-500">No snippet available.</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
