export type CoachProvider = "mercury" | "openai" | "openrouter" | "cerebras";

export function coachProvider(): CoachProvider {
  const raw = process.env.COACH_PROVIDER?.trim();
  if (raw === "mercury" || raw === "openrouter" || raw === "cerebras") return raw;
  return "openai";
}

export function coachModel(): string {
  if (process.env.COACH_MODEL?.trim()) return process.env.COACH_MODEL.trim();
  const provider = coachProvider();
  if (provider === "mercury") return "mercury-2";
  if (provider === "cerebras" || provider === "openrouter") return "gpt-oss-120b";
  return "gpt-4.1";
}
