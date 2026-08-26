import type { Course } from "@lecturn/shared";
import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { CoursePlaceholder } from "./CoursePlaceholder";
import { formatDuration } from "../lib/formatDuration";

export function CourseCard({ course, subtitle }: { course: Course; subtitle?: string }) {
  const metaLine = course.completedAt
    ? "Completed"
    : subtitle
      ? subtitle
      : typeof course.videoCount === "number"
        ? `${course.videoCount} lesson${course.videoCount === 1 ? "" : "s"}`
        : "";

  return (
    <Link to={`/courses/${course.id}`}>
      {/* pt-0 forced unconditionally: Card's own has-[>img:first-child]:pt-0
          rule only fires for a literal <img> first child, so the
          CoursePlaceholder path (a <div>, not an <img>) would otherwise get
          Card's normal top padding while a real cover image wouldn't —
          two visibly different-looking cards depending on data. */}
      <Card className="overflow-hidden pt-0">
        {course.coverImagePath ? (
          <img src={`/api/stream/cover/${course.id}`} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div className="aspect-video w-full overflow-hidden rounded-t-xl">
            <CoursePlaceholder title={course.title} />
          </div>
        )}
        <CardHeader>
          <CardTitle className="line-clamp-2">{course.title}</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            {course.completedAt && <CheckCircle2 size={14} className="text-emerald-500" />}
            {metaLine}
            {course.durationSeconds > 0 && <span>· {formatDuration(course.durationSeconds)}</span>}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
