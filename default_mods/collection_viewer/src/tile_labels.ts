// Pure: tile addresses in, list labels out. A tile is labeled by the file
// name of its address, decoded. Tiles that share a file name are labeled by
// their parent folder and file name. Labels that still clash are kept: the
// full address shown under each one tells them apart.

/** The path segments of an address, still encoded, without empty ones. */
function readPathSegments(address: string): string[] {
  const path = URL.canParse(address) ? new URL(address).pathname : address;
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment !== "") {
      segments.push(segment);
    }
  }
  return segments;
}

/** A path segment decoded, or as it is when it is not valid percent-encoding. */
function decodeSegment(segment: string): string {
  try {
    const decoded = decodeURIComponent(segment);
    return decoded;
  } catch {
    return segment;
  }
}

/** The last `count` segments of the address, decoded and joined with `/`, or the address without segments. */
function buildLabel(address: string, count: number): string {
  const segments = readPathSegments(address);
  if (segments.length === 0) {
    return address;
  }
  const decodedSegments: string[] = [];
  for (const segment of segments.slice(-count)) {
    decodedSegments.push(decodeSegment(segment));
  }
  const label = decodedSegments.join("/");
  return label;
}

function countLabels(labels: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}

/** The label of each address, in the same order. */
export function labelTiles(addresses: string[]): string[] {
  const fileNames: string[] = [];
  for (const address of addresses) {
    fileNames.push(buildLabel(address, 1));
  }
  const counts = countLabels(fileNames);
  const labels: string[] = [];
  for (const [index, address] of addresses.entries()) {
    const isShared = (counts.get(fileNames[index]) ?? 0) > 1;
    labels.push(isShared ? buildLabel(address, 2) : fileNames[index]);
  }
  return labels;
}
