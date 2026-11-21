/** The protocols a detail's Copy and Open controls accept. */
const WEB_PROTOCOLS: readonly string[] = Object.freeze(["http:", "https:"]);

/**
 * Whether a list detail's value is a web address, an absolute `http:` or
 * `https:` URL, which gets Copy and Open controls. Any other value, such as
 * a local file, a `javascript:` link, a version or "None", gets none.
 */
export function isWebAddress(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }
  const isWeb = WEB_PROTOCOLS.includes(new URL(value).protocol);
  return isWeb;
}
