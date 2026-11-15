import { isImageAddress } from "./metadata_addresses.ts";

/** Hides a thumbnail that failed to load, so no broken image shows; the link stays. */
function hideThumbnail(event: Event): void {
  const thumbnail = event.currentTarget as HTMLImageElement;
  thumbnail.hidden = true;
}

/** A small image of an address, loaded lazily, decorative since the link's text names it. */
function buildThumbnail(address: string): HTMLImageElement {
  const thumbnail = document.createElement("img");
  thumbnail.loading = "lazy";
  thumbnail.decoding = "async";
  thumbnail.alt = "";
  thumbnail.addEventListener("error", hideThumbnail);
  thumbnail.src = address;
  return thumbnail;
}

/**
 * A web address of the metadata as a link with `data-ot-link`, so the frame
 * loader asks the user before opening it, as for a link of a body. An image
 * address also shows its thumbnail, before the address.
 */
export function buildMetadataLink(address: string): HTMLElement {
  const link = document.createElement("a");
  link.href = address;
  link.dataset.otLink = "";
  if (isImageAddress(address)) {
    link.append(buildThumbnail(address));
  }
  link.append(address);
  return link;
}
