// Pure: a string in, what kind of address it is out. Only absolute `http:`
// and `https:` addresses count. The extension is read on the address's path,
// lower-cased, so a query or a fragment does not change it.

/** The extensions of the images whose addresses also show a thumbnail. */
const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
];

/** The extension of tiles, which open in the tile viewer. */
const TILE_EXTENSION = ".md";

const WEB_PROTOCOLS = ["http:", "https:"];

/** The lower-cased path of a web address, or `null` for anything else. */
function readWebPath(value: string): string | null {
  if (!URL.canParse(value)) {
    return null;
  }
  const url = new URL(value);
  if (!WEB_PROTOCOLS.includes(url.protocol)) {
    return null;
  }
  return url.pathname.toLowerCase();
}

/** Whether `value` is an absolute `http:` or `https:` address. */
export function isWebAddress(value: string): boolean {
  return readWebPath(value) !== null;
}

/** Whether `value` is a web address whose path ends with an image extension. */
export function isImageAddress(value: string): boolean {
  const path = readWebPath(value);
  if (path === null) {
    return false;
  }
  for (const extension of IMAGE_EXTENSIONS) {
    if (path.endsWith(extension)) {
      return true;
    }
  }
  return false;
}

/** Whether `value` is a web address whose path ends with `.md`: a tile. */
export function isTileAddress(value: string): boolean {
  const path = readWebPath(value);
  return path !== null && path.endsWith(TILE_EXTENSION);
}
