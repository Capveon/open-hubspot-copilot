import type { HsContact } from "./contact";

export type SessionStatus = "live" | "ended";
export type CallStatus = "ringing" | "live" | "ended";

export type SessionRow = {
  id: string;
  user_id: string;
  queue_id: string;
  queue_name: string;
  contacts_json: string;
  idx: number;
  status: SessionStatus;
  created_at: number;
  ended_at: number | null;
};

export type CallRow = {
  id: string;
  session_id: string;
  user_id: string;
  contact_json: string;
  status: CallStatus;
  started_at: number;
  ended_at: number | null;
  twilio_sid: string | null;
};

export type LineRow = {
  id: string;
  call_id: string;
  role: "you" | "them";
  text: string;
  source: string;
  at: number;
};

export function parseContacts(raw: string): HsContact[] {
  try {
    const parsed = JSON.parse(raw) as HsContact[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseContact(raw: string): HsContact | null {
  try {
    return JSON.parse(raw) as HsContact;
  } catch {
    return null;
  }
}

export function serializeSession(row: SessionRow, extra?: { calls?: unknown[]; callCount?: number }) {
  return {
    id: row.id,
    queueId: row.queue_id,
    queueName: row.queue_name,
    contacts: parseContacts(row.contacts_json),
    index: Number(row.idx) || 0,
    status: row.status,
    createdAt: Number(row.created_at),
    endedAt: row.ended_at == null ? null : Number(row.ended_at),
    callCount: extra?.callCount,
    calls: extra?.calls,
  };
}

export function serializeCall(row: CallRow, lines?: LineRow[]) {
  return {
    id: row.id,
    sessionId: row.session_id,
    contact: parseContact(row.contact_json),
    status: row.status,
    startedAt: Number(row.started_at),
    endedAt: row.ended_at == null ? null : Number(row.ended_at),
    twilioSid: row.twilio_sid,
    transcript: (lines ?? []).map((line) => ({
      id: line.id,
      role: line.role,
      text: line.text,
      source: line.source,
      at: Number(line.at),
    })),
  };
}
