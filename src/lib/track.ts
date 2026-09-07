import { appName, repName } from "./brand-config";
import type { CallCard } from "./card";
import type { CoachLine, GlassAction } from "./session-types";

/** Only two glass states: the templated opener, then Mercury. */
export type Beat = "open" | "live";

function bookLabel(book: CallCard["book"]): string {
  if (book === "ww") return "wastewater";
  if (book === "combo") return "utility";
  return book;
}

export function beatLabel(beat: Beat): string {
  return beat === "open" ? "Open" : "Say this";
}

/** The one line configured beforehand. Everything after this is Mercury. */
export function openerFromCard(card: CallCard): CoachLine {
  const book = bookLabel(card.book);
  return {
    action: "say",
    agree: "",
    say: [
      `${card.firstName}, it's ${repName()} from ${appName()}.`,
      `Cold call about ${book} ops at ${card.utility}, specifically how work history in ${card.stack} changes the ${card.jobNoun} list.`,
      `Can I take twenty seconds?`,
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
