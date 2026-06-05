import type { JuryEvent } from "@winnovation/domain";
import type { JuryDb } from "./db";

export interface CreateEventInput {
  name: string;
  date: string; // ISO
}

export interface IdGen {
  id: () => string;
  code: () => string;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

export function generateCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export const defaultGen: IdGen = {
  id: () => crypto.randomUUID(),
  code: () => generateCode(),
};

export async function createEvent(
  db: JuryDb,
  input: CreateEventInput,
  gen: IdGen = defaultGen,
): Promise<JuryEvent> {
  const event: JuryEvent = {
    id: gen.id(),
    name: input.name,
    date: input.date,
    eventCode: gen.code(),
  };
  await db.events.add(event);
  return event;
}

export async function findEventByCode(
  db: JuryDb,
  eventCode: string,
): Promise<JuryEvent | undefined> {
  return db.events.where("eventCode").equals(eventCode).first();
}
