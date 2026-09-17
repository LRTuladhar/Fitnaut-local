"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ExerciseRow } from "@/lib/sessionGrouping";

interface Props {
  exercises: ExerciseRow[];
  definitions: { id: string; name: string; type: string }[];
}

type BaseType = "strength" | "cardio" | "flexibility" | "sports";

const TYPE_COLORS: Record<BaseType, { bg: string; hex: string; label: string }> = {
  strength:    { bg: "bg-blue-500",   hex: "#3b82f6", label: "Strength"    },
  cardio:      { bg: "bg-amber-500",  hex: "#f59e0b", label: "Cardio"      },
  flexibility: { bg: "bg-purple-500", hex: "#a855f7", label: "Flexibility" },
  sports:      { bg: "bg-green-500",  hex: "#22c55e", label: "Sports"      },
};

const MIXED_COLOR = "#ef4444"; // fallback for a day with 3+ distinct types
const SOLID_TYPES: BaseType[] = ["strength", "cardio", "flexibility", "sports"];

// Solid for 1 type; diagonal split for 2; fall back to red for 3+.
function cellStyle(types: BaseType[]): CSSProperties {
  if (types.length === 1) return { backgroundColor: TYPE_COLORS[types[0]].hex };
  if (types.length === 2) {
    return {
      background: `linear-gradient(135deg, ${TYPE_COLORS[types[0]].hex} 50%, ${TYPE_COLORS[types[1]].hex} 50%)`,
    };
  }
  return { backgroundColor: MIXED_COLOR };
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function WorkoutCalendar({ exercises, definitions }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const defMap = useMemo(
    () => Object.fromEntries(definitions.map((d) => [d.name.toLowerCase(), d.type])),
    [definitions]
  );

  const workoutDays = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const ex of exercises) {
      const d = new Date(ex.timestamp);
      const key = toDateKey(d);
      if (!map.has(key)) map.set(key, new Set());
      const type = defMap[(ex.exercise_name ?? "").toLowerCase()];
      if (type) map.get(key)!.add(type);
    }
    const result = new Map<string, BaseType[]>();
    for (const [key, types] of map) {
      const ordered = SOLID_TYPES.filter((t) => types.has(t));
      if (ordered.length > 0) result.set(key, ordered);
    }
    return result;
  }, [exercises, defMap]);

  const dayExercises = useMemo(() => {
    const map = new Map<string, { name: string; type: BaseType }[]>();
    for (const ex of exercises) {
      const d = new Date(ex.timestamp);
      const key = toDateKey(d);
      const raw = defMap[(ex.exercise_name ?? "").toLowerCase()];
      if (!raw || !(SOLID_TYPES as string[]).includes(raw)) continue;
      const name = ex.exercise_name ?? "Unknown";
      if (!map.has(key)) map.set(key, []);
      const list = map.get(key)!;
      if (!list.some((e) => e.name === name)) {
        list.push({ name, type: raw as BaseType });
      }
    }
    return map;
  }, [exercises, defMap]);

  // Build the calendar grid for the current month
  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    // Pad to complete the last row
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    const next = new Date(year, month + 1, 1);
    if (next <= today) {
      if (month === 11) { setYear(y => y + 1); setMonth(0); }
      else setMonth(m => m + 1);
    }
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Stats for this month
  const monthWorkouts = [...workoutDays.entries()].filter(([key]) => {
    const [y, m] = key.split("-").map(Number);
    return y === year && m === month;
  });
  const totalWorkouts = monthWorkouts.length;
  const strengthDays = monthWorkouts.filter(([, t]) => t.includes("strength")).length;
  const cardioDays   = monthWorkouts.filter(([, t]) => t.includes("cardio")).length;

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl bg-secondary active:scale-90 transition-transform">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <button onClick={nextMonth} disabled={isCurrentMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-secondary active:scale-90 transition-transform disabled:opacity-30">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DOW.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const key = toDateKey(day);
          const types = workoutDays.get(key);
          const isToday = day.toDateString() === today.toDateString();
          const isFuture = day > today;
          const hasWorkout = !!types && types.length > 0 && !isFuture;
          const items = dayExercises.get(key) ?? [];
          const dayLabel = day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

          return (
            <div key={i} className="group relative aspect-square flex items-center justify-center">
              <div
                style={hasWorkout ? cellStyle(types!) : undefined}
                className={`
                  w-full h-full rounded-xl flex items-center justify-center
                  ${!hasWorkout ? "bg-secondary/50" : ""}
                  ${isToday ? "ring-2 ring-white/60 ring-offset-1 ring-offset-background" : ""}
                `}
              >
                <span className={`text-xs font-medium ${hasWorkout || isToday ? "text-white" : "text-muted-foreground"}`}>
                  {day.getDate()}
                </span>
              </div>

              {hasWorkout && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity duration-100 group-hover:opacity-100">
                  <div className="mb-1 font-semibold whitespace-nowrap">{dayLabel}</div>
                  {items.map((ex, i) => (
                    <div key={i} className="flex items-center gap-1.5 whitespace-nowrap">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[ex.type].hex }} />
                      <span>{ex.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1">
        {SOLID_TYPES.map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${TYPE_COLORS[type].bg}`} />
            <span className="text-[11px] text-muted-foreground">{TYPE_COLORS[type].label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm"
            style={{ background: `linear-gradient(135deg, ${TYPE_COLORS.strength.hex} 50%, ${TYPE_COLORS.cardio.hex} 50%)` }}
          />
          <span className="text-[11px] text-muted-foreground">Mixed</span>
        </div>
      </div>

      {/* Monthly stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Workouts", value: totalWorkouts },
          { label: "Strength", value: strengthDays },
          { label: "Cardio",   value: cardioDays   },
        ].map(({ label, value }) => (
          <div key={label} className="bg-secondary rounded-xl py-3 text-center">
            <p className="text-xl font-bold">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
