import { fileStem } from "./classify.js";

const LEADING_ORDINAL_RE = /^\s*\d{1,3}\s*[.\-_):]+\s*/;

function stripOrdinalAndTidy(name: string): string {
  name = name.replace(LEADING_ORDINAL_RE, "");
  name = name.replace(/_/g, " ");
  name = name.replace(/\s+/g, " ").trim();
  return name;
}

/** Best-effort human title from a raw filename. Only ever a starting
 * suggestion — the DB row it seeds is never overwritten by later rescans. */
export function cleanFilename(rawName: string): string {
  const stem = fileStem(rawName);
  const name = stripOrdinalAndTidy(stem);
  return name || stem.trim() || rawName;
}

/** Best-effort human title from a raw folder name — same ordinal-stripping
 * and tidying as cleanFilename, but never runs fileStem's extension
 * removal. A directory has no file extension to strip in the first place,
 * and path.extname() doesn't know that: called on a folder like "Mastering
 * Next.js 13 with TypeScript" or "01. Getting Started (5m)", it treats
 * everything from the folder's own last "." onward as if it were a file
 * extension and chops it off — corrupting the title down to "Mastering
 * Next" or "01" respectively. Titles for actual files still go through
 * cleanFilename, where stripping a real extension is correct. */
export function cleanFolderName(rawName: string): string {
  const name = stripOrdinalAndTidy(rawName);
  return name || rawName;
}

const XML_TAGS = ["title", "plotoutline", "plot", "outline", "tagline", "name"];

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export interface NfoSuggestion {
  title?: string;
  description?: string;
}

/** Parses a Kodi-style .nfo file (usually XML, sometimes plain text) for a
 * title/description suggestion. Best-effort — never throws on malformed input. */
export function parseNfo(content: string): NfoSuggestion {
  const tags: Record<string, string> = {};
  for (const tag of XML_TAGS) {
    const match = content.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
    if (match) {
      const value = decodeXmlEntities(match[1]).trim();
      if (value) tags[tag] = value;
    }
  }

  if (tags.title || tags.plot || tags.plotoutline || tags.outline || tags.tagline) {
    return {
      title: tags.title ?? tags.name,
      description: tags.plot ?? tags.plotoutline ?? tags.outline ?? tags.tagline,
    };
  }

  const firstLine = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("<"));
  return firstLine ? { title: firstLine } : {};
}
