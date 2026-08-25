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

  it("parses a .url shortcut into a link node with its target", async () => {
    root = await makeFixtureTree({
      "Lecture 01.mp4": "",
      "Course Slides.url": "[InternetShortcut]\nURL=https://example.com/slides\n",
    });
    const { tree } = await buildCourseTree(root);
    const link = tree.find((n) => n.type === "link");
    expect(link?.targetUrl).toBe("https://example.com/slides");
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
