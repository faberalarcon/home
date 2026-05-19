CREATE TABLE `gooby_embeddings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`text` text NOT NULL,
	`vector` blob NOT NULL,
	`dim` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_gooby_embeddings_source` ON `gooby_embeddings` (`source_type`,`source_id`);
