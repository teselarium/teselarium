import { describe, expect, it } from "vitest";
import type { YamlValue } from "../files/index.ts";
import { ModFormatError } from "./mod_errors.ts";
import { permissionHostCovers, readModPermissions } from "./mod_permissions.ts";
import type { ModPermission } from "./mod_permissions.ts";

const MOD_SOURCE = "https://example.org/mods/probe/mod_conf.yaml";

function catchPermissionsError(value: YamlValue | undefined): ModFormatError {
  try {
    readModPermissions(value, MOD_SOURCE);
  } catch (error) {
    if (error instanceof ModFormatError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected the permissions to be rejected, but they passed");
}

function buildEntry(host: string): YamlValue {
  const entry: YamlValue = { host, reason: "Test reason" };
  return entry;
}

describe("readModPermissions", function describeReadModPermissions(): void {
  it("gives no permissions when absent", function readsAbsent(): void {
    const permissions = readModPermissions(undefined, MOD_SOURCE);

    expect(permissions).toEqual([]);
  });

  it("Sample show permission", function readsSamplePermission(): void {
    const permissions = readModPermissions(
      {
        show: [
          {
            host: "https://upload.wikimedia.org",
            reason: "Shows the book covers",
          },
        ],
      },
      MOD_SOURCE,
    );

    const expected: ModPermission[] = [
      {
        category: "show",
        host: "https://upload.wikimedia.org",
        reason: "Shows the book covers",
      },
    ];
    expect(permissions).toEqual(expected);
  });

  it("rejects permissions that are not a mapping", function rejectsList(): void {
    const error = catchPermissionsError([]);

    expect(error.source).toBe(MOD_SOURCE);
    expect(error.message).toContain('"permissions" must be a mapping');
  });

  it("Unknown category", function rejectsUnknownCategory(): void {
    const error = catchPermissionsError({ shows: [] });

    expect(error.message).toContain(
      '"permissions.shows" is not a permission category, use one of: show, connect, embed, code, open',
    );
  });

  it("rejects a category that is not a list", function rejectsCategoryMapping(): void {
    const error = catchPermissionsError({ show: { host: "x" } });

    expect(error.message).toContain('"permissions.show" must be a list');
  });

  it("rejects an entry that is not a mapping", function rejectsEntryString(): void {
    const error = catchPermissionsError({ show: ["https://example.org"] });

    expect(error.message).toContain(
      '"permissions.show" entry 1 must be a mapping',
    );
  });

  it("Missing reason", function rejectsMissingReason(): void {
    const error = catchPermissionsError({
      connect: [
        buildEntry("https://api.example.net"),
        { host: "https://x.net" },
      ],
    });

    expect(error.message).toContain(
      '"permissions.connect" entry 2: "reason" must be a non-empty string',
    );
  });

  it("rejects a missing host", function rejectsMissingHost(): void {
    const error = catchPermissionsError({ embed: [{ reason: "Maps" }] });

    expect(error.message).toContain(
      '"permissions.embed" entry 1: "host" must be a non-empty string',
    );
  });

  it("Several categories keep their order", function keepsCategoryOrder(): void {
    const permissions = readModPermissions(
      {
        open: [buildEntry("*")],
        code: [buildEntry("https://cdn.example.net")],
        show: [
          buildEntry("https://images.example.net"),
          buildEntry("https://upload.wikimedia.org"),
        ],
      },
      MOD_SOURCE,
    );

    const categoriesAndHosts: string[] = [];
    for (const permission of permissions) {
      categoriesAndHosts.push(`${permission.category} ${permission.host}`);
    }
    expect(categoriesAndHosts).toEqual([
      "show https://images.example.net",
      "show https://upload.wikimedia.org",
      "code https://cdn.example.net",
      "open *",
    ]);
  });

  it("Host with a port", function keepsPort(): void {
    const permissions = readModPermissions(
      { connect: [buildEntry("http://localhost:8080")] },
      MOD_SOURCE,
    );

    expect(permissions[0].host).toBe("http://localhost:8080");
  });

  it("Host with a path", function rejectsPath(): void {
    const error = catchPermissionsError({
      show: [buildEntry("https://example.org/images")],
    });

    expect(error.message).toContain(
      '"permissions.show" entry 1: host "https://example.org/images" must be an origin such as "https://example.org"',
    );
  });

  it("Wildcard host", function acceptsWildcard(): void {
    const permissions = readModPermissions(
      { show: [buildEntry("https://*.us.archive.org")] },
      MOD_SOURCE,
    );

    expect(permissions[0].host).toBe("https://*.us.archive.org");
  });

  it("Wildcard host with a port", function acceptsWildcardWithPort(): void {
    const permissions = readModPermissions(
      { connect: [buildEntry("http://*.example.test:8080")] },
      MOD_SOURCE,
    );

    expect(permissions[0].host).toBe("http://*.example.test:8080");
  });

  it("Wildcard inside a label", function rejectsWildcardInsideLabel(): void {
    const error = catchPermissionsError({
      show: [buildEntry("https://cdn*.example.org")],
    });

    expect(error.message).toContain(
      '"permissions.show" entry 1: host "https://cdn*.example.org" must be an origin such as "https://example.org", or a wildcard host such as "https://*.example.org"',
    );
  });

  it("Wildcard after the first label", function rejectsWildcardAfterFirstLabel(): void {
    const error = catchPermissionsError({
      show: [buildEntry("https://a.*.example.org")],
    });

    expect(error.message).toContain('host "https://a.*.example.org"');
  });

  it("Wildcard over a single label", function rejectsWildcardOverSingleLabel(): void {
    const error = catchPermissionsError({
      code: [buildEntry("https://*.org")],
    });

    expect(error.message).toContain('host "https://*.org"');
  });

  it("rejects a wildcard over an IP address", function rejectsWildcardOverIp(): void {
    const error = catchPermissionsError({
      show: [buildEntry("https://*.1.2.3.4")],
    });

    expect(error.message).toContain('host "https://*.1.2.3.4"');
  });

  it("Wildcard host in open", function rejectsWildcardInOpen(): void {
    const error = catchPermissionsError({
      open: [buildEntry("https://*.example.org")],
    });

    expect(error.message).toContain(
      '"permissions.open" entry 1: host "https://*.example.org": wildcard hosts are not allowed in permissions.open',
    );
  });

  it("rejects a wildcard host with a path", function rejectsWildcardWithPath(): void {
    const error = catchPermissionsError({
      show: [buildEntry("https://*.example.org/images")],
    });

    expect(error.message).toContain('host "https://*.example.org/images"');
  });

  it("rejects a wildcard host with another scheme", function rejectsWildcardOtherScheme(): void {
    const error = catchPermissionsError({
      connect: [buildEntry("wss://*.example.org")],
    });

    expect(error.message).toContain('host "wss://*.example.org"');
  });

  it("Other scheme", function rejectsOtherScheme(): void {
    const error = catchPermissionsError({
      connect: [buildEntry("wss://example.org")],
    });

    expect(error.message).toContain('host "wss://example.org"');
  });

  it("rejects a trailing slash", function rejectsTrailingSlash(): void {
    const error = catchPermissionsError({
      show: [buildEntry("https://example.org/")],
    });

    expect(error.message).toContain('host "https://example.org/"');
  });

  it("rejects user info", function rejectsUserInfo(): void {
    const error = catchPermissionsError({
      show: [buildEntry("https://user@example.org")],
    });

    expect(error.message).toContain('host "https://user@example.org"');
  });

  it("rejects a value that is not a URL", function rejectsNotUrl(): void {
    const error = catchPermissionsError({
      show: [buildEntry("upload.wikimedia.org")],
    });

    expect(error.message).toContain('host "upload.wikimedia.org"');
  });

  it("Any site for open", function acceptsAnySiteInOpen(): void {
    const permissions = readModPermissions(
      { open: [buildEntry("*")] },
      MOD_SOURCE,
    );

    expect(permissions[0].host).toBe("*");
  });

  it("Any site outside open", function rejectsAnySiteInShow(): void {
    const error = catchPermissionsError({ show: [buildEntry("*")] });

    expect(error.message).toContain(
      '"permissions.show" entry 1: host "*" is only allowed in permissions.open',
    );
  });
});

describe("permissionHostCovers", function describePermissionHostCovers(): void {
  it("an exact host covers only itself", function coversExactHost(): void {
    expect(
      permissionHostCovers(
        "https://upload.wikimedia.org",
        "https://upload.wikimedia.org",
      ),
    ).toBe(true);
    expect(
      permissionHostCovers(
        "https://upload.wikimedia.org",
        "https://a.upload.wikimedia.org",
      ),
    ).toBe(false);
  });

  it("a wildcard host covers its subdomains at any depth", function coversSubdomains(): void {
    expect(
      permissionHostCovers(
        "https://*.us.archive.org",
        "https://ia800100.us.archive.org",
      ),
    ).toBe(true);
    expect(
      permissionHostCovers(
        "https://*.us.archive.org",
        "https://a.b.us.archive.org",
      ),
    ).toBe(true);
  });

  it("a wildcard host does not cover its own host name", function skipsOwnHostName(): void {
    expect(
      permissionHostCovers(
        "https://*.us.archive.org",
        "https://us.archive.org",
      ),
    ).toBe(false);
  });

  it("a wildcard host does not cover a host name that only ends the same", function skipsSameEnding(): void {
    expect(
      permissionHostCovers(
        "https://*.us.archive.org",
        "https://evil-us.archive.org",
      ),
    ).toBe(false);
  });

  it("a wildcard host does not cover another scheme", function skipsOtherScheme(): void {
    expect(
      permissionHostCovers(
        "https://*.us.archive.org",
        "http://ia800100.us.archive.org",
      ),
    ).toBe(false);
  });

  it("a wildcard host does not cover another port", function skipsOtherPort(): void {
    expect(
      permissionHostCovers(
        "https://*.us.archive.org",
        "https://ia800100.us.archive.org:8443",
      ),
    ).toBe(false);
  });

  it("a wildcard host with a port covers only that port", function coversOwnPort(): void {
    expect(
      permissionHostCovers(
        "http://*.example.test:8080",
        "http://a.example.test:8080",
      ),
    ).toBe(true);
    expect(
      permissionHostCovers(
        "http://*.example.test:8080",
        "http://a.example.test",
      ),
    ).toBe(false);
  });
});
