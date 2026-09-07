#!/usr/bin/env node
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const example = join(root, ".env.example");
const dest = join(root, ".env.local");
if (!existsSync(dest)) {
  copyFileSync(example, dest);
  console.log("wrote .env.local from .env.example");
} else {
  console.log(".env.local already exists");
}
console.log("next: fill Clerk, OpenAI, and Postgres in .env.local");
console.log("      then: pnpm db:migrate");
console.log("            pnpm dev          # http://localhost:3210");
