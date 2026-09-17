CREATE TABLE `day_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`note` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_notes_user_date_idx` ON `day_notes` (`user_id`,`date`);