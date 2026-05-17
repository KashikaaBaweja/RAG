import { NextResponse } from "next/server";

// NOTE: Keep middleware lightweight in local dev to avoid auth middleware compile stalls.
export default function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/orgs/:path*",
    "/api/uploads/:path*",
    "/api/documents",
    "/api/queries",
    "/api/query",
    "/api/reindex",
    "/api/upload",
  ],
};
