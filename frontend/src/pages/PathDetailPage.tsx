import type { Course } from "@lecturn/shared";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, ListXIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CourseCard } from "../components/CourseCard";
import { CoursePlaceholder } from "../components/CoursePlaceholder";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { PageContainer } from "../components/layout/PageContainer";
import { getCourses } from "../lib/api/courses";
import { addCourseToPath, getPath, removeCourseFromPath, reorderPathCourses, type PathCourseEntry } from "../lib/api/paths";
import { useAuth } from "../lib/AuthContext";

function SortablePathCourseRow({
  entry,
  isAdmin,
  onRemove,
}: {
  entry: PathCourseEntry;
  isAdmin: boolean;
  onRemove: (courseId: string) => void;
}) {
  const sortable = useSortable({ id: entry.course.id, disabled: !isAdmin });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

  return (
    <div ref={sortable.setNodeRef} style={style}>
      {isAdmin && (
        <div className="mb-1.5 flex items-center justify-between">
          <span
            className="flex cursor-grab touch-none items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical size={13} />
            Drag to reorder
          </span>
          <button
            onClick={() => onRemove(entry.course.id)}
            aria-label={`Remove ${entry.course.title} from this path`}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={13} />
            Remove
          </button>
        </div>
      )}
      <CourseCard course={entry.course} />
    </div>
  );
}

function PathCoursePicker({
  availableToAdd,
  onAdd,
  isPending,
}: {
  availableToAdd: Course[];
  onAdd: (courseId: string) => void;
  isPending: boolean;
}) {
  const [filter, setFilter] = useState("");

  if (availableToAdd.length === 0) {
    return <p className="text-sm text-muted-foreground">Every course is already in this path.</p>;
  }

  const filtered = filter.trim()
    ? availableToAdd.filter((c) => c.title.toLowerCase().includes(filter.trim().toLowerCase()))
    : availableToAdd;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-medium text-foreground">Add a course</p>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search courses…"
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
      />
      <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {filtered.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No courses match "{filter}".</p>}
        {filtered.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/60">
            <div className="h-9 w-16 shrink-0 overflow-hidden rounded">
              {c.coverImagePath ? (
                <img src={`/api/stream/cover/${c.id}`} alt="" className="h-full w-full object-cover" />
              ) : (
                <CoursePlaceholder />
              )}
            </div>
            <p className="min-w-0 flex-1 truncate text-sm text-foreground">{c.title}</p>
            <button
              onClick={() => onAdd(c.id)}
              disabled={isPending}
              className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-card disabled:opacity-50"
            >
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PathDetailPage() {
  const { id } = useParams<{ id: string }>();
  const pathId = id ?? "";
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const queryKey = ["path", pathId];
  const [pendingRemove, setPendingRemove] = useState<{ courseId: string; title: string } | null>(null);

  const validId = Boolean(pathId);
  const { data, isLoading, isError } = useQuery({ queryKey, queryFn: () => getPath(pathId), enabled: validId });
  const allCourses = useQuery({ queryKey: ["courses"], queryFn: getCourses, enabled: isAdmin });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const reorderMutation = useMutation({
    mutationFn: (orderedCourseIds: string[]) => reorderPathCourses(pathId, orderedCourseIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const addMutation = useMutation({
    mutationFn: (courseId: string) => addCourseToPath(pathId, courseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: (courseId: string) => removeCourseFromPath(pathId, courseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (!validId || isError) {
    return (
      <PageContainer>
        <EmptyState
          icon={ListXIcon}
          title="Path not found"
          description="It may have been removed, or you don't have access to it."
          action={
            <Link to="/paths" className="text-sm font-medium text-primary hover:underline">
              Back to paths
            </Link>
          }
        />
      </PageContainer>
    );
  }

  if (isLoading || !data) {
    return (
      <PageContainer>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageContainer>
    );
  }

  const courses = data.courses;
  const availableToAdd = allCourses.data?.courses.filter((c) => !courses.some((e) => e.course.id === c.id)) ?? [];

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = courses.findIndex((e) => e.course.id === active.id);
    const newIndex = courses.findIndex((e) => e.course.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderMutation.mutate(arrayMove(courses, oldIndex, newIndex).map((e) => e.course.id));
  }

  const grid = (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {courses.map((entry) => (
        <SortablePathCourseRow
          key={entry.course.id}
          entry={entry}
          isAdmin={isAdmin}
          onRemove={(id) => setPendingRemove({ courseId: id, title: entry.course.title })}
        />
      ))}
    </div>
  );

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{data.path.title}</h1>
          {data.path.description && <p className="mt-1 text-sm text-muted-foreground">{data.path.description}</p>}
        </div>

        {isAdmin && <PathCoursePicker availableToAdd={availableToAdd} onAdd={(id) => addMutation.mutate(id)} isPending={addMutation.isPending} />}

        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No courses in this path yet.</p>
        ) : isAdmin ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={courses.map((e) => e.course.id)} strategy={verticalListSortingStrategy}>
              {grid}
            </SortableContext>
          </DndContext>
        ) : (
          grid
        )}
      </div>

      {pendingRemove && (
        <ConfirmDialog
          title="Remove from path"
          message={`Remove "${pendingRemove.title}" from this path? The course itself won't be deleted.`}
          confirmLabel="Remove"
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            removeMutation.mutate(pendingRemove.courseId);
            setPendingRemove(null);
          }}
        />
      )}
    </PageContainer>
  );
}
