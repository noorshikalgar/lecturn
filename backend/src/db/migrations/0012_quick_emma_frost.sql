-- Converts every integer autoincrement primary key (and every foreign key
-- pointing at one) to a text UUID. Existing rows keep their relationships:
-- for each table with its own id, a temp mapping table (old integer id ->
-- freshly generated UUID) is built FIRST, from the original untouched
-- tables, before any table is dropped or recreated — so every later
-- INSERT...SELECT can translate both a table's own id and any FK column
-- pointing at another table by joining against that table's map, regardless
-- of what order the tables below get rebuilt in.
CREATE TEMP TABLE `_map_users` AS
SELECT `id` AS `old_id`,
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS `new_id`
FROM `users`;
--> statement-breakpoint
CREATE TEMP TABLE `_map_libraries` AS
SELECT `id` AS `old_id`,
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS `new_id`
FROM `libraries`;
--> statement-breakpoint
CREATE TEMP TABLE `_map_sections` AS
SELECT `id` AS `old_id`,
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS `new_id`
FROM `sections`;
--> statement-breakpoint
CREATE TEMP TABLE `_map_courses` AS
SELECT `id` AS `old_id`,
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS `new_id`
FROM `courses`;
--> statement-breakpoint
CREATE TEMP TABLE `_map_nodes` AS
SELECT `id` AS `old_id`,
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS `new_id`
FROM `nodes`;
--> statement-breakpoint
CREATE TEMP TABLE `_map_subtitle_tracks` AS
SELECT `id` AS `old_id`,
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS `new_id`
FROM `subtitle_tracks`;
--> statement-breakpoint
CREATE TEMP TABLE `_map_notes` AS
SELECT `id` AS `old_id`,
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS `new_id`
FROM `notes`;
--> statement-breakpoint
CREATE TEMP TABLE `_map_certificates` AS
SELECT `id` AS `old_id`,
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS `new_id`
FROM `certificates`;
--> statement-breakpoint
CREATE TEMP TABLE `_map_certificate_issuances` AS
SELECT `id` AS `old_id`,
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS `new_id`
FROM `certificate_issuances`;
--> statement-breakpoint
CREATE TEMP TABLE `_map_paths` AS
SELECT `id` AS `old_id`,
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS `new_id`
FROM `paths`;
--> statement-breakpoint
CREATE UNIQUE INDEX `_map_users_old_idx` ON `_map_users` (`old_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `_map_libraries_old_idx` ON `_map_libraries` (`old_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `_map_sections_old_idx` ON `_map_sections` (`old_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `_map_courses_old_idx` ON `_map_courses` (`old_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `_map_nodes_old_idx` ON `_map_nodes` (`old_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `_map_subtitle_tracks_old_idx` ON `_map_subtitle_tracks` (`old_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `_map_notes_old_idx` ON `_map_notes` (`old_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `_map_certificates_old_idx` ON `_map_certificates` (`old_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `_map_certificate_issuances_old_idx` ON `_map_certificate_issuances` (`old_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `_map_paths_old_idx` ON `_map_paths` (`old_id`);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_certificate_issuances` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`recipient_name` text NOT NULL,
	`course_title` text NOT NULL,
	`completed_at` text NOT NULL,
	`issued_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`signature` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_certificate_issuances`("id", "code", "user_id", "course_id", "recipient_name", "course_title", "completed_at", "issued_at", "signature")
SELECT `map_id`.`new_id`, `t`.`code`, `map_user`.`new_id`, `map_course`.`new_id`, `t`.`recipient_name`, `t`.`course_title`, `t`.`completed_at`, `t`.`issued_at`, `t`.`signature`
FROM `certificate_issuances` `t`
JOIN `_map_certificate_issuances` `map_id` ON `map_id`.`old_id` = `t`.`id`
JOIN `_map_users` `map_user` ON `map_user`.`old_id` = `t`.`user_id`
JOIN `_map_courses` `map_course` ON `map_course`.`old_id` = `t`.`course_id`;
--> statement-breakpoint
DROP TABLE `certificate_issuances`;--> statement-breakpoint
ALTER TABLE `__new_certificate_issuances` RENAME TO `certificate_issuances`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `certificate_issuances_code_unique` ON `certificate_issuances` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `certificate_issuances_user_course_unique` ON `certificate_issuances` (`user_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `__new_certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`file_path` text NOT NULL,
	`uploaded_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_certificates`("id", "course_id", "file_path", "uploaded_at")
SELECT `map_id`.`new_id`, `map_course`.`new_id`, `t`.`file_path`, `t`.`uploaded_at`
FROM `certificates` `t`
JOIN `_map_certificates` `map_id` ON `map_id`.`old_id` = `t`.`id`
JOIN `_map_courses` `map_course` ON `map_course`.`old_id` = `t`.`course_id`;
--> statement-breakpoint
DROP TABLE `certificates`;--> statement-breakpoint
ALTER TABLE `__new_certificates` RENAME TO `certificates`;--> statement-breakpoint
CREATE TABLE `__new_courses` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text,
	`title` text NOT NULL,
	`description` text,
	`folder_path` text NOT NULL,
	`top_level_folder` text,
	`cover_image_path` text,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_courses`("id", "section_id", "title", "description", "folder_path", "top_level_folder", "cover_image_path", "duration_seconds", "completed_at", "created_at", "hidden")
SELECT `map_id`.`new_id`, `map_section`.`new_id`, `t`.`title`, `t`.`description`, `t`.`folder_path`, `t`.`top_level_folder`, `t`.`cover_image_path`, `t`.`duration_seconds`, `t`.`completed_at`, `t`.`created_at`, `t`.`hidden`
FROM `courses` `t`
JOIN `_map_courses` `map_id` ON `map_id`.`old_id` = `t`.`id`
LEFT JOIN `_map_sections` `map_section` ON `map_section`.`old_id` = `t`.`section_id`;
--> statement-breakpoint
DROP TABLE `courses`;--> statement-breakpoint
ALTER TABLE `__new_courses` RENAME TO `courses`;--> statement-breakpoint
CREATE UNIQUE INDEX `courses_folder_path_unique` ON `courses` (`folder_path`);--> statement-breakpoint
CREATE INDEX `courses_section_id_idx` ON `courses` (`section_id`);--> statement-breakpoint
CREATE TABLE `__new_libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`root_path` text NOT NULL,
	`last_scanned_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`scan_status` text DEFAULT 'idle' NOT NULL,
	`scan_started_at` text,
	`scan_error` text,
	`last_scan_summary` text
);
--> statement-breakpoint
INSERT INTO `__new_libraries`("id", "root_path", "last_scanned_at", "created_at", "scan_status", "scan_started_at", "scan_error", "last_scan_summary")
SELECT `map_id`.`new_id`, `t`.`root_path`, `t`.`last_scanned_at`, `t`.`created_at`, `t`.`scan_status`, `t`.`scan_started_at`, `t`.`scan_error`, `t`.`last_scan_summary`
FROM `libraries` `t`
JOIN `_map_libraries` `map_id` ON `map_id`.`old_id` = `t`.`id`;
--> statement-breakpoint
DROP TABLE `libraries`;--> statement-breakpoint
ALTER TABLE `__new_libraries` RENAME TO `libraries`;--> statement-breakpoint
CREATE UNIQUE INDEX `libraries_root_path_unique` ON `libraries` (`root_path`);--> statement-breakpoint
CREATE TABLE `__new_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`parent_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`raw_name` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`relative_path` text NOT NULL,
	`missing` integer DEFAULT false NOT NULL,
	`target_url` text,
	`content_fingerprint` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_nodes`("id", "course_id", "parent_id", "type", "title", "raw_name", "order_index", "relative_path", "missing", "target_url", "content_fingerprint")
SELECT `map_id`.`new_id`, `map_course`.`new_id`, `map_parent`.`new_id`, `t`.`type`, `t`.`title`, `t`.`raw_name`, `t`.`order_index`, `t`.`relative_path`, `t`.`missing`, `t`.`target_url`, `t`.`content_fingerprint`
FROM `nodes` `t`
JOIN `_map_nodes` `map_id` ON `map_id`.`old_id` = `t`.`id`
JOIN `_map_courses` `map_course` ON `map_course`.`old_id` = `t`.`course_id`
LEFT JOIN `_map_nodes` `map_parent` ON `map_parent`.`old_id` = `t`.`parent_id`;
--> statement-breakpoint
DROP TABLE `nodes`;--> statement-breakpoint
ALTER TABLE `__new_nodes` RENAME TO `nodes`;--> statement-breakpoint
CREATE UNIQUE INDEX `nodes_course_relpath_unique` ON `nodes` (`course_id`,`relative_path`);--> statement-breakpoint
CREATE INDEX `nodes_parent_id_idx` ON `nodes` (`parent_id`);--> statement-breakpoint
CREATE TABLE `__new_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`video_node_id` text NOT NULL,
	`timestamp_seconds` real,
	`body` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_notes`("id", "user_id", "video_node_id", "timestamp_seconds", "body", "created_at", "updated_at")
SELECT `map_id`.`new_id`, `map_user`.`new_id`, `map_node`.`new_id`, `t`.`timestamp_seconds`, `t`.`body`, `t`.`created_at`, `t`.`updated_at`
FROM `notes` `t`
JOIN `_map_notes` `map_id` ON `map_id`.`old_id` = `t`.`id`
JOIN `_map_users` `map_user` ON `map_user`.`old_id` = `t`.`user_id`
JOIN `_map_nodes` `map_node` ON `map_node`.`old_id` = `t`.`video_node_id`;
--> statement-breakpoint
DROP TABLE `notes`;--> statement-breakpoint
ALTER TABLE `__new_notes` RENAME TO `notes`;--> statement-breakpoint
CREATE INDEX `notes_user_id_idx` ON `notes` (`user_id`);--> statement-breakpoint
CREATE INDEX `notes_video_node_id_idx` ON `notes` (`video_node_id`);--> statement-breakpoint
CREATE TABLE `__new_path_courses` (
	`path_id` text NOT NULL,
	`course_id` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`path_id`) REFERENCES `paths`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_path_courses`("path_id", "course_id", "order_index")
SELECT `map_path`.`new_id`, `map_course`.`new_id`, `t`.`order_index`
FROM `path_courses` `t`
JOIN `_map_paths` `map_path` ON `map_path`.`old_id` = `t`.`path_id`
JOIN `_map_courses` `map_course` ON `map_course`.`old_id` = `t`.`course_id`;
--> statement-breakpoint
DROP TABLE `path_courses`;--> statement-breakpoint
ALTER TABLE `__new_path_courses` RENAME TO `path_courses`;--> statement-breakpoint
CREATE UNIQUE INDEX `path_courses_unique` ON `path_courses` (`path_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `__new_paths` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_image` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_paths`("id", "title", "description", "cover_image", "order_index", "created_at")
SELECT `map_id`.`new_id`, `t`.`title`, `t`.`description`, `t`.`cover_image`, `t`.`order_index`, `t`.`created_at`
FROM `paths` `t`
JOIN `_map_paths` `map_id` ON `map_id`.`old_id` = `t`.`id`;
--> statement-breakpoint
DROP TABLE `paths`;--> statement-breakpoint
ALTER TABLE `__new_paths` RENAME TO `paths`;--> statement-breakpoint
CREATE TABLE `__new_progress` (
	`user_id` text NOT NULL,
	`video_node_id` text NOT NULL,
	`position_seconds` real DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`last_watched_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_progress`("user_id", "video_node_id", "position_seconds", "completed", "last_watched_at")
SELECT `map_user`.`new_id`, `map_node`.`new_id`, `t`.`position_seconds`, `t`.`completed`, `t`.`last_watched_at`
FROM `progress` `t`
JOIN `_map_users` `map_user` ON `map_user`.`old_id` = `t`.`user_id`
JOIN `_map_nodes` `map_node` ON `map_node`.`old_id` = `t`.`video_node_id`;
--> statement-breakpoint
DROP TABLE `progress`;--> statement-breakpoint
ALTER TABLE `__new_progress` RENAME TO `progress`;--> statement-breakpoint
CREATE UNIQUE INDEX `progress_user_video_unique` ON `progress` (`user_id`,`video_node_id`);--> statement-breakpoint
CREATE TABLE `__new_section_access` (
	`section_id` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_section_access`("section_id", "user_id")
SELECT `map_section`.`new_id`, `map_user`.`new_id`
FROM `section_access` `t`
JOIN `_map_sections` `map_section` ON `map_section`.`old_id` = `t`.`section_id`
JOIN `_map_users` `map_user` ON `map_user`.`old_id` = `t`.`user_id`;
--> statement-breakpoint
DROP TABLE `section_access`;--> statement-breakpoint
ALTER TABLE `__new_section_access` RENAME TO `section_access`;--> statement-breakpoint
CREATE UNIQUE INDEX `section_access_unique` ON `section_access` (`section_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `section_access_user_idx` ON `section_access` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sections`("id", "title", "slug", "order_index", "hidden")
SELECT `map_id`.`new_id`, `t`.`title`, `t`.`slug`, `t`.`order_index`, `t`.`hidden`
FROM `sections` `t`
JOIN `_map_sections` `map_id` ON `map_id`.`old_id` = `t`.`id`;
--> statement-breakpoint
DROP TABLE `sections`;--> statement-breakpoint
ALTER TABLE `__new_sections` RENAME TO `sections`;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("token", "user_id", "created_at", "expires_at", "last_seen_at")
SELECT `t`.`token`, `map_user`.`new_id`, `t`.`created_at`, `t`.`expires_at`, `t`.`last_seen_at`
FROM `sessions` `t`
JOIN `_map_users` `map_user` ON `map_user`.`old_id` = `t`.`user_id`;
--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
CREATE TABLE `__new_subtitle_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`label` text NOT NULL,
	`source_format` text NOT NULL,
	`source_path` text NOT NULL,
	`cached_vtt_path` text,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_subtitle_tracks`("id", "node_id", "label", "source_format", "source_path", "cached_vtt_path")
SELECT `map_id`.`new_id`, `map_node`.`new_id`, `t`.`label`, `t`.`source_format`, `t`.`source_path`, `t`.`cached_vtt_path`
FROM `subtitle_tracks` `t`
JOIN `_map_subtitle_tracks` `map_id` ON `map_id`.`old_id` = `t`.`id`
JOIN `_map_nodes` `map_node` ON `map_node`.`old_id` = `t`.`node_id`;
--> statement-breakpoint
DROP TABLE `subtitle_tracks`;--> statement-breakpoint
ALTER TABLE `__new_subtitle_tracks` RENAME TO `subtitle_tracks`;--> statement-breakpoint
CREATE INDEX `subtitle_tracks_node_id_idx` ON `subtitle_tracks` (`node_id`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "password_hash", "password_salt", "role", "created_at")
SELECT `map_id`.`new_id`, `t`.`username`, `t`.`password_hash`, `t`.`password_salt`, `t`.`role`, `t`.`created_at`
FROM `users` `t`
JOIN `_map_users` `map_id` ON `map_id`.`old_id` = `t`.`id`;
--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `__new_video_meta` (
	`node_id` text PRIMARY KEY NOT NULL,
	`duration_seconds` real,
	`width` integer,
	`height` integer,
	`codec` text,
	`container` text,
	`probed_at` text,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_video_meta`("node_id", "duration_seconds", "width", "height", "codec", "container", "probed_at")
SELECT `map_node`.`new_id`, `t`.`duration_seconds`, `t`.`width`, `t`.`height`, `t`.`codec`, `t`.`container`, `t`.`probed_at`
FROM `video_meta` `t`
JOIN `_map_nodes` `map_node` ON `map_node`.`old_id` = `t`.`node_id`;
--> statement-breakpoint
DROP TABLE `video_meta`;--> statement-breakpoint
ALTER TABLE `__new_video_meta` RENAME TO `video_meta`;
--> statement-breakpoint
DROP TABLE `_map_users`;--> statement-breakpoint
DROP TABLE `_map_libraries`;--> statement-breakpoint
DROP TABLE `_map_sections`;--> statement-breakpoint
DROP TABLE `_map_courses`;--> statement-breakpoint
DROP TABLE `_map_nodes`;--> statement-breakpoint
DROP TABLE `_map_subtitle_tracks`;--> statement-breakpoint
DROP TABLE `_map_notes`;--> statement-breakpoint
DROP TABLE `_map_certificates`;--> statement-breakpoint
DROP TABLE `_map_certificate_issuances`;--> statement-breakpoint
DROP TABLE `_map_paths`;
