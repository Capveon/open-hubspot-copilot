# Architecture

One Next.js app. No agent worker. The browser is the handset.

```
/                     pick a queue, last sessions
/history              full archive
/s/:id                live desk, or review if the session has ended
/s/:id/c/:callId      one tape
/sign-in  /sign-up    Clerk
/practice             Mercury decode bench (optional)
```

## Desk

Three columns: transcript · call · coach.

- **Next** — next contact in the session. Dials only if PSTN is on.
- **Done for now** — hang up the current call, leave `status=live`, go home. Resume later.
- **Finish list** — end the session, review.
- Closing the tab does not archive. Open passes stay live until you finish them.

`POST /api/sessions` always starts at index 0. Resume is `GET` the existing live session for that queue.

## Data

Postgres schema `ohc` (override `OHC_DB_SCHEMA`): `users`, `sessions`, `calls`, `transcript_lines`.

Migrate: `pnpm db:migrate`. Runtime can also migrate on boot unless `OHC_SKIP_MIGRATE=1`. Health (`GET /api/health`) pings the database; it is public so a load balancer can use it.

## Tape

Browser poll + Twilio transcription callbacks. `mergeTranscript` keeps a newer STT line from being wiped by an older poll. The current glass line is in `said` as soon as it paints, so the coach sees what you are about to read.

## PSTN

`src/components/live-session.tsx` loads `@twilio/voice-sdk`. `/api/twilio/token` mints a JWT. Twilio POSTs `/api/twilio/voice` with `callId`; the server dials **only** the number on that call row. Preview mode skips all of that: optional mic, no network call.

Do not place PSTN calls in automated tests. `OHC_ALLOW_PSTN` defaults off.

## Auth

Clerk middleware. Public: sign-in/up, `/api/health`, `/api/twilio/voice`, `/api/twilio/transcript`. Everything else needs a session.
