"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, Dumbbell, HeartPulse, StretchHorizontal, Volleyball } from "lucide-react";

interface ExerciseRow {
  timestamp: string;
  exercise_name?: string | null;
  exercise_definition_id?: string | null;
}

interface ExerciseDefinition {
  id: string;
  name: string;
  type: string;
}

const TYPE_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  strength: { Icon: Dumbbell, color: "#3b82f6" },
  cardio: { Icon: HeartPulse, color: "#f59e0b" },
  flexibility: { Icon: StretchHorizontal, color: "#a855f7" },
  sports: { Icon: Volleyball, color: "#22c55e" },
};

const TYPE_ORDER = ["sports", "flexibility", "cardio", "strength"];

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const COLUMN_WIDTH = 40;
const MAX_DAYS = 120;

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

interface Props {
  exercises: ExerciseRow[];
  definitions: ExerciseDefinition[];
}

export default function ExerciseTimeline({ exercises, definitions }: Props) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const startDate = useMemo(() => addDays(today, -(MAX_DAYS - 1)), [today]);

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < MAX_DAYS; i++) {
      result.push(addDays(startDate, i));
    }
    return result;
  }, [startDate]);

  const activityByDay = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const defMap = new Map(definitions.map((d) => [d.name.toLowerCase(), d.type]));
    for (const ex of exercises) {
      const d = new Date(ex.timestamp);
      const key = toDateKey(d);
      if (!map.has(key)) map.set(key, new Set());
      const type = defMap.get((ex.exercise_name ?? "").toLowerCase()) ?? "strength";
      map.get(key)!.add(type);
    }
    return map;
  }, [exercises, definitions]);

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

  const handleDayClick = useCallback(
    (date: Date) => {
      router.push(`/history?date=${toDateKey(date)}`);
    },
    [router]
  );

  const rangeLabel = useMemo(() => {
    if (visibleStartIdx >= visibleEndIdx) return "";
    const s = days[visibleStartIdx];
    const e = days[visibleEndIdx];
    return `${toDisplayDate(s)} – ${toDisplayDate(e)}, ${e.getFullYear()}`;
  }, [days, visibleStartIdx, visibleEndIdx]);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Activity Timeline</p>
        <span className="text-xs text-muted-foreground">{rangeLabel}</span>
      </div>

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
          <div className="flex gap-0.5" style={{ width: MAX_DAYS * COLUMN_WIDTH }}>
            {days.map((date) => {
              const key = toDateKey(date);
              const types = activityByDay.get(key);
              const activeTypes = types ? [...types] : [];

              return (
                <button
                  key={key}
                  onClick={() => handleDayClick(date)}
                  className="flex flex-col items-center gap-1.5 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
                  style={{ width: COLUMN_WIDTH }}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    {TYPE_ORDER.map((type) => {
                      const config = TYPE_ICONS[type];
                      const active = types?.has(type);
                      return (
                        <div key={type} className="w-4 h-4 flex items-center justify-center">
                          {active && config ? (
                            <config.Icon className="w-4 h-4" color={config.color} strokeWidth={2} />
                          ) : (
                            <div className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {DAY_LABELS[date.getDay()]}
                  </span>
                </button>
              );
            })}
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
    </div>
  );
}
