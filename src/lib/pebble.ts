import Database from "better-sqlite3";
import os from "os";
import path from "path";

// Pebble health data lives in a SEPARATE SQLite file (WAL mode) written by the
// watch importer (~/Projects/Pebble/server/server.py). Fitnaut opens it
// read-only so the two apps can share the file safely. Override the path with
// PEBBLE_DB_PATH if it moves.
function resolvePebbleDbPath(): string {
  const p =
    process.env.PEBBLE_DB_PATH ??
    path.join(os.homedir(), "Projects", "Pebble", "data", "health.db");
  return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

let _db: Database.Database | null = null;

// Lazily open a single read-only connection (mirrors src/db/index.ts's
// singleton pattern). fileMustExist ensures we fail cleanly if the importer
// hasn't created the DB yet rather than silently creating an empty one.
export function getPebbleDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(resolvePebbleDbPath(), {
    readonly: true,
    fileMustExist: true,
  });
  return _db;
}

export interface HeartRatePoint {
  t: number; // unix epoch seconds (UTC)
  hr: number; // bpm
}

// Minute-level heart rate readings within the last `hours` hours (sparse —
// the watch only samples HR intermittently, so gaps are normal).
export function getHeartRate(hours: number): HeartRatePoint[] {
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  return getPebbleDb()
    .prepare(
      `SELECT timestamp_utc AS t, heart_rate_bpm AS hr
       FROM minute_data
       WHERE heart_rate_bpm IS NOT NULL AND timestamp_utc >= ?
       ORDER BY timestamp_utc ASC`
    )
    .all(since) as HeartRatePoint[];
}

export interface SleepNight {
  dateUtc: number; // unix epoch seconds of UTC midnight
  date: string; // "YYYY-MM-DD" in UTC == the wake-up morning in PDT
  totalSeconds: number; // sleep_seconds
  deepSeconds: number; // restful_sleep_seconds
}

export function getSleepTimeline(): SleepNight[] {
  const rows = getPebbleDb()
    .prepare(
      `SELECT date_utc, sleep_seconds, restful_sleep_seconds
       FROM daily_summary
       ORDER BY date_utc ASC`
    )
    .all() as {
    date_utc: number;
    sleep_seconds: number;
    restful_sleep_seconds: number;
  }[];

  return rows.map((r) => ({
    dateUtc: r.date_utc,
    date: new Date(r.date_utc * 1000).toISOString().slice(0, 10),
    totalSeconds: r.sleep_seconds ?? 0,
    deepSeconds: r.restful_sleep_seconds ?? 0,
  }));
}

export interface SleepDetailDay extends SleepNight {
  // Time-in-bed (sum of detected `sleep` phase durations for that day).
  // Derived awake = phaseSeconds - totalSeconds. Null when the watch hasn't
  // synced any sleep phase for that day (older days only have daily_summary).
  phaseSeconds: number | null;
  awakeSeconds: number | null;
}

export function getSleepDetail(): SleepDetailDay[] {
  const timeline = getSleepTimeline();
  const phases = getPebbleDb()
    .prepare(
      `SELECT time_start_utc, time_end_utc
       FROM activity_phases
       WHERE activity = 'sleep'
       ORDER BY time_start_utc ASC`
    )
    .all() as { time_start_utc: number; time_end_utc: number }[];

  // Map each sleep phase to the UTC day its start falls in. For a normal
  // overnight sleep in PDT this equals the wake-up morning (same day the
  // daily_summary row is keyed to).
  const phaseByDay = new Map<string, number>();
  for (const p of phases) {
    const day = new Date(p.time_start_utc * 1000).toISOString().slice(0, 10);
    const dur = p.time_end_utc - p.time_start_utc;
    phaseByDay.set(day, (phaseByDay.get(day) ?? 0) + dur);
  }

  return timeline.map((n) => {
    const phaseSeconds = phaseByDay.get(n.date) ?? null;
    const awakeSeconds =
      phaseSeconds != null ? Math.max(0, phaseSeconds - n.totalSeconds) : null;
    return { ...n, phaseSeconds, awakeSeconds };
  });
}

export interface HourlySleep {
  t: number; // hour start, unix epoch seconds (UTC)
  asleepSeconds: number; // seconds inside a `sleep` phase during this hour
  deepSeconds: number; // seconds inside `restful_sleep` phases during this hour
}

// Hourly sleep breakdown for the last `hours` hours (anchored to the latest
// activity phase, so the right edge is the most recent sleep). The watch only
// retains ~2 nights of sleep phases, so most of a longer window is empty — the
// caller renders the full window so the 24h view can scroll back through what
// actually exists.
export function getSleepHourly(hours = 168): HourlySleep[] {
  const db = getPebbleDb();
  const lastEnd = db
    .prepare("SELECT MAX(time_end_utc) AS e FROM activity_phases")
    .get() as { e: number | null };
  const to = lastEnd?.e ?? Math.floor(Date.now() / 1000);
  const from = to - hours * 3600;

  const phases = db
    .prepare(
      `SELECT activity, time_start_utc, time_end_utc
       FROM activity_phases
       WHERE activity IN ('sleep', 'restful_sleep')
         AND time_end_utc > ? AND time_start_utc < ?
       ORDER BY time_start_utc ASC`
    )
    .all(from, to) as {
    activity: string;
    time_start_utc: number;
    time_end_utc: number;
  }[];

  const buckets = new Map<number, { asleep: number; deep: number }>();
  const startHour = Math.floor(from / 3600) * 3600;
  for (let h = startHour; h < to; h += 3600) {
    buckets.set(h, { asleep: 0, deep: 0 });
  }

  for (const p of phases) {
    const s = Math.max(p.time_start_utc, from);
    const e = Math.min(p.time_end_utc, to);
    for (let h = Math.floor(s / 3600) * 3600; h < e; h += 3600) {
      const b = buckets.get(h);
      if (!b) continue;
      const secs = Math.min(e, h + 3600) - Math.max(s, h);
      if (secs <= 0) continue;
      if (p.activity === "sleep") b.asleep += secs;
      else b.deep += secs;
    }
  }

  return [...buckets.entries()]
    .map(([t, b]) => ({ t, asleepSeconds: b.asleep, deepSeconds: b.deep }))
    .sort((a, b) => a.t - b.t);
}

export interface DailySteps {
  dateUtc: number; // unix epoch seconds of UTC midnight
  date: string; // "YYYY-MM-DD" in UTC
  steps: number;
}

// Total steps per UTC day, straight from daily_summary (the watch already sums
// per-minute steps into a daily total). Ordered oldest → newest.
export function getDailySteps(): DailySteps[] {
  const rows = getPebbleDb()
    .prepare(
      `SELECT date_utc, steps
       FROM daily_summary
       WHERE steps IS NOT NULL
       ORDER BY date_utc ASC`
    )
    .all() as { date_utc: number; steps: number }[];

  return rows.map((r) => ({
    dateUtc: r.date_utc,
    date: new Date(r.date_utc * 1000).toISOString().slice(0, 10),
    steps: r.steps ?? 0,
  }));
}
