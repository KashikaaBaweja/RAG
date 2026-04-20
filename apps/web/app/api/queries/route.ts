import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions, assertOrgInToken } from "@/lib/auth";
import { listRecentQueries } from "@/lib/db/knowledgeBase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId") ?? req.headers.get("x-org-id") ?? "";
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  try {
    assertOrgInToken(session.user.memberships, orgId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const queries = await listRecentQueries(orgId, 20);
  return NextResponse.json({ queries });
}
