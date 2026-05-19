import Link from "next/link";

type Props = {
  href?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
};

const sizes = {
  sm: { icon: "h-7 w-7", text: "text-base", tag: "text-[10px]" },
  md: { icon: "h-9 w-9", text: "text-lg", tag: "text-xs" },
  lg: { icon: "h-11 w-11", text: "text-xl", tag: "text-sm" },
};

export function Logo({ href = "/", size = "md", showTagline = false }: Props) {
  const s = sizes[size];
  const inner = (
    <div className="flex items-center gap-3">
      <div
        className={`${s.icon} flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30`}
      >
        <svg viewBox="0 0 24 24" className="h-[55%] w-[55%] text-white" fill="none" aria-hidden>
          <path
            d="M4 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M8 11h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <span className={`${s.text} font-bold tracking-tight text-white`}>DocMind</span>
        {showTagline && (
          <p className={`${s.tag} text-slate-400`}>Enterprise document intelligence</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
