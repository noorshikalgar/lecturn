import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  role: z.enum(["admin", "user"]),
});

export const createLibrarySchema = z.object({
  rootPath: z.string().min(1),
});

export const markCourseFolderSchema = z.object({
  folderPath: z.string().min(1),
});

export const updateNodeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  orderIndex: z.number().int().optional(),
  parentId: z.number().int().nullable().optional(),
});

export const reorderNodesSchema = z.object({
  courseId: z.number().int(),
  parentId: z.number().int().nullable(),
  orderedNodeIds: z.array(z.number().int()).min(1),
});

export const createSectionSchema = z.object({
  title: z.string().min(1).max(200),
});

export const assignCourseSectionSchema = z.object({
  sectionId: z.number().int().nullable(),
});

export const setSectionAccessSchema = z.object({
  userIds: z.array(z.number().int()),
});

export const setSectionHiddenSchema = z.object({
  hidden: z.boolean(),
});

export const setCourseHiddenSchema = z.object({
  hidden: z.boolean(),
});

export const createNoteSchema = z.object({
  videoNodeId: z.number().int(),
  timestampSeconds: z.number().nonnegative().nullable().optional(),
  body: z.string().min(1).max(20000),
});

export const updateNoteSchema = z.object({
  timestampSeconds: z.number().nonnegative().nullable().optional(),
  body: z.string().min(1).max(20000).optional(),
});

export const updateProgressSchema = z.object({
  videoNodeId: z.number().int(),
  positionSeconds: z.number().nonnegative(),
  completed: z.boolean().optional(),
});

export const createPathSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
});

export const addCourseToPathSchema = z.object({
  courseId: z.number().int(),
  orderIndex: z.number().int().optional(),
});

export const reorderPathCoursesSchema = z.object({
  orderedCourseIds: z.array(z.number().int()).min(1),
});

export const updatePathSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const markCourseCompleteSchema = z.object({
  completed: z.boolean(),
});
