import type { Course } from "@lecturn/shared";
import { ArrowUpRight, CheckCircle2, Clock, ListVideo } from "lucide-react";
import { Link } from "react-router-dom";
import { CoursePlaceholder } from "./CoursePlaceholder";
import { formatDuration } from "../lib/formatDuration";

export function CourseCard({ course, subtitle }: { course: Course; subtitle?: string }) {
  const code = `LEC-${String(course.id).padStart(3, "0")}`;
  const status = course.completedAt ? "COMPLETE" : "AVAILABLE";
  const descriptionLine = course.description || subtitle || "";

  return (
    <Link
      to={`/courses/${course.id}`}
      className="group block overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-700/60 hover:shadow-lg hover:shadow-black/30"
    >
      <div className="relative aspect-video">
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/75 px-2 py-1 backdrop-blur-[1px]">
          <span className="font-mono text-[9px] uppercase tracking-wider text-slate-200">Course</span>
          <span className="font-mono text-[9px] tracking-wide text-slate-300">{code}</span>
        </div>
        {course.coverImagePath ? (
          <img src={`/api/stream/cover/${course.id}`} alt="" className="h-full w-full object-cover" />
        ) : (
          <CoursePlaceholder title={course.title} />
        )}
        {course.durationSeconds > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">
            {formatDuration(course.durationSeconds)}
          </span>
        )}
        {course.completedAt && (
          <span title="Completed" className="absolute bottom-1.5 left-1.5 rounded-full bg-emerald-600 p-1 shadow">
            <CheckCircle2 size={13} className="text-white" />
          </span>
        )}
      </div>

      {/* Every block below reserves its height unconditionally (description,
          meta row, progress bar) — a card with no description or an
          incomplete course must still end up exactly as tall as one that
          has both, or cards in the same row/grid drift out of alignment. */}
      <div className="p-3">
        <p
          title={course.title}
          className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-snug text-slate-100 group-hover:text-white"
        >
          {course.title}
        </p>

        <p className="mt-1 line-clamp-1 min-h-[1rem] text-xs text-slate-500" title={descriptionLine || undefined}>
          {descriptionLine || " "}
        </p>

        <div className="mt-2.5 flex min-h-[1rem] items-center gap-3 font-mono text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <ListVideo size={11} className="text-slate-600" />
            {course.videoCount ?? 0} lesson{course.videoCount === 1 ? "" : "s"}
          </span>
          {course.durationSeconds > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={11} className="text-slate-600" />
              {formatDuration(course.durationSeconds)}
            </span>
          )}
        </div>

        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-800">
          {course.completedAt && <div className="h-full w-full rounded-full bg-emerald-500" />}
        </div>

        <div className="mt-2.5 flex items-center justify-between border-t border-slate-800 pt-2">
          <span
            className={`font-mono text-[10px] uppercase tracking-wider ${course.completedAt ? "text-emerald-500" : "text-accent-500"}`}
          >
            {status}
          </span>
          <ArrowUpRight size={13} className="shrink-0 text-slate-600 transition-colors group-hover:text-accent-400" />
        </div>
      </div>
    </Link>
  );
}
