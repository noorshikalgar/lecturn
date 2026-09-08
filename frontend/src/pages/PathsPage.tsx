import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, GripVertical, ListTree } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { PageContainer } from "../components/layout/PageContainer";
import { PathIconPicker } from "../components/paths/PathIconPicker";
import { PATH_ICONS } from "../components/paths/PathIcons";
import { createPath, getPath, getPaths, reorderPaths } from "../lib/api/paths";
import { useAuth } from "../lib/AuthContext";

function PathCard({ pathId, dragHandle }: { pathId: string; dragHandle?: ReactNode }) {
  const { data } = useQuery({ queryKey: ["path", pathId], queryFn: () => getPath(pathId) });

  if (!data) {
    return <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />;
  }

  const total = data.courses.length;
  const completed = data.courses.filter((e) => e.course.completedByUser).length;
  const statusText =
    total === 0 ? "No courses yet" : completed === 0 ? "Not started" : completed === total ? "Completed" : `${completed} of ${total} complete`;

  const Icon = PATH_ICONS[data.path.icon ?? 1];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40 hover:shadow-sm">
      <div className="pointer-events-none absolute -top-3 -right-4 h-[104px] w-[176px] text-primary/[0.16]">
        <Icon className="h-full w-full" preserveAspectRatio="xMidYMin meet" />
      </div>
      {dragHandle && <div className="absolute left-3 top-3 z-10">{dragHandle}</div>}
      <Link to={`/paths/${pathId}`} className={`relative block p-4 ${dragHandle ? "pl-11" : ""}`}>
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-primary">
          {total} course{total === 1 ? "" : "s"}
        </p>
        <h2 className="mt-1.5 line-clamp-2 min-h-[2.6rem] text-base font-semibold leading-tight tracking-tight text-foreground">
          {data.path.title}
        </h2>
        {data.path.description && (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{data.path.description}</p>
        )}

        <div className="mt-3 h-[5px] w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: total > 0 ? `${(completed / total) * 100}%` : "0%" }}
          />
        </div>

        <p className={`mt-2 flex items-center gap-1 text-[13px] font-medium ${completed > 0 ? "text-primary" : "text-muted-foreground"}`}>
          {statusText}
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </p>
      </Link>
    </div>
  );
}

function SortablePathCard({ pathId }: { pathId: string }) {
  const sortable = useSortable({ id: pathId });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  const dragHandle = (
    <button
      type="button"
      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      title="Drag to reorder"
      aria-label="Drag to reorder"
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <GripVertical size={16} />
    </button>
  );
  return (
    <div ref={sortable.setNodeRef} style={style}>
      <PathCard pathId={pathId} dragHandle={dragHandle} />
    </div>
  );
}

export function PathsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["paths"], queryFn: getPaths });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const isAdmin = user?.role === "admin";

  const createMutation = useMutation({
    mutationFn: () => createPath(title.trim(), description.trim() || null, icon),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setIcon(1);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["paths"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderPaths,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["paths"] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim()) createMutation.mutate();
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !data) return;
    const oldIndex = data.paths.findIndex((p) => p.id === active.id);
    const newIndex = data.paths.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderMutation.mutate(arrayMove(data.paths, oldIndex, newIndex).map((p) => p.id));
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-4xl space-y-6">
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
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Icon</p>
              <PathIconPicker value={icon} onChange={setIcon} />
            </div>
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
        ) : isAdmin ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={data?.paths.map((p) => p.id) ?? []} strategy={rectSortingStrategy}>
              <div className="grid gap-4 sm:grid-cols-2">
                {data?.paths.map((path) => <SortablePathCard key={path.id} pathId={path.id} />)}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data?.paths.map((path) => <PathCard key={path.id} pathId={path.id} />)}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
