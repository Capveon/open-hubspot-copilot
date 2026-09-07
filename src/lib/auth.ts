import { auth, currentUser } from "@clerk/nextjs/server";
import { HttpError } from "./api";
import { db, migrate } from "./db";

export type UserRow = {
  id: string;
  email: string | null;
  name: string;
  created_at: number;
};

export async function requireUser(): Promise<UserRow> {
  await migrate();
  const { userId } = await auth();
  if (!userId) throw new HttpError("Unauthorized", 401);
  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  const name = clerkUser?.fullName || clerkUser?.firstName || email.split("@")[0] || "Rep";
  return upsertUser({ id: userId, email, name });
}

async function upsertUser(input: { id: string; email: string; name: string }): Promise<UserRow> {
  const existing = await db().execute({
    sql: "SELECT id, email, name, created_at FROM users WHERE id = ?",
    args: [input.id],
  });
  const row = existing.rows[0] as unknown as UserRow | undefined;
  if (row) {
    await db().execute({
      sql: "UPDATE users SET email = ?, name = ? WHERE id = ?",
      args: [input.email, input.name, input.id],
    });
    return { ...row, email: input.email, name: input.name };
  }
  const created_at = Date.now();
  await db().execute({
    sql: "INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)",
    args: [input.id, input.email, input.name, created_at],
  });
  return { id: input.id, email: input.email, name: input.name, created_at };
}
