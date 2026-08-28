import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";
import { createCourse } from "../db/repositories/coursesRepo.js";
import { createSection } from "../db/repositories/sectionsRepo.js";
import { insertNode } from "../db/repositories/nodesRepo.js";
import { upsertProgress } from "../db/repositories/progressRepo.js";
import { db } from "../db/client.js";
import { certificateIssuances } from "../db/schema.js";

describe("verify router (public)", () => {
  const app = buildTestApp();

  async function issueRealCertificate() {
    const section = createSection(`Public section — verify ${Math.random().toString(36).slice(2, 8)}`);
    const course = createCourse({
      folderPath: `/test-courses/verify-${Math.random().toString(36).slice(2, 8)}`,
      sectionId: section.id,
      title: "Verifiable Certificates 101",
      description: null,
      topLevelFolder: null,
    });
    const node = insertNode({
      courseId: course.id,
      parentId: null,
      type: "video",
      title: "Lesson 1",
      rawName: "lesson1.mp4",
      orderIndex: 0,
      relativePath: "lesson1.mp4",
      targetUrl: null,
    });
    const { cookie, userId } = createAndLoginUser("user");
    upsertProgress(userId, node.id, 100, true);
    const res = await request(app).get(`/api/course-certificates/${course.id}/mine`).set("Cookie", cookie);
    return res.body.certificate as { code: string; recipientName: string; courseTitle: string };
  }

  it("verifies a real issued certificate's code with no authentication at all", async () => {
    const cert = await issueRealCertificate();

    const res = await request(app).get(`/api/verify/${cert.code}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.certificate.recipientName).toBe(cert.recipientName);
    expect(res.body.certificate.courseTitle).toBe("Verifiable Certificates 101");
    expect(res.body.certificate.issuer).toBe("Lecturn");
  });

  it("reports an unknown code as invalid rather than erroring", async () => {
    const res = await request(app).get("/api/verify/LECTURN-FAKE1-FAKE2");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: false, certificate: null });
  });

  it("detects a certificate row tampered with directly in the database", async () => {
    const cert = await issueRealCertificate();

    // Simulates someone bypassing the app entirely and hand-editing the row
    // (or a bug elsewhere doing the same) — the signature was computed over
    // the original recipientName, so this must now fail verification even
    // though the row still exists under the same code.
    db.update(certificateIssuances).set({ recipientName: "Someone Else" }).where(eq(certificateIssuances.code, cert.code)).run();

    const res = await request(app).get(`/api/verify/${cert.code}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: false, certificate: null });
  });

  it("serves the signing public key with no authentication", async () => {
    const res = await request(app).get("/api/verify/public-key");
    expect(res.status).toBe(200);
    expect(res.text).toContain("BEGIN PUBLIC KEY");
  });
});
