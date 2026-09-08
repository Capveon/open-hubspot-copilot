import { appName, repName } from "./brand-config";
import type { CallCard } from "./card";
import type { CoachLine, GlassAction } from "./session-types";

/** Only two glass states: the templated opener, then the coach. */
export type Beat = "open" | "live";

export function bookLabel(book: CallCard["book"]): string {
  if (book === "ww") return "wastewater";
  if (book === "combo") return "utility";
  return book;
}

export function beatLabel(beat: Beat): string {
  return beat === "open" ? "Open" : "Say this";
}

function capitalList(card: CallCard): string {
  const n = (card.listNoun || "CIP").trim();
  if (!n) return "the CIP";
  if (/^the\s/i.test(n)) return n;
  return `the ${n}`;
}

/**
 * Spoken cold open. Read word for word. Ask how the list works — do not pitch.
 */
export function openerFromCard(card: CallCard): CoachLine {
  const who = card.firstName.trim();
  const list = capitalList(card);
  const where = card.utility.trim() ? ` at ${card.utility.trim()}` : " on your side";
  const hello = who ? `Hey ${who}` : "Hey";
  return {
    action: "say",
    agree: "",
    say: [
      `${hello}, this is ${repName()} with ${appName()}.`,
      `I was calling because I was hoping you could give me the thousand-foot summary of how ${list} works${where} — how a job actually gets on that list.`,
    ].join("\n\n"),
    move: "answer",
  };
}

export const VOICEMAIL_LINE: CoachLine = {
  action: "leave",
  agree: "",
  say: "Voicemail. Hang up. Don't leave a pitch.",
  move: "leave",
};

export type Applied =
  | { type: "hold" }
  | { type: "say"; line: CoachLine }
  | { type: "leave"; line: CoachLine };

export function applyDecision(decision: CoachLine): Applied {
  const action: GlassAction = decision.action ?? (decision.say.trim() ? "say" : "hold");
  if (action === "hold") return { type: "hold" };
  if (action === "leave") {
    return { type: "leave", line: VOICEMAIL_LINE };
  }
  if (decision.say.trim()) return { type: "say", line: { ...decision, action: "say" } };
  return { type: "hold" };
}
