# Coaching

The desk is a reader. The model writes **one next line**. You say it or you don't.

## Loop

1. **Opener** is a template (`openerFromCard` in `src/lib/track.ts`). It stays on glass until **Delivered**.
2. After Delivered, the tape (what you said + what they said) goes to `POST /api/suggest`.
3. **Freeze** keeps the current line even if the tape moves. **Resume** lets the coach run again.
4. Hang up does not call the model again and does not dial the next person.

If a line would still work on a different call, the constitution should reject it. That is the whole prompt.

## Files to replace

Ship your motion by editing these, not by forking the UI.

| File | Role |
|---|---|
| `src/lib/constitution.ts` | System prompt. Who is speaking, what you sell, JSON contract (`action`, `agree`, `say`, `move`). |
| `src/lib/banned.ts` / `BANNED_PHRASES` in constitution | Phrases the coach must not emit. |
| `src/lib/canon.ts` | Longer company facts. Background for evals / benches, not the live turn prompt. |
| `src/lib/card.ts` | Default card (title, company, nouns) when HubSpot is thin. |
| `src/lib/track.ts` | Opener shape. Rep name and company already come from `NEXT_PUBLIC_REP_NAME` / `NEXT_PUBLIC_APP_NAME`. |
| `src/lib/scenarios.ts` | `/practice` Mercury bench tapes. Optional. |

Keep the JSON contract at the bottom of `CONSTITUTION`. The parser in `src/lib/suggest.ts` expects it.

Capveon’s water / wastewater / electric ops sell is the example that is already in those files. Copy the structure, delete the Cityworks pitch, write yours.

## Models

| Env | Default | Notes |
|---|---|---|
| `COACH_PROVIDER=openai` | `gpt-4.1` | Live default. Best accuracy on these tapes. |
| `mercury` | `mercury-2` | `/practice` bench. Needs `INCEPTION_API_KEY`. |
| `openrouter` / `cerebras` | `gpt-oss-120b` | Faster, worse at staying on the chair. |

`pnpm sim` runs the same `resolveCoachLine` path as the desk, without PSTN. Needs `OPENAI_API_KEY`.

## Voice hints

Twilio transcription `hints` default to the example motion. Set `OHC_STT_HINTS` to the nouns your buyers actually say.
