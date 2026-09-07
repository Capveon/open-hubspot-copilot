export type CallCard = {
  firstName: string;
  lastName?: string;
  utility: string;
  title: string;
  book: "water" | "ww" | "electric" | "combo";
  context: string;
  stack: string;
  hypothesis: string;
  jobNoun: string;
  failNoun: string;
  listNoun: string;
  unit: string;
  question: string;
  show: string;
};

export const TUCSON_CARD: CallCard = {
  firstName: "Caleb",
  utility: "Tucson Water",
  title: "Water ops superintendent",
  book: "water",
  context: "Cityworks + a CIP that still smells like decade laid",
  stack: "Cityworks",
  hypothesis:
    "CIP still by year the pipe went in; crews already know the breakers",
  jobNoun: "pipe replacement",
  failNoun: "main breaks",
  listNoun: "CIP",
  unit: "pressure zone",
  question:
    "When a main breaks three times in a year, how does that actually get onto next year's CIP?",
  show: "one zone, breaks next to the current replacement list",
};

export function formatCard(card: CallCard): string {
  const name = [card.firstName, card.lastName].filter(Boolean).join(" ");
  return [name, card.title, card.utility].filter(Boolean).join("\n");
}
