import { requireUser } from "@/lib/auth";
import { asError, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { serializeCall, type CallRow, type LineRow } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const found = await db().execute({
      sql: "SELECT * FROM calls WHERE id = ? AND user_id = ?",
      args: [id, user.id],
    });
    const call = found.rows[0] as CallRow | undefined;
    if (!call) throw new HttpError("Call not found", 404);
    const lines = await db().execute({
      sql: "SELECT * FROM transcript_lines WHERE call_id = ? ORDER BY at ASC",
      args: [id],
    });
    return Response.json({ call: serializeCall(call, lines.rows as unknown as LineRow[]) });
  } catch (err) {
    return asError(err);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      status?: "ringing" | "live" | "ended";
      twilioSid?: string | null;
    };
    const found = await db().execute({
      sql: "SELECT * FROM calls WHERE id = ? AND user_id = ?",
      args: [id, user.id],
    });
    const call = found.rows[0] as CallRow | undefined;
    if (!call) throw new HttpError("Call not found", 404);
    const status = body.status ?? call.status;
    const ended_at = status === "ended" ? Date.now() : call.ended_at;
    const twilio_sid = body.twilioSid === undefined ? call.twilio_sid : body.twilioSid;
    await db().execute({
      sql: "UPDATE calls SET status = ?, ended_at = ?, twilio_sid = ? WHERE id = ?",
      args: [status, ended_at, twilio_sid, id],
    });
    return Response.json({
      call: serializeCall({ ...call, status, ended_at, twilio_sid }),
    });
  } catch (err) {
    return asError(err);
  }
}
