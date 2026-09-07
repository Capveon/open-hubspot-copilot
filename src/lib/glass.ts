import type { CoachLine, TranscriptLine } from "./session-types";

/** How long a partial STT line counts as “this person is still talking.” */
export const SPEAKING_MS = 1400;
/** Generate after a them-partial goes quiet this long (finals do not wait this out). */
export const SILENCE_MS = 550;
/** Brief hold after a paint so the same turn cannot fire twice. */
export const FREEZE_MS = 400;
/** Join them-finals that landed close together into one turn for Mercury. */
export const COALESCE_MS = 8000;

export function lastWhere<T>(items: T[], ok: (item: T) => boolean): T | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    if (ok(items[i])) return items[i];
  }
  return undefined;
}

/** Lowercase letters and digits, single spaces. No content rules. */
export function normalizeSpeech(text: string): string {
  let out = "";
  let spaced = false;
  for (const ch of text.toLowerCase()) {
    const code = ch.charCodeAt(0);
    const alnum = (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
    if (alnum) {
      out += ch;
      spaced = false;
    } else if (out.length > 0 && !spaced) {
      out += " ";
      spaced = true;
    }
  }
  if (out.endsWith(" ")) return out.slice(0, -1);
  return out;
}

export function similarSpeech(a: string, b: string): boolean {
  const na = normalizeSpeech(a);
  const nb = normalizeSpeech(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 24 && (nb.includes(na) || na.includes(nb))) return true;
  return false;
}

export function turnKey(text: string): string {
  return normalizeSpeech(text);
}

function pushSpoken(rows: string[], who: "FINN" | "THEM", text: string, seenFinn: Set<string>) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const last = rows.at(-1);
  if (last) {
    const prefix = `${who}: `;
    if (last.startsWith(prefix) && similarSpeech(last.slice(prefix.length), trimmed)) return;
  }
  rows.push(`${who}: ${trimmed}`);
  if (who === "FINN") seenFinn.add(normalizeSpeech(trimmed));
}

/** Finn + them on the call, in order. Glass counts. Partials do not. */
export function formatTape(lines: TranscriptLine[], said: string[] = []): string {
  const rows: string[] = [];
  const seenFinn = new Set<string>();
  const ordered = [...lines].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  for (const line of ordered) {
    if (line.source === "stt-partial" || !line.text.trim()) continue;
    pushSpoken(rows, line.role === "you" ? "FINN" : "THEM", line.text, seenFinn);
  }
  for (const raw of said) {
    const text = raw.trim();
    if (!text) continue;
    const norm = normalizeSpeech(text);
    if (!norm || seenFinn.has(norm)) continue;
    let covered = false;
    for (const prev of seenFinn) {
      if (prev.length >= 24 && (prev.includes(norm) || norm.includes(prev))) {
        covered = true;
        break;
      }
    }
    if (covered) continue;
    pushSpoken(rows, "FINN", text, seenFinn);
  }
  if (rows.length === 0) return "(nothing on tape yet)";
  const max = 40;
  return (rows.length > max ? rows.slice(-max) : rows).join("\n");
}

/** Keep finals we already have if the server poll is behind. Never shrink. */
export function mergeTranscript(
  prev: TranscriptLine[],
  next: TranscriptLine[],
): TranscriptLine[] {
  const finals = new Map<string, TranscriptLine>();
  for (const line of [...prev, ...next]) {
    if (line.source === "stt-partial") continue;
    finals.set(line.id, line);
  }
  const sorted = [...finals.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const out: TranscriptLine[] = [];
  for (const line of sorted) {
    if (line.role === "you") {
      const dupIdx = out.findIndex(
        (row) => row.role === "you" && similarSpeech(row.text, line.text),
      );
      if (dupIdx >= 0) {
        const existing = out[dupIdx];
        if (existing.id.startsWith("glass-local-") && !line.id.startsWith("glass-local-")) {
          out[dupIdx] = line;
        }
        continue;
      }
    }
    out.push(line);
  }
  const partials = next.filter((line) => line.source === "stt-partial");
  return [...out, ...partials].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

export type GlassTurn = {
  themTalking: boolean;
  youTalking: boolean;
  themText: string;
  themAt: number;
  themFinal: boolean;
  ready: boolean;
};

/**
 * When the glass is allowed to think. Speed lives in the gap after they stop.
 * What to say is Mercury's job.
 */
export function glassTurn(lines: TranscriptLine[], now: number): GlassTurn {
  const lastThemPartial = lastWhere(
    lines,
    (line) => line.role === "them" && line.source === "stt-partial",
  );
  const lastYouPartial = lastWhere(
    lines,
    (line) => line.role === "you" && line.source === "stt-partial",
  );
  const lastThemFinal = lastWhere(lines, (line) => line.role === "them" && line.source === "stt");
  const lastYouFinal = lastWhere(lines, (line) => line.role === "you" && line.source === "stt");

  const themTalking = Boolean(lastThemPartial && now - lastThemPartial.at < SPEAKING_MS);
  const lastYouAt = Math.max(lastYouPartial?.at ?? 0, lastYouFinal?.at ?? 0);
  const lastThemAt = Math.max(lastThemPartial?.at ?? 0, lastThemFinal?.at ?? 0);
  const youIsPartial = (lastYouPartial?.at ?? 0) >= (lastYouFinal?.at ?? 0);
  const youWindow = youIsPartial ? SPEAKING_MS : 700;
  /** If they spoke last, Finn is done. Echo or leftover you-partials must not freeze glass. */
  const youTalking = Boolean(
    lastYouAt > lastThemAt && lastYouAt > 0 && now - lastYouAt < youWindow,
  );

  let themText = "";
  let themAt = 0;
  let themFinal = false;
  if (lastThemFinal) {
    themText = lastThemFinal.text;
    themAt = lastThemFinal.at;
    themFinal = true;
  }
  if (lastThemPartial && lastThemPartial.at >= themAt) {
    themText = lastThemPartial.text;
    themAt = lastThemPartial.at;
    themFinal = false;
  }

  const quietMs = themAt ? now - themAt : Number.POSITIVE_INFINITY;
  const ready = Boolean(themText) && !themTalking && (themFinal || quietMs >= SILENCE_MS);

  return { themTalking, youTalking, themText, themAt, themFinal, ready };
}

export function recentThem(lines: TranscriptLine[], now: number): string {
  const finals = lines.filter(
    (line) => line.role === "them" && line.source === "stt" && line.text.trim(),
  );
  const last = finals.at(-1);
  const turn = glassTurn(lines, now);
  if (!last) return turn.themText.trim();
  const cluster: string[] = [];
  for (let i = finals.length - 1; i >= 0; i--) {
    if (last.at - finals[i].at > COALESCE_MS) break;
    cluster.unshift(finals[i].text.trim());
  }
  const joined = cluster.join(" ").trim();
  if (turn.themText && !turn.themFinal && turn.themAt >= last.at) {
    return `${joined} ${turn.themText}`.trim();
  }
  return joined || turn.themText.trim();
}

export type GlassDesk = {
  released: boolean;
  frozen: boolean;
  voicemail: boolean;
  frozenUntil: number;
  turnKey: string;
  pendingKey: string;
};

export type DeskTick =
  | { action: "idle"; mark: "" | "listening" | "hold" | "frozen" }
  | { action: "suggest"; mark: ""; them: string; key: string };

/** Same gate the live desk uses. Evals tick this; the browser ticks this. */
export function nextDeskTick(
  lines: TranscriptLine[],
  now: number,
  desk: GlassDesk,
): DeskTick {
  const turn = glassTurn(lines, now);
  if (turn.themTalking) return { action: "idle", mark: "listening" };
  if (turn.youTalking) return { action: "idle", mark: "hold" };
  if (desk.frozen) return { action: "idle", mark: "frozen" };
  if (!desk.released || desk.voicemail) return { action: "idle", mark: "" };
  if (!turn.ready) return { action: "idle", mark: "" };
  if (now < desk.frozenUntil) return { action: "idle", mark: "" };
  const them = recentThem(lines, now);
  const key = turnKey(them);
  if (!key || key === desk.turnKey || key === desk.pendingKey) {
    return { action: "idle", mark: "" };
  }
  return { action: "suggest", mark: "", them, key };
}
