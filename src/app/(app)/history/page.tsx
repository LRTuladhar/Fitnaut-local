"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getExercises } from "@/db/actions";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { groupIntoSessions, type WorkoutSession } from "@/lib/sessionGrouping";
import { useExerciseDefinitions } from "@/hooks/useExercises";
import { formatWeight, formatDuration, KG_TO_LBS } from "@/lib/units";
import { Clock, Dumbbell, ChevronRight, Trash2, Pencil } from "lucide-react";
import { useDeleteExercise } from "@/hooks/useExercises";
import { useQueryClient } from "@tanstack/react-query";
import ManualEntryDrawer, { type EditExercise } from "@/components/workout/ManualEntryDrawer";
import { PageSkeleton } from "@/components/ui/skeleton";

type Range = "week" | "month" | "all";

const RANGES: { label: string; value: Range }[] = [
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "All", value: "all" },
];

function rangeStart(range: Range): Date {
  const d = new Date();
  if (range === "week") d.setDate(d.getDate() - 7);
  else if (range === "month") d.setMonth(d.getMonth() - 1);
  else d.setFullYear(2000);
  return d;
}

function formatSessionDate(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function sessionDuration(session: WorkoutSession): string {
  const ms = session.endTime.getTime() - session.startTime.getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "< 1m";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function HistoryPage() {
  const [range, setRange] = useState<Range>("month");
  const [selected, setSelected] = useState<WorkoutSession | null>(null);
  const { data: definitions = [] } = useExerciseDefinitions();
  const defMap = useMemo(
    () => Object.fromEntries(definitions.map((d) => [d.name.toLowerCase(), d])),
    [definitions]
  );

  const { data: exercises = [], isPending } = useQuery({
    queryKey: ["exercises", "all"],
    queryFn: async () => {
      return getExercises(DEFAULT_USER_ID, { order: "desc" });
    },
  });

  const filtered = useMemo(() => {
    const start = rangeStart(range);
    return exercises.filter((e) => new Date(e.timestamp) >= start);
  }, [exercises, range]);

  const sessions = useMemo(() => groupIntoSessions(filtered), [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    for (const s of sessions) {
      const key = formatSessionDate(s.startTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()];
  }, [sessions]);

  if (isPending) return <PageSkeleton />;

  if (selected) {
    return (
      <SessionDetail
        session={selected}
        defMap={defMap}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
      </div>

      {/* Range picker */}
      <div className="px-5 pb-4">
        <div className="flex bg-secondary rounded-xl p-1 gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                range === r.value
                  ? "bg-card text-foreground shadow"
                  : "text-muted-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {grouped.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {grouped.map(([dateLabel, daySessions]) => (
              <section key={dateLabel}>
                <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-2.5">
                  {dateLabel}
                </p>
                <div className="space-y-3">
                  {daySessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      defMap={defMap}
                      onClick={() => setSelected(session)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({ session, defMap, onClick }: {
  session: WorkoutSession;
  defMap: Record<string, any>;
  onClick: () => void;
}) {
  const uniqueNames = [...new Set(session.exercises.map((e) => e.exercise_name ?? "Unknown"))];
  const preview = uniqueNames.slice(0, 3).join(", ") + (uniqueNames.length > 3 ? ` +${uniqueNames.length - 3}` : "");
  const totalVolume = session.exercises.reduce((sum, e) => {
    if (e.weight_kg && e.reps) return sum + e.weight_kg * KG_TO_LBS * e.reps;
    return sum;
  }, 0);
  const muscleGroups = [...new Set(
    session.exercises.flatMap((e) => defMap[(e.exercise_name ?? "").toLowerCase()]?.muscle_groups ?? [])
  )].slice(0, 4);

  return (
    <button onClick={onClick} className="w-full text-left bg-card border border-border rounded-2xl p-4 space-y-3 active:scale-[0.99] transition-transform">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{session.startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
          <span>·</span>
          <span>{sessionDuration(session)}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex gap-5">
        <div>
          <p className="text-2xl font-bold">{session.exercises.length}</p>
          <p className="text-xs text-muted-foreground">sets</p>
        </div>
        {totalVolume > 0 && (
          <div>
            <p className="text-2xl font-bold">{Math.round(totalVolume).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">lbs vol.</p>
          </div>
        )}
      </div>

      <p className="text-sm font-medium truncate">{preview}</p>

      {muscleGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {muscleGroups.map((g) => (
            <span key={g} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
              {g}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function SessionDetail({ session, defMap, onBack }: {
  session: WorkoutSession;
  defMap: Record<string, any>;
  onBack: () => void;
}) {
  const deleteExercise = useDeleteExercise();
  const queryClient = useQueryClient();
  const sessionExerciseIds = useMemo(() => new Set(session.exercises.map((e) => e.id)), [session]);
  const [editExercise, setEditExercise] = useState<EditExercise | undefined>();

  // Pull sets from the live query so edits/deletes reflect immediately
  const { data: allExercises = [] } = useQuery({
    queryKey: ["exercises", "all"],
    queryFn: async () => {
      return getExercises(DEFAULT_USER_ID, { order: "asc" });
    },
  });

  const sets = useMemo(
    () => allExercises.filter((e) => sessionExerciseIds.has(e.id)),
    [allExercises, sessionExerciseIds]
  );

  async function handleDelete(id: string) {
    await deleteExercise.mutateAsync(id);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, typeof session.exercises>();
    for (const ex of sets) {
      const name = ex.exercise_name ?? defMap[ex.exercise_definition_id]?.name ?? "Unknown";
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(ex);
    }
    return [...map.entries()];
  }, [sets, defMap]);

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-5 pt-12 pb-4">
        <button onClick={onBack} className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
          <ChevronRight className="w-4 h-4 rotate-180" /> History
        </button>
        <h1 className="text-2xl font-bold">{formatSessionDate(session.startTime)}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {session.startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {sessionDuration(session)}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
        {grouped.map(([name, sets]) => {
          const def = defMap[name.toLowerCase()];
          return (
            <div key={name} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-primary" strokeWidth={1.8} />
                <p className="font-semibold text-sm">{name}</p>
                {def?.type && <span className="ml-auto text-xs text-muted-foreground capitalize">{def.type}</span>}
              </div>
              <div className="divide-y divide-border">
                {sets.map((ex, i) => {
                  const stats = [
                    ex.reps != null ? `${ex.reps} reps` : null,
                    ex.weight_kg != null ? formatWeight(ex.weight_kg, "lbs") : null,
                    ex.distance_m != null ? `${(ex.distance_m / 1609.344).toFixed(2)} mi` : null,
                    ex.duration_s != null ? formatDuration(ex.duration_s) : null,
                  ].filter(Boolean).join(" · ");
                  return (
                    <div key={ex.id} className="flex items-center px-4 py-3 gap-2">
                      <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                      <span className="text-sm flex-1">{stats || "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(ex.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <button
                        onClick={() => setEditExercise(ex as EditExercise)}
                        className="p-1.5 rounded-lg text-muted-foreground active:text-primary active:bg-primary/10 transition-colors"
                      >
                        <Pencil className="w-4 h-4" strokeWidth={1.8} />
                      </button>
                      <button
                        onClick={() => handleDelete(ex.id)}
                        className="p-1.5 rounded-lg text-muted-foreground active:text-destructive active:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.8} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ManualEntryDrawer
        open={!!editExercise}
        onClose={() => setEditExercise(undefined)}
        onSuccess={() => setEditExercise(undefined)}
        editExercise={editExercise}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-3xl bg-green-500/10 flex items-center justify-center">
        <Clock className="w-8 h-8 text-green-400" strokeWidth={1.5} />
      </div>
      <div>
        <p className="font-semibold text-sm">No Workouts Yet</p>
        <p className="text-xs text-muted-foreground mt-1">Log exercises to see your history here.</p>
      </div>
    </div>
  );
}
