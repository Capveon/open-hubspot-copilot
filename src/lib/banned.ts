import { BANNED_PHRASES, BANNED_WORDS } from "./constitution";

export function findBanned(text: string): string[] {
  const lower = text.toLowerCase();
  const hits = new Set<string>();
  if (/[—–]/.test(text)) hits.add("em dash");
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) hits.add(phrase);
  }
  const words = lower.split(/[^a-z0-9]+/).filter(Boolean);
  for (const word of BANNED_WORDS) {
    if (words.includes(word)) hits.add(word);
  }
  return [...hits];
}
