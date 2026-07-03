"use client";

import { useState, useEffect, useRef } from "react";
import { BottomSheet, BottomSheetHeader, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { Sparkles, Dumbbell, Plus, Loader2, AlertCircle, MessageSquare } from "lucide-react";
import type { ExerciseDefinition } from "@/lib/exerciseParser";
import type { EditExercise } from "@/components/workout/ManualEntryDrawer";

interface Recommendation {
  exerciseName: string;
  matchedName: string;
  sets?: number;
  reps?: number;
  weightLbs?: number;
  reasoning: string;
  definition: ExerciseDefinition;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onLogRecommendation: (ex: EditExercise, def: ExerciseDefinition) => void;
  exerciseLibrary: ExerciseDefinition[];
}

const ONE_HOUR = 60 * 60 * 1000;

export default function RecommendationDrawer({ open, onClose, onLogRecommendation, exerciseLibrary }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ workoutSummary: string; recommendations: Recommendation[] } | null>(null);
  const [comment, setComment] = useState("");
  const generatedAt = useRef<number | null>(null);

  // Expire stale recommendations when the drawer reopens
  useEffect(() => {
    if (open && generatedAt.current !== null && Date.now() - generatedAt.current > ONE_HOUR) {
      setResult(null);
      generatedAt.current = null;
    }
  }, [open]);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    generatedAt.current = null;

    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openrouter", exerciseLibrary, comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      setResult(data);
      generatedAt.current = Date.now();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  function handleClose() {
    setError(null);
    onClose();
  }

  function handleLog(rec: Recommendation) {
    const prefill: EditExercise = {
      id: "",
      exercise_definition_id: rec.definition.id,
      exercise_name: rec.matchedName,
      reps: rec.reps ?? null,
      weight_kg: rec.weightLbs ? rec.weightLbs * 0.453592 : null,
      distance_m: null,
      duration_s: null,
      notes: null,
    };
    onLogRecommendation(prefill, rec.definition);
    handleClose();
  }

  return (
    <BottomSheet open={open} onClose={handleClose}>
      <div className="flex flex-col min-h-0 flex-1">
        <BottomSheetHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.8} />
            <BottomSheetTitle>AI Recommendations</BottomSheetTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Personalized for today based on your recent sessions.
          </p>
        </BottomSheetHeader>

        <div className="overflow-y-auto px-4 pb-8 space-y-4" style={{ WebkitOverflowScrolling: "touch" } as any}>
          {!result && !loading && !error && (
            <div className="flex flex-col items-center py-8 gap-4 text-center">
              <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-semibold text-sm">Ready to suggest your workout</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                  Analyzes your last 5 sessions to recommend what to train today.
                </p>
              </div>

              <div className="w-full max-w-[260px] space-y-1.5">
                <div className="flex items-center gap-1.5 text-left">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Comments for AI</span>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={300}
                  placeholder='e.g. "I have a sore knee, avoid leg exercises"'
                  rows={3}
                  className="w-full text-xs bg-secondary border-0 rounded-xl p-3 resize-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-[10px] text-muted-foreground/50 text-right">{comment.length}/300</p>
              </div>

              <button onClick={generate}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-semibold text-sm active:scale-95 transition-transform shadow-lg shadow-blue-500/20">
                <Sparkles className="w-4 h-4" />
                Generate Workout
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Analyzing your training history…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center py-8 gap-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-destructive" strokeWidth={1.8} />
              </div>
              <div>
                <p className="font-semibold text-sm">Couldn't generate recommendations</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{error}</p>
              </div>

              <div className="w-full max-w-[260px] space-y-1.5">
                <div className="flex items-center gap-1.5 text-left">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Comments for AI</span>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={300}
                  placeholder='e.g. "I have a sore knee, avoid leg exercises"'
                  rows={3}
                  className="w-full text-xs bg-secondary border-0 rounded-xl p-3 resize-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-[10px] text-muted-foreground/50 text-right">{comment.length}/300</p>
              </div>

              <button onClick={generate}
                className="px-5 py-2.5 rounded-xl bg-secondary text-sm font-semibold active:scale-95 transition-transform">
                Try Again
              </button>
            </div>
          )}

          {result && (
            <>
              {/* Summary */}
              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Today's Focus</p>
                <p className="text-sm leading-relaxed">{result.workoutSummary}</p>
              </div>

              {/* Recommendations */}
              <div className="space-y-3">
                {result.recommendations.map((rec) => (
                  <div key={rec.definition.id + rec.matchedName} className="bg-card border border-border rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Dumbbell className="w-4 h-4 text-primary" strokeWidth={1.8} />
                        </div>
                        <p className="font-semibold text-sm truncate">{rec.matchedName}</p>
                      </div>
                      <button onClick={() => handleLog(rec)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold flex-shrink-0 active:scale-95 transition-transform">
                        <Plus className="w-3 h-3" strokeWidth={2.5} />
                        Log
                      </button>
                    </div>

                    {(rec.sets || rec.reps || rec.weightLbs) && (
                      <div className="flex gap-3">
                        {rec.sets && <Chip label="Sets" value={String(rec.sets)} />}
                        {rec.reps && <Chip label="Reps" value={String(rec.reps)} />}
                        {rec.weightLbs && <Chip label="Weight" value={`${rec.weightLbs} lbs`} />}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground leading-relaxed">{rec.reasoning}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Comments for AI</span>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={300}
                  placeholder='e.g. "I have a sore knee, avoid leg exercises"'
                  rows={2}
                  className="w-full text-xs bg-secondary border-0 rounded-xl p-3 resize-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-[10px] text-muted-foreground/50 text-right">{comment.length}/300</p>
              </div>

              <button onClick={generate}
                className="w-full py-3 rounded-xl bg-secondary text-sm font-semibold text-muted-foreground active:scale-95 transition-transform">
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary rounded-lg px-2.5 py-1.5 text-center">
      <p className="text-xs font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
