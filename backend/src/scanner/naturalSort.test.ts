import { describe, expect, it } from "vitest";
import { naturalCompare, naturalSortBy } from "./naturalSort.js";

describe("naturalCompare", () => {
  it("sorts numeric chunks numerically, not lexicographically", () => {
    const input = ["10 - Advanced", "2 - Basics", "1 - Intro"];
    const sorted = naturalSortBy(input, (s) => s);
    expect(sorted).toEqual(["1 - Intro", "2 - Basics", "10 - Advanced"]);
  });

  it("treats zero-padded and unpadded numbers as numerically equal", () => {
    // "9" and "09" are the same number, so natural sort doesn't try to
    // distinguish them — only their relative position to "2" and "10" matters.
    expect(naturalCompare("Lecture 9", "Lecture 09")).toBe(0);
    const sorted = naturalSortBy(["Lecture 10", "Lecture 2"], (s) => s);
    expect(sorted).toEqual(["Lecture 2", "Lecture 10"]);
  });

  it("is case-insensitive for alphabetic chunks", () => {
    expect(naturalCompare("banana", "Apple")).toBeGreaterThan(0);
  });

  it("treats a shorter matching prefix as sorting first", () => {
    const input = ["Part 1 Extended", "Part 1"];
    const sorted = naturalSortBy(input, (s) => s);
    expect(sorted).toEqual(["Part 1", "Part 1 Extended"]);
  });
});
