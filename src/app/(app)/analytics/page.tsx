"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getExercises, getHealthMetrics } from "@/db/actions";
import { REFERENCE_BODYWEIGHT_LBS } from "@/lib/constants";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { KG_TO_LBS } from "@/lib/units";
import { useExerciseDefinitions } from "@/hooks/useExercises";
import {
  filterByRange,
  getVolumeByDay,
  getTypeDistribution,
  getMuscleGroupActivity,
  getTopExercises,
  getPersonalRecords,
  getWorkoutDays,
} from "@/lib/analytics";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Trophy, BarChart2 } from "lucide-react";
import WorkoutCalendar from "@/components/analytics/WorkoutCalendar";
import ExerciseTimeline from "@/components/analytics/ExerciseTimeline";
import MuscleFocusTimeline from "@/components/analytics/MuscleFocusTimeline";
import ExerciseProgressTimeline from "@/components/analytics/ExerciseProgressTimeline";
import CalorieTimeline from "@/components/analytics/CalorieTimeline";
import NutritionTimeline from "@/components/analytics/NutritionTimeline";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useDayNotes } from "@/hooks/useDayNotes";
import { NoteMarkers } from "@/components/NoteMarkers";
import { NotesToggle } from "@/components/NotesToggle";

type Range = "week" | "month" | "year" | "all";
const RANGES: { label: string; value: Range }[] = [
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
  { label: "All", value: "all" },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("month");
  const [showNotes, setShowNotes] = useState(false);
  const { data: definitions = [] } = useExerciseDefinitions();
  const { currentUserId } = useCurrentUser();
  const { data: notes = [] } = useDayNotes();

  const { data: allExercises = [], isPending } = useQuery({
    queryKey: ["exercises", "all", currentUserId],
    queryFn: async () => {
      return getExercises(currentUserId, { order: "asc" });
    },
  });

  const exercises = useMemo(() => filterByRange(allExercises, range), [allExercises, range]);

  // Latest logged bodyweight loads reps-based bodyweight movements in the volume chart.
  const { data: healthMetrics = [] } = useQuery({
    queryKey: ["health_metrics", currentUserId],
    queryFn: async () => getHealthMetrics(currentUserId),
  });
  const bodyweightLbs = useMemo(() => {
    const withWeight = healthMetrics.find((m: any) => m.weight_kg != null);
    const bw = withWeight?.weight_kg;
    return bw ? bw * KG_TO_LBS : REFERENCE_BODYWEIGHT_LBS;
  }, [healthMetrics]);

  const volumeData = useMemo(
    () => getVolumeByDay(exercises, { definitions, bodyweightLbs }),
    [exercises, definitions, bodyweightLbs]
  );
  const volumeNotes = useMemo(() => {
    const dates = new Set(volumeData.map((d) => d.date));
    return notes.filter((n) => dates.has(n.date));
  }, [notes, volumeData]);
  const typeData = useMemo(() => getTypeDistribution(exercises, definitions), [exercises, definitions]);
  const muscleData = useMemo(() => getMuscleGroupActivity(exercises, definitions).slice(0, 8), [exercises, definitions]);
  const topExercises = useMemo(() => getTopExercises(exercises, definitions).slice(0, 10), [exercises, definitions]);
  const prs = useMemo(() => getPersonalRecords(exercises), [exercises]);
  const workoutDays = useMemo(() => getWorkoutDays(exercises).length, [exercises]);

  const isEmpty = exercises.length === 0;

  if (isPending) return <PageSkeleton />;

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <NotesToggle checked={showNotes} onChange={setShowNotes} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4">
        {/* Timeline */}
        <ExerciseTimeline exercises={allExercises} definitions={definitions} />

        {/* Muscle focus timeline */}
        <MuscleFocusTimeline exercises={allExercises} definitions={definitions} />

        {/* Exercise progress timeline */}
        <ExerciseProgressTimeline exercises={allExercises} definitions={definitions} />

        {/* Calorie timeline */}
        <CalorieTimeline showNotes={showNotes} />

        {/* Nutrition timeline */}
        <NutritionTimeline showNotes={showNotes} />

        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            {/* Calendar */}
            <Card title="Workout Frequency">
              <WorkoutCalendar exercises={allExercises} definitions={definitions} />
            </Card>

            {/* Range picker */}
            <div className="flex bg-secondary rounded-xl p-1 gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    range === r.value ? "bg-card text-foreground shadow" : "text-muted-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Workouts" value={String(workoutDays)} />
              <StatCard label="Total Sets" value={String(exercises.length)} />
            </div>

            {/* Volume chart */}
            {volumeData.length > 0 && (
              <Card title="Volume (lbs)">
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Σ weight × reps. Dumbbell lifts count both sides (×2); bodyweight lifts use{" "}
                  {Math.round(bodyweightLbs)} lbs × movement factor. Isometric/band work excluded.
                </p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={volumeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#888" }}
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip
                      contentStyle={{ background: "#1c1c1e", border: "none", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => [`${v.toLocaleString()} lbs`, "Volume"]}
                      labelFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    />
                    <Bar dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    {showNotes && <NoteMarkers notes={volumeNotes} resolveX={(d) => d} />}
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Type distribution */}
            {typeData.length > 0 && (
              <Card title="Exercise Types">
                <div className="flex items-center gap-4">
                  <PieChart width={120} height={120}>
                    <Pie
                      data={typeData}
                      cx={55}
                      cy={55}
                      innerRadius={35}
                      outerRadius={55}
                      dataKey="count"
                      strokeWidth={0}
                    >
                      {typeData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="flex-1 space-y-2">
                    {typeData.map((item) => (
                      <div key={item.type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                          <span className="text-xs capitalize">{item.type}</span>
                        </div>
                        <span className="text-xs font-semibold">{item.count}d</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Muscle groups */}
            {muscleData.length > 0 && (
              <Card title="Muscle Groups">
                <ResponsiveContainer width="100%" height={muscleData.length * 32 + 8}>
                  <BarChart
                    data={muscleData}
                    layout="vertical"
                    margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="group"
                      tick={{ fontSize: 11, fill: "#888" }}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1c1c1e", border: "none", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => [`${v} sets`, ""]}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Top exercises + Personal records (side-by-side on wide screens) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topExercises.length > 0 && (
                <Card title="Most Performed">
                  <div className="space-y-2">
                    {topExercises.map((ex, i) => (
                      <div key={ex.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-orange-400 w-5 text-right">{i + 1}</span>
                        <span className="text-sm flex-1 truncate">{ex.name}</span>
                        <div className="text-right whitespace-nowrap">
                          <span className="text-xs font-semibold text-primary">{ex.count}d</span>
                          <span className="text-xs text-muted-foreground"> · {ex.sets} sets</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {prs.length > 0 && (
                <Card title="Personal Records">
                  <div className="space-y-2">
                    {prs.map((pr) => (
                      <div key={pr.name} className="flex items-center gap-3">
                        <Trophy
                          className="w-4 h-4 flex-shrink-0 text-orange-400"
                          strokeWidth={1.8}
                        />
                        <span className="text-sm flex-1 truncate">{pr.name}</span>
                        <div className="text-right whitespace-nowrap">
                          <span className="text-xs font-semibold">{Math.round(pr.weight_lbs)} lbs</span>
                          <span className="text-xs text-muted-foreground"> · {pr.days}d</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 text-center">
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-3xl bg-purple-500/10 flex items-center justify-center">
        <BarChart2 className="w-8 h-8 text-purple-400" strokeWidth={1.5} />
      </div>
      <div>
        <p className="font-semibold text-sm">No Data Yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
          Log some workouts to see your stats here.
        </p>
      </div>
    </div>
  );
}
