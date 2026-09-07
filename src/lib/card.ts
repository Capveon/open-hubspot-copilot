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

/** Vendor they named. Empty if we only know "they run a CMMS." */
export function namedStack(stack: string | undefined): string {
  const s = (stack ?? "").trim();
  if (!s) return "";
  if (/^(cmms|gis|eam|erp|scada|work orders?|work system|unknown|n\/?a|-)$/i.test(s)) {
    return "";
  }
  return s;
}

export function inferBook(title: string): CallCard["book"] {
  const t = title.toLowerCase();
  const ww = /\b(wastewater|sewer|collections|drainage|wwtp|lift station)\b/.test(t);
  const power = /\b(electric|t&d|t and d|power delivery|substation|feeder|transmission)\b/.test(t);
  const water = /\bwater\b/.test(t) && !ww;
  if (ww && power) return "combo";
  if (water && power) return "combo";
  if (ww) return "ww";
  if (power) return "electric";
  if (water) return "water";
  if (/\b(public utilities|utility ops|director of operations|agm)\b/.test(t)) return "combo";
  return "water";
}

export function nounsForBook(book: CallCard["book"]): Pick<
  CallCard,
  "jobNoun" | "failNoun" | "listNoun" | "unit"
> {
  if (book === "ww") {
    return { jobNoun: "rehab", failNoun: "backups", listNoun: "CIP", unit: "basin" };
  }
  if (book === "electric") {
    return {
      jobNoun: "rebuilds",
      failNoun: "outages",
      listNoun: "rebuild list",
      unit: "feeder",
    };
  }
  if (book === "combo") {
    return { jobNoun: "capital work", failNoun: "failures", listNoun: "CIP", unit: "" };
  }
  return {
    jobNoun: "replacements",
    failNoun: "breaks",
    listNoun: "CIP",
    unit: "zone",
  };
}

/** Practice / Mercury bench only. Live cards come from the contact. */
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
  const stack = namedStack(card.stack);
  return [name, card.title, card.utility, stack ? `runs ${stack}` : ""]
    .filter(Boolean)
    .join("\n");
}
