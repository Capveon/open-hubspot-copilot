import type { HsContact } from "./contact";

/** mm:ss from a duration in milliseconds. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function initials(contact: HsContact | null): string {
  if (!contact) return "?";
  const first = contact.firstName[0] ?? "";
  const last = contact.lastName[0] ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}

export function fullName(contact: HsContact | null): string {
  if (!contact) return "Unknown contact";
  return `${contact.firstName} ${contact.lastName}`.trim() || "Unknown contact";
}

export function when(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Today / Yesterday / Mon, Sep 1 — day headings for the session archive. */
export function dayLabel(ms: number): string {
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const day = new Date(ms);
  const days = Math.round((midnight(new Date()) - midnight(day)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function timeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Elapsed call length, or a dash while the call is still open. */
export function spanOf(startedAt: number, endedAt: number | null): string {
  if (endedAt == null) return "—";
  return clock(endedAt - startedAt);
}
