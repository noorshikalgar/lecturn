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
      <Card className="overflow-hidden">
        {course.coverImagePath ? (
          <img src={`/api/stream/cover/${course.id}`} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div className="aspect-video w-full">
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
