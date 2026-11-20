import type { ListFilter, ListSort } from "./list_order.ts";

/** The stage bar's three lists. */
export type ListKind = "mod" | "collection" | "mosaic";

/** One list's sort and checked filters. Frozen. */
export interface ListChoice {
  sort: ListSort;
  filters: readonly ListFilter[];
}

/** Each list's choice. Frozen, and new after every change. */
export type ListChoicesSnapshot = Readonly<Record<ListKind, ListChoice>>;

/**
 * The sort and filter choices of the stage bar's lists, kept in memory until
 * the app page is reloaded, also for other sandboxes. Mutable.
 */
export interface ListChoices {
  listeners: Set<() => void>;
  snapshot: ListChoicesSnapshot;
}

/** A sort or filter as its menu names it. */
export interface ChoiceOption<Value> {
  value: Value;
  label: string;
}

const PAIR_SORTS: readonly ChoiceOption<ListSort>[] = Object.freeze([
  { value: "mosaics-first", label: "Mosaics first" },
  { value: "name", label: "Name" },
  { value: "ratio", label: "Match ratio" },
  { value: "tiles", label: "Matching tiles" },
]);

const MOSAIC_SORTS: readonly ChoiceOption<ListSort>[] = Object.freeze([
  { value: "pair-first", label: "This pair first" },
  { value: "name", label: "Name" },
  { value: "ratio", label: "Match ratio" },
  { value: "tiles", label: "Matching tiles" },
]);

const PAIR_FILTERS: readonly ChoiceOption<ListFilter>[] = Object.freeze([
  { value: "compatible", label: "Compatible only" },
  { value: "has-mosaics", label: "Has mosaics" },
  { value: "unsaved", label: "Unsaved" },
]);

const MOSAIC_FILTERS: readonly ChoiceOption<ListFilter>[] = Object.freeze([
  { value: "pair-only", label: "This pair only" },
  { value: "same-mod", label: "Same mod" },
  { value: "same-collection", label: "Same collection" },
  { value: "compatible", label: "Compatible only" },
  { value: "unsaved", label: "Unsaved" },
]);

/** The sorts each list's menu offers, its default first. */
export const LIST_SORTS: Readonly<
  Record<ListKind, readonly ChoiceOption<ListSort>[]>
> = Object.freeze({
  mod: PAIR_SORTS,
  collection: PAIR_SORTS,
  mosaic: MOSAIC_SORTS,
});

/** The filters each list's menu offers. */
export const LIST_FILTERS: Readonly<
  Record<ListKind, readonly ChoiceOption<ListFilter>[]>
> = Object.freeze({
  mod: PAIR_FILTERS,
  collection: PAIR_FILTERS,
  mosaic: MOSAIC_FILTERS,
});

function buildDefaultChoice(kind: ListKind): ListChoice {
  const choice: ListChoice = Object.freeze({
    sort: LIST_SORTS[kind][0].value,
    filters: Object.freeze([]),
  });
  return choice;
}

/** A new store: each list with its default sort and no filter. */
export function createListChoices(): ListChoices {
  const snapshot: ListChoicesSnapshot = Object.freeze({
    mod: buildDefaultChoice("mod"),
    collection: buildDefaultChoice("collection"),
    mosaic: buildDefaultChoice("mosaic"),
  });
  const store: ListChoices = { listeners: new Set(), snapshot };
  return store;
}

function publishChoice(
  store: ListChoices,
  kind: ListKind,
  choice: ListChoice,
): void {
  store.snapshot = Object.freeze({
    ...store.snapshot,
    [kind]: Object.freeze(choice),
  });
  for (const listener of store.listeners) {
    listener();
  }
}

/** Chooses a list's sort. Listeners are told even when it was already chosen. */
export function chooseListSort(
  store: ListChoices,
  kind: ListKind,
  sort: ListSort,
): void {
  publishChoice(store, kind, { ...store.snapshot[kind], sort });
}

/** Checks or unchecks one of a list's filters, keeping the others. */
export function checkListFilter(
  store: ListChoices,
  kind: ListKind,
  filter: ListFilter,
  isChecked: boolean,
): void {
  const filters: ListFilter[] = [];
  for (const existing of store.snapshot[kind].filters) {
    if (existing !== filter) {
      filters.push(existing);
    }
  }
  if (isChecked) {
    filters.push(filter);
  }
  publishChoice(store, kind, {
    ...store.snapshot[kind],
    filters: Object.freeze(filters),
  });
}

export function readListChoicesSnapshot(
  store: ListChoices,
): ListChoicesSnapshot {
  return store.snapshot;
}

function unsubscribeListChoices(
  store: ListChoices,
  listener: () => void,
): void {
  store.listeners.delete(listener);
}

/** Calls `listener` after every change. Returns the function that unsubscribes it. */
export function subscribeListChoices(
  store: ListChoices,
  listener: () => void,
): () => void {
  store.listeners.add(listener);
  return unsubscribeListChoices.bind(undefined, store, listener);
}
