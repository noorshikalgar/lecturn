import { Router } from "express";
import { getCertificatePublicKeyPem } from "../utils/certificateSigning.js";
import { verifyCertificateCode } from "../services/certificateService.js";

// Deliberately public — mounted in routes/index.ts *before* requireAuth.
// The entire point of a verifiable certificate is that someone who never
// signed in (an employer checking a candidate's claim, say) can confirm it
// on their own.
export const verifyRouter = Router();

verifyRouter.get("/public-key", (_req, res) => {
  res.type("text/plain").send(getCertificatePublicKeyPem());
});

verifyRouter.get("/:code", (req, res) => {
  res.json(verifyCertificateCode(req.params.code));
});
