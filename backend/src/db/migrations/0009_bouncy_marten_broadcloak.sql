ALTER TABLE `libraries` ADD `scan_status` text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `libraries` ADD `scan_started_at` text;--> statement-breakpoint
ALTER TABLE `libraries` ADD `scan_error` text;--> statement-breakpoint
ALTER TABLE `libraries` ADD `last_scan_summary` text;