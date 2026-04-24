"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { upsertUploadedDoc } from "@/lib/client/doc-store";
import type { UploadedDocRecord } from "@/lib/client/types";

type Props = {
  orgId: string;
  onUploaded?: (doc: UploadedDocRecord) => void;
};

export function UploadZone({ orgId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const uploadFile = useCallback(
    (file: File) => {
      setBusy(true);
      setProgress(0);
      setStatus(`Uploading ${file.name}…`);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.withCredentials = true;
      xhr.setRequestHeader("x-org-id", orgId);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((100 * e.loaded) / e.total));
        } else {
          setProgress((p) => Math.min(95, p + 5));
        }
      };

      xhr.onload = () => {
        setBusy(false);
        setProgress(100);
        try {
          const json = JSON.parse(xhr.responseText) as {
            docId: string;
            orgId: string;
            filename: string;
            storageKey: string;
            mimeType: string;
            error?: string;
          };
          if (xhr.status >= 200 && xhr.status < 300 && json.docId) {
            const rec: UploadedDocRecord = {
              docId: json.docId,
              orgId: json.orgId,
              filename: json.filename,
              storageKey: json.storageKey,
              mimeType: json.mimeType,
              createdAt: new Date().toISOString(),
            };
            upsertUploadedDoc(rec);
            setStatus("Queued for ingestion.");
            onUploaded?.(rec);
          } else {
            setStatus(json.error ?? `Upload failed (${xhr.status})`);
          }
        } catch {
          setStatus(xhr.status ? `Upload failed (${xhr.status})` : "Upload failed");
        }
        setTimeout(() => setProgress(0), 800);
      };

      xhr.onerror = () => {
        setBusy(false);
        setStatus("Network error");
        setProgress(0);
      };

      const fd = new FormData();
      fd.append("file", file);
      fd.append("orgId", orgId);
      xhr.send(fd);
    },
    [orgId, onUploaded]
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-200">Upload documents</h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Browse
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.txt,.md,.markdown"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadFile(f);
          e.target.value = "";
        }}
      />
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition ${
          dragOver ? "border-emerald-500/70 bg-emerald-500/5" : "border-zinc-700 bg-zinc-950/40"
        }`}
        onClick={() => !busy && inputRef.current?.click()}
        role="presentation"
      >
        <p className="text-sm text-zinc-400">Drop PDF, DOCX, TXT, or Markdown here</p>
        <p className="mt-1 text-xs text-zinc-600">Requires sign-in · org-scoped storage</p>
      </div>
      {busy && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      {status && <p className="mt-3 text-xs text-zinc-500">{status}</p>}
    </section>
  );
}
