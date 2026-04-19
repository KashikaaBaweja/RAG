import type { RecentQueryRecord, UploadedDocRecord } from "./types";

const DOCS_KEY = "rag_docs_v1";
const QUERIES_KEY = "rag_queries_v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function listUploadedDocs(): UploadedDocRecord[] {
  return readJson<UploadedDocRecord[]>(DOCS_KEY, []);
}

export function upsertUploadedDoc(doc: UploadedDocRecord) {
  const list = listUploadedDocs().filter((d) => d.docId !== doc.docId);
  list.unshift(doc);
  writeJson(DOCS_KEY, list.slice(0, 200));
}

export function removeUploadedDoc(docId: string) {
  writeJson(
    DOCS_KEY,
    listUploadedDocs().filter((d) => d.docId !== docId)
  );
}

export function listRecentQueries(): RecentQueryRecord[] {
  return readJson<RecentQueryRecord[]>(QUERIES_KEY, []);
}

export function pushRecentQuery(entry: Omit<RecentQueryRecord, "id"> & { id?: string }) {
  const id = entry.id ?? crypto.randomUUID();
  const list = [{ ...entry, id }, ...listRecentQueries()].slice(0, 30);
  writeJson(QUERIES_KEY, list);
}
