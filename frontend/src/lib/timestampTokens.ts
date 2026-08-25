export function formatTimestampToken(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `@${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `@${m}:${String(s).padStart(2, "0")}`;
}

const TOKEN_RE = /@(?:(\d+):)?(\d{1,2}):(\d{2})/g;

export function parseTimestampToken(token: string): number | null {
  const match = /^@(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(token);
  if (!match) return null;
  const h = match[1] ? Number(match[1]) : 0;
  const m = Number(match[2]);
  const s = Number(match[3]);
  return h * 3600 + m * 60 + s;
}

export interface BodySegment {
  type: "text" | "timestamp";
  value: string;
  seconds?: number;
}

/** Splits note body text into plain-text and @mm:ss timestamp segments so the
 * caller can render timestamp tokens as clickable seek links. */
export function splitBodyIntoSegments(body: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ type: "text", value: body.slice(lastIndex, index) });
    const seconds = parseTimestampToken(match[0]);
    segments.push({ type: "timestamp", value: match[0], seconds: seconds ?? undefined });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) segments.push({ type: "text", value: body.slice(lastIndex) });
  return segments;
}
