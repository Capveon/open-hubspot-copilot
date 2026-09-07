export function pstnEnabled(): boolean {
  return (
    process.env.OHC_ALLOW_PSTN === "true" &&
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_API_KEY_SID) &&
    Boolean(process.env.TWILIO_API_KEY_SECRET) &&
    Boolean(process.env.TWILIO_TWIML_APP_SID) &&
    Boolean(process.env.TWILIO_CALLER_ID)
  );
}

export function twilioSignupUrl(): string {
  return "https://www.twilio.com/try-twilio";
}

export function twilioStatus() {
  return {
    pstn: pstnEnabled(),
    callerId: process.env.TWILIO_CALLER_ID || null,
    signup: twilioSignupUrl(),
    yc: "https://www.twilio.com/en-us/solutions/startups",
    missing: [
      !process.env.TWILIO_ACCOUNT_SID ? "TWILIO_ACCOUNT_SID" : null,
      !process.env.TWILIO_API_KEY_SID ? "TWILIO_API_KEY_SID" : null,
      !process.env.TWILIO_API_KEY_SECRET ? "TWILIO_API_KEY_SECRET" : null,
      !process.env.TWILIO_TWIML_APP_SID ? "TWILIO_TWIML_APP_SID" : null,
      !process.env.TWILIO_CALLER_ID ? "TWILIO_CALLER_ID" : null,
      process.env.OHC_ALLOW_PSTN !== "true" ? "OHC_ALLOW_PSTN=true" : null,
    ].filter(Boolean) as string[],
  };
}

export function e164(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (digits.startsWith("+")) return digits;
  return `+${d}`;
}
