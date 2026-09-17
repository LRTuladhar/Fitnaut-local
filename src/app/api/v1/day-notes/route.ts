import { type NextRequest } from "next/server";
import { validateApiKey, unauthorized } from "@/lib/api-auth";
import { resolveUserId } from "@/lib/api-user";
import {
  getDayNotes,
  upsertDayNote,
  deleteDayNoteById,
  deleteDayNoteByDate,
} from "@/db/actions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const userId = await resolveUserId(request);
  const data = await getDayNotes(userId);
  return Response.json({ ok: true, data });
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const body = await request.json();
  const userId = await resolveUserId(request, body.user_id);
  const { date, note } = body;

  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return Response.json(
      { ok: false, error: "date must be a YYYY-MM-DD string" },
      { status: 400 }
    );
  }

  if (typeof note !== "string" || note.trim() === "") {
    return Response.json({ ok: false, error: "note is required" }, { status: 400 });
  }

  const result = await upsertDayNote({ userId, date, note: note.trim() });
  return Response.json({ ok: true, data: result });
}

export async function DELETE(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const date = searchParams.get("date");

  if (id) {
    await deleteDayNoteById(id);
    return Response.json({ ok: true });
  }

  if (date) {
    if (!DATE_RE.test(date)) {
      return Response.json(
        { ok: false, error: "date must be a YYYY-MM-DD string" },
        { status: 400 }
      );
    }
    const userId = await resolveUserId(request);
    await deleteDayNoteByDate(userId, date);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "id or date is required" }, { status: 400 });
}
