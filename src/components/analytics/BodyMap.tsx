"use client";

import { BODY_PARTS } from "@/lib/analytics";

type Shape =
  | { k: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { k: "rect"; x: number; y: number; w: number; h: number; r: number };

const FRONT_REGIONS: Record<string, Shape[]> = {
  chest: [
    { k: "ellipse", cx: 49, cy: 63, rx: 12, ry: 11 },
    { k: "ellipse", cx: 71, cy: 63, rx: 12, ry: 11 },
  ],
  abs: [{ k: "rect", x: 52, y: 76, w: 16, h: 30, r: 6 }],
  shoulders: [
    { k: "ellipse", cx: 43, cy: 56, rx: 7, ry: 8 },
    { k: "ellipse", cx: 77, cy: 56, rx: 7, ry: 8 },
  ],
  biceps: [
    { k: "rect", x: 25, y: 60, w: 11, h: 42, r: 5.5 },
    { k: "rect", x: 84, y: 60, w: 11, h: 42, r: 5.5 },
  ],
  quads: [
    { k: "rect", x: 43, y: 116, w: 14, h: 46, r: 7 },
    { k: "rect", x: 63, y: 116, w: 14, h: 46, r: 7 },
  ],
};

const BACK_REGIONS: Record<string, Shape[]> = {
  back: [{ k: "rect", x: 47, y: 56, w: 26, h: 56, r: 10 }],
  shoulders: [
    { k: "ellipse", cx: 43, cy: 56, rx: 7, ry: 8 },
    { k: "ellipse", cx: 77, cy: 56, rx: 7, ry: 8 },
  ],
  triceps: [
    { k: "rect", x: 25, y: 60, w: 11, h: 42, r: 5.5 },
    { k: "rect", x: 84, y: 60, w: 11, h: 42, r: 5.5 },
  ],
  glutes: [
    { k: "ellipse", cx: 48, cy: 120, rx: 10, ry: 8 },
    { k: "ellipse", cx: 72, cy: 120, rx: 10, ry: 8 },
  ],
  hamstrings: [
    { k: "rect", x: 43, y: 130, w: 14, h: 32, r: 7 },
    { k: "rect", x: 63, y: 130, w: 14, h: 32, r: 7 },
  ],
  calves: [
    { k: "rect", x: 44, y: 166, w: 12, h: 32, r: 6 },
    { k: "rect", x: 64, y: 166, w: 12, h: 32, r: 6 },
  ],
};

interface BodyMapProps {
  view: "front" | "back";
  activeParts: string[];
  selectedPart?: string | null;
  highlight?: string;
  selectedColor?: string;
  muted?: string;
  className?: string;
}

export default function BodyMap({
  view,
  activeParts,
  selectedPart = null,
  highlight = "#3b82f6",
  selectedColor = "#facc15",
  muted = "#52525b",
  className,
}: BodyMapProps) {
  const active = new Set(activeParts);
  const regions = view === "front" ? FRONT_REGIONS : BACK_REGIONS;
  const visible = BODY_PARTS.filter((p) => p.side === view || p.side === "both").map((p) => p.id);

  return (
    <svg viewBox="23 7 74 196" className={className} role="img" aria-label={view === "front" ? "Front body" : "Back body"}>
      <g fill={muted}>
        <ellipse cx="60" cy="24" rx="13" ry="16" />
        <rect x="55" y="37" width="10" height="12" rx="4" />
        <rect x="36" y="50" width="48" height="64" rx="12" />
        <rect x="24" y="52" width="13" height="62" rx="6.5" />
        <rect x="83" y="52" width="13" height="62" rx="6.5" />
        <rect x="42" y="114" width="15" height="88" rx="7" />
        <rect x="63" y="114" width="15" height="88" rx="7" />
      </g>

      {visible.map((id) => {
        if (!active.has(id)) return null;
        const shapes = regions[id];
        if (!shapes) return null;
        const fill = id === selectedPart ? selectedColor : highlight;
        return (
          <g key={id} fill={fill}>
            {shapes.map((s, i) =>
              s.k === "ellipse" ? (
                <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} />
              ) : (
                <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} />
              )
            )}
          </g>
        );
      })}
    </svg>
  );
}
