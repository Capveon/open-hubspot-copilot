import type { CallCard } from "./card";
import { formatCard } from "./card";
import { PACKS, type PromptPack } from "./constitution";
import type { CoachLine, GlassAction } from "./session-types";

export const LINE_SCHEMA = {
  name: "NextLine",
  strict: true as const,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      action: {
        type: "string",
        enum: ["hold", "say", "leave"],
        description:
          "hold = greeting or they have not finished. say = spoken reply to THEM. leave = voicemail, mailbox, please leave a message, or they are gone.",
      },
      agree: {
        type: "string",
        description: "0–5 words while he takes a breath, or empty.",
      },
      say: {
        type: "string",
        description:
          "If say: 1 or 2 short spoken sentences for THIS turn. If hold or leave: empty string.",
      },
      move: {
        type: "string",
        enum: ["label", "question", "answer", "test_drive", "leave", "mirror"],
        description:
          "Usually answer. question only if you still need a fact they did not already give.",
      },
    },
    required: ["action", "agree", "say", "move"],
  },
};

export type LineMove =
  | "label"
  | "question"
  | "answer"
  | "test_drive"
  | "leave"
  | "mirror";

export type NextLine = {
  action: GlassAction;
  agree: string;
  say: string;
  move: LineMove;
};

function asAction(raw: unknown, say: string): GlassAction {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "hold" || v === "say" || v === "leave") return v;
  if (v === "next") return say ? "say" : "hold";
  return say ? "say" : "hold";
}

export function buildMessages(input: {
  card: CallCard;
  prior: string[];
  themPartial: string;
  themSettled?: boolean;
  beat?: string;
  onGlass?: string;
  tape?: string;
  already?: string[];
  nudge?: string;
  pack?: PromptPack;
}): Array<{ role: "system" | "user"; content: string }> {
  const tape = input.tape?.trim() || "(nothing on tape yet)";
  const them = input.themPartial.trim() || "(they have not spoken this turn)";
  const job =
    input.nudge?.trim() ||
    "Write the next spoken line. Reply to what they just said. Sound like a person.";

  return [
    { role: "system", content: PACKS[input.pack ?? "turn"] },
    {
      role: "user",
      content: [
        "WHO",
        formatCard(input.card),
        "",
        "TAPE",
        tape,
        "",
        "THEY JUST SAID",
        them,
        "",
        job,
        'Return JSON {"action","agree","say","move"}. hold or leave → say is "".',
      ]
        .filter((block) => block !== "")
        .join("\n"),
    },
  ];
}

export function parseLine(text: string): CoachLine {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
        action?: unknown;
        agree?: unknown;
        say?: unknown;
        move?: unknown;
      };
      const say = String(parsed.say ?? "").trim();
      const action = asAction(parsed.action, say);
      if (action === "hold" || action === "leave" || say) {
        return {
          action,
          agree: String(parsed.agree ?? "").trim(),
          say,
          move: String(parsed.move ?? "").trim() || (action === "leave" ? "leave" : "answer"),
        };
      }
    } catch {
      /* raw text */
    }
  }
  const say = trimmed.replace(/^["']|["']$/g, "");
  return { action: say ? "say" : "hold", agree: "", say, move: "answer" };
}
