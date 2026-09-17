"use client";

import { ReferenceLine } from "recharts";

export interface DayNote {
  id: string;
  date: string;
  note: string;
}

// Dashed marker line + label color.
const NOTE_LINE_COLOR = "#f59e0b";
// Vertical gap (px) between successive stagger lanes.
const NOTE_STAGGER_STEP_PX = 16;
// Rough rendered width per character at fontSize 10 (px).
const NOTE_CHAR_PX = 6;
// Horizontal padding around the label text (px).
const NOTE_LABEL_PAD_PX = 8;

function localMidnightMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

function halfLabelWidthPx(note: string): number {
  return (note.length * NOTE_CHAR_PX + NOTE_LABEL_PAD_PX) / 2;
}

// Greedy lane assignment: stagger notes whose labels would overlap.
// `dayWidthPx` is the chart's horizontal pixels-per-day, so gaps are compared
// in real pixels against the estimated label widths.
function assignLanes(notes: DayNote[], dayWidthPx: number): number[] {
  const order = notes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => a.n.date.localeCompare(b.n.date));
  const lanes = new Array<number>(notes.length).fill(0);
  const laneLast = new Map<number, { dayMs: number; halfPx: number }>();
  for (const { n, i } of order) {
    const dayMs = localMidnightMs(n.date);
    const halfPx = halfLabelWidthPx(n.note);
    let lane = 0;
    while (laneLast.has(lane)) {
      const prev = laneLast.get(lane)!;
      const gapPx = ((dayMs - prev.dayMs) / 86400_000) * dayWidthPx;
      if (gapPx >= prev.halfPx + halfPx) break;
      lane++;
    }
    laneLast.set(lane, { dayMs, halfPx });
    lanes[i] = lane;
  }
  return lanes;
}

/**
 * Overlay day-level notes on any recharts chart as dashed vertical lines +
 * short labels. `resolveX` maps a note's `YYYY-MM-DD` date onto the chart's
 * x-axis representation. `dayWidthPx` tunes stagger collision detection to the
 * chart's horizontal scale.
 */
export function NoteMarkers({
  notes,
  resolveX,
  dayWidthPx = 5,
}: {
  notes: DayNote[];
  resolveX: (date: string) => string | number;
  dayWidthPx?: number;
}) {
  if (!notes.length) return null;
  const lanes = assignLanes(notes, dayWidthPx);
  return (
    <>
      {notes.map((n, i) => (
        <ReferenceLine
          key={n.id}
          x={resolveX(n.date)}
          stroke={NOTE_LINE_COLOR}
          strokeDasharray="4 4"
          strokeOpacity={0.8}
          strokeWidth={1.5}
          label={{
            value: n.note,
            position: "insideTop",
            offset: 6 + lanes[i] * NOTE_STAGGER_STEP_PX,
            fill: NOTE_LINE_COLOR,
            fontSize: 10,
          }}
        />
      ))}
    </>
  );
}
