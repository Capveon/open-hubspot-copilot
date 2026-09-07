import type { CallCard } from "./card";
import { inferBook, nounsForBook } from "./card";
import type { HsContact } from "./contact";

export function cardFromContact(contact: HsContact): CallCard {
  const book = inferBook(contact.title);
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    utility: contact.company,
    title: contact.title,
    book,
    context: "",
    stack: "",
    hypothesis: "",
    ...nounsForBook(book),
    question: "",
    show: "",
  };
}
