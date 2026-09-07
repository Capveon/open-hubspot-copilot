# Open HubSpot Copilot

A power dialer over HubSpot lists, with a live coach on the right and a phone in the middle. Hang up unlocks **Next**. Nothing auto-dials.

Not a CRM sidebar. Three panes: tape · call · what to say. The model writes the next line off the transcript. You read it. You hang up. You choose whether to dial again.

**[Live demo](https://copilot.capveon.ai)** · MIT · Node 20, pnpm 9

Preview mode needs no phone number: sign in, pick a queue, coach off the opener and whatever you type as them. PSTN is off until you set `OHC_ALLOW_PSTN=true`.

## What you get

| | |
|---|---|
| **Queues** | HubSpot **lists/segments**, not Contacts index views. Optional local test queues. |
| **Desk** | Transcript · Twilio (or Preview) · coach. Mute, keypad, hang up. |
| **Coach** | GPT-4.1 by default. Opener stays until you click **Delivered**. **Freeze** locks the line. |
| **Sessions** | Resume an in-progress pass. **Next** advances. **Done for now** keeps the session live. **Finish list** archives it. |
| **Review** | Ended session is the call list. `/s/[id]/c/[callId]` is one tape. Nothing rings. |

Capveon’s water-ops constitution ships as the working example. Swap three files and it is your motion — see [Make it yours](#make-it-yours).

## Requirements

| Need | What it is for | Get it |
|---|---|---|
| **Node 20+** and **pnpm 9** | Run the repo | [nodejs.org](https://nodejs.org), `corepack enable && corepack prepare pnpm@9.15.0 --activate` |
| **Postgres** | Sessions, calls, transcript lines (schema `ohc`) | Local Docker, or any hosted Postgres |
| **Clerk** | Sign-in. Local = Development instance. Prod = Production instance. | [dashboard.clerk.com](https://dashboard.clerk.com) |
| **OpenAI** | Live coach (`gpt-4.1`) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **HubSpot** | Real queues. Optional — without a token you still get test queues | [Private app](https://developers.hubspot.com/docs/api/private-apps) with `crm.objects.contacts.read` and `crm.lists.read` |
| **Twilio Voice** | Outbound PSTN. Optional — Preview never rings | [twilio.com/try-twilio](https://www.twilio.com/try-twilio) |

You can reach a working desk with Clerk + OpenAI + Postgres alone.

## Run it

```bash
git clone https://github.com/Capveon/open-hubspot-copilot.git
cd open-hubspot-copilot
corepack enable
pnpm install
pnpm setup
```

`pnpm setup` copies `.env.example` → `.env.local` if that file is missing. Fill Clerk, OpenAI, and `DATABASE_URL`.

```bash
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3210](http://localhost:3210). Sign in, pick a queue, **Start**. Click **Delivered** after the opener. Type as them if you are in Preview. Hang up. **Next**.

| Command | What it does |
|---|---|
| `pnpm setup` | Create `.env.local` from the example |
| `pnpm db:migrate` | Create schema `ohc` (override with `OHC_DB_SCHEMA`) |
| `pnpm dev` | Next.js on port **3210** |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm sim` | Text evals against the same coach path as live glass ([open-strategies](https://github.com/Capveon/open-strategies)) |

## If it is broken

| What you see | Likely cause |
|---|---|
| Clerk loop on localhost | Development keys, and `http://localhost:3210` allowed in the Clerk app |
| No queues / HubSpot 403 | Token missing `crm.lists.read`. Index **views** are not lists — see [docs/hubspot.md](docs/hubspot.md) |
| Phone says Preview | No Twilio token, or `OHC_ALLOW_PSTN` is not `true` |
| Dial → TwiML error | TwiML app Voice URL is not `https://<host>/api/twilio/voice`, or `OHC_PUBLIC_URL` is not reachable by Twilio |
| Coach is empty / repeats | `OPENAI_API_KEY` missing, or you have not clicked **Delivered** |
| `DATABASE_URL must be a Postgres URL` | SQLite is not supported. Point at Postgres and migrate |

Nothing auto-dials after hangup. That is the product, not a bug.

## Make it yours

The desk is generic. The **sell** is not. Three files, then branding env:

| File | What to put there |
|---|---|
| [`src/lib/constitution.ts`](src/lib/constitution.ts) | Who is on the phone, what you sell, how they sound. JSON-only reply contract at the bottom stays. |
| [`src/lib/track.ts`](src/lib/track.ts) | The opener (name/company already come from env). |
| [`src/lib/card.ts`](src/lib/card.ts) | Default card when HubSpot has no title/company. |

```bash
NEXT_PUBLIC_APP_NAME=Acme
NEXT_PUBLIC_PRODUCT=Copilot
NEXT_PUBLIC_REP_NAME=Sam
```

Those are inlined at **build** time. Rebuild after you change them.

Banned phrases live next to the constitution. STT hints: `OHC_STT_HINTS`. Full walkthrough: [docs/coaching.md](docs/coaching.md).

## How a call is wired

```
browser  --Twilio Device-->  TwiML app  --POST-->  /api/twilio/voice  --> PSTN
   |                              |
   |                              +-- transcription --> /api/twilio/transcript
   |
   +-- HTTP --> Next.js (Clerk, HubSpot lists, coach SSE, sessions)
                    |
                    +-- constitution.ts + GPT-4.1
                    +-- Postgres schema ohc
```

1. **Start** on a queue creates a session and (only with `?new=1`) places the first call.
2. Opener is a template. It stays on glass until **Delivered**.
3. After that, `POST /api/suggest` streams the next line from the tape. **Freeze** stops that. **Resume** starts it again.
4. Hang up does not advance. **Next** loads the next contact and dials if PSTN is on.

More in [docs/architecture.md](docs/architecture.md).

## Deploy

Next.js standalone (`output: "standalone"`). Image: `Dockerfile` (linux/arm64). Bake every `NEXT_PUBLIC_*` at **build**. Runtime secrets: `CLERK_SECRET_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`, HubSpot, Twilio.

Health: `GET /api/health` (no auth). Point a load balancer there. Set `OHC_SKIP_MIGRATE=1` on the running app if CI already migrated.

`OHC_PUBLIC_URL` must be the public origin Twilio can POST to. Point the TwiML app at `/api/twilio/voice`. Add that origin in Clerk (allowed origins + redirect URLs).

Checklist: [docs/deployment.md](docs/deployment.md). Env reference: [docs/keys.md](docs/keys.md).

## Repo map

```
src/app              Next.js routes — desk, history, sign-in, APIs
src/components       Home, live desk, review
src/lib              Coach, HubSpot, Twilio, sessions, constitution
evals                Text sim (`pnpm sim`)
docs                 Keys, HubSpot, coaching, architecture, deploy
```

## Docs

| | |
|---|---|
| [docs/keys.md](docs/keys.md) | Every env var |
| [docs/hubspot.md](docs/hubspot.md) | Lists vs views, private app scopes |
| [docs/coaching.md](docs/coaching.md) | Constitution, opener, Delivered / Freeze |
| [docs/architecture.md](docs/architecture.md) | Desk, sessions, tape |
| [docs/deployment.md](docs/deployment.md) | Docker, Postgres, Twilio, Clerk |
| [docs/buyer-peter-simms.md](docs/buyer-peter-simms.md) | Example roleplay script for the test queue |

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md). `pnpm typecheck` before you send a PR.

## License

[MIT](LICENSE)
