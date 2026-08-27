import { createHash } from "node:crypto";
import { open } from "node:fs/promises";

// How much of the start/end of a file to sample. Large enough that two
// distinct videos are astronomically unlikely to collide (container/codec
// headers alone make the first few KB highly distinctive), small enough
// that fingerprinting a multi-GB video costs a fixed ~128KB of I/O instead
// of reading the whole thing.
const SAMPLE_BYTES = 64 * 1024;

/** Identifies a file by its size plus a hash of its first and last
 * SAMPLE_BYTES — cheap regardless of file size, and stable across a pure
 * rename or move (same bytes, different path). Deliberately not size alone:
 * two unrelated lecture videos landing on the exact same byte count happens
 * in real course libraries (many exports re-encode to a target bitrate),
 * and treating that as "the same file, renamed" would hand one lesson's
 * progress to a completely different one. Deliberately not a full-file
 * hash either: reading an entire video to fingerprint it would make
 * scanning a large library noticeably slower for no real gain in
 * collision-resistance over a sampled hash. */
export async function fingerprintFile(absPath: string): Promise<string | undefined> {
  let handle;
  try {
    handle = await open(absPath, "r");
    const size = (await handle.stat()).size;
    const hash = createHash("sha1");
    hash.update(String(size));

    const head = Buffer.alloc(Math.min(SAMPLE_BYTES, size));
    if (head.length > 0) {
      await handle.read(head, 0, head.length, 0);
      hash.update(head);
    }

    if (size > SAMPLE_BYTES) {
      const tailStart = Math.max(size - SAMPLE_BYTES, head.length);
      const tail = Buffer.alloc(size - tailStart);
      await handle.read(tail, 0, tail.length, tailStart);
      hash.update(tail);
    }

    return `${size}:${hash.digest("hex")}`;
  } catch {
    // Gone/unreadable between the readdir listing and this read — the node
    // just won't be rename-matchable this scan, not worth failing the scan over.
    return undefined;
  } finally {
    await handle?.close();
  }
}
