import { describe, expect, it } from "vitest";
import { buildSandboxDocument, buildSandboxPolicy } from "./index.ts";
import SANDBOX_LOADER from "./sandbox_loader.js?raw";

const POLICY = buildSandboxPolicy(["https://example.org"], []);

describe("buildSandboxDocument", function describeBuildSandboxDocument(): void {
  it("puts the policy before the frame loader", function ordersPolicyFirst(): void {
    const sandboxDocument = buildSandboxDocument(POLICY);

    const policyIndex = sandboxDocument.indexOf(
      '<meta http-equiv="Content-Security-Policy"',
    );
    const loaderIndex = sandboxDocument.indexOf("<script");
    expect(policyIndex).toBeGreaterThan(-1);
    expect(loaderIndex).toBeGreaterThan(policyIndex);
  });

  it("inserts the policy as given", function insertsPolicy(): void {
    const sandboxDocument = buildSandboxDocument(POLICY);

    expect(sandboxDocument).toContain(`content="${POLICY}">`);
  });

  it("inlines the frame loader", function inlinesLoader(): void {
    const sandboxDocument = buildSandboxDocument(POLICY);

    expect(sandboxDocument).toContain(SANDBOX_LOADER);
  });

  it("has a frame loader without a closing script tag", function checksLoaderText(): void {
    expect(SANDBOX_LOADER.toLowerCase()).not.toContain("</script");
  });
});
