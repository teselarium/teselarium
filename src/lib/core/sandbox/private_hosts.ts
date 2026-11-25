/** Name suffixes that only resolve on the user's computer or network. */
const PRIVATE_NAME_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home.arpa",
];

/** IPv4 ranges on the user's computer or network, as `[first address, prefix length]`. */
const PRIVATE_ADDRESS_RANGES: [string, number][] = [
  ["0.0.0.0", 8],
  ["127.0.0.0", 8],
  ["10.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["169.254.0.0", 16],
  ["100.64.0.0", 10],
];

const DOTTED_QUAD = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const ADDRESS_BITS = 32;

function dropTrailingDot(hostname: string): string {
  if (hostname.endsWith(".")) {
    const name = hostname.slice(0, -1);
    return name;
  }
  return hostname;
}

function isPrivateName(name: string): boolean {
  if (name === "localhost" || !name.includes(".")) {
    return true;
  }
  for (const suffix of PRIVATE_NAME_SUFFIXES) {
    if (name.endsWith(suffix)) {
      return true;
    }
  }
  return false;
}

/** The address as one number, or `null` when it is not a dotted-quad IPv4 address. */
function readAddressNumber(name: string): number | null {
  const match = DOTTED_QUAD.exec(name);
  if (match === null) {
    return null;
  }
  let addressNumber = 0;
  for (const part of match.slice(1)) {
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    addressNumber = addressNumber * 256 + octet;
  }
  return addressNumber;
}

function rangeContains(
  range: [string, number],
  addressNumber: number,
): boolean {
  const [firstAddress, prefixLength] = range;
  const firstNumber = readAddressNumber(firstAddress) ?? 0;
  const rangeSize = 2 ** (ADDRESS_BITS - prefixLength);
  const isInRange =
    Math.floor(addressNumber / rangeSize) ===
    Math.floor(firstNumber / rangeSize);
  return isInRange;
}

function isPrivateAddress(addressNumber: number): boolean {
  for (const range of PRIVATE_ADDRESS_RANGES) {
    if (rangeContains(range, addressNumber)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a host is on the user's computer or network: `localhost`, a name
 * without a dot, a local name suffix, or a loopback, private, link-local or
 * shared IPv4 address. Expects `URL.hostname`, whose parser has already turned
 * other forms of an IPv4 address, such as `2130706433`, into a dotted quad.
 */
export function isPrivateHost(hostname: string): boolean {
  const name = dropTrailingDot(hostname);
  const addressNumber = readAddressNumber(name);
  if (addressNumber !== null) {
    return isPrivateAddress(addressNumber);
  }
  return isPrivateName(name);
}

/** A tile served over `http:` or `https:` from the user's computer or network; a picked `file:` tile is not. */
function isPrivateTileSource(tileSource: string): boolean {
  if (!URL.canParse(tileSource)) {
    return false;
  }
  const url = new URL(tileSource);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  return isPrivateHost(url.hostname);
}

/**
 * Whether the private network guard leaves out a tile's link: its host is on
 * the user's computer or network, and the tile was not itself loaded over
 * `http:` or `https:` from such a host.
 */
export function isGuardedLink(url: URL, tileSource: string): boolean {
  const isGuarded =
    isPrivateHost(url.hostname) && !isPrivateTileSource(tileSource);
  return isGuarded;
}
