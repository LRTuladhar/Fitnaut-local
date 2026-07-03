import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const exerciseDefinitions = sqliteTable("exercise_definitions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  alternate_names: text("alternate_names").notNull().default("[]"),
  type: text("type").notNull(),
  muscle_groups: text("muscle_groups").notNull().default("[]"),
  category: text("category").notNull(),
  expected_parameters: text("expected_parameters").notNull().default("[]"),
});

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  timestamp: text("timestamp").notNull(),
  exercise_definition_id: text("exercise_definition_id").notNull(),
  exercise_name: text("exercise_name").notNull().default(""),
  reps: integer("reps"),
  weight_kg: real("weight_kg"),
  distance_m: real("distance_m"),
  duration_s: real("duration_s"),
  notes: text("notes"),
  session_id: text("session_id"),
});

export const workoutSessions = sqliteTable("workout_sessions", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  start_time: text("start_time").notNull(),
  end_time: text("end_time").notNull(),
  notes: text("notes"),
});

export const healthMetrics = sqliteTable(
  "health_metrics",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id").notNull(),
    date: text("date").notNull(),
    weight_kg: real("weight_kg"),
    heart_rate: integer("heart_rate"),
    systolic_bp: integer("systolic_bp"),
    diastolic_bp: integer("diastolic_bp"),
    notes: text("notes"),
  },
  (table) => [uniqueIndex("health_metrics_user_date_idx").on(table.user_id, table.date)]
);

export const userPreferences = sqliteTable("user_preferences", {
  user_id: text("user_id").primaryKey(),
  weight_unit: text("weight_unit").notNull().default("lbs"),
  distance_unit: text("distance_unit").notNull().default("mi"),
  session_gap_seconds: integer("session_gap_seconds").notNull().default(10800),
  default_time_range: text("default_time_range").notNull().default("month"),
  ai_provider: text("ai_provider").notNull().default("openrouter"),
  openrouter_model: text("openrouter_model"),
});

export const userProfiles = sqliteTable("user_profiles", {
  user_id: text("user_id").primaryKey(),
  name: text("name"),
  year_of_birth: integer("year_of_birth"),
  gender: text("gender"),
  fitness_goals: text("fitness_goals").notNull().default("[]"),
});

export const userApiKeys = sqliteTable("user_api_keys", {
  user_id: text("user_id").primaryKey(),
  openrouter_key_encrypted: text("openrouter_key_encrypted"),
  anthropic_key_encrypted: text("anthropic_key_encrypted"),
});
