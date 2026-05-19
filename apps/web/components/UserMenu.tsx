"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function UserMenu() {
  const { data, status } = useSession();
  if (status === "loading") return null;
  if (!data?.user?.email) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login?callbackUrl=/dashboard" className="btn-secondary px-3 py-2 text-xs">
          Sign in
        </Link>
        <Link href="/register" className="btn-primary px-3 py-2 text-xs">
          Register
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[160px] truncate rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 sm:inline">
        {data.user.email}
      </span>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="btn-secondary px-3 py-2 text-xs"
      >
        Sign out
      </button>
    </div>
  );
}
