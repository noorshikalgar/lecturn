import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { useParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import { verifyCertificate } from "../lib/api/verify";

/** Deliberately outside the app's auth gate (see App.tsx) — the entire
 * point of a verifiable certificate is that someone who never signed in
 * (an employer checking a candidate's claim, say) can confirm it here on
 * their own, without a Lecturn account. */
export function VerifyPage() {
  const { code } = useParams<{ code: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["verify", code],
    queryFn: () => verifyCertificate(code!),
    enabled: !!code,
  });

  const completedDate = data?.certificate
    ? new Date(data.certificate.completedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <Logo className="mx-auto mb-6 size-8 text-foreground" />

        {isLoading && <p className="text-sm text-muted-foreground">Checking certificate…</p>}

        {!isLoading && data?.valid && data.certificate && (
          <>
            <CheckCircle2 className="mx-auto mb-3 text-emerald-600" size={36} />
            <h1 className="text-lg font-semibold text-foreground">Certificate verified</h1>
            <p className="mt-4 text-sm text-muted-foreground">This confirms that</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{data.certificate.recipientName}</p>
            <p className="mt-3 text-sm text-muted-foreground">successfully completed</p>
            <p className="mt-1 text-base font-medium text-foreground">{data.certificate.courseTitle}</p>
            <p className="mt-3 text-xs text-muted-foreground">{completedDate}</p>
            <div className="mt-6 space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
              <p>
                Issued by {data.certificate.issuer} · {new Date(data.certificate.issuedAt).toLocaleDateString()}
              </p>
              <p className="font-mono">{data.certificate.code}</p>
            </div>
          </>
        )}

        {!isLoading && !data?.valid && (
          <>
            <XCircle className="mx-auto mb-3 text-destructive" size={36} />
            <h1 className="text-lg font-semibold text-foreground">Certificate not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This code doesn't match a valid Lecturn certificate. Double-check it was entered correctly.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
