"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function UserMenu() {
  const { data, status } = useSession();
  if (status === "loading") return null;
  if (!data?.user?.email) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Link
          href="/login?callbackUrl=/dashboard"
          className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-emerald-700 px-2 py-1 text-emerald-50 hover:bg-emerald-600"
        >
          Register
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-xs text-zinc-400">
      <span className="truncate max-w-[180px]">{data.user.email}</span>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800"
      >
        Sign out
      </button>
    </div>
  );
}
