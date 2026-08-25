import { GraduationCap } from "lucide-react";

const GRADIENTS = [
  "from-indigo-900 to-slate-950",
  "from-emerald-900 to-slate-950",
  "from-amber-900 to-slate-950",
  "from-rose-900 to-slate-950",
  "from-sky-900 to-slate-950",
  "from-violet-900 to-slate-950",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/** Deterministic per-course gradient + monogram, so a grid of un-covered
 * courses still reads as distinct cards instead of identical grey boxes. */
export function CoursePlaceholder({ title }: { title: string }) {
  const gradient = GRADIENTS[hashString(title) % GRADIENTS.length];
  const initial = title.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br ${gradient}`}>
      <span className="select-none text-6xl font-bold text-white/10">{initial}</span>
      <GraduationCap className="absolute text-white/50" size={26} />
    </div>
  );
}
