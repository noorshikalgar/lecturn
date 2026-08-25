const PREVIEWABLE_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "log"]);

/** Matches the backend's PREVIEWABLE_TEXT_EXTENSIONS allowlist in
 * nodes.routes.ts — kept in sync by hand since it's a short, stable list. */
export function isPreviewableTextFile(rawName: string): boolean {
  const ext = rawName.split(".").pop()?.toLowerCase();
  return !!ext && PREVIEWABLE_EXTENSIONS.has(ext);
}
