import type { SearchNodeMatch, SearchNoteMatch } from "@lecturn/shared";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, StickyNote, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CoursePlaceholder } from "../CoursePlaceholder";
import { searchCourses } from "../../lib/api/courses";
import { formatDuration } from "../../lib/formatDuration";

const DEBOUNCE_MS = 250;

export function CourseSearch({ onNavigate }: { onNavigate?: () => void }) {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isFetching } = useQuery({
    queryKey: ["course-search", debounced],
    queryFn: () => searchCourses(debounced),
    enabled: debounced.length > 0,
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  function clear() {
    setInput("");
    setDebounced("");
  }

  const courseResults = data?.courses ?? [];
  const nodeResults = data?.nodes ?? [];
  const noteResults = data?.notes ?? [];
  const totalResults = courseResults.length + nodeResults.length + noteResults.length;
  const showDropdown = open && debounced.length > 0;

  function close() {
    setOpen(false);
    clear();
    onNavigate?.();
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Find a course…"
          className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-7 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
        />
        {input && (
          <button
            onClick={clear}
            title="Clear"
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
          {isFetching && totalResults === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>}
          {!isFetching && totalResults === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">Nothing matches "{debounced}".</p>
          )}

          {courseResults.length > 0 && (
            <div className="py-1">
              <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Courses</p>
              {courseResults.map((course) => (
                <Link
                  key={course.id}
                  to={`/courses/${course.id}`}
                  onClick={close}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted"
                >
                  <div className="h-10 w-16 shrink-0 overflow-hidden rounded">
                    {course.coverImagePath ? (
                      <img src={`/api/stream/cover/${course.id}`} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <CoursePlaceholder />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{course.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDuration(course.durationSeconds)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {nodeResults.length > 0 && (
            <div className="border-t border-border py-1">
              <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Videos &amp; files</p>
              {nodeResults.map((match: SearchNodeMatch) => (
                <Link
                  key={match.nodeId}
                  to={match.type === "video" ? `/courses/${match.courseId}/watch?node=${match.nodeId}` : `/courses/${match.courseId}`}
                  onClick={close}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted"
                >
                  <FileText size={16} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{match.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{match.courseTitle}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {noteResults.length > 0 && (
            <div className="border-t border-border py-1">
              <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">My notes</p>
              {noteResults.map((match: SearchNoteMatch) => (
                <Link
                  key={match.noteId}
                  to={`/courses/${match.courseId}/watch?node=${match.videoNodeId}`}
                  onClick={close}
                  className="flex items-start gap-3 px-3 py-2 hover:bg-muted"
                >
                  <StickyNote size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{match.body}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {match.videoTitle} · {match.courseTitle}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
