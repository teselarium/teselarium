import { FileFetchError } from "./file_errors.ts";

/** Root of the virtual URLs given to picked files. It stands for the picked folder. */
const LOCAL_FILES_ROOT = "file:///";

/**
 * A file the user picked on their computer. `path` is the file's path inside
 * the picked folder, e.g. `library/books/kallocain.md`.
 */
export interface PickedFile {
  path: string;
  content: Blob;
}

/** Picked files keyed by their virtual `file:///` URL href. */
export type LocalFiles = ReadonlyMap<string, Blob>;

/** Indexes picked files by their virtual `file:///` URL. A repeated path keeps the later file. */
export function indexLocalFiles(pickedFiles: Iterable<PickedFile>): LocalFiles {
  const localFiles = new Map<string, Blob>();
  for (const pickedFile of pickedFiles) {
    const fileUrl = new URL(pickedFile.path, LOCAL_FILES_ROOT);
    localFiles.set(fileUrl.href, pickedFile.content);
  }
  return localFiles;
}

/** Reads the text of the picked file at a `file:` URL. */
export async function readLocalFile(
  url: URL,
  localFiles: LocalFiles | undefined,
): Promise<string> {
  if (localFiles === undefined) {
    throw new FileFetchError(url.href, "no local files were picked");
  }
  const pickedContent = localFiles.get(url.href);
  if (pickedContent === undefined) {
    throw new FileFetchError(
      url.href,
      "the file is not among the picked files",
    );
  }
  try {
    const text = await pickedContent.text();
    return text;
  } catch (error) {
    throw new FileFetchError(url.href, "the picked file cannot be read", {
      cause: error,
    });
  }
}
