# Deployment

One runtime: Next.js on Node (`next build` / `next start`, or the Docker image). Postgres for state. Twilio talks to the public origin.

## Web

`output: "standalone"` in `next.config.ts`. Port **3000** in Docker (`HOSTNAME=0.0.0.0`), **3210** in `pnpm dev`.

Bake `NEXT_PUBLIC_*` at **build** time (Clerk publishable key, app name, product, rep name). Runtime secrets:

- `CLERK_SECRET_KEY`
- `OPENAI_API_KEY`
- `DATABASE_URL`
- `HUBSPOT_ACCESS_TOKEN` (if you want real lists)
- `TWILIO_*` + `OHC_ALLOW_PSTN` + `OHC_PUBLIC_URL` (if you want PSTN)

Image:

```bash
docker build --platform linux/arm64 \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_… \
  --build-arg NEXT_PUBLIC_APP_NAME=Acme \
  --build-arg NEXT_PUBLIC_PRODUCT=Copilot \
  --build-arg NEXT_PUBLIC_REP_NAME=Sam \
  -t copilot:latest .
```

Health: `GET /api/health` (no auth). Matcher `200` is enough. `db: true` in the JSON means Postgres answered.

## Database

Postgres only. Schema defaults to `ohc`.

```bash
DATABASE_URL=postgres://… DATABASE_ADMIN_URL=postgres://… pnpm db:migrate
```

Grant the runtime role `USAGE` on the schema and `SELECT, INSERT, UPDATE, DELETE` on the tables. Set `OHC_SKIP_MIGRATE=1` on the running app if CI already migrated.

## Clerk

Production instance. Allowed origins and redirect URLs must include `https://your.host`. Sharing one Clerk app across two production hosts needs a plan that allows extra domains; otherwise create a dedicated instance.

## Twilio

TwiML app Voice URL = `https://your.host/api/twilio/voice` (POST). `OHC_PUBLIC_URL` must be that same origin so transcription callbacks land. Cloudflare SSL Full (strict) is fine; bot fight should stay off for `/api/twilio/*` or Twilio’s POST will 403.

## Capveon production

Same AWS account and cluster as the rest of capveon.ai (`capveon-prod`). Terraform in the product monorepo owns ECR `copilot`, the ECS service, the ALB host rule, and the ACM cert. Secret: `capveon/prod/app/copilot`. Host: **https://copilot.capveon.ai**.

```bash
AWS_PROFILE=capveon ./scripts/deploy-aws.sh
```
