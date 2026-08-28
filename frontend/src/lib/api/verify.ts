import type { CertificateVerification } from "@lecturn/shared";
import { api } from "../apiClient";

// Hits a route mounted before the app's auth gate — reachable from
// VerifyPage without a signed-in session, since the whole point is that
// someone who never logged in (a prospective employer, say) can confirm a
// certificate on their own.
export function verifyCertificate(code: string) {
  return api.get<CertificateVerification>(`/verify/${encodeURIComponent(code)}`);
}
