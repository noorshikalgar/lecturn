import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { classifyFolder, looksLikeInternalStructure, looksLikeSeparateInstallment } from "./classifyFolder.js";
import { cleanupFixtureTree, makeFixtureTree } from "./testFixtures.js";

let root: string | undefined;
afterEach(async () => {
  if (root) await cleanupFixtureTree(root);
  root = undefined;
});

describe("looksLikeSeparateInstallment", () => {
  it("recognizes Part/Volume/Season as a separate installment", () => {
    for (const name of ["Part 1", "Part 2 - Advanced", "Volume 3", "Season 1"]) {
      expect(looksLikeSeparateInstallment(name)).toBe(true);
    }
  });

  it("does not flag chapter-level or descriptive names", () => {
    for (const name of ["Chapter 2 - Advanced", "01 - Setup", "Module 3", "Week 1", "Angular Forms 2023", "Learn Rust"]) {
      expect(looksLikeSeparateInstallment(name)).toBe(false);
    }
  });
});

describe("looksLikeInternalStructure", () => {
  it("recognizes Chapter/Module/Lesson/Week/Unit and plain numbering", () => {
    for (const name of ["Chapter 2 - Advanced", "01 - Setup", "Module 3", "Week 1", "Lesson 4", "Unit 5"]) {
      expect(looksLikeInternalStructure(name)).toBe(true);
    }
  });

  it("does not flag Part/Volume/Season or ordinary descriptive names", () => {
    for (const name of ["Part 1", "Volume 2", "Angular Forms 2023", "Learn Rust", "Low Level Academy"]) {
      expect(looksLikeInternalStructure(name)).toBe(false);
    }
  });
});

describe("classifyFolder", () => {
  it("classifies a folder with videos directly inside as a course", async () => {
    root = await makeFixtureTree({ "Lecture 01.mp4": "" });
    expect(await classifyFolder(root)).toBe("course");
  });

  it("splits Part 1 / Part 2 into separate courses, never merged", async () => {
    root = await makeFixtureTree({
      "Part 1 - Basics/Lecture 01.mp4": "",
      "Part 2 - Advanced/Lecture 02.mp4": "",
    });
    expect(await classifyFolder(root)).toBe("section");
    expect(await classifyFolder(join(root, "Part 1 - Basics"))).toBe("course");
    expect(await classifyFolder(join(root, "Part 2 - Advanced"))).toBe("course");
  });

  it("keeps Chapter 1 / Chapter 2 merged as one course's internal structure", async () => {
    root = await makeFixtureTree({
      "Chapter 1/Lecture 01.mp4": "",
      "Chapter 2/Lecture 02.mp4": "",
    });
    expect(await classifyFolder(root)).toBe("course");
  });

  it("still splits Part folders even alongside a Chapter-named sibling", async () => {
    root = await makeFixtureTree({
      "Part 1/Lecture 01.mp4": "",
      "Chapter 2/Lecture 02.mp4": "",
    });
    expect(await classifyFolder(root)).toBe("section");
  });

  it("classifies a folder of distinctly-named course subfolders as a section", async () => {
    root = await makeFixtureTree({
      "Angular Forms 2023/Lecture 01.mp4": "",
      "Learn Rust/Lecture 01.mp4": "",
      "Low Level Academy/Lecture 01.mp4": "",
    });
    expect(await classifyFolder(root)).toBe("section");
  });

  it("classifies a folder with a single video-bearing child as a course", async () => {
    root = await makeFixtureTree({ "Some Wrapper Folder/Lecture 01.mp4": "" });
    expect(await classifyFolder(root)).toBe("course");
  });

  it("classifies a folder with no videos anywhere as empty", async () => {
    root = await makeFixtureTree({ "Books/notes.pdf": "" });
    expect(await classifyFolder(root)).toBe("empty");
  });

  it("classifies a section containing a nested category (Web > Frontend)", async () => {
    root = await makeFixtureTree({
      "Frontend/React Masterclass/Lecture 01.mp4": "",
      "Frontend/Vue Fundamentals/Lecture 01.mp4": "",
      "Backend/Node Crash Course/Lecture 01.mp4": "",
      "Backend/Django REST/Lecture 01.mp4": "",
    });
    expect(await classifyFolder(root)).toBe("section");
    expect(await classifyFolder(join(root, "Frontend"))).toBe("section");
    expect(await classifyFolder(join(root, "Backend"))).toBe("section");
  });

  it("treats a category with only one course in it as that course, not a section", async () => {
    root = await makeFixtureTree({ "Blockchain/Solidity Bootcamp/Lecture 01.mp4": "" });
    expect(await classifyFolder(root)).toBe("course");
  });
});
