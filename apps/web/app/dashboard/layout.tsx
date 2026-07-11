import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard#documents", label: "Documents" },
  { href: "/dashboard#chat", label: "AI Chat" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/[0.06] bg-slate-950/50 backdrop-blur-xl lg:flex">
        <div className="border-b border-white/[0.06] p-5">
          <Logo href="/dashboard" size="md" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/[0.06] p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Product</p>
          <p className="mt-1 text-xs text-slate-400">DocMind v1.0</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="lg:hidden">
              <Logo href="/dashboard" size="sm" />
            </div>
            <p className="hidden text-sm text-slate-400 sm:block">
              Your private knowledge workspace
            </p>
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
