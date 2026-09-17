"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { KG_TO_LBS } from "@/lib/units";
import type { ExerciseRow } from "@/lib/sessionGrouping";
import type { ExerciseDefinition } from "@/lib/exerciseParser";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLUMN_WIDTH = 12;
const MAX_DAYS = 120;
const CHART_HEIGHT = 200;

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDisplayDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatTick(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(v));
}

interface Props {
  exercises: ExerciseRow[];
  definitions: ExerciseDefinition[];
}

function WeightTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string | number;
    value?: number | string;
    dataKey?: string | number;
    color?: string;
  }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0 || label == null) return null;
  const p = payload[0];
  const dateLabel = new Date(`${label}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const value = Number(p.value ?? 0);
  return (
    <div
      style={{
        background: "#1c1c1e",
        border: "none",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
        color: "#f5f5f5",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{dateLabel}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: p.color,
            display: "inline-block",
          }}
        />
        <span>{p.name}</span>
        <span style={{ marginLeft: "auto", fontWeight: 500 }}>{value.toLocaleString()} lbs</span>
      </div>
    </div>
  );
}

export default function ExerciseProgressTimeline({ exercises, definitions }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Canonical library names keyed by their slug id (id = name.toLowerCase().replace(/\s+/g, "-")).
  // This is the identity the app writes into exercise_definition_id.
  const defById = useMemo(
    () => new Map(definitions.map((d) => [d.id, d])),
    [definitions]
  );

  const exerciseOptions = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>();
    for (const ex of exercises) {
      if (ex.weight_kg == null) continue;
      const id = ex.exercise_definition_id ?? "";
      if (!id) continue;
      const def = defById.get(id);
      const name = def?.name ?? ex.exercise_name ?? id;
      const entry = counts.get(id);
      if (entry) entry.count++;
      else counts.set(id, { id, name, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [exercises, defById]);

  const [selectedId, setSelectedId] = useState<string | null>(
    () => exerciseOptions[0]?.id ?? null
  );

  useEffect(() => {
    if (exerciseOptions.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId === null || !exerciseOptions.some((o) => o.id === selectedId)) {
      setSelectedId(exerciseOptions[0].id);
    }
  }, [exerciseOptions, selectedId]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const startDate = useMemo(() => addDays(today, -(MAX_DAYS - 1)), [today]);

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < MAX_DAYS; i++) result.push(addDays(startDate, i));
    return result;
  }, [startDate]);

  const chartData = useMemo(() => {
    const byDay = new Map<string, { max: number; total: number }>();
    for (const ex of exercises) {
      if (ex.weight_kg == null || !selectedId) continue;
      if ((ex.exercise_definition_id ?? "") !== selectedId) continue;
      const key = toDateKey(new Date(ex.timestamp));
      const lbs = ex.weight_kg * KG_TO_LBS;
      const entry = byDay.get(key) ?? { max: 0, total: 0 };
      if (lbs > entry.max) entry.max = lbs;
      if (ex.reps != null) entry.total += lbs * ex.reps;
      byDay.set(key, entry);
    }
    return days.map((date) => {
      const key = toDateKey(date);
      const e = byDay.get(key);
      return {
        date: key,
        maxWeight: e ? Math.round(e.max) : 0,
        totalWeight: e ? Math.round(e.total) : 0,
      };
    });
  }, [exercises, selectedId, days]);

  const [visibleStartIdx, setVisibleStartIdx] = useState(0);
  const [visibleEndIdx, setVisibleEndIdx] = useState(0);
  const [canScrollBack, setCanScrollBack] = useState(true);
  const [canScrollForward, setCanScrollForward] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollToToday = () => {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    };

    const raf = requestAnimationFrame(scrollToToday);

    const updateVisibility = () => {
      const firstVisible = Math.floor(el.scrollLeft / COLUMN_WIDTH);
      const visibleCount = Math.ceil(el.clientWidth / COLUMN_WIDTH);
      const lastVisible = Math.min(firstVisible + visibleCount, MAX_DAYS - 1);

      setVisibleStartIdx(Math.max(0, firstVisible));
      setVisibleEndIdx(lastVisible);
      setCanScrollBack(el.scrollLeft > 1);
      setCanScrollForward(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    };

    el.addEventListener("scroll", updateVisibility, { passive: true });
    updateVisibility();

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", updateVisibility);
    };
  }, []);

  const scrollPage = useCallback((direction: "back" | "forward") => {
    const el = scrollRef.current;
    if (!el) return;
    const pageWidth = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === "back" ? -pageWidth : pageWidth, behavior: "smooth" });
  }, []);

  const rangeLabel = useMemo(() => {
    if (visibleStartIdx >= visibleEndIdx) return "";
    const s = days[visibleStartIdx];
    const e = days[visibleEndIdx];
    return `${toDisplayDate(s)} – ${toDisplayDate(e)}, ${e.getFullYear()}`;
  }, [days, visibleStartIdx, visibleEndIdx]);

  const hasData = exerciseOptions.length > 0;
  const selectedLabel =
    exerciseOptions.find((o) => o.id === selectedId)?.name ?? "Select exercise";

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Exercise Progress
        </p>
        <span className="text-xs text-muted-foreground">{rangeLabel}</span>
      </div>

      <Select
        value={selectedId}
        onValueChange={(v) => {
          if (v) setSelectedId(String(v));
        }}
      >
        <SelectTrigger className="w-88">
          <SelectValue>
            {() => selectedLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {exerciseOptions.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!hasData ? (
        <p className="text-xs text-muted-foreground py-8 text-center">
          No weighted exercise data yet.
        </p>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={() => scrollPage("back")}
            disabled={!canScrollBack}
            className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors ${
              !canScrollBack ? "opacity-30 cursor-not-allowed" : ""
            }`}
            aria-label="Scroll back in time"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
          </button>

          <div
            ref={scrollRef}
            className="flex-1 overflow-x-auto"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div style={{ width: MAX_DAYS * COLUMN_WIDTH }}>
              <div className="sticky left-0 z-10 mb-1 w-fit rounded bg-card px-1.5 py-0.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                  Total Weight
                </span>
              </div>
              <BarChart
                width={MAX_DAYS * COLUMN_WIDTH}
                height={CHART_HEIGHT}
                data={chartData}
                margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                <YAxis
                  orientation="right"
                  width={26}
                  tick={{ fontSize: 10, fill: "#888" }}
                  tickFormatter={formatTick}
                />
                <Tooltip content={<WeightTooltip />} />
                <Bar dataKey="totalWeight" name="Total Weight" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>

              <div className="sticky left-0 z-10 mt-4 mb-1 w-fit rounded bg-card px-1.5 py-0.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                  Max Weight
                </span>
              </div>
              <BarChart
                width={MAX_DAYS * COLUMN_WIDTH}
                height={CHART_HEIGHT}
                data={chartData}
                margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#888" }}
                  tickFormatter={(v) => {
                    const d = new Date(`${v}T00:00:00`);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                  interval={6}
                />
                <YAxis
                  orientation="right"
                  width={26}
                  tick={{ fontSize: 10, fill: "#888" }}
                  tickFormatter={formatTick}
                />
                <Tooltip content={<WeightTooltip />} />
                <Bar dataKey="maxWeight" name="Max Weight" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </div>
          </div>

          <button
            onClick={() => scrollPage("forward")}
            disabled={!canScrollForward}
            className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors ${
              !canScrollForward ? "opacity-30 cursor-not-allowed" : ""
            }`}
            aria-label="Scroll forward in time"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
