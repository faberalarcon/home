CREATE TABLE `pi_metrics_history` (
	`t` integer PRIMARY KEY NOT NULL,
	`cpu_pct` real,
	`mem_pct` real,
	`temp_c` real,
	`load1` real
);
--> statement-breakpoint
CREATE INDEX `pi_metrics_history_t_idx` ON `pi_metrics_history` (`t`);
