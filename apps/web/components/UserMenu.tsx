"use client";

import { signOut, useSession } from "next-auth/react";

export function UserMenu() {
  const { data } = useSession();
  if (!data?.user?.email) return null;
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
