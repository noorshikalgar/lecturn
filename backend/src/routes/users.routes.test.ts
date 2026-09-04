import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";

describe("users router", () => {
  const app = buildTestApp();

  it("creates a user with the new profile fields, and rejects a non-admin from doing so", async () => {
    const { cookie: adminCookie } = createAndLoginUser("admin");
    const username = `new-user-${Math.random().toString(36).slice(2, 10)}`;
    const res = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ username, password: "test-password-123", role: "user", firstName: "Grace", lastName: "Hopper", email: "grace@example.com", avatarId: 2 });
    expect(res.status).toBe(201);
    expect(res.body.user.firstName).toBe("Grace");
    expect(res.body.user.avatarId).toBe(2);

    const { cookie: userCookie } = createAndLoginUser("user");
    const denied = await request(app)
      .post("/api/users")
      .set("Cookie", userCookie)
      .send({ username: `other-${Math.random()}`, password: "test-password-123", role: "user", firstName: "X", lastName: "Y" });
    expect(denied.status).toBe(403);
  });

  it("lets admin edit another user's profile fields, since admin has full rights over them", async () => {
    const { cookie: adminCookie } = createAndLoginUser("admin");
    const { userId } = createAndLoginUser("user");

    const res = await request(app)
      .patch(`/api/users/${userId}`)
      .set("Cookie", adminCookie)
      .send({ firstName: "Edited", lastName: "ByAdmin", avatarId: 4 });
    expect(res.status).toBe(200);
    expect(res.body.user.firstName).toBe("Edited");
    expect(res.body.user.avatarId).toBe(4);
  });

  it("blocks a non-admin from editing another user's profile", async () => {
    const { cookie } = createAndLoginUser("user");
    const { userId: otherUserId } = createAndLoginUser("user");
    const res = await request(app).patch(`/api/users/${otherUserId}`).set("Cookie", cookie).send({ firstName: "Hacked" });
    expect(res.status).toBe(403);
  });
});
