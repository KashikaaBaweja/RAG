import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

type Props = {
  children: ReactNode;
  title: string;
  subtitle: ReactNode;
};

export function AuthShell({ children, title, subtitle }: Props) {
  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden w-[45%] overflow-hidden border-r border-white/[0.06] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-violet-600/10 to-transparent" />
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="relative">
          <Logo href="/" size="lg" showTagline />
        </div>
        <div className="relative space-y-6">
          <blockquote className="text-2xl font-semibold leading-snug text-white">
            &ldquo;Our team stopped searching PDF folders. DocMind answers in seconds—with
            proof.&rdquo;
          </blockquote>
          <p className="text-sm text-slate-400">— Built for knowledge-driven teams</p>
        </div>
        <p className="relative text-xs text-slate-500">
          Secure · Multi-tenant · Citation-backed AI
        </p>
      </aside>

      <main className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mb-8 lg:hidden">
          <Logo href="/" size="md" />
        </div>
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-xs text-slate-500">
            <Link href="/" className="text-indigo-400 hover:text-indigo-300">
              ← Back to home
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
