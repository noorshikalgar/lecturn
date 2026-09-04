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

  // The test DB is shared across every test in this file (and process) —
  // reduce to exactly one known admin first, rather than assuming a clean
  // slate, so "last admin" actually means last.
  async function reduceToSoleAdmin(cookie: string, keepId: string) {
    const res = await request(app).get("/api/users").set("Cookie", cookie);
    const otherAdmins = res.body.users.filter((u: { id: string; role: string }) => u.role === "admin" && u.id !== keepId);
    for (const admin of otherAdmins) {
      await request(app).patch(`/api/users/${admin.id}/role`).set("Cookie", cookie).send({ role: "user" });
    }
  }

  it("blocks demoting the last admin, but allows it once a second admin exists", async () => {
    const { cookie: adminCookie, userId: adminId } = createAndLoginUser("admin");
    await reduceToSoleAdmin(adminCookie, adminId);

    const demoteSelfAsLast = await request(app).patch(`/api/users/${adminId}/role`).set("Cookie", adminCookie).send({ role: "user" });
    expect(demoteSelfAsLast.status).toBe(400);
    expect(demoteSelfAsLast.body.error).toBe("last_admin");

    createAndLoginUser("admin"); // a second admin now exists
    const demoteNowThatTwoExist = await request(app)
      .patch(`/api/users/${adminId}/role`)
      .set("Cookie", adminCookie)
      .send({ role: "user" });
    expect(demoteNowThatTwoExist.status).toBe(200);
  });

  // deleteUser's own last-admin check is defense-in-depth rather than
  // something reachable through the API today: the only way to have exactly
  // one admin *and* target that same admin for deletion is for the request
  // to come from that admin — which the pre-existing "can't delete your own
  // account" rule already blocks, before the last-admin check ever runs.
  // This just confirms the ordinary two-admin delete path still works.
  it("lets one admin delete another as long as at least one admin remains", async () => {
    const { cookie: firstAdminCookie } = createAndLoginUser("admin");
    const { userId: secondAdminId } = createAndLoginUser("admin");

    const res = await request(app).delete(`/api/users/${secondAdminId}`).set("Cookie", firstAdminCookie);
    expect(res.status).toBe(204);
  });
});
