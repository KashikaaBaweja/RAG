import Link from "next/link";
import type { ReactNode } from "react";
import { UserMenu } from "@/components/UserMenu";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-zinc-100">
            RAG workspace
          </Link>
          <div className="flex items-center gap-4">
            <nav className="hidden text-xs text-zinc-500 sm:block">Phase 5 · auth + DB</nav>
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
