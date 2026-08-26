import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { CourseCard } from "../components/CourseCard";
import { PageContainer } from "../components/layout/PageContainer";
import { getSectionCourses, getSections } from "../lib/api/courses";

export function SectionPage() {
  const { id } = useParams<{ id: string }>();
  const sectionId = Number(id);

  const { data, isLoading } = useQuery({
    queryKey: ["section-courses", sectionId],
    queryFn: () => getSectionCourses(sectionId),
    enabled: Number.isFinite(sectionId),
  });

  const { data: sectionsData } = useQuery({ queryKey: ["sections"], queryFn: getSections });
  const section = sectionsData?.sections.find((s) => s.id === sectionId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">{section?.title ?? "Section"}</h1>
        {data?.courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No courses in this section yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {data?.courses.map((course) => <CourseCard key={course.id} course={course} />)}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
