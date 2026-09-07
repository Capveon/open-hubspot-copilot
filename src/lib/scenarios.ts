import type { CallCard } from "./card";
import { TUCSON_CARD } from "./card";

export type Scenario = {
  id: string;
  title: string;
  kind: "in-band" | "ood";
  card: CallCard;
  /** Seller lines already spoken. */
  prior: string[];
  /** Their side, grown word-by-word in the playground / overlap bench. */
  them: string;
  note: string;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "cityworks",
    title: "We already have Cityworks",
    kind: "in-band",
    card: TUCSON_CARD,
    prior: [
      "Caleb — Finn, Capveon. We work with water ops on how they rank pipe replacement. Gonna be honest, this is a cold call. You weren't expecting me, and you probably get pitched software that wants to replace Cityworks. Can I get twenty seconds on why I called you at Tucson, then you tell me if it is even relevant?",
    ],
    them: "We already have Cityworks and GIS. Why would I look at anything else.",
    note: "Permutation 03. Ask where Cityworks stops helping them RANK. Do not integrate-pitch.",
  },
  {
    id: "email",
    title: "Send me an email",
    kind: "in-band",
    card: TUCSON_CARD,
    prior: [
      "My guess is the CIP is still mostly by year the pipe went in, and the field already knows which ones are actually breaking. We rank the next replacements off condition and work history, not install year. That's it. Open to taking a look so you at least know what that would mean on your CIP — or is that a waste?",
    ],
    them: "Yeah just send me an email.",
    note: "Ranking vs breaks. Zone on the reply. No deck.",
  },
  {
    id: "ai",
    title: "Is this AI",
    kind: "in-band",
    card: TUCSON_CARD,
    prior: [
      "We rank the next replacements off condition and work history, not install year. That's it.",
    ],
    them: "Is this AI? I don't need another chatbot on the water system.",
    note: "Banned-word trap. Kill the category. Do not say AI, chatbot, agents, platform.",
  },
  {
    id: "cost",
    title: "What does it cost",
    kind: "in-band",
    card: TUCSON_CARD,
    prior: [
      "I'm not trying to replace Cityworks. If you pick one pressure zone, I'll show breaks next to the current replacement list. Twenty minutes. If it's not useful I stop.",
    ],
    them: "What does something like this even cost.",
    note: "No quote. Twenty minutes is whether ranking is even a problem.",
  },
  {
    id: "emails-somebody",
    title: "Somebody emails somebody",
    kind: "in-band",
    card: TUCSON_CARD,
    prior: [
      "When a main breaks three times in a year, how does that actually get onto next year's CIP?",
    ],
    them: "Somebody emails somebody. Or it doesn't.",
    note: "Mirror, then one label. Work order vs list upstairs.",
  },
  {
    id: "lead-grant",
    title: "Lead service line grant",
    kind: "ood",
    card: TUCSON_CARD,
    prior: [
      "Caleb — Finn, Capveon. Cold call about how Tucson ranks pipe replacement. Twenty seconds?",
    ],
    them: "Is this related to the lead service line inventory grant we just got.",
    note: "OOD. Not the inventory. Ranking replacements they already know are dying.",
  },
  {
    id: "consent-pacp",
    title: "Consent order + ITpipes",
    kind: "ood",
    card: TUCSON_CARD,
    prior: [
      "My guess is the CIP is still by year the pipe went in. Even if that's wrong you'll tell me.",
    ],
    them: "Consent order ate the CIP and now engineering wants PACP from ITpipes on the same line as the bond. That's not install year, that's a mess.",
    note: "OOD blend. Label the bind. How does that ranking get into the packet. Stay off the product.",
  },
  {
    id: "phoenix",
    title: "Did you do Phoenix",
    kind: "ood",
    card: TUCSON_CARD,
    prior: [
      "Caleb — Finn, Capveon. We work with water ops on how they rank pipe replacement.",
    ],
    them: "Are you the outfit that did something with Phoenix on their mains.",
    note: "Do not fake a peer. Constitution: not that I should name.",
  },
  {
    id: "hexagon-carollo",
    title: "Hexagon + Carollo file",
    kind: "ood",
    card: {
      ...TUCSON_CARD,
      stack: "Hexagon",
      context: "Hexagon EAM plus a Carollo remaining-life PDF",
    },
    prior: [
      "You probably get pitched software that wants to replace Hexagon. Not why I called.",
    ],
    them: "Can it sit on Hexagon and still use the Carollo remaining-life file we paid for last spring.",
    note: "Sit on what they have. Twenty minutes is whether ranking is the problem. One zone.",
  },
];

export function lastWords(text: string, n = 3): string {
  const words = text
    .replace(/[—–]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9'’.-]/g, ""))
    .filter(Boolean);
  return words.slice(-n).join(" ");
}
