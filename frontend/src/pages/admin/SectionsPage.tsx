import type { Course, User } from "@lecturn/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { CoursePlaceholder } from "../../components/CoursePlaceholder";
import {
  assignCourseSection,
  createSection,
  deleteSection,
  getSectionAccess,
  getUsers,
  setSectionAccess,
  setSectionHidden,
} from "../../lib/api/admin";
import { getCourses, getSections } from "../../lib/api/courses";

function PickerRow({ course, selected, onToggle }: { course: Course; selected: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800/60">
      <div className="h-9 w-16 shrink-0 overflow-hidden rounded">
        {course.coverImagePath ? (
          <img src={`/api/stream/cover/${course.id}`} alt="" className="h-full w-full object-cover" />
        ) : (
          <CoursePlaceholder title={course.title} />
        )}
      </div>
      <p className="min-w-0 flex-1 truncate text-sm text-slate-200">{course.title}</p>
      <button
        onClick={onToggle}
        className={`shrink-0 rounded-md border px-2.5 py-1 text-xs ${
          selected
            ? "border-slate-700 text-slate-400 hover:bg-slate-900 hover:text-red-400"
            : "border-slate-700 text-slate-300 hover:bg-slate-900"
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

  const assignMutation = useMutation({
    mutationFn: ({ courseId, next }: { courseId: number; next: number | null }) => assignCourseSection(courseId, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "all-courses"] });
      queryClient.invalidateQueries({ queryKey: ["section-courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });

  const courses = coursesData?.courses ?? [];
  if (courses.length === 0) {
    return <p className="mt-2 text-xs text-slate-500">No courses scanned yet — mark some in a library's Explorer first.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-slate-500">Add or remove a course from this section.</p>
      <div className="max-h-72 divide-y divide-slate-800 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40">
        {courses.map((course) => {
          const selected = course.sectionId === sectionId;
          return (
            <PickerRow
              key={course.id}
              course={course}
              selected={selected}
              onToggle={() => assignMutation.mutate({ courseId: course.id, next: selected ? null : sectionId })}
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

  useEffect(() => {
    if (data) setSelected(new Set(data.userIds));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (userIds: number[]) => setSectionAccess(sectionId, userIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "section-access", sectionId] }),
  });

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs text-slate-400">
        {selected.size === 0
          ? "Public — visible to every signed-in user."
          : `Restricted to ${selected.size} user(s) below — including admins, who are only exempt from sections marked "Hidden".`}
      </p>
      <div className="flex flex-wrap gap-2">
        {users.map((u) => (
          <label key={u.id} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">
            <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
            {u.username}
            {u.role === "admin" && <span className="text-slate-500">(admin)</span>}
          </label>
        ))}
      </div>
      <button
        onClick={() => saveMutation.mutate([...selected])}
        disabled={saveMutation.isPending}
        className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-white disabled:opacity-50"
      >
        Save access
      </button>
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
    },
  });

  const hideMutation = useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) => setSectionHidden(id, hidden),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sections"] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newTitle.trim()) createMutation.mutate();
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
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Sections</h1>
        <p className="mt-1 text-sm text-slate-400">
          Sections live only here — never derived from your folder structure. Create one, then pick which courses belong in it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="e.g. Backend Development"
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
        />
        <button
          type="submit"
          disabled={!newTitle.trim() || createMutation.isPending}
          className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50"
        >
          Create
        </button>
      </form>

      <div className="space-y-3">
        {sectionsData?.sections.map((s) => (
          <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-100">{s.title}</p>
                {s.hidden && (
                  <span className="rounded border border-amber-800 bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
                    Hidden
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openPanel(s.id, "courses")}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {openId === s.id && openTab === "courses" ? "Close" : "Courses…"}
                </button>
                <button
                  onClick={() => openPanel(s.id, "access")}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {openId === s.id && openTab === "access" ? "Close" : "Access…"}
                </button>
                <button
                  onClick={() => hideMutation.mutate({ id: s.id, hidden: !s.hidden })}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {s.hidden ? "Unhide" : "Hide"}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(s.id)}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
            {s.hidden && (
              <p className="mt-1 text-xs text-slate-500">Hidden from everyone except admins, regardless of the access list.</p>
            )}
            {openId === s.id && openTab === "courses" && <CoursePicker sectionId={s.id} />}
            {openId === s.id && openTab === "access" && <SectionAccessEditor sectionId={s.id} users={usersData?.users ?? []} />}
          </div>
        ))}
        {sectionsData?.sections.length === 0 && (
          <p className="text-sm text-slate-500">No sections yet — courses will show under "All Courses" on the homepage until you create one.</p>
        )}
      </div>
    </div>
  );
}
