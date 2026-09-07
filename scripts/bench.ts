import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { findBanned } from "../src/lib/banned";
import { loadLocalEnv } from "../src/lib/env";
import { mercuryChat, type ReasoningEffort } from "../src/lib/mercury";
import { SCENARIOS } from "../src/lib/scenarios";
import { buildMessages, LINE_SCHEMA, parseLine } from "../src/lib/suggest";

loadLocalEnv();

type Config = {
  name: string;
  reasoningEffort: ReasoningEffort;
  realtime: boolean;
  stream: boolean;
  diffusing: boolean;
  structured: boolean;
  maxTokens: number;
};

const CONFIGS: Config[] = [
  {
    name: "instant+realtime+plain",
    reasoningEffort: "instant",
    realtime: true,
    stream: true,
    diffusing: false,
    structured: false,
    maxTokens: 64,
  },
  {
    name: "instant+realtime+json",
    reasoningEffort: "instant",
    realtime: true,
    stream: true,
    diffusing: false,
    structured: true,
    maxTokens: 96,
  },
  {
    name: "instant+diffusing+json",
    reasoningEffort: "instant",
    realtime: true,
    stream: true,
    diffusing: true,
    structured: true,
    maxTokens: 96,
  },
  {
    name: "low+realtime+json",
    reasoningEffort: "low",
    realtime: true,
    stream: true,
    diffusing: false,
    structured: true,
    maxTokens: 96,
  },
];

const TARGET = {
  ttfbP50: 250,
  totalP50: 450,
  overlapLockP50: 350,
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i] ?? 0;
}

async function one(
  config: Config,
  scenario = SCENARIOS[0],
  them = scenario.them,
  signal?: AbortSignal,
) {
  const messages = buildMessages({
    card: scenario.card,
    prior: scenario.prior,
    themPartial: them,
  });
  const result = await mercuryChat({
    messages,
    maxTokens: config.maxTokens,
    reasoningEffort: config.reasoningEffort,
    realtime: config.realtime,
    stream: config.stream,
    diffusing: config.diffusing,
    jsonSchema: config.structured ? LINE_SCHEMA : undefined,
    signal,
  });
  const line = parseLine(result.text);
  const spoken = `${line.agree} ${line.say}`.trim();
  return {
    ttfbMs: result.ttfbMs,
    totalMs: result.totalMs,
    usage: result.usage,
    line,
    spoken,
    banned: findBanned(spoken),
  };
}

type LineResult = Awaited<ReturnType<typeof one>>;

function isAbort(err: unknown): boolean {
  if (err instanceof Error && /abort/i.test(err.message)) return true;
  return err instanceof DOMException && err.name === "AbortError";
}

async function overlapLock(config: Config) {
  const scenario = SCENARIOS.find((s) => s.id === "consent-pacp") ?? SCENARIOS[0];
  const words = scenario.them.split(/\s+/);
  const cuts: number[] = [];
  for (let i = 4; i < words.length; i += 3) cuts.push(i);
  cuts.push(words.length);

  let controller: AbortController | null = null;
  let inFlight: Promise<LineResult | null> = Promise.resolve(null);

  for (const [idx, cut] of cuts.entries()) {
    controller?.abort();
    controller = new AbortController();
    const partial = words.slice(0, cut).join(" ");
    const signal = controller.signal;
    inFlight = one(config, scenario, partial, signal).catch((err: unknown) => {
      if (isAbort(err)) return null;
      throw err;
    });
    if (idx < cuts.length - 1) await sleep(160);
  }

  const result = await inFlight;
  if (!result) throw new Error("overlap produced no final line");
  return result;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!process.env.INCEPTION_API_KEY) {
    throw new Error("INCEPTION_API_KEY missing — copy .env.example to .env.local");
  }

  console.log("warming prefix cache…");
  const warmCfg = CONFIGS[1] ?? CONFIGS[0];
  await one(warmCfg);
  await one(warmCfg);

  const latency: Record<string, Array<{ ttfbMs: number; totalMs: number; cached: number; prompt: number }>> =
    {};
  for (const config of CONFIGS) {
    latency[config.name] = [];
    console.log(`\nlatency ×5  ${config.name}`);
    for (let i = 0; i < 5; i++) {
      const row = await one(config, SCENARIOS[0], SCENARIOS[0].them);
      latency[config.name].push({
        ttfbMs: row.ttfbMs,
        totalMs: row.totalMs,
        cached: row.usage.cachedTokens,
        prompt: row.usage.promptTokens,
      });
      console.log(
        `  ${i + 1}  ttfb ${row.ttfbMs.toFixed(0)}ms  total ${row.totalMs.toFixed(0)}ms  cache ${row.usage.cachedTokens}/${row.usage.promptTokens}  reason ${row.usage.reasoningTokens}`,
      );
    }
  }

  const qualityCfg =
    CONFIGS.find((c) => c.name === "instant+realtime+json") ?? CONFIGS[0];
  console.log(`\nquality  ${qualityCfg.name}`);
  const quality = [];
  for (const scenario of SCENARIOS) {
    const row = await one(qualityCfg, scenario, scenario.them);
    quality.push({
      id: scenario.id,
      kind: scenario.kind,
      title: scenario.title,
      note: scenario.note,
      spoken: row.spoken,
      move: row.line.move,
      banned: row.banned,
      ttfbMs: Math.round(row.ttfbMs),
      totalMs: Math.round(row.totalMs),
    });
    const flag = row.banned.length ? ` BANNED:${row.banned.join(",")}` : "";
    console.log(
      `  [${scenario.kind}] ${scenario.id}  ${row.totalMs.toFixed(0)}ms${flag}\n    ${row.spoken}`,
    );
  }

  console.log("\noverlap lock (consent-order OOD, word-by-word) ×3");
  const overlaps = [];
  for (let i = 0; i < 3; i++) {
    const row = await overlapLock(qualityCfg);
    overlaps.push({
      ttfbMs: row.ttfbMs,
      totalMs: row.totalMs,
      spoken: row.spoken,
      banned: row.banned,
    });
    console.log(
      `  ${i + 1}  lock ${row.totalMs.toFixed(0)}ms  ttfb ${row.ttfbMs.toFixed(0)}ms\n    ${row.spoken}`,
    );
  }

  const summary = Object.fromEntries(
    CONFIGS.map((c) => {
      const rows = latency[c.name] ?? [];
      const ttfb = rows.map((r) => r.ttfbMs);
      const total = rows.map((r) => r.totalMs);
      return [
        c.name,
        {
          ttfbP50: Math.round(percentile(ttfb, 50)),
          ttfbP90: Math.round(percentile(ttfb, 90)),
          totalP50: Math.round(percentile(total, 50)),
          totalP90: Math.round(percentile(total, 90)),
          cachedP50: Math.round(percentile(rows.map((r) => r.cached), 50)),
        },
      ];
    }),
  );

  const primary = summary["instant+realtime+json"] as
    | { ttfbP50: number; totalP50: number }
    | undefined;
  const overlapMs = overlaps.map((o) => o.totalMs);
  const overlapP50 = Math.round(percentile(overlapMs, 50));
  const bannedCount = quality.filter((q) => q.banned.length > 0).length;
  const verdict = {
    ttfb: primary && primary.ttfbP50 <= TARGET.ttfbP50,
    complete: primary && primary.totalP50 <= TARGET.totalP50,
    overlap: overlapP50 <= TARGET.overlapLockP50,
    banned: bannedCount === 0,
  };
  const viable = Boolean(verdict.ttfb && verdict.complete && verdict.overlap && verdict.banned);

  const out = {
    at: new Date().toISOString(),
    model: "mercury-2",
    targets: TARGET,
    summary,
    quality,
    overlaps: overlaps.map((o) => ({
      ttfbMs: Math.round(o.ttfbMs),
      totalMs: Math.round(o.totalMs),
      spoken: o.spoken,
      banned: o.banned,
    })),
    verdict,
    viable,
  };

  mkdirSync(resolve("bench"), { recursive: true });
  const path = resolve("bench/results.json");
  writeFileSync(path, JSON.stringify(out, null, 2));

  console.log("\n— summary —");
  console.table(summary);
  console.log(
    `\nviable: ${viable}\n  ttfb p50 ${primary?.ttfbP50}ms (≤${TARGET.ttfbP50}) ${verdict.ttfb ? "ok" : "NO"}\n  complete p50 ${primary?.totalP50}ms (≤${TARGET.totalP50}) ${verdict.complete ? "ok" : "NO"}\n  overlap lock p50 ${overlapP50}ms (≤${TARGET.overlapLockP50}) ${verdict.overlap ? "ok" : "NO"}\n  banned hits ${bannedCount}/${quality.length} ${verdict.banned ? "ok" : "NO"}`,
  );
  console.log(`wrote ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
