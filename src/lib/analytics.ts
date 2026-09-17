import { groupIntoSessions, type ExerciseRow } from "./sessionGrouping";
import { KG_TO_LBS } from "./units";

export interface VolumeDataPoint {
  date: string;
  volume: number;
}

export interface TypeDistribution {
  type: string;
  count: number;
  color: string;
}

export interface MuscleGroupData {
  group: string;
  count: number;
}

export interface TopExercise {
  name: string;
  type: string;
  count: number; // distinct workout days (frequency)
  sets: number; // total sets logged
}

export interface PersonalRecord {
  name: string;
  weight_lbs: number;
  count: number; // total sets
  days: number; // distinct workout days (frequency)
}

export interface BodyPartDef {
  id: string;
  label: string;
  abbr?: string;
  side: "front" | "back" | "both";
}

export const BODY_PARTS: BodyPartDef[] = [
  { id: "chest", label: "Chest", side: "front" },
  { id: "abs", label: "Abs", side: "front" },
  { id: "shoulders", label: "Shoulders", abbr: "Shldr", side: "both" },
  { id: "biceps", label: "Biceps", abbr: "Bicep", side: "front" },
  { id: "triceps", label: "Triceps", abbr: "Tricep", side: "back" },
  { id: "back", label: "Back", side: "back" },
  { id: "glutes", label: "Glutes", abbr: "Glute", side: "back" },
  { id: "quads", label: "Quads", abbr: "Quad", side: "front" },
  { id: "hamstrings", label: "Hamstrings", abbr: "Hams", side: "back" },
  { id: "calves", label: "Calves", abbr: "Calf", side: "back" },
  { id: "forearms", label: "Forearms", abbr: "Frm", side: "both" },
];

const TYPE_COLORS: Record<string, string> = {
  strength: "#3b82f6",
  cardio: "#f59e0b",
  flexibility: "#a855f7",
  sports: "#22c55e",
};

export function getWorkoutDays(exercises: ExerciseRow[], gapSeconds = 10800): Date[] {
  const sessions = groupIntoSessions(exercises, gapSeconds);
  return sessions.map((s) => {
    const d = new Date(s.startTime);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

export interface VolumeDefinition {
  name: string;
  alternate_names?: string[];
  /** 2 = dumbbell (logged weight is per hand / per side); 1 = total load. */
  load_multiplier?: number;
  /** Fraction of bodyweight that counts as load for reps-based bodyweight movements. */
  bodyweight_factor?: number;
}

export interface VolumeOptions {
  definitions?: VolumeDefinition[];
  /** Latest bodyweight in lbs — loads bodyweight movements (Pull-up, Crunch, HLR…). */
  bodyweightLbs?: number;
}

/**
 * Volume (lbs) per day = Σ over sets of (load × reps).
 *  - Barbell / machine / cable: load = logged weight (already the total).
 *  - Dumbbell movements (load_multiplier 2): logged weight is PER HAND → ×2.
 *  - Bodyweight movements (bodyweight_factor): load = bodyweight × factor.
 *  - Isometric (plank, side plank), band work and distance/cardio work: 0
 *    (either no reps logged, or no bodyweight factor defined).
 */
export function getVolumeByDay(
  exercises: ExerciseRow[],
  options: VolumeOptions = {}
): VolumeDataPoint[] {
  const { definitions = [], bodyweightLbs = 0 } = options;

  const defMap = new Map<string, VolumeDefinition>();
  for (const def of definitions) {
    defMap.set(def.name.toLowerCase(), def);
    for (const alt of def.alternate_names ?? []) defMap.set(alt.toLowerCase(), def);
  }

  const byDay = new Map<string, number>();
  for (const ex of exercises) {
    if (ex.reps == null) continue;
    const def = defMap.get((ex.exercise_name ?? "").toLowerCase());
    let loadLbs: number | null = null;
    if (ex.weight_kg != null) {
      loadLbs = ex.weight_kg * KG_TO_LBS * (def?.load_multiplier ?? 1);
    } else if (def?.bodyweight_factor) {
      loadLbs = bodyweightLbs * def.bodyweight_factor;
    }
    if (loadLbs == null || loadLbs <= 0) continue;
    const day = new Date(ex.timestamp).toLocaleDateString("en-CA");
    byDay.set(day, (byDay.get(day) ?? 0) + loadLbs * ex.reps);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, volume]) => ({ date, volume: Math.round(volume) }));
}

export function getTypeDistribution(
  exercises: ExerciseRow[],
  definitions: { id: string; name: string; type: string }[]
): TypeDistribution[] {
  const defMap = Object.fromEntries(definitions.map((d) => [d.name.toLowerCase(), d.type]));
  // Count DISTINCT workout days per type (not sets).
  const days = new Map<string, Set<string>>();
  for (const ex of exercises) {
    const type = defMap[(ex.exercise_name ?? "").toLowerCase()] ?? "strength";
    const d = new Date(ex.timestamp);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!days.has(type)) days.set(type, new Set());
    days.get(type)!.add(dayKey);
  }
  return [...days.entries()]
    .map(([type, set]) => ({ type, count: set.size, color: TYPE_COLORS[type] ?? "#888" }))
    .sort((a, b) => b.count - a.count);
}

export function getMuscleGroupActivity(
  exercises: ExerciseRow[],
  definitions: { id: string; name: string; muscle_groups: string[] }[]
): MuscleGroupData[] {
  const defMap = Object.fromEntries(definitions.map((d) => [d.name.toLowerCase(), d.muscle_groups ?? []]));
  const counts = new Map<string, number>();
  for (const ex of exercises) {
    for (const group of defMap[(ex.exercise_name ?? "").toLowerCase()] ?? []) {
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([group, count]) => ({ group, count }));
}

export function getBodyPartsByDay(
  exercises: ExerciseRow[],
  definitions: { id: string; name: string; type: string; body_parts?: string[] }[]
): Map<string, Set<string>> {
  const defMap = new Map(definitions.map((d) => [d.name.toLowerCase(), d]));
  const map = new Map<string, Set<string>>();
  for (const ex of exercises) {
    const def = defMap.get((ex.exercise_name ?? "").toLowerCase());
    if (!def || def.type !== "strength") continue;
    const parts = def.body_parts ?? [];
    if (parts.length === 0) continue;
    const d = new Date(ex.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, new Set());
    const set = map.get(key)!;
    for (const part of parts) set.add(part);
  }
  return map;
}

export function getTopExercises(
  exercises: ExerciseRow[],
  definitions: { id: string; name: string; type: string }[]
): TopExercise[] {
  const defMap = Object.fromEntries(definitions.map((d) => [d.name.toLowerCase(), d]));
  // Track DISTINCT workout days (frequency) AND total sets per exercise.
  const stats = new Map<string, { name: string; type: string; days: Set<string>; sets: number }>();
  for (const ex of exercises) {
    const name = ex.exercise_name ?? "";
    if (!name) continue;
    const key = name.toLowerCase();
    const def = defMap[key];
    const d = new Date(ex.timestamp);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = stats.get(key);
    if (entry) {
      entry.days.add(dayKey);
      entry.sets += 1;
    } else {
      stats.set(key, { name: def?.name ?? name, type: def?.type ?? "strength", days: new Set([dayKey]), sets: 1 });
    }
  }
  return [...stats.values()]
    .map((e) => ({ name: e.name, type: e.type, count: e.days.size, sets: e.sets }))
    .sort((a, b) => b.count - a.count);
}

export function getPersonalRecords(exercises: ExerciseRow[]): PersonalRecord[] {
  const map = new Map<string, { name: string; weight_lbs: number; count: number; days: Set<string> }>();
  for (const ex of exercises) {
    const key = (ex.exercise_name ?? "").toLowerCase();
    if (!key) continue;
    const d = new Date(ex.timestamp);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = map.get(key);
    if (!entry) {
      map.set(key, {
        name: ex.exercise_name ?? key,
        weight_lbs: ex.weight_kg != null ? ex.weight_kg * KG_TO_LBS : 0,
        count: 1,
        days: new Set([dayKey]),
      });
    } else {
      entry.count += 1;
      entry.days.add(dayKey);
      if (ex.weight_kg != null) {
        const lbs = ex.weight_kg * KG_TO_LBS;
        if (lbs > entry.weight_lbs) entry.weight_lbs = lbs;
      }
    }
  }
  return [...map.values()]
    .filter((e) => e.weight_lbs > 0)
    .map((e) => ({ name: e.name, weight_lbs: e.weight_lbs, count: e.count, days: e.days.size }))
    .sort((a, b) => b.days - a.days || b.weight_lbs - a.weight_lbs)
    .slice(0, 10);
}

export function filterByRange(exercises: ExerciseRow[], range: "week" | "month" | "year" | "all"): ExerciseRow[] {
  if (range === "all") return exercises;
  const now = Date.now();
  const ms = { week: 7, month: 30, year: 365 }[range] * 86400_000;
  return exercises.filter((e) => new Date(e.timestamp).getTime() >= now - ms);
}
