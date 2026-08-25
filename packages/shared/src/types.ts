export type Role = "admin" | "user";

export type NodeType = "group" | "video" | "file" | "link";

export interface User {
  id: number;
  username: string;
  role: Role;
  createdAt: string;
}

export interface Library {
  id: number;
  rootPath: string;
  lastScannedAt: string | null;
}

export interface Section {
  id: number;
  title: string;
  slug: string;
  orderIndex: number;
}

export interface Course {
  id: number;
  sectionId: number | null;
  title: string;
  description: string | null;
  folderPath: string;
  topLevelFolder: string | null;
  coverImagePath: string | null;
  durationSeconds: number;
  completedAt: string | null;
  createdAt: string;
}

export interface CourseNode {
  id: number;
  courseId: number;
  parentId: number | null;
  type: NodeType;
  title: string;
  rawName: string;
  orderIndex: number;
  orderLocked: boolean;
  relativePath: string;
  missing: boolean;
  targetUrl: string | null;
}

export interface VideoMeta {
  nodeId: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  container: string | null;
  needsRemux: boolean;
  probedAt: string | null;
}

export interface SubtitleTrack {
  id: number;
  nodeId: number;
  label: string;
  sourceFormat: "vtt" | "srt";
  sourcePath: string;
  cachedVttPath: string | null;
}

export interface Progress {
  userId: number;
  videoNodeId: number;
  positionSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
}

export interface Note {
  id: number;
  userId: number;
  videoNodeId: number;
  timestampSeconds: number | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Certificate {
  id: number;
  courseId: number;
  filePath: string;
  uploadedAt: string;
}

export interface LearningPath {
  id: number;
  title: string;
  description: string | null;
  coverImage: string | null;
}

export interface PathCourse {
  pathId: number;
  courseId: number;
  orderIndex: number;
}

export interface CourseTreeNode extends CourseNode {
  children: CourseTreeNode[];
  video?: VideoMeta;
  subtitles?: SubtitleTrack[];
}

export interface ScanSummary {
  libraryId: number;
  coursesFound: number;
  videosFound: number;
  filesFound: number;
  missingFlagged: number;
  archivesSkipped: number;
  emptyFoldersSkipped: number;
  scannedAt: string;
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  directories: string[];
}
