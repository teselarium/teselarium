import { buildMosaicCountKey } from "../../lib/core/combinations/index.ts";
import type {
  CombinationSnapshot,
  EntryScore,
  Loadable,
  MosaicSummary,
} from "../../lib/core/combinations/index.ts";
import type { RunLink } from "../../lib/core/engine/index.ts";
import { buildMosaicChoice } from "../../lib/core/stage/index.ts";
import type {
  LoadedFileSource,
  SandboxLink,
} from "../../lib/core/stage/index.ts";
import { orderEntries } from "./list_order.ts";

/** The mark column: the current entry's filled dot, or the ring of an entry tried recently and not saved in the app. */
export type RowMark = "current" | "tried";

/**
 * The mosaic badge of a mod or collection entry: how many mosaics it has
 * with the other capsule's value, and, while a search finds it only through
 * them, how many of those match.
 */
export interface MosaicBadge {
  count: number;
  matching: number | null;
}

/** How a mosaic list entry relates to the sandbox's mod and collection, for its group and filters. */
export interface MosaicPairFacts {
  isCurrentPair: boolean;
  hasCurrentMod: boolean;
  /** The current collection, or none when "None" is current. */
  hasCurrentCollection: boolean;
}

/** The mosaics a search found an entry through: the first one's title, and how many more. */
export interface FoundMosaics {
  title: string;
  moreCount: number;
}

/** One row of a list: an entry, a pinned row or a page's option. Frozen by convention. */
export interface CombinationRow {
  /** Unique in the list: a resolved source, or a fixed id such as `none`. */
  id: string;
  title: string;
  /** Short items shown under the title, such as a mosaic's aliases. */
  details: readonly string[];
  /** Set by the search for an entry found only through its mosaics. */
  foundMosaics: FoundMosaics | null;
  mark: RowMark | null;
  /** The badge column: a count for a mod or collection entry with mosaics, the icon alone for a mosaic, the pencil for the edit row. */
  mosaics: MosaicBadge | "icon" | "edit" | null;
  /** The score column, or `null` for an entry with no score. An entry with a page shows its best option's score (`matchEntries`). */
  score: EntryScore;
  /** A page's options, its mosaics then "Without a mosaic", for an entry with mosaics. Choosing the entry opens its page. */
  options: readonly CombinationRow[] | null;
  /** What the search reads: the title, or `<mod> + <collection>` for an unsaved combination. */
  searchText: string;
  /** For a mosaic list entry, how it relates to the current pair. */
  pair: MosaicPairFacts | null;
  isSelectable: boolean;
  /** Why the entry's file cannot be loaded, or `null`. Such an entry goes last and is not selectable. */
  failure: string | null;
  onChoose: () => void;
  /** Drops a recently used entry that cannot be loaded, or `null`. */
  onRemove: (() => void) | null;
}

/** One entry of a list: a catalog source, or a recently used one the catalog does not list. */
export interface ListedSource {
  source: string;
  isRecent: boolean;
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

/** The mosaics of `mosaics` that pair `mod` with `collection` (`null` for none), compared by resolved sources. */
export function listPairMosaics(
  mosaics: readonly MosaicSummary[],
  mod: string,
  collection: string | null,
): MosaicSummary[] {
  const paired: MosaicSummary[] = [];
  for (const mosaic of mosaics) {
    if (mosaic.mod === mod && mosaic.collection === collection) {
      paired.push(mosaic);
    }
  }
  return paired;
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

/** What a row does when chosen or removed, so the row builders stay pure. */
export interface RowActions {
  /** Closes the list, then opens `link`, or nothing for `null`, the current entry. */
  choose: (link: RunLink | null) => void;
  /** Closes the list, then opens `link` in a new sandbox, leaving the current one behind it. */
  openViewer: (link: RunLink) => void;
  /** Drops a recently used entry that cannot be loaded. */
  remove: (entry: LoadedFileSource) => void;
}

/** A list's rows: pinned at the top, the entries to sort and filter, and those that cannot be loaded. */
export interface ListRows {
  pinnedRows: readonly CombinationRow[];
  entries: readonly CombinationRow[];
  failedRows: readonly CombinationRow[];
}

/** The current mark wins over the ring. */
export function readRowMark(
  isCurrent: boolean,
  isTried: boolean,
): RowMark | null {
  if (isCurrent) {
    return "current";
  }
  return isTried ? "tried" : null;
}

const LOADING_SCORE: EntryScore = Object.freeze({ state: "loading" });

/** The count under `key`, loading until it is measured. */
export function readCountScore(
  snapshot: CombinationSnapshot,
  key: string,
): EntryScore {
  return snapshot.counts[key] ?? LOADING_SCORE;
}

/** A mosaic's score with its aliases, or `null` for a mosaic without a collection. */
export function readMosaicScore(
  snapshot: CombinationSnapshot,
  mosaic: MosaicSummary,
): EntryScore {
  if (mosaic.collection === null) {
    return null;
  }
  return readCountScore(snapshot, buildMosaicCountKey(mosaic.source));
}

/** A mosaic's aliases as items, or "No aliases". */
export function describeMosaicAliases(mosaic: MosaicSummary): string[] {
  const aliases = describeAliases(mosaic.aliases);
  if (aliases.length === 0) {
    const none = ["No aliases"];
    return none;
  }
  return aliases;
}

/** What a page's options need from the list. */
export interface PageInputs {
  link: SandboxLink;
  snapshot: CombinationSnapshot;
  /** The recently used mosaics that the catalog does not list. */
  triedMosaics: ReadonlySet<string>;
  actions: RowActions;
}

/** A page's mosaic option: chosen as in the mosaic list. */
function buildMosaicOption(
  inputs: PageInputs,
  mosaic: MosaicSummary,
): CombinationRow {
  const option: CombinationRow = {
    id: mosaic.source,
    title: mosaic.title,
    details: describeMosaicAliases(mosaic),
    foundMosaics: null,
    mark: readRowMark(
      mosaic.source === inputs.link.mosaic,
      inputs.triedMosaics.has(mosaic.source),
    ),
    mosaics: "icon",
    score: readMosaicScore(inputs.snapshot, mosaic),
    options: null,
    searchText: mosaic.title,
    pair: null,
    isSelectable: true,
    failure: null,
    onChoose: inputs.actions.choose.bind(
      undefined,
      buildMosaicChoice(inputs.link, mosaic.source),
    ),
    onRemove: null,
  };
  return option;
}

/** The suffix of a "Without a mosaic" option's id, after its entry's id. */
export const WITHOUT_MOSAIC_SUFFIX = "#without-mosaic";

/** What an entry with mosaics is, for its page. */
export interface PageEntry {
  id: string;
  title: string;
  isCurrent: boolean;
  /** The entry's score without aliases. */
  score: EntryScore;
  /** Choosing the entry: what "Without a mosaic" opens. */
  onChoose: () => void;
}

/** "Without a mosaic": the entry itself, found by its title. */
function buildWithoutMosaicOption(
  inputs: PageInputs,
  entry: PageEntry,
): CombinationRow {
  const isCurrent = entry.isCurrent && inputs.link.mosaic === null;
  const option: CombinationRow = {
    id: `${entry.id}${WITHOUT_MOSAIC_SUFFIX}`,
    title: "Without a mosaic",
    details: [],
    foundMosaics: null,
    mark: readRowMark(isCurrent, false),
    mosaics: null,
    score: entry.score,
    options: null,
    searchText: entry.title,
    pair: null,
    isSelectable: true,
    failure: null,
    onChoose: entry.onChoose,
    onRemove: null,
  };
  return option;
}

/**
 * The options of an entry's page: its mosaics, sorted by "Match ratio", then
 * "Without a mosaic", left out when the entry is current and the sandbox is
 * opened from a mosaic. `null` for an entry without mosaics, which is chosen
 * directly.
 */
export function buildPageOptions(
  inputs: PageInputs,
  entry: PageEntry,
  mosaics: readonly MosaicSummary[],
): CombinationRow[] | null {
  if (mosaics.length === 0) {
    return null;
  }
  const mosaicOptions: CombinationRow[] = [];
  for (const mosaic of mosaics) {
    mosaicOptions.push(buildMosaicOption(inputs, mosaic));
  }
  const options = [...orderEntries(mosaicOptions, "ratio", "")[0].entries];
  const isFromMosaic = inputs.link.mosaic !== null;
  if (!(entry.isCurrent && isFromMosaic)) {
    options.push(buildWithoutMosaicOption(inputs, entry));
  }
  return options;
}

/** The badge of an entry with `count` mosaics, or `null` without any. */
export function buildMosaicBadge(count: number): MosaicBadge | null {
  if (count === 0) {
    return null;
  }
  const badge: MosaicBadge = { count, matching: null };
  return badge;
}

/** The recently used sources of `listed`, those the catalog does not list. */
export function listTriedSources(listed: readonly ListedSource[]): Set<string> {
  const tried = new Set<string>();
  for (const entry of listed) {
    if (entry.isRecent) {
      tried.add(entry.source);
    }
  }
  return tried;
}
