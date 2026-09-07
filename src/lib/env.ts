import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Load a dotenv file. Does not overwrite keys already in the environment. */
export function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

/** Load .env.local for CLI scripts. Next.js already does this for the app. */
export function loadLocalEnv(cwd = process.cwd()): void {
  loadEnvFile(resolve(cwd, ".env.local"));
}
