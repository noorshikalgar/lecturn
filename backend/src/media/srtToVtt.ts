const SRT_TIMESTAMP_RE = /(\d{2}:\d{2}:\d{2}),(\d{3})/g;

/** Converts SRT subtitle text to WebVTT: swap the comma millisecond separator
 * for a period and prepend the required WEBVTT header. */
export function srtToVtt(srtContent: string): string {
  const normalized = srtContent.replace(/\r\n/g, "\n").replace(SRT_TIMESTAMP_RE, "$1.$2");
  return `WEBVTT\n\n${normalized.trim()}\n`;
}
