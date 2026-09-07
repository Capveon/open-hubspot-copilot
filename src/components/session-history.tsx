"use client";

import { dayLabel, timeOfDay } from "@/lib/format";
import { placeLabel } from "@/lib/session-progress";
import { readJson, type SessionJson } from "@/lib/session-types";
import Link from "next/link";
import { useEffect, useState } from "react";

type Day = { label: string; sessions: SessionJson[] };

function byDay(sessions: SessionJson[]): Day[] {
  const days: Day[] = [];
  for (const s of sessions) {
    const label = dayLabel(s.createdAt);
    const last = days[days.length - 1];
    if (last && last.label === label) last.sessions.push(s);
    else days.push({ label, sessions: [s] });
  }
  return days;
}

export function SessionHistory() {
  const [sessions, setSessions] = useState<SessionJson[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/sessions")
      .then((r) => readJson<{ sessions: SessionJson[] }>(r))
      .then((data) => alive && setSessions(data.sessions ?? []))
      .catch((err: unknown) => {
        if (!alive) return;
        setSessions([]);
        setError(err instanceof Error ? err.message : "Could not load sessions");
      });
    return () => {
      alive = false;
    };
  }, []);

  const calls = sessions?.reduce((sum, s) => sum + (s.callCount ?? 0), 0) ?? 0;

  return (
    <main className="page">
      <header className="dial__head">
        <h1 className="t-page-title">Sessions</h1>
        {sessions?.length ? (
          <p className="lede">
            {sessions.length} session{sessions.length === 1 ? "" : "s"} · {calls} call
            {calls === 1 ? "" : "s"}
          </p>
        ) : null}
      </header>

      {error ? <p className="warn warn--risk">{error}</p> : null}

      {sessions === null ? (
        <p className="t-meta">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="panel__empty panel__empty--bare">
          No sessions yet.{" "}
          <Link href="/" className="quiet-link">
            Pick a queue
          </Link>
          .
        </p>
      ) : (
        byDay(sessions).map((day) => (
          <section className="day" key={day.label} aria-label={day.label}>
            <h2 className="day__label">{day.label}</h2>
            <ul className="slist">
              {day.sessions.map((s) => {
                const open = s.status === "live";
                return (
                  <li key={s.id}>
                    <Link href={`/s/${s.id}`} className="srow">
                      <span className="srow__name">{s.queueName}</span>
                      <span className="srow__meta">{timeOfDay(s.createdAt)}</span>
                      <span className="srow__meta">
                        {s.callCount ?? 0} call{(s.callCount ?? 0) === 1 ? "" : "s"}
                      </span>
                      <span className="srow__meta">
                        {open ? `Resume at ${placeLabel(s)}` : placeLabel(s)}
                      </span>
                      <span className="badge" data-tone={open ? "success" : undefined}>
                        {open ? "In progress" : "Ended"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
