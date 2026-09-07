import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { HsContact } from "./contact";

const TEST_TITLE = "Water ops superintendent";
const TEST_COMPANY = "Gainesville Regional Utilities";

export type TestQueue = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export const TEST_QUEUES: TestQueue[] = [
  {
    id: "test-finn",
    name: "GRU — Peter Simms (test)",
    firstName: "Peter",
    lastName: "Simms",
    email: (process.env.OHC_TEST_EMAIL ?? "").toLowerCase(),
    phone: (process.env.OHC_TEST_PHONE ?? "").replace(/\D/g, ""),
  },
  {
    id: "test-brison",
    name: "GRU — Brison Moorhead (test)",
    firstName: "Brison",
    lastName: "Moorhead",
    email: (process.env.OHC_BRISON_EMAIL ?? "").toLowerCase(),
    phone: (process.env.OHC_BRISON_PHONE ?? "").replace(/\D/g, ""),
  },
];

export const TEST_QUEUE_ID = TEST_QUEUES[0].id;
export const TEST_QUEUE_NAME = TEST_QUEUES[0].name;

export function testQueueById(queueId: string): TestQueue | undefined {
  return TEST_QUEUES.find((queue) => queue.id === queueId);
}

function personaForEmail(email: string): TestQueue | undefined {
  if (!email) return undefined;
  return TEST_QUEUES.find((queue) => queue.email && queue.email === email.toLowerCase());
}

export type { HsContact };
export { e164, formatUsPhone } from "./contact";

export type HsQueue = {
  id: string;
  name: string;
  source: "list" | "test";
  size: number | null;
};

function tokenFromHscli(): string | null {
  const path = join(homedir(), ".hscli/config.yml");
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const match = raw.match(/accessToken:\s*(?:>-\s*\n\s*)?([A-Za-z0-9_\-]+)/);
  return match?.[1]?.trim() ?? null;
}

export function hubspotToken(): string {
  const env = process.env.HUBSPOT_ACCESS_TOKEN?.trim();
  if (env) return env;
  const cli = tokenFromHscli();
  if (cli) return cli;
  throw new Error(
    "No HubSpot token. Set HUBSPOT_ACCESS_TOKEN (private app) or authenticate the HubSpot CLI.",
  );
}

async function hs<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: true; status: number; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${hubspotToken()}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  if (!res.ok) {
    return { ok: false, status: res.status, error: text.slice(0, 1200) };
  }
  return { ok: true, status: res.status, data };
}

function applyPersona(contact: HsContact, persona?: TestQueue): HsContact {
  const who = persona ?? personaForEmail(contact.email);
  if (!who) return contact;
  return {
    ...contact,
    firstName: who.firstName,
    lastName: who.lastName,
    email: who.email,
    phone: who.phone || contact.phone,
    title: TEST_TITLE,
    company: TEST_COMPANY,
  };
}

function mapContact(raw: {
  id: string;
  properties?: Record<string, string | null | undefined>;
}): HsContact {
  const p = raw.properties ?? {};
  const email = (p.email ?? "").trim();
  const persona = personaForEmail(email);
  let phone = String(p.phone || p.mobilephone || "").replace(/\D/g, "");
  if (!phone && persona) phone = persona.phone;
  return applyPersona({
    id: raw.id,
    firstName: p.firstname?.trim() || "there",
    lastName: p.lastname?.trim() || "",
    email,
    phone,
    title: p.jobtitle?.trim() || "",
    company: p.company?.trim() || "",
  });
}

function syntheticContact(persona: TestQueue): HsContact {
  return applyPersona(
    {
      id: `local-${persona.id}`,
      firstName: persona.firstName,
      lastName: persona.lastName,
      email: persona.email,
      phone: persona.phone,
      title: TEST_TITLE,
      company: TEST_COMPANY,
    },
    persona,
  );
}

export async function listQueues(): Promise<{
  queues: HsQueue[];
  listsError: string | null;
}> {
  const lists = await hs<{ lists?: Array<{ listId: string; name: string }> }>(
    "POST",
    "/crm/v3/lists/search",
    { query: "", objectTypeId: "0-1", count: 50 },
  );
  const queues: HsQueue[] = [];
  let listsError: string | null = null;
  if (lists.ok) {
    for (const item of lists.data.lists ?? []) {
      queues.push({
        id: `list:${item.listId}`,
        name: item.name,
        source: "list",
        size: null,
      });
    }
  } else {
    listsError =
      lists.status === 403
        ? "This HubSpot token cannot read lists. Using the GRU test queues. Create a private app with crm.lists.read to dial saved lists."
        : lists.error;
  }
  for (const queue of [...TEST_QUEUES].reverse()) {
    queues.unshift({
      id: queue.id,
      name: queue.name,
      source: "test",
      size: 1,
    });
  }
  return { queues, listsError };
}

export function queueName(queueId: string, queues: HsQueue[]): string {
  return queues.find((q) => q.id === queueId)?.name ?? queueId;
}

export async function queueContacts(queueId: string): Promise<HsContact[]> {
  const persona = testQueueById(queueId);
  if (persona) {
    const found = await hs<{
      results?: Array<{ id: string; properties?: Record<string, string | null> }>;
    }>("POST", "/crm/v3/objects/contacts/search", {
      filterGroups: [
        {
          filters: [{ propertyName: "email", operator: "EQ", value: persona.email }],
        },
      ],
      properties: [
        "firstname",
        "lastname",
        "email",
        "phone",
        "mobilephone",
        "jobtitle",
        "company",
      ],
      limit: 5,
    });
    if (!found.ok) return [syntheticContact(persona)];
    const mapped = (found.data.results ?? []).map(mapContact);
    return mapped.length ? mapped : [syntheticContact(persona)];
  }
  if (!queueId.startsWith("list:")) throw new Error("Unknown queue");
  const listId = queueId.slice(5);
  const members = await hs<{ results?: Array<{ recordId?: string; id?: string }> }>(
    "GET",
    `/crm/v3/lists/${listId}/memberships?limit=100`,
  );
  if (!members.ok) throw new Error(members.error);
  const ids = (members.data.results ?? [])
    .map((row) => row.recordId || row.id)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];
  const batch = await hs<{
    results?: Array<{ id: string; properties?: Record<string, string | null> }>;
  }>("POST", "/crm/v3/objects/contacts/batch/read", {
    properties: [
      "firstname",
      "lastname",
      "email",
      "phone",
      "mobilephone",
      "jobtitle",
      "company",
    ],
    inputs: ids.map((id) => ({ id })),
  });
  if (!batch.ok) throw new Error(batch.error);
  return (batch.data.results ?? []).map(mapContact);
}
