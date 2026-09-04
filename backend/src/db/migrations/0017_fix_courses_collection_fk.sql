-- Migration 0016's hand-added `courses.collection_id` column was written as
-- a plain `ALTER TABLE ... ADD COLUMN ... REFERENCES collections(id)`. That
-- statement silently drops any ON DELETE/ON UPDATE action even when the SQL
-- text includes one — confirmed empirically: PRAGMA foreign_key_list showed
-- "NO ACTION" despite the migration file (after a same-session fix) reading
-- "ON DELETE SET NULL". schema.ts always declared onDelete: "set null"
-- correctly; only the actually-applied DDL was wrong, and only on
-- installs that already ran 0016 before this correction existed — a fresh
-- install runs 0016 with the fix already in place and never needed this.
-- SQLite has no ALTER TABLE to change an existing FK's action in place, so
-- this recreates the table the same way drizzle-kit's own generator does
-- for any other column-level change, preserving every row untouched.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_courses` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text,
	`collection_id` text,
	`title` text NOT NULL,
	`description` text,
	`folder_path` text NOT NULL,
	`top_level_folder` text,
	`cover_image_path` text,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_courses`("id", "section_id", "collection_id", "title", "description", "folder_path", "top_level_folder", "cover_image_path", "duration_seconds", "completed_at", "created_at", "hidden")
SELECT "id", "section_id", "collection_id", "title", "description", "folder_path", "top_level_folder", "cover_image_path", "duration_seconds", "completed_at", "created_at", "hidden" FROM `courses`;
--> statement-breakpoint
DROP TABLE `courses`;--> statement-breakpoint
ALTER TABLE `__new_courses` RENAME TO `courses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `courses_folder_path_unique` ON `courses` (`folder_path`);--> statement-breakpoint
CREATE INDEX `courses_section_id_idx` ON `courses` (`section_id`);--> statement-breakpoint
CREATE INDEX `courses_collection_id_idx` ON `courses` (`collection_id`);
