ALTER TABLE `sessions` ADD `last_seen_at` text;--> statement-breakpoint
CREATE INDEX `courses_section_id_idx` ON `courses` (`section_id`);--> statement-breakpoint
CREATE INDEX `nodes_parent_id_idx` ON `nodes` (`parent_id`);--> statement-breakpoint
CREATE INDEX `notes_user_id_idx` ON `notes` (`user_id`);--> statement-breakpoint
CREATE INDEX `notes_video_node_id_idx` ON `notes` (`video_node_id`);--> statement-breakpoint
CREATE INDEX `section_access_user_idx` ON `section_access` (`user_id`);--> statement-breakpoint
CREATE INDEX `subtitle_tracks_node_id_idx` ON `subtitle_tracks` (`node_id`);