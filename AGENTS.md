# Agent notes

HubSpot power dialer + live coach. Do not place PSTN calls unless `OHC_ALLOW_PSTN=true` and the user asked. Do not commit `.env.local`.

- `/` is queues + recent sessions. `/history` is the archive. `/s/[id]` is the desk (or review if ended). `/s/[id]/c/[callId]` is one tape.
- Hang up does not auto-dial. **Next** advances. **Delivered** releases the opener. **Freeze** locks the coach.
- Coach prompt: `src/lib/constitution.ts`. Opener: `src/lib/track.ts`. Branding: `NEXT_PUBLIC_APP_NAME` / `PRODUCT` / `REP_NAME`.
- HubSpot queues are **lists**, not Contacts views. Token: `HUBSPOT_ACCESS_TOKEN`.
- Preview = no Twilio token. Live = Twilio Device + TwiML at `/api/twilio/voice`.
- `pnpm sim` is text evals. `GET /api/health` is public.
