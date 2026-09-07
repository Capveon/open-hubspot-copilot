import { db, migrate } from "@/lib/db";

export const dynamic = "force-dynamic";

type TwilioFields = Record<string, string>;

async function readTwilioFields(req: Request): Promise<TwilioFields> {
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const raw = (await req.json()) as Record<string, unknown>;
    const out: TwilioFields = {};
    for (const [key, value] of Object.entries(raw)) {
      out[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
    return out;
  }
  const form = await req.formData();
  const out: TwilioFields = {};
  form.forEach((value, key) => {
    out[key] = String(value);
  });
  return out;
}

function transcriptText(fields: TwilioFields): string {
  const raw = fields.TranscriptionData || fields.transcript || fields.TranscriptionText || "";
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { transcript?: unknown };
    if (parsed && typeof parsed.transcript === "string") return parsed.transcript.trim();
  } catch {
    /* Twilio sometimes sends the sentence itself */
  }
  return raw.trim();
}

function speakerRole(fields: TwilioFields): "you" | "them" {
  const track = (fields.Track || "").toLowerCase();
  const inboundLabel = (fields.InboundTrackLabel || "").toLowerCase();
  const outboundLabel = (fields.OutboundTrackLabel || "").toLowerCase();
  const label = track.includes("outbound") ? outboundLabel : inboundLabel;
  if (label === "them" || label === "customer") return "them";
  if (label === "you" || label === "agent") return "you";
  /* Client parent call: inbound is the browser (rep), outbound is the PSTN party. */
  return track.includes("outbound") ? "them" : "you";
}

/** Twilio real-time transcription callbacks. Public; scoped by callId. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const callId = url.searchParams.get("callId") || "";
  const fields = await readTwilioFields(req);
  const event = (fields.TranscriptionEvent || "").toLowerCase();
  const text = transcriptText(fields);
  const isFinal = fields.Final === "true" || fields.Final === "1";

  if (event && event !== "transcription-content") {
    return new Response("ok");
  }
  if (!callId || !text) return new Response("ok");

  await migrate();
  const found = await db().execute({
    sql: "SELECT id FROM calls WHERE id = ?",
    args: [callId],
  });
  if (!found.rows[0]) return new Response("ok");

  const role = speakerRole(fields);
  const at = Date.now();

  if (!isFinal) {
    const existing = await db().execute({
      sql: "SELECT id FROM transcript_lines WHERE call_id = ? AND source = 'stt-partial' AND role = ?",
      args: [callId, role],
    });
    const id = (existing.rows[0]?.id as string | undefined) ?? crypto.randomUUID();
    if (existing.rows[0]) {
      await db().execute({
        sql: "UPDATE transcript_lines SET text = ?, at = ? WHERE id = ?",
        args: [text, at, id],
      });
    } else {
      await db().execute({
        sql: `INSERT INTO transcript_lines (id, call_id, role, text, source, at)
              VALUES (?, ?, ?, ?, 'stt-partial', ?)`,
        args: [id, callId, role, text, at],
      });
    }
    return new Response("ok");
  }

  await db().execute({
    sql: "DELETE FROM transcript_lines WHERE call_id = ? AND source = 'stt-partial' AND role = ?",
    args: [callId, role],
  });
  await db().execute({
    sql: `INSERT INTO transcript_lines (id, call_id, role, text, source, at)
          VALUES (?, ?, ?, ?, 'stt', ?)`,
    args: [crypto.randomUUID(), callId, role, text, at],
  });
  return new Response("ok");
}
