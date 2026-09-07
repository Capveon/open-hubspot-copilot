import { CallReview } from "@/components/call-review";

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string; callId: string }>;
}) {
  const { id, callId } = await params;
  return <CallReview sessionId={id} callId={callId} />;
}
