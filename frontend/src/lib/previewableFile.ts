const TEXT_EXTENSIONS = new Set(["txt", "csv", "log"]);
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);
const INLINE_EXTENSIONS = new Set(["pdf"]);
const HTML_EXTENSIONS = new Set(["html", "htm"]);

export type PreviewKind = "text" | "markdown" | "pdf" | "html";

function ext(rawName: string): string {
  return rawName.split(".").pop()?.toLowerCase() ?? "";
}

/** Matches the backend's PREVIEWABLE_TEXT_EXTENSIONS / PREVIEWABLE_INLINE_EXTENSIONS
 * allowlists in nodes.routes.ts — kept in sync by hand since they're short, stable lists. */
export function getPreviewKind(rawName: string): PreviewKind | null {
  const e = ext(rawName);
  if (TEXT_EXTENSIONS.has(e)) return "text";
  if (MARKDOWN_EXTENSIONS.has(e)) return "markdown";
  if (INLINE_EXTENSIONS.has(e)) return "pdf";
  if (HTML_EXTENSIONS.has(e)) return "html";
  return null;
}

export function isPreviewableFile(rawName: string): boolean {
  return getPreviewKind(rawName) !== null;
}
