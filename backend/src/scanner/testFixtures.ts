import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** A fixture spec is a flat map of relative path -> file content ("" for a
 * touch-only file). Directories are inferred from the paths and created
 * automatically, so an empty directory needs an explicit trailing entry
 * (e.g. "EmptyFolder/.keep") if the test needs one to exist. */
export async function makeFixtureTree(spec: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lecturn-scan-"));
  for (const [relPath, content] of Object.entries(spec)) {
    const abs = join(root, relPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
  return root;
}

export async function cleanupFixtureTree(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}
