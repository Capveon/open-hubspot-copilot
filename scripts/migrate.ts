import { loadLocalEnv } from "../src/lib/env";
import { closeDb, migrate } from "../src/lib/db";

loadLocalEnv();
await migrate();
await closeDb();
console.log("ohc schema ready");
