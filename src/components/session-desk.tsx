"use client";

import { readJson, type SessionJson } from "@/lib/session-types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LiveSession } from "./live-session";
import { SessionReview } from "./session-review";

export function SessionDesk({
  sessionId,
  autoStart,
}: {
  sessionId: string;
  autoStart: boolean;
}) {
  const [session, setSession] = useState<SessionJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => readJson<{ session: SessionJson }>(r))
      .then((data) => alive && setSession(data.session))
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load that session");
      });
    return () => {
      alive = false;
    };
  }, [sessionId]);

  if (error) {
    return (
      <main className="page">
        <p className="warn warn--risk">{error}</p>
        <Link href="/" className="st-btn st-btn--secondary">
          Back to dialer
        </Link>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="page">
        <p className="t-meta">Loading session…</p>
      </main>
    );
  }

  if (session.status === "ended") return <SessionReview session={session} />;
  return <LiveSession initialSession={session} autoStart={autoStart} />;
}
