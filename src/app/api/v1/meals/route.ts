import { type NextRequest } from "next/server";
import { validateApiKey, unauthorized } from "@/lib/api-auth";
import { getMeals, insertMeal, deleteMeal } from "@/db/actions";
import { DEFAULT_USER_ID, MEAL_TYPES } from "@/lib/constants";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  const data = await getMeals(DEFAULT_USER_ID, { from, to, order });
  return Response.json({ ok: true, data });
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const body = await request.json();
  const { meal_type, description, calories, timestamp, carbs_g, protein_g, fat_g, fiber_g, sugar_g } = body;

  if (typeof description !== "string" || description.trim() === "") {
    return Response.json({ ok: false, error: "description is required" }, { status: 400 });
  }

  if (typeof calories !== "number" || !Number.isFinite(calories) || calories < 0) {
    return Response.json({ ok: false, error: "calories must be a non-negative number" }, { status: 400 });
  }

  if (meal_type != null && !MEAL_TYPES.includes(meal_type)) {
    return Response.json(
      { ok: false, error: `meal_type must be one of: ${MEAL_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const nutrients: Record<string, number | null> = {};
  for (const [key, value] of Object.entries({ carbs_g, protein_g, fat_g, fiber_g, sugar_g })) {
    if (value == null) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return Response.json({ ok: false, error: `${key} must be a non-negative number (grams)` }, { status: 400 });
    }
    nutrients[key] = value;
  }

  const result = await insertMeal({
    userId: DEFAULT_USER_ID,
    description: description.trim(),
    calories: Math.round(calories),
    mealType: meal_type ?? null,
    carbsG: nutrients.carbs_g ?? null,
    proteinG: nutrients.protein_g ?? null,
    fatG: nutrients.fat_g ?? null,
    fiberG: nutrients.fiber_g ?? null,
    sugarG: nutrients.sugar_g ?? null,
    timestamp: timestamp ?? undefined,
  });

  return Response.json({ ok: true, data: result });
}

export async function DELETE(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ ok: false, error: "id is required" }, { status: 400 });
  }

  await deleteMeal(id);
  return Response.json({ ok: true });
}
