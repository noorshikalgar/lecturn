import type { Course, Section, User } from "@lecturn/shared";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { CoursePlaceholder } from "../../components/CoursePlaceholder";
import {
  assignCourseSection,
  createSection,
  deleteSection,
  getSectionAccess,
  getUsers,
  reorderSections,
  setSectionAccess,
  setSectionHidden,
} from "../../lib/api/admin";
import { getCourses, getSections } from "../../lib/api/courses";
import { Switch } from "../../components/ui/switch";

function PickerRow({
  course,
  selected,
  onToggle,
  checked,
  onCheck,
}: {
  course: Course;
  selected: boolean;
  onToggle: () => void;
  checked: boolean;
  onCheck: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted/60">
      <input type="checkbox" checked={checked} onChange={onCheck} className="shrink-0" />
      <div className="h-9 w-16 shrink-0 overflow-hidden rounded">
        {course.coverImagePath ? (
          <img src={`/api/stream/cover/${course.id}`} alt="" className="h-full w-full object-cover" />
        ) : (
          <CoursePlaceholder />
        )}
      </div>
      <p className="min-w-0 flex-1 truncate text-sm text-foreground">{course.title}</p>
      <button
        onClick={onToggle}
        className={`shrink-0 rounded-md border px-2.5 py-1 text-xs ${
          selected
            ? "border-border text-muted-foreground hover:bg-card hover:text-red-600"
            : "border-border text-muted-foreground hover:bg-card"
        }`}
      >
        {selected ? "Remove" : "Add"}
      </button>
    </div>
  );
}

function CoursePicker({ sectionId }: { sectionId: number }) {
  const queryClient = useQueryClient();
  const { data: coursesData } = useQuery({ queryKey: ["admin", "all-courses"], queryFn: getCourses });
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const assignMutation = useMutation({
    mutationFn: ({ courseId, next }: { courseId: number; next: number | null }) => assignCourseSection(courseId, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "all-courses"] });
      queryClient.invalidateQueries({ queryKey: ["section-courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkAssign() {
    setBulkError(null);
    setBulkBusy(true);
    try {
      const ids = [...selected].filter((id) => coursesData?.courses.find((c) => c.id === id)?.sectionId !== sectionId);
      await Promise.all(ids.map((courseId) => assignMutation.mutateAsync({ courseId, next: sectionId })));
      setSelected(new Set());
    } catch {
      setBulkError("Some courses failed to assign — check above and retry.");
    } finally {
      setBulkBusy(false);
    }
  }

  const courses = coursesData?.courses ?? [];
  if (courses.length === 0) {
    return (
      <div className="mt-3 space-y-1">
        <p className="text-sm font-medium text-foreground">Manage courses</p>
        <p className="text-xs text-muted-foreground">No courses scanned yet — mark some in a library's Explorer first.</p>
      </div>
    );
  }

  const filtered = filter.trim()
    ? courses.filter((c) => c.title.toLowerCase().includes(filter.trim().toLowerCase()))
    : courses;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-medium text-foreground">Manage courses</p>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter courses…"
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-border"
      />
      {filtered.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background/60 px-2.5 py-1.5">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))}
              onChange={() =>
                setSelected(
                  filtered.every((c) => selected.has(c.id)) ? new Set() : new Set(filtered.map((c) => c.id)),
                )
              }
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <button
              onClick={bulkAssign}
              disabled={bulkBusy}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              Assign {selected.size} to this section
            </button>
          )}
        </div>
      )}
      {bulkError && <p className="text-xs text-destructive">{bulkError}</p>}

      <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card/40">
        {filtered.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No courses match "{filter}".</p>}
        {filtered.map((course) => {
          const isInSection = course.sectionId === sectionId;
          return (
            <PickerRow
              key={course.id}
              course={course}
              selected={isInSection}
              onToggle={() => assignMutation.mutate({ courseId: course.id, next: isInSection ? null : sectionId })}
              checked={selected.has(course.id)}
              onCheck={() => toggleSelected(course.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function SectionAccessEditor({ sectionId, users }: { sectionId: number; users: User[] }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "section-access", sectionId], queryFn: () => getSectionAccess(sectionId) });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Public (zero access rows) is the default for a brand-new section, and
  // covers every user automatically — including ones created later, since
  // "public" isn't a snapshot of who existed at save time.
  const [isPublic, setIsPublic] = useState(true);
  const [filter, setFilter] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    // Only seed state from the server once per mount — this editor remounts
    // fresh each time it's opened (see openId in the parent), so a
    // background refetch/invalidation while it's open (e.g. an unrelated
    // user-delete elsewhere) no longer silently wipes out unsaved edits.
    if (data && !initialized.current) {
      setSelected(new Set(data.userIds));
      setIsPublic(data.userIds.length === 0);
      initialized.current = true;
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (userIds: number[]) => setSectionAccess(sectionId, userIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "section-access", sectionId] }),
  });

  function toggleUser(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Admins always see every section regardless of this list (see
  // sectionVisibility.ts) — listing them here as a togglable entry would be
  // pointless (and confusing: an admin who restricts a section to a handful
  // of users shouldn't have to remember to also grant themselves access to
  // something they can already manage from this very page).
  const regularUsers = users.filter((u) => u.role !== "admin");
  // Filtering only changes which rows render — `selected` itself is never
  // derived from this list, so a user switched on while filtered stays
  // selected (and still gets saved) even after the filter hides their row.
  const filteredUsers = filter.trim()
    ? regularUsers.filter((u) => u.username.toLowerCase().includes(filter.trim().toLowerCase()))
    : regularUsers;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-background/60 p-3">
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Public to all users</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isPublic
              ? "Every signed-in user can see this section, including anyone created later."
              : "Only the users switched on below can see this section."}
          </p>
        </div>
        <Switch checked={isPublic} onCheckedChange={setIsPublic} />
      </label>

      {!isPublic && (
        <div className="space-y-2">
          {regularUsers.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">No non-admin users yet.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                {/* Only worth showing once there's enough of a list to search
                    through — a handful of users doesn't need a search box. */}
                {regularUsers.length > 6 && (
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search users…"
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
                  />
                )}
                <p className="shrink-0 text-xs text-muted-foreground">
                  {selected.size} of {regularUsers.length} selected
                </p>
              </div>
              {/* Capped and internally scrollable — without this, a library
                  with dozens of users would push "Save access" (and every
                  other section below this one) far down the page. */}
              <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {filteredUsers.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No users match "{filter}".</p>
                )}
                {filteredUsers.map((u) => (
                  <label key={u.id} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-muted/60">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                        {u.username.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="truncate text-sm text-foreground">{u.username}</span>
                    </div>
                    <Switch size="sm" checked={selected.has(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => saveMutation.mutate(isPublic ? [] : [...selected])}
        disabled={saveMutation.isPending}
        className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Save access
      </button>
    </div>
  );
}

function SortableSectionRow({
  section,
  openId,
  openTab,
  usersData,
  onOpenPanel,
  onToggleHidden,
  onDelete,
}: {
  section: Section;
  openId: number | null;
  openTab: "courses" | "access";
  usersData: User[];
  onOpenPanel: (id: number, tab: "courses" | "access") => void;
  onToggleHidden: (id: number, hidden: boolean) => void;
  onDelete: (id: number, title: string) => void;
}) {
  const sortable = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

  return (
    <div ref={sortable.setNodeRef} style={style} className="rounded-lg border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
            title="Drag to reorder"
            aria-label={`Drag to reorder ${section.title}`}
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical size={15} />
          </button>
          <p className="text-sm font-medium text-foreground">{section.title}</p>
          {section.hidden && (
            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
              Hidden
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onOpenPanel(section.id, "courses")}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            {openId === section.id && openTab === "courses" ? "Close" : "Manage courses"}
          </button>
          <button
            onClick={() => onOpenPanel(section.id, "access")}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            {openId === section.id && openTab === "access" ? "Close" : "Manage access"}
          </button>
          <button
            onClick={() => onToggleHidden(section.id, !section.hidden)}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            {section.hidden ? "Unhide" : "Hide"}
          </button>
          <button
            onClick={() => onDelete(section.id, section.title)}
            title="Delete section"
            aria-label={`Delete ${section.title}`}
            className="rounded-md border border-border p-1.5 text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {section.hidden && (
        <p className="mt-1 text-xs text-muted-foreground">Hidden from everyone except admins, regardless of the access list.</p>
      )}
      {openId === section.id && openTab === "courses" && <CoursePicker sectionId={section.id} />}
      {openId === section.id && openTab === "access" && <SectionAccessEditor sectionId={section.id} users={usersData} />}
    </div>
  );
}

export function SectionsPage() {
  const queryClient = useQueryClient();
  const { data: sectionsData } = useQuery({ queryKey: ["sections"], queryFn: getSections });
  const { data: usersData } = useQuery({ queryKey: ["admin", "users"], queryFn: getUsers });
  const [newTitle, setNewTitle] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [openTab, setOpenTab] = useState<"courses" | "access">("courses");
  const [pendingDelete, setPendingDelete] = useState<{ id: number; title: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createSection(newTitle.trim()),
    onSuccess: () => {
      setNewTitle("");
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "all-courses"] });
      queryClient.invalidateQueries({ queryKey: ["section-courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses", "unassigned"] });
    },
  });

  const hideMutation = useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) => setSectionHidden(id, hidden),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sections"] }),
  });

  const reorderMutation = useMutation({
    mutationFn: reorderSections,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sections"] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newTitle.trim()) createMutation.mutate();
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !sectionsData) return;
    const sections = sectionsData.sections;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderMutation.mutate(arrayMove(sections, oldIndex, newIndex).map((s) => s.id));
  }

  function openPanel(id: number, tab: "courses" | "access") {
    if (openId === id && openTab === tab) {
      setOpenId(null);
    } else {
      setOpenId(id);
      setOpenTab(tab);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sections live only here — never derived from your folder structure. Create one, then pick which courses belong in it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="e.g. Backend Development"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        />
        <button
          type="submit"
          disabled={!newTitle.trim() || createMutation.isPending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Create
        </button>
      </form>

      {sectionsData && sectionsData.sections.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sectionsData.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sectionsData.sections.map((s) => (
                <SortableSectionRow
                  key={s.id}
                  section={s}
                  openId={openId}
                  openTab={openTab}
                  usersData={usersData?.users ?? []}
                  onOpenPanel={openPanel}
                  onToggleHidden={(id, hidden) => hideMutation.mutate({ id, hidden })}
                  onDelete={(id, title) => setPendingDelete({ id, title })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-sm text-muted-foreground">No sections yet — courses will show under "All Courses" on the homepage until you create one.</p>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete section"
          message={`Delete "${pendingDelete.title}"? Its courses go back to "All Courses" — this can't be undone.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteMutation.mutate(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
