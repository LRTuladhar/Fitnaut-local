import { type NextRequest } from "next/server";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { listUsers } from "@/db/actions";

/**
 * Resolve which user a request is acting for.
 *
 * Order of precedence:
 *   1. `x-user-id` request header (raw UUID or profile name, case-insensitive)
 *   2. `user_id` / `user` query parameter (raw UUID or profile name)
 *   3. `user_id` field on the JSON body
 *   4. DEFAULT_USER_ID (the primary account, Looja)
 *
 * Names are matched against user_profiles.name so callers can pass "jen".
 */
export async function resolveUserId(
  request: NextRequest,
  bodyUserId?: string | null
): Promise<string> {
  const { searchParams } = new URL(request.url);
  const override =
    request.headers.get("x-user-id") ??
    searchParams.get("user_id") ??
    searchParams.get("user") ??
    bodyUserId ??
    null;

  if (!override) return DEFAULT_USER_ID;

  const needle = override.trim().toLowerCase();
  if (!needle) return DEFAULT_USER_ID;

  const users = await listUsers();
  const match = users.find(
    (u) => u.user_id.toLowerCase() === needle || (u.name ?? "").toLowerCase() === needle
  );

  return match?.user_id ?? DEFAULT_USER_ID;
}
