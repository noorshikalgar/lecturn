import type { Course } from "@lecturn/shared";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { Confetti } from "./Confetti";
import { GeneratedCertificate } from "./GeneratedCertificate";

/** The dedicated "Certificate" page for a completed course — reached via its
 * own entry in the sidebar, the same way a lesson is. Purely a moment of
 * satisfaction: no upload, no file — the certificate is generated on the
 * spot once the learner asks to see it.
 *
 * completedAt is passed in explicitly rather than read from course.completedAt
 * — that field is set the first time *any* user finishes the course, so on a
 * shared course it would show a date that has nothing to do with when this
 * particular learner actually finished it. */
export function CertificatePage({ course, completedAt }: { course: Course; completedAt: string | null }) {
  const { user } = useAuth();
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative mx-auto max-w-lg py-16 text-center">
      {revealed && <Confetti />}
      <CheckCircle2 className="mx-auto mb-4 text-emerald-600" size={40} />
      <h1 className="text-2xl font-semibold text-emerald-600">Congrats — you've completed this course!</h1>
      <p className="mt-2 text-sm text-muted-foreground">{course.title}</p>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="mt-8 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Show my certificate
        </button>
      ) : (
        <div className="mt-8">
          <GeneratedCertificate courseTitle={course.title} learnerName={user?.username ?? "Learner"} completedAt={completedAt} />
        </div>
      )}
    </div>
  );
}
