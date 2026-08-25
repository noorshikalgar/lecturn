import { describe, expect, it } from "vitest";
import { matchSubtitles } from "./subtitles.js";

describe("matchSubtitles", () => {
  it("pairs a single default-language subtitle with its video", () => {
    const { assignments, unmatched } = matchSubtitles(["Lecture 01.mp4"], ["Lecture 01.vtt"]);
    expect(assignments.get("Lecture 01.mp4")).toEqual([{ fileName: "Lecture 01.vtt", label: "English", format: "vtt" }]);
    expect(unmatched.size).toBe(0);
  });

  it("supports multiple language tracks for one video", () => {
    const { assignments } = matchSubtitles(
      ["Lecture 01.mp4"],
      ["Lecture 01.en.vtt", "Lecture 01.es.srt", "Lecture 01 (French).vtt"],
    );
    const tracks = assignments.get("Lecture 01.mp4")!;
    expect(tracks).toHaveLength(3);
    expect(tracks.map((t) => t.label)).toEqual(["En", "Es", "French"]);
  });

  it("picks the longest matching video stem when names overlap", () => {
    const { assignments } = matchSubtitles(
      ["Lecture 1.mp4", "Lecture 1 Extended.mp4"],
      ["Lecture 1 Extended.vtt"],
    );
    expect(assignments.get("Lecture 1 Extended.mp4")).toHaveLength(1);
    expect(assignments.get("Lecture 1.mp4")).toBeUndefined();
  });

  it("leaves orphan subtitles with no matching video unmatched", () => {
    const { unmatched } = matchSubtitles(["Lecture 01.mp4"], ["Old Recording.srt"]);
    expect(unmatched.has("Old Recording.srt")).toBe(true);
  });
});
