"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getBodyPartsByDay, BODY_PARTS } from "@/lib/analytics";
import type { ExerciseRow } from "@/lib/sessionGrouping";
import type { ExerciseDefinition } from "@/lib/exerciseParser";
import BodyMap from "./BodyMap";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const ACTIVE_COLUMN_WIDTH = 22;
const EMPTY_COLUMN_WIDTH = 6;
const MAX_DAYS = 120;

const FRONT_COLOR = "#22c55e";
const BACK_COLOR = "#3b82f6";
const SELECTED_COLOR = "#facc15";

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

export default function MuscleFocusTimeline({ exercises, definitions }: Props) {
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

  const partsByDay = useMemo(() => getBodyPartsByDay(exercises, definitions), [exercises, definitions]);

  const dayWidths = useMemo(() => {
    return days.map((date) => {
      const parts = partsByDay.get(toDateKey(date));
      return parts && parts.size > 0 ? ACTIVE_COLUMN_WIDTH : EMPTY_COLUMN_WIDTH;
    });
  }, [days, partsByDay]);

  const prefix = useMemo(() => {
    const p = new Array(MAX_DAYS + 1);
    p[0] = 0;
    for (let i = 0; i < MAX_DAYS; i++) p[i + 1] = p[i] + dayWidths[i];
    return p;
  }, [dayWidths]);

  const totalWidth = prefix[MAX_DAYS];

  const indexAtOffset = useCallback(
    (offset: number) => {
      let lo = 0;
      let hi = MAX_DAYS;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (prefix[mid] <= offset) lo = mid + 1;
        else hi = mid;
      }
      return Math.max(0, lo - 1);
    },
    [prefix]
  );

  const [selectedPart, setSelectedPart] = useState<string | null>(null);

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
      const firstVisible = indexAtOffset(el.scrollLeft);
      const lastVisible = indexAtOffset(el.scrollLeft + el.clientWidth);

      setVisibleStartIdx(Math.max(0, firstVisible));
      setVisibleEndIdx(Math.min(lastVisible, MAX_DAYS - 1));
      setCanScrollBack(el.scrollLeft > 1);
      setCanScrollForward(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    };

    el.addEventListener("scroll", updateVisibility, { passive: true });
    updateVisibility();

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", updateVisibility);
    };
  }, [indexAtOffset]);

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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Muscle Focus</p>
        <span className="text-xs text-muted-foreground">{rangeLabel}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {BODY_PARTS.map((part) => {
          const isSelected = selectedPart === part.id;
          return (
            <button
              key={part.id}
              onClick={() => setSelectedPart(isSelected ? null : part.id)}
              className={`px-2 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                isSelected
                  ? "bg-yellow-400/20 border-yellow-400 text-yellow-300"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {part.abbr ?? part.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 -mx-4">
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
          <div className="flex" style={{ width: totalWidth }}>
            {days.map((date, i) => {
              const key = toDateKey(date);
              const parts = partsByDay.get(key);
              const activeParts = parts ? [...parts] : [];
              const hasParts = activeParts.length > 0;

              return (
                <button
                  key={key}
                  onClick={() => handleDayClick(date)}
                  className="flex flex-col items-center justify-end gap-1 pb-1 rounded-lg hover:bg-secondary/50 transition-colors"
                  style={{ width: dayWidths[i] }}
                >
                  {hasParts && (
                    <div className="flex flex-col items-center gap-0.5">
                      <BodyMap view="front" activeParts={activeParts} selectedPart={selectedPart} highlight={FRONT_COLOR} selectedColor={SELECTED_COLOR} className="w-4 h-auto" />
                      <BodyMap view="back" activeParts={activeParts} selectedPart={selectedPart} highlight={BACK_COLOR} selectedColor={SELECTED_COLOR} className="w-4 h-auto" />
                    </div>
                  )}
                  {hasParts && (
                    <span className="text-[10px] text-muted-foreground font-medium leading-none">
                      {DAY_LABELS[date.getDay()]}
                    </span>
                  )}
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

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: FRONT_COLOR }} /> Front
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: BACK_COLOR }} /> Back
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: SELECTED_COLOR }} /> Selected
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Highlighted areas show muscles trained that day. Tap a muscle above to spotlight it, tap a day for history.
      </p>
    </div>
  );
}
