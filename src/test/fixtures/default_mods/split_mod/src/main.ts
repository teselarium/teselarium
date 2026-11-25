import { describeCards } from "./cards.ts";

export default async function mount(count: number): Promise<string> {
  const lazyCards = await import("./lazy_cards.ts");
  const description = `${describeCards(count)} ${lazyCards.LAZY_LABEL}`;
  return description;
}
