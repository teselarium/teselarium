import type { Element } from "hast";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * An address of a body as an absolute URL: as written when it is absolute,
 * otherwise resolved against the tile's source. `null` when it is neither,
 * as with a relative address in a tile whose source is not hierarchical.
 */
export function resolveBodyAddress(
  address: string,
  tileSource: string,
): URL | null {
  if (URL.canParse(address)) {
    const absoluteUrl = new URL(address);
    return absoluteUrl;
  }
  if (URL.canParse(address, tileSource)) {
    const resolvedUrl = new URL(address, tileSource);
    return resolvedUrl;
  }
  return null;
}

export function isWebUrl(url: URL): boolean {
  const isWeb = WEB_PROTOCOLS.has(url.protocol);
  return isWeb;
}

/** A property of an element as text, or `null` when it is missing or not a string or number. */
export function readTextProperty(
  element: Element,
  name: string,
): string | null {
  const value = element.properties[name];
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    const text = String(value);
    return text;
  }
  return null;
}
