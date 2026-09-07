"use client";

import { cardFromContact } from "@/lib/card-from-contact";
import { clock, fullName, initials } from "@/lib/format";
import { formatUsPhone, type HsContact } from "@/lib/contact";
import {
  formatTape,
  mergeTranscript,
  FREEZE_MS,
  nextDeskTick,
  similarSpeech,
} from "@/lib/glass";
import { resolveCoachLine } from "@/lib/coach";
import { beatLabel, openerFromCard, type Beat } from "@/lib/track";
import {
  readJson,
  type CallJson,
  type CoachLine,
  type SessionJson,
  type StartedCall,
  type TranscriptLine,
} from "@/lib/session-types";
import type { Call as VoiceCall, Device as VoiceDevice } from "@twilio/voice-sdk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDeskChrome } from "./shell";
import { TranscriptView } from "./transcript-view";
import { Icon } from "./ui/icon";

/** No call yet → dialing → on the line → hung up and waiting on the human. */
type Phase = "idle" | "connecting" | "live" | "wrap";

function parseSse(buffer: string): { events: Array<{ event: string; data: string }>; rest: string } {
  const events: Array<{ event: string; data: string }> = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const block of parts) {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) events.push({ event, data: dataLines.join("\n") });
  }
  return { events, rest };
}

function message(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const raw = (err as { message?: unknown }).message;
    if (typeof raw === "string" && raw) return raw;
  }
  return fallback;
}

const EMPTY_LINE: CoachLine = { agree: "", say: "", move: "" };

type GlassMark = "" | "listening" | "hold" | "frozen";

type GlassState = {
  turnKey: string;
  pendingKey: string;
  frozenUntil: number;
  beat: Beat;
  said: string[];
  voicemail: boolean;
  /** False until Finn clicks Delivered — opener stays on glass. */
  released: boolean;
  /** True while Finn has frozen the current recommendation. */
  frozen: boolean;
};

function freshGlass(): GlassState {
  return {
    turnKey: "",
    pendingKey: "",
    frozenUntil: 0,
    beat: "open",
    said: [],
    voicemail: false,
    released: false,
    frozen: false,
  };
}

function coachLabel(beat: Beat, released: boolean, frozen: boolean): string {
  if (frozen) return "Frozen";
  if (!released) return "Open";
  return beatLabel(beat);
}

/**
 * Sessions that already fired their opening dial. Module scope on purpose: a remount must
 * never place a second call, and only a genuine page load (which drops `?new=1`) clears this.
 */
const autoDialed = new Set<string>();

export function LiveSession({
  initialSession,
  autoStart,
}: {
  initialSession: SessionJson;
  autoStart: boolean;
}) {
  const router = useRouter();

  const [session, setSession] = useState<SessionJson>(initialSession);
  const [call, setCall] = useState<CallJson | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pstn, setPstn] = useState<boolean | null>(null);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [coach, setCoach] = useState<CoachLine>(EMPTY_LINE);
  const [mark, setMark] = useState<GlassMark>("");
  const [beat, setBeat] = useState<Beat>("open");
  const [released, setReleased] = useState(false);
  const [frozen, setFrozen] = useState(false);

  const deviceRef = useRef<VoiceDevice | null>(null);
  const connRef = useRef<VoiceCall | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const startedRef = useRef(0);
  const busyRef = useRef(false);
  const closedRef = useRef<Set<string>>(new Set());
  const suggestRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);
  const glassRef = useRef<GlassState>(freshGlass());
  const coachRef = useRef<CoachLine>(EMPTY_LINE);
  const linesRef = useRef<TranscriptLine[]>([]);
  const phaseRef = useRef<Phase>("idle");
  const contactRef = useRef<HsContact | null>(null);
  const activeCallRef = useRef<string | null>(null);

  const contact: HsContact | null = session.contacts[session.index] ?? null;
  const contactCount = session.contacts.length;
  const atLastContact = session.index >= contactCount - 1;
  const onLine = phase === "connecting" || phase === "live";

  useDeskChrome(
    contactCount
      ? `${session.queueName} · ${Math.min(session.index + 1, contactCount)} of ${contactCount}`
      : session.queueName,
  );

  coachRef.current = coach;
  linesRef.current = lines;
  phaseRef.current = phase;
  contactRef.current = contact;

  /* ——— plumbing ——— */

  const teardown = useCallback(() => {
    try {
      connRef.current?.disconnect();
    } catch {
      /* already gone */
    }
    connRef.current = null;
    try {
      deviceRef.current?.destroy();
    } catch {
      /* already gone */
    }
    deviceRef.current = null;
    micRef.current?.getTracks().forEach((track) => track.stop());
    micRef.current = null;
    suggestRef.current?.abort();
  }, []);

  useEffect(() => teardown, [teardown]);

  const persistGlass = useCallback((line: CoachLine) => {
    const callId = activeCallRef.current;
    const text = `${line.agree} ${line.say}`.trim();
    if (!callId || !text) return;
    const local: TranscriptLine = {
      id: `glass-local-${Date.now()}`,
      at: Date.now(),
      role: "you",
      text,
      source: "glass",
    };
    const merged = mergeTranscript(linesRef.current, [local]);
    linesRef.current = merged;
    setLines(merged);
    void fetch(`/api/calls/${callId}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "you" as const, text, source: "glass" }),
    }).catch(() => undefined);
  }, []);

  const commitOpener = useCallback((who: HsContact) => {
    const line = openerFromCard(cardFromContact(who));
    glassRef.current = freshGlass();
    coachRef.current = line;
    setCoach(line);
    setBeat("open");
    setMark("");
    setReleased(false);
    setFrozen(false);
  }, []);

  const patchCall = useCallback(
    async (callId: string, body: { status?: "live" | "ended"; twilioSid?: string | null }) => {
      try {
        await fetch(`/api/calls/${callId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        /* the UI already moved on; the poll or the next patch will reconcile */
      }
    },
    [],
  );

  const refreshCall = useCallback(async (callId: string) => {
    try {
      const res = await fetch(`/api/calls/${callId}`);
      const data = await readJson<{ call: CallJson }>(res);
      if (activeCallRef.current !== callId) return;
      const merged = mergeTranscript(linesRef.current, data.call.transcript ?? []);
      linesRef.current = merged;
      setLines(merged);
      setCall((prev) => (prev && prev.id === callId ? { ...prev, ...data.call } : prev));
    } catch {
      /* transient — the next tick tries again */
    }
  }, []);

  const closeCall = useCallback(
    async (callId: string) => {
      if (closedRef.current.has(callId)) return;
      closedRef.current.add(callId);
      connRef.current = null;
      try {
        deviceRef.current?.destroy();
      } catch {
        /* already gone */
      }
      deviceRef.current = null;
      micRef.current?.getTracks().forEach((track) => track.stop());
      micRef.current = null;
      suggestRef.current?.abort();
      setPhase("wrap");
      setMark("");
      setMuted(false);
      await patchCall(callId, { status: "ended" });
      await refreshCall(callId);
    },
    [patchCall, refreshCall],
  );

  const connect = useCallback(
    async (token: string, callId: string) => {
      const { Device } = await import("@twilio/voice-sdk");
      const device = new Device(token, { logLevel: "error" });
      deviceRef.current = device;
      device.on("error", (err: unknown) => setNote(message(err, "Twilio device error")));
      await device.register();

      const conn = await device.connect({ params: { callId } });
      connRef.current = conn;

      const goLive = () => {
        if (closedRef.current.has(callId)) return;
        startedRef.current = Date.now();
        setElapsed(0);
        setPhase("live");
        void patchCall(callId, { status: "live", twilioSid: conn.parameters?.CallSid ?? null });
      };

      conn.on("accept", goLive);
      conn.on("disconnect", () => void closeCall(callId));
      conn.on("cancel", () => void closeCall(callId));
      conn.on("reject", () => void closeCall(callId));
      conn.on("error", (err: unknown) => {
        setNote(message(err, "The line dropped"));
        void closeCall(callId);
      });

      const status = typeof conn.status === "function" ? conn.status() : undefined;
      if (status === "open") goLive();
    },
    [closeCall, patchCall],
  );

  /** Create the call record, then either dial it through Twilio or run it as Preview. */
  const beginCall = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setNote(null);
    suggestRef.current?.abort();
    seqRef.current += 1;
    activeCallRef.current = null;
    setCall(null);
    setLines([]);
    linesRef.current = [];
    setPhase("connecting");
    setMuted(false);
    setElapsed(0);
    const who = contactRef.current;
    if (who) commitOpener(who);
    else {
      glassRef.current = freshGlass();
      setCoach(EMPTY_LINE);
      setBeat("open");
      setReleased(false);
      setFrozen(false);
    }
    let createdId: string | null = null;
    try {
      const res = await fetch(`/api/sessions/${session.id}/calls`, { method: "POST" });
      const started = await readJson<StartedCall>(res);
      createdId = started.call.id;
      activeCallRef.current = started.call.id;
      setCall(started.call);
      setLines(started.call.transcript ?? []);
      persistGlass(coachRef.current);
      setPstn(started.pstn);
      if (started.twilio?.token) {
        setPreviewOnly(false);
        await connect(started.twilio.token, started.call.id);
      } else {
        setPreviewOnly(true);
        try {
          micRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          setNote("Mic is optional in Preview — the coach still runs.");
        }
        startedRef.current = Date.now();
        setPhase("live");
        setNote((prev) =>
          prev ??
          (started.pstn
            ? "No voice token came back. Preview only — nothing is ringing."
            : "PSTN is off. Preview only — nothing is ringing."),
        );
        await patchCall(started.call.id, { status: "live" });
      }
    } catch (err) {
      setNote(message(err, "Could not start that call"));
      /* A dial that never connected is a closed call — let them retry or move on. */
      if (createdId) {
        closedRef.current.add(createdId);
        await patchCall(createdId, { status: "ended" });
        setPhase("wrap");
      } else {
        setPhase("idle");
      }
    } finally {
      busyRef.current = false;
    }
  }, [commitOpener, connect, patchCall, persistGlass, session.id]);

  /* ——— arrival: a brand new session dials its first contact, a resumed one waits ——— */

  const armed = useRef(false);
  useEffect(() => {
    if (armed.current) return;
    armed.current = true;
    const calls = initialSession.calls ?? [];
    if (autoStart && calls.length === 0 && !autoDialed.has(initialSession.id)) {
      autoDialed.add(initialSession.id);
      window.history.replaceState(null, "", `/s/${initialSession.id}`);
      void beginCall();
      return;
    }
    const last = calls[calls.length - 1];
    if (!last) return;
    setCall(last);
    setLines(last.transcript ?? []);
    activeCallRef.current = last.id;
    if (last.status === "ended") {
      closedRef.current.add(last.id);
      setPhase("wrap");
    } else {
      setNote("Picked this session back up. Nothing is connected — hit Call when you are ready.");
      setPhase("idle");
    }
  }, [autoStart, beginCall, initialSession]);

  useEffect(() => {
    if (pstn != null) return;
    fetch("/api/telephony")
      .then((r) => r.json() as Promise<{ pstn: boolean }>)
      .then((data) => setPstn(Boolean(data.pstn)))
      .catch(() => undefined);
  }, [pstn]);

  /* ——— timer + transcript poll while the line is open ——— */

  useEffect(() => {
    if (phase !== "live") return;
    const id = window.setInterval(() => setElapsed(Date.now() - startedRef.current), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if ((phase !== "live" && phase !== "connecting") || !call) return;
    const id = window.setInterval(() => void refreshCall(call.id), 800);
    return () => window.clearInterval(id);
  }, [call, phase, refreshCall]);

  /* ——— coach: GPT-4.1 writes each settled turn. Templates only paint on next. ——— */

  const suggest = useCallback(async (them: string, tape: string, key: string, currentBeat: Beat) => {
    const who = contactRef.current;
    if (!who) return;
    suggestRef.current?.abort();
    const controller = new AbortController();
    suggestRef.current = controller;
    const seq = ++seqRef.current;
    const card = cardFromContact(who);
    const onGlass = coachRef.current.say;

    const readLine = async (nudge?: string): Promise<CoachLine | null> => {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          seq,
          tape,
          themPartial: them,
          themSettled: true,
          beat: currentBeat,
          onGlass,
          card,
          already: glassRef.current.said,
          nudge,
          structured: true,
          stream: true,
          maxTokens: 220,
          temperature: 0.3,
        }),
      });
      if (!res.body) return null;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let doneLine: CoachLine | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parsed = parseSse(buf);
        buf = parsed.rest;
        for (const ev of parsed.events) {
          try {
            const data = JSON.parse(ev.data) as { seq?: number; line?: CoachLine };
            if (data.seq !== seq) continue;
            if (ev.event === "done" && data.line) doneLine = data.line;
          } catch {
            /* ignore malformed SSE chunks */
          }
        }
      }
      return doneLine;
    };

    try {
      const decided = await resolveCoachLine(
        {
          card,
          them,
          tape,
          onGlass,
          already: glassRef.current.said,
          beat: currentBeat,
          signal: controller.signal,
        },
        readLine,
      );
      if (seq !== seqRef.current) return;
      const glass = glassRef.current;
      if (glass.pendingKey === key) glass.pendingKey = "";
      if (!glass.released || glass.frozen) return;

      const paint = (line: CoachLine) => {
        const spoken = coachRef.current.say.trim();
        if (spoken) glass.said.push(spoken);
        glass.turnKey = key;
        glass.frozenUntil = Date.now() + FREEZE_MS;
        glass.beat = "live";
        coachRef.current = line;
        if (line.say.trim()) glass.said.push(line.say.trim());
        setCoach(line);
        setBeat("live");
        setMark("");
        persistGlass(line);
      };

      if (decided.kind === "leave") {
        glass.voicemail = true;
        paint(decided.line);
        return;
      }
      if (decided.kind === "say") {
        if (similarSpeech(decided.line.say, coachRef.current.say)) {
          glass.turnKey = key;
          return;
        }
        paint(decided.line);
        return;
      }
      /* They finished. Do not lock the turn — retry on the next tick. */
      glass.pendingKey = "";
    } catch {
      if (controller.signal.aborted) return;
      const glass = glassRef.current;
      if (glass.pendingKey === key) glass.pendingKey = "";
    }
  }, [persistGlass]);

  useEffect(() => {
    if (phase !== "live") {
      if (phase === "idle" || phase === "wrap") setMark("");
      return;
    }
    const tick = () => {
      const who = contactRef.current;
      const glass = glassRef.current;
      const next = nextDeskTick(linesRef.current, Date.now(), glass);
      setMark(next.mark);
      if (next.action !== "suggest") return;
      if (!who) return;

      glass.pendingKey = next.key;
      void suggest(
        next.them,
        formatTape(linesRef.current, [...glass.said, coachRef.current.say]),
        next.key,
        glass.beat,
      );
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [lines, phase, suggest, released, frozen]);


  /* ——— actions ——— */

  function markDelivered() {
    glassRef.current.released = true;
    setReleased(true);
  }

  function freezeGlass() {
    suggestRef.current?.abort();
    seqRef.current += 1;
    glassRef.current.frozen = true;
    glassRef.current.pendingKey = "";
    setFrozen(true);
    setMark("frozen");
  }

  function resumeGlass() {
    glassRef.current.frozen = false;
    setFrozen(false);
    setMark("");
  }

  function hangUp() {
    const active = call;
    if (!active) return;
    if (connRef.current) {
      connRef.current.disconnect();
      return;
    }
    void closeCall(active.id);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    connRef.current?.mute(next);
    micRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
  }

  async function goNext() {
    if (busyRef.current || atLastContact) return;
    const nextIndex = session.index + 1;
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: nextIndex }),
      });
      await readJson<{ session: SessionJson }>(res);
    } catch (err) {
      setNote(message(err, "Could not advance the queue"));
      return;
    }
    setSession((prev) => ({ ...prev, index: nextIndex }));
    setCall(null);
    setLines([]);
    activeCallRef.current = null;
    glassRef.current = freshGlass();
    setCoach(EMPTY_LINE);
    setBeat("open");
    setMark("");
    setPhase("idle");
    await beginCall();
  }

  async function leaveForLater() {
    teardown();
    if (call && !closedRef.current.has(call.id)) {
      closedRef.current.add(call.id);
      await patchCall(call.id, { status: "ended" });
    }
    router.push("/");
  }

  async function finishList() {
    teardown();
    if (call && !closedRef.current.has(call.id)) {
      closedRef.current.add(call.id);
      await patchCall(call.id, { status: "ended" });
    }
    try {
      await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended" }),
      });
    } catch {
      /* the session row stays live; history still shows it */
    }
    router.push("/");
  }

  /* ——— render ——— */

  const preview = previewOnly || pstn === false;
  const statusLabel =
    phase === "connecting"
      ? preview
        ? "Opening preview…"
        : "Calling…"
      : phase === "live"
        ? muted
          ? preview
            ? "Preview · muted"
            : "Connected · muted"
          : preview
            ? "Preview · not ringing"
            : "Connected"
        : phase === "wrap"
          ? "Call ended"
          : contact
            ? pstn
              ? "Ready to dial"
              : "Ready · preview only"
            : "End of queue";
  const statusTone =
    phase === "live" ? (preview ? "preview" : "live") : phase === "connecting" ? "ringing" : "idle";
  /* Next is for moving on after a call — or past a contact this queue cannot dial at all. */
  const canSkip = phase === "wrap" || call == null || !contact?.phone;

  const coachSay =
    coach.say ||
    (phase === "connecting" || phase === "live"
      ? ""
      : "Start the call and the opener lands here.");
  const markCopy =
    mark === "listening"
      ? "Listening"
      : mark === "hold"
        ? "Hold"
        : mark === "frozen"
          ? "Frozen"
          : "";

  return (
    <div className="desk">
      <section className="pane pane--tape" aria-label="Transcript">
        <header className="pane__bar">
          <span className="pane__label">{contact?.firstName || "Them"}</span>
          <span className="pane__hint">{phase === "live" ? "Live" : "Transcript"}</span>
        </header>
        <div className="pane__body tape-wrap">
          <TranscriptView
            lines={lines}
            themLabel={contact?.firstName || "Them"}
            startedAt={call?.startedAt ?? startedRef.current}
            follow
            empty="What they say lands here. Read the line on the right."
          />
        </div>
      </section>

      <section className="pane pane--call" aria-label="Call">
        <header className="pane__bar">
          <span className="pane__label">Call</span>
          <span className="pane__hint" data-tone={statusTone} aria-live="polite">
            {statusLabel}
          </span>
        </header>
        <div className="pane__body call">
          <div className="call__who">
            <div className="call__avatar">{initials(contact)}</div>
            <div className="call__name">{fullName(contact)}</div>
            <div className="call__sub">
              {[contact?.title, contact?.company].filter(Boolean).join(" · ") ||
                "No title on record"}
            </div>
            <div className="call__num">
              {contact?.phone ? formatUsPhone(contact.phone) : "No phone on record"}
            </div>
          </div>

          <div className="call__clock">{phase === "live" ? clock(elapsed) : "\u00a0"}</div>

          <div className="call__keys">
            {phase === "live" ? (
              <button
                type="button"
                className="call__round"
                aria-pressed={muted}
                onClick={toggleMute}
              >
                <Icon name="mute" label="Mute" size={20} />
                <span>{muted ? "Unmute" : "Mute"}</span>
              </button>
            ) : null}

            {onLine ? (
              <button type="button" className="call__prime call__prime--end" onClick={hangUp}>
                <Icon name="end" label="End call" size={20} />
                <span>End</span>
              </button>
            ) : (
              <button
                type="button"
                className="call__prime call__prime--go"
                onClick={() => void beginCall()}
                disabled={!contact?.phone}
              >
                <Icon name="call" label="Call" size={20} />
                <span>{pstn ? (phase === "wrap" ? "Call again" : "Call") : "Preview"}</span>
              </button>
            )}
          </div>

          {onLine ? null : (
            <div className="call__after">
              <button
                type="button"
                className="call__ghost"
                onClick={() => void goNext()}
                disabled={atLastContact || !canSkip}
              >
                {atLastContact ? "Last in list" : "Next"}
              </button>
              <button type="button" className="call__ghost" onClick={() => void leaveForLater()}>
                Done for now
              </button>
              <button
                type="button"
                className="call__ghost call__ghost--quiet"
                onClick={() => void finishList()}
              >
                Finish list
              </button>
              <p className="call__hint">
                {atLastContact
                  ? "Last contact. Done for now keeps your place. Finish list closes this pass."
                  : "Next dials the next person. Done for now saves this spot."}
              </p>
            </div>
          )}

          {note ? <p className="call__note">{note}</p> : null}
        </div>
      </section>

      <section className="pane pane--coach" aria-label="What to say">
        <header className="pane__bar">
          <span className="pane__label">Say this</span>
          <span className="pane__hint" aria-live="polite">
            {markCopy || coachLabel(onLine || phase === "wrap" ? beat : "open", released, frozen)}
          </span>
        </header>
        <div className="pane__body">
          {coach.agree ? <p className="coach__agree">{coach.agree}</p> : null}
          <p className={coachSay ? "coach__say" : "coach__say coach__say--empty"}>{coachSay || "\u00a0"}</p>
        </div>
        {onLine ? (
          <footer className="pane__foot">
            {!released ? (
              <button type="button" className="st-btn st-btn--primary st-btn--sm" onClick={markDelivered}>
                Delivered
              </button>
            ) : frozen ? (
              <button type="button" className="st-btn st-btn--primary st-btn--sm" onClick={resumeGlass}>
                Resume
              </button>
            ) : (
              <button type="button" className="st-btn st-btn--secondary st-btn--sm" onClick={freezeGlass}>
                Freeze
              </button>
            )}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
