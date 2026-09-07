import type { CallCard } from "./card";
import type { HsContact } from "./contact";
import { TUCSON_CARD } from "./card";

export function cardFromContact(contact: HsContact): CallCard {
  return {
    ...TUCSON_CARD,
    firstName: contact.firstName,
    lastName: contact.lastName,
    utility: contact.company || TUCSON_CARD.utility,
    title: contact.title || TUCSON_CARD.title,
  };
}
