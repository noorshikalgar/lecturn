import { describe, expect, it } from "vitest";
import { cleanFilename, parseNfo } from "./titleSuggest.js";

describe("cleanFilename", () => {
  it("strips leading numeric ordinals and separators", () => {
    expect(cleanFilename("01 - Introduction to Docker.mp4")).toBe("Introduction to Docker");
    expect(cleanFilename("1. Getting Started.mp4")).toBe("Getting Started");
    expect(cleanFilename("02_intro_to_docker.mp4")).toBe("intro to docker");
  });

  it("leaves meaningful Part/Chapter labels alone", () => {
    expect(cleanFilename("Chapter 1 - Getting Started")).toBe("Chapter 1 - Getting Started");
    expect(cleanFilename("Part 1")).toBe("Part 1");
  });

  it("falls back to the raw name if cleaning empties the string", () => {
    expect(cleanFilename("01.mp4")).not.toBe("");
  });
});

describe("parseNfo", () => {
  it("extracts title and plot from Kodi-style XML", () => {
    const xml = `<movie>\n<title>Learn Rust</title>\n<plot>A complete Rust course.</plot>\n</movie>`;
    expect(parseNfo(xml)).toEqual({ title: "Learn Rust", description: "A complete Rust course." });
  });

  it("decodes basic XML entities", () => {
    const xml = `<title>Node &amp; Express Crash Course</title>`;
    expect(parseNfo(xml).title).toBe("Node & Express Crash Course");
  });

  it("falls back to the first non-empty line for plain-text nfo files", () => {
    const plain = "\n\nZero2Hero C Programming\nA deep dive into C.\n";
    expect(parseNfo(plain)).toEqual({ title: "Zero2Hero C Programming" });
  });

  it("returns an empty suggestion for unparseable content", () => {
    expect(parseNfo("")).toEqual({});
  });
});
