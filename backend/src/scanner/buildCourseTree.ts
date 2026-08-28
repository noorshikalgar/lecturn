import { readFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { fingerprintFile } from "./contentFingerprint.js";
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
  // Identifies the backing file's content, independent of its name/path —
  // undefined for "group"/"link" (no single backing file). See
  // contentFingerprint.ts and scanLibrary.ts's rename-detection fallback.
  contentFingerprint?: string;
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
): Promise<{ nodes: ParsedNode[]; archivesSkipped: number; nfoFiles: string[] }> {
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
      contentFingerprint: await fingerprintFile(join(dirAbsPath, videoName)),
    });
  }

  for (const subName of contents.subtitleFiles) {
    if (unmatched.has(subName)) {
      nodes.push({
        type: "file",
        rawName: subName,
        title: cleanFilename(subName),
        relativePath: joinRelative(relBase, subName),
        contentFingerprint: await fingerprintFile(join(dirAbsPath, subName)),
      });
    }
  }

  for (const fileName of contents.resourceFiles) {
    nodes.push({
      type: "file",
      rawName: fileName,
      title: cleanFilename(fileName),
      relativePath: joinRelative(relBase, fileName),
      contentFingerprint: await fingerprintFile(join(dirAbsPath, fileName)),
    });
  }

  for (const subdir of contents.subdirs) {
    const childRel = joinRelative(relBase, subdir);
    const child = await buildDir(join(dirAbsPath, subdir), childRel);
    archivesSkipped += child.archivesSkipped;
    if (child.nodes.length === 0) continue;

    const folderTitle = cleanFilename(subdir);
    // A folder-per-lecture layout (common in Udemy-style exports: "01
    // Introduction/Introduction.mp4") produces a folder whose one child is
    // just its own file, re-titled identically by cleanFilename — wrapping
    // it in a group node means the sidebar shows the same title twice in a
    // row for no reason. Promoting the lone child up in its place only
    // kicks in when the names actually match, so a folder with one
    // meaningfully-titled item (a real single-lesson chapter) still gets
    // its own heading.
    if (child.nodes.length === 1 && child.nodes[0].title === folderTitle) {
      nodes.push(child.nodes[0]);
    } else {
      nodes.push({
        type: "group",
        rawName: subdir,
        title: folderTitle,
        relativePath: childRel,
        children: child.nodes,
      });
    }
  }

  return { nodes: naturalSortBy(nodes, (n) => n.rawName), archivesSkipped, nfoFiles: contents.nfoFiles };
}

export async function buildCourseTree(courseRootAbsPath: string): Promise<CourseTreeResult> {
  // buildDir already reads the course root directory itself (depth 0) — reuse
  // its nfoFiles instead of a second readdir on the same path.
  const { nodes, archivesSkipped, nfoFiles: rootNfoNames } = await buildDir(courseRootAbsPath, "");

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
