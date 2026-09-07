# Keys

One file locally: `.env.local`. `pnpm setup` copies [`.env.example`](../.env.example) there if it is missing. Do not commit it.

`NEXT_PUBLIC_*` is inlined at `next build`. Changing those in a secret store does nothing until you rebuild.

| Variable | Where | What |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Web, **build** | Clerk publishable key. Development on the laptop, Production in prod. |
| `CLERK_SECRET_KEY` | Runtime | Matching secret. |
| `NEXT_PUBLIC_APP_NAME` | Build | Wordmark company. Default `Capveon`. |
| `NEXT_PUBLIC_PRODUCT` | Build | Wordmark product. Default `Copilot`. |
| `NEXT_PUBLIC_REP_NAME` | Build | First name in the opener. Default `Finn`. |
| `OPENAI_API_KEY` | Runtime | Live coach. Default model `gpt-4.1`. |
| `COACH_PROVIDER` | Runtime | `openai` (default), `mercury`, `openrouter`, `cerebras`. |
| `COACH_MODEL` | Runtime | Override. Default `gpt-4.1` when provider is openai. |
| `DATABASE_URL` | Runtime | Postgres URL. Required. |
| `DATABASE_ADMIN_URL` | Migrate | Owner URL if the runtime role cannot `CREATE`. Falls back to `DATABASE_URL`. |
| `OHC_DB_SCHEMA` | Both | Default `ohc`. |
| `OHC_SKIP_MIGRATE` | Prod | `1` if you migrate out of band. |
| `HUBSPOT_ACCESS_TOKEN` | Runtime | Private app token. Falls back to `~/.hscli/config.yml`. |
| `HUBSPOT_PORTAL_ID` | Runtime | Optional, documentation / future use. |
| `OHC_TEST_EMAIL` / `OHC_TEST_PHONE` | Runtime | Overlay for the first built-in test queue. |
| `OHC_BRISON_EMAIL` / `OHC_BRISON_PHONE` | Runtime | Overlay for the second test queue. |
| `OHC_ALLOW_PSTN` | Runtime | `true` to place real calls. Default off. |
| `TWILIO_ACCOUNT_SID` | Runtime | Account. |
| `TWILIO_API_KEY_SID` | Runtime | API key SID (`SK…`), not the account SID. |
| `TWILIO_API_KEY_SECRET` | Runtime | API key secret. |
| `TWILIO_TWIML_APP_SID` | Runtime | TwiML app whose Voice URL is this host. |
| `TWILIO_CALLER_ID` | Runtime | From number, E.164. |
| `OHC_PUBLIC_URL` | Runtime | Public origin Twilio posts to, no trailing slash. |
| `OHC_STT_HINTS` | Runtime | Comma-separated hints for Twilio transcription. |
| `INCEPTION_API_KEY` | Optional | Mercury 2 for `/practice` bench only. |
| `CEREBRAS_API_KEY` / `OPENROUTER_API_KEY` | Optional | Alternate coach providers. |

## Clerk

[dashboard.clerk.com](https://dashboard.clerk.com) — new application.

- Laptop: **Development** keys. Allowed origin `http://localhost:3210`.
- Production: **Production** instance. Allowed origins + redirect URLs = your public origin (`https://copilot.example.com`, `/sign-in`, `/sign-up`, `/*`).

Routes already in the app: `/sign-in`, `/sign-up`.

## OpenAI

[platform.openai.com/api-keys](https://platform.openai.com/api-keys). The live desk calls `gpt-4.1` unless you change `COACH_MODEL`.

## HubSpot

Private app in the portal you dial from. Scopes in [hubspot.md](hubspot.md). Paste the token as `HUBSPOT_ACCESS_TOKEN`.

## Twilio

[twilio.com/try-twilio](https://www.twilio.com/try-twilio). Buy a number, create a TwiML app:

- Voice URL: `https://<host>/api/twilio/voice` (HTTP POST)
- Then `OHC_ALLOW_PSTN=true` and the `TWILIO_*` keys above

Leave PSTN off until you intend to ring a real number. Preview still coaches.
