"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";

interface Props {
  onDelete: () => void;
  children: React.ReactNode;
}

const THRESHOLD = 80; // px to reveal delete button

export function SwipeToDelete({ onDelete, children }: Props) {
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startX = useRef<number | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    const dx = startX.current - e.touches[0].clientX;
    if (dx < 0) { // swipe right — close
      setOffset(0);
      setRevealed(false);
      return;
    }
    setOffset(Math.min(dx, THRESHOLD + 20));
  }

  function onTouchEnd() {
    if (offset >= THRESHOLD) {
      setOffset(THRESHOLD);
      setRevealed(true);
    } else {
      setOffset(0);
      setRevealed(false);
    }
    startX.current = null;
  }

  function close() {
    setOffset(0);
    setRevealed(false);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete button underneath */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-center w-20 bg-destructive rounded-2xl">
        <button
          onClick={() => { onDelete(); close(); }}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Trash2 className="w-5 h-5" strokeWidth={1.8} />
          <span className="text-[10px] font-medium">Delete</span>
        </button>
      </div>

      {/* Swipeable content */}
      <div
        className="relative transition-transform"
        style={{ transform: `translateX(-${offset}px)`, transitionDuration: startX.current ? "0ms" : "200ms" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={revealed ? close : undefined}
      >
        {children}
      </div>
    </div>
  );
}
