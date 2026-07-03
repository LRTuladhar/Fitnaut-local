import { type NextRequest } from "next/server";
import { validateApiKey, unauthorized } from "@/lib/api-auth";
import { getExercises, insertExercise } from "@/db/actions";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { LBS_TO_KG } from "@/lib/units";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  const data = await getExercises(DEFAULT_USER_ID, { from, to, limit, order });
  return Response.json({ ok: true, data });
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const body = await request.json();
  const { exercise_name, reps, weight_lbs, distance_miles, duration_s, notes, timestamp } = body;

  if (!exercise_name) {
    return Response.json({ ok: false, error: "exercise_name is required" }, { status: 400 });
  }

  const weight_kg = weight_lbs != null ? weight_lbs * LBS_TO_KG : undefined;
  const distance_m = distance_miles != null ? distance_miles * 1609.344 : undefined;

  const result = await insertExercise({
    userId: DEFAULT_USER_ID,
    exerciseDefinitionId: exercise_name.toLowerCase().replace(/\s+/g, "-"),
    exerciseName: exercise_name,
    reps: reps ?? null,
    weightKg: weight_kg ?? null,
    distanceM: distance_m ?? null,
    durationS: duration_s ?? null,
    notes: notes ?? null,
    timestamp: timestamp ?? undefined,
  });

  return Response.json({ ok: true, data: result });
}
