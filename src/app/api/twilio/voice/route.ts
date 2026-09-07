import twilio from "twilio";
import { db, migrate } from "@/lib/db";
import { e164, pstnEnabled } from "@/lib/telephony";
import { parseContact, type CallRow } from "@/lib/store";

export const dynamic = "force-dynamic";

const VoiceResponse = twilio.twiml.VoiceResponse;

function xml(twiml: string) {
  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}

function hangup(message: string) {
  const vr = new VoiceResponse();
  vr.say(message);
  vr.hangup();
  return xml(vr.toString());
}

/** Twilio posts here when the browser Device connects. Dial only the number on the call record. */
export async function POST(req: Request) {
  if (!pstnEnabled()) return hangup("PSTN is disabled on this copilot.");
  const form = await req.formData();
  const callId = String(form.get("callId") || "");
  const twilioSid = String(form.get("CallSid") || "");
  if (!callId) return hangup("No call.");

  await migrate();
  const found = await db().execute({
    sql: "SELECT * FROM calls WHERE id = ?",
    args: [callId],
  });
  const call = found.rows[0] as CallRow | undefined;
  const contact = call ? parseContact(call.contact_json) : null;
  const to = contact?.phone ? e164(contact.phone) : "";
  const caller = process.env.TWILIO_CALLER_ID ?? "";
  if (!call || !to || !caller) return hangup("No number.");

  if (twilioSid) {
    await db().execute({
      sql: "UPDATE calls SET twilio_sid = ?, status = 'live' WHERE id = ?",
      args: [twilioSid, callId],
    });
  }

  const host = process.env.OHC_PUBLIC_URL?.replace(/\/$/, "") || "";
  const vr = new VoiceResponse();
  if (host) {
    const start = vr.start();
    start.transcription({
      statusCallbackUrl: `${host}/api/twilio/transcript?callId=${encodeURIComponent(callId)}`,
      track: "both_tracks",
      inboundTrackLabel: "you",
      outboundTrackLabel: "them",
      languageCode: "en-US",
      speechModel: "telephony",
      partialResults: true,
      hints:
        process.env.OHC_STT_HINTS?.trim() ||
        "CIP, CMMS, GIS, SCADA, superintendent, work order, lift station, pump, main break",
    });
  }
  const dial = vr.dial({ callerId: caller, answerOnBridge: true, timeout: 30 });
  dial.number(to);
  return xml(vr.toString());
}
