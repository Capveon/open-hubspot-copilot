import { coachModel, coachProvider } from "@/lib/coach-config";
import { db, migrate } from "@/lib/db";
import { twilioStatus } from "@/lib/telephony";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    await migrate();
    await db().execute({ sql: "SELECT 1" });
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const provider = coachProvider();
  const model = coachModel();
  return Response.json({
    ok: true,
    coach: {
      provider,
      model,
      openai: Boolean(process.env.OPENAI_API_KEY),
      mercury: Boolean(process.env.INCEPTION_API_KEY),
    },
    db: dbOk,
    twilio: twilioStatus(),
  });
}
