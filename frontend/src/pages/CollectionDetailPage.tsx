import { useQuery } from "@tanstack/react-query";
import { FolderXIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { CourseCard } from "../components/CourseCard";
import { EmptyState } from "../components/EmptyState";
import { PageContainer } from "../components/layout/PageContainer";
import { getCollection } from "../lib/api/courses";

// Deliberately simple — a collection is a pure grouping label (see
// courses.collectionId's schema comment), not a scanned entity of its own.
// Clicking in just shows the child courses as plain cards; each one is a
// completely normal course underneath (its own progress, notes, certificate,
// watch page) reached the same way any other course card is.
export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const collectionId = id ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["collection", collectionId],
    queryFn: () => getCollection(collectionId),
    enabled: Boolean(collectionId),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!data) {
    return (
      <PageContainer>
        <EmptyState
          icon={FolderXIcon}
          title="Collection not found"
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

  const courses = data.collection.courses ?? [];

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-primary">Collection</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{data.collection.title}</h1>
        </div>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No courses in this collection yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
