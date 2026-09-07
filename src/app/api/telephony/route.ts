import { twilioStatus } from "@/lib/telephony";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(twilioStatus());
}
