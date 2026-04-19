"use client";

import { useCallback, useState, type ReactNode } from "react";
import { pushRecentQuery } from "@/lib/client/doc-store";
import type { CitationPayload } from "@/lib/client/types";
import { useStreamQuery } from "@/hooks/useStreamQuery";
import { SourceDrawer } from "./SourceDrawer";

const SOURCE_RE = /\[SOURCE:([^\]\s]+)\]/g;

function renderWithCitationChips(
  text: string,
  onChip: (id: string) => void
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(SOURCE_RE.source, SOURCE_RE.flags);
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(<span key={`t-${last}`}>{text.slice(last, m.index)}</span>);
    }
    const id = m[1]!;
    nodes.push(
      <button
        key={`c-${m.index}-${id}`}
        type="button"
        onClick={() => onChip(id)}
        className="mx-0.5 inline-flex items-center rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-zinc-700"
      >
        [{id.slice(0, 12)}…]
      </button>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    nodes.push(<span key="t-end">{text.slice(last)}</span>);
  }
  return nodes.length ? nodes : [text];
}

type Props = {
  orgId: string;
  onActivity?: () => void;
};

export function ChatPanel({ orgId, onActivity }: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string; citations?: CitationPayload[] }[]
  >([]);
  const [drawer, setDrawer] = useState<{ open: boolean; citation: CitationPayload | null }>({
    open: false,
    citation: null,
  });
  const [citationIndex, setCitationIndex] = useState<Map<string, CitationPayload>>(new Map());

  const { streamAnswer, streaming, error, abort } = useStreamQuery({ orgId });

  const openCitation = useCallback(
    (chunkId: string) => {
      const c = citationIndex.get(chunkId);
      if (c) setDrawer({ open: true, citation: c });
    },
    [citationIndex]
  );

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || streaming) return;

    const prior = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }, { role: "assistant", content: "" }]);

    let assistant = "";
    const idx = new Map<string, CitationPayload>();
    setCitationIndex(idx);

    await streamAnswer(q, prior, {
      onToken: (t) => {
        assistant += t;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, content: assistant };
          }
          return next;
        });
      },
      onCitations: (citations) => {
        for (const c of citations) idx.set(c.chunkId, c);
        setCitationIndex(new Map(idx));
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, content: assistant, citations };
          }
          return next;
        });
      },
      onDone: (full) => {
        assistant = full;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: full,
              citations: last.citations,
            };
          }
          return next;
        });
        pushRecentQuery({
          query: q,
          preview: full.slice(0, 160),
          at: new Date().toISOString(),
        });
        onActivity?.();
      },
      onError: (msg) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, content: `Error: ${msg}` };
          }
          return next;
        });
      },
    });
  }, [messages, onActivity, streamAnswer, streaming, input]);

  return (
    <section className="flex min-h-[420px] flex-col rounded-xl border border-zinc-800 bg-zinc-900/40">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-medium text-zinc-200">Ask your knowledge base</h2>
        {streaming && (
          <button
            type="button"
            onClick={abort}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            Stop
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">Ask a question — answers stream with inline source chips.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[95%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto bg-emerald-900/30 text-emerald-50"
                : "mr-auto bg-zinc-800/80 text-zinc-100"
            }`}
          >
            {m.role === "assistant"
              ? renderWithCitationChips(m.content, openCitation)
              : m.content}
          </div>
        ))}
      </div>
      {error && <p className="px-4 pb-2 text-xs text-red-400">{error}</p>}
      <footer className="border-t border-zinc-800 p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="Question…"
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none"
          />
          <button
            type="button"
            disabled={streaming || !input.trim()}
            onClick={() => void send()}
            className="self-end rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </footer>
      <SourceDrawer
        open={drawer.open}
        onClose={() => setDrawer({ open: false, citation: null })}
        citation={drawer.citation}
      />
    </section>
  );
}
