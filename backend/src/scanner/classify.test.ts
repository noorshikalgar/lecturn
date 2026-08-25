import { describe, expect, it } from "vitest";
import { fileStem, isArchiveFile, isJunkFile, isNfoFile, isResourceFile, isSubtitleFile, isUrlShortcutFile, isVideoFile } from "./classify.js";

describe("file classification", () => {
  it("recognizes video extensions from the real library census", () => {
    for (const name of ["Lecture.mp4", "clip.MOV", "old.mkv", "legacy.m4v"]) {
      expect(isVideoFile(name)).toBe(true);
    }
    expect(isVideoFile("notes.txt")).toBe(false);
  });

  it("recognizes subtitle extensions", () => {
    expect(isSubtitleFile("Lecture.vtt")).toBe(true);
    expect(isSubtitleFile("Lecture.srt")).toBe(true);
    expect(isSubtitleFile("Lecture.mp4")).toBe(false);
  });

  it("recognizes archives, nfo, and url shortcuts", () => {
    expect(isArchiveFile("Course.zip")).toBe(true);
    expect(isArchiveFile("Course.7z")).toBe(true);
    expect(isNfoFile("course.nfo")).toBe(true);
    expect(isUrlShortcutFile("Slides.url")).toBe(true);
  });

  it("treats anything else as a generic resource", () => {
    for (const name of ["slides.pdf", "notes.txt", "index.html", "seed.sql", "run.sh", "cover.png", "data.csv"]) {
      expect(isResourceFile(name)).toBe(true);
    }
    expect(isResourceFile("Lecture.mp4")).toBe(false);
    expect(isResourceFile("Lecture.vtt")).toBe(false);
    expect(isResourceFile("Course.zip")).toBe(false);
    expect(isResourceFile("course.nfo")).toBe(false);
  });

  it("flags .url shortcuts and OS-generated clutter as junk, case-insensitively", () => {
    for (const name of ["Slides.url", "Thumbs.db", "thumbs.db", "desktop.ini", "Desktop.ini", "ehthumbs.db"]) {
      expect(isJunkFile(name)).toBe(true);
    }
    expect(isJunkFile("notes.txt")).toBe(false);
  });

  it("excludes junk files from being treated as a generic resource", () => {
    expect(isResourceFile("Slides.url")).toBe(false);
    expect(isResourceFile("Thumbs.db")).toBe(false);
    expect(isResourceFile("desktop.ini")).toBe(false);
  });

  it("strips extensions for the file stem", () => {
    expect(fileStem("01 - Introduction.mp4")).toBe("01 - Introduction");
    expect(fileStem("no-extension")).toBe("no-extension");
  });
});
