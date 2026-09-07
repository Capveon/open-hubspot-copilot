"use client";

import { fullName, spanOf, when } from "@/lib/format";
import { formatUsPhone } from "@/lib/contact";
import { readJson, type CallJson } from "@/lib/session-types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TranscriptView } from "./transcript-view";

export function CallReview({ sessionId, callId }: { sessionId: string; callId: string }) {
  const [call, setCall] = useState<CallJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/calls/${callId}`)
      .then((r) => readJson<{ call: CallJson }>(r))
      .then((data) => alive && setCall(data.call))
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load that call");
      });
    return () => {
      alive = false;
    };
  }, [callId]);

  return (
    <main className="page review">
      <header className="dial__head">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/history">Sessions</Link>
          <span className="crumb__sep" aria-hidden="true">
            ·
          </span>
          <Link href={`/s/${sessionId}`}>Session</Link>
        </nav>
        <h1 className="t-page-title">{call ? fullName(call.contact) : "Call"}</h1>
        {call ? (
          <p className="lede">
            {call.contact?.phone ? formatUsPhone(call.contact.phone) : "No phone on record"} ·{" "}
            {when(call.startedAt)} · {spanOf(call.startedAt, call.endedAt)} · {call.status}
          </p>
        ) : null}
      </header>

      {error ? <p className="warn warn--risk">{error}</p> : null}
      {!call && !error ? <p className="t-meta">Loading transcript…</p> : null}
      {call ? (
        <div className="review__tape">
          <TranscriptView
            lines={call.transcript}
            themLabel={call.contact?.firstName || "Them"}
            startedAt={call.startedAt}
            empty="No transcript was captured on this call."
          />
        </div>
      ) : null}
    </main>
  );
}
