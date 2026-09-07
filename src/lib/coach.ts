import type { CallCard } from "./card";
import { coachModel, coachProvider, type CoachProvider } from "./coach-config";
import type { PromptPack } from "./constitution";
import { mercuryChat, type ReasoningEffort } from "./mercury";
import { openaiChat, type StreamHandlers } from "./openai";
import type { CoachLine } from "./session-types";
import { buildMessages, LINE_SCHEMA, parseLine } from "./suggest";
import { applyDecision, VOICEMAIL_LINE, type Beat } from "./track";

export type { CoachProvider };

export type CoachRead = (nudge?: string) => Promise<CoachLine | null>;

export type CoachRequest = {
  card: CallCard;
  them: string;
  tape: string;
  onGlass: string;
  already: string[];
  beat: Beat;
  signal?: AbortSignal;
  reasoningEffort?: string;
  provider?: CoachProvider;
  model?: string;
  structured?: boolean;
  pack?: PromptPack;
};

export type CoachTiming = {
  ttfbMs: number;
  totalMs: number;
  calls: number;
};

export type CoachCompleteRequest = {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  provider?: CoachProvider;
  model?: string;
  reasoningEffort?: string;
  structured?: boolean;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

export async function runCoachModel(
  req: CoachCompleteRequest,
  handlers?: StreamHandlers,
): Promise<{ text: string; ttfbMs: number; totalMs: number; usage: { promptTokens: number; completionTokens: number; cachedTokens: number; reasoningTokens: number } }> {
  const provider = req.provider ?? coachProvider();
  const model = req.model ?? coachModel();
  const structured = req.structured !== false;
  const jsonSchema = structured ? LINE_SCHEMA : undefined;
  const thinking = Boolean(req.reasoningEffort && req.reasoningEffort !== "none");
  const maxTokens = req.maxTokens ?? (thinking ? 800 : 220);
  const mercuryEffort = ((): ReasoningEffort => {
    if (
      req.reasoningEffort === "instant" ||
      req.reasoningEffort === "low" ||
      req.reasoningEffort === "medium" ||
      req.reasoningEffort === "high"
    ) {
      return req.reasoningEffort;
    }
    return "low";
  })();

  if (provider === "openai" || provider === "openrouter" || provider === "cerebras") {
    return openaiChat(
      {
        model,
        messages: req.messages,
        maxTokens,
        temperature: req.temperature ?? 0.3,
        reasoningEffort: req.reasoningEffort,
        jsonSchema,
        stream: req.stream ?? false,
        signal: req.signal,
        ...(provider === "cerebras"
          ? {
              baseUrl: "https://api.cerebras.ai/v1",
              apiKey: process.env.CEREBRAS_API_KEY,
            }
          : provider === "openrouter"
            ? {
                baseUrl: "https://openrouter.ai/api/v1",
                apiKey: process.env.OPENROUTER_API_KEY,
                extraHeaders: {
                  "HTTP-Referer": "http://localhost:3210",
                  "X-Title": "open-hubspot-copilot",
                },
                extraBody: {
                  provider: {
                    order: ["Cerebras", "Groq"],
                    allow_fallbacks: false,
                  },
                },
              }
            : {}),
      },
      handlers,
    );
  }

  return mercuryChat(
    {
      messages: req.messages,
      maxTokens: req.maxTokens ?? 220,
      temperature: req.temperature ?? 0.3,
      reasoningEffort: mercuryEffort,
      realtime: true,
      stream: req.stream ?? false,
      jsonSchema,
      signal: req.signal,
    },
    handlers,
  );
}

export async function readCoachLine(
  req: CoachRequest,
  nudge?: string,
): Promise<{ line: CoachLine | null; ttfbMs: number; totalMs: number }> {
  const result = await runCoachModel({
    messages: buildMessages({
      card: req.card,
      prior: [],
      themPartial: req.them,
      themSettled: true,
      beat: req.beat,
      onGlass: req.onGlass,
      tape: req.tape,
      already: req.already,
      nudge,
      pack: req.pack,
    }),
    provider: req.provider,
    model: req.model,
    reasoningEffort: req.reasoningEffort,
    structured: req.structured,
    stream: false,
    signal: req.signal,
  });
  return {
    line: parseLine(result.text),
    ttfbMs: result.ttfbMs,
    totalMs: result.totalMs,
  };
}

export const readMercuryLine = readCoachLine;

export type CoachResult =
  | { kind: "say"; line: CoachLine; timing: CoachTiming }
  | { kind: "leave"; line: CoachLine; timing: CoachTiming }
  | { kind: "none"; timing: CoachTiming };

function decide(line: CoachLine | null): { kind: "say" | "leave" | "none"; line?: CoachLine } {
  if (!line) return { kind: "none" };
  const applied = applyDecision(line);
  if (applied.type === "leave") {
    return {
      kind: "leave",
      line: applied.line.say.trim() ? applied.line : VOICEMAIL_LINE,
    };
  }
  if (applied.type === "say" && applied.line.say.trim()) {
    return { kind: "say", line: applied.line };
  }
  return { kind: "none" };
}

/** Desk already decided they finished. The model writes the line. No regex, no templates. */
export async function resolveCoachLine(
  req: CoachRequest,
  readLine?: CoachRead,
): Promise<CoachResult> {
  const pull = async (nudge?: string) => {
    if (readLine) {
      return { line: await readLine(nudge), ttfbMs: -1, totalMs: -1 };
    }
    return readCoachLine(req, nudge);
  };

  const first = await pull();
  let picked = decide(first.line);
  let ttfbMs = first.ttfbMs;
  let totalMs = Math.max(0, first.totalMs);
  let calls = 1;

  if (picked.kind === "none") {
    const retry = await pull(
      "They finished this turn. action must be say. Write the next spoken reply to THIS TURN.",
    );
    picked = decide(retry.line);
    ttfbMs = retry.ttfbMs >= 0 ? retry.ttfbMs : ttfbMs;
    totalMs += Math.max(0, retry.totalMs);
    calls += 1;
  }

  const timing: CoachTiming = { ttfbMs, totalMs, calls };
  if (picked.kind === "say" && picked.line) return { kind: "say", line: picked.line, timing };
  if (picked.kind === "leave" && picked.line) return { kind: "leave", line: picked.line, timing };
  return { kind: "none", timing };
}
