CREATE TABLE `certificate_issuances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`user_id` integer NOT NULL,
	`course_id` integer NOT NULL,
	`recipient_name` text NOT NULL,
	`course_title` text NOT NULL,
	`completed_at` text NOT NULL,
	`issued_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`signature` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificate_issuances_code_unique` ON `certificate_issuances` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `certificate_issuances_user_course_unique` ON `certificate_issuances` (`user_id`,`course_id`);