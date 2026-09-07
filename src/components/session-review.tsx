"use client";

import { fullName, spanOf, timeOfDay, when } from "@/lib/format";
import { formatUsPhone } from "@/lib/contact";
import type { SessionJson } from "@/lib/session-types";
import Link from "next/link";
import { useState } from "react";
import { TranscriptView } from "./transcript-view";

export function SessionReview({ session }: { session: SessionJson }) {
  const [open, setOpen] = useState<string | null>(null);
  const calls = session.calls ?? [];

  return (
    <main className="page review">
      <header className="dial__head">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/history">Sessions</Link>
        </nav>
        <h1 className="t-page-title">{session.queueName}</h1>
        <p className="lede">
          {calls.length} call{calls.length === 1 ? "" : "s"} · {session.contacts.length} contact
          {session.contacts.length === 1 ? "" : "s"} in the queue · started {when(session.createdAt)}
          {session.endedAt ? ` · ended ${when(session.endedAt)}` : ""}
        </p>
      </header>

      {calls.length === 0 ? (
        <p className="panel__empty">This session ended before a call went out.</p>
      ) : (
        <ul className="clist">
          {calls.map((call) => {
            const expanded = open === call.id;
            return (
              <li key={call.id} className="crow" data-open={expanded}>
                <button
                  type="button"
                  className="crow__head"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : call.id)}
                >
                  <span className="crow__name">{fullName(call.contact)}</span>
                  <span className="crow__meta">
                    {call.contact?.phone ? formatUsPhone(call.contact.phone) : "No phone"}
                  </span>
                  <span className="crow__meta t-mono">{spanOf(call.startedAt, call.endedAt)}</span>
                  <span className="crow__meta">{timeOfDay(call.startedAt)}</span>
                  <span className="crow__meta">
                    {call.transcript.length} line{call.transcript.length === 1 ? "" : "s"}
                  </span>
                  <span className="crow__caret" aria-hidden="true" />
                </button>
                {expanded ? (
                  <div className="crow__body">
                    <TranscriptView
                      lines={call.transcript}
                      themLabel={call.contact?.firstName || "Them"}
                      startedAt={call.startedAt}
                      empty="No transcript was captured on this call."
                    />
                    <Link
                      href={`/s/${session.id}/c/${call.id}`}
                      className="st-btn st-btn--secondary st-btn--sm"
                    >
                      Open full transcript
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
