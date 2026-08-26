import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, X } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { CourseCard } from "../components/CourseCard";
import { PageContainer } from "../components/layout/PageContainer";
import { getCourses } from "../lib/api/courses";
import { addCourseToPath, getPath, removeCourseFromPath, reorderPathCourses, type PathCourseEntry } from "../lib/api/paths";
import { useAuth } from "../lib/AuthContext";

function SortableCourseCard({
  entry,
  isAdmin,
  onRemove,
}: {
  entry: PathCourseEntry;
  isAdmin: boolean;
  onRemove: (courseId: number) => void;
}) {
  const sortable = useSortable({ id: entry.course.id, disabled: !isAdmin });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

  return (
    <div ref={sortable.setNodeRef} style={style} className="relative">
      {isAdmin && (
        <>
          <button
            className="absolute -left-2 -top-2 z-10 cursor-grab touch-none rounded-full bg-muted p-1 text-muted-foreground hover:text-foreground"
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical size={12} />
          </button>
          <button
            onClick={() => onRemove(entry.course.id)}
            className="absolute -right-2 -top-2 z-10 rounded-full bg-muted p-1 text-muted-foreground hover:text-red-400"
          >
            <X size={12} />
          </button>
        </>
      )}
      <CourseCard course={entry.course} />
    </div>
  );
}

export function PathDetailPage() {
  const { id } = useParams<{ id: string }>();
  const pathId = Number(id);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const queryKey = ["path", pathId];
  const [addCourseId, setAddCourseId] = useState("");

  const { data } = useQuery({ queryKey, queryFn: () => getPath(pathId), enabled: Number.isFinite(pathId) });
  const allCourses = useQuery({ queryKey: ["courses"], queryFn: getCourses, enabled: isAdmin });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const reorderMutation = useMutation({
    mutationFn: (orderedCourseIds: number[]) => reorderPathCourses(pathId, orderedCourseIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const addMutation = useMutation({
    mutationFn: (courseId: number) => addCourseToPath(pathId, courseId),
    onSuccess: () => {
      setAddCourseId("");
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (courseId: number) => removeCourseFromPath(pathId, courseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (!data) {
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
        <SortableCourseCard key={entry.course.id} entry={entry} isAdmin={isAdmin} onRemove={(id) => removeMutation.mutate(id)} />
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

        {isAdmin && (
          <div className="flex items-center gap-2">
            <select
              value={addCourseId}
              onChange={(e) => setAddCourseId(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none"
            >
              <option value="">Add a course…</option>
              {availableToAdd.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <button
              onClick={() => addCourseId && addMutation.mutate(Number(addCourseId))}
              disabled={!addCourseId}
              className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}

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
    </PageContainer>
  );
}
