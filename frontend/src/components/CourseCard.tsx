import type { Course } from "@coursedeck/shared";
import { Link } from "react-router-dom";
import { CoursePlaceholder } from "./CoursePlaceholder";
import { formatDuration } from "../lib/formatDuration";

export function CourseCard({ course, subtitle }: { course: Course; subtitle?: string }) {
  return (
    <Link
      to={`/courses/${course.id}`}
      className="group overflow-hidden rounded-lg border border-slate-800 bg-slate-900 transition hover:border-slate-600"
    >
      <div className="aspect-video">
        {course.coverImagePath ? (
          <img src={`/api/stream/cover/${course.id}`} alt="" className="h-full w-full object-cover" />
        ) : (
          <CoursePlaceholder title={course.title} />
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-medium text-slate-100 group-hover:text-white">{course.title}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle ?? formatDuration(course.durationSeconds)}</p>
      </div>
    </Link>
  );
}
