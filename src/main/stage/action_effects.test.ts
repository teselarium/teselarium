import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { SaveFileAction } from "../../lib/core/stage/index.ts";
import {
  downloadFile,
  formatFileSize,
  openLinkInNewTab,
} from "./action_effects.ts";

const OBJECT_URL = "blob:https://example.org/1";

/** What the temporary link looked like when it was clicked. */
interface ClickedLink {
  href: string;
  download: string;
  isInDocument: boolean;
}

interface DownloadSpies {
  createObjectURL: Mock<(blob: Blob) => string>;
  revokeObjectURL: Mock<(url: string) => void>;
  clickedLinks: ClickedLink[];
}

let spies: DownloadSpies;

function recordClick(
  clickedLinks: ClickedLink[],
  link: HTMLAnchorElement,
): void {
  clickedLinks.push({
    href: link.href,
    download: link.download,
    isInDocument: link.isConnected,
  });
}

function recordLinkClick(this: HTMLAnchorElement): void {
  recordClick(spies.clickedLinks, this);
}

beforeEach(function stubDownloads(): void {
  spies = {
    createObjectURL: vi.fn<(blob: Blob) => string>(),
    revokeObjectURL: vi.fn<(url: string) => void>(),
    clickedLinks: [],
  };
  spies.createObjectURL.mockReturnValue(OBJECT_URL);
  // jsdom has no object URLs, and following a link would log "not implemented".
  URL.createObjectURL = spies.createObjectURL;
  URL.revokeObjectURL = spies.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    recordLinkClick,
  );
});

afterEach(function restoreDownloads(): void {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("openLinkInNewTab", function describeOpenLinkInNewTab(): void {
  it("opens the address with noopener and noreferrer", function opensTab(): void {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    openLinkInNewTab("https://example.org/books?id=1");

    expect(openSpy).toHaveBeenCalledExactlyOnceWith(
      "https://example.org/books?id=1",
      "_blank",
      "noopener,noreferrer",
    );
  });
});

describe("downloadFile", function describeDownloadFile(): void {
  const action: SaveFileAction = {
    kind: "save",
    name: "books.csv",
    type: "text/csv",
    bytes: new TextEncoder().encode("title\nKallocain\n"),
  };

  it("downloads a Blob with the bytes and the type through a temporary link", async function downloads(): Promise<void> {
    downloadFile(action);

    expect(spies.createObjectURL).toHaveBeenCalledOnce();
    const blob = spies.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("text/csv");
    // Compared as lists: jsdom's typed arrays come from another realm than Node's.
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual(
      Array.from(action.bytes),
    );
    expect(spies.clickedLinks).toEqual([
      { href: OBJECT_URL, download: "books.csv", isInDocument: true },
    ]);
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("revokes the object URL on the next task", function revokesUrl(): void {
    vi.useFakeTimers();

    downloadFile(action);

    expect(spies.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(spies.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(OBJECT_URL);
  });
});

describe("formatFileSize", function describeFormatFileSize(): void {
  it("shows bytes under 1 KB", function showsBytes(): void {
    expect(formatFileSize(0)).toBe("0 bytes");
    expect(formatFileSize(1)).toBe("1 byte");
    expect(formatFileSize(512)).toBe("512 bytes");
    expect(formatFileSize(1023)).toBe("1023 bytes");
  });

  it("shows KB with at most one decimal", function showsKilobytes(): void {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1100)).toBe("1.1 KB");
  });

  it("shows MB with at most one decimal", function showsMegabytes(): void {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatFileSize(20 * 1024 * 1024)).toBe("20 MB");
    expect(formatFileSize(1024 * 1024 - 1)).toBe("1 MB");
  });
});
