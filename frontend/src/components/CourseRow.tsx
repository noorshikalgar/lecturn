import type { Collection, Course } from "@lecturn/shared";
import { ChevronLeft, ChevronRight, FolderOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "./EmptyState";
import { CourseCard } from "./CourseCard";
import { CollectionCard } from "./CollectionCard";

interface CourseRowProps {
  title: string;
  titleHref?: string;
  courses: { course: Course; subtitle?: string; progress?: number }[];
  /** Grouped courses show as their collection card instead, never
   * individually — see courses.collectionId's schema comment. Sorted
   * alongside `courses` by title so the row doesn't visually segregate
   * them into two blocks. Omit for a row that can never contain one
   * (e.g. "Continue Watching" always names the specific part being
   * watched, never its collection). */
  collections?: Collection[];
  emptyText?: string;
  /** Shown as an eyebrow on every card in this row — only meaningful when
   * every course in the row shares one section (e.g. a per-section shelf);
   * mixed rows like "Continue Watching" omit it. */
  category?: string;
}

type RowItem =
  | { kind: "course"; key: string; title: string; course: Course; subtitle?: string; progress?: number }
  | { kind: "collection"; key: string; title: string; collection: Collection };

// Each card gets a fixed width instead of a grid cell so the row can scroll
// horizontally, Netflix-shelf style, instead of wrapping onto more lines —
// courses.length here can run into the dozens for a busy section, and a
// wrapping grid pushes everything below it steadily further down the page.
const CARD_WIDTH_PX = 210;

export function CourseRow({ title, titleHref, courses, collections, emptyText, category }: CourseRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const items: RowItem[] = [
    ...courses.map(
      ({ course, subtitle, progress }): RowItem => ({ kind: "course", key: course.id, title: course.title, course, subtitle, progress }),
    ),
    ...(collections ?? []).map((collection): RowItem => ({ kind: "collection", key: collection.id, title: collection.title, collection })),
  ].sort((a, b) => a.title.localeCompare(b.title));

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
  }, [items.length]);

  function scrollByPage(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    // 90% of the visible width, not a fixed card count — one click always
    // advances by "about a screenful" regardless of how narrow the row is.
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }

  if (items.length === 0 && !emptyText) return null;

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        <div className="flex shrink-0 items-center gap-3">
          {items.length > 1 && (
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
      {items.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Nothing here yet" description={emptyText} />
      ) : (
        <div
          ref={scrollerRef}
          onScroll={updateScrollState}
          className="flex gap-5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <div key={item.key} className="shrink-0" style={{ width: CARD_WIDTH_PX }}>
              {item.kind === "course" ? (
                <CourseCard course={item.course} category={category} subtitle={item.subtitle} progress={item.progress} />
              ) : (
                <CollectionCard collection={item.collection} />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
