import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export type LoaderInput = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

/**
 * Parses PDF, DOCX, or plain text into raw UTF-8 text.
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

  return buffer.toString("utf-8").trim();
}
