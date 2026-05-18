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
            ? "Request timed out — is Postgres running and DATABASE_URL set? (docker compose up -d)"
            : e.message
          : "Failed to load orgs";
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
    return <p className="text-sm text-zinc-500">Checking session…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Org-scoped data from Postgres; Pinecone namespace matches org id.
          </p>
          {loadErr && (
            <p className="mt-2 text-xs text-red-400">
              {loadErr}
              {loadErr === "Unauthorized" && (
                <>
                  {" "}
                  <Link href="/login?callbackUrl=/dashboard" className="underline text-emerald-400">
                    Sign in
                  </Link>{" "}
                  or{" "}
                  <Link href="/register" className="underline text-emerald-400">
                    register
                  </Link>
                  .
                </>
              )}
            </p>
          )}
        </div>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Active organization
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          >
            {orgs.length === 0 ? (
              <option value="">No orgs — register & sign in</option>
            ) : (
              orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.role})
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Documents (DB)" value={stats.documents} />
        <StatCard label="Queries (DB)" value={stats.queries} />
        <StatCard label="Local upload cache" value={stats.localDocs} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Knowledge bases</h2>
        {kbs.length === 0 ? (
          <p className="text-sm text-zinc-500">No knowledge bases.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {kbs.map((kb) => (
              <article
                key={kb.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
              >
                <h3 className="font-medium text-zinc-100">{kb.name}</h3>
                <p className="mt-3 text-xs text-zinc-400">{kb._count.documents} document(s)</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Recent queries</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">No queries logged for this org yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/20">
            {recent.map((q) => (
              <li key={q.id} className="px-4 py-3">
                <p className="text-sm text-zinc-200">{q.question}</p>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{q.answerPreview}</p>
                <p className="mt-1 text-[11px] text-zinc-600">
                  {new Date(q.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

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
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-2">
            <p className="text-sm text-zinc-500">
              Select an organization to upload or manage documents.
            </p>
          </section>
        )}
      </div>

      {orgId ? (
        <ChatPanel orgId={orgId} onActivity={() => setUiTick((n) => n + 1)} />
      ) : (
        <p className="text-sm text-zinc-500">Select an organization to use chat.</p>
      )}
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
