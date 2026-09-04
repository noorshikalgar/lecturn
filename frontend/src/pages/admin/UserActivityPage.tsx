import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getUserActivity, getUsers } from "../../lib/api/admin";
import { formatDuration } from "../../lib/formatDuration";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function sessionDuration(createdAt: string, endedAt: string | null, lastSeenAt: string | null): string {
  const start = new Date(createdAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : new Date(lastSeenAt ?? createdAt).getTime();
  const ms = Math.max(0, end - start);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function UserActivityPage() {
  const { id } = useParams<{ id: string }>();
  const { data: usersData } = useQuery({ queryKey: ["admin", "users"], queryFn: getUsers });
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user-activity", id],
    queryFn: () => getUserActivity(id!),
    enabled: Boolean(id),
  });

  const user = usersData?.users.find((u) => u.id === id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} />
          Users
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {user ? (user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.username) : "Activity"}
        </h1>
        {user?.firstName && <p className="mt-1 text-sm text-muted-foreground">{user.username}</p>}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Completed" value={data.coursesCompleted} />
            <StatCard label="In progress" value={data.coursesInProgress} />
            <StatCard label="Watch time" value={formatDuration(data.totalWatchSeconds)} />
            <StatCard label="Day streak" value={data.currentStreak} />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Currently watching</p>
            {data.currentlyWatching ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {data.currentlyWatching.courseTitle} · {data.currentlyWatching.videoTitle}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Nothing in progress.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Login history</p>
            {data.sessions.length === 0 && <p className="text-sm text-muted-foreground">No sessions recorded.</p>}
            {data.sessions.map((s) => (
              <div key={s.token} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/60 p-3">
                <div>
                  <p className="text-sm text-foreground">{new Date(s.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{s.endedAt ? "Ended" : "Still active"}</p>
                </div>
                <p className="text-sm text-muted-foreground">{sessionDuration(s.createdAt, s.endedAt, s.lastSeenAt)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
