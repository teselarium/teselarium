import { describe, expect, it } from "vitest";
import type { ModFile, ModPermission } from "../../mod/index.ts";
import type { ModGrants } from "../permissions/index.ts";
import { describeBlockedRequest } from "./index.ts";
import type { BlockedRequest } from "./index.ts";

const MOD_SOURCE = "https://mods.example.net/probe/mod_conf.yaml";
const MOD: Pick<ModFile, "source"> = { source: MOD_SOURCE };
const NO_GRANTS: ModGrants = { granted: [], denied: [] };
const COVERS_PERMISSION: ModPermission = {
  category: "show",
  host: "https://upload.wikimedia.org",
  reason: "Shows the book covers",
};

function describeBlock(
  blockedUrl: string,
  directive: string,
  grants: ModGrants,
): string {
  const blocked: BlockedRequest = { blockedUrl, directive };
  const issue = describeBlockedRequest(blocked, MOD, grants);
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
});
