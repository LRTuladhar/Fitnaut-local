"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ExerciseRow } from "@/lib/sessionGrouping";

interface Props {
  exercises: ExerciseRow[];
  definitions: { id: string; name: string; type: string }[];
}

type WorkoutType = "strength" | "cardio" | "mixed" | "other";

const TYPE_COLORS: Record<WorkoutType, { bg: string; label: string }> = {
  strength: { bg: "bg-blue-500",   label: "Strength" },
  cardio:   { bg: "bg-green-500",  label: "Cardio"   },
  mixed:    { bg: "bg-orange-500", label: "Mixed"    },
  other:    { bg: "bg-purple-500", label: "Other"    },
};

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
      const type = defMap[(ex.exercise_name ?? "").toLowerCase()] ?? "other";
      map.get(key)!.add(type);
    }
    const result = new Map<string, WorkoutType>();
    for (const [key, types] of map) {
      const s = types.has("strength"), c = types.has("cardio");
      if (s && c) result.set(key, "mixed");
      else if (s)  result.set(key, "strength");
      else if (c)  result.set(key, "cardio");
      else         result.set(key, "other");
    }
    return result;
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
  const strengthDays = monthWorkouts.filter(([, t]) => t === "strength" || t === "mixed").length;
  const cardioDays   = monthWorkouts.filter(([, t]) => t === "cardio"   || t === "mixed").length;

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
          const type = workoutDays.get(key);
          const isToday = day.toDateString() === today.toDateString();
          const isFuture = day > today;

          return (
            <div key={i} className="aspect-square flex items-center justify-center relative">
              <div className={`
                w-full h-full rounded-xl flex items-center justify-center
                ${type && !isFuture ? TYPE_COLORS[type].bg : "bg-secondary/50"}
                ${isToday ? "ring-2 ring-white/60 ring-offset-1 ring-offset-background" : ""}
              `}>
                <span className={`text-xs font-medium ${type && !isFuture ? "text-white" : isToday ? "text-white" : "text-muted-foreground"}`}>
                  {day.getDate()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1">
        {(Object.entries(TYPE_COLORS) as [WorkoutType, { bg: string; label: string }][]).map(([type, { bg, label }]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${bg}`} />
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </div>
        ))}
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
