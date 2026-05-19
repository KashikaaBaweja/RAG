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
  for (;;) {
    m = re.exec(text);
    if (m === null) break;
    if (m.index > last) {
      nodes.push(<span key={`t-${last}`}>{text.slice(last, m.index)}</span>);
    }
    const id = m[1] ?? "";
    if (!id) continue;
    nodes.push(
      <button
        key={`c-${m.index}-${id}`}
        type="button"
        onClick={() => onChip(id)}
        className="mx-0.5 inline-flex items-center rounded-md bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[11px] text-indigo-300 ring-1 ring-indigo-500/30 hover:bg-indigo-500/30"
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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: CitationPayload[];
};

function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ChatPanel({ orgId, onActivity }: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
    setMessages((prev) => [
      ...prev,
      { id: makeMessageId(), role: "user", content: q },
      { id: makeMessageId(), role: "assistant", content: "" },
    ]);

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
    <section className="glass-card flex min-h-[480px] flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-indigo-500/5 px-5 py-4">
        <div>
          <h2 className="font-semibold text-white">AI assistant</h2>
          <p className="text-xs text-slate-500">Cited answers from your knowledge base</p>
        </div>
        {streaming && (
          <button
            type="button"
            onClick={abort}
            className="rounded-lg border border-amber-500/30 px-3 py-1 text-xs text-amber-300 hover:bg-amber-500/10"
          >
            Stop
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/50 p-8 text-center">
            <p className="text-sm font-medium text-slate-300">Ask your first question</p>
            <p className="mt-2 text-xs text-slate-500">
              Try: &ldquo;Summarize the main points in my documents&rdquo;
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto rounded-tr-sm bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
                : "mr-auto rounded-tl-sm border border-white/[0.06] bg-slate-800/80 text-slate-100"
            }`}
          >
            {m.role === "assistant"
              ? renderWithCitationChips(m.content, openCitation)
              : m.content}
          </div>
        ))}
      </div>
      {error && <p className="px-4 pb-2 text-xs text-red-400">{error}</p>}
      <footer className="border-t border-white/[0.06] bg-slate-950/50 p-4">
        <div className="flex gap-3">
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
            placeholder="Ask about your documents…"
            className="input-field min-h-[48px] flex-1 resize-none"
          />
          <button
            type="button"
            disabled={streaming || !input.trim()}
            onClick={() => void send()}
            className="btn-primary self-end px-5 disabled:opacity-40"
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
