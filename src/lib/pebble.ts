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

export type SleepSource = "events" | "watch";

export interface SleepNight {
  dateUtc: number; // unix epoch seconds of LOCAL midnight on the wake-up day
  date: string; // "YYYY-MM-DD" local — the morning you woke up on
  totalSeconds: number; // ASLEEP seconds (phase-based when phases exist)
  deepSeconds: number; // deep / restful seconds
  source: SleepSource; // "events" = built from activity_phases, "watch" = firmware fallback
  inBedSeconds: number | null; // first sleep-phase start → last sleep-phase end
  awakeSeconds: number | null; // inBedSeconds − totalSeconds
  watchTotalSeconds: number | null; // firmware aggregate, kept for comparison
}

// ── How nights are built ────────────────────────────────────────────────────
// The watch reports two independent things:
//   1. activity_phases — an event stream of `sleep` / `restful_sleep` spans.
//   2. daily_summary.sleep_seconds — a firmware aggregate summed over a UTC day,
//      which locally is a 17:00→17:00 window (the firmware floors day starts to
//      UTC midnight), not a night. It has credited 2h+ of sleep that minute-level
//      step data contradicts, so it is NOT the source of truth.
// Nights are therefore built from the phase stream, in LOCAL time:
//   · a phase starting at/after 20:00 belongs to the next day's night
//   · a phase starting before 12:00 belongs to that day's night
//   · anything starting 12:00–20:00 is a nap and is ignored
//   · awake = in-bed span − asleep, so mid-night wakings (26 min or 2h+) stay visible
// A night with no phases at all falls back to the firmware aggregate, marked
// source: "watch" so callers can render it as less trustworthy.
const NIGHT_START_HOUR = 20; // local
const NIGHT_END_HOUR = 12; // local

function localDateKey(ts: number, dayShift = 0): string {
  const d = new Date(ts * 1000);
  d.setDate(d.getDate() + dayShift);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function localMidnightEpoch(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(new Date(y, m - 1, d, 0, 0, 0).getTime() / 1000);
}

function nightKeyFor(ts: number): string | null {
  const hour = new Date(ts * 1000).getHours();
  if (hour >= NIGHT_START_HOUR) return localDateKey(ts, 1);
  if (hour < NIGHT_END_HOUR) return localDateKey(ts);
  return null; // afternoon nap
}

interface FirmwareDay {
  date: string; // "YYYY-MM-DD" UTC — also the wake-up day the row is labeled with
  sleep: number;
  restful: number;
  endUtc: number; // the row covers [date_utc, date_utc + 86400)
}

function getFirmwareDays(): Map<string, FirmwareDay> {
  const rows = getPebbleDb()
    .prepare(
      `SELECT date_utc, sleep_seconds, restful_sleep_seconds
       FROM daily_summary
       ORDER BY date_utc ASC`
    )
    .all() as {
    date_utc: number;
    sleep_seconds: number | null;
    restful_sleep_seconds: number | null;
  }[];

  const map = new Map<string, FirmwareDay>();
  for (const r of rows) {
    const date = new Date(r.date_utc * 1000).toISOString().slice(0, 10);
    map.set(date, {
      date,
      sleep: r.sleep_seconds ?? 0,
      restful: r.restful_sleep_seconds ?? 0,
      endUtc: r.date_utc + 86400,
    });
  }
  return map;
}

export function getSleepTimeline(): SleepNight[] {
  const phases = getPebbleDb()
    .prepare(
      `SELECT activity, time_start_utc, time_end_utc
       FROM activity_phases
       WHERE activity IN ('sleep', 'restful_sleep')
       ORDER BY time_start_utc ASC`
    )
    .all() as { activity: string; time_start_utc: number; time_end_utc: number }[];

  const byNight = new Map<string, { sleep: number[][]; rest: number[][] }>();
  for (const p of phases) {
    const key = nightKeyFor(p.time_start_utc);
    if (!key) continue;
    const bucket = byNight.get(key) ?? { sleep: [], rest: [] };
    if (p.activity === "sleep") bucket.sleep.push([p.time_start_utc, p.time_end_utc]);
    else bucket.rest.push([p.time_start_utc, p.time_end_utc]);
    byNight.set(key, bucket);
  }

  const firmware = getFirmwareDays();
  const consumedFirmware = new Set<string>();
  const nights: SleepNight[] = [];

  for (const [date, bucket] of byNight) {
    if (bucket.sleep.length === 0) continue;
    const start = Math.min(...bucket.sleep.map(([s]) => s));
    const end = Math.max(...bucket.sleep.map(([, e]) => e));
    const asleep = bucket.sleep.reduce((t, [s, e]) => t + (e - s), 0);
    const inBed = end - start;
    const deep = bucket.rest.reduce(
      (t, [s, e]) => (s >= start && e <= end ? t + (e - s) : t),
      0
    );
    // Firmware row covering the night's start (UTC day) — comparison only.
    const utcKey = new Date(start * 1000).toISOString().slice(0, 10);
    const fw = firmware.get(utcKey);
    if (fw) consumedFirmware.add(utcKey);
    nights.push({
      dateUtc: localMidnightEpoch(date),
      date,
      totalSeconds: Math.round(asleep),
      deepSeconds: Math.round(deep),
      source: "events",
      inBedSeconds: Math.round(inBed),
      awakeSeconds: Math.round(Math.max(0, inBed - asleep)),
      watchTotalSeconds: fw ? fw.sleep : null,
    });
  }

  // Nights with no phases at all → firmware aggregate, labeled as such. Rows
  // whose UTC day is still running locally are partial, so they're skipped.
  const nowUtc = Math.floor(Date.now() / 1000);
  for (const [utcKey, fw] of firmware) {
    if (consumedFirmware.has(utcKey) || fw.sleep <= 0 || fw.endUtc > nowUtc) continue;
    nights.push({
      dateUtc: localMidnightEpoch(utcKey),
      date: utcKey,
      totalSeconds: fw.sleep,
      deepSeconds: fw.restful,
      source: "watch",
      inBedSeconds: null,
      awakeSeconds: null,
      watchTotalSeconds: fw.sleep,
    });
  }

  return nights.sort((a, b) => a.dateUtc - b.dateUtc);
}

export interface SleepDetailDay extends SleepNight {
  // Time in bed = first `sleep` phase start → last `sleep` phase end for the night.
  // Null when the watch hasn't synced any sleep phase for that night.
  phaseSeconds: number | null;
}

export function getSleepDetail(): SleepDetailDay[] {
  return getSleepTimeline().map((n) => ({
    ...n,
    phaseSeconds: n.inBedSeconds,
  }));
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
