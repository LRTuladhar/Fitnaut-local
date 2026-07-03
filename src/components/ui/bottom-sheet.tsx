"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  const isDragging = useRef(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setDragY(0);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function onTouchStart(e: React.TouchEvent) {
    startYRef.current = e.touches[0].clientY;
    isDragging.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) setDragY(delta);
  }

  function onTouchEnd() {
    isDragging.current = false;
    if (dragY > 50) {
      onClose();
    }
    setDragY(0);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragY === 0 ? "transform 0.3s ease" : "none",
        }}
        className="relative bg-card rounded-t-3xl max-h-[92dvh] flex flex-col animate-in slide-in-from-bottom duration-300 border-t border-border"
      >
        {/* Drag handle — touch target for swipe-to-close */}
        <div
          className="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        {children}
      </div>
    </div>
  );
}

export function BottomSheetHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-4 pt-2 pb-3 flex-shrink-0">{children}</div>;
}

export function BottomSheetTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold">{children}</h2>;
}
