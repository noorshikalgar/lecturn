import { fileStem } from "./classify.js";

const LEADING_ORDINAL_RE = /^\s*\d{1,3}\s*[.\-_):]+\s*/;

/** Best-effort human title from a raw filename/folder name. Only ever a starting
 * suggestion — the DB row it seeds is never overwritten by later rescans. */
export function cleanFilename(rawName: string): string {
  let name = fileStem(rawName);
  name = name.replace(LEADING_ORDINAL_RE, "");
  name = name.replace(/_/g, " ");
  name = name.replace(/\s+/g, " ").trim();
  if (!name) name = fileStem(rawName).trim();
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
