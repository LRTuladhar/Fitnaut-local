import { NextResponse, type NextRequest } from "next/server";
import { upsertUserApiKey } from "@/db/actions";
import { DEFAULT_USER_ID } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const { provider, key } = await request.json();
  await upsertUserApiKey(DEFAULT_USER_ID, provider, key);
  return NextResponse.json({ ok: true });
}
