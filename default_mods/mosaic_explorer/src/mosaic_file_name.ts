/** The name a downloaded mosaic gets when its address names no file. */
export const FALLBACK_MOSAIC_FILE_NAME = "mosaic.yaml";

/** Whether `name` holds a path separator or a control character, which a file name cannot. */
function holdsUnsafeCharacter(name: string): boolean {
  for (const character of name) {
    const code = character.codePointAt(0) ?? 0;
    if (
      character === "/" ||
      character === "\\" ||
      code < 0x20 ||
      code === 0x7f
    ) {
      return true;
    }
  }
  return false;
}

/** Decodes a path segment, or keeps it as it is when it is not valid percent-encoding. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * The file name of a downloaded mosaic: the last segment of its address,
 * decoded, or `mosaic.yaml` when that segment is empty, `.`, `..` or holds a
 * character a file name cannot.
 */
export function readMosaicFileName(source: string): string {
  const path = URL.canParse(source) ? new URL(source).pathname : source;
  const segments = path.split("/");
  const name = decodeSegment(segments[segments.length - 1] ?? "");
  const isFileName =
    name !== "" && name !== "." && name !== ".." && !holdsUnsafeCharacter(name);
  return isFileName ? name : FALLBACK_MOSAIC_FILE_NAME;
}
