import type { Element, Root } from "hast";
import {
  isWebUrl,
  readTextProperty,
  resolveBodyAddress,
} from "./body_addresses.ts";

interface FinishingPassState {
  tileSource: string;
  mediaUrls: Set<string>;
}

/** A media address resolved against the tile and collected, or `null` when it is not `http:` or `https:`. */
function finishMediaAddress(
  address: string,
  state: FinishingPassState,
): string | null {
  const url = resolveBodyAddress(address, state.tileSource);
  if (url === null || !isWebUrl(url)) {
    return null;
  }
  state.mediaUrls.add(url.href);
  return url.href;
}

function finishMediaProperty(
  element: Element,
  name: string,
  state: FinishingPassState,
): void {
  const address = readTextProperty(element, name);
  if (address === null) {
    return;
  }
  const finishedAddress = finishMediaAddress(address, state);
  if (finishedAddress === null) {
    delete element.properties[name];
    return;
  }
  element.properties[name] = finishedAddress;
}

/** One image candidate of a `srcset`: its address and its descriptor, such as `2x`, or `""`. */
interface SrcsetCandidate {
  address: string;
  descriptor: string;
}

/** An address after optional whitespace and commas. */
const CANDIDATE_ADDRESS = /[\s,]*(\S+)/y;

/** A descriptor, up to the comma that ends the candidate. */
const CANDIDATE_DESCRIPTOR = /([^,]*),?/y;

/**
 * The candidates of a `srcset`, read as browsers do: an address ending with
 * `,` ends its candidate, otherwise the descriptor runs to the next `,`. So
 * an address with commas inside it stays whole.
 */
function readSrcsetCandidates(srcset: string): SrcsetCandidate[] {
  const candidates: SrcsetCandidate[] = [];
  CANDIDATE_ADDRESS.lastIndex = 0;
  let addressMatch = CANDIDATE_ADDRESS.exec(srcset);
  while (addressMatch !== null) {
    const written = addressMatch[1];
    const isEnded = written.endsWith(",");
    CANDIDATE_DESCRIPTOR.lastIndex = CANDIDATE_ADDRESS.lastIndex;
    const descriptorMatch = isEnded ? null : CANDIDATE_DESCRIPTOR.exec(srcset);
    candidates.push({
      address: written.replace(/,+$/, ""),
      descriptor: descriptorMatch?.[1].trim() ?? "",
    });
    CANDIDATE_ADDRESS.lastIndex =
      descriptorMatch === null
        ? CANDIDATE_ADDRESS.lastIndex
        : CANDIDATE_DESCRIPTOR.lastIndex;
    addressMatch = CANDIDATE_ADDRESS.exec(srcset);
  }
  return candidates;
}

/** A candidate written back with its address resolved, or `null` to drop it. */
function finishSrcsetCandidate(
  candidate: SrcsetCandidate,
  state: FinishingPassState,
): string | null {
  const finishedAddress = finishMediaAddress(candidate.address, state);
  if (finishedAddress === null) {
    return null;
  }
  const finishedCandidate =
    candidate.descriptor === ""
      ? finishedAddress
      : `${finishedAddress} ${candidate.descriptor}`;
  return finishedCandidate;
}

function finishSrcset(element: Element, state: FinishingPassState): void {
  const srcset = readTextProperty(element, "srcSet");
  if (srcset === null) {
    return;
  }
  const finishedCandidates: string[] = [];
  for (const candidate of readSrcsetCandidates(srcset)) {
    const finishedCandidate = finishSrcsetCandidate(candidate, state);
    if (finishedCandidate !== null) {
      finishedCandidates.push(finishedCandidate);
    }
  }
  element.properties.srcSet = finishedCandidates.join(", ");
}

/** A link to a fragment is kept and marked; any other is resolved, and marked when it is a web address. */
function finishLink(link: Element, tileSource: string): void {
  const href = readTextProperty(link, "href");
  if (href === null) {
    return;
  }
  if (href.startsWith("#")) {
    link.properties.dataOtFragment = "";
    return;
  }
  const url = resolveBodyAddress(href, tileSource);
  if (url === null) {
    return;
  }
  link.properties.href = url.href;
  if (isWebUrl(url)) {
    link.properties.dataOtLink = "";
  }
}

function finishImage(image: Element, state: FinishingPassState): void {
  finishMediaProperty(image, "src", state);
  image.properties.loading = "lazy";
  image.properties.decoding = "async";
}

function finishPlayback(media: Element, state: FinishingPassState): void {
  finishMediaProperty(media, "src", state);
  finishMediaProperty(media, "poster", state);
  delete media.properties.autoPlay;
  media.properties.controls = true;
  media.properties.preload = "metadata";
}

function finishSource(source: Element, state: FinishingPassState): void {
  finishMediaProperty(source, "src", state);
  finishSrcset(source, state);
}

function finishElement(element: Element, state: FinishingPassState): void {
  switch (element.tagName) {
    case "a":
      finishLink(element, state.tileSource);
      break;
    case "img":
      finishImage(element, state);
      break;
    case "video":
    case "audio":
      finishPlayback(element, state);
      break;
    case "source":
      finishSource(element, state);
      break;
  }
}

function finishElementsIn(
  parent: Root | Element,
  state: FinishingPassState,
): void {
  for (const child of parent.children) {
    if (child.type === "element") {
      finishElement(child, state);
      finishElementsIn(child, state);
    }
  }
}

/**
 * The finishing pass, after sanitizing: resolves `src`, `poster`, each
 * `srcset` candidate and `href` against the tile; marks links to `#…` with
 * `data-ot-fragment` and `http:`/`https:` links with `data-ot-link`; loads
 * images lazily; forces `controls` and `preload="metadata"` on video and
 * audio, without `autoplay`. Media addresses that are not `http:` or
 * `https:` once resolved are dropped. Changes the tree in place, and returns
 * the media addresses in document order, without duplicates.
 */
export function finishBody(tree: Root, tileSource: string): string[] {
  const state: FinishingPassState = { tileSource, mediaUrls: new Set() };
  finishElementsIn(tree, state);
  const mediaUrls = [...state.mediaUrls];
  return mediaUrls;
}
