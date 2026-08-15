"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { getMeals } from "@/db/actions";
import { DEFAULT_USER_ID, MEAL_TYPES, type MealType, DAILY_CALORIE_TARGET } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";

const COLUMN_WIDTH = 24;
const MAX_DAYS = 90;
const CHART_HEIGHT = 200;

const SERIES = [...MEAL_TYPES, "unspecified"] as const;
type SeriesKey = (typeof SERIES)[number];

const MEAL_COLORS: Record<SeriesKey, string> = {
  breakfast: "#f59e0b",
  lunch: "#3b82f6",
  snack: "#22c55e",
  dinner: "#a855f7",
  unspecified: "#71717a",
};

const MEAL_LABELS: Record<SeriesKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner",
  unspecified: "Other",
};

interface MealRow {
  id: string;
  user_id: string;
  meal_type: string | null;
  description: string;
  calories: number;
  timestamp: string;
}

type DayPoint = { date: string } & Record<SeriesKey, number>;

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

export default function CalorieTimeline() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: meals = [], isPending } = useQuery<MealRow[]>({
    queryKey: ["meals", "all"],
    queryFn: async () => getMeals(DEFAULT_USER_ID, { order: "asc" }),
  });

  const [selected, setSelected] = useState<SeriesKey | null>(null);

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

  const totalsByDay = useMemo(() => {
    const map = new Map<string, Record<SeriesKey, number>>();
    for (const m of meals) {
      const key = toDateKey(new Date(m.timestamp));
      if (!map.has(key)) {
        map.set(key, { breakfast: 0, lunch: 0, snack: 0, dinner: 0, unspecified: 0 });
      }
      const entry = map.get(key)!;
      const type: SeriesKey = m.meal_type && (MEAL_TYPES as readonly string[]).includes(m.meal_type)
        ? (m.meal_type as MealType)
        : "unspecified";
      entry[type] += m.calories;
    }
    return map;
  }, [meals]);

  const chartData = useMemo<DayPoint[]>(
    () =>
      days.map((date) => {
        const key = toDateKey(date);
        const entry = totalsByDay.get(key) ?? {
          breakfast: 0,
          lunch: 0,
          snack: 0,
          dinner: 0,
          unspecified: 0,
        };
        return { date: key, ...entry };
      }),
    [days, totalsByDay]
  );

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
  }, [isPending]);

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

  const hasData = meals.length > 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Calories</p>
        <span className="text-xs text-muted-foreground">{rangeLabel}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelected(null)}
          className={`px-2 py-1 rounded-full text-[11px] font-medium transition-colors border ${
            selected === null
              ? "bg-foreground/10 border-foreground text-foreground"
              : "bg-secondary border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        {SERIES.map((key) => {
          const isSelected = selected === key;
          return (
            <button
              key={key}
              onClick={() => setSelected(isSelected ? null : key)}
              className={`px-2 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                isSelected
                  ? "border-transparent text-white"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}
              style={isSelected ? { background: MEAL_COLORS[key] } : undefined}
            >
              {MEAL_LABELS[key]}
            </button>
          );
        })}
      </div>

      {isPending ? (
        <Skeleton className="h-[200px] w-full rounded-lg" />
      ) : !hasData ? (
        <p className="text-xs text-muted-foreground py-8 text-center">No meals logged yet.</p>
      ) : (
        <>
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
              <AreaChart
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
                  minTickGap={24}
                  interval="preserveStartEnd"
                />
                <YAxis orientation="right" width={36} tick={{ fontSize: 10, fill: "#888" }} />
                <Tooltip
                  contentStyle={{ background: "#1c1c1e", border: "none", borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => [`${v} kcal`, MEAL_LABELS[name as SeriesKey] ?? String(name)]}
                  labelFormatter={(v) => new Date(`${v}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                />
                {SERIES.filter((key) => selected === null || key === selected).map((key) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key}
                    stackId={selected === null ? "1" : undefined}
                    stroke={MEAL_COLORS[key]}
                    fill={MEAL_COLORS[key]}
                    fillOpacity={selected !== null ? 0.35 : 0.55}
                    strokeWidth={1.5}
                  />
                ))}
                {selected === null && (
                  <ReferenceLine
                    y={DAILY_CALORIE_TARGET}
                    stroke="#facc15"
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                    label={{
                      value: `${DAILY_CALORIE_TARGET} kcal`,
                      position: "right",
                      fill: "#facc15",
                      fontSize: 10,
                    }}
                  />
                )}
              </AreaChart>
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

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {SERIES.map((key) => (
              <span
                key={key}
                className={`flex items-center gap-1 text-[10px] ${
                  selected !== null && selected !== key ? "opacity-30" : "text-muted-foreground"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: MEAL_COLORS[key] }} />
                {MEAL_LABELS[key]}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
