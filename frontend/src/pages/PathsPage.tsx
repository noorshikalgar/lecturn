import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { createPath, getPaths } from "../lib/api/paths";
import { useAuth } from "../lib/AuthContext";

export function PathsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["paths"], queryFn: getPaths });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showForm, setShowForm] = useState(false);

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">Paths</h1>
            <p className="text-sm text-slate-400">Curated, ordered curricula spanning any section.</p>
          </div>
          {user?.role === "admin" && (
            <button
              onClick={() => setShowForm((s) => !s)}
              className="rounded-md bg-accent-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-accent-400"
            >
              {showForm ? "Cancel" : "New Path"}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Path title"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
            />
            <button
              type="submit"
              disabled={!title.trim() || createMutation.isPending}
              className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-accent-400 disabled:opacity-50"
            >
              Create
            </button>
          </form>
        )}

        {data?.paths.length === 0 ? (
          <p className="text-sm text-slate-500">No paths yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {data?.paths.map((path) => (
              <Link
                key={path.id}
                to={`/paths/${path.id}`}
                className="rounded-lg border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-600"
              >
                <p className="text-sm font-medium text-slate-100">{path.title}</p>
                {path.description && <p className="mt-1 text-xs text-slate-500">{path.description}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
