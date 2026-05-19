CREATE TABLE `daily_briefs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`narrative` text NOT NULL,
	`payload` text NOT NULL,
	`model` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_briefs_date_unique` ON `daily_briefs` (`date`);
