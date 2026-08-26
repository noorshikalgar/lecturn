import type { Course } from "@lecturn/shared";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { CoursePlaceholder } from "./CoursePlaceholder";
import { formatDuration } from "../lib/formatDuration";

export function CourseCard({ course, subtitle }: { course: Course; subtitle?: string }) {
  const code = `LEC-${String(course.id).padStart(3, "0")}`;
  const status = course.completedAt ? "COMPLETE" : "AVAILABLE";

  return (
    <Link
      to={`/courses/${course.id}`}
      className="group block overflow-hidden rounded-md border border-slate-800 bg-slate-900 shadow-sm transition-colors duration-150 hover:border-accent-700/70"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-2.5 py-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[9px] uppercase tracking-wider text-slate-500" title={subtitle}>
          Lecturn{subtitle ? ` // ${subtitle}` : ""}
        </span>
        <span className="shrink-0 font-mono text-[9px] text-slate-600">[{code}]</span>
      </div>

      <div className="relative aspect-video">
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
          <span title="Completed" className="absolute right-1.5 top-1.5 rounded-full bg-emerald-600 p-1 shadow">
            <CheckCircle2 size={13} className="text-white" />
          </span>
        )}
      </div>

      <div className="p-2.5">
        <p
          title={course.title}
          className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-100 group-hover:text-white"
        >
          {course.title}
        </p>
        <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-1.5">
          <span
            className={`font-mono text-[9px] uppercase tracking-wider ${course.completedAt ? "text-emerald-500" : "text-accent-500"}`}
          >
            {status}
          </span>
          <ArrowUpRight size={12} className="shrink-0 text-slate-600 transition-colors group-hover:text-accent-400" />
        </div>
      </div>
    </Link>
  );
}
