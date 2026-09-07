import type { SessionJson } from "./session-types";

/** Where you are in the list: the contact on deck, 1-based. */
export function placeInQueue(session: SessionJson): { at: number; of: number } {
  const of = session.contacts.length;
  const at = of === 0 ? 0 : Math.min(session.index + 1, of);
  return { at, of };
}

export function placeLabel(session: SessionJson): string {
  const { at, of } = placeInQueue(session);
  if (of === 0) return "empty list";
  return `${at} of ${of}`;
}

/** Latest open pass through this queue, if any. */
export function openSessionForQueue(
  sessions: SessionJson[] | null | undefined,
  queueId: string,
): SessionJson | null {
  if (!sessions) return null;
  return sessions.find((session) => session.queueId === queueId && session.status === "live") ?? null;
}
