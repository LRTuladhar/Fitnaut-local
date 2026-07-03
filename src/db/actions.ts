"use server";

import { eq, gte, lte, and, desc, asc } from "drizzle-orm";
import db from "./index";
import * as schema from "./schema";

// ─── Exercises ────────────────────────────────────────────────────────────────

export async function getExercises(
  userId: string,
  opts?: { from?: string; to?: string; limit?: number; order?: "asc" | "desc" }
) {
  const conditions = [eq(schema.exercises.user_id, userId)];
  if (opts?.from) conditions.push(gte(schema.exercises.timestamp, opts.from));
  if (opts?.to) conditions.push(lte(schema.exercises.timestamp, opts.to));

  const query = db
    .select()
    .from(schema.exercises)
    .where(and(...conditions))
    .orderBy(
      opts?.order === "asc"
        ? asc(schema.exercises.timestamp)
        : desc(schema.exercises.timestamp)
    );

  if (opts?.limit) query.limit(opts.limit);

  return query.all();
}

export async function getTodaysExercises(userId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return getExercises(userId, { from: start.toISOString(), order: "desc" });
}

export async function insertExercise(input: {
  userId: string;
  exerciseDefinitionId: string;
  exerciseName: string;
  reps?: number | null;
  weightKg?: number | null;
  distanceM?: number | null;
  durationS?: number | null;
  notes?: string | null;
  timestamp?: string;
}) {
  const result = db
    .insert(schema.exercises)
    .values({
      id: crypto.randomUUID(),
      user_id: input.userId,
      timestamp: input.timestamp ?? new Date().toISOString(),
      exercise_definition_id: input.exerciseDefinitionId,
      exercise_name: input.exerciseName,
      reps: input.reps ?? null,
      weight_kg: input.weightKg ?? null,
      distance_m: input.distanceM ?? null,
      duration_s: input.durationS ?? null,
      notes: input.notes ?? null,
    })
    .returning()
    .get();

  return result;
}

export async function updateExercise(
  id: string,
  fields: {
    reps?: number | null;
    weight_kg?: number | null;
    distance_m?: number | null;
    duration_s?: number | null;
    notes?: string | null;
  }
) {
  db.update(schema.exercises).set(fields).where(eq(schema.exercises.id, id)).run();
}

export async function deleteExercise(id: string) {
  db.delete(schema.exercises).where(eq(schema.exercises.id, id)).run();
}

export async function getLastExerciseSet(userId: string, exerciseName: string) {
  return db
    .select({
      reps: schema.exercises.reps,
      weight_kg: schema.exercises.weight_kg,
      distance_m: schema.exercises.distance_m,
      duration_s: schema.exercises.duration_s,
    })
    .from(schema.exercises)
    .where(
      and(
        eq(schema.exercises.user_id, userId),
        eq(schema.exercises.exercise_name, exerciseName)
      )
    )
    .orderBy(desc(schema.exercises.timestamp))
    .limit(1)
    .get() ?? null;
}

export async function getRecentExercises(userId: string) {
  return db
    .select({
      exercise_definition_id: schema.exercises.exercise_definition_id,
      timestamp: schema.exercises.timestamp,
    })
    .from(schema.exercises)
    .where(eq(schema.exercises.user_id, userId))
    .orderBy(desc(schema.exercises.timestamp))
    .limit(100)
    .all();
}

// ─── Health Metrics ───────────────────────────────────────────────────────────

export async function getHealthMetrics(userId: string) {
  return db
    .select()
    .from(schema.healthMetrics)
    .where(eq(schema.healthMetrics.user_id, userId))
    .orderBy(desc(schema.healthMetrics.date))
    .all();
}

export async function upsertHealthMetric(input: {
  userId: string;
  date: string;
  weightKg?: number | null;
  heartRate?: number | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  notes?: string | null;
}) {
  const existing = db
    .select({ id: schema.healthMetrics.id })
    .from(schema.healthMetrics)
    .where(
      and(
        eq(schema.healthMetrics.user_id, input.userId),
        eq(schema.healthMetrics.date, input.date)
      )
    )
    .get();

  if (existing) {
    db.update(schema.healthMetrics)
      .set({
        weight_kg: input.weightKg ?? undefined,
        heart_rate: input.heartRate ?? undefined,
        systolic_bp: input.systolicBp ?? undefined,
        diastolic_bp: input.diastolicBp ?? undefined,
        notes: input.notes ?? undefined,
      })
      .where(eq(schema.healthMetrics.id, existing.id))
      .run();
  } else {
    db.insert(schema.healthMetrics)
      .values({
        id: crypto.randomUUID(),
        user_id: input.userId,
        date: input.date,
        weight_kg: input.weightKg ?? null,
        heart_rate: input.heartRate ?? null,
        systolic_bp: input.systolicBp ?? null,
        diastolic_bp: input.diastolicBp ?? null,
        notes: input.notes ?? null,
      })
      .run();
  }
}

export async function deleteHealthMetric(id: string) {
  db.delete(schema.healthMetrics).where(eq(schema.healthMetrics.id, id)).run();
}

// ─── User Profile & Preferences ───────────────────────────────────────────────

export async function getUserProfile(userId: string) {
  return db
    .select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.user_id, userId))
    .get() ?? null;
}

export async function getUserPreferences(userId: string) {
  return db
    .select()
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.user_id, userId))
    .get() ?? null;
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export async function getUserApiKey(userId: string) {
  return db
    .select()
    .from(schema.userApiKeys)
    .where(eq(schema.userApiKeys.user_id, userId))
    .get() ?? null;
}

export async function upsertUserApiKey(
  userId: string,
  provider: "openrouter" | "anthropic",
  key: string
) {
  const existing = db
    .select({ user_id: schema.userApiKeys.user_id })
    .from(schema.userApiKeys)
    .where(eq(schema.userApiKeys.user_id, userId))
    .get();

  if (provider === "anthropic") {
    if (existing) {
      db.update(schema.userApiKeys)
        .set({ anthropic_key_encrypted: key })
        .where(eq(schema.userApiKeys.user_id, userId))
        .run();
    } else {
      db.insert(schema.userApiKeys)
        .values({ user_id: userId, anthropic_key_encrypted: key })
        .run();
    }
  } else {
    if (existing) {
      db.update(schema.userApiKeys)
        .set({ openrouter_key_encrypted: key })
        .where(eq(schema.userApiKeys.user_id, userId))
        .run();
    } else {
      db.insert(schema.userApiKeys)
        .values({ user_id: userId, openrouter_key_encrypted: key })
        .run();
    }
  }
}

// ─── Exercise Definitions ─────────────────────────────────────────────────────

export async function getExerciseDefinitions() {
  return db.select().from(schema.exerciseDefinitions).all();
}
