import type { ActivityEvent, ActivityType } from "@lecturn/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getActivity } from "../../lib/api/activity";

const TYPE_LABELS: Record<ActivityType, string> = {
  library_added: "Library added",
  library_removed: "Library removed",
  scan_started: "Scan started",
  scan_completed: "Scan completed",
  scan_failed: "Scan failed",
  course_marked: "Course marked",
  course_unmarked: "Course unmarked",
  course_orphaned: "Course orphaned",
  user_created: "User created",
  user_deleted: "User deleted",
  user_role_changed: "Role changed",
  user_password_reset: "Password reset",
  user_profile_edited: "Profile edited",
  user_username_changed: "Username changed",
  section_created: "Section created",
  section_deleted: "Section deleted",
  section_hidden_changed: "Section visibility",
  course_hidden_changed: "Course visibility",
  course_section_assigned: "Course assigned",
  section_access_changed: "Section access",
  certificate_issued: "Certificate issued",
  certificate_uploaded: "Certificate uploaded",
};

const CATEGORY_FOR_TYPE: Record<ActivityType, "library" | "user" | "content" | "certificate"> = {
  library_added: "library",
  library_removed: "library",
  scan_started: "library",
  scan_completed: "library",
  scan_failed: "library",
  course_marked: "library",
  course_unmarked: "library",
  course_orphaned: "library",
  user_created: "user",
  user_deleted: "user",
  user_role_changed: "user",
  user_password_reset: "user",
  user_profile_edited: "user",
  user_username_changed: "user",
  section_created: "content",
  section_deleted: "content",
  section_hidden_changed: "content",
  course_hidden_changed: "content",
  course_section_assigned: "content",
  section_access_changed: "content",
  certificate_issued: "certificate",
  certificate_uploaded: "certificate",
};

const CATEGORY_STYLES: Record<string, string> = {
  library: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  user: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  content: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  certificate: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function EventRow({ event }: { event: ActivityEvent }) {
  const category = CATEGORY_FOR_TYPE[event.type];
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-card/60 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${CATEGORY_STYLES[category]}`}>
            {TYPE_LABELS[event.type]}
          </span>
        </div>
        <p className="mt-1 text-sm text-foreground">{event.message}</p>
      </div>
      <time className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
        {new Date(event.createdAt).toLocaleString()}
      </time>
    </div>
  );
}

export function ActivityPage() {
  const [typeFilter, setTypeFilter] = useState<ActivityType | "">("");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["admin", "activity", typeFilter],
    queryFn: ({ pageParam }: { pageParam?: string }) => getActivity({ cursor: pageParam, type: typeFilter || undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const events = data?.pages.flatMap((p) => p.events) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">What's happened across libraries, users, and content.</p>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ActivityType | "")}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none"
        >
          <option value="">All events</option>
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && events.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}

      <div className="space-y-2">
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full rounded-md border border-border py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
