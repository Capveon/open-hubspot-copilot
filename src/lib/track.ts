import { appName, repName } from "./brand-config";
import { namedStack, type CallCard } from "./card";
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

function bookOps(card: CallCard): string {
  const book = bookLabel(card.book);
  return card.utility ? `${book} ops at ${card.utility}` : `${book} ops`;
}

/**
 * Spoken cold open. Read word for word. Vendor name only if the card has one.
 */
export function openerFromCard(card: CallCard): CoachLine {
  const who = card.firstName.trim() || "Hey";
  const stack = namedStack(card.stack);
  const systems = stack
    ? `${stack} and GIS`
    : "the work system and GIS you already run";
  return {
    action: "say",
    agree: "",
    say: [
      `${who}, it's ${repName()} from ${appName()}.`,
      `I'm calling because you run ${bookOps(card)}. We connect what's happening in the field to ${systems}, so the next job gets ranked by condition, not just install year.`,
      `Can I take twenty seconds? Then you can dump me.`,
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
