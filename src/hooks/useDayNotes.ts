"use client";

import { useQuery } from "@tanstack/react-query";
import { getDayNotes } from "@/db/actions";
import { useCurrentUser } from "@/components/CurrentUserProvider";

export interface DayNote {
  id: string;
  user_id: string;
  date: string;
  note: string;
  /** "everywhere" (default) | "nutrition" — see src/lib/dayNotes.ts */
  scope?: string;
}

export function useDayNotes() {
  const { currentUserId } = useCurrentUser();
  return useQuery<DayNote[]>({
    queryKey: ["day_notes", currentUserId],
    queryFn: async () => getDayNotes(currentUserId),
  });
}
