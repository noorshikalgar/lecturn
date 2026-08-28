import type { Course } from "@lecturn/shared";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { getMyCertificate } from "../../lib/api/certificates";
import { Confetti } from "./Confetti";
import { GeneratedCertificate } from "./GeneratedCertificate";

/** The dedicated "Certificate" page for a completed course — reached via its
 * own entry in the sidebar, the same way a lesson is. Clicking through
 * issues (or re-fetches) this learner's signed, persisted certificate —
 * the backend never trusts that the course is actually done, it recomputes
 * that itself from progress the same way the sidebar's own unlock check
 * does (see courseCertificates.routes.ts), so this only ever succeeds once
 * it's genuinely earned. */
export function CertificatePage({ course }: { course: Course }) {
  const [revealed, setRevealed] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["course-certificate", course.id],
    queryFn: () => getMyCertificate(course.id),
    enabled: revealed,
  });

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
          {isLoading && <p className="text-sm text-muted-foreground">Preparing your certificate…</p>}
          {error && <p className="text-sm text-destructive">Couldn't load your certificate — try again in a moment.</p>}
          {data && <GeneratedCertificate certificate={data.certificate} />}
        </div>
      )}
    </div>
  );
}
