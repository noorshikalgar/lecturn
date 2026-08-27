import type { Section } from "@lecturn/shared";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { Link } from "react-router-dom";
import { CourseRow } from "../components/CourseRow";
import { EmptyState } from "../components/EmptyState";
import { PageContainer } from "../components/layout/PageContainer";
import { getRecentCourses, getSectionCourses, getSections, getUnassignedCourses } from "../lib/api/courses";
import { getPaths } from "../lib/api/paths";
import { getContinueWatching } from "../lib/api/progress";
import { formatDuration } from "../lib/formatDuration";
import { useAuth } from "../lib/AuthContext";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function SectionShelf({ section }: { section: Section }) {
  const { data } = useQuery({
    queryKey: ["section-courses", section.id],
    queryFn: () => getSectionCourses(section.id),
  });
  const courses = data?.courses.map((course) => ({ course })) ?? [];
  return <CourseRow title={section.title} titleHref={`/sections/${section.id}`} courses={courses} category={section.title} />;
}

export function DashboardPage() {
  const { user } = useAuth();
  const continueWatching = useQuery({ queryKey: ["continue-watching"], queryFn: getContinueWatching });
  const recent = useQuery({ queryKey: ["courses", "recent"], queryFn: getRecentCourses });
  const sections = useQuery({ queryKey: ["sections"], queryFn: getSections });
  const paths = useQuery({ queryKey: ["paths"], queryFn: getPaths });
  // Only ever returns results for an admin — canSeeCourse restricts
  // unassigned courses to admins, so this row is invisible to anyone else.
  const unassigned = useQuery({ queryKey: ["courses", "unassigned"], queryFn: getUnassignedCourses });

  const continueItems =
    continueWatching.data?.items.map((item) => ({
      course: item.course,
      subtitle: `${item.nodeTitle} · resume at ${formatDuration(item.progress.positionSeconds)}`,
      progress: item.course.durationSeconds > 0 ? item.progress.positionSeconds / item.course.durationSeconds : undefined,
    })) ?? [];

  const recentItems = recent.data?.courses.map((course) => ({ course })) ?? [];
  const unassignedItems = unassigned.data?.courses.map((course) => ({ course })) ?? [];

  return (
    <PageContainer>
      <div className="space-y-14">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-foreground">
            {greeting()}
            {user?.username ? `, ${user.username}` : ""}
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Pick up where you left off, or explore something new.</p>
        </div>

        <CourseRow title="Continue Watching" courses={continueItems} />
        <CourseRow
          title="Recently Added"
          courses={recentItems}
          emptyText="No courses yet — add a library and mark some course folders from Admin."
        />

        {sections.data?.sections.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="No sections yet" description="Create one from Admin → Sections to start organizing courses." />
        ) : (
          sections.data?.sections.map((section) => <SectionShelf key={section.id} section={section} />)
        )}

        <CourseRow title="All Courses" titleHref="/admin/sections" courses={unassignedItems} />

        {paths.data && paths.data.paths.length > 0 && (
          <section>
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Learning paths</h2>
              <Link to="/paths" className="text-[13.5px] text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {paths.data.paths.slice(0, 3).map((path) => (
                <Link key={path.id} to={`/paths/${path.id}`} className="rounded-[10px] border border-border bg-card p-[18px]">
                  <p className="text-[15px] font-semibold text-foreground">{path.title}</p>
                  {path.description && <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{path.description}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageContainer>
  );
}
