import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface BrowseResult {
  path: string;
  parent: string | null;
  directories: string[];
}

/** Lists immediate subdirectories of a server-side path, for the admin's
 * "browse for a folder" picker — a browser's native folder picker can only
 * see the client machine's filesystem, not the server's, so this has to be
 * a real server-side listing endpoint. Dotfiles hidden, files excluded.
 *
 * Deliberately unconfined to any root: its whole purpose is finding where a
 * library actually lives *before* one is configured, so there's no root to
 * confine it to yet. Directory names only (no file contents, no reads
 * outside `readdir`) and gated by requireAdmin at the route level — the
 * access this grants is bounded by "what the admin could already do with an
 * admin account," not a new capability. */
export async function browseDirectory(rawPath: string): Promise<BrowseResult> {
  const target = resolve(rawPath || "/");
  const entries = await readdir(target, { withFileTypes: true });
  const directories = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
  const parent = target === "/" ? null : dirname(target);
  return { path: target, parent, directories };
}
