import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CoursePlaceholder } from "../CoursePlaceholder";
import { searchCourses } from "../../lib/api/courses";
import { formatDuration } from "../../lib/formatDuration";

const DEBOUNCE_MS = 250;

export function CourseSearch() {
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

  const results = data?.courses ?? [];
  const showDropdown = open && debounced.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Find a course…"
          className="w-full rounded-md border border-slate-800 bg-slate-900 py-1.5 pl-8 pr-7 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-slate-600"
        />
        {input && (
          <button
            onClick={clear}
            title="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
          {isFetching && results.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">Searching…</p>}
          {!isFetching && results.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">No courses match "{debounced}".</p>}
          {results.map((course) => (
            <Link
              key={course.id}
              to={`/courses/${course.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800"
            >
              <div className="h-10 w-16 shrink-0 overflow-hidden rounded">
                {course.coverImagePath ? (
                  <img src={`/api/stream/cover/${course.id}`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <CoursePlaceholder title={course.title} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">{course.title}</p>
                <p className="text-xs text-slate-500">{formatDuration(course.durationSeconds)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
