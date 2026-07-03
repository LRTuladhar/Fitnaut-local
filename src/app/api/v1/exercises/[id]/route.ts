import { type NextRequest } from "next/server";
import { validateApiKey, unauthorized } from "@/lib/api-auth";
import { updateExercise, deleteExercise } from "@/db/actions";
import { LBS_TO_KG } from "@/lib/units";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  const fields: Record<string, any> = {};
  if (body.reps !== undefined) fields.reps = body.reps;
  if (body.weight_lbs !== undefined) fields.weight_kg = body.weight_lbs * LBS_TO_KG;
  if (body.weight_kg !== undefined) fields.weight_kg = body.weight_kg;
  if (body.distance_miles !== undefined) fields.distance_m = body.distance_miles * 1609.344;
  if (body.distance_m !== undefined) fields.distance_m = body.distance_m;
  if (body.duration_s !== undefined) fields.duration_s = body.duration_s;
  if (body.notes !== undefined) fields.notes = body.notes;

  if (Object.keys(fields).length === 0) {
    return Response.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }

  await updateExercise(id, fields);
  return Response.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) return unauthorized();

  const { id } = await params;
  await deleteExercise(id);
  return Response.json({ ok: true });
}
