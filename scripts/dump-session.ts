import { loadLocalEnv } from "../src/lib/env.ts";
import { closeDb, db } from "../src/lib/db.ts";

loadLocalEnv();

const id = process.argv[2];
if (!id) {
  console.error("usage: dump-session <sessionId>");
  process.exit(1);
}

const session = await db().execute({
  sql: "SELECT id, queue_id, queue_name, idx, status, created_at FROM sessions WHERE id = ?",
  args: [id],
});
console.log("session", JSON.stringify(session.rows, null, 2));

const calls = await db().execute({
  sql: "SELECT id, status, started_at, ended_at, contact_json FROM calls WHERE session_id = ? ORDER BY started_at ASC",
  args: [id],
});

for (const call of calls.rows) {
  const contact = JSON.parse(String(call.contact_json || "{}")) as {
    firstName?: string;
    lastName?: string;
  };
  const started = Number(call.started_at);
  const ended = call.ended_at == null ? null : Number(call.ended_at);
  console.log("\n==== call", {
    id: call.id,
    status: call.status,
    started_at: started,
    ended_at: ended,
    dur_s: ended ? ((ended - started) / 1000).toFixed(1) : "open",
    who: `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim(),
  });
  const lines = await db().execute({
    sql: "SELECT role, text, source, at FROM transcript_lines WHERE call_id = ? ORDER BY at ASC",
    args: [call.id],
  });
  const t0 = started || Number(lines.rows[0]?.at) || 0;
  for (const line of lines.rows) {
    const at = Number(line.at);
    console.log(
      `${String(((at - t0) / 1000).toFixed(1)).padStart(7)}  ${String(line.role).padEnd(4)}  ${String(line.source).padEnd(12)}  ${line.text}`,
    );
  }
  console.log(`  (${lines.rows.length} lines)`);
}

await closeDb();
