import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions, assertOrgInToken } from "@/lib/auth";
import { deleteDocumentRecord, listDocuments } from "@/lib/db/knowledgeBase";

export const runtime = "nodejs";

/** List documents for an org (session must be a member). */
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

  const kbId = req.nextUrl.searchParams.get("knowledgeBaseId") ?? undefined;
  const docs = await listDocuments(orgId, kbId);
  return NextResponse.json({ documents: docs });
}

/** Remove document metadata (does not delete vectors from Pinecone yet). */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId") ?? req.headers.get("x-org-id") ?? "";
  const docId = req.nextUrl.searchParams.get("docId") ?? "";
  if (!orgId || !docId) {
    return NextResponse.json({ error: "orgId and docId required" }, { status: 400 });
  }

  try {
    assertOrgInToken(session.user.memberships, orgId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteDocumentRecord(orgId, docId);
  return NextResponse.json({ ok: true });
}
