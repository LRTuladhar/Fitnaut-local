"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  insertExercise,
  updateExercise,
  deleteExercise,
  getLastExerciseSet,
  getRecentExercises,
} from "@/db/actions";
import { DEFAULT_USER_ID } from "@/lib/constants";
import type { ExerciseDefinition } from "@/lib/exerciseParser";

export function useExerciseDefinitions() {
  return useQuery({
    queryKey: ["exercise-definitions"],
    queryFn: async (): Promise<ExerciseDefinition[]> => {
      const res = await fetch("/exercise-library.json");
      const data = await res.json();
      return data.exercises.map((e: any) => ({
        id: (e.name as string).toLowerCase().replace(/\s+/g, "-"),
        name: e.name,
        alternate_names: e.alternateNames ?? [],
        type: e.type,
        muscle_groups: e.muscleGroups ?? [],
        category: e.category ?? "",
        expected_parameters: e.expectedParameters ?? [],
      }));
    },
    staleTime: Infinity,
  });
}

export interface LogExerciseInput {
  exercise_definition_id: string;
  exercise_name: string;
  reps?: number;
  weight_kg?: number;
  distance_m?: number;
  duration_s?: number;
  notes?: string;
}

export function useLogExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogExerciseInput) => {
      const data = await insertExercise({
        userId: DEFAULT_USER_ID,
        exerciseDefinitionId: input.exercise_definition_id,
        exerciseName: input.exercise_name,
        reps: input.reps ?? null,
        weightKg: input.weight_kg ?? null,
        distanceM: input.distance_m ?? null,
        durationS: input.duration_s ?? null,
        notes: input.notes ?? null,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

export interface UpdateExerciseInput {
  id: string;
  reps?: number | null;
  weight_kg?: number | null;
  distance_m?: number | null;
  duration_s?: number | null;
  notes?: string | null;
}

export function useUpdateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateExerciseInput) => {
      const { id, ...fields } = input;
      await updateExercise(id, {
        reps: fields.reps,
        weight_kg: fields.weight_kg,
        distance_m: fields.distance_m,
        duration_s: fields.duration_s,
        notes: fields.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

export function useDeleteExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteExercise(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

export function useLastExerciseSet(exerciseName: string | null) {
  return useQuery({
    queryKey: ["last-set", exerciseName],
    enabled: !!exerciseName,
    staleTime: 0,
    queryFn: async () => {
      if (!exerciseName) return null;
      return getLastExerciseSet(DEFAULT_USER_ID, exerciseName);
    },
  });
}

export function useRecentExercises() {
  return useQuery({
    queryKey: ["exercises", "recent"],
    queryFn: async () => {
      const data = await getRecentExercises(DEFAULT_USER_ID);
      const counts = new Map<string, number>();
      for (const row of data) {
        counts.set(row.exercise_definition_id, (counts.get(row.exercise_definition_id) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id]) => id);
    },
  });
}
