CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`actor_user_id` text,
	`target_type` text,
	`target_id` text,
	`message` text NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activity_log_created_at_idx` ON `activity_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `activity_log_actor_user_id_idx` ON `activity_log` (`actor_user_id`);