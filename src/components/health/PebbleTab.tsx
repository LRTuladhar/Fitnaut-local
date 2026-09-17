"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceArea, BarChart, Bar, Legend, ReferenceLine, Area,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useDayNotes } from "@/hooks/useDayNotes";
import { NoteMarkers } from "@/components/NoteMarkers";

// High-HR (exercise) highlight threshold, in bpm.
const HR_HIGHLIGHT_THRESHOLD = 100;
// Max gap (minutes) between high-HR readings still treated as one period.
const HR_RUN_MAX_GAP_MIN = 30;
// 7-DAY CHART ONLY: the solid HR line is drawn only where readings are
// continuous within an hour. A wider hole is drawn as an amber dashed bridge
// between the readings either side of it — including overnight absences (watch
// off / charging). Only an absence longer than HR_GAP_BRIDGE_MAX_MIN (24h, i.e.
// the watch wasn't worn for a whole day) stays plain whitespace.
const HR_GAP_BREAK_MIN = 60;
const HR_GAP_BRIDGE_MAX_MIN = 1440;
// The 30d view renders at ~2px/hour, where a 1h hole is sub-pixel: no bridges.
const HR_BRIDGE_MAX_HOURS = 168;
// Value drawn across a missing period (the dashed bridge). Gaps are sedentary /
// off-wrist stretches, so a flat resting-HR line reads better than interpolating
// between the readings either side. ASSUMED, not measured: the tooltip only ever
// reports real readings, and the section subtitle says what the dashes mean.
const HR_GAP_ASSUMED_BPM = 60;

type HrSeriesPoint = { t: number; hr: number };

type HrRange = { label: string; hours: number; pxPerHour: number };

const HR_RANGES: HrRange[] = [
  { label: "24h", hours: 24,   pxPerHour: 60 }, // minute-level, ~1440px
  { label: "7d",  hours: 168,  pxPerHour: 6  }, // hourly buckets, ~1008px
  { label: "30d", hours: 720,  pxPerHour: 2  }, // hourly buckets, ~1440px
];

type SleepRange = { label: string; value: "24h" | "7d" | "30d"; days: number; barWidth: number };

const SLEEP_RANGES: SleepRange[] = [
  { label: "24h", value: "24h", days: 1,  barWidth: 60 }, // hourly sleep bars (wide → horizontal scroll)
  { label: "7d",  value: "7d",  days: 7,  barWidth: 40 },
  { label: "30d", value: "30d", days: 30, barWidth: 40 },
];

// ── Steps chart ──────────────────────────────────────────────────────────────
// Revert toggle: flip to false to hide the entire Steps section.
const SHOW_STEPS_CHART = true;
// Daily step goal drawn as a dashed reference line.
const STEPS_GOAL = 7000;

type StepsRange = { label: string; value: "7d" | "30d" | "60d"; days: number; barWidth: number };

const STEPS_RANGES: StepsRange[] = [
  { label: "7d",  value: "7d",  days: 7,  barWidth: 48 },
  { label: "30d", value: "30d", days: 30, barWidth: 32 },
  { label: "60d", value: "60d", days: 60, barWidth: 20 },
];

type DailyStepsRow = { dateUtc: number; date: string; steps: number };

type HrPoint = { t: number; hr: number };
type SleepNight = { dateUtc: number; date: string; totalSeconds: number; deepSeconds: number };
type SleepDetailDay = SleepNight & { awakeSeconds: number | null };
type HourlySleep = { t: number; asleepSeconds: number; deepSeconds: number };

type PebbleData = {
  ok: boolean;
  error?: string;
  hours?: number;
  heartRate: HrPoint[];
  sleepTimeline: SleepNight[];
  sleepHourly: HourlySleep[];
  sleepDetail: SleepDetailDay[];
  dailySteps: DailyStepsRow[];
};

function fmtTime(ms: number, short: boolean) {
  const d = new Date(ms);
  // Midnight ticks double as day boundaries — show the date there.
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (!short) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// "YYYY-MM-DD" (UTC) -> "Sep 5". Sleep nights are labeled by wake-up morning.
function fmtNight(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// "YYYY-MM-DD" -> local-midnight epoch ms (for placing note markers on time axes).
function noteTs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

// epoch seconds -> "11 PM" (hour label for the hourly sleep view).
function fmtHour(t: number) {
  return new Date(t * 1000).toLocaleTimeString("en-US", { hour: "numeric" });
}

function hours(seconds: number) {
  return Math.round((seconds / 3600) * 10) / 10;
}

// Bucket sparse minute readings into hourly mean HR (for ranges > 24h).
function aggregateHourly(points: HrPoint[]): { t: number; hr: number }[] {
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const p of points) {
    const key = Math.floor(p.t / 3600) * 3600;
    const b = buckets.get(key) ?? { sum: 0, n: 0 };
    b.sum += p.hr;
    b.n += 1;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .map(([t, b]) => ({ t: t * 1000, hr: Math.round(b.sum / b.n) }))
    .sort((a, b) => a.t - b.t);
}

// Contiguous high-HR periods (in ms) for ReferenceArea shading.
function highHrRuns(points: { t: number; hr: number }[]): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  let cur: { start: number; end: number } | null = null;
  for (const p of points) {
    if (p.hr >= HR_HIGHLIGHT_THRESHOLD) {
      if (!cur) {
        cur = { start: p.t, end: p.t };
      } else if (p.t - cur.end <= HR_RUN_MAX_GAP_MIN * 60_000) {
        cur.end = p.t;
      } else {
        runs.push(cur);
        cur = { start: p.t, end: p.t };
      }
    }
  }
  if (cur) runs.push(cur);
  return runs;
}

// Splits the hourly HR series into contiguous solid segments plus one dashed
// "no data" bridge per gap, so recharts never fakes a measurement across a hole.
// Gaps are detected on the RAW minute readings (two adjacent hourly means can
// hide a >60 min hole), then mapped back to the hourly buckets either side.
function splitHrSeries(
  raw: HrSeriesPoint[],
  buckets: HrSeriesPoint[],
  gapMs = HR_GAP_BREAK_MIN * 60_000,
  maxBridgeMs = HR_GAP_BRIDGE_MAX_MIN * 60_000
): { segments: HrSeriesPoint[][]; bridges: [HrSeriesPoint, HrSeriesPoint][] } {
  const indexByHour = new Map<number, number>();
  buckets.forEach((b, i) => indexByHour.set(b.t, i));
  const idxForTs = (ms: number) =>
    indexByHour.get(Math.floor(ms / 3_600_000) * 3_600_000) ?? -1;

  const breaks = new Set<number>(); // segment break BEFORE bucket index i
  const bridgePairs: [number, number][] = [];

  for (let i = 1; i < raw.length; i++) {
    const dt = raw[i].t - raw[i - 1].t;
    if (dt <= gapMs) continue;
    const a = idxForTs(raw[i - 1].t);
    const b = idxForTs(raw[i].t);
    if (a < 0 || b < 0 || a >= b) continue; // same/absent bucket → nothing to split
    if (breaks.has(b)) continue; // one bridge per boundary
    breaks.add(b);
    if (dt <= maxBridgeMs) bridgePairs.push([a, b]);
  }

  const segments: HrSeriesPoint[][] = [];
  let current: HrSeriesPoint[] = [];
  buckets.forEach((p, i) => {
    if (i > 0 && breaks.has(i)) {
      segments.push(current);
      current = [];
    }
    current.push(p);
  });
  if (current.length) segments.push(current);

  return {
    segments,
    bridges: bridgePairs.map(([a, b]) => [buckets[a], buckets[b]] as [HrSeriesPoint, HrSeriesPoint]),
  };
}

// One row per hourly bucket, carrying only the series keys that touch it:
// `s{n}` = solid segment n, `b{n}` = dashed bridge n. `hr` stays the real mean
// so the tooltip never reports a bridged span as a reading; bridge keys carry
// the assumed resting value so the dash reads as a flat line.
function buildHrRows(
  buckets: HrSeriesPoint[],
  segments: HrSeriesPoint[][],
  bridges: [HrSeriesPoint, HrSeriesPoint][]
): Record<string, number | null>[] {
  const rows: Record<string, number | null>[] = buckets.map((b) => ({ t: b.t, hr: b.hr }));
  const rowIndex = new Map<number, number>();
  rows.forEach((r, i) => rowIndex.set(r.t as number, i));
  const put = (p: HrSeriesPoint, key: string, value: number) => {
    const i = rowIndex.get(p.t);
    if (i != null) rows[i][key] = value;
  };
  segments.forEach((seg, si) => seg.forEach((p) => put(p, `s${si}`, p.hr)));
  bridges.forEach((br, bi) => br.forEach((p) => put(p, `b${bi}`, HR_GAP_ASSUMED_BPM)));
  return rows;
}

// 24h Heart Rate visualization mode. "band" = smoothed rolling mean + a
// min/max ribbon (decluttered); "dots" = the original per-reading points.
// Flip this string to revert.
type Hr24hMode = "band" | "dots";
const HR_24H_MODE: Hr24hMode = "band";

// Rolling-window smoothing for the 24h HR band.
const HR_SMOOTH_WINDOW_MS = 15 * 60 * 1000; // ±15 min
const HR_SMOOTH_GAP_MS = 45 * 60 * 1000;    // break after 45 min with no reading
const HR_SMOOTH_MIN_POINTS = 3;             // ignore windows with fewer readings

type HrSmoothPoint = {
  t: number;
  mean: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
};

// Turns sparse minute readings into a smoothed {mean, min, max} series, with a
// null row where a gap > HR_SMOOTH_GAP_MS breaks the line/band — so overnight
// and sedentary stretches render as whitespace instead of a fake bridge.
function smoothHr(points: { t: number; hr: number }[]): HrSmoothPoint[] {
  const out: HrSmoothPoint[] = [];
  let left = 0;
  let right = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i > 0 && p.t - points[i - 1].t > HR_SMOOTH_GAP_MS) {
      out.push({ t: p.t, mean: null, min: null, max: null, range: null });
    }
    while (left < i && p.t - points[left].t > HR_SMOOTH_WINDOW_MS) left++;
    while (right < points.length && points[right].t - p.t <= HR_SMOOTH_WINDOW_MS) right++;
    const n = right - left;
    if (n < HR_SMOOTH_MIN_POINTS) {
      out.push({ t: p.t, mean: null, min: null, max: null, range: null });
      continue;
    }
    let sum = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (let m = left; m < right; m++) {
      const v = points[m].hr;
      sum += v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    out.push({ t: p.t, mean: sum / n, min: lo, max: hi, range: hi - lo });
  }
  return out;
}

function HrTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  const hr = row?.hr ?? row?.mean;
  if (hr == null) return null;
  const time = new Date(label).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  return (
    <div style={{ background: "#1c1c1e", borderRadius: 8, fontSize: 12, padding: "8px 10px" }}>
      <p style={{ margin: 0, fontWeight: 600, marginBottom: 2 }}>{time}</p>
      <p style={{ margin: 0, color: "#22c55e" }}>{Math.round(hr)} bpm</p>
      {row?.min != null && row?.max != null && (
        <p style={{ margin: 0, color: "#888", fontSize: 11 }}>range {row.min}–{row.max}</p>
      )}
    </div>
  );
}

// X-axis tick positions aligned to local-time boundaries, so day/hour labels
// stay chronological and consistent regardless of how many readings exist.
function makeTicks(fromMs: number, toMs: number, hourly: boolean): number[] {
  const ticks: number[] = [];
  const d = new Date(fromMs);
  if (hourly) {
    // every 3 hours, aligned to 00:00/03:00/06:00/...
    d.setMinutes(0, 0, 0);
    d.setHours(Math.floor(d.getHours() / 3) * 3);
    while (d.getTime() <= toMs) {
      if (d.getTime() >= fromMs) ticks.push(d.getTime());
      d.setHours(d.getHours() + 3);
    }
  } else {
    // local-midnight day boundaries (daily for <=14 days, else every 5 days)
    const span = toMs - fromMs;
    d.setHours(0, 0, 0, 0);
    const stepDays = span <= 14 * 86400 * 1000 ? 1 : 5;
    while (d.getTime() <= toMs) {
      if (d.getTime() >= fromMs) ticks.push(d.getTime());
      d.setDate(d.getDate() + stepDays);
    }
  }
  return ticks;
}

function SleepTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  const total = row?.totalSeconds != null ? hours(row.totalSeconds) : 0;
  return (
    <div style={{ background: "#1c1c1e", borderRadius: 8, fontSize: 12, padding: "8px 10px" }}>
      <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ margin: 0, color: p.color ?? "#fff" }}>{p.name}: {p.value} h</p>
      ))}
      <p style={{ margin: 0, marginTop: 4, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.12)", fontWeight: 600 }}>
        Total: {total} h
      </p>
    </div>
  );
}

function StepsTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const steps = payload[0].value;
  return (
    <div style={{ background: "#1c1c1e", borderRadius: 8, fontSize: 12, padding: "8px 10px" }}>
      <p style={{ margin: 0, fontWeight: 600, marginBottom: 2 }}>{label}</p>
      <p style={{ margin: 0, color: "#2dd4bf" }}>{Number(steps).toLocaleString()} steps</p>
    </div>
  );
}

export default function PebbleTab({ showNotes = false }: { showNotes?: boolean }) {
  const [rangeIdx, setRangeIdx] = useState(0);
  const range = HR_RANGES[rangeIdx];
  const is24h = range.hours <= 24;
  // The 24h view fetches the full available minute history so the user can
  // swipe back through previous days; 7d/30d fetch only their own window.
  const fetchHours = is24h ? 720 : range.hours;

  const [sleepRangeIdx, setSleepRangeIdx] = useState(0);
  const sleepRange = SLEEP_RANGES[sleepRangeIdx];
  const isHourly = sleepRange.value === "24h";

  const [stepsRangeIdx, setStepsRangeIdx] = useState(0);
  const stepsRange = STEPS_RANGES[stepsRangeIdx];

  const { data: notes = [] } = useDayNotes();

  const { data, isPending } = useQuery<PebbleData>({
    queryKey: ["pebble_health", fetchHours],
    queryFn: async () => {
      const res = await fetch(`/api/v1/pebble?hours=${fetchHours}`);
      return res.json();
    },
  });

  const hrChart = useMemo(() => {
    const points = data?.heartRate ?? [];
    const lastT = points.length ? points[points.length - 1].t : Date.now() / 1000;
    const minute = points.map((p) => ({ t: p.t * 1000, hr: p.hr }));
    // 24h plots every minute reading; 7d/30d plot hourly means.
    const series = is24h ? minute : aggregateHourly(points);
    const raw = series;

    // 7d only: split the line at >1h holes and bridge them with dashes.
    const split =
      !is24h && range.hours <= HR_BRIDGE_MAX_HOURS
        ? splitHrSeries(minute, series)
        : { segments: [series], bridges: [] as [HrSeriesPoint, HrSeriesPoint][] };

    const to = lastT * 1000;
    let from: number;
    let width: number;
    if (is24h) {
      // Full available history at minute granularity (1px/min). The initial
      // view is the most recent 24h; the user pans back by scrolling.
      from = points.length ? points[0].t * 1000 : to - 24 * 3600 * 1000;
      width = Math.max((to - from) / 60000, 1440);
    } else {
      from = to - range.hours * 3600 * 1000;
      width = range.hours * range.pxPerHour;
    }

    return {
      points: raw,
      rows: buildHrRows(series, split.segments, split.bridges),
      segments: split.segments,
      bridges: split.bridges,
      smooth: is24h ? smoothHr(raw) : [],
      from,
      to,
      ticks: makeTicks(from, to, is24h),
      runs: highHrRuns(raw),
      width,
      shortLabels: is24h,
    };
  }, [data, range, is24h]);

  // Start every range at the most recent (right) edge so the latest date is
  // visible on load and the user swipes left to reveal earlier days.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
    });
    return () => cancelAnimationFrame(raf);
  }, [data, range]);

  // Sleep Timeline 24h: fit exactly 24h into the visible width, then overflow
  // so the user can scroll back through the earlier hours/days.
  const sleepScrollRef = useRef<HTMLDivElement>(null);
  const [sleepViewW, setSleepViewW] = useState(0);
  useEffect(() => {
    if (!isHourly) return;
    const el = sleepScrollRef.current;
    if (!el) return;
    const measure = () => setSleepViewW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isHourly]);

  useEffect(() => {
    if (!isHourly) return;
    const el = sleepScrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
    });
    return () => cancelAnimationFrame(raf);
  }, [data, isHourly, sleepViewW]);

  const sleepChart = useMemo(() => {
    const cutoff = Date.now() / 1000 - sleepRange.days * 86400;
    if (isHourly) {
      const bars = (data?.sleepHourly ?? []).map((h) => ({
        label: fmtHour(h.t),
        totalSeconds: h.asleepSeconds,
        Deep: hours(h.deepSeconds),
        Normal: hours(Math.max(0, h.asleepSeconds - h.deepSeconds)),
      }));
      // 24h fits the viewport; the rest overflows for back-scrolling.
      const pxPerHour = sleepViewW > 0 ? sleepViewW / 24 : 16;
      return {
        bars,
        width: Math.max(bars.length * pxPerHour, sleepViewW || 390),
        avgTotalHours: null,
      };
    }
    const bars = (data?.sleepTimeline ?? [])
      .filter((n) => n.dateUtc >= cutoff)
      .map((n) => ({
        label: fmtNight(n.date),
        totalSeconds: n.totalSeconds,
        Deep: hours(n.deepSeconds),
        Normal: hours(Math.max(0, n.totalSeconds - n.deepSeconds)),
      }));
    const avgTotalHours = bars.length
      ? Math.round((bars.reduce((s, b) => s + b.totalSeconds, 0) / bars.length / 3600) * 10) / 10
      : null;
    return { bars, width: Math.max(bars.length * sleepRange.barWidth, 120), avgTotalHours };
  }, [data, sleepRange, isHourly, sleepViewW]);

  const stepsChart = useMemo(() => {
    const cutoff = Date.now() / 1000 - stepsRange.days * 86400;
    const bars = (data?.dailySteps ?? [])
      .filter((d) => d.dateUtc >= cutoff)
      .map((d) => ({ label: fmtNight(d.date), steps: d.steps }));
    return { bars, width: Math.max(bars.length * stepsRange.barWidth, 120) };
  }, [data, stepsRange]);

  // Note overlays. Sub-24h views (HR 24h, Sleep hourly) deliberately skip notes.
  const hrNotes = useMemo(() => {
    if (!showNotes || is24h) return [];
    return notes.filter((n) => {
      const ts = noteTs(n.date);
      return ts >= hrChart.from && ts <= hrChart.to;
    });
  }, [notes, showNotes, is24h, hrChart.from, hrChart.to]);

  const sleepNotes = useMemo(() => {
    if (!showNotes || isHourly) return [];
    const labels = new Set(sleepChart.bars.map((b) => b.label));
    return notes.filter((n) => labels.has(fmtNight(n.date)));
  }, [notes, showNotes, isHourly, sleepChart]);

  const stepsNotes = useMemo(() => {
    if (!showNotes) return [];
    const labels = new Set(stepsChart.bars.map((b) => b.label));
    return notes.filter((n) => labels.has(fmtNight(n.date)));
  }, [notes, showNotes, stepsChart]);

  // Start the steps chart at the latest (right) edge so today is visible on load.
  const stepsScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stepsScrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
    });
    return () => cancelAnimationFrame(raf);
  }, [data, stepsRange]);

  if (isPending) {
    return (
      <div className="px-5 pb-8 space-y-4">
        <Skeleton className="h-9 rounded-xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (data && !data.ok) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-sm font-semibold">No Pebble data yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Sync your watch, then check back. ({data.error ?? "database not found"})
        </p>
      </div>
    );
  }

  const hasHr = hrChart.points.length > 0;
  const hasSleep = (data?.sleepTimeline?.length ?? 0) > 0;

  return (
    <div className="px-5 pb-8 space-y-6">
      {/* ── Heart Rate ─────────────────────────────────────────────── */}
      <Section title="Heart Rate" subtitle={`High heart-rate (exercise) periods shaded · dashed line = no readings, drawn at resting HR (~${HR_GAP_ASSUMED_BPM} bpm) (7d)`}>
        <div className="flex bg-secondary rounded-xl p-1 gap-1 mb-4">
          {HR_RANGES.map((r, i) => (
            <button key={r.label} onClick={() => setRangeIdx(i)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${i === rangeIdx ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>

        {hasHr ? (
          <div className="overflow-x-auto -mx-4 px-4" ref={scrollRef}>
            <div style={{ width: hrChart.width, minWidth: "100%" }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={(is24h && HR_24H_MODE === "band" ? hrChart.smooth : is24h ? hrChart.points : hrChart.rows) as any}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="t" type="number" scale="time" domain={[hrChart.from, hrChart.to]}
                    ticks={hrChart.ticks} tick={{ fontSize: 10, fill: "#888" }}
                    tickFormatter={(ms: number) => fmtTime(ms, hrChart.shortLabels)} />
                  <YAxis tick={{ fontSize: 10, fill: "#888" }} domain={["auto", "auto"]} />
                  <Tooltip content={<HrTooltip />} />
                  {hrChart.runs.map((r, i) => (
                    <ReferenceArea key={i} x1={r.start} x2={r.end}
                      fill="#ef4444" fillOpacity={0.18} strokeOpacity={0} />
                  ))}
                  {is24h && HR_24H_MODE === "band" ? (
                    <>
                      <Area dataKey="min" stackId="hr-band" stroke="none" fill="transparent"
                        connectNulls={false} isAnimationActive={false} />
                      <Area dataKey="range" stackId="hr-band" stroke="none" fill="#22c55e"
                        fillOpacity={0.15} connectNulls={false} isAnimationActive={false} />
                      <Line dataKey="mean" stroke="#22c55e" strokeWidth={1.5} dot={false}
                        connectNulls={false} name="Heart Rate" isAnimationActive={false} />
                    </>
                  ) : is24h ? (
                    <Line dataKey="hr" stroke="none" dot={{ r: 1.5, fill: "#22c55e", strokeWidth: 0 }}
                      activeDot={{ r: 4, fill: "#22c55e", strokeWidth: 0 }}
                      name="Heart Rate" isAnimationActive={false} />
                  ) : (
                    <>
                      {hrChart.segments.map((_, i) => (
                        <Line key={`seg-${i}`} type="monotone" dataKey={`s${i}`} stroke="#22c55e"
                          strokeWidth={1.5} dot={false} connectNulls={false}
                          name="Heart Rate" legendType="none" isAnimationActive={false} />
                      ))}
                      {hrChart.bridges.map((_, i) => (
                        <Line key={`gap-${i}`} type="linear" dataKey={`b${i}`} stroke="#f59e0b"
                          strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false}
                          name="No data (>1h)" legendType="none" isAnimationActive={false} />
                      ))}
                    </>
                  )}
                  {!is24h && hrNotes.length > 0 && (
                    <NoteMarkers notes={hrNotes} resolveX={(d) => noteTs(d)} dayWidthPx={24 * range.pxPerHour} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <EmptyNote text="No heart-rate readings in this window." />
        )}
      </Section>

      {/* ── Sleep Timeline ─────────────────────────────────────────── */}
      <Section title="Sleep Timeline" subtitle="Deep vs normal sleep">
        <div className="flex bg-secondary rounded-xl p-1 gap-1 mb-4">
          {SLEEP_RANGES.map((r, i) => (
            <button key={r.value} onClick={() => setSleepRangeIdx(i)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${i === sleepRangeIdx ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>

        {hasSleep ? (
          <div className="overflow-x-auto -mx-4 px-4" ref={sleepScrollRef}>
            <div style={{ width: sleepChart.width, minWidth: "100%" }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sleepChart.bars} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#888" }}
                    interval={isHourly ? 2 : "preserveStartEnd"} />
                  <YAxis tick={{ fontSize: 10, fill: "#888" }} />
                  <Tooltip content={<SleepTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Deep" stackId="sleep" fill="#a855f7" name="Deep" />
                  <Bar dataKey="Normal" stackId="sleep" fill="#6366f1" radius={[4, 4, 0, 0]} name="Normal" />
                  {!isHourly && sleepChart.avgTotalHours != null && (
                    <ReferenceLine y={sleepChart.avgTotalHours} stroke="#f59e0b"
                      strokeDasharray="4 4" strokeWidth={1.5}
                      label={{ value: `avg ${sleepChart.avgTotalHours}h`, position: "insideTopRight", fontSize: 10, fill: "#f59e0b" }} />
                  )}
                  {!isHourly && sleepNotes.length > 0 && (
                    <NoteMarkers notes={sleepNotes} resolveX={(d) => fmtNight(d)} dayWidthPx={sleepRange.barWidth} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <EmptyNote text="No sleep data yet." />
        )}
      </Section>

      {/* ── Steps ───────────────────────────────────────────────── */}
      {SHOW_STEPS_CHART && (
        <Section title="Steps" subtitle="Total steps per day">
          <div className="flex bg-secondary rounded-xl p-1 gap-1 mb-4">
            {STEPS_RANGES.map((r, i) => (
              <button key={r.value} onClick={() => setStepsRangeIdx(i)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${i === stepsRangeIdx ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>
                {r.label}
              </button>
            ))}
          </div>

          {stepsChart.bars.length > 0 ? (
            <div className="overflow-x-auto -mx-4 px-4" ref={stepsScrollRef}>
              <div style={{ width: stepsChart.width, minWidth: "100%" }}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stepsChart.bars} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#888" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "#888" }} />
                    <Tooltip content={<StepsTooltip />} />
                    <Bar dataKey="steps" fill="#2dd4bf" radius={[4, 4, 0, 0]} name="Steps" />
                    <ReferenceLine y={STEPS_GOAL} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5}
                      label={{ value: `goal ${STEPS_GOAL.toLocaleString()}`, position: "insideTopRight", fontSize: 10, fill: "#f59e0b" }} />
                    {stepsNotes.length > 0 && (
                      <NoteMarkers notes={stepsNotes} resolveX={(d) => fmtNight(d)} dayWidthPx={stepsRange.barWidth} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <EmptyNote text="No steps data in this window." />
          )}
        </Section>
      )}

    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground py-8 text-center">{text}</p>;
}
