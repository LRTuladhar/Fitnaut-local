import { readFileSync } from "fs";
import { join } from "path";
import type { ExerciseDefinition } from "./exerciseParser";

let cached: any = null;

/**
 * Load the canonical exercise library (public/exercise-library.json), mapped to
 * the same { id, name, alternate_names, ... } shape the frontend uses.
 * id = name.toLowerCase().replace(/\s+/g, "-").
 */
export function loadExerciseLibrary(): ExerciseDefinition[] {
  if (!cached) {
    const raw = readFileSync(join(process.cwd(), "public/exercise-library.json"), "utf-8");
    cached = JSON.parse(raw).exercises.map((e: any) => ({
      id: (e.name as string).toLowerCase().replace(/\s+/g, "-"),
      name: e.name,
      alternate_names: e.alternateNames ?? [],
      type: e.type,
      muscle_groups: e.muscleGroups ?? [],
      body_parts: e.bodyParts ?? [],
      category: e.category ?? "",
      expected_parameters: e.expectedParameters ?? [],
      load_multiplier: e.loadMultiplier ?? 1,
      bodyweight_factor: e.bodyweightFactor,
    }));
  }
  return cached;
}

/**
 * Resolve a user-supplied exercise name to its canonical { id, name } via an
 * EXACT case-insensitive match against the library's canonical names and
 * alternate_names. Deliberately NOT fuzzy: the write path must never guess —
 * the parser/voice layer resolves typos upstream, and fuzzy matching here would
 * silently log garbage (e.g. "a" -> "Squat").
 */
export function canonicalizeExerciseName(name: string): { id: string; name: string } | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  for (const def of loadExerciseLibrary()) {
    if (def.name.toLowerCase() === key) return { id: def.id, name: def.name };
    for (const alt of def.alternate_names ?? []) {
      if (alt.toLowerCase() === key) return { id: def.id, name: def.name };
    }
  }
  return null;
}
