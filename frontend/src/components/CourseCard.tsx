import type { Course } from "@lecturn/shared";
import { Check, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { CoursePlaceholder } from "./CoursePlaceholder";
import { formatDuration } from "../lib/formatDuration";

export function CourseCard({
  course,
  category,
  subtitle,
  progress,
}: {
  course: Course;
  /** Section/grouping label shown as a small eyebrow above the title —
   * omitted when the caller doesn't have a meaningful category for this row
   * (e.g. "Continue Watching" mixes courses from every section). */
  category?: string;
  subtitle?: string;
  progress?: number;
}) {
  const metaLine = course.completedByUser
    ? "Completed"
    : subtitle
      ? subtitle
      : typeof course.videoCount === "number"
        ? `${course.videoCount} lesson${course.videoCount === 1 ? "" : "s"}`
        : "";

  return (
    <Link
      to={`/courses/${course.id}`}
      className="group block overflow-hidden rounded-[10px] border border-border bg-card transition-colors duration-200 hover:border-primary/40"
    >
      <div className="relative aspect-video w-full overflow-hidden">
        {course.coverImagePath ? (
          <img
            src={`/api/stream/cover/${course.id}`}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
          />
        ) : (
          <CoursePlaceholder />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/15 group-hover:opacity-100">
          <span className="flex size-10 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md">
            <Play size={16} className="ml-0.5" fill="currentColor" />
          </span>
        </div>
        {course.completedByUser && (
          <span
            title="Completed"
            className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm ring-2 ring-white"
          >
            <Check size={14} strokeWidth={3} />
          </span>
        )}
        {typeof progress === "number" && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/20">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="p-4">
        {category && (
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-primary">{category}</p>
        )}
        {/* min-h reserves space for a 2-line title so every card in the same
            row/grid ends up the same height regardless of how long its title is. */}
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-[14.5px] font-semibold leading-[1.35] tracking-tight text-foreground">
          {course.title}
        </p>
        <p className={`mt-1 truncate text-[12.5px] ${course.completedByUser ? "font-medium text-emerald-600" : "text-muted-foreground"}`}>
          {metaLine}
          {course.durationSeconds > 0 && ` · ${formatDuration(course.durationSeconds)}`}
        </p>
      </div>
    </Link>
  );
}
