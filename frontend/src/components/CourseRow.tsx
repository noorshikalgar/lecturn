import type { Course } from "@lecturn/shared";
import { ChevronLeft, ChevronRight, FolderOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "./EmptyState";
import { CourseCard } from "./CourseCard";

interface CourseRowProps {
  title: string;
  titleHref?: string;
  courses: { course: Course; subtitle?: string; progress?: number }[];
  emptyText?: string;
  /** Shown as an eyebrow on every card in this row — only meaningful when
   * every course in the row shares one section (e.g. a per-section shelf);
   * mixed rows like "Continue Watching" omit it. */
  category?: string;
}

// Each card gets a fixed width instead of a grid cell so the row can scroll
// horizontally, Netflix-shelf style, instead of wrapping onto more lines —
// courses.length here can run into the dozens for a busy section, and a
// wrapping grid pushes everything below it steadily further down the page.
const CARD_WIDTH_PX = 210;

export function CourseRow({ title, titleHref, courses, emptyText, category }: CourseRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    // -4 (not -1) as slack for sub-pixel layout rounding, which would
    // otherwise leave the right arrow permanently enabled by a hair.
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  // Re-checks once courses actually arrive (this row starts out with zero
  // items while its query is loading) and any time the list itself changes.
  useEffect(() => {
    updateScrollState();
  }, [courses.length]);

  function scrollByPage(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    // 90% of the visible width, not a fixed card count — one click always
    // advances by "about a screenful" regardless of how narrow the row is.
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }

  if (courses.length === 0 && !emptyText) return null;

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        <div className="flex shrink-0 items-center gap-3">
          {courses.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => scrollByPage(-1)}
                disabled={!canScrollLeft}
                title={`Scroll ${title} left`}
                aria-label={`Scroll ${title} left`}
                className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => scrollByPage(1)}
                disabled={!canScrollRight}
                title={`Scroll ${title} right`}
                aria-label={`Scroll ${title} right`}
                className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          {titleHref && (
            <Link to={titleHref} className="text-[13.5px] text-muted-foreground hover:text-foreground">
              See all
            </Link>
          )}
        </div>
      </div>
      {courses.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Nothing here yet" description={emptyText} />
      ) : (
        <div
          ref={scrollerRef}
          onScroll={updateScrollState}
          className="flex gap-5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {courses.map(({ course, subtitle, progress }) => (
            <div key={course.id} className="shrink-0" style={{ width: CARD_WIDTH_PX }}>
              <CourseCard course={course} category={category} subtitle={subtitle} progress={progress} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
