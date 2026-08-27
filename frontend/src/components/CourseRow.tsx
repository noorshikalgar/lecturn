import type { Course } from "@lecturn/shared";
import { FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "./EmptyState";
import { CourseCard } from "./CourseCard";

interface CourseRowProps {
  title: string;
  titleHref?: string;
  courses: { course: Course; subtitle?: string; progress?: number }[];
  emptyText?: string;
  /** Shown as an eyebrow on every card in this row — only meaningful when
   * every course in the row shares one section (e.g. a per-section shelf);
   * mixed rows like "Continue Watching" omit it. */
  category?: string;
}

export function CourseRow({ title, titleHref, courses, emptyText, category }: CourseRowProps) {
  if (courses.length === 0 && !emptyText) return null;

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {titleHref && (
          <Link to={titleHref} className="text-[13.5px] text-muted-foreground hover:text-foreground">
            See all
          </Link>
        )}
      </div>
      {courses.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Nothing here yet" description={emptyText} />
      ) : (
        <div className="grid grid-cols-2 gap-7 sm:grid-cols-3 lg:grid-cols-4">
          {courses.map(({ course, subtitle, progress }) => (
            <CourseCard key={course.id} course={course} category={category} subtitle={subtitle} progress={progress} />
          ))}
        </div>
      )}
    </section>
  );
}
