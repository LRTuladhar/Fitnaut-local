import { type NextRequest } from "next/server";
import { getHeartRate, getSleepTimeline, getSleepDetail, getSleepHourly, getDailySteps } from "@/lib/pebble";

// Read-only access to the Pebble watch's health DB for the Health page's
// Pebble subtab. Not gated by FITNAUT_API_KEY — this is an internal endpoint
// the SPA fetches directly (the browser doesn't carry the bearer key).

export const dynamic = "force-dynamic";

function clampHours(v: string | null): number {
  const n = v ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return 24;
  return Math.min(Math.max(n, 1), 720);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hours = clampHours(searchParams.get("hours"));

  try {
    const heartRate = getHeartRate(hours);
    const sleepTimeline = getSleepTimeline();
    const sleepHourly = getSleepHourly();
    const sleepDetail = getSleepDetail();
    const dailySteps = getDailySteps();

    return Response.json({
      ok: true,
      hours,
      heartRate,
      sleepTimeline,
      sleepHourly,
      sleepDetail,
      dailySteps,
    });
  } catch (err: any) {
    // Most likely the Pebble DB file doesn't exist yet (importer never run).
    return Response.json(
      { ok: false, error: err?.message ?? "Failed to read Pebble data" },
      { status: 200 }
    );
  }
}
