import Link from "next/link";
import { Logo } from "@/components/Logo";

const features = [
  {
    title: "Upload any document",
    description: "PDF, Word, Markdown, and plain text. Automatic parsing and indexing in minutes.",
    icon: "📄",
  },
  {
    title: "Ask in natural language",
    description: "Chat with your files. Every answer links back to the exact source passage.",
    icon: "💬",
  },
  {
    title: "Team-ready workspaces",
    description: "Organizations, roles, and isolated knowledge bases—ready for multi-tenant SaaS.",
    icon: "🏢",
  },
  {
    title: "Your data, your stack",
    description: "Run on your infrastructure with Postgres, vector search, and optional cloud AI.",
    icon: "🔒",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo href="/" size="md" />
          <nav className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary hidden px-4 py-2 sm:inline-flex">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary px-4 py-2">
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 text-center md:pt-28">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            AI-powered document intelligence
          </p>
          <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
            Turn your documents into a{" "}
            <span className="gradient-text">searchable knowledge base</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            DocMind ingests your files, understands them with retrieval-augmented AI, and
            delivers accurate answers with citations—so your team never hunts through PDFs again.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register" className="btn-primary px-8 py-3 text-base">
              Get started free
            </Link>
            <Link href="/login" className="btn-secondary px-8 py-3 text-base">
              Sign in to workspace
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">No credit card · Self-host or cloud-ready</p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <article key={f.title} className="glass-card-hover p-6">
                <span className="text-2xl" aria-hidden>
                  {f.icon}
                </span>
                <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-slate-900/40 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="glass-card overflow-hidden p-8 md:p-12">
              <div className="grid gap-10 md:grid-cols-2 md:items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white md:text-3xl">
                    Built to sell as your product
                  </h2>
                  <p className="mt-4 text-slate-400">
                    White-label ready architecture: multi-tenant orgs, secure uploads, streaming
                    chat, and audit-friendly query logs. Deploy on AWS, GCP, or your own servers.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-slate-300">
                    {[
                      "Hybrid vector + keyword retrieval",
                      "Streaming answers with source chips",
                      "Enterprise auth & org isolation",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl">
                  <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-4">
                    <div className="h-3 w-3 rounded-full bg-red-400/80" />
                    <div className="h-3 w-3 rounded-full bg-amber-400/80" />
                    <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
                    <span className="ml-2 text-xs text-slate-500">DocMind workspace</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600/40 px-4 py-2 text-indigo-50">
                      Summarize our Q3 policy document
                    </div>
                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-slate-800/80 px-4 py-3 text-slate-200">
                      Q3 policy emphasizes remote-work eligibility and updated expense caps…
                      <span className="mt-2 inline-block rounded-md bg-indigo-500/20 px-2 py-0.5 font-mono text-[10px] text-indigo-300">
                        [SOURCE:policy.pdf]
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to launch your knowledge product?</h2>
          <p className="mt-4 text-slate-400">
            Create an account and upload your first document in under two minutes.
          </p>
          <Link href="/register" className="btn-primary mt-8 inline-flex px-10 py-3 text-base">
            Create your workspace
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 sm:flex-row">
          <Logo href="/" size="sm" />
          <p>© {new Date().getFullYear()} DocMind. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
