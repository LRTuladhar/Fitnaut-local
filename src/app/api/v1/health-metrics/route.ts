import { type NextRequest } from "next/server";
import { validateApiKey, unauthorized } from "@/lib/api-auth";
import { getHealthMetrics, upsertHealthMetric } from "@/db/actions";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { LBS_TO_KG } from "@/lib/units";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  let data = await getHealthMetrics(DEFAULT_USER_ID);

  if (from) {
    data = data.filter((m) => m.date >= from);
  }
  if (to) {
    data = data.filter((m) => m.date <= to);
  }

  return Response.json({ ok: true, data });
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const body = await request.json();
  const { date, weight_lbs, heart_rate, systolic_bp, diastolic_bp, notes } = body;

  if (!date) {
    return Response.json({ ok: false, error: "date is required (YYYY-MM-DD)" }, { status: 400 });
  }

  await upsertHealthMetric({
    userId: DEFAULT_USER_ID,
    date,
    weightKg: weight_lbs != null ? weight_lbs * LBS_TO_KG : null,
    heartRate: heart_rate ?? null,
    systolicBp: systolic_bp ?? null,
    diastolicBp: diastolic_bp ?? null,
    notes: notes ?? null,
  });

  return Response.json({ ok: true });
}
