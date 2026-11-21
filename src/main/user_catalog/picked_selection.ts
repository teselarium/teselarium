import type { PickedFile } from "../../lib/files/index.ts";

/** What the user picked: files of one folder, or single files. */
export interface PickedSelection {
  /** The picked folder's name, or `null` for single files. */
  folder: string | null;
  /** Each file's path inside the folder, or its file name. */
  files: PickedFile[];
}

/** The message of a drop that holds more than one folder, or a folder and files. */
export const MIXED_DROP_MESSAGE =
  "Drop one folder, or one or more files, at a time.";

/** A drop that the import cannot take: several folders, or a folder and files. */
export class MixedDropError extends Error {
  constructor() {
    super(MIXED_DROP_MESSAGE);
    this.name = "MixedDropError";
  }
}

/** The files of "Choose files…" or a drop of files: single files, by name. */
export function readPickedFiles(files: Iterable<File>): PickedSelection {
  const picked: PickedFile[] = [];
  for (const file of files) {
    picked.push({ path: file.name, content: file });
  }
  const selection: PickedSelection = { folder: null, files: picked };
  return selection;
}

/**
 * The files of "Choose folder…": the folder is the first segment of each
 * file's `webkitRelativePath`, and the path the rest.
 */
export function readPickedFolder(files: Iterable<File>): PickedSelection {
  const picked: PickedFile[] = [];
  let folder: string | null = null;
  for (const file of files) {
    const segments = file.webkitRelativePath.split("/");
    folder = folder ?? segments[0];
    picked.push({ path: segments.slice(1).join("/"), content: file });
  }
  const selection: PickedSelection = { folder, files: picked };
  return selection;
}

function resolveEntries(
  resolve: (entries: FileSystemEntry[]) => void,
  entries: FileSystemEntry[],
): void {
  resolve(entries);
}

function startReadingEntries(
  reader: FileSystemDirectoryReader,
  resolve: (entries: FileSystemEntry[]) => void,
  reject: (error: DOMException) => void,
): void {
  reader.readEntries(resolveEntries.bind(undefined, resolve), reject);
}

/** One batch of a folder's entries: browsers give them in batches, the last one empty. */
function readEntryBatch(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise(startReadingEntries.bind(undefined, reader));
}

async function readFolderEntries(
  folder: FileSystemDirectoryEntry,
): Promise<FileSystemEntry[]> {
  const reader = folder.createReader();
  const entries: FileSystemEntry[] = [];
  let batch = await readEntryBatch(reader);
  while (batch.length > 0) {
    entries.push(...batch);
    batch = await readEntryBatch(reader);
  }
  return entries;
}

function startReadingFile(
  entry: FileSystemFileEntry,
  resolve: (file: File) => void,
  reject: (error: DOMException) => void,
): void {
  entry.file(resolve, reject);
}

function readEntryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise(startReadingFile.bind(undefined, entry));
}

function isFolderEntry(
  entry: FileSystemEntry,
): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

/** Every file under `folder`, with its path inside the dropped folder. */
async function walkDroppedFolder(
  folder: FileSystemDirectoryEntry,
  prefix: string,
  files: PickedFile[],
): Promise<void> {
  for (const entry of await readFolderEntries(folder)) {
    const path = `${prefix}${entry.name}`;
    if (isFolderEntry(entry)) {
      await walkDroppedFolder(entry, `${path}/`, files);
    } else if (isFileEntry(entry)) {
      files.push({ path, content: await readEntryFile(entry) });
    }
  }
}

function listDroppedEntries(items: DataTransferItemList): FileSystemEntry[] {
  const entries: FileSystemEntry[] = [];
  for (const item of items) {
    const entry = item.kind === "file" ? item.webkitGetAsEntry() : null;
    if (entry !== null) {
      entries.push(entry);
    }
  }
  return entries;
}

/**
 * What the user dropped: one folder, walked through `webkitGetAsEntry`, or
 * single files, read from the entries or else from `dataTransfer.files`. Raises `MixedDropError` for several folders, or a folder and
 * files.
 */
export async function readDroppedSelection(
  dataTransfer: DataTransfer,
): Promise<PickedSelection> {
  const entries = listDroppedEntries(dataTransfer.items);
  if (entries.length === 0) {
    // A browser that gives no entries still gives the dropped files.
    return readPickedFiles(dataTransfer.files);
  }
  const folders = entries.filter(isFolderEntry);
  if (folders.length === 0) {
    const files: File[] = [];
    for (const entry of entries.filter(isFileEntry)) {
      files.push(await readEntryFile(entry));
    }
    return readPickedFiles(files);
  }
  if (folders.length > 1 || entries.length > 1) {
    throw new MixedDropError();
  }
  const files: PickedFile[] = [];
  await walkDroppedFolder(folders[0], "", files);
  const selection: PickedSelection = { folder: folders[0].name, files };
  return selection;
}
