export interface ExerciseRow {
  id: string;
  timestamp: string;
  exercise_definition_id: string;
  exercise_name: string;
  reps: number | null;
  weight_kg: number | null;
  distance_m: number | null;
  duration_s: number | null;
  notes: string | null;
  session_id: string | null;
}

export interface WorkoutSession {
  id: string;
  startTime: Date;
  endTime: Date;
  exercises: ExerciseRow[];
}

export function groupIntoSessions(
  exercises: ExerciseRow[],
  gapSeconds = 10800
): WorkoutSession[] {
  if (exercises.length === 0) return [];

  const sorted = [...exercises].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const sessions: WorkoutSession[] = [];
  let current: ExerciseRow[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].timestamp).getTime();
    const curr = new Date(sorted[i].timestamp).getTime();
    const gapMs = gapSeconds * 1000;

    if (curr - prev > gapMs) {
      sessions.push(toSession(current));
      current = [sorted[i]];
    } else {
      current.push(sorted[i]);
    }
  }
  sessions.push(toSession(current));

  return sessions.reverse();
}

function toSession(exercises: ExerciseRow[]): WorkoutSession {
  const times = exercises.map((e) => new Date(e.timestamp).getTime());
  return {
    id: exercises[0].session_id ?? exercises[0].id,
    startTime: new Date(Math.min(...times)),
    endTime: new Date(Math.max(...times)),
    exercises,
  };
}
