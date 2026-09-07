import twilio from "twilio";
import { pstnEnabled } from "./telephony";

export function mintVoiceToken(identity: string): string {
  if (!pstnEnabled()) {
    throw new Error("PSTN is not configured");
  }
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID as string,
    process.env.TWILIO_API_KEY_SID as string,
    process.env.TWILIO_API_KEY_SECRET as string,
    { identity, ttl: 60 * 60 },
  );
  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID as string,
      incomingAllow: false,
    }),
  );
  return token.toJwt();
}
