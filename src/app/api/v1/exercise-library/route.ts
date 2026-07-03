import { type NextRequest } from "next/server";
import { validateApiKey, unauthorized } from "@/lib/api-auth";
import { readFileSync } from "fs";
import { join } from "path";

let cached: any = null;

function loadLibrary() {
  if (cached) return cached;
  const raw = readFileSync(join(process.cwd(), "public/exercise-library.json"), "utf-8");
  cached = JSON.parse(raw);
  return cached;
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const library = loadLibrary();
  return Response.json({ ok: true, data: library.exercises });
}
