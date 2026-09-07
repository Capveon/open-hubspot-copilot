import type { HsContact } from "./contact";
import type { CallStatus, SessionStatus } from "./store";

/** Shapes returned by the session / call routes, as the browser sees them. */

export type TranscriptLine = {
  id: string;
  role: "you" | "them";
  text: string;
  source: string;
  at: number;
};

export type CallJson = {
  id: string;
  sessionId: string;
  contact: HsContact | null;
  status: CallStatus;
  startedAt: number;
  endedAt: number | null;
  twilioSid: string | null;
  transcript: TranscriptLine[];
};

export type SessionJson = {
  id: string;
  queueId: string;
  queueName: string;
  contacts: HsContact[];
  index: number;
  status: SessionStatus;
  createdAt: number;
  endedAt: number | null;
  callCount?: number;
  calls?: CallJson[];
};

/** POST /api/sessions/{id}/calls */
export type StartedCall = {
  call: CallJson;
  to: string;
  pstn: boolean;
  twilio: { token: string; identity: string; from?: string } | null;
};

export type GlassAction = "hold" | "say" | "leave";

export type CoachLine = {
  action?: GlassAction;
  agree: string;
  say: string;
  move: string;
};

export async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
