import type {
  Loadable,
  MosaicSummary,
  TileCount,
} from "../../lib/core/combinations/index.ts";

/**
 * What a mark says about an entry. Each kind has one badge style in the
 * lists, so a color keeps one meaning: where you are (`current`), history
 * (`recent`), information (`mosaics`) and not compatible (`noMatch`).
 */
export type CombinationMarkKind = "current" | "recent" | "mosaics" | "noMatch";

/** A badge after an entry's title. */
export interface CombinationMark {
  kind: CombinationMarkKind;
  text: string;
}

/** The entry open in this sandbox. */
export const CURRENT_MARK: CombinationMark = Object.freeze({
  kind: "current",
  text: "Current",
});

/** A recently used entry that the catalog does not list. */
export const RECENT_MARK: CombinationMark = Object.freeze({
  kind: "recent",
  text: "Recent",
});

/** An entry with tiles to compare and none matching. */
export const NO_MATCH_MARK: CombinationMark = Object.freeze({
  kind: "noMatch",
  text: "no match",
});

/** Where an entry goes when a list opens: what fits first, then partly, then not at all. */
export type CountRank = "compatible" | "partial" | "incompatible";

/** One entry of a list: a catalog source, or a recently used one the catalog does not list. */
export interface ListedSource {
  source: string;
  isRecent: boolean;
}

/** The count's tiles, when it is known and has tiles to compare. */
function readMatching(
  count: Loadable<TileCount> | null | undefined,
): { matching: number; total: number } | null {
  if (count === null || count === undefined || count.state !== "loaded") {
    return null;
  }
  if (count.value === "any" || count.value.total === 0) {
    return null;
  }
  return count.value;
}

/**
 * The group an entry is sorted into: every tile matches, `any`, or no count
 * known yet, first; some matching tiles next; none last.
 */
export function rankTileCount(
  count: Loadable<TileCount> | null | undefined,
): CountRank {
  const known = readMatching(count);
  if (known === null || known.matching === known.total) {
    return "compatible";
  }
  return known.matching === 0 ? "incompatible" : "partial";
}

/** Whether a known count has tiles and none of them matches. */
export function hasNoMatch(
  count: Loadable<TileCount> | null | undefined,
): boolean {
  return readMatching(count)?.matching === 0;
}

/** `<matching>/<total>` or `any`, or `null` while the count is not known. */
export function describeTileCount(
  count: Loadable<TileCount> | null | undefined,
): string | null {
  if (count === null || count === undefined || count.state !== "loaded") {
    return null;
  }
  if (count.value === "any") {
    return "any";
  }
  const text = `${count.value.matching}/${count.value.total}`;
  return text;
}

const RANK_ORDER: readonly CountRank[] = [
  "compatible",
  "partial",
  "incompatible",
];

/**
 * The ids of entries sorted into their rank groups, each keeping the list
 * order. `ranks` gives each id's rank at the moment the list opened.
 */
export function sortByRank(
  ids: readonly string[],
  ranks: ReadonlyMap<string, CountRank>,
): string[] {
  const sorted: string[] = [];
  for (const rank of RANK_ORDER) {
    for (const id of ids) {
      if ((ranks.get(id) ?? "compatible") === rank) {
        sorted.push(id);
      }
    }
  }
  return sorted;
}

/**
 * The catalog's sources in catalog order, then the recently used ones it does
 * not list, newest first, marked recent, then `current` when neither holds it.
 */
export function listSources(
  catalogSources: readonly string[],
  recentSources: readonly string[],
  current: string | null,
): ListedSource[] {
  const listed: ListedSource[] = [];
  for (const source of catalogSources) {
    listed.push({ source, isRecent: false });
  }
  for (const source of recentSources) {
    if (!catalogSources.includes(source)) {
      listed.push({ source, isRecent: true });
    }
  }
  const isListed =
    current === null ||
    catalogSources.includes(current) ||
    recentSources.includes(current);
  if (!isListed) {
    listed.push({ source: current, isRecent: false });
  }
  return listed;
}

/** The sources of `listed`. */
export function readSources(listed: readonly ListedSource[]): string[] {
  const sources: string[] = [];
  for (const entry of listed) {
    sources.push(entry.source);
  }
  return sources;
}

/** How many of `mosaics` pair `mod` with `collection` (`null` for none), compared by resolved sources. */
export function countPairMosaics(
  mosaics: readonly MosaicSummary[],
  mod: string,
  collection: string | null,
): number {
  let count = 0;
  for (const mosaic of mosaics) {
    if (mosaic.mod === mod && mosaic.collection === collection) {
      count += 1;
    }
  }
  return count;
}

/** The `mosaics` mark, `1 mosaic` or `<n> mosaics`, or `null` for none. */
export function buildMosaicCountMark(count: number): CombinationMark | null {
  if (count === 0) {
    return null;
  }
  const mark: CombinationMark = {
    kind: "mosaics",
    text: count === 1 ? "1 mosaic" : `${count} mosaics`,
  };
  return mark;
}

/** A mosaic's aliases as `<field> <- <names>` items, in file order. */
export function describeAliases(
  aliases: Readonly<Record<string, readonly string[]>>,
): string[] {
  const items: string[] = [];
  for (const [field, names] of Object.entries(aliases)) {
    items.push(`${field} <- ${names.join(", ")}`);
  }
  return items;
}

/** The decoded file name of a tile's address, such as `2016__bob_dylan.md`. */
export function readTileName(tile: string): string {
  const path = URL.canParse(tile) ? new URL(tile).pathname : tile;
  const name = path.slice(path.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** The loaded values of `entries` for `sources`, in order, skipping those not loaded. */
export function readLoadedValues<Value>(
  entries: Readonly<Record<string, Loadable<Value>>>,
  sources: readonly string[],
): Value[] {
  const values: Value[] = [];
  for (const source of sources) {
    const entry = entries[source];
    if (entry?.state === "loaded") {
      values.push(entry.value);
    }
  }
  return values;
}
