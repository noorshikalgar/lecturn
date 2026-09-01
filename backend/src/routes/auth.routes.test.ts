import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp } from "../test/testApp.js";
import { createUser } from "../services/authService.js";

// This suite exists because the audit that prompted it found auth.routes.ts
// — the single most security-sensitive route in the app — had zero direct
// tests, with login/session/rate-limit behavior only ever exercised
// incidentally through other routers' own tests.
describe("auth router", () => {
  const app = buildTestApp();

  function uniqueUsername(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  it("logs in with correct credentials, sets a session cookie, and never returns the password hash", async () => {
    const username = uniqueUsername("login-ok");
    createUser(username, "correct-password", "user");

    const res = await request(app).post("/api/auth/login").send({ username, password: "correct-password" });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(username);
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.body.user).not.toHaveProperty("passwordSalt");
    expect(res.headers["set-cookie"]?.[0]).toMatch(/lecturn_session=/);
  });

  it("rejects a wrong password with 401, without revealing whether the username exists", async () => {
    const username = uniqueUsername("login-bad-pass");
    createUser(username, "correct-password", "user");

    const wrongPassword = await request(app).post("/api/auth/login").send({ username, password: "wrong-password" });
    const unknownUser = await request(app).post("/api/auth/login").send({ username: uniqueUsername("nobody"), password: "whatever" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknownUser.body.error);
  });

  it("rejects a login request missing required fields with 400, before ever checking credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({ username: "someone" });
    expect(res.status).toBe(400);
  });

  it("blocks /me without a session cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the signed-in user for /me with a valid session cookie", async () => {
    const username = uniqueUsername("me");
    createUser(username, "correct-password", "user");
    const login = await request(app).post("/api/auth/login").send({ username, password: "correct-password" });
    const cookie = login.headers["set-cookie"][0];

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe(username);
  });

  it("invalidates the session on logout — /me with the same cookie afterward is unauthenticated", async () => {
    const username = uniqueUsername("logout");
    createUser(username, "correct-password", "user");
    const login = await request(app).post("/api/auth/login").send({ username, password: "correct-password" });
    const cookie = login.headers["set-cookie"][0];

    const logoutRes = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(logoutRes.status).toBe(204);

    const meAfter = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(meAfter.status).toBe(401);
  });

  it("throttles repeated failed logins for the same username past the configured limit", async () => {
    const username = uniqueUsername("rate-limited");
    createUser(username, "correct-password", "user");

    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post("/api/auth/login").send({ username, password: "wrong-password" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
