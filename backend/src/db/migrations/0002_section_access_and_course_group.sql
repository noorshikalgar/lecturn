CREATE TABLE `section_access` (
	`section_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `section_access_unique` ON `section_access` (`section_id`,`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sections`("id", "title", "slug", "order_index") SELECT "id", "title", "slug", "order_index" FROM `sections`;--> statement-breakpoint
DROP TABLE `sections`;--> statement-breakpoint
ALTER TABLE `__new_sections` RENAME TO `sections`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `courses` ADD `top_level_folder` text;