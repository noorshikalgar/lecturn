import { Award } from "lucide-react";

interface GeneratedCertificateProps {
  courseTitle: string;
  learnerName: string;
  completedAt: string | null;
}

export function GeneratedCertificate({ courseTitle, learnerName, completedAt }: GeneratedCertificateProps) {
  const date = completedAt
    ? new Date(completedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-amber-700/60 bg-gradient-to-b from-slate-900 to-slate-950 p-10 text-center shadow-lg">
      <div className="pointer-events-none absolute inset-3 rounded-lg border border-amber-800/40" />
      <Award className="mx-auto mb-4 text-amber-400" size={36} />
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">Certificate of Completion</p>
      <p className="mt-6 text-sm text-muted-foreground">This certifies that</p>
      <p className="mt-2 font-serif text-2xl font-semibold text-foreground">{learnerName}</p>
      <p className="mt-4 text-sm text-muted-foreground">has successfully completed</p>
      <p className="mt-2 font-serif text-xl font-semibold text-amber-300">{courseTitle}</p>
      {date && <p className="mt-6 text-xs text-muted-foreground">{date}</p>}
    </div>
  );
}
