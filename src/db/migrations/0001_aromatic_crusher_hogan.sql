CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`meal_type` text,
	`description` text NOT NULL,
	`calories` integer NOT NULL,
	`timestamp` text NOT NULL
);
