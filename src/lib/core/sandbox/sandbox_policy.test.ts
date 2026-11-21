import { describe, expect, it } from "vitest";
import {
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_ENTRYPOINT,
  SAMPLE_MOD_SOURCE,
  SAMPLE_TILE_SOURCES,
  SAMPLE_TYPE_SOURCE,
} from "../../../test/sample_mods.ts";
import type { ModPermission, PermissionCategory } from "../../mod/index.ts";
import { buildSandboxPolicy, collectContentHosts } from "./index.ts";

const SAMPLE_SOURCES = [
  SAMPLE_MOD_SOURCE,
  SAMPLE_ENTRYPOINT,
  SAMPLE_TYPE_SOURCE,
  SAMPLE_COLLECTION_SOURCE,
  ...SAMPLE_TILE_SOURCES,
];

const DEFAULT_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'unsafe-inline' data: blob: https://example.org",
  "img-src data: blob: https://example.org",
  "media-src data: blob: https://example.org",
  "font-src data: blob: https://example.org",
  "connect-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function buildPermission(
  category: PermissionCategory,
  host: string,
): ModPermission {
  const permission: ModPermission = { category, host, reason: "Test" };
  return permission;
}

describe("collectContentHosts", function describeCollectContentHosts(): void {
  it("Sample content hosts", function collectsSampleHosts(): void {
    expect(collectContentHosts(SAMPLE_SOURCES)).toEqual([
      "https://example.org",
    ]);
  });

  it("Tile from another host", function collectsTileHost(): void {
    const contentHosts = collectContentHosts([
      ...SAMPLE_SOURCES,
      "https://tiles.example.net/books/kallocain.md",
    ]);

    expect(contentHosts).toEqual([
      "https://example.org",
      "https://tiles.example.net",
    ]);
  });

  it("drops file: and data: sources", function dropsLocalSources(): void {
    const contentHosts = collectContentHosts([
      "file:///library/books/kallocain.md",
      "data:text/plain,hello",
      "http://localhost:5173/mods/book_list/mod_conf.yaml",
    ]);

    expect(contentHosts).toEqual(["http://localhost:5173"]);
  });

  it("Stored mosaic's sandbox", function dropsBrowserSources(): void {
    const contentHosts = collectContentHosts([
      "opentesela-browser:///r1/maps/nobel_map.yaml",
      "https://mods.example.net/book_list/mod_conf.yaml",
      "https://tiles.example.net/laureates/collection.yaml",
    ]);

    expect(contentHosts).toEqual([
      "https://mods.example.net",
      "https://tiles.example.net",
    ]);
  });

  it("removes duplicates and sorts the hosts", function sortsHosts(): void {
    const contentHosts = collectContentHosts([
      "https://zeta.example.net/a.md",
      "https://alpha.example.net/b.md",
      "https://zeta.example.net/c.md",
    ]);

    expect(contentHosts).toEqual([
      "https://alpha.example.net",
      "https://zeta.example.net",
    ]);
  });
});

describe("buildSandboxPolicy", function describeBuildSandboxPolicy(): void {
  it("builds the default policy without grants", function buildsDefaultPolicy(): void {
    const policy = buildSandboxPolicy(["https://example.org"], [], []);

    expect(policy).toBe(DEFAULT_POLICY);
  });

  it("adds each granted host to the directives of its category", function addsGrantedHosts(): void {
    const policy = buildSandboxPolicy(
      ["https://example.org"],
      [
        buildPermission("open", "*"),
        buildPermission("code", "https://cdn.example.net"),
        buildPermission("embed", "https://maps.example.net"),
        buildPermission("connect", "https://api.example.net"),
        buildPermission("show", "https://upload.wikimedia.org"),
        buildPermission("open", "https://mods.example.net"),
      ],
      [],
    );

    expect(policy).toBe(
      [
        "default-src 'none'",
        "script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.example.net",
        "style-src 'unsafe-inline' data: blob: https://example.org https://upload.wikimedia.org",
        "img-src data: blob: https://example.org https://upload.wikimedia.org",
        "media-src data: blob: https://example.org https://upload.wikimedia.org",
        "font-src data: blob: https://example.org https://upload.wikimedia.org",
        "connect-src https://api.example.net",
        "frame-src https://maps.example.net",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
    );
    expect(policy).not.toContain("mods.example.net");
    expect(policy).not.toContain(" * ");
  });

  it("sorts each directive's hosts without duplicates", function sortsDirectiveHosts(): void {
    const policy = buildSandboxPolicy(
      ["https://zeta.example.net", "https://example.org"],
      [
        buildPermission("show", "https://example.org"),
        buildPermission("show", "https://alpha.example.net"),
        buildPermission("connect", "https://b.example.net"),
        buildPermission("connect", "https://a.example.net"),
        buildPermission("connect", "https://a.example.net"),
      ],
      [],
    );

    expect(policy).toContain(
      "img-src data: blob: https://alpha.example.net https://example.org https://zeta.example.net;",
    );
    expect(policy).toContain(
      "connect-src https://a.example.net https://b.example.net;",
    );
  });

  it("adds a granted wildcard host as written", function addsWildcardHost(): void {
    const policy = buildSandboxPolicy(
      ["https://example.org"],
      [
        buildPermission("show", "https://upload.wikimedia.org"),
        buildPermission("show", "https://*.us.archive.org"),
      ],
      [],
    );

    expect(policy).toBe(
      [
        "default-src 'none'",
        "script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
        "style-src 'unsafe-inline' data: blob: https://*.us.archive.org https://example.org https://upload.wikimedia.org",
        "img-src data: blob: https://*.us.archive.org https://example.org https://upload.wikimedia.org",
        "media-src data: blob: https://*.us.archive.org https://example.org https://upload.wikimedia.org",
        "font-src data: blob: https://*.us.archive.org https://example.org https://upload.wikimedia.org",
        "connect-src 'none'",
        "frame-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
    );
  });

  it("adds the tile link sources to img-src and media-src only", function addsTileLinkSources(): void {
    const tileLinkSources = [
      "https://media.example.net/covers/kallocain.jpg",
      "https://media.example.net/sound/theme.mp3",
    ];

    const policy = buildSandboxPolicy(
      ["https://example.org"],
      [],
      tileLinkSources,
    );

    expect(policy).toBe(
      [
        "default-src 'none'",
        "script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
        "style-src 'unsafe-inline' data: blob: https://example.org",
        "img-src data: blob: https://example.org https://media.example.net/covers/kallocain.jpg https://media.example.net/sound/theme.mp3",
        "media-src data: blob: https://example.org https://media.example.net/covers/kallocain.jpg https://media.example.net/sound/theme.mp3",
        "font-src data: blob: https://example.org",
        "connect-src 'none'",
        "frame-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
    );
    const linkingDirectives: string[] = [];
    for (const directive of policy.split("; ")) {
      if (directive.includes("media.example.net")) {
        linkingDirectives.push(directive.split(" ")[0]);
      }
    }
    expect(linkingDirectives).toEqual(["img-src", "media-src"]);
  });

  it("follows the directive order", function followsDirectiveOrder(): void {
    const policy = buildSandboxPolicy([], [], []);

    const directiveNames: string[] = [];
    for (const directive of policy.split("; ")) {
      directiveNames.push(directive.split(" ")[0]);
    }
    expect(directiveNames).toEqual([
      "default-src",
      "script-src",
      "style-src",
      "img-src",
      "media-src",
      "font-src",
      "connect-src",
      "frame-src",
      "base-uri",
      "form-action",
    ]);
  });
});
