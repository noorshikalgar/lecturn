CREATE TABLE `certificates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`file_path` text NOT NULL,
	`uploaded_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`section_id` integer,
	`title` text NOT NULL,
	`description` text,
	`folder_path` text NOT NULL,
	`cover_image_path` text,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_folder_path_unique` ON `courses` (`folder_path`);--> statement-breakpoint
CREATE TABLE `libraries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`root_path` text NOT NULL,
	`last_scanned_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `libraries_root_path_unique` ON `libraries` (`root_path`);--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`parent_id` integer,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`raw_name` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`order_locked` integer DEFAULT false NOT NULL,
	`relative_path` text NOT NULL,
	`missing` integer DEFAULT false NOT NULL,
	`target_url` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nodes_course_relpath_unique` ON `nodes` (`course_id`,`relative_path`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`video_node_id` integer NOT NULL,
	`timestamp_seconds` real,
	`body` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `path_courses` (
	`path_id` integer NOT NULL,
	`course_id` integer NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`path_id`) REFERENCES `paths`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `path_courses_unique` ON `path_courses` (`path_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `paths` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_image` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `progress` (
	`user_id` integer NOT NULL,
	`video_node_id` integer NOT NULL,
	`position_seconds` real DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`last_watched_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progress_user_video_unique` ON `progress` (`user_id`,`video_node_id`);--> statement-breakpoint
CREATE TABLE `sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`library_id` integer NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`folder_path` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subtitle_tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`node_id` integer NOT NULL,
	`label` text NOT NULL,
	`source_format` text NOT NULL,
	`source_path` text NOT NULL,
	`cached_vtt_path` text,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `video_meta` (
	`node_id` integer PRIMARY KEY NOT NULL,
	`duration_seconds` real,
	`width` integer,
	`height` integer,
	`codec` text,
	`container` text,
	`needs_remux` integer DEFAULT false NOT NULL,
	`probed_at` text,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
