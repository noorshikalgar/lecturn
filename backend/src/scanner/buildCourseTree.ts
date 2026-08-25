import { readFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { readDirContents } from "./fsWalk.js";
import { matchSubtitles, type SubtitleMatch } from "./subtitles.js";
import { cleanFilename, parseNfo, type NfoSuggestion } from "./titleSuggest.js";
import { naturalSortBy } from "./naturalSort.js";

// "link" is still a valid stored type — old scans from before .url shortcuts
// stopped being parsed may still have link nodes on disk-backed data — but
// nothing here creates new ones anymore.
export type ParsedNodeType = "group" | "video" | "file" | "link";

export interface ParsedSubtitle extends SubtitleMatch {
  relativePath: string;
}

export interface ParsedNode {
  type: ParsedNodeType;
  rawName: string;
  title: string;
  relativePath: string;
  targetUrl?: string;
  subtitles?: ParsedSubtitle[];
  children?: ParsedNode[];
}

export interface CourseTreeResult {
  tree: ParsedNode[];
  archivesSkipped: number;
  courseNfo?: NfoSuggestion;
}

function joinRelative(base: string, name: string): string {
  return base ? posix.join(base, name) : name;
}

async function buildDir(
  dirAbsPath: string,
  relBase: string,
): Promise<{ nodes: ParsedNode[]; archivesSkipped: number }> {
  const contents = await readDirContents(dirAbsPath);
  let archivesSkipped = contents.archiveFiles.length;
  const nodes: ParsedNode[] = [];

  const { assignments, unmatched } = matchSubtitles(contents.videoFiles, contents.subtitleFiles);

  for (const videoName of contents.videoFiles) {
    const matches = assignments.get(videoName) ?? [];
    nodes.push({
      type: "video",
      rawName: videoName,
      title: cleanFilename(videoName),
      relativePath: joinRelative(relBase, videoName),
      subtitles: matches.map((m) => ({ ...m, relativePath: joinRelative(relBase, m.fileName) })),
    });
  }

  for (const subName of contents.subtitleFiles) {
    if (unmatched.has(subName)) {
      nodes.push({
        type: "file",
        rawName: subName,
        title: cleanFilename(subName),
        relativePath: joinRelative(relBase, subName),
      });
    }
  }

  for (const fileName of contents.resourceFiles) {
    nodes.push({
      type: "file",
      rawName: fileName,
      title: cleanFilename(fileName),
      relativePath: joinRelative(relBase, fileName),
    });
  }

  for (const subdir of contents.subdirs) {
    const childRel = joinRelative(relBase, subdir);
    const child = await buildDir(join(dirAbsPath, subdir), childRel);
    archivesSkipped += child.archivesSkipped;
    if (child.nodes.length > 0) {
      nodes.push({
        type: "group",
        rawName: subdir,
        title: cleanFilename(subdir),
        relativePath: childRel,
        children: child.nodes,
      });
    }
  }

  return { nodes: naturalSortBy(nodes, (n) => n.rawName), archivesSkipped };
}

export async function buildCourseTree(courseRootAbsPath: string): Promise<CourseTreeResult> {
  const { nodes, archivesSkipped } = await buildDir(courseRootAbsPath, "");

  const rootNfoNames = (await readDirContents(courseRootAbsPath)).nfoFiles;
  let courseNfo: NfoSuggestion | undefined;
  if (rootNfoNames.length > 0) {
    try {
      const content = await readFile(join(courseRootAbsPath, rootNfoNames[0]), "utf-8");
      courseNfo = parseNfo(content);
    } catch {
      courseNfo = undefined;
    }
  }

  return { tree: nodes, archivesSkipped, courseNfo };
}
