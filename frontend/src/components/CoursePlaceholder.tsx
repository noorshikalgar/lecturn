/** Cover art stand-in for a course with no cover image — a plain diagonal
 * stripe, consistent across every course rather than colored per-course, to
 * keep the library feeling like one calm catalog instead of a rainbow grid. */
export function CoursePlaceholder() {
  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: "var(--secondary)",
        backgroundImage:
          "repeating-linear-gradient(45deg, color-mix(in oklab, var(--primary) 14%, transparent) 0px, color-mix(in oklab, var(--primary) 14%, transparent) 10px, transparent 10px, transparent 20px)",
      }}
    />
  );
}
