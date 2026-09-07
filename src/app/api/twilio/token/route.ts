import { requireUser } from "@/lib/auth";
import { asError } from "@/lib/api";
import { mintVoiceToken } from "@/lib/twilio-token";
import { pstnEnabled, twilioStatus } from "@/lib/telephony";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (!pstnEnabled()) {
      return Response.json({ token: null, ...twilioStatus() });
    }
    const identity = `ohc-${user.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32)}`;
    return Response.json({
      token: mintVoiceToken(identity),
      identity,
      from: process.env.TWILIO_CALLER_ID,
      pstn: true,
    });
  } catch (err) {
    return asError(err);
  }
}
