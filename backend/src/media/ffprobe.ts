import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
  codec: string;
  container: string;
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
}

interface FfprobeOutput {
  format?: { duration?: string; format_name?: string };
  streams?: FfprobeStream[];
}

/** Runs ffprobe on a file and extracts duration/resolution/codec. Always
 * called with an absolute path built from trusted DB rows — never user text —
 * and execFile (not a shell) so there's no argument-injection surface. */
export async function probeVideo(absolutePath: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", absolutePath],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout) as FfprobeOutput;
  const videoStream = parsed.streams?.find((s) => s.codec_type === "video");

  return {
    durationSeconds: Number(parsed.format?.duration ?? 0) || 0,
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    codec: videoStream?.codec_name ?? "unknown",
    container: (parsed.format?.format_name ?? "unknown").split(",")[0],
  };
}
