import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export type LoaderInput = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

function isMarkdown(mimeType: string, filename: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return true;
  return (
    mimeType === "text/markdown" ||
    mimeType === "text/x-markdown" ||
    mimeType === "application/markdown"
  );
}

/**
 * Parses PDF, DOCX, plain text, or Markdown into raw UTF-8 text.
 * Page numbers are not split here; the chunker/metadata layer assigns `page`
 * (placeholder `1` until per-page PDF extraction is added).
 */
export async function loadDocument(input: LoaderInput): Promise<string> {
  const { buffer, mimeType, filename } = input;
  const lower = filename.toLowerCase();

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    const result = await pdfParse(buffer);
    return result.text.trim();
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (isMarkdown(mimeType, filename)) {
    return buffer.toString("utf-8").trim();
  }

  return buffer.toString("utf-8").trim();
}
