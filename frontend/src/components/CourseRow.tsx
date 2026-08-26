import type { Course } from "@lecturn/shared";
import { Link } from "react-router-dom";
import { CourseCard } from "./CourseCard";

interface CourseRowProps {
  title: string;
  titleHref?: string;
  courses: { course: Course; subtitle?: string }[];
  emptyText?: string;
}

export function CourseRow({ title, titleHref, courses, emptyText }: CourseRowProps) {
  if (courses.length === 0 && !emptyText) return null;

  return (
    <section>
      {titleHref ? (
        <Link to={titleHref} className="mb-3 inline-block text-lg font-semibold text-foreground hover:underline">
          {title}
        </Link>
      ) : (
        <h2 className="mb-3 text-lg font-semibold text-foreground">{title}</h2>
      )}
      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        // overflow-x-auto forces overflow-y to clip too (per spec, when only
        // one axis is set to a non-visible value the other computes to
        // "auto" as well) — pt-1 gives the card's hover ring headroom so it
        // doesn't get cut off at the row's top edge.
        <div className="flex gap-4 overflow-x-auto pb-2 pt-1">
          {courses.map(({ course, subtitle }) => (
            <div key={course.id} className="w-60 shrink-0">
              <CourseCard course={course} subtitle={subtitle} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
