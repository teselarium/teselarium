import { describe, expect, it } from "vitest";
import { THEME_FRAME_STYLES } from "../theme/index.ts";
import { buildSandboxDocument, buildSandboxPolicy } from "./index.ts";
import SANDBOX_ASSERTIONS from "./sandbox_assertions.js?raw";
import SANDBOX_LOADER from "./sandbox_loader.js?raw";
import SANDBOX_TEST_RUNNER from "./sandbox_test_runner.js?raw";

const POLICY = buildSandboxPolicy(["https://example.org"], [], []);

const TOP_LEVEL_NAME =
  /^(?:export )?(?:async )?(?:function|const|let|class) ([A-Za-z_$][\w$]*)/gm;

/** The names a frame script declares at its top level. */
function listTopLevelNames(script: string): string[] {
  const names: string[] = [];
  for (const match of script.matchAll(TOP_LEVEL_NAME)) {
    names.push(match[1]);
  }
  return names;
}

describe("buildSandboxDocument", function describeBuildSandboxDocument(): void {
  it("puts the policy before the frame loader", function ordersPolicyFirst(): void {
    const sandboxDocument = buildSandboxDocument(POLICY, "default");

    const policyIndex = sandboxDocument.indexOf(
      '<meta http-equiv="Content-Security-Policy"',
    );
    const loaderIndex = sandboxDocument.indexOf("<script");
    expect(policyIndex).toBeGreaterThan(-1);
    expect(loaderIndex).toBeGreaterThan(policyIndex);
  });

  it("inserts the policy as given", function insertsPolicy(): void {
    const sandboxDocument = buildSandboxDocument(POLICY, "default");

    expect(sandboxDocument).toContain(`content="${POLICY}">`);
  });

  it("inlines the frame loader", function inlinesLoader(): void {
    const sandboxDocument = buildSandboxDocument(POLICY, "default");

    expect(sandboxDocument).toContain(SANDBOX_LOADER);
  });

  it("has a frame loader without a closing script tag", function checksLoaderText(): void {
    expect(SANDBOX_LOADER.toLowerCase()).not.toContain("</script");
  });

  it("puts the theme styles between the policy and the frame loader", function ordersStyles(): void {
    const sandboxDocument = buildSandboxDocument(POLICY, "default");

    const policyIndex = sandboxDocument.indexOf(
      '<meta http-equiv="Content-Security-Policy"',
    );
    const styleIndex = sandboxDocument.indexOf(
      `<style>${THEME_FRAME_STYLES}</style>`,
    );
    const loaderIndex = sandboxDocument.indexOf("<script");
    expect(styleIndex).toBeGreaterThan(policyIndex);
    expect(loaderIndex).toBeGreaterThan(styleIndex);
  });

  it("has no style for a mod that opted out", function omitsStyles(): void {
    const sandboxDocument = buildSandboxDocument(POLICY, "none");

    expect(sandboxDocument).not.toContain("<style");
    expect(sandboxDocument).toContain(`content="${POLICY}">`);
    expect(sandboxDocument).toContain(SANDBOX_LOADER);
  });

  it("is the same for the same mod", function buildsSameDocument(): void {
    expect(buildSandboxDocument(POLICY, "default")).toBe(
      buildSandboxDocument(POLICY, "default"),
    );
  });

  it("has no test runner without the option", function omitsRunner(): void {
    const sandboxDocument = buildSandboxDocument(POLICY, "default");

    expect(sandboxDocument).not.toContain(SANDBOX_ASSERTIONS);
    expect(sandboxDocument).not.toContain(SANDBOX_TEST_RUNNER);
    expect(buildSandboxDocument(POLICY, "default", {})).toBe(sandboxDocument);
  });

  it("inlines the assertions and the test runner after the loader in one script", function inlinesRunner(): void {
    const sandboxDocument = buildSandboxDocument(POLICY, "default", {
      testRunner: true,
    });

    expect(sandboxDocument).toContain(
      `<script type="module">${SANDBOX_LOADER}\n${SANDBOX_ASSERTIONS}\n${SANDBOX_TEST_RUNNER}</script>`,
    );
    expect(sandboxDocument.match(/<script/g)).toHaveLength(1);
    expect(sandboxDocument).toContain(`content="${POLICY}">`);
  });

  it("defines the tile body element in every frame, check frames too", function definesTileBody(): void {
    const definition =
      "customElements.define(TILE_BODY_ELEMENT, TileBodyElement)";
    const runningDocument = buildSandboxDocument(POLICY, "default");
    const checkDocument = buildSandboxDocument(POLICY, "none", {
      testRunner: true,
    });

    expect(SANDBOX_LOADER).toContain(
      'const TILE_BODY_ELEMENT = "ot-tile-body";',
    );
    expect(runningDocument).toContain(definition);
    expect(checkDocument).toContain(definition);
  });

  it("has frame scripts without a closing script tag", function checksScriptTexts(): void {
    for (const script of [
      SANDBOX_LOADER,
      SANDBOX_ASSERTIONS,
      SANDBOX_TEST_RUNNER,
    ]) {
      expect(script.toLowerCase()).not.toContain("</script");
    }
  });

  it("has frame scripts that declare different names", function checksNames(): void {
    const names = [
      ...listTopLevelNames(SANDBOX_LOADER),
      ...listTopLevelNames(SANDBOX_ASSERTIONS),
      ...listTopLevelNames(SANDBOX_TEST_RUNNER),
    ];

    expect(names).toContain("frameModes");
    expect(names).toContain("TileBodyElement");
    expect(names).toContain("waitFor");
    expect(new Set(names).size).toBe(names.length);
  });
});
