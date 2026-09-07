import { Environment, EnvironmentFactory, type Task } from "@open-strategies/core";
import { cardFromContact } from "../src/lib/card-from-contact.ts";
import type { CallCard } from "../src/lib/card.ts";
import type { HsContact } from "../src/lib/contact.ts";
import { formatTape, FREEZE_MS, SILENCE_MS, type GlassDesk } from "../src/lib/glass.ts";
import type { CoachLine, TranscriptLine } from "../src/lib/session-types.ts";
import { openerFromCard } from "../src/lib/track.ts";

export type GlassTaskInput = {
  firstName: string;
  lastName?: string;
  utility: string;
  title?: string;
  /** Scripted buyer lines, in order. The seller is always the live desk + Mercury. */
  buyer: string[];
  /**
   * After this buyer line, Finn has read the opener and clicked Delivered.
   * -1 = already delivered before they speak (voicemail).
   */
  deliveredAfter: number;
};

export type GlassTurnRecord = {
  them: string;
  glass: string;
  at: number;
};

const GAP_MS = 10_000;

export class GlassEnv extends Environment {
  readonly id = "glass";
  readonly card: CallCard;
  readonly buyer: string[];
  readonly deliveredAfter: number;
  glass: CoachLine;
  said: string[] = [];
  beat: "open" | "live" = "open";
  lines: TranscriptLine[] = [];
  history: GlassTurnRecord[] = [];
  now = 0;
  desk: GlassDesk;
  private seq = 0;

  constructor(card: CallCard, buyer: string[], deliveredAfter: number) {
    super();
    this.card = card;
    this.buyer = buyer;
    this.deliveredAfter = deliveredAfter;
    this.glass = openerFromCard(card);
    this.desk = {
      released: deliveredAfter < 0,
      frozen: false,
      voicemail: false,
      frozenUntil: 0,
      turnKey: "",
      pendingKey: "",
    };
    if (deliveredAfter < 0) this.finnReads(this.glass.say);
  }

  private push(role: "you" | "them", text: string, source: "stt" | "glass"): TranscriptLine {
    const line: TranscriptLine = {
      id: `sim-${++this.seq}`,
      role,
      text,
      source,
      at: this.now,
    };
    this.lines.push(line);
    return line;
  }

  hearBuyer(text: string): void {
    this.now += GAP_MS;
    this.push("them", text, "stt");
  }

  /** Finn finished the opener and clicked Delivered. Same as the live desk. */
  deliver(): void {
    this.now += 4_000;
    this.finnReads(this.glass.say);
    this.desk.released = true;
  }

  /** Finn reads what's on glass. Next Mercury call hears it on tape. */
  finnReads(text: string): void {
    const spoken = text.trim();
    if (!spoken) return;
    this.now += 2_000;
    this.push("you", spoken, "stt");
  }

  tickNow(): number {
    return this.now + SILENCE_MS + 50;
  }

  tapeString(): string {
    return formatTape(this.lines, [...this.said, this.glass.say]);
  }

  paint(line: CoachLine, them: string, key: string): void {
    const spoken = this.glass.say.trim();
    if (spoken) this.said.push(spoken);
    this.glass = line;
    if (line.say.trim()) this.said.push(line.say.trim());
    this.beat = "live";
    this.desk.turnKey = key;
    this.desk.pendingKey = "";
    this.desk.frozenUntil = this.tickNow() + FREEZE_MS;
    this.history.push({ them, glass: line.say, at: this.now });
    this.push("you", `${line.agree} ${line.say}`.trim(), "glass");
    this.finnReads(line.say);
  }

  hold(them: string): void {
    this.desk.pendingKey = "";
    this.history.push({ them, glass: "", at: this.now });
  }
}

export class GlassFactory extends EnvironmentFactory<GlassEnv> {
  readonly id = "glass-desk";

  async create(task: Task): Promise<GlassEnv> {
    const input = task.input as GlassTaskInput;
    const contact: HsContact = {
      id: `sim-${task.id}`,
      firstName: input.firstName,
      lastName: input.lastName ?? "",
      email: "",
      phone: "",
      title: input.title ?? "Water ops superintendent",
      company: input.utility,
    };
    return new GlassEnv(cardFromContact(contact), [...input.buyer], input.deliveredAfter);
  }
}
