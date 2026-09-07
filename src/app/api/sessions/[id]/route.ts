import { requireUser } from "@/lib/auth";
import { asError, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { serializeCall, serializeSession, type CallRow, type LineRow, type SessionRow } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const found = await db().execute({
      sql: "SELECT * FROM sessions WHERE id = ? AND user_id = ?",
      args: [id, user.id],
    });
    const session = found.rows[0] as SessionRow | undefined;
    if (!session) throw new HttpError("Session not found", 404);

    const callRows = await db().execute({
      sql: "SELECT * FROM calls WHERE session_id = ? ORDER BY started_at ASC",
      args: [id],
    });
    const calls: ReturnType<typeof serializeCall>[] = [];
    for (const raw of callRows.rows) {
      const call = raw as CallRow;
      const lines = await db().execute({
        sql: "SELECT * FROM transcript_lines WHERE call_id = ? ORDER BY at ASC",
        args: [call.id],
      });
      calls.push(serializeCall(call, lines.rows as unknown as LineRow[]));
    }
    return Response.json({ session: serializeSession(session, { calls, callCount: calls.length }) });
  } catch (err) {
    return asError(err);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as { index?: number; status?: "live" | "ended" };
    const found = await db().execute({
      sql: "SELECT * FROM sessions WHERE id = ? AND user_id = ?",
      args: [id, user.id],
    });
    const session = found.rows[0] as SessionRow | undefined;
    if (!session) throw new HttpError("Session not found", 404);

    const index = body.index == null ? session.idx : Math.max(0, Number(body.index));
    const status = body.status ?? session.status;
    const ended_at = status === "ended" ? Date.now() : session.ended_at;
    await db().execute({
      sql: "UPDATE sessions SET idx = ?, status = ?, ended_at = ? WHERE id = ?",
      args: [index, status, ended_at, id],
    });
    return Response.json({
      session: serializeSession({ ...session, idx: index, status, ended_at }),
    });
  } catch (err) {
    return asError(err);
  }
}
