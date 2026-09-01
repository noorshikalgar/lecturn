import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";

describe("libraries router — background scan", () => {
  const app = buildTestApp();

  async function pollUntilSettled(cookie: string, libraryId: number) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const res = await request(app).get("/api/libraries").set("Cookie", cookie);
      const library = res.body.libraries.find((l: { id: number }) => l.id === libraryId);
      if (library.scanStatus !== "running") return library;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error("Scan never settled");
  }

  it("returns immediately with the scan still running in the background, then settles to completed", async () => {
    const { cookie } = createAndLoginUser("admin");
    const createRes = await request(app)
      .post("/api/libraries")
      .set("Cookie", cookie)
      .send({ rootPath: `/test-courses/bg-scan-${Math.random().toString(36).slice(2, 8)}` });
    const libraryId = createRes.body.library.id as number;

    const scanRes = await request(app).post(`/api/libraries/${libraryId}/scan`).set("Cookie", cookie);
    // Responds before the scan work is necessarily done — the whole point.
    expect(scanRes.status).toBe(202);
    expect(scanRes.body).toEqual({ status: "running" });

    const settled = await pollUntilSettled(cookie, libraryId);
    expect(settled.scanStatus).toBe("completed");
    expect(settled.lastScanSummary).toMatchObject({ coursesFound: 0, libraryId });
    expect(settled.scanError).toBeNull();
  });

  it("doesn't launch a second overlapping scan while one is already running for the same library", async () => {
    const { cookie } = createAndLoginUser("admin");
    const createRes = await request(app)
      .post("/api/libraries")
      .set("Cookie", cookie)
      .send({ rootPath: `/test-courses/bg-scan-dup-${Math.random().toString(36).slice(2, 8)}` });
    const libraryId = createRes.body.library.id as number;

    const [first, second] = await Promise.all([
      request(app).post(`/api/libraries/${libraryId}/scan`).set("Cookie", cookie),
      request(app).post(`/api/libraries/${libraryId}/scan`).set("Cookie", cookie),
    ]);
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);

    const settled = await pollUntilSettled(cookie, libraryId);
    expect(settled.scanStatus).toBe("completed");
  });
});
