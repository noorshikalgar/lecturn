import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// The mocked "ffmpeg" needs to actually produce the temp file runRemux
// renames afterward — real execFile never runs in this test, so nothing
// else creates it.
const execFileMock = vi.fn((_cmd: string, args: string[], cb: (err: Error | null) => void) => {
  const tmpPath = args[args.length - 1];
  mkdirSync(tmpPath.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(tmpPath, "fake remuxed content");
  cb(null);
});

vi.mock("node:child_process", () => ({
  execFile: (cmd: string, args: string[], cb: (err: Error | null) => void) => execFileMock(cmd, args, cb),
}));

const { remuxCachePath, ensureRemuxed } = await import("./remux.js");

// ensureRemuxed is the only thing standing between "every video plays" and
// "every video calls out to ffmpeg on every single request" — its on-disk
// cache check and in-flight dedup are what make the unconditional remux in
// stream.routes.ts cheap instead of expensive. Both are worth pinning down
// directly rather than trusting they still work by inspection.
describe("ensureRemuxed", () => {
  afterEach(() => {
    execFileMock.mockClear();
  });

  it("runs ffmpeg once and returns the cached target path", async () => {
    const nodeId = Math.floor(Math.random() * 1_000_000) + 1;
    const target = remuxCachePath(nodeId);
    try {
      const result = await ensureRemuxed("/source/video.mkv", nodeId);
      expect(result).toBe(target);
      expect(execFileMock).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(target, { force: true });
    }
  });

  it("skips ffmpeg entirely when the target is already cached on disk", async () => {
    const nodeId = Math.floor(Math.random() * 1_000_000) + 1;
    const target = remuxCachePath(nodeId);
    mkdirSync(target.split("/").slice(0, -1).join("/"), { recursive: true });
    writeFileSync(target, "already remuxed");
    try {
      const result = await ensureRemuxed("/source/video.mkv", nodeId);
      expect(result).toBe(target);
      expect(execFileMock).not.toHaveBeenCalled();
    } finally {
      rmSync(target, { force: true });
    }
  });

  it("shares one in-flight remux between concurrent callers for the same node", async () => {
    const nodeId = Math.floor(Math.random() * 1_000_000) + 1;
    const target = remuxCachePath(nodeId);
    try {
      const [a, b] = await Promise.all([ensureRemuxed("/source/video.mkv", nodeId), ensureRemuxed("/source/video.mkv", nodeId)]);
      expect(a).toBe(target);
      expect(b).toBe(target);
      expect(execFileMock).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(target, { force: true });
    }
  });
});
