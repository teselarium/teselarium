import { describe, expect, it } from "vitest";
import type { ModPermission } from "../../mod/index.ts";
import * as permissionsModule from "./index.ts";
import {
  checkOpenGrant,
  describeDeniedPermission,
  grantModPermissions,
} from "./index.ts";
import type { ModGrants } from "./index.ts";

const APP_ORIGIN = "https://example.org";
const SAMPLE_MOD = {
  source: "https://example.org/samples/mods/book_list/mod_conf.yaml",
  permissions: [
    {
      category: "show",
      host: "https://upload.wikimedia.org",
      reason: "Shows the book covers",
    },
    { category: "open", host: "*", reason: "Opens the mods you pick" },
  ] satisfies ModPermission[],
};
const FOREIGN_MOD = {
  source: "https://mods.example.net/probe/mod_conf.yaml",
  permissions: SAMPLE_MOD.permissions,
};
const CLOCK_SOURCE = "https://mods.example.net/clock/mod_conf.yaml";

function buildOpenPermission(host: string): ModPermission {
  const permission: ModPermission = {
    category: "open",
    host,
    reason: "Opens mods",
  };
  return permission;
}

function buildGrants(
  granted: ModPermission[],
  denied: ModPermission[],
): ModGrants {
  const grants: ModGrants = { granted, denied };
  return grants;
}

describe("grantModPermissions", function describeGrantModPermissions(): void {
  it("grants every declared permission on the app's origin", function grantsSameOrigin(): void {
    const grants = grantModPermissions(SAMPLE_MOD, APP_ORIGIN);

    expect(grants).toEqual({ granted: SAMPLE_MOD.permissions, denied: [] });
  });

  it("denies every declared permission on another origin", function deniesOtherOrigin(): void {
    const grants = grantModPermissions(FOREIGN_MOD, APP_ORIGIN);

    expect(grants).toEqual({ granted: [], denied: FOREIGN_MOD.permissions });
  });

  it("gives two empty lists without permissions", function grantsNothing(): void {
    const grants = grantModPermissions(
      { source: FOREIGN_MOD.source, permissions: [] },
      APP_ORIGIN,
    );

    expect(grants).toEqual({ granted: [], denied: [] });
  });

  it("gives lists that share no objects with the mod", function copiesPermissions(): void {
    const grants = grantModPermissions(SAMPLE_MOD, APP_ORIGIN);

    expect(grants.granted).not.toBe(SAMPLE_MOD.permissions);
    expect(grants.granted[0]).not.toBe(SAMPLE_MOD.permissions[0]);
  });
});

describe("describeDeniedPermission", function describeDescribeDenied(): void {
  it("names the category verb, the host and the reason", function describesShow(): void {
    const description = describeDeniedPermission(SAMPLE_MOD.permissions[0]);

    expect(description).toBe(
      'Permission not granted: show content from https://upload.wikimedia.org ("Shows the book covers"). Mods from other sites run without extra permissions for now.',
    );
  });

  it("uses the verb of each category", function usesVerbs(): void {
    const verbs: string[] = [];
    for (const category of ["connect", "embed", "code"] as const) {
      verbs.push(
        describeDeniedPermission({
          category,
          host: "https://api.example.net",
          reason: "Test",
        }),
      );
    }

    expect(verbs[0]).toContain("exchange data with https://api.example.net");
    expect(verbs[1]).toContain("embed pages from https://api.example.net");
    expect(verbs[2]).toContain("load code from https://api.example.net");
  });

  it('reads "*" as any site', function describesAnySite(): void {
    const description = describeDeniedPermission(SAMPLE_MOD.permissions[1]);

    expect(description).toContain(
      'open mods from any site ("Opens the mods you pick")',
    );
  });
});

describe("checkOpenGrant", function describeCheckOpenGrant(): void {
  it("allows a granted any site", function allowsAnySite(): void {
    const grants = buildGrants([buildOpenPermission("*")], []);

    expect(checkOpenGrant(grants, CLOCK_SOURCE)).toBeNull();
  });

  it("allows a granted target origin", function allowsTargetOrigin(): void {
    const grants = buildGrants(
      [buildOpenPermission("https://mods.example.net")],
      [],
    );

    expect(checkOpenGrant(grants, CLOCK_SOURCE)).toBeNull();
  });

  it("refuses an origin that is not declared", function refusesUndeclared(): void {
    const grants = buildGrants(
      [buildOpenPermission("https://example.org")],
      [],
    );

    expect(checkOpenGrant(grants, CLOCK_SOURCE)).toBe(
      "Opening mods from https://mods.example.net is not allowed. Add it to permissions.open in mod_conf.yaml.",
    );
  });

  it("refuses a declared permission that was not granted", function refusesDenied(): void {
    const grants = grantModPermissions(FOREIGN_MOD, APP_ORIGIN);

    expect(checkOpenGrant(grants, CLOCK_SOURCE)).toBe(
      "Opening mods from https://mods.example.net: the mod declares it in permissions.open, but the permission was not granted.",
    );
  });
});

describe("permissions module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(permissionsModule).sort()).toEqual([
      "checkOpenGrant",
      "describeDeniedPermission",
      "grantModPermissions",
    ]);
  });
});
