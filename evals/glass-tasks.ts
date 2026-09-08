import type { Task } from "@open-strategies/core";
import type { GlassTaskInput } from "./glass-env.ts";

const PETER = {
  firstName: "Peter",
  lastName: "Simms",
  utility: "Gainesville Regional Utilities",
  title: "Water ops superintendent",
};

function path(id: string, buyer: string[], deliveredAfter = 0): Task {
  const input: GlassTaskInput = { ...PETER, buyer, deliveredAfter };
  return { id, input };
}

/** Buyer script from docs/buyer-peter-simms.md. Seller is always the live desk. */
export const GLASS_TASKS: Task[] = [
  path("path-a", [
    "This is Peter, who's this?",
    "Yeah. Yearly CIP, engineers go through it every spring. I don't sit in that meeting.",
    "Yeah, can you tell me a little bit more? They sort it, we just send them what broke.",
    "Yeah. I might not be the right person for this. That's really an engineering thing on our side.",
    "You'd want Maria in engineering. She runs that list.",
  ]),
  path("path-b", [
    "This is Peter, who's this?",
    "That's an engineering thing. What is it you guys actually do?",
    "Okay. Our engineers already do a lot of that.",
  ]),
  path("path-c", [
    "This is Peter, who's this?",
    "We already have Cityworks. And GIS. That's the work.",
    "Yeah, Cityworks is the work orders. The CIP is still a spreadsheet planning rebuilds every spring.",
  ]),
  path("path-d", [
    "This is Peter, who's this?",
    "I don't really have time.",
    "Make it fast.",
    "Send me an email. I gotta jump.",
  ]),
  path("path-e", [
    "This is Peter, who's this?",
    "Sure, go ahead.",
    "Yeah, that actually is a headache for us.",
    "Thursday afternoon's okay. East side of town.",
  ]),
  path("path-mark", [
    "This is Peter, who's there?",
    "Yeah, Finn absolutely. That sounds interesting. Can you tell me a bit more?",
    "Yeah, at our CIP meeting the engineers do this. Can you automate that?",
    "Yeah, it's my colleague. Mark been off. Email should be Mark at salesforce.com.",
  ]),
  path(
    "voicemail",
    ["Hi, you've reached Peter Simms with Gainesville Regional Utilities. Please leave a message."],
    -1,
  ),
];
