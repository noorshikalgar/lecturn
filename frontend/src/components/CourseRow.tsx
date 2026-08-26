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
        <Link to={titleHref} className="mb-3 inline-block text-lg font-semibold text-slate-100 hover:text-white">
          {title}
        </Link>
      ) : (
        <h2 className="mb-3 text-lg font-semibold text-slate-100">{title}</h2>
      )}
      {courses.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
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
