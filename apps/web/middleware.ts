import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

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
