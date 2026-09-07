import { requireUser } from "@/lib/auth";
import { asError, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { listQueues, queueContacts, queueName, testQueueById } from "@/lib/hubspot";
import { serializeSession, type SessionRow } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const result = await db().execute({
      sql: `SELECT s.id, s.user_id, s.queue_id, s.queue_name, s.contacts_json, s.idx, s.status, s.created_at, s.ended_at,
                   (SELECT COUNT(*)::int FROM calls c WHERE c.session_id = s.id) AS call_count
            FROM sessions s
            WHERE s.user_id = ?
            ORDER BY s.created_at DESC
            LIMIT 50`,
      args: [user.id],
    });
    return Response.json({
      sessions: result.rows.map((row) => {
        const { call_count, ...rest } = row as SessionRow & { call_count: number };
        return serializeSession(rest as SessionRow, { callCount: Number(call_count) || 0 });
      }),
    });
  } catch (err) {
    return asError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as { queueId?: string };
    const queueId = body.queueId?.trim();
    if (!queueId) throw new HttpError("queueId required", 400);

    const [{ queues }, contacts] = await Promise.all([listQueues(), queueContacts(queueId)]);
    if (contacts.length === 0) throw new HttpError("That queue is empty", 400);
    const name = queueName(queueId, queues) || testQueueById(queueId)?.name || queueId;

    const id = crypto.randomUUID();
    const created_at = Date.now();
    await db().execute({
      sql: `INSERT INTO sessions (id, user_id, queue_id, queue_name, contacts_json, idx, status, created_at)
            VALUES (?, ?, ?, ?, ?, 0, 'live', ?)`,
      args: [id, user.id, queueId, name, JSON.stringify(contacts), created_at],
    });
    const row: SessionRow = {
      id,
      user_id: user.id,
      queue_id: queueId,
      queue_name: name,
      contacts_json: JSON.stringify(contacts),
      idx: 0,
      status: "live",
      created_at,
      ended_at: null,
    };
    return Response.json({ session: serializeSession(row, { calls: [] }) });
  } catch (err) {
    return asError(err);
  }
}
