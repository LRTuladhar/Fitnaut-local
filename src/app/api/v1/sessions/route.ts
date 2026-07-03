import { type NextRequest } from "next/server";
import { validateApiKey, unauthorized } from "@/lib/api-auth";
import { getExercises } from "@/db/actions";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { groupIntoSessions } from "@/lib/sessionGrouping";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;

  const exercises = await getExercises(DEFAULT_USER_ID, { from, to, order: "asc" });
  const sessions = groupIntoSessions(exercises);

  const data = limit ? sessions.slice(0, limit) : sessions;

  return Response.json({
    ok: true,
    data: data.map((s) => ({
      id: s.id,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      exerciseCount: s.exercises.length,
      exercises: s.exercises,
    })),
  });
}
