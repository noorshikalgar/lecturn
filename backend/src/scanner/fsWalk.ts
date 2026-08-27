import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
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

    // Dirent.isDirectory()/isFile() are lstat-based and both return false for
    // a symlink, so a symlinked course folder would otherwise vanish from the
    // scan entirely. Resolve the link's target to classify it properly.
    let isDirectory = entry.isDirectory();
    let isFile = entry.isFile();
    if (entry.isSymbolicLink()) {
      try {
        const target = await stat(join(dirPath, entry.name));
        isDirectory = target.isDirectory();
        isFile = target.isFile();
      } catch {
        continue; // broken symlink
      }
    }

    if (isDirectory) {
      contents.subdirs.push(entry.name);
      continue;
    }
    if (!isFile) continue;
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
