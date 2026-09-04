CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`folder_path` text NOT NULL,
	`top_level_folder` text,
	`section_id` text,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_folder_path_unique` ON `collections` (`folder_path`);--> statement-breakpoint
CREATE INDEX `collections_section_id_idx` ON `collections` (`section_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_path_courses` (
	`path_id` text NOT NULL,
	`course_id` text,
	`collection_id` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`path_id`) REFERENCES `paths`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_path_courses`("path_id", "course_id", "collection_id", "order_index") SELECT "path_id", "course_id", NULL, "order_index" FROM `path_courses`;--> statement-breakpoint
DROP TABLE `path_courses`;--> statement-breakpoint
ALTER TABLE `__new_path_courses` RENAME TO `path_courses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `path_courses_course_unique` ON `path_courses` (`path_id`,`course_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `path_courses_collection_unique` ON `path_courses` (`path_id`,`collection_id`);--> statement-breakpoint
ALTER TABLE `courses` ADD `collection_id` text REFERENCES collections(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `courses_collection_id_idx` ON `courses` (`collection_id`);