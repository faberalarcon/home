ALTER TABLE `daily_briefs` ADD `updated_at` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `daily_briefs` SET `updated_at` = `created_at`;
