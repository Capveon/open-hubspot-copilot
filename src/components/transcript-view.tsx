"use client";

import { clock } from "@/lib/format";
import type { TranscriptLine } from "@/lib/session-types";
import { useEffect, useRef } from "react";

function whoLabel(line: TranscriptLine, themLabel: string): string {
  if (line.source === "glass") return "Glass";
  return line.role === "you" ? "You" : themLabel;
}

function sourceLabel(line: TranscriptLine): string | null {
  if (line.source === "glass") return "rec";
  if (line.source === "stt-partial") return "…";
  if (line.source === "stt") return "live";
  return null;
}

function scroller(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null;
  while (el) {
    const overflow = getComputedStyle(el).overflowY;
    if (overflow === "auto" || overflow === "scroll") return el;
    el = el.parentElement;
  }
  return null;
}

export function TranscriptView({
  lines,
  themLabel,
  startedAt,
  empty = "No transcript on this call.",
  follow = false,
}: {
  lines: TranscriptLine[];
  themLabel: string;
  startedAt?: number | null;
  empty?: string;
  /** Live desk only: keep the newest turn in view unless they have scrolled back to read. */
  follow?: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const arrived = useRef(false);
  const last = lines[lines.length - 1];

  useEffect(() => {
    if (!follow) return;
    if (lines.length === 0) {
      arrived.current = false;
      return;
    }
    const box = scroller(endRef.current);
    if (!box) return;
    const behind = box.scrollHeight - box.scrollTop - box.clientHeight;
    /* Land on the newest turn, then hold the bottom unless they scrolled back to read. */
    if (arrived.current && behind > 200) return;
    arrived.current = true;
    box.scrollTop = box.scrollHeight;
  }, [follow, lines.length, last?.text]);

  if (lines.length === 0) return <p className="tape__empty">{empty}</p>;
  const t0 = startedAt ?? lines[0]?.at ?? 0;
  return (
    <div className="tape">
      {lines.map((line) => (
        <div
          key={line.id}
          className={`tape__line${line.role === "you" ? " tape__line--you" : ""}${
            line.source === "glass" ? " tape__line--glass" : ""
          }`}
        >
          <div className="tape__who">
            {whoLabel(line, themLabel)}
            <span className="tape__stamp">{clock(Math.max(0, line.at - t0))}</span>
            {sourceLabel(line) ? <span className="tape__stamp">{sourceLabel(line)}</span> : null}
          </div>
          <div className="tape__text">{line.text}</div>
        </div>
      ))}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
