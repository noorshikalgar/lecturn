import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListTree, Settings2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { PageContainer } from "../components/layout/PageContainer";
import { createPath, getPath, getPaths } from "../lib/api/paths";
import { useAuth } from "../lib/AuthContext";

function PathCard({ pathId, isAdmin }: { pathId: number; isAdmin: boolean }) {
  const { data } = useQuery({ queryKey: ["path", pathId], queryFn: () => getPath(pathId) });

  if (!data) {
    return <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{data.path.title}</h2>
          {data.path.description && <p className="mt-1 text-sm text-muted-foreground">{data.path.description}</p>}
        </div>
        {isAdmin && (
          <Link
            to={`/paths/${pathId}`}
            title="Manage courses in this path"
            aria-label={`Manage ${data.path.title}`}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <Settings2 size={13} />
            Manage
          </Link>
        )}
      </div>

      {data.courses.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No courses in this path yet.
          {isAdmin && (
            <>
              {" "}
              <Link to={`/paths/${pathId}`} className="font-medium text-primary hover:underline">
                Add some
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <div className="mt-4 divide-y divide-border rounded-lg border border-border">
          {data.courses.map((entry, i) => (
            <Link
              key={entry.course.id}
              to={`/courses/${entry.course.id}`}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{entry.course.title}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {entry.course.videoCount ?? 0} lesson{entry.course.videoCount === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function PathsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["paths"], queryFn: getPaths });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showForm, setShowForm] = useState(false);
  const isAdmin = user?.role === "admin";

  const createMutation = useMutation({
    mutationFn: () => createPath(title.trim(), description.trim() || null),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["paths"] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim()) createMutation.mutate();
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Paths</h1>
            <p className="text-sm text-muted-foreground">Curated, ordered curricula spanning any section.</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm((s) => !s)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {showForm ? "Cancel" : "New Path"}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-border bg-card p-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Path title"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
            <button
              type="submit"
              disabled={!title.trim() || createMutation.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
          </form>
        )}

        {data?.paths.length === 0 ? (
          <EmptyState
            icon={ListTree}
            title="No paths yet"
            description={
              isAdmin
                ? "Group courses from any section into an ordered curriculum learners can follow start to finish."
                : "Ask an admin to create one — paths group courses from any section into an ordered curriculum."
            }
          />
        ) : (
          <div className="space-y-4">
            {data?.paths.map((path) => <PathCard key={path.id} pathId={path.id} isAdmin={isAdmin} />)}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
