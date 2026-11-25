import {
  buildBrowserFileAddress,
  indexLocalFiles,
  isBrowserFileAddress,
  isYamlMapping,
  parseYaml,
} from "../files/index.ts";
import type {
  BrowserFileReader,
  LocalFiles,
  PickedFile,
  YamlMapping,
} from "../files/index.ts";
import type {
  BrowserDatabaseChanges,
  StoredVersion,
  StoredVersionKey,
  StoredVersionKind,
} from "../core/storage/index.ts";
import { resolveModReference } from "../mod/index.ts";
import type { LoadedMosaic } from "../mosaic/index.ts";
import { resolveCollectionReference } from "../tile/index.ts";
import { findStoredEntry } from "./user_catalog_entries.ts";
import type { UserCatalogEntry } from "./user_catalog_entries.ts";
import { buildVersion, pruneVersions, readSyncedText } from "./versions.ts";

/** The largest mosaic file the review reads, in bytes: 1 MB. */
export const MAX_MOSAIC_BYTES = 1024 * 1024;

const LOCAL_FILES_ROOT = "file:///";

const MOSAIC_FILE_EXTENSIONS = [".yaml", ".yml"];

/**
 * The status of a row of the review: a picked mosaic file that is `new`, or
 * against its entry `changed` (only the file changed since the text it was
 * last synced with), `unchanged`, `changed-here` (only the stored text
 * changed) or a `conflict` (both changed, differently); a picked file that
 * is `invalid` (not a mosaic); or an entry of the picked folder that is
 * `missing` from it.
 */
export type ImportStatus =
  | "new"
  | "changed"
  | "unchanged"
  | "changed-here"
  | "conflict"
  | "invalid"
  | "missing";

/**
 * What to do with a conflict: keep the stored text, replace it with the
 * file's, or keep it and import the file as a new single-file entry.
 */
export type ConflictChoice = "keep-mine" | "take-file" | "keep-both";

/** A row of the review. */
export interface ImportReviewRow {
  /** The file's path inside the picked folder, its file name, or the entry's path. */
  path: string;
  status: ImportStatus;
  /** The mosaic's title, or `null` when it is not a mosaic. */
  title: string | null;
  /** Why the file is not a mosaic, or `null`. */
  error: string | null;
  /** The relative references that will not open, one message each. */
  warnings: string[];
  /** The stored file's address: the entry's, or the one a new file gets. */
  address: string;
  root: string;
  /** The picked text, or `null` for a file that was not read and for a missing entry. */
  text: string | null;
  /** The entry the row updates or removes, or `null` for a new file. */
  entry: UserCatalogEntry | null;
  /** The entry's versions, newest first, which a write prunes. Empty without an entry. */
  versions: StoredVersionKey[];
  /** For a conflict, the root of the entry "Keep both" imports the file as, otherwise `null`. */
  keepBothRoot: string | null;
  /** Whether applying an update replaces changes made here since export, which stay in the history. */
  replacesLocalChanges: boolean;
}

/** What an import or an update would change, before the user applies it. */
export interface ImportReview {
  /** The picked folder's name, or `null` for single files. */
  folder: string | null;
  rows: ImportReviewRow[];
  /** How many picked files are not `.yaml` or `.yml`, and were not read. */
  ignoredCount: number;
}

/** Reads the versions of stored files, newest first. */
export interface StoredVersionReader {
  readVersions(address: string): Promise<StoredVersion[]>;
}

/** What a review reads besides the picked files. */
export interface ReviewSources {
  /** The current entries of the user catalog. */
  entries: readonly UserCatalogEntry[];
  /** The stored texts, to tell changed files from unchanged ones. */
  storedFiles: BrowserFileReader;
  /** The stored versions, to tell what changed since the text an entry was last synced with. */
  storedVersions: StoredVersionReader;
  /** Loads a picked file through its `file:///` address, with the real mosaic loader. */
  readMosaic: (
    address: string,
    localFiles: LocalFiles,
  ) => Promise<LoadedMosaic>;
  /** Makes a new root. Defaults to `crypto.randomUUID()`. */
  createRoot?: () => string;
}

/** Where a picked file goes: its root, and the entry it updates or `null`. */
interface RowTarget {
  root: string;
  entry: UserCatalogEntry | null;
}

/** A picked mosaic file, read and loaded, before it is compared with its entry. */
interface ReadPickedFile {
  title: string | null;
  error: string | null;
  text: string | null;
  mosaic: LoadedMosaic | null;
}

function createRandomRoot(): string {
  return crypto.randomUUID();
}

function isMosaicFileName(path: string): boolean {
  for (const extension of MOSAIC_FILE_EXTENSIONS) {
    if (path.toLowerCase().endsWith(extension)) {
      return true;
    }
  }
  return false;
}

function trimLeadingSlashes(path: string): string {
  let trimmedPath = path;
  while (trimmedPath.startsWith("/")) {
    trimmedPath = trimmedPath.slice(1);
  }
  return trimmedPath;
}

function describeReadError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function buildLocalAddress(path: string): string {
  const localAddress = new URL(path, LOCAL_FILES_ROOT).href;
  return localAddress;
}

async function readPickedFile(
  path: string,
  content: Blob,
  localFiles: LocalFiles,
  sources: ReviewSources,
): Promise<ReadPickedFile> {
  if (content.size > MAX_MOSAIC_BYTES) {
    const tooLarge: ReadPickedFile = {
      title: null,
      error: "larger than 1 MB",
      text: null,
      mosaic: null,
    };
    return tooLarge;
  }
  const text = await content.text();
  try {
    const mosaic = await sources.readMosaic(
      buildLocalAddress(path),
      localFiles,
    );
    const loaded: ReadPickedFile = {
      title: mosaic.title,
      error: null,
      text,
      mosaic,
    };
    return loaded;
  } catch (error) {
    const invalid: ReadPickedFile = {
      title: null,
      error: describeReadError(error),
      text,
      mosaic: null,
    };
    return invalid;
  }
}

/** The `mosaic` mapping of a text the loader already accepted. */
function readMosaicMapping(text: string, localAddress: string): YamlMapping {
  const parsedYaml = parseYaml({ source: localAddress, content: text });
  const mosaic = parsedYaml.content.mosaic;
  if (!isYamlMapping(mosaic)) {
    const emptyMapping: YamlMapping = {};
    return emptyMapping;
  }
  return mosaic;
}

function describeMissingReference(reference: string): string {
  const warning = `"${reference}" is not in this browser, so the mosaic will not open until it is`;
  return warning;
}

function resolveStoredReference(
  fieldName: "mod" | "collection",
  reference: string,
  address: string,
): string {
  if (fieldName === "mod") {
    return resolveModReference(reference, { baseUrl: address });
  }
  return resolveCollectionReference(reference, address);
}

/**
 * Whether a relative reference will not open once stored: it resolves to a
 * browser address that is not stored, and the picked files do not hold it.
 */
function isMissingReference(
  fieldName: "mod" | "collection",
  reference: string,
  resolvedLocal: string,
  address: string,
  localFiles: LocalFiles,
  entries: readonly UserCatalogEntry[],
): boolean {
  if (
    !resolvedLocal.startsWith(LOCAL_FILES_ROOT) ||
    localFiles.has(resolvedLocal)
  ) {
    return false;
  }
  const resolvedStored = resolveStoredReference(fieldName, reference, address);
  if (!isBrowserFileAddress(resolvedStored)) {
    return false;
  }
  const isMissing = findStoredEntry(entries, resolvedStored) === null;
  return isMissing;
}

function listReferenceWarnings(
  picked: ReadPickedFile,
  path: string,
  address: string,
  localFiles: LocalFiles,
  entries: readonly UserCatalogEntry[],
): string[] {
  const warnings: string[] = [];
  if (picked.mosaic === null || picked.text === null) {
    return warnings;
  }
  const mapping = readMosaicMapping(picked.text, buildLocalAddress(path));
  const references: ["mod" | "collection", string | null][] = [
    ["mod", picked.mosaic.mod],
    ["collection", picked.mosaic.collection],
  ];
  for (const [fieldName, resolvedLocal] of references) {
    const reference = mapping[fieldName];
    if (
      resolvedLocal !== null &&
      typeof reference === "string" &&
      isMissingReference(
        fieldName,
        reference,
        resolvedLocal,
        address,
        localFiles,
        entries,
      )
    ) {
      warnings.push(describeMissingReference(reference));
    }
  }
  return warnings;
}

/**
 * The status of a picked file that matches a stored entry, from the file's
 * text, the stored text, and the text the entry was last imported, updated
 * from a file or exported with, `null` when there is none.
 */
export function classifyMatchingFile(
  fileText: string,
  storedText: string | null,
  syncedText: string | null,
): ImportStatus {
  if (fileText === storedText) {
    return "unchanged";
  }
  if (storedText === syncedText) {
    return "changed";
  }
  if (fileText === syncedText) {
    return "changed-here";
  }
  return "conflict";
}

/** What the review knows of a picked file's entry: its stored text and its versions, newest first. */
interface EntryHistory {
  storedText: string | null;
  versions: StoredVersion[];
}

async function readEntryHistory(
  entry: UserCatalogEntry | null,
  sources: ReviewSources,
): Promise<EntryHistory> {
  if (entry === null) {
    const noHistory: EntryHistory = { storedText: null, versions: [] };
    return noHistory;
  }
  const history: EntryHistory = {
    storedText: await sources.storedFiles.readText(entry.address),
    versions: await sources.storedVersions.readVersions(entry.address),
  };
  return history;
}

function readPickedStatus(
  picked: ReadPickedFile,
  entry: UserCatalogEntry | null,
  history: EntryHistory,
): ImportStatus {
  if (picked.error !== null || picked.text === null) {
    return "invalid";
  }
  if (entry === null) {
    return "new";
  }
  return classifyMatchingFile(
    picked.text,
    history.storedText,
    readSyncedText(history.versions, entry.syncedAt),
  );
}

function listVersionKeys(
  versions: readonly StoredVersion[],
): StoredVersionKey[] {
  const keys: StoredVersionKey[] = [];
  for (const version of versions) {
    keys.push({ address: version.address, savedAt: version.savedAt });
  }
  return keys;
}

async function buildPickedRow(
  path: string,
  content: Blob,
  target: RowTarget,
  localFiles: LocalFiles,
  sources: ReviewSources,
): Promise<ImportReviewRow> {
  const picked = await readPickedFile(path, content, localFiles, sources);
  const address =
    target.entry?.address ?? buildBrowserFileAddress(target.root, path);
  const history = await readEntryHistory(target.entry, sources);
  const status = readPickedStatus(picked, target.entry, history);
  const createRoot = sources.createRoot ?? createRandomRoot;
  const row: ImportReviewRow = {
    path,
    status,
    title: picked.title,
    error: picked.error,
    warnings: listReferenceWarnings(
      picked,
      path,
      address,
      localFiles,
      sources.entries,
    ),
    address,
    root: target.root,
    text: picked.text,
    entry: target.entry,
    versions: listVersionKeys(history.versions),
    keepBothRoot: status === "conflict" ? createRoot() : null,
    replacesLocalChanges: false,
  };
  return row;
}

/** The stored entry imported from `path` of `folder`, or `null`. */
function findMatchingEntry(
  entries: readonly UserCatalogEntry[],
  folder: string | null,
  path: string,
): UserCatalogEntry | null {
  for (const entry of entries) {
    if (
      entry.place === "browser" &&
      entry.provenance.folder === folder &&
      entry.provenance.path === path
    ) {
      return entry;
    }
  }
  return null;
}

/** The root a folder's entries share, or `null` for a folder never imported. */
function findFolderRoot(
  entries: readonly UserCatalogEntry[],
  folder: string,
): string | null {
  for (const entry of entries) {
    if (entry.place === "browser" && entry.provenance.folder === folder) {
      return entry.root;
    }
  }
  return null;
}

function buildMissingRow(entry: UserCatalogEntry): ImportReviewRow {
  const row: ImportReviewRow = {
    path: entry.provenance.path ?? entry.address,
    status: "missing",
    title: null,
    error: null,
    warnings: [],
    address: entry.address,
    root: entry.root ?? "",
    text: null,
    entry,
    versions: [],
    keepBothRoot: null,
    replacesLocalChanges: false,
  };
  return row;
}

/** The entries of `folder` whose path the picked files do not have. */
function listMissingRows(
  entries: readonly UserCatalogEntry[],
  folder: string | null,
  pickedPaths: ReadonlySet<string>,
): ImportReviewRow[] {
  const rows: ImportReviewRow[] = [];
  if (folder === null) {
    return rows;
  }
  for (const entry of entries) {
    const isOfFolder =
      entry.place === "browser" && entry.provenance.folder === folder;
    if (isOfFolder && !pickedPaths.has(entry.provenance.path ?? "")) {
      rows.push(buildMissingRow(entry));
    }
  }
  return rows;
}

function chooseRowTarget(
  entries: readonly UserCatalogEntry[],
  folder: string | null,
  path: string,
  folderRoot: string | null,
  createRoot: () => string,
): RowTarget {
  const entry = findMatchingEntry(entries, folder, path);
  if (entry !== null && entry.root !== null) {
    const updateTarget: RowTarget = { root: entry.root, entry };
    return updateTarget;
  }
  const newTarget: RowTarget = {
    root: folderRoot ?? createRoot(),
    entry: null,
  };
  return newTarget;
}

function listMosaicFiles(picked: readonly PickedFile[]): PickedFile[] {
  const mosaicFiles: PickedFile[] = [];
  for (const pickedFile of picked) {
    if (isMosaicFileName(pickedFile.path)) {
      mosaicFiles.push({
        path: trimLeadingSlashes(pickedFile.path),
        content: pickedFile.content,
      });
    }
  }
  return mosaicFiles;
}

/**
 * The review of picked files. `picked` holds each file's path inside the
 * picked folder, or its file name when `folderName` is `null`. Files that are
 * not `.yaml` or `.yml` are counted and never read. A file matches the stored
 * entry of the same folder name and path, and is its update. A folder keeps
 * the root of its earlier import, and a single file gets a root of its own.
 * The entries of the folder that the picked files lack are `missing` rows.
 */
export async function planImport(
  picked: readonly PickedFile[],
  folderName: string | null,
  sources: ReviewSources,
): Promise<ImportReview> {
  const createRoot = sources.createRoot ?? createRandomRoot;
  const mosaicFiles = listMosaicFiles(picked);
  const localFiles = indexLocalFiles(picked);
  let folderRoot: string | null = null;
  if (folderName !== null) {
    folderRoot = findFolderRoot(sources.entries, folderName) ?? createRoot();
  }
  const rows: ImportReviewRow[] = [];
  const pickedPaths = new Set<string>();
  for (const mosaicFile of mosaicFiles) {
    const target = chooseRowTarget(
      sources.entries,
      folderName,
      mosaicFile.path,
      folderRoot,
      createRoot,
    );
    rows.push(
      await buildPickedRow(
        mosaicFile.path,
        mosaicFile.content,
        target,
        localFiles,
        sources,
      ),
    );
    pickedPaths.add(mosaicFile.path);
  }
  rows.push(...listMissingRows(sources.entries, folderName, pickedPaths));
  const review: ImportReview = {
    folder: folderName,
    rows,
    ignoredCount: picked.length - mosaicFiles.length,
  };
  return review;
}

/**
 * The review of one picked file as the update of a stored entry, whatever
 * the file's name: `changed`, `unchanged` or `invalid`. The file is read at
 * the entry's path, so its relative references resolve as they will once
 * stored. The user picked it to replace the entry, so a file that differs is
 * `changed` even when the entry changed here too, and the row then says it
 * replaces the changes made here.
 */
export async function planUpdate(
  picked: PickedFile,
  entry: UserCatalogEntry,
  sources: ReviewSources,
): Promise<ImportReview> {
  const path = entry.provenance.path ?? picked.path;
  const localFiles = indexLocalFiles([{ path, content: picked.content }]);
  const target: RowTarget = { root: entry.root ?? "", entry };
  const row = await buildPickedRow(
    path,
    picked.content,
    target,
    localFiles,
    sources,
  );
  const isReplacing =
    row.status === "new" ||
    row.status === "changed-here" ||
    row.status === "conflict";
  if (isReplacing) {
    row.status = "changed";
  }
  row.keepBothRoot = null;
  row.replacesLocalChanges =
    row.status === "changed" && entry.provenance.changedSinceExport;
  const review: ImportReview = {
    folder: entry.provenance.folder,
    rows: [row],
    ignoredCount: 0,
  };
  return review;
}

/** Whether the user can check the row: a new, changed or missing one. */
export function isCheckableRow(row: ImportReviewRow): boolean {
  return (
    row.status === "new" || row.status === "changed" || row.status === "missing"
  );
}

/** The rows checked when the review opens: the new and changed ones, by index. */
export function listDefaultChecked(review: ImportReview): Set<number> {
  const checked = new Set<number>();
  for (const [index, row] of review.rows.entries()) {
    if (row.status === "new" || row.status === "changed") {
      checked.add(index);
    }
  }
  return checked;
}

function buildStoredEntry(
  row: ImportReviewRow,
  folder: string | null,
  now: string,
): UserCatalogEntry {
  if (row.entry !== null) {
    const updatedEntry: UserCatalogEntry = {
      ...row.entry,
      provenance: {
        ...row.entry.provenance,
        updatedAt: now,
        changedSinceExport: false,
      },
      syncedAt: now,
    };
    return updatedEntry;
  }
  const newEntry: UserCatalogEntry = {
    address: row.address,
    place: "browser",
    root: row.root,
    provenance: {
      folder,
      path: row.path,
      addedAt: now,
      updatedAt: null,
      changedSinceExport: false,
      copiedFrom: null,
    },
    syncedAt: now,
  };
  return newEntry;
}

/** The name of the single file "Keep both" imports a conflicting file as: `<name> (from file).yaml`. */
function buildKeepBothPath(path: string): string {
  const segments = path.split("/");
  const fileName = segments[segments.length - 1];
  let name = fileName;
  for (const extension of MOSAIC_FILE_EXTENSIONS) {
    if (fileName.toLowerCase().endsWith(extension)) {
      name = fileName.slice(0, -extension.length);
    }
  }
  const keepBothPath = `${name} (from file).yaml`;
  return keepBothPath;
}

/**
 * Puts a row's file, its entry and its new version, and prunes the entry's
 * versions. The entry is synced with the new version, so it is not changed
 * since export.
 */
function writePickedFile(
  changes: Required<BrowserDatabaseChanges<UserCatalogEntry>>,
  row: ImportReviewRow,
  entry: UserCatalogEntry,
  kind: StoredVersionKind,
  time: string,
): void {
  if (row.text === null) {
    return;
  }
  const version = buildVersion(entry.address, time, kind, row.text);
  changes.putFiles.push({ address: entry.address, text: row.text });
  changes.putEntries.push(entry);
  changes.putVersions.push(version);
  changes.deleteVersions.push(
    ...pruneVersions([version, ...row.versions], time),
  );
}

/** "Keep both": the conflicting file as a new single-file entry of its own root. */
function writeKeepBoth(
  changes: Required<BrowserDatabaseChanges<UserCatalogEntry>>,
  row: ImportReviewRow,
  time: string,
): void {
  if (row.keepBothRoot === null) {
    return;
  }
  const path = buildKeepBothPath(row.path);
  const keptRow: ImportReviewRow = {
    ...row,
    path,
    address: buildBrowserFileAddress(row.keepBothRoot, path),
    root: row.keepBothRoot,
    entry: null,
    versions: [],
  };
  const entry = buildStoredEntry(keptRow, null, time);
  writePickedFile(changes, keptRow, entry, "imported", time);
}

function applyConflictChoice(
  changes: Required<BrowserDatabaseChanges<UserCatalogEntry>>,
  row: ImportReviewRow,
  folder: string | null,
  choice: ConflictChoice | undefined,
  time: string,
): void {
  if (choice === "take-file") {
    const entry = buildStoredEntry(row, folder, time);
    writePickedFile(changes, row, entry, "updated", time);
  } else if (choice === "keep-both") {
    writeKeepBoth(changes, row, time);
  }
}

function applyCheckedRow(
  changes: Required<BrowserDatabaseChanges<UserCatalogEntry>>,
  row: ImportReviewRow,
  folder: string | null,
  time: string,
): void {
  if (row.status === "missing") {
    changes.deleteAddresses.push(row.address);
    return;
  }
  const kind: StoredVersionKind = row.entry === null ? "imported" : "updated";
  writePickedFile(
    changes,
    row,
    buildStoredEntry(row, folder, time),
    kind,
    time,
  );
}

/**
 * The database changes of the checked rows and of the conflict choices, by
 * index: new and changed files are put with their entries and a version,
 * checked missing entries are deleted with their files and versions, and
 * each conflict follows its choice, none changing nothing. An update keeps
 * the entry's address and `addedAt`, sets `updatedAt` to `now`, and keeps
 * the replaced text in the history, which is pruned. Rows that cannot be
 * checked change nothing.
 */
export function applyReview(
  review: ImportReview,
  checked: ReadonlySet<number>,
  now: Date,
  choices: ReadonlyMap<number, ConflictChoice> = new Map(),
): BrowserDatabaseChanges<UserCatalogEntry> {
  const time = now.toISOString();
  const changes: Required<BrowserDatabaseChanges<UserCatalogEntry>> = {
    putFiles: [],
    putEntries: [],
    putVersions: [],
    deleteVersions: [],
    deleteAddresses: [],
  };
  for (const [index, row] of review.rows.entries()) {
    if (row.status === "conflict") {
      applyConflictChoice(
        changes,
        row,
        review.folder,
        choices.get(index),
        time,
      );
    } else if (checked.has(index) && isCheckableRow(row)) {
      applyCheckedRow(changes, row, review.folder, time);
    }
  }
  return changes;
}

/**
 * Whether "Import" can apply the review: a checkable row is checked, or
 * every conflict has a choice.
 */
export function canApplyReview(
  review: ImportReview,
  checked: ReadonlySet<number>,
  choices: ReadonlyMap<number, ConflictChoice>,
): boolean {
  let conflictCount = 0;
  let isEveryConflictChosen = true;
  for (const [index, row] of review.rows.entries()) {
    if (checked.has(index) && isCheckableRow(row)) {
      return true;
    }
    if (row.status === "conflict") {
      conflictCount += 1;
      isEveryConflictChosen &&= choices.has(index);
    }
  }
  return conflictCount > 0 && isEveryConflictChosen;
}
