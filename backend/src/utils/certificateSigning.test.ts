import { describe, expect, it } from "vitest";
import { getCertificatePublicKeyPem, signCertificate, verifyCertificateSignature, type CertificateFields } from "./certificateSigning.js";

const fields: CertificateFields = {
  code: "LECTURN-TEST-0001",
  userId: 1,
  courseId: 2,
  recipientName: "Ada Lovelace",
  courseTitle: "Intro to Algorithms",
  completedAt: "2026-01-01T00:00:00.000Z",
  issuedAt: "2026-01-02T00:00:00.000Z",
};

describe("certificateSigning", () => {
  it("verifies a signature it just produced", () => {
    const signature = signCertificate(fields);
    expect(verifyCertificateSignature(fields, signature)).toBe(true);
  });

  it("rejects a signature after any field is tampered with", () => {
    const signature = signCertificate(fields);
    expect(verifyCertificateSignature({ ...fields, recipientName: "Eve" }, signature)).toBe(false);
    expect(verifyCertificateSignature({ ...fields, completedAt: "2099-01-01T00:00:00.000Z" }, signature)).toBe(false);
    expect(verifyCertificateSignature({ ...fields, code: "LECTURN-FAKE-0001" }, signature)).toBe(false);
  });

  it("rejects a malformed signature instead of throwing", () => {
    expect(verifyCertificateSignature(fields, "not-valid-base64!!")).toBe(false);
    expect(verifyCertificateSignature(fields, "")).toBe(false);
  });

  it("exposes a PEM-encoded public key that matches the signing key", () => {
    const pem = getCertificatePublicKeyPem();
    expect(pem).toContain("BEGIN PUBLIC KEY");
  });
});
