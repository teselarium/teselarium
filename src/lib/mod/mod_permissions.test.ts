import { describe, expect, it } from "vitest";
import type { YamlValue } from "../files/index.ts";
import { ModFormatError } from "./mod_errors.ts";
import { readModPermissions } from "./mod_permissions.ts";
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

  it("Wildcard host", function rejectsWildcard(): void {
    const error = catchPermissionsError({
      show: [buildEntry("https://*.example.org")],
    });

    expect(error.message).toContain('host "https://*.example.org"');
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
