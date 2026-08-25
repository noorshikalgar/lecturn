import type { Course } from "@lecturn/shared";
import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { CoursePlaceholder } from "./CoursePlaceholder";
import { formatDuration } from "../lib/formatDuration";

export function CourseCard({ course, subtitle }: { course: Course; subtitle?: string }) {
  return (
    <Link
      to={`/courses/${course.id}`}
      className="group block overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-lg hover:shadow-black/30"
    >
      <div className="relative aspect-video">
        {course.coverImagePath ? (
          <img src={`/api/stream/cover/${course.id}`} alt="" className="h-full w-full object-cover" />
        ) : (
          <CoursePlaceholder title={course.title} />
        )}
        {course.durationSeconds > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-slate-100">
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
          className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-slate-100 group-hover:text-white"
        >
          {course.title}
        </p>
        <p className="mt-1 truncate text-xs text-slate-500" title={subtitle}>
          {subtitle ?? " "}
        </p>
      </div>
    </Link>
  );
}
