import { requireUser } from "@/lib/auth";
import { asError, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import type { CallRow, LineRow } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      role?: "you" | "them";
      text?: string;
      source?: string;
    };
    const text = body.text?.trim();
    if (!text) throw new HttpError("text required", 400);
    const role = body.role === "you" ? "you" : "them";
    const found = await db().execute({
      sql: "SELECT id FROM calls WHERE id = ? AND user_id = ?",
      args: [id, user.id],
    });
    if (!found.rows[0]) throw new HttpError("Call not found", 404);
    const line: LineRow = {
      id: crypto.randomUUID(),
      call_id: id,
      role,
      text,
      source: body.source?.trim() || "typed",
      at: Date.now(),
    };
    await db().execute({
      sql: `INSERT INTO transcript_lines (id, call_id, role, text, source, at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [line.id, line.call_id, line.role, line.text, line.source, line.at],
    });
    return Response.json({ line });
  } catch (err) {
    return asError(err);
  }
}
