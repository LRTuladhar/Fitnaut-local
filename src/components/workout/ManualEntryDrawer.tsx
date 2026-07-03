"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { BottomSheet, BottomSheetHeader, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, Minus, Plus } from "lucide-react";
import { useExerciseDefinitions, useLastExerciseSet, useLogExercise, useRecentExercises, useUpdateExercise } from "@/hooks/useExercises";
import type { ExerciseDefinition } from "@/lib/exerciseParser";
import { LBS_TO_KG, KG_TO_LBS } from "@/lib/units";
import { useToast } from "@/components/ui/toast";

type Step = "pick" | "log";

export interface EditExercise {
  id: string;
  exercise_definition_id: string;
  exercise_name: string;
  reps: number | null;
  weight_kg: number | null;
  distance_m: number | null;
  duration_s: number | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editExercise?: EditExercise; // when set, skip picker and pre-fill
}

export default function ManualEntryDrawer({ open, onClose, onSuccess, editExercise }: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ExerciseDefinition | null>(null);
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">("lbs");
  const { data: definitions = [] } = useExerciseDefinitions();
  const { data: recentIds = [] } = useRecentExercises();
  const { data: lastSet, isLoading: lastSetPending } = useLastExerciseSet(!editExercise && selected ? selected.name : null);
  const logExercise = useLogExercise();
  const updateExercise = useUpdateExercise();
  const { toast } = useToast();

  // When editing, jump straight to log form with the matching definition
  useEffect(() => {
    if (open && editExercise && definitions.length > 0) {
      const def = definitions.find((d) => d.id === editExercise.exercise_definition_id)
        ?? { id: editExercise.exercise_definition_id, name: editExercise.exercise_name, alternate_names: [], type: "strength", muscle_groups: [], category: "", expected_parameters: [] };
      setSelected(def as ExerciseDefinition);
      setStep("log");
    }
  }, [open, editExercise, definitions]);

  const recentDefs = useMemo(
    () => recentIds.flatMap((id) => definitions.filter((d) => d.id === id)),
    [recentIds, definitions]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return definitions
      .filter((d) => d.name.toLowerCase().includes(q) || d.alternate_names.some((a) => a.toLowerCase().includes(q)));
  }, [search, definitions]);

  const grouped = useMemo(() => {
    if (search.trim()) return null;
    const order = ["strength", "cardio", "sports", "flexibility"];
    const map = new Map<string, ExerciseDefinition[]>();
    for (const def of definitions) {
      const key = def.type ?? "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(def);
    }
    return order.filter((t) => map.has(t)).map((t) => ({ type: t, exercises: map.get(t)! }));
  }, [search, definitions]);

  function pickExercise(def: ExerciseDefinition) {
    setSelected(def);
    setStep("log");
  }

  function handleClose() {
    setStep("pick");
    setSearch("");
    setSelected(null);
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={handleClose}>
      {step === "pick" ? (
        <ExercisePicker
          search={search}
          onSearch={setSearch}
          filtered={filtered}
          grouped={grouped}
          recent={recentDefs}
          onPick={pickExercise}
        />
      ) : selected ? (
        lastSetPending ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) :
        <LogForm
          definition={selected}
          prefill={editExercise ?? null}
          lastSet={lastSet ?? null}
          weightUnit={weightUnit}
          onWeightUnitToggle={() => setWeightUnit((u) => (u === "lbs" ? "kg" : "lbs"))}
          onBack={editExercise ? handleClose : () => setStep("pick")}
          isEditing={!!editExercise?.id}
          onSubmit={async (values) => {
            try {
              if (editExercise?.id) {
                await updateExercise.mutateAsync({ id: editExercise.id, ...values });
                toast("Set updated");
              } else {
                await logExercise.mutateAsync({
                  exercise_definition_id: selected.id,
                  exercise_name: selected.name,
                  reps: values.reps ?? undefined,
                  weight_kg: values.weight_kg ?? undefined,
                  distance_m: values.distance_m ?? undefined,
                  duration_s: values.duration_s ?? undefined,
                  notes: values.notes ?? undefined,
                });
                if (navigator.vibrate) navigator.vibrate(50);
                toast(`${selected.name} logged`);
              }
              onSuccess();
              handleClose();
            } catch (e: any) {
              toast(e?.message ?? "Failed to save. Try again.", "error");
            }
          }}
          loading={logExercise.isPending || updateExercise.isPending}
        />
      ) : null}
    </BottomSheet>
  );
}

const TYPE_LABEL: Record<string, string> = {
  strength: "Strength",
  cardio: "Cardio",
  sports: "Sports",
  flexibility: "Flexibility",
};

function ExerciseList({ exercises, onPick }: { exercises: ExerciseDefinition[]; onPick: (d: ExerciseDefinition) => void }) {
  return (
    <ul className="space-y-0.5">
      {exercises.map((def) => (
        <li key={def.id}>
          <button onClick={() => onPick(def)}
            className="w-full text-left px-1 py-3 flex items-center justify-between border-b border-border/50 last:border-0 active:bg-secondary/50 rounded-lg transition-colors">
            <div>
              <p className="text-sm font-medium">{def.name}</p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">
                {def.muscle_groups?.length ? def.muscle_groups.slice(0, 2).join(", ") : def.type}
              </p>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 flex-shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ExercisePicker({ search, onSearch, filtered, grouped, recent, onPick }: {
  search: string;
  onSearch: (s: string) => void;
  filtered: ExerciseDefinition[];
  grouped: { type: string; exercises: ExerciseDefinition[] }[] | null;
  recent: ExerciseDefinition[];
  onPick: (d: ExerciseDefinition) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <BottomSheetHeader>
        <BottomSheetTitle>Choose Exercise</BottomSheetTitle>
      </BottomSheetHeader>
      <div className="px-4 pb-3 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search exercises…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9 bg-secondary border-0 text-sm h-10 rounded-xl"
          />
        </div>
      </div>
      <div className="overflow-y-auto px-4 pb-8 space-y-5" style={{ WebkitOverflowScrolling: "touch" } as any}>
        {recent.length > 0 && !search && (
          <section>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Recent</p>
            <div className="flex flex-wrap gap-2">
              {recent.map((def) => (
                <button key={def.id} onClick={() => onPick(def)}
                  className="px-3.5 py-1.5 rounded-full bg-secondary text-sm font-medium active:scale-95 transition-transform">
                  {def.name}
                </button>
              ))}
            </div>
          </section>
        )}
        {grouped ? (
          grouped.map(({ type, exercises }) => (
            <section key={type}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">
                {TYPE_LABEL[type] ?? type}
              </p>
              <ExerciseList exercises={exercises} onPick={onPick} />
            </section>
          ))
        ) : (
          <section>
            <ExerciseList exercises={filtered} onPick={onPick} />
          </section>
        )}
      </div>
    </div>
  );
}

interface LogValues {
  reps?: number | null;
  weight_kg?: number | null;
  distance_m?: number | null;
  duration_s?: number | null;
  notes?: string | null;
}

function LogForm({ definition, prefill, lastSet, weightUnit, onWeightUnitToggle, onBack, onSubmit, loading, isEditing }: {
  definition: ExerciseDefinition;
  prefill: EditExercise | null;
  lastSet: { reps: number | null; weight_kg: number | null; distance_m: number | null; duration_s: number | null } | null;
  weightUnit: "lbs" | "kg";
  onWeightUnitToggle: () => void;
  onBack: () => void;
  onSubmit: (v: LogValues) => Promise<void>;
  loading: boolean;
  isEditing: boolean;
}) {
  const params = definition.expected_parameters ?? [];

  const source = prefill ?? lastSet;
  const initReps = source?.reps ?? 10;
  const initWeight = source?.weight_kg != null
    ? (weightUnit === "lbs" ? Math.round(source.weight_kg * KG_TO_LBS) : source.weight_kg)
    : 0;
  const initDistance = source?.distance_m != null ? String((source.distance_m / 1609.344).toFixed(2)) : "";
  const initMin = source?.duration_s != null ? String(Math.floor(source.duration_s / 60)) : "";
  const initSec = source?.duration_s != null ? String(source.duration_s % 60) : "";
  const initNotes = prefill?.notes ?? "";

  const [reps, setReps] = useState(initReps);
  const [weight, setWeight] = useState(initWeight);
  const [distance, setDistance] = useState(initDistance);
  const [durationMin, setDurationMin] = useState(initMin);
  const [durationSec, setDurationSec] = useState(initSec);
  const [notes, setNotes] = useState(initNotes);

  const adjustWeight = useCallback((delta: number) => {
    setWeight((w) => Math.max(0, parseFloat((w + delta).toFixed(1))));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const values: LogValues = {};
    if (params.includes("reps")) values.reps = reps;
    if (params.includes("weight")) values.weight_kg = weight > 0 ? (weightUnit === "lbs" ? weight * LBS_TO_KG : weight) : null;
    if (params.includes("distance")) values.distance_m = distance ? parseFloat(distance) * 1609.344 : null;
    if (params.includes("duration")) {
      const s = (parseInt(durationMin || "0", 10) * 60) + parseInt(durationSec || "0", 10);
      values.duration_s = s > 0 ? s : null;
    }
    values.notes = notes.trim() || null;
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
      <BottomSheetHeader>
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground mb-2 -ml-1">
          <ChevronLeft className="w-4 h-4" /> {isEditing ? "Cancel" : "Back"}
        </button>
        <BottomSheetTitle>{definition.name}</BottomSheetTitle>
        <p className="text-xs text-muted-foreground capitalize mt-0.5">
          {definition.type}{definition.muscle_groups?.length ? ` · ${definition.muscle_groups.join(", ")}` : ""}
        </p>
      </BottomSheetHeader>

      <div className="overflow-y-auto px-4 pb-4 space-y-5" style={{ WebkitOverflowScrolling: "touch" } as any}>
        {params.includes("reps") && (
          <Field label="Reps">
            <div className="flex items-center gap-3">
              <StepButton icon={<Minus className="w-4 h-4" />} onClick={() => setReps((r) => Math.max(1, r - 1))} />
              <div className="flex-1 bg-secondary rounded-2xl py-4 text-center">
                <span className="text-4xl font-bold tabular-nums">{reps}</span>
              </div>
              <StepButton icon={<Plus className="w-4 h-4" />} onClick={() => setReps((r) => r + 1)} />
            </div>
          </Field>
        )}

        {params.includes("weight") && (
          <Field label={
            <div className="flex items-center justify-between">
              <span>Weight</span>
              <button type="button" onClick={onWeightUnitToggle}
                className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary font-semibold">
                {weightUnit}
              </button>
            </div>
          }>
            <div className="flex items-center gap-3">
              <StepButton icon={<Minus className="w-4 h-4" />} onClick={() => adjustWeight(-5)} />
              <div className="flex-1 bg-secondary rounded-2xl py-4 text-center">
                <span className="text-4xl font-bold tabular-nums">{weight % 1 === 0 ? weight : weight.toFixed(1)}</span>
              </div>
              <StepButton icon={<Plus className="w-4 h-4" />} onClick={() => adjustWeight(5)} />
            </div>
          </Field>
        )}

        {params.includes("distance") && (
          <Field label="Distance (mi)">
            <Input type="number" inputMode="decimal" placeholder="0.0" value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="text-2xl font-bold text-center bg-secondary border-0 rounded-2xl h-16" />
          </Field>
        )}

        {params.includes("duration") && (
          <Field label="Duration">
            <div className="flex gap-2 items-center">
              <div className="flex-1 bg-secondary rounded-2xl py-4 flex flex-col items-center gap-1">
                <input type="number" inputMode="numeric" placeholder="0" value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  className="w-full text-center text-4xl font-bold bg-transparent outline-none" />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
              <span className="text-2xl font-bold text-muted-foreground">:</span>
              <div className="flex-1 bg-secondary rounded-2xl py-4 flex flex-col items-center gap-1">
                <input type="number" inputMode="numeric" placeholder="0" value={durationSec}
                  onChange={(e) => setDurationSec(e.target.value)}
                  className="w-full text-center text-4xl font-bold bg-transparent outline-none" />
                <span className="text-xs text-muted-foreground">sec</span>
              </div>
            </div>
          </Field>
        )}

        <Field label="Notes (optional)">
          <Input placeholder="e.g. felt strong today" value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-secondary border-0 rounded-xl" />
        </Field>
      </div>

      <div className="px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] flex-shrink-0">
        <Button type="submit" className="w-full h-14 text-base font-semibold rounded-2xl bg-primary shadow-lg shadow-blue-500/20" disabled={loading}>
          {loading ? "Saving…" : isEditing ? "Save Changes" : "Log Set"}
        </Button>
      </div>
    </form>
  );
}

function StepButton({ icon, onClick }: { icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center active:scale-90 transition-transform flex-shrink-0">
      {icon}
    </button>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</div>
      {children}
    </div>
  );
}
