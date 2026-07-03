import { type NextRequest } from "next/server";

export function validateApiKey(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  if (!auth) return false;

  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return false;

  const key = parts[1];
  return key === process.env.FITNAUT_API_KEY;
}

export function unauthorized() {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
