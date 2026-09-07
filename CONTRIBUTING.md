# Contributing

## Make it yours (most common)

1. Rewrite `src/lib/constitution.ts` for who is on the phone and what you sell. Keep the JSON contract at the bottom.
2. Adjust the opener in `src/lib/track.ts` if the template is wrong for your motion. Rep name and company already come from env.
3. Put default title/company/nouns in `src/lib/card.ts`.
4. Set `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_PRODUCT`, `NEXT_PUBLIC_REP_NAME` and rebuild.
5. Run `pnpm typecheck`. Click through Preview on localhost (no PSTN).

Do not put secrets in the constitution. Do not add your company’s private playbook as the default if you are sending a PR to this repo — keep that in a fork.

## Code

- HubSpot and Twilio stay on the server. Do not import `src/lib/hubspot.ts` from a client component.
- Hang up must not auto-dial. **Next** is the only advance.
- `pnpm typecheck` before you send a PR.
- Do not place PSTN calls unless the maintainer asked.

## Evals

`pnpm sim` needs `OPENAI_API_KEY`. It uses [@open-strategies/core](https://github.com/Capveon/open-strategies). Add tapes in `evals/glass-tasks.ts`.
