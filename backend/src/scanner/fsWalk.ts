import { readdir } from "node:fs/promises";
import { isArchiveFile, isJunkFile, isNfoFile, isResourceFile, isSubtitleFile, isVideoFile } from "./classify.js";

export interface DirContents {
  subdirs: string[];
  videoFiles: string[];
  subtitleFiles: string[];
  nfoFiles: string[];
  archiveFiles: string[];
  resourceFiles: string[];
}

export async function readDirContents(dirPath: string): Promise<DirContents> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const contents: DirContents = {
    subdirs: [],
    videoFiles: [],
    subtitleFiles: [],
    nfoFiles: [],
    archiveFiles: [],
    resourceFiles: [],
  };

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      contents.subdirs.push(entry.name);
      continue;
    }
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (isJunkFile(name)) continue;
    if (isVideoFile(name)) contents.videoFiles.push(name);
    else if (isSubtitleFile(name)) contents.subtitleFiles.push(name);
    else if (isNfoFile(name)) contents.nfoFiles.push(name);
    else if (isArchiveFile(name)) contents.archiveFiles.push(name);
    else if (isResourceFile(name)) contents.resourceFiles.push(name);
  }

  return contents;
}
