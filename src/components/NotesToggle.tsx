"use client";

export function NotesToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-border bg-secondary shrink-0"
    >
      <span className="text-xs font-semibold text-muted-foreground">Notes</span>
      <span
        className={`relative inline-flex h-4 w-7 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/40"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
            checked ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
