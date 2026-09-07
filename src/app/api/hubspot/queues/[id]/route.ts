import { listQueues, queueContacts, queueName } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const queueId = decodeURIComponent(id);
  try {
    const [{ queues }, contacts] = await Promise.all([listQueues(), queueContacts(queueId)]);
    return Response.json({ contacts, name: queueName(queueId, queues) });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "HubSpot failed" },
      { status: 500 },
    );
  }
}
