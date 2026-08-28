import { afterEach, describe, expect, it } from "vitest";
import { buildCourseTree } from "./buildCourseTree.js";
import { cleanupFixtureTree, makeFixtureTree } from "./testFixtures.js";

let root: string | undefined;
afterEach(async () => {
  if (root) await cleanupFixtureTree(root);
  root = undefined;
});

function findByTitle(nodes: import("./buildCourseTree.js").ParsedNode[], title: string): import("./buildCourseTree.js").ParsedNode | undefined {
  for (const n of nodes) {
    if (n.title === title) return n;
    if (n.children) {
      const found = findByTitle(n.children, title);
      if (found) return found;
    }
  }
  return undefined;
}

describe("buildCourseTree", () => {
  it("builds a deeply nested Part > Chapter > video tree in natural sort order", async () => {
    root = await makeFixtureTree({
      "Part 2 - Advanced/Chapter 1/10 - Wrap Up.mp4": "",
      "Part 2 - Advanced/Chapter 1/2 - Deep Dive.mp4": "",
      "Part 1 - Basics/Chapter 1/01 - Intro.mp4": "",
    });
    const { tree } = await buildCourseTree(root);
    expect(tree.map((n) => n.title)).toEqual(["Part 1 - Basics", "Part 2 - Advanced"]);

    const part2Chapter1 = tree[1].children![0];
    // natural sort: "2 - Deep Dive" before "10 - Wrap Up", not lexicographic
    expect(part2Chapter1.children!.map((n) => n.rawName)).toEqual(["2 - Deep Dive.mp4", "10 - Wrap Up.mp4"]);
  });

  it("matches multi-language subtitles to their video and keeps orphan subtitles as resources", async () => {
    root = await makeFixtureTree({
      "Lecture 01.mp4": "",
      "Lecture 01.en.vtt": "WEBVTT",
      "Lecture 01.es.srt": "1\n00:00:00,000 --> 00:00:01,000\nHola",
      "Old Standalone.srt": "orphaned",
    });
    const { tree } = await buildCourseTree(root);
    const video = tree.find((n) => n.type === "video")!;
    expect(video.subtitles).toHaveLength(2);
    expect(video.subtitles!.map((s) => s.format).sort()).toEqual(["srt", "vtt"]);

    const orphan = tree.find((n) => n.rawName === "Old Standalone.srt");
    expect(orphan?.type).toBe("file");
  });

  it("ignores .url shortcuts and OS-generated junk entirely — no node created", async () => {
    root = await makeFixtureTree({
      "Lecture 01.mp4": "",
      "Course Slides.url": "[InternetShortcut]\nURL=https://example.com/slides\n",
      "Thumbs.db": "",
      "desktop.ini": "",
    });
    const { tree } = await buildCourseTree(root);
    expect(tree.some((n) => n.type === "link")).toBe(false);
    expect(tree.map((n) => n.rawName)).toEqual(["Lecture 01.mp4"]);
  });

  it("counts skipped zip/7z archives without descending into them", async () => {
    root = await makeFixtureTree({
      "Lecture 01.mp4": "",
      "Bonus Materials.zip": "not a real zip",
      "Extra.7z": "not a real 7z",
    });
    const { archivesSkipped, tree } = await buildCourseTree(root);
    expect(archivesSkipped).toBe(2);
    expect(tree.some((n) => n.rawName.endsWith(".zip"))).toBe(false);
  });

  it("keeps generic resource files (pdf, txt, html, sql, sh) as downloadable file nodes", async () => {
    root = await makeFixtureTree({
      "Lecture 01.mp4": "",
      "slides.pdf": "",
      "notes.txt": "",
      "seed.sql": "",
      "setup.sh": "",
    });
    const { tree } = await buildCourseTree(root);
    const fileNames = tree.filter((n) => n.type === "file").map((n) => n.rawName).sort();
    expect(fileNames).toEqual(["notes.txt", "seed.sql", "setup.sh", "slides.pdf"]);
  });

  it("derives a course title/description suggestion from a root .nfo file", async () => {
    root = await makeFixtureTree({
      "Lecture 01.mp4": "",
      "course.nfo": "<movie><title>Zero2Hero C Programming</title><plot>Deep dive into C.</plot></movie>",
    });
    const { courseNfo, tree } = await buildCourseTree(root);
    expect(courseNfo).toEqual({ title: "Zero2Hero C Programming", description: "Deep dive into C." });
    expect(tree.some((n) => n.rawName === "course.nfo")).toBe(false);
  });

  it("flattens a folder-per-lecture wrapper whose one file shares its cleaned title", async () => {
    root = await makeFixtureTree({
      "1 - Introduction/Introduction.mp4": "",
      "2 - Prerequisites/Prerequisites.mp4": "",
    });
    const { tree } = await buildCourseTree(root);
    // No "Introduction" group wrapping an "Introduction" video — just the
    // video itself, promoted to where the group would have been.
    expect(tree.map((n) => ({ type: n.type, title: n.title }))).toEqual([
      { type: "video", title: "Introduction" },
      { type: "video", title: "Prerequisites" },
    ]);
    expect(tree[0].relativePath).toBe("1 - Introduction/Introduction.mp4");
  });

  it("keeps a single-child folder as a real group when its title doesn't match the child's", async () => {
    root = await makeFixtureTree({
      "Bonus Content/some-video-file.mp4": "",
    });
    const { tree } = await buildCourseTree(root);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ type: "group", title: "Bonus Content" });
    expect(tree[0].children).toHaveLength(1);
  });

  it("omits an empty subfolder from the tree entirely", async () => {
    root = await makeFixtureTree({
      "Lecture 01.mp4": "",
      "Empty Folder/.keep": "",
    });
    const { tree } = await buildCourseTree(root);
    expect(tree.some((n) => n.rawName === "Empty Folder")).toBe(false);
  });

  it("gives every video a cleaned, human-readable title", async () => {
    root = await makeFixtureTree({ "01_intro_to_docker.mp4": "" });
    const { tree } = await buildCourseTree(root);
    expect(tree[0].title).toBe("intro to docker");
  });

  it("assembles relativePath using forward slashes for nested nodes", async () => {
    root = await makeFixtureTree({ "Part 1/Chapter 1/Lecture 01.mp4": "" });
    const { tree } = await buildCourseTree(root);
    const video = findByTitle(tree, "Lecture 01");
    expect(video?.relativePath).toBe("Part 1/Chapter 1/Lecture 01.mp4");
  });
});
