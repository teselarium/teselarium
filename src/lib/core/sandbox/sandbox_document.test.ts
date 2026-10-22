import { describe, expect, it } from "vitest";
import { THEME_FRAME_STYLES } from "../theme/index.ts";
import { buildSandboxDocument, buildSandboxPolicy } from "./index.ts";
import SANDBOX_LOADER from "./sandbox_loader.js?raw";

const POLICY = buildSandboxPolicy(["https://example.org"], []);

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
});
