"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listUploadedDocs } from "@/lib/client/doc-store";
import { ChatPanel } from "@/components/ChatPanel";
import { DocManager } from "@/components/DocManager";
import { UploadZone } from "@/components/UploadZone";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  role: string;
  knowledgeBases: { id: string; name: string; _count: { documents: number } }[];
  stats: { documents: number; queries: number };
};

type QueryRow = {
  id: string;
  question: string;
  answerPreview: string | null;
  createdAt: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [orgId, setOrgId] = useState("");
  const [docRefresh, setDocRefresh] = useState(0);
  const [uiTick, setUiTick] = useState(0);
  const [recent, setRecent] = useState<QueryRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login?callbackUrl=/dashboard");
    }
  }, [authStatus, router]);

  const loadOrgs = useCallback(async () => {
    setLoadErr(null);
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 20_000);
      const res = await fetch("/api/orgs", { credentials: "include", signal: ac.signal });
      clearTimeout(t);
      const data = (await res.json()) as { orgs?: OrgRow[]; error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const list = data.orgs ?? [];
      setOrgs(list);
      setOrgId((prev) => {
        if (prev && list.some((o) => o.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? "Connection timed out — check that your database is running."
            : e.message
          : "Failed to load organizations";
      setLoadErr(msg);
    }
  }, []);

  const loadRecent = useCallback(async () => {
    if (!orgId) {
      setRecent([]);
      return;
    }
    try {
      const res = await fetch(`/api/queries?orgId=${encodeURIComponent(orgId)}`, {
        credentials: "include",
        headers: { "x-org-id": orgId },
      });
      const data = (await res.json()) as { queries?: QueryRow[] };
      if (res.ok) setRecent((data.queries ?? []).slice(0, 8));
    } catch {
      setRecent([]);
    }
  }, [orgId]);

  useEffect(() => {
    if (authStatus === "authenticated") void loadOrgs();
  }, [authStatus, loadOrgs, docRefresh, uiTick]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent, uiTick, orgId]);

  const activeOrg = useMemo(() => orgs.find((o) => o.id === orgId), [orgs, orgId]);

  const localDocs = listUploadedDocs().filter((d) => d.orgId === orgId).length;
  const stats = {
    documents: activeOrg?.stats.documents ?? 0,
    queries: activeOrg?.stats.queries ?? 0,
    localDocs,
  };

  const kbs = activeOrg?.knowledgeBases ?? [];

  if (authStatus === "loading" || authStatus === "unauthenticated") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="mt-4 text-sm text-slate-400">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Workspace overview
          </h1>
          <p className="section-subtitle">
            Manage documents and chat with your AI knowledge base.
          </p>
          {loadErr && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {loadErr}
              {loadErr === "Unauthorized" && (
                <>
                  {" "}
                  <Link href="/login?callbackUrl=/dashboard" className="underline">
                    Sign in
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Organization
          </span>
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="input-field w-full min-w-[220px] sm:w-72"
          >
            {orgs.length === 0 ? (
              <option value="">No organization</option>
            ) : (
              orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {o.role}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Indexed documents" value={stats.documents} hint="In your knowledge base" />
        <StatCard label="AI questions asked" value={stats.queries} hint="Logged for this org" />
        <StatCard label="Pending uploads" value={stats.localDocs} hint="Awaiting processing" />
      </div>

      {kbs.length > 0 && (
        <section className="glass-card p-6">
          <h2 className="section-title">Knowledge bases</h2>
          <p className="section-subtitle">Collections tied to your organization.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {kbs.map((kb) => (
              <article
                key={kb.id}
                className="rounded-xl border border-white/[0.06] bg-slate-950/50 p-4"
              >
                <h3 className="font-medium text-white">{kb.name}</h3>
                <p className="mt-2 text-sm text-slate-400">
                  {kb._count.documents} document{kb._count.documents === 1 ? "" : "s"}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section id="documents" className="scroll-mt-24">
        <div className="mb-4">
          <h2 className="section-title">Documents</h2>
          <p className="section-subtitle">Upload files to index them for AI search.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {orgId ? (
            <>
              <UploadZone
                orgId={orgId}
                onUploaded={() => {
                  setDocRefresh((n) => n + 1);
                  void loadOrgs();
                }}
              />
              <DocManager orgId={orgId} refreshKey={docRefresh} />
            </>
          ) : (
            <div className="glass-card lg:col-span-2 p-8 text-center">
              <p className="text-slate-400">Select an organization to upload documents.</p>
            </div>
          )}
        </div>
      </section>

      <section id="chat" className="scroll-mt-24">
        <div className="mb-4">
          <h2 className="section-title">AI assistant</h2>
          <p className="section-subtitle">
            Ask questions and get cited answers from your uploaded content.
          </p>
        </div>
        {orgId ? (
          <ChatPanel orgId={orgId} onActivity={() => setUiTick((n) => n + 1)} />
        ) : (
          <div className="glass-card p-8 text-center text-slate-400">
            Select an organization to start chatting.
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="glass-card p-6">
          <h2 className="section-title">Recent activity</h2>
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {recent.map((q) => (
              <li key={q.id} className="py-4 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-slate-200">{q.question}</p>
                {q.answerPreview && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{q.answerPreview}</p>
                )}
                <p className="mt-2 text-[11px] text-slate-600">
                  {new Date(q.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="glass-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
