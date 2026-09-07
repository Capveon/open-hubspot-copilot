"use client";

import { when } from "@/lib/format";
import type { HsQueue } from "@/lib/hubspot";
import { openSessionForQueue, placeLabel } from "@/lib/session-progress";
import { readJson, type SessionJson } from "@/lib/session-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Telephony = {
  pstn: boolean;
  callerId: string | null;
  signup: string;
  yc: string;
  missing: string[];
};

/** Home shows the last few sessions inline; the whole archive lives at /history. */
const RECENT = 5;

export function HomeDesk() {
  const router = useRouter();
  const [queues, setQueues] = useState<HsQueue[] | null>(null);
  const [sessions, setSessions] = useState<SessionJson[] | null>(null);
  const [listsNote, setListsNote] = useState<string | null>(null);
  const [tel, setTel] = useState<Telephony | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/hubspot/queues")
      .then((r) => readJson<{ queues: HsQueue[]; listsError: string | null }>(r))
      .then((data) => {
        if (!alive) return;
        setQueues(data.queues ?? []);
        setListsNote(data.listsError || null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setQueues([]);
        setError(err instanceof Error ? err.message : "HubSpot queues failed");
      });

    fetch("/api/sessions")
      .then((r) => readJson<{ sessions: SessionJson[] }>(r))
      .then((data) => alive && setSessions(data.sessions ?? []))
      .catch(() => alive && setSessions([]));

    fetch("/api/telephony")
      .then((r) => r.json() as Promise<Telephony>)
      .then((data) => alive && setTel(data))
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  function resume(sessionId: string) {
    router.push(`/s/${sessionId}`);
  }

  async function start(queueId: string, replace?: SessionJson) {
    if (starting) return;
    setStarting(queueId);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueId }),
      });
      const data = await readJson<{ session: SessionJson }>(res);
      if (replace) {
        await fetch(`/api/sessions/${replace.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ended" }),
        }).catch(() => undefined);
      }
      router.push(`/s/${data.session.id}?new=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start that queue");
      setStarting(null);
    }
  }

  const recent = sessions?.slice(0, RECENT) ?? null;
  const busy = Boolean(starting) || sessions === null;

  return (
    <main className="page dial">
      <header className="dial__head">
        <h1 className="t-page-title">Dialer</h1>
        <p className="lede">
          Leave a list whenever. Resume opens the same contact — nothing auto-dials until you press
          Call or Next.
        </p>
      </header>

      {error ? <p className="warn warn--risk">{error}</p> : null}
      {listsNote ? (
        <p className="warn">
          HubSpot lists are unavailable right now. Test queues below still work.
        </p>
      ) : null}
      {tel && !tel.pstn ? (
        <p className="warn">
          PSTN is off, so calls run as Preview and never ring a real number. To place live calls,
          set Twilio credentials —{" "}
          <a href={tel.signup} target="_blank" rel="noreferrer" className="warn__link">
            Twilio
          </a>
          {tel.missing.length ? ` · missing ${tel.missing.join(", ")}` : null}
        </p>
      ) : null}

      <div className="dial__cols">
        <section className="panel" aria-labelledby="queues-head">
          <div className="panel__head">
            <h2 className="t-subsection" id="queues-head">
              Queues
            </h2>
            {tel ? (
              <span className="badge" data-tone={tel.pstn ? "success" : "warning"}>
                {tel.pstn ? `Live line · ${tel.callerId ?? "caller ID set"}` : "Preview only"}
              </span>
            ) : null}
          </div>

          {queues === null ? (
            <p className="panel__empty">Loading queues…</p>
          ) : queues.length === 0 ? (
            <p className="panel__empty">No queues on this HubSpot token.</p>
          ) : (
            <ul className="qlist">
              {queues.map((q) => {
                const open = openSessionForQueue(sessions, q.id);
                return (
                  <li className="qrow" key={q.id}>
                    <div className="qrow__main">
                      <span className="qrow__name">{q.name}</span>
                      <span className="qrow__meta">
                        {open
                          ? `In progress · resume at ${placeLabel(open)}`
                          : q.source === "test"
                            ? "Test queue"
                            : "HubSpot list"}
                        {!open && q.size != null
                          ? ` · ${q.size} contact${q.size === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </div>
                    <div className="qrow__actions">
                      {open ? (
                        <>
                          <button
                            type="button"
                            className="st-btn st-btn--secondary st-btn--sm"
                            onClick={() => void start(q.id, open)}
                            disabled={busy}
                          >
                            {starting === q.id ? "Starting…" : "Start over"}
                          </button>
                          <button
                            type="button"
                            className="st-btn st-btn--primary"
                            onClick={() => resume(open.id)}
                            disabled={busy}
                          >
                            Resume
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="st-btn st-btn--primary"
                          onClick={() => void start(q.id)}
                          disabled={busy}
                        >
                          {starting === q.id ? "Starting…" : "Start"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="recent-head">
          <div className="panel__head">
            <h2 className="t-subsection" id="recent-head">
              Recent sessions
            </h2>
            {sessions?.length ? (
              <Link href="/history" className="panel__link">
                All {sessions.length} sessions
              </Link>
            ) : null}
          </div>

          {recent === null ? (
            <p className="panel__empty">Loading sessions…</p>
          ) : recent.length === 0 ? (
            <p className="panel__empty">Nothing yet. Start a queue and it shows up here.</p>
          ) : (
            <ul className="hlist">
              {recent.map((s) => {
                const open = s.status === "live";
                return (
                  <li key={s.id}>
                    <Link href={`/s/${s.id}`} className="hrow">
                      <span className="hrow__top">
                        <span className="hrow__name">{s.queueName}</span>
                        <span className="badge" data-tone={open ? "success" : undefined}>
                          {open ? "In progress" : "Ended"}
                        </span>
                      </span>
                      <span className="hrow__meta">
                        {open
                          ? `Resume at ${placeLabel(s)}`
                          : `${when(s.createdAt)} · ${s.callCount ?? 0} call${
                              (s.callCount ?? 0) === 1 ? "" : "s"
                            }`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <p className="dial__aside">
        <Link href="/practice" className="quiet-link">
          Glass bench
        </Link>
      </p>
    </main>
  );
}
