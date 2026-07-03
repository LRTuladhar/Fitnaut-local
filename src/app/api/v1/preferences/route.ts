import { type NextRequest } from "next/server";
import { validateApiKey, unauthorized } from "@/lib/api-auth";
import db from "@/db";
import { userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_USER_ID } from "@/lib/constants";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const prefs = db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.user_id, DEFAULT_USER_ID))
    .get();

  return Response.json({ ok: true, data: prefs ?? null });
}

export async function PUT(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const body = await request.json();
  const fields: Record<string, any> = {};

  if (body.weight_unit !== undefined) fields.weight_unit = body.weight_unit;
  if (body.distance_unit !== undefined) fields.distance_unit = body.distance_unit;
  if (body.session_gap_seconds !== undefined) fields.session_gap_seconds = body.session_gap_seconds;
  if (body.default_time_range !== undefined) fields.default_time_range = body.default_time_range;
  if (body.ai_provider !== undefined) fields.ai_provider = body.ai_provider;
  if (body.openrouter_model !== undefined) fields.openrouter_model = body.openrouter_model;

  if (Object.keys(fields).length === 0) {
    return Response.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }

  const existing = db
    .select({ user_id: userPreferences.user_id })
    .from(userPreferences)
    .where(eq(userPreferences.user_id, DEFAULT_USER_ID))
    .get();

  if (existing) {
    db.update(userPreferences)
      .set(fields)
      .where(eq(userPreferences.user_id, DEFAULT_USER_ID))
      .run();
  } else {
    db.insert(userPreferences)
      .values({ user_id: DEFAULT_USER_ID, ...fields })
      .run();
  }

  return Response.json({ ok: true });
}
