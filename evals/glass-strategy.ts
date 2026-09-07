import { FnModel, Strategy, type TrialContext } from "@open-strategies/core";
import { resolveCoachLine, type CoachProvider } from "../src/lib/coach.ts";
import type { PromptPack } from "../src/lib/constitution.ts";
import { nextDeskTick, similarSpeech } from "../src/lib/glass.ts";
import { GlassEnv } from "./glass-env.ts";

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(Math.floor(total % 60)).padStart(2, "0");
  return `${mm}:${ss}`;
}

function latencyTag(ttfbMs: number, totalMs: number): string {
  if (totalMs < 0) return "";
  return `  [${Math.round(ttfbMs)}ms ttfb / ${Math.round(totalMs)}ms]`;
}

export type CoachArm = {
  provider: CoachProvider;
  model?: string;
  effort?: string;
  pack: PromptPack;
  structured: boolean;
};

function armId(arm: CoachArm): string {
  const model =
    arm.provider === "openai" || arm.provider === "openrouter" || arm.provider === "cerebras"
      ? (arm.model ?? "model")
      : `mercury-2/${arm.effort ?? "low"}`;
  const effort = arm.effort ?? "-";
  const schema = arm.structured ? "json" : "plain";
  return `${arm.provider}/${model}/${effort}/${arm.pack}/${schema}`;
}

/** Live seller: opener, Delivered, nextDeskTick, model. Buyer lines are the script. */
export class CoachStrategy extends Strategy<GlassEnv> {
  readonly id: string;
  readonly arm: CoachArm;

  constructor(arm: CoachArm) {
    super();
    this.arm = arm;
    this.id = armId(arm);
  }

  override describe(): Record<string, unknown> {
    return { id: this.id, path: "live-desk", ...this.arm };
  }

  override async execute(ctx: TrialContext<GlassEnv>): Promise<void> {
    const env = ctx.env;
    ctx.transcript.record({
      type: "text",
      text: `${mmss(0)}  GLASS  ${env.glass.say.replaceAll("\n", " / ")}`,
    });

    for (let i = 0; i < env.buyer.length; i++) {
      const them = env.buyer[i];
      env.hearBuyer(them);

      const next = nextDeskTick(env.lines, env.tickNow(), env.desk);
      const t = mmss(env.now);
      if (next.action !== "suggest") {
        ctx.transcript.record({
          type: "text",
          text: `${t}  THEM   ${them}\n${t}  GLASS  (no tick — ${env.desk.released ? "idle" : "opener, not delivered"})`,
        });
      } else {
        env.desk.pendingKey = next.key;
        const decided = await resolveCoachLine({
          card: env.card,
          them: next.them,
          tape: env.tapeString(),
          onGlass: env.glass.say,
          already: env.said,
          beat: env.beat,
          reasoningEffort: this.arm.effort,
          provider: this.arm.provider,
          model: this.arm.model,
          structured: this.arm.structured,
          pack: this.arm.pack,
          signal: ctx.signal,
        });
        const lat = latencyTag(decided.timing.ttfbMs, decided.timing.totalMs);

        if (decided.kind === "leave") {
          env.desk.voicemail = true;
          env.paint(decided.line, next.them, next.key);
          ctx.transcript.record({
            type: "text",
            text: `${t}  THEM   ${them}\n${t}  GLASS  ${decided.line.say} [leave]${lat}`,
          });
        } else if (decided.kind === "none") {
          env.hold(next.them);
          ctx.transcript.record({
            type: "text",
            text: `${t}  THEM   ${them}\n${t}  GLASS  (held)${lat}`,
          });
        } else if (similarSpeech(decided.line.say, env.glass.say)) {
          env.desk.turnKey = next.key;
          env.desk.pendingKey = "";
          ctx.transcript.record({
            type: "text",
            text: `${t}  THEM   ${them}\n${t}  GLASS  (same)${lat}`,
          });
        } else {
          env.paint(decided.line, next.them, next.key);
          ctx.transcript.record({
            type: "text",
            text: `${t}  THEM   ${them}\n${t}  GLASS  ${`${decided.line.agree} ${decided.line.say}`.trim()}${lat}`,
          });
        }
      }

      if (i === env.deliveredAfter) env.deliver();
    }
  }
}

export function unusedModel(): FnModel {
  return new FnModel("unused", async () => ({ text: "" }));
}
