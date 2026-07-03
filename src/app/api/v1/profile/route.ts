import { type NextRequest } from "next/server";
import { validateApiKey, unauthorized } from "@/lib/api-auth";
import db from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_USER_ID } from "@/lib/constants";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const profile = db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.user_id, DEFAULT_USER_ID))
    .get();

  return Response.json({ ok: true, data: profile ?? null });
}

export async function PUT(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const body = await request.json();
  const fields: Record<string, any> = {};

  if (body.name !== undefined) fields.name = body.name;
  if (body.year_of_birth !== undefined) fields.year_of_birth = body.year_of_birth;
  if (body.gender !== undefined) fields.gender = body.gender;
  if (body.fitness_goals !== undefined) {
    fields.fitness_goals = Array.isArray(body.fitness_goals)
      ? JSON.stringify(body.fitness_goals)
      : body.fitness_goals;
  }

  if (Object.keys(fields).length === 0) {
    return Response.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }

  const existing = db
    .select({ user_id: userProfiles.user_id })
    .from(userProfiles)
    .where(eq(userProfiles.user_id, DEFAULT_USER_ID))
    .get();

  if (existing) {
    db.update(userProfiles)
      .set(fields)
      .where(eq(userProfiles.user_id, DEFAULT_USER_ID))
      .run();
  } else {
    db.insert(userProfiles)
      .values({ user_id: DEFAULT_USER_ID, ...fields })
      .run();
  }

  return Response.json({ ok: true });
}
