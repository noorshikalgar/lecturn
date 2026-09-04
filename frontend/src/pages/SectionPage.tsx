import { useQuery } from "@tanstack/react-query";
import { FolderXIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { CourseCard } from "../components/CourseCard";
import { CollectionCard } from "../components/CollectionCard";
import { EmptyState } from "../components/EmptyState";
import { PageContainer } from "../components/layout/PageContainer";
import { getSectionCourses, getSections } from "../lib/api/courses";

export function SectionPage() {
  const { id } = useParams<{ id: string }>();
  const sectionId = id ?? "";
  const validId = Boolean(sectionId);

  const { data, isLoading } = useQuery({
    queryKey: ["section-courses", sectionId],
    queryFn: () => getSectionCourses(sectionId),
    enabled: validId,
  });

  const { data: sectionsData, isLoading: sectionsLoading } = useQuery({ queryKey: ["sections"], queryFn: getSections });
  const section = sectionsData?.sections.find((s) => s.id === sectionId);

  if (isLoading || sectionsLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!validId || !section) {
    return (
      <PageContainer>
        <EmptyState
          icon={FolderXIcon}
          title="Section not found"
          description="It may have been removed, or you don't have access to it."
          action={
            <Link to="/" className="text-sm font-medium text-primary hover:underline">
              Back to dashboard
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const items = [
    ...(data?.courses.map((course) => ({ kind: "course" as const, key: course.id, title: course.title, course })) ?? []),
    ...(data?.collections.map((collection) => ({ kind: "collection" as const, key: collection.id, title: collection.title, collection })) ??
      []),
  ].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">{section.title}</h1>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No courses in this section yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((item) =>
              item.kind === "course" ? (
                <CourseCard key={item.key} course={item.course} />
              ) : (
                <CollectionCard key={item.key} collection={item.collection} />
              ),
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
