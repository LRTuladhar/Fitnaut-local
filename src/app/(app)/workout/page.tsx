"use client";

import { useState } from "react";
import { Plus, Dumbbell, Heart, Zap, Trophy, Sparkles } from "lucide-react";
import { SwipeToDelete } from "@/components/ui/swipe-to-delete";
import { useDeleteExercise } from "@/hooks/useExercises";
import ManualEntryDrawer, { type EditExercise } from "@/components/workout/ManualEntryDrawer";
import RecommendationDrawer from "@/components/workout/RecommendationDrawer";
import VoiceButton from "@/components/workout/VoiceButton";
import { useQuery } from "@tanstack/react-query";
import { getTodaysExercises } from "@/db/actions";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { formatWeight, formatDuration } from "@/lib/units";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useExerciseDefinitions, useLogExercise } from "@/hooks/useExercises";
import { parseExercise } from "@/lib/exerciseParser";
import { LBS_TO_KG } from "@/lib/units";
import { Skeleton } from "@/components/ui/skeleton";

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  strength:    { color: "text-blue-400",   bg: "bg-blue-500/15",   icon: Dumbbell },
  cardio:      { color: "text-red-400",    bg: "bg-red-500/15",    icon: Heart },
  flexibility: { color: "text-purple-400", bg: "bg-purple-500/15", icon: Zap },
  sports:      { color: "text-green-400",  bg: "bg-green-500/15",  icon: Trophy },
};

function getTypeConfig(type?: string) {
  return TYPE_CONFIG[type ?? ""] ?? TYPE_CONFIG.strength;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function WorkoutPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editExercise, setEditExercise] = useState<EditExercise | undefined>();
  const [recOpen, setRecOpen] = useState(false);
  const { data: definitions = [] } = useExerciseDefinitions();
  const logExercise = useLogExercise();

  const { data: todayExercises = [], isPending: loadingExercises, refetch } = useQuery({
    queryKey: ["exercises", "today"],
    queryFn: async () => {
      return getTodaysExercises(DEFAULT_USER_ID);
    },
  });

  const isActiveSession = todayExercises.length > 0 &&
    Date.now() - new Date(todayExercises[0].timestamp).getTime() < 3 * 60 * 60 * 1000;

  async function handleVoiceResult(text: string) {
    const parsed = parseExercise(text, definitions);
    if (!parsed) throw new Error(`Couldn't identify an exercise in "${text}"`);
    await logExercise.mutateAsync({
      exercise_definition_id: parsed.definition.id,
      exercise_name: parsed.definition.name,
      reps: parsed.reps,
      weight_kg: parsed.weight_lbs != null ? parsed.weight_lbs * LBS_TO_KG : undefined,
      distance_m: parsed.distance_m,
      duration_s: parsed.duration_s,
    });
    if (navigator.vibrate) navigator.vibrate(50);
    refetch();
  }

  const speech = useSpeechRecognition(handleVoiceResult);

  function handleVoicePress() {
    if (speech.state === "listening") {
      speech.stop();
    } else {
      speech.reset();
      speech.start();
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-5 pt-12 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workout</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{todayLabel()}</p>
        </div>
        <button onClick={() => setRecOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold active:scale-95 transition-transform mt-1">
          <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
          Suggest
        </button>
      </div>
      <div className="px-5">
        {isActiveSession && (
          <div className="flex items-center gap-2 mt-3">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs font-medium text-green-400">Active Session</span>
          </div>
        )}
      </div>

      {/* Voice button */}
      <div className="flex flex-col items-center py-6 gap-3">
        <VoiceButton state={speech.state} onPress={handleVoicePress} />
        {speech.transcript && speech.state !== "idle" && (
          <p className="text-xs text-muted-foreground max-w-[240px] text-center italic">
            "{speech.transcript}"
          </p>
        )}
        {speech.error && (
          <p className="text-xs text-destructive max-w-[240px] text-center">
            {speech.error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 px-5 mb-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="px-5 pb-5">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center justify-center gap-2.5 w-full rounded-2xl bg-secondary py-3.5 text-sm font-semibold active:scale-[0.98] transition-transform"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Log Manually
        </button>
      </div>

      <div className="flex-1 px-5 pb-6">
        {loadingExercises ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : todayExercises.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Today · {todayExercises.length} {todayExercises.length === 1 ? "set" : "sets"}
            </p>
            {todayExercises.map((ex: any) => (
              <ExerciseRow key={ex.id} exercise={ex} definitions={definitions} onDeleted={refetch}
                onEdit={(e) => { setEditExercise(e); setDrawerOpen(true); }} />
            ))}
          </div>
        )}
      </div>

      <ManualEntryDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditExercise(undefined); }}
        onSuccess={() => refetch()}
        editExercise={editExercise}
      />

      <RecommendationDrawer
        open={recOpen}
        onClose={() => setRecOpen(false)}
        exerciseLibrary={definitions}
        onLogRecommendation={(prefill) => {
          setEditExercise(prefill);
          setRecOpen(false);
          setDrawerOpen(true);
        }}
      />
    </div>
  );
}

function ExerciseRow({ exercise, definitions, onDeleted, onEdit }: { exercise: any; definitions: any[]; onDeleted: () => void; onEdit: (ex: EditExercise) => void }) {
  const def = definitions.find((d) => d.name.toLowerCase() === (exercise.exercise_name ?? "").toLowerCase());
  const config = getTypeConfig(def?.type);
  const Icon = config.icon;
  const deleteExercise = useDeleteExercise();

  const stats = [
    exercise.reps != null ? `${exercise.reps} reps` : null,
    exercise.weight_kg != null ? formatWeight(exercise.weight_kg, "lbs") : null,
    exercise.distance_m != null ? `${(exercise.distance_m / 1609.344).toFixed(2)} mi` : null,
    exercise.duration_s != null ? formatDuration(exercise.duration_s) : null,
  ].filter(Boolean).join("  ·  ");

  const time = new Date(exercise.timestamp).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });

  return (
    <SwipeToDelete onDelete={async () => { await deleteExercise.mutateAsync(exercise.id); onDeleted(); }}>
      <div className="flex items-center gap-3.5 bg-card px-4 py-3.5 border border-border rounded-2xl"
        onClick={() => onEdit(exercise)}>
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ${config.bg}`}>
          <Icon className={`w-5 h-5 ${config.color}`} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{exercise.exercise_name}</p>
          {stats && <p className="text-xs text-muted-foreground mt-0.5">{stats}</p>}
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0">{time}</span>
      </div>
    </SwipeToDelete>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
      <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center">
        <Dumbbell className="w-8 h-8 text-blue-400" strokeWidth={1.5} />
      </div>
      <div>
        <p className="font-semibold text-sm">Start Your Workout</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
          Tap the mic and say "10 squats at 135 pounds"
        </p>
      </div>
    </div>
  );
}
