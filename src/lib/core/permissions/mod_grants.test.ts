import { describe, expect, it } from "vitest";
import { SAMPLE_MOD_SOURCE } from "../../../test/sample_mods.ts";
import type { ModPermission } from "../../mod/index.ts";
import * as permissionsModule from "./index.ts";
import {
  checkOpenGrant,
  describeDeniedPermission,
  describePermissionLine,
  grantModPermissions,
  listConsentLines,
} from "./index.ts";
import type { ModGrants, SiteDecision } from "./index.ts";

const APP_ORIGIN = "https://example.org";
const SAMPLE_MOD = {
  source: SAMPLE_MOD_SOURCE,
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
const COVERS_HOST = "https://upload.wikimedia.org";

function buildOpenPermission(host: string): ModPermission {
  const permission: ModPermission = {
    category: "open",
    host,
    reason: "Opens mods",
  };
  return permission;
}

function buildCoversDecision(
  mod: string,
  host: string,
  allowed: boolean,
): SiteDecision {
  const decision: SiteDecision = {
    mod,
    title: "Probe",
    category: "show",
    host,
    allowed,
  };
  return decision;
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
    const grants = grantModPermissions(SAMPLE_MOD, APP_ORIGIN, []);

    expect(grants).toEqual({ granted: SAMPLE_MOD.permissions, denied: [] });
  });

  it("denies every declared permission on another origin", function deniesOtherOrigin(): void {
    const grants = grantModPermissions(FOREIGN_MOD, APP_ORIGIN, []);

    expect(grants).toEqual({ granted: [], denied: FOREIGN_MOD.permissions });
  });

  it("gives two empty lists without permissions", function grantsNothing(): void {
    const grants = grantModPermissions(
      { source: FOREIGN_MOD.source, permissions: [] },
      APP_ORIGIN,
      [],
    );

    expect(grants).toEqual({ granted: [], denied: [] });
  });

  it("gives lists that share no objects with the mod", function copiesPermissions(): void {
    const grants = grantModPermissions(SAMPLE_MOD, APP_ORIGIN, []);

    expect(grants.granted).not.toBe(SAMPLE_MOD.permissions);
    expect(grants.granted[0]).not.toBe(SAMPLE_MOD.permissions[0]);
  });

  it("grants a foreign permission with an allowed decision", function grantsAllowed(): void {
    const decision = buildCoversDecision(FOREIGN_MOD.source, COVERS_HOST, true);

    const grants = grantModPermissions(FOREIGN_MOD, APP_ORIGIN, [decision]);

    expect(grants).toEqual({
      granted: [FOREIGN_MOD.permissions[0]],
      denied: [FOREIGN_MOD.permissions[1]],
    });
  });

  it("denies a foreign permission with a refused decision", function deniesRefused(): void {
    const decision = buildCoversDecision(
      FOREIGN_MOD.source,
      COVERS_HOST,
      false,
    );

    const grants = grantModPermissions(FOREIGN_MOD, APP_ORIGIN, [decision]);

    expect(grants).toEqual({ granted: [], denied: FOREIGN_MOD.permissions });
  });

  it("ignores a decision of another mod", function ignoresOtherMod(): void {
    const decision = buildCoversDecision(CLOCK_SOURCE, COVERS_HOST, true);

    const grants = grantModPermissions(FOREIGN_MOD, APP_ORIGIN, [decision]);

    expect(grants).toEqual({ granted: [], denied: FOREIGN_MOD.permissions });
  });

  it("does not let a wildcard decision cover the bare host", function comparesAsWritten(): void {
    const mod = {
      source: FOREIGN_MOD.source,
      permissions: [
        {
          category: "show",
          host: "https://archive.org",
          reason: "Shows the scans",
        },
      ] satisfies ModPermission[],
    };
    const decision = buildCoversDecision(
      FOREIGN_MOD.source,
      "https://*.archive.org",
      true,
    );

    const grants = grantModPermissions(mod, APP_ORIGIN, [decision]);

    expect(grants).toEqual({ granted: [], denied: mod.permissions });
  });

  it("ignores decisions on the app's origin", function ignoresDecisionsOnAppOrigin(): void {
    const decision = buildCoversDecision(SAMPLE_MOD.source, COVERS_HOST, false);

    const grants = grantModPermissions(SAMPLE_MOD, APP_ORIGIN, [decision]);

    expect(grants).toEqual({ granted: SAMPLE_MOD.permissions, denied: [] });
  });
});

describe("listConsentLines", function describeListConsentLines(): void {
  it("lists every undecided permission of a foreign mod, as declared", function listsUndecided(): void {
    const lines = listConsentLines(FOREIGN_MOD, APP_ORIGIN, []);

    expect(lines).toEqual(FOREIGN_MOD.permissions);
  });

  it("leaves out the permissions with a decision for that mod", function leavesOutDecided(): void {
    const decision = buildCoversDecision(
      FOREIGN_MOD.source,
      COVERS_HOST,
      false,
    );

    const lines = listConsentLines(FOREIGN_MOD, APP_ORIGIN, [decision]);

    expect(lines).toEqual([FOREIGN_MOD.permissions[1]]);
  });

  it("still lists a permission decided for another mod", function listsOtherModDecision(): void {
    const decision = buildCoversDecision(CLOCK_SOURCE, COVERS_HOST, true);

    const lines = listConsentLines(FOREIGN_MOD, APP_ORIGIN, [decision]);

    expect(lines).toEqual(FOREIGN_MOD.permissions);
  });

  it("gives one line per category and host, with the first reason", function mergesDuplicates(): void {
    const mod = {
      source: FOREIGN_MOD.source,
      permissions: [
        { category: "show", host: COVERS_HOST, reason: "Shows the covers" },
        { category: "open", host: "*", reason: "Opens mods" },
        { category: "show", host: COVERS_HOST, reason: "Shows the maps" },
      ] satisfies ModPermission[],
    };

    const lines = listConsentLines(mod, APP_ORIGIN, []);

    expect(lines).toEqual([mod.permissions[0], mod.permissions[1]]);
  });

  it("lists nothing for a mod from the app's origin", function listsNothingOnAppOrigin(): void {
    const lines = listConsentLines(SAMPLE_MOD, APP_ORIGIN, []);

    expect(lines).toEqual([]);
  });
});

describe("describePermissionLine", function describeDescribePermissionLine(): void {
  it("names the category verb and the host", function describesLine(): void {
    const line = describePermissionLine(SAMPLE_MOD.permissions[0]);

    expect(line).toBe("show content from https://upload.wikimedia.org");
  });

  it('reads "*" as any site', function describesAnySiteLine(): void {
    const line = describePermissionLine(SAMPLE_MOD.permissions[1]);

    expect(line).toBe("open mods from any site");
  });
});

describe("describeDeniedPermission", function describeDescribeDenied(): void {
  it("names the category verb, the host and the reason", function describesShow(): void {
    const description = describeDeniedPermission(SAMPLE_MOD.permissions[0]);

    expect(description).toBe(
      'Permission not granted: show content from https://upload.wikimedia.org ("Shows the book covers"). Mods from other sites get only the permissions you allow.',
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
    const grants = grantModPermissions(FOREIGN_MOD, APP_ORIGIN, []);

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
      "describePermissionLine",
      "grantModPermissions",
      "listConsentLines",
    ]);
  });
});
