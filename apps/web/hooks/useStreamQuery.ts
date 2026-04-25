"use client";

import { useCallback, useRef, useState } from "react";
import type { CitationPayload } from "@/lib/client/types";

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "citations"; citations: CitationPayload[] }
  | { type: "done"; answer: string }
  | { type: "error"; message: string };

function parseSseBlock(block: string): StreamEvent | null {
  const line = block.split("\n").find((l) => l.startsWith("data: "));
  if (!line) return null;
  const raw = line.slice(5).trim();
  if (raw === "[DONE]") return null;
  try {
    return JSON.parse(raw) as StreamEvent;
  } catch {
    return null;
  }
}

export type UseStreamQueryOptions = {
  orgId?: string;
  onEvent?: (e: StreamEvent) => void;
};

/**
 * POST `/api/query` with `stream: true` and read SSE `data:` JSON frames.
 */
export function useStreamQuery(options: UseStreamQueryOptions = {}) {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const orgRef = useRef(options.orgId);
  orgRef.current = options.orgId;
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const streamAnswer = useCallback(
    async (
      query: string,
      history: { role: "user" | "assistant"; content: string }[],
      handlers: {
        onToken: (t: string) => void;
        onCitations: (c: CitationPayload[]) => void;
        onDone: (full: string) => void;
        onError?: (m: string) => void;
      }
    ) => {
      setError(null);
      setStreaming(true);
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch("/api/query", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(orgRef.current ? { "x-org-id": orgRef.current } : {}),
          },
          body: JSON.stringify({
            query,
            stream: true,
            orgId: orgRef.current,
            history,
          }),
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let carry = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          carry += decoder.decode(value, { stream: true });
          const parts = carry.split("\n\n");
          carry = parts.pop() ?? "";
          for (const block of parts) {
            const ev = parseSseBlock(block);
            if (!ev) continue;
            onEventRef.current?.(ev);
            if (ev.type === "token") handlers.onToken(ev.content);
            else if (ev.type === "citations") handlers.onCitations(ev.citations);
            else if (ev.type === "done") handlers.onDone(ev.answer);
            else if (ev.type === "error") handlers.onError?.(ev.message);
          }
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        handlers.onError?.(msg);
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    []
  );

  return { streamAnswer, streaming, error, abort };
}
