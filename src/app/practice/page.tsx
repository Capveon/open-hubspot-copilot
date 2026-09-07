"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lastWords, SCENARIOS, type Scenario } from "@/lib/scenarios";
import type { ReasoningEffort } from "@/lib/mercury";

type Line = { agree: string; say: string; move: string };

type DoneEvent = {
  seq: number;
  text: string;
  line: Line;
  banned: string[];
  ttfbMs: number;
  totalMs: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    reasoningTokens: number;
  };
};

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

export default function GlassPage() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = useMemo(
    () => SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0],
    [scenarioId],
  );
  const [them, setThem] = useState(scenario.them);
  const [effort, setEffort] = useState<ReasoningEffort>("instant");
  const [realtime, setRealtime] = useState(true);
  const [diffusing, setDiffusing] = useState(true);
  const [structured, setStructured] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("idle");
  const [line, setLine] = useState<Line>({ agree: "", say: "", move: "" });
  const [draft, setDraft] = useState(true);
  const [banned, setBanned] = useState<string[]>([]);
  const [ttfbMs, setTtfbMs] = useState<number | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [cached, setCached] = useState(0);
  const [promptTokens, setPromptTokens] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const playRef = useRef<number | null>(null);

  useEffect(() => {
    setThem(scenario.them);
    setLine({ agree: "", say: "", move: "" });
    setDraft(true);
    setBanned([]);
    setTtfbMs(null);
    setTotalMs(null);
  }, [scenario]);

  const suggest = useCallback(
    async (partial: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++seqRef.current;
      setStatus(`req ${seq}`);
      setDraft(true);
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          seq,
          prior: scenario.prior,
          themPartial: partial,
          card: scenario.card,
          reasoningEffort: effort,
          realtime,
          diffusing,
          structured,
          stream: true,
        }),
      });
      if (!res.ok || !res.body) {
        setStatus(`http ${res.status}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parsed = parseSse(buf);
        buf = parsed.rest;
        for (const ev of parsed.events) {
          const data = JSON.parse(ev.data) as Record<string, unknown>;
          if (data.seq !== seq) continue;
          if (ev.event === "delta") {
            const next = data.line as Line | undefined;
            if (next?.say) {
              setLine(next);
              setDraft(true);
            }
          }
          if (ev.event === "done") {
            const doneEv = data as unknown as DoneEvent;
            setLine(doneEv.line);
            setBanned(doneEv.banned);
            setTtfbMs(doneEv.ttfbMs);
            setTotalMs(doneEv.totalMs);
            setCached(doneEv.usage.cachedTokens);
            setPromptTokens(doneEv.usage.promptTokens);
            setDraft(false);
            setStatus("locked");
            setLog((prev) =>
              [
                `${seq}  ttfb ${doneEv.ttfbMs}ms  total ${doneEv.totalMs}ms  cache ${doneEv.usage.cachedTokens}/${doneEv.usage.promptTokens}  reason ${doneEv.usage.reasoningTokens}  ${doneEv.line.move}`,
                ...prev,
              ].slice(0, 12),
            );
          }
          if (ev.event === "error") {
            setStatus(String(data.message ?? "error"));
          }
        }
      }
    },
    [diffusing, effort, realtime, scenario, structured],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (!them.trim()) return;
      void suggest(them).catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus(err instanceof Error ? err.message : "failed");
      });
    }, 180);
    return () => window.clearTimeout(handle);
  }, [them, suggest]);

  function playScenario(next: Scenario) {
    setScenarioId(next.id);
    setPlaying(true);
    const words = next.them.split(/\s+/);
    let i = 0;
    if (playRef.current) window.clearInterval(playRef.current);
    setThem("");
    playRef.current = window.setInterval(() => {
      i += 1;
      setThem(words.slice(0, i).join(" "));
      if (i >= words.length) {
        if (playRef.current) window.clearInterval(playRef.current);
        setPlaying(false);
      }
    }, 280);
  }

  const spoken = `${line.agree} ${line.say}`.trim();

  return (
    <main className="practice">
      <header className="top">
        <div>
          <h1>Glass bench</h1>
          <p>Type as them, or play a scenario. The line Finn reads lands on the right.</p>
        </div>
        <a href="https://docs.inceptionlabs.ai/capabilities/streaming" className="mono">
          mercury-2
        </a>
      </header>

      <div className="scenarios">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            data-active={s.id === scenarioId}
            onClick={() => playScenario(s)}
          >
            {s.kind === "ood" ? "OOD " : ""}
            {s.title}
          </button>
        ))}
      </div>

      <div className="controls">
        <label>
          effort
          <select
            value={effort}
            onChange={(e) => setEffort(e.target.value as ReasoningEffort)}
          >
            <option value="instant">instant</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={realtime}
            onChange={(e) => setRealtime(e.target.checked)}
          />
          realtime
        </label>
        <label>
          <input
            type="checkbox"
            checked={diffusing}
            onChange={(e) => setDiffusing(e.target.checked)}
          />
          diffusing
        </label>
        <label>
          <input
            type="checkbox"
            checked={structured}
            onChange={(e) => setStructured(e.target.checked)}
          />
          json schema
        </label>
        <button type="button" className="ghost" disabled={playing} onClick={() => playScenario(scenario)}>
          replay as speech
        </button>
      </div>

      <section className="glass">
        <div className="agree">{line.agree || "\u00a0"}</div>
        <p className={`say${draft ? " draft" : ""}${banned.length ? " banned" : ""}`}>
          {line.say || "Waiting on their next clause…"}
        </p>
        <div className="meta-row">
          <span>
            {line.move ? `move: ${line.move}` : status} · mirror “
            {lastWords(them) || "—"}”
          </span>
          <span className="mono">{status}</span>
        </div>
        {banned.length > 0 ? (
          <p className="banned">Banned: {banned.join(", ")}</p>
        ) : null}
      </section>

      <div className="stats">
        <div className="stat">
          <b>{ttfbMs == null ? "—" : `${ttfbMs}ms`}</b>
          <span>TTFB / first paint</span>
        </div>
        <div className="stat">
          <b>{totalMs == null ? "—" : `${totalMs}ms`}</b>
          <span>locked</span>
        </div>
        <div className="stat">
          <b>
            {promptTokens ? `${cached}/${promptTokens}` : "—"}
          </b>
          <span>cached / prompt tokens</span>
        </div>
        <div className="stat">
          <b>{spoken.split(/\s+/).filter(Boolean).length || "—"}</b>
          <span>words on glass</span>
        </div>
      </div>

      <div className="split">
        <div>
          <textarea
            value={them}
            onChange={(e) => {
              setPlaying(false);
              if (playRef.current) window.clearInterval(playRef.current);
              setThem(e.target.value);
            }}
            placeholder="They are still talking…"
          />
          <p className="note">{scenario.note}</p>
        </div>
        <pre className="log mono">{log.join("\n") || "latency log"}</pre>
      </div>
    </main>
  );
}
