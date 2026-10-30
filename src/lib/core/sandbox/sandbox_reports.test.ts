import { describe, expect, it } from "vitest";
import type { ModFile, ModPermission } from "../../mod/index.ts";
import type { ModGrants } from "../permissions/index.ts";
import {
  describeBlockedDialog,
  describeBlockedRequest,
  describeNewTileLinks,
} from "./index.ts";
import type { BlockedRequest } from "./index.ts";

const MOD_SOURCE = "https://mods.example.net/probe/mod_conf.yaml";
const MOD: Pick<ModFile, "source"> = { source: MOD_SOURCE };
const NO_GRANTS: ModGrants = { granted: [], denied: [] };
const COVERS_PERMISSION: ModPermission = {
  category: "show",
  host: "https://upload.wikimedia.org",
  reason: "Shows the book covers",
};
const COLLECTION_SOURCE = "https://tiles.example.net/books/collection.yaml";
const REDIRECT_HINT =
  "If a tile links this file, link its final address: links that redirect to another site are blocked.";
const ARCHIVE_PERMISSION: ModPermission = {
  category: "show",
  host: "https://*.us.archive.org",
  reason: "Shows the covers stored by the Internet Archive",
};

function describeBlock(
  blockedUrl: string,
  directive: string,
  grants: ModGrants,
  hintsTileLinks = false,
): string {
  const blocked: BlockedRequest = { blockedUrl, directive };
  const issue = describeBlockedRequest(blocked, MOD, grants, hintsTileLinks);
  return issue.message;
}

describe("describeBlockedRequest", function describeDescribeBlocked(): void {
  it("Undeclared image host", function describesUndeclaredImage(): void {
    const issue = describeBlockedRequest(
      {
        blockedUrl: "https://images.example.net/cover.jpg",
        directive: "img-src",
      },
      MOD,
      NO_GRANTS,
      false,
    );

    expect(issue).toEqual({
      level: "warning",
      source: MOD_SOURCE,
      message:
        "Blocked image request to https://images.example.net. Add it to permissions.show in mod_conf.yaml.",
    });
  });

  it("Undeclared connection", function describesUndeclaredConnection(): void {
    const message = describeBlock(
      "https://api.example.net/data",
      "connect-src",
      NO_GRANTS,
    );

    expect(message).toBe(
      "Blocked connection request to https://api.example.net. Add it to permissions.connect in mod_conf.yaml.",
    );
  });

  it("Declared but not granted", function describesDenied(): void {
    const message = describeBlock(
      "https://upload.wikimedia.org/cover.jpg",
      "img-src",
      { granted: [], denied: [COVERS_PERMISSION] },
    );

    expect(message).toBe(
      "Blocked image request to https://upload.wikimedia.org: the mod declares it in permissions.show, but the permission was not granted.",
    );
  });

  it("maps each directive to its category", function mapsDirectives(): void {
    const directiveCategories: Record<string, string> = {
      "img-src": "show",
      "media-src": "show",
      "font-src": "show",
      "style-src": "show",
      "style-src-elem": "show",
      "style-src-attr": "show",
      "connect-src": "connect",
      "frame-src": "embed",
      "child-src": "embed",
      "script-src": "code",
      "script-src-elem": "code",
      "script-src-attr": "code",
      "worker-src": "code",
    };

    for (const [directive, category] of Object.entries(directiveCategories)) {
      const message = describeBlock(
        "https://cdn.example.net/file",
        directive,
        NO_GRANTS,
      );
      expect(message).toContain(`Add it to permissions.${category} `);
    }
  });

  it("names the request after the directive", function namesRequests(): void {
    const directiveNouns: Record<string, string> = {
      "media-src": "media",
      "font-src": "font",
      "style-src-elem": "stylesheet",
      "frame-src": "embedded page",
      "script-src-elem": "script",
      "worker-src": "worker",
    };

    for (const [directive, noun] of Object.entries(directiveNouns)) {
      const message = describeBlock(
        "https://cdn.example.net/file",
        directive,
        NO_GRANTS,
      );
      expect(message).toMatch(new RegExp(`^Blocked ${noun} request to `));
    }
  });

  it("Request blocked by another rule", function describesObjectSrc(): void {
    const message = describeBlock(
      "https://example.org/file.pdf",
      "object-src",
      NO_GRANTS,
    );

    expect(message).toBe("Blocked by the sandbox policy (object-src).");
  });

  it("gives the policy text for a blocked URL that is not a URL", function describesInline(): void {
    const message = describeBlock("inline", "script-src-elem", NO_GRANTS);

    expect(message).toBe("Blocked by the sandbox policy (script-src-elem).");
  });

  it("reduces a full URL to its origin", function reducesToOrigin(): void {
    const message = describeBlock(
      "https://images.example.net:8443/a/b/cover.jpg?size=large#top",
      "img-src",
      NO_GRANTS,
    );

    expect(message).toContain("to https://images.example.net:8443.");
  });

  it("gives the policy text for a subdomain of a granted wildcard host", function describesGrantedWildcard(): void {
    const message = describeBlock(
      "https://ia800100.us.archive.org/cover.jpg",
      "img-src",
      { granted: [ARCHIVE_PERMISSION], denied: [] },
    );

    expect(message).toBe("Blocked by the sandbox policy (img-src).");
  });

  it("Wildcard host declared but not granted", function describesDeniedWildcard(): void {
    const message = describeBlock(
      "https://ia800100.us.archive.org/cover.jpg",
      "img-src",
      { granted: [], denied: [ARCHIVE_PERMISSION] },
    );

    expect(message).toBe(
      "Blocked image request to https://ia800100.us.archive.org: the mod declares it in permissions.show, but the permission was not granted.",
    );
  });

  it("The wildcard's own host name is not covered", function describesWildcardOwnHost(): void {
    const message = describeBlock(
      "https://us.archive.org/cover.jpg",
      "img-src",
      { granted: [ARCHIVE_PERMISSION], denied: [] },
    );

    expect(message).toBe(
      "Blocked image request to https://us.archive.org. Add it to permissions.show in mod_conf.yaml.",
    );
  });
});

describe("Redirect hint for tile authors", function describeRedirectHint(): void {
  it("Tile link that redirects", function hintsImageRedirect(): void {
    const message = describeBlock(
      "https://cdn.example.org/cover.jpg",
      "img-src",
      NO_GRANTS,
      true,
    );

    expect(message).toBe(
      `Blocked image request to https://cdn.example.org. Add it to permissions.show in mod_conf.yaml. ${REDIRECT_HINT}`,
    );
  });

  it("hints a blocked media request", function hintsMediaRedirect(): void {
    const message = describeBlock(
      "https://cdn.example.org/theme.mp3",
      "media-src",
      NO_GRANTS,
      true,
    );

    expect(message).toBe(
      `Blocked media request to https://cdn.example.org. Add it to permissions.show in mod_conf.yaml. ${REDIRECT_HINT}`,
    );
  });

  it("No hint for other categories", function omitsHintForOtherDirectives(): void {
    const directives = [
      "connect-src",
      "font-src",
      "style-src",
      "frame-src",
      "script-src",
    ];

    const hintedDirectives: string[] = [];
    for (const directive of directives) {
      const message = describeBlock(
        "https://api.example.net/data",
        directive,
        NO_GRANTS,
        true,
      );
      if (message.includes(REDIRECT_HINT)) {
        hintedDirectives.push(directive);
      }
    }
    expect(hintedDirectives).toEqual([]);
  });

  it("No hint with the setting off", function omitsHintWithSettingOff(): void {
    const message = describeBlock(
      "https://images.example.net/cover.jpg",
      "img-src",
      NO_GRANTS,
      false,
    );

    expect(message).toBe(
      "Blocked image request to https://images.example.net. Add it to permissions.show in mod_conf.yaml.",
    );
  });

  it("gives no hint for a declared permission that was not granted", function omitsHintForDenied(): void {
    const message = describeBlock(
      "https://upload.wikimedia.org/cover.jpg",
      "img-src",
      { granted: [], denied: [COVERS_PERMISSION] },
      true,
    );

    expect(message).toBe(
      "Blocked image request to https://upload.wikimedia.org: the mod declares it in permissions.show, but the permission was not granted.",
    );
  });
});

describe("describeNewTileLinks", function describeDescribeNewTileLinks(): void {
  it("names one file", function describesOneFile(): void {
    expect(describeNewTileLinks(1, COLLECTION_SOURCE)).toEqual({
      level: "warning",
      source: COLLECTION_SOURCE,
      message:
        "The reloaded tiles link 1 file that this mod does not allow yet. Open the mod again to show it.",
    });
  });

  it("counts several files", function describesSeveralFiles(): void {
    expect(describeNewTileLinks(3, COLLECTION_SOURCE).message).toBe(
      "The reloaded tiles link 3 files that this mod does not allow yet. Open the mod again to show them.",
    );
  });
});

describe("describeBlockedDialog", function describeDescribeBlockedDialog(): void {
  it("Confirm", function describesConfirm(): void {
    expect(describeBlockedDialog("confirm", MOD)).toEqual({
      level: "warning",
      source: MOD_SOURCE,
      message:
        'confirm() is not available in mods and always returns false. Use a <dialog> element, or request "ui.confirm" for a confirmation shown by the app.',
    });
  });

  it("names each function and what to use instead", function describesEach(): void {
    expect(describeBlockedDialog("alert", MOD).message).toBe(
      "alert() is not available in mods. Show the message in the page or in a <dialog> element.",
    );
    expect(describeBlockedDialog("prompt", MOD).message).toBe(
      "prompt() is not available in mods and always returns null. Use an <input> in a <dialog> element.",
    );
    expect(describeBlockedDialog("print", MOD).message).toBe(
      "print() is not available in mods.",
    );
  });
});
