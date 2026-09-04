import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createAndLoginUser } from "../test/testApp.js";
import { getCourseByFolderPath } from "../db/repositories/coursesRepo.js";
import { getCollectionByFolderPath } from "../db/repositories/collectionsRepo.js";

describe("mark-collection / mark-course ordering", () => {
  const app = buildTestApp();

  it("groups a course marked before its parent collection existed, once the collection is marked", async () => {
    const { cookie } = createAndLoginUser("admin");
    const root = mkdtempSync(join(tmpdir(), "lecturn-mark-order-a-"));
    const parent = join(root, "Java");
    const child = join(parent, "Part 1");
    mkdirSync(child, { recursive: true });

    const libRes = await request(app).post("/api/libraries").set("Cookie", cookie).send({ rootPath: root });
    const libraryId = libRes.body.library.id as string;

    const markCourseRes = await request(app).post(`/api/libraries/${libraryId}/mark-course`).set("Cookie", cookie).send({ folderPath: child });
    expect(markCourseRes.status).toBe(201);
    const courseBefore = getCourseByFolderPath(child);
    expect(courseBefore?.collectionId).toBeNull();

    const markCollectionRes = await request(app)
      .post(`/api/libraries/${libraryId}/mark-collection`)
      .set("Cookie", cookie)
      .send({ folderPath: parent });
    expect(markCollectionRes.status).toBe(201);

    const collection = getCollectionByFolderPath(parent);
    expect(collection).toBeDefined();
    const courseAfter = getCourseByFolderPath(child);
    expect(courseAfter?.collectionId).toBe(collection!.id);
  });

  it("groups a course marked after its parent collection already exists", async () => {
    const { cookie } = createAndLoginUser("admin");
    const root = mkdtempSync(join(tmpdir(), "lecturn-mark-order-b-"));
    const parent = join(root, "Rust");
    const child = join(parent, "Part 1");
    mkdirSync(child, { recursive: true });

    const libRes = await request(app).post("/api/libraries").set("Cookie", cookie).send({ rootPath: root });
    const libraryId = libRes.body.library.id as string;

    await request(app).post(`/api/libraries/${libraryId}/mark-collection`).set("Cookie", cookie).send({ folderPath: parent });
    const collection = getCollectionByFolderPath(parent);
    expect(collection).toBeDefined();

    const markCourseRes = await request(app).post(`/api/libraries/${libraryId}/mark-course`).set("Cookie", cookie).send({ folderPath: child });
    expect(markCourseRes.status).toBe(201);

    const course = getCourseByFolderPath(child);
    expect(course?.collectionId).toBe(collection!.id);
  });

  it("rejects marking a collection nested inside an existing one", async () => {
    const { cookie } = createAndLoginUser("admin");
    const root = mkdtempSync(join(tmpdir(), "lecturn-mark-nested-"));
    const outer = join(root, "Outer");
    const inner = join(outer, "Inner");
    mkdirSync(inner, { recursive: true });

    const libRes = await request(app).post("/api/libraries").set("Cookie", cookie).send({ rootPath: root });
    const libraryId = libRes.body.library.id as string;

    await request(app).post(`/api/libraries/${libraryId}/mark-collection`).set("Cookie", cookie).send({ folderPath: outer });
    const res = await request(app).post(`/api/libraries/${libraryId}/mark-collection`).set("Cookie", cookie).send({ folderPath: inner });
    expect(res.status).toBe(400);
  });
});
