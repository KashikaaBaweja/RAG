import type { DocumentStatus, OrgRole } from "@prisma/client";
import { prisma } from "./prisma";

/** All KB queries are scoped by `orgId` — pass the org from an already-authorized session. */

export async function listKnowledgeBases(orgId: string) {
  return prisma.knowledgeBase.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { documents: true } } },
  });
}

export async function createKnowledgeBase(orgId: string, name: string) {
  return prisma.knowledgeBase.create({
    data: { orgId, name },
  });
}

export async function getDefaultKnowledgeBase(orgId: string) {
  const first = await prisma.knowledgeBase.findFirst({
    where: { orgId },
    orderBy: { createdAt: "asc" },
  });
  if (first) return first;
  return prisma.knowledgeBase.create({
    data: { orgId, name: "Default" },
  });
}

export async function listDocuments(orgId: string, knowledgeBaseId?: string) {
  return prisma.document.findMany({
    where: {
      orgId,
      ...(knowledgeBaseId ? { knowledgeBaseId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDocumentRecord(input: {
  orgId: string;
  knowledgeBaseId: string;
  docId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  status?: DocumentStatus;
}) {
  return prisma.document.create({
    data: {
      orgId: input.orgId,
      knowledgeBaseId: input.knowledgeBaseId,
      docId: input.docId,
      storageKey: input.storageKey,
      filename: input.filename,
      mimeType: input.mimeType,
      status: input.status ?? "PENDING",
    },
  });
}

export async function updateDocumentStatus(
  orgId: string,
  docId: string,
  status: DocumentStatus
) {
  return prisma.document.updateMany({
    where: { orgId, docId },
    data: { status },
  });
}

export async function deleteDocumentRecord(orgId: string, docId: string) {
  return prisma.document.deleteMany({
    where: { orgId, docId },
  });
}

export async function createQueryLog(input: {
  orgId: string;
  userId?: string | null;
  question: string;
  answerPreview?: string | null;
}) {
  return prisma.query.create({
    data: {
      orgId: input.orgId,
      userId: input.userId ?? undefined,
      question: input.question,
      answerPreview: input.answerPreview ?? undefined,
    },
  });
}

export async function listRecentQueries(orgId: string, take = 20) {
  return prisma.query.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function assertMembership(userId: string, orgId: string, minRole?: OrgRole) {
  const m = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!m) throw new Error("Not a member of this organization");
  if (!minRole) return m;
  const order: OrgRole[] = ["MEMBER", "ADMIN", "OWNER"];
  if (order.indexOf(m.role) < order.indexOf(minRole)) {
    throw new Error("Insufficient role");
  }
  return m;
}
