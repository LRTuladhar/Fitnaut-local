CREATE TABLE `exercise_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`alternate_names` text DEFAULT '[]' NOT NULL,
	`type` text NOT NULL,
	`muscle_groups` text DEFAULT '[]' NOT NULL,
	`category` text NOT NULL,
	`expected_parameters` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`timestamp` text NOT NULL,
	`exercise_definition_id` text NOT NULL,
	`exercise_name` text DEFAULT '' NOT NULL,
	`reps` integer,
	`weight_kg` real,
	`distance_m` real,
	`duration_s` real,
	`notes` text,
	`session_id` text
);
--> statement-breakpoint
CREATE TABLE `health_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`weight_kg` real,
	`heart_rate` integer,
	`systolic_bp` integer,
	`diastolic_bp` integer,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `health_metrics_user_date_idx` ON `health_metrics` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `user_api_keys` (
	`user_id` text PRIMARY KEY NOT NULL,
	`openrouter_key_encrypted` text,
	`anthropic_key_encrypted` text
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`weight_unit` text DEFAULT 'lbs' NOT NULL,
	`distance_unit` text DEFAULT 'mi' NOT NULL,
	`session_gap_seconds` integer DEFAULT 10800 NOT NULL,
	`default_time_range` text DEFAULT 'month' NOT NULL,
	`ai_provider` text DEFAULT 'openrouter' NOT NULL,
	`openrouter_model` text
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text,
	`year_of_birth` integer,
	`gender` text,
	`fitness_goals` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`notes` text
);
