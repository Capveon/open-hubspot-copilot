import { run, type Experiment } from "@open-strategies/core";
import { loadLocalEnv } from "../src/lib/env.ts";
import { GlassEnv, GlassFactory } from "./glass-env.ts";
import { CoachStrategy, unusedModel, type CoachArm } from "./glass-strategy.ts";
import { GLASS_TASKS } from "./glass-tasks.ts";

loadLocalEnv();

const ARMS: CoachArm[] = [
  { provider: "openai", model: "gpt-4.1", pack: "turn", structured: true },
];

export function glassExperiment(): Experiment<GlassEnv> {
  const arms = ARMS.filter((arm) => {
    if (arm.provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
    if (arm.provider === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY);
    if (arm.provider === "cerebras") return Boolean(process.env.CEREBRAS_API_KEY);
    return true;
  });
  return {
    name: "glass-text-sim",
    tasks: GLASS_TASKS,
    env: new GlassFactory(),
    epochs: 1,
    model: unusedModel(),
    arms: arms.map((arm) => ({ strategy: new CoachStrategy(arm) })),
    graders: [],
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i] ?? 0;
}

function latenciesOf(text: string): { ttfb: number; total: number }[] {
  const out: { ttfb: number; total: number }[] = [];
  const re = /\[(\d+)ms ttfb \/ (\d+)ms\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    out.push({ ttfb: Number(match[1]), total: Number(match[2]) });
  }
  return out;
}

async function main() {
  const exp = glassExperiment();
  if (exp.arms.length === 0) throw new Error("no coach arms — missing API keys");
  const log = await run(exp, {
    concurrency: { model: 1, judge: 1, sandbox: 1, cpu: 1 },
    cache: false,
  });

  const byArm = new Map<string, { ttfb: number[]; total: number[] }>();
  for (const trial of log.trials) {
    const arm = trial.strategyId;
    if (!byArm.has(arm)) byArm.set(arm, { ttfb: [], total: [] });
    const bucket = byArm.get(arm);
    if (!bucket) continue;
    console.log(`\n======== ${arm} / ${trial.taskId}`);
    if (trial.error) console.log(`error: ${trial.error}`);
    for (const ev of trial.transcript) {
      if (ev.type === "text") {
        console.log(ev.text);
        for (const lat of latenciesOf(ev.text)) {
          bucket.ttfb.push(lat.ttfb);
          bucket.total.push(lat.total);
        }
      }
    }
  }

  console.log(`\n======== latency  (accuracy first; this is speed)`);
  console.log(
    "arm".padEnd(56),
    "n".padStart(3),
    "ttfb p50".padStart(10),
    "ttfb p90".padStart(10),
    "tot p50".padStart(10),
    "tot p90".padStart(10),
  );
  for (const [arm, bucket] of byArm) {
    console.log(
      arm.padEnd(56),
      String(bucket.total.length).padStart(3),
      String(Math.round(percentile(bucket.ttfb, 50))).padStart(10),
      String(Math.round(percentile(bucket.ttfb, 90))).padStart(10),
      String(Math.round(percentile(bucket.total, 50))).padStart(10),
      String(Math.round(percentile(bucket.total, 90))).padStart(10),
    );
  }

  console.log(`\n${log.trials.length} trials, ${log.endedAt - log.startedAt}ms`);
  if (log.trials.some((t) => t.status !== "ok")) process.exitCode = 1;
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
