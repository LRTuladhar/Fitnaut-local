"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getExercises } from "@/db/actions";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { toLocalDateKey } from "@/lib/dayNotes";

/** Exercise name used for golf rounds (canonical library name). */
const GOLF_EXERCISE_NAME = "Golf Round";

/**
 * Set of local YYYY-MM-DD dates on which a golf round was logged.
 * Reuses the same react-query cache entry as the analytics page, so this is
 * free when the exercises are already loaded.
 */
export function useGolfDays(): Set<string> {
  const { currentUserId } = useCurrentUser();
  const { data: exercises = [] } = useQuery({
    queryKey: ["exercises", "all", currentUserId],
    queryFn: async () => getExercises(currentUserId, { order: "asc" }),
  });

  return useMemo(
    () =>
      new Set(
        (exercises as Array<{ exercise_name?: string; timestamp?: string | Date }>)
          .filter((e) => e.exercise_name === GOLF_EXERCISE_NAME && e.timestamp != null)
          .map((e) => toLocalDateKey(e.timestamp as string | Date))
      ),
    [exercises]
  );
}
