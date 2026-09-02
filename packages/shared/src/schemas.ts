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

export const relinkCourseSchema = z.object({
  folderPath: z.string().min(1),
});

export const createSectionSchema = z.object({
  title: z.string().min(1).max(200),
});

export const reorderSectionsSchema = z.object({
  orderedSectionIds: z.array(z.string().min(1)).min(1),
});

export const assignCourseSectionSchema = z.object({
  sectionId: z.string().min(1).nullable(),
});

export const setSectionAccessSchema = z.object({
  userIds: z.array(z.string().min(1)),
});

export const setSectionHiddenSchema = z.object({
  hidden: z.boolean(),
});

export const setCourseHiddenSchema = z.object({
  hidden: z.boolean(),
});

export const createNoteSchema = z.object({
  videoNodeId: z.string().min(1),
  timestampSeconds: z.number().nonnegative().nullable().optional(),
  body: z.string().min(1).max(20000),
});

export const updateNoteSchema = z.object({
  timestampSeconds: z.number().nonnegative().nullable().optional(),
  body: z.string().min(1).max(20000).optional(),
});

export const updateProgressSchema = z.object({
  videoNodeId: z.string().min(1),
  positionSeconds: z.number().nonnegative(),
  completed: z.boolean().optional(),
});

export const createPathSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
});

export const addCourseToPathSchema = z.object({
  courseId: z.string().min(1),
  orderIndex: z.number().int().optional(),
});

export const reorderPathCoursesSchema = z.object({
  orderedCourseIds: z.array(z.string().min(1)).min(1),
});

export const reorderPathsSchema = z.object({
  orderedPathIds: z.array(z.string().min(1)).min(1),
});

export const updatePathSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const markCourseCompleteSchema = z.object({
  completed: z.boolean(),
});
