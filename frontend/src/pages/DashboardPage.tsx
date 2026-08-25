import type { Section } from "@lecturn/shared";
import { useQuery } from "@tanstack/react-query";
import { CourseRow } from "../components/CourseRow";
import { PageContainer } from "../components/layout/PageContainer";
import { getRecentCourses, getSectionCourses, getSections, getUnassignedCourses } from "../lib/api/courses";
import { getContinueWatching } from "../lib/api/progress";
import { formatDuration } from "../lib/formatDuration";

function SectionShelf({ section }: { section: Section }) {
  const { data } = useQuery({
    queryKey: ["section-courses", section.id],
    queryFn: () => getSectionCourses(section.id),
  });
  const courses = data?.courses.map((course) => ({ course })) ?? [];
  return <CourseRow title={section.title} titleHref={`/sections/${section.id}`} courses={courses} />;
}

export function DashboardPage() {
  const continueWatching = useQuery({ queryKey: ["continue-watching"], queryFn: getContinueWatching });
  const recent = useQuery({ queryKey: ["courses", "recent"], queryFn: getRecentCourses });
  const sections = useQuery({ queryKey: ["sections"], queryFn: getSections });
  // Only ever returns results for an admin — canSeeCourse restricts
  // unassigned courses to admins, so this row is invisible to anyone else.
  const unassigned = useQuery({ queryKey: ["courses", "unassigned"], queryFn: getUnassignedCourses });

  const continueItems =
    continueWatching.data?.items.map((item) => ({
      course: item.course,
      subtitle: `${item.nodeTitle} · resume at ${formatDuration(item.progress.positionSeconds)}`,
    })) ?? [];

  const recentItems = recent.data?.courses.map((course) => ({ course })) ?? [];
  const unassignedItems = unassigned.data?.courses.map((course) => ({ course })) ?? [];

  return (
    <PageContainer>
      <div className="space-y-8">
        <CourseRow title="Continue Watching" courses={continueItems} />
        <CourseRow
          title="Recently Added"
          courses={recentItems}
          emptyText="No courses yet — add a library and mark some course folders from Admin."
        />

        {sections.data?.sections.length === 0 ? (
          <p className="text-sm text-slate-500">No sections yet — create one from Admin → Sections.</p>
        ) : (
          sections.data?.sections.map((section) => <SectionShelf key={section.id} section={section} />)
        )}

        <CourseRow title="All Courses" titleHref="/admin/sections" courses={unassignedItems} />
      </div>
    </PageContainer>
  );
}
