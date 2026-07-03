import { NextResponse, type NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import db from "@/db";
import { exercises, userProfiles, userApiKeys } from "@/db/schema";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { groupIntoSessions } from "@/lib/sessionGrouping";
import { parseExercise } from "@/lib/exerciseParser";

export async function POST(request: NextRequest) {
  const { provider = "openrouter", exerciseLibrary, comment } = await request.json();
  const userId = DEFAULT_USER_ID;

  // Load API key
  const keyRow = db
    .select()
    .from(userApiKeys)
    .where(eq(userApiKeys.user_id, userId))
    .get();

  const apiKey = provider === "anthropic"
    ? keyRow?.anthropic_key_encrypted
    : keyRow?.openrouter_key_encrypted;

  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured. Add it in Settings." }, { status: 400 });
  }

  // Load last 200 exercises
  const exerciseRows = db
    .select()
    .from(exercises)
    .where(eq(exercises.user_id, userId))
    .orderBy(desc(exercises.timestamp))
    .limit(200)
    .all();

  const sessions = groupIntoSessions(exerciseRows ?? []).slice(0, 5);

  // Load user profile
  const profile = db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.user_id, userId))
    .get();

  // Build prompt
  const prompt = buildPrompt(profile, sessions, exerciseLibrary, comment);

  // Call AI provider
  let result: { workoutSummary: string; recommendations: RecommendationItem[] };

  try {
    if (provider === "anthropic") {
      result = await callAnthropic(apiKey, prompt);
    } else {
      result = await callOpenRouter(apiKey, prompt);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "AI request failed" }, { status: 502 });
  }

  // Fuzzy-match exercise names back to library
  const matched = result.recommendations
    .map((item) => {
      const parsed = parseExercise(item.exerciseName, exerciseLibrary);
      return {
        ...item,
        definition: parsed?.definition ?? null,
        matchedName: parsed?.definition?.name ?? item.exerciseName,
      };
    })
    .filter((r) => r.definition !== null);

  return NextResponse.json({ workoutSummary: result.workoutSummary, recommendations: matched });
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(profile: any, sessions: any[], library: any[], comment?: string) {
  let p = comment?.trim() ? `${comment.trim()}\n\n` : "";
  p += "User Profile:\n";
  if (profile?.name) p += `- Name: ${profile.name}\n`;
  if (profile?.year_of_birth) p += `- Age: ${new Date().getFullYear() - profile.year_of_birth}\n`;
  if (profile?.gender) p += `- Gender: ${profile.gender}\n`;
  if (profile?.fitness_goals?.length) {
    const goals = typeof profile.fitness_goals === "string"
      ? JSON.parse(profile.fitness_goals)
      : profile.fitness_goals;
    if (goals.length) p += `- Goals: ${goals.join(", ")}\n`;
  }
  if (!profile?.name && !profile?.fitness_goals?.length) p += "- No profile set\n";
  p += "\n";

  p += "Recent Workout History (Last 5 Sessions):\n";
  if (sessions.length) {
    sessions.forEach((s, i) => {
      const date = new Date(s.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      p += `Session ${i + 1} — ${date}:\n`;
      const grouped = new Map<string, typeof s.exercises>();
      for (const ex of s.exercises) {
        const name = ex.exercise_name ?? ex.exercise_definition_id;
        if (!grouped.has(name)) grouped.set(name, []);
        grouped.get(name)!.push(ex);
      }
      for (const [name, sets] of grouped) {
        const avgReps = avg(sets.map((e: any) => e.reps).filter(Boolean));
        const avgWeight = avg(sets.map((e: any) => e.weight_kg ? e.weight_kg * 2.20462 : null).filter(Boolean));
        if (avgReps && avgWeight) p += `  - ${name}: ${sets.length} sets × ${Math.round(avgReps)} reps @ ${Math.round(avgWeight)} lbs\n`;
        else if (avgReps) p += `  - ${name}: ${sets.length} sets × ${Math.round(avgReps)} reps\n`;
        else p += `  - ${name}: ${sets.length} sets\n`;
      }
    });
  } else {
    p += "- No recent history\n";
  }
  p += "\n";

  p += "Available Exercise Library:\n";
  const byType = new Map<string, string[]>();
  for (const e of library) {
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type)!.push(e.name);
  }
  for (const [type, names] of byType) {
    p += `${type}:\n${names.map((n: string) => `  - ${n}`).join("\n")}\n`;
  }
  p += "\n";

  p += `Task: Recommend 4-6 exercises for today's workout based on the above. Avoid muscle groups trained in the last 48 hours. Respond in valid JSON only:
{
  "workoutSummary": "2-3 sentence explanation of today's focus",
  "recommendations": [
    { "exerciseName": "exact name from library", "sets": 3, "reps": 10, "weightLbs": 135.0, "reasoning": "1-2 sentences" }
  ]
}`;

  return p;
}

// ─── Provider clients ─────────────────────────────────────────────────────────

interface RecommendationItem {
  exerciseName: string;
  sets?: number;
  reps?: number;
  weightLbs?: number;
  reasoning: string;
}

const SYSTEM = `You are an expert fitness coach. Only recommend exercises from the provided library. Respond with a JSON object only — no markdown, no extra text.`;

async function callOpenRouter(apiKey: string, prompt: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function callAnthropic(apiKey: string, prompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.content[0].text);
}

function avg(nums: (number | null | undefined)[]): number | null {
  const valid = nums.filter((n): n is number => n != null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}
