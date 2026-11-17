import type { CollectionInspection } from "../../mod_api.d.ts";

function addDefinition(list: HTMLElement, term: string, text: string): void {
  const termElement = document.createElement("dt");
  termElement.textContent = term;
  const descriptionElement = document.createElement("dd");
  descriptionElement.textContent = text;
  list.append(termElement, descriptionElement);
}

/** The collection as a card: an `<article>` with its name, its description and its source. */
export function buildCollectionCard(
  inspection: CollectionInspection,
): HTMLElement {
  const card = document.createElement("article");
  const heading = document.createElement("h1");
  heading.textContent = inspection.title;
  card.append(heading);
  if (inspection.description !== "") {
    const description = document.createElement("p");
    description.textContent = inspection.description;
    card.append(description);
  }
  const list = document.createElement("dl");
  addDefinition(list, "Source", inspection.source);
  card.append(list);
  return card;
}
