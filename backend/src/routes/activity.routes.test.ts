import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";

describe("activity router", () => {
  const app = buildTestApp();

  it("blocks a non-admin from reading the activity feed", async () => {
    const { cookie } = createAndLoginUser("user");
    const res = await request(app).get("/api/activity").set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("logs a user_created event when admin creates a user, visible in the feed", async () => {
    const { cookie: adminCookie } = createAndLoginUser("admin");
    const username = `logged-${Math.random().toString(36).slice(2, 10)}`;
    await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ username, password: "test-password-123", role: "user", firstName: "Log", lastName: "Test" });

    const res = await request(app).get("/api/activity?type=user_created").set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    const match = res.body.events.find((e: { message: string }) => e.message.includes(username));
    expect(match).toBeTruthy();
    expect(match.type).toBe("user_created");
  });

  it("logs a section_created event", async () => {
    const { cookie: adminCookie } = createAndLoginUser("admin");
    const title = `Activity test section ${Math.random().toString(36).slice(2, 8)}`;
    await request(app).post("/api/sections").set("Cookie", adminCookie).send({ title });

    const res = await request(app).get("/api/activity?type=section_created").set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    const match = res.body.events.find((e: { message: string }) => e.message.includes(title));
    expect(match).toBeTruthy();
  });
});
