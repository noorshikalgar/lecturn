CREATE TABLE `daily_activity` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_activity_user_date_unique` ON `daily_activity` (`user_id`,`date`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `ended_at` text;