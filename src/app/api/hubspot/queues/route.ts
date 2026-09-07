import { listQueues } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listQueues();
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "HubSpot failed" },
      { status: 500 },
    );
  }
}
