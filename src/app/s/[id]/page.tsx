import { SessionDesk } from "@/components/session-desk";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  return <SessionDesk sessionId={id} autoStart={query.new === "1"} />;
}
