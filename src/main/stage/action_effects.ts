import type { SaveFileAction } from "../../lib/core/stage/index.ts";

const KILOBYTE = 1024;

/**
 * Opens a web address in a new tab. Without `opener` and `Referer`, the tab
 * cannot reach the app's page. Call it from a click on the app's own page:
 * a browser blocks a tab opened without user activation.
 */
export function openLinkInNewTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Downloads the file through a temporary `<a download>` link. Call it from a
 * click on the app's own page, like `openLinkInNewTab`.
 */
export function downloadFile(action: SaveFileAction): void {
  const blob = new Blob([action.bytes], { type: action.type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = action.name;
  document.body.append(link);
  link.click();
  link.remove();
  // The download starts from the click; revoking right away can cancel it in some browsers.
  setTimeout(URL.revokeObjectURL, 0, url);
}

/** Rounds to at most one decimal, so `2.0` shows as `2`. */
function formatUnits(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${unit}`;
}

/** A file size for the save dialog: bytes under 1 KB, else KB or MB with at most one decimal. */
export function formatFileSize(byteCount: number): string {
  if (byteCount === 1) {
    return "1 byte";
  }
  if (byteCount < KILOBYTE) {
    return `${byteCount} bytes`;
  }
  const kilobytes = byteCount / KILOBYTE;
  if (Math.round(kilobytes * 10) / 10 < KILOBYTE) {
    return formatUnits(kilobytes, "KB");
  }
  return formatUnits(kilobytes / KILOBYTE, "MB");
}
