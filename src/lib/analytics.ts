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
  count: number;
}

export interface PersonalRecord {
  name: string;
  weight_lbs: number;
}

const TYPE_COLORS: Record<string, string> = {
  strength: "#3b82f6",
  cardio: "#ef4444",
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

export function getVolumeByDay(exercises: ExerciseRow[]): VolumeDataPoint[] {
  const byDay = new Map<string, number>();
  for (const ex of exercises) {
    if (ex.weight_kg == null || ex.reps == null) continue;
    const day = new Date(ex.timestamp).toLocaleDateString("en-CA");
    byDay.set(day, (byDay.get(day) ?? 0) + ex.weight_kg * KG_TO_LBS * ex.reps);
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
  const counts = new Map<string, number>();
  for (const ex of exercises) {
    const type = defMap[(ex.exercise_name ?? "").toLowerCase()] ?? "strength";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count, color: TYPE_COLORS[type] ?? "#888" }));
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

export function getTopExercises(
  exercises: ExerciseRow[],
  definitions: { id: string; name: string; type: string }[]
): TopExercise[] {
  const defMap = Object.fromEntries(definitions.map((d) => [d.name.toLowerCase(), d]));
  const counts = new Map<string, { name: string; type: string; count: number }>();
  for (const ex of exercises) {
    const name = ex.exercise_name ?? "";
    const key = name.toLowerCase();
    const def = defMap[key];
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { name: def?.name ?? name, type: def?.type ?? "strength", count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export function getPersonalRecords(exercises: ExerciseRow[]): PersonalRecord[] {
  const maxWithName = new Map<string, { name: string; weight_lbs: number }>();
  for (const ex of exercises) {
    if (ex.weight_kg == null) continue;
    const lbs = ex.weight_kg * KG_TO_LBS;
    const key = (ex.exercise_name ?? "").toLowerCase();
    if (!key) continue;
    const existing = maxWithName.get(key);
    if (!existing || lbs > existing.weight_lbs) {
      maxWithName.set(key, { name: ex.exercise_name ?? key, weight_lbs: lbs });
    }
  }
  return [...maxWithName.values()]
    .sort((a, b) => b.weight_lbs - a.weight_lbs)
    .slice(0, 10);
}

export function filterByRange(exercises: ExerciseRow[], range: "week" | "month" | "year" | "all"): ExerciseRow[] {
  if (range === "all") return exercises;
  const now = Date.now();
  const ms = { week: 7, month: 30, year: 365 }[range] * 86400_000;
  return exercises.filter((e) => new Date(e.timestamp).getTime() >= now - ms);
}
