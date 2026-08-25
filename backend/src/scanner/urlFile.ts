/** Parses a Windows .url shortcut file's [InternetShortcut] URL= line. */
export function parseUrlShortcut(content: string): string | null {
  const match = content.match(/^\s*URL\s*=\s*(.+)\s*$/im);
  return match ? match[1].trim() : null;
}
