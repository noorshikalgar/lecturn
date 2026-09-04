import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";

describe("me router", () => {
  const app = buildTestApp();

  it("lets a signed-in user update their own profile fields", async () => {
    const { cookie } = createAndLoginUser("user");
    const res = await request(app)
      .patch("/api/me")
      .set("Cookie", cookie)
      .send({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", avatarId: 3 });
    expect(res.status).toBe(200);
    expect(res.body.user.firstName).toBe("Ada");
    expect(res.body.user.lastName).toBe("Lovelace");
    expect(res.body.user.email).toBe("ada@example.com");
    expect(res.body.user.avatarId).toBe(3);
  });

  it("rejects an avatarId outside the preset range", async () => {
    const { cookie } = createAndLoginUser("user");
    const res = await request(app).patch("/api/me").set("Cookie", cookie).send({ avatarId: 99 });
    expect(res.status).toBe(400);
  });

  it("requires authentication", async () => {
    const res = await request(app).patch("/api/me").send({ firstName: "Nope" });
    expect(res.status).toBe(401);
  });

  it("changes the password when the current password is correct, and invalidates existing sessions", async () => {
    const { cookie, username, password } = createAndLoginUser("user");
    const res = await request(app)
      .patch("/api/me/password")
      .set("Cookie", cookie)
      .send({ currentPassword: password, newPassword: "brand-new-password-1" });
    expect(res.status).toBe(204);

    // The session used to make that request is now invalidated too.
    const meAfter = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(meAfter.status).toBe(401);

    // The new password actually works.
    const loginRes = await request(app).post("/api/auth/login").send({ username, password: "brand-new-password-1" });
    expect(loginRes.status).toBe(200);
  });

  it("rejects a password change with the wrong current password", async () => {
    const { cookie } = createAndLoginUser("user");
    const res = await request(app)
      .patch("/api/me/password")
      .set("Cookie", cookie)
      .send({ currentPassword: "definitely-wrong", newPassword: "brand-new-password-1" });
    expect(res.status).toBe(401);

    // The session is still valid — a failed attempt doesn't log you out.
    const meAfter = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(meAfter.status).toBe(200);
  });
});
