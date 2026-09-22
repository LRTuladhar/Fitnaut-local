// Day-note scoping.
//
// A note carries a `scope` that decides which charts it overlays:
//   "everywhere" — every chart that has note overlays switched on (default)
//   "nutrition"  — ONLY the Calories / Nutrition charts
//
// Derived markers (e.g. auto-flagged golf days) also carry a scope, so both
// stored notes and computed markers share one filtering rule.

export type NoteScope = "everywhere" | "nutrition";

/** The chart asking for note overlays. */
export type NoteSurface = "everywhere" | "nutrition";

export const DEFAULT_NOTE_SCOPE: NoteScope = "everywhere";

/** Overlay colour per scope: amber = general notes, green = nutrition markers. */
export const NOTE_SCOPE_COLOR: Record<NoteScope, string> = {
  everywhere: "#f59e0b",
  nutrition: "#22c55e",
};

export function normalizeNoteScope(scope?: string | null): NoteScope {
  return scope === "nutrition" ? "nutrition" : "everywhere";
}

/**
 * Whether a note belongs on the given chart surface.
 * The nutrition charts show everything; every other chart hides
 * nutrition-only notes.
 */
export function noteShowsOn(
  scope: string | null | undefined,
  surface: NoteSurface
): boolean {
  if (surface === "nutrition") return true;
  return normalizeNoteScope(scope) === "everywhere";
}

/** Local YYYY-MM-DD key for a stored timestamp (ISO string or Date). */
export function toLocalDateKey(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
