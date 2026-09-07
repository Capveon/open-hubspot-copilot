import { requireUser } from "@/lib/auth";
import { asError, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { mintVoiceToken } from "@/lib/twilio-token";
import { e164, pstnEnabled } from "@/lib/telephony";
import { parseContacts, serializeCall, type CallRow, type SessionRow } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const found = await db().execute({
      sql: "SELECT * FROM sessions WHERE id = ? AND user_id = ?",
      args: [id, user.id],
    });
    const session = found.rows[0] as SessionRow | undefined;
    if (!session) throw new HttpError("Session not found", 404);
    if (session.status !== "live") throw new HttpError("Session already ended", 409);

    const contacts = parseContacts(session.contacts_json);
    const contact = contacts[Number(session.idx) || 0];
    if (!contact) throw new HttpError("No contact at this index", 400);
    if (!contact.phone) throw new HttpError("This contact has no phone number", 400);

    const callId = crypto.randomUUID();
    const started_at = Date.now();
    await db().execute({
      sql: `INSERT INTO calls (id, session_id, user_id, contact_json, status, started_at)
            VALUES (?, ?, ?, ?, 'ringing', ?)`,
      args: [callId, session.id, user.id, JSON.stringify(contact), started_at],
    });

    const call = serializeCall({
      id: callId,
      session_id: session.id,
      user_id: user.id,
      contact_json: JSON.stringify(contact),
      status: "ringing",
      started_at,
      ended_at: null,
      twilio_sid: null,
    } satisfies CallRow);

    const identity = `ohc-${user.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32)}`;
    return Response.json({
      call,
      to: e164(contact.phone),
      pstn: pstnEnabled(),
      twilio: pstnEnabled()
        ? { token: mintVoiceToken(identity), identity, from: process.env.TWILIO_CALLER_ID }
        : null,
    });
  } catch (err) {
    return asError(err);
  }
}
