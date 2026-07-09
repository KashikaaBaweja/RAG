import { NextResponse } from "next/server";

/** Pass-through only — auth is enforced in API routes / dashboard page. */
export default function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
