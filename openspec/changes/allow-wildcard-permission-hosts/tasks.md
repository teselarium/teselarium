# Tasks

## 1. Setup

- [ ] 1.1 Record the current test results: run `npm test` and `npm run test:e2e` and note the number of passing and failing tests of each, and the names of the failing ones, for the check in 5.1. Expect the failures design.md describes (3 unit tests in `src/lib/mod/sample_mod.test.ts` and, in each browser, the e2e tests that load the sample book list mod), all with the error `host "https://*.archive.org" must be an origin`. A failure with another cause is not this change's to fix: note it apart

## 2. Wildcard hosts in the mod file

- [ ] 2.1 Write the failing tests first in `src/lib/mod/mod_permissions.test.ts` for the "Permission hosts are origins" scenarios: "Wildcard host", "Wildcard host with a port", "Wildcard inside a label", "Wildcard after the first label", "Wildcard over a single label" and "Wildcard host in open", plus a wildcard host with a path (`https://*.example.org/images`) and with another scheme (`wss://*.example.org`). Then add `isWildcardHost` and the new checks and messages to `checkPermissionHost` in `mod_permissions.ts`, following design.md. Update the `ModPermission` doc comment. Verify `npx vitest run src/lib/mod` passes, including the existing host scenarios
- [ ] 2.2 Add `permissionHostCovers(host, origin)` to `mod_permissions.ts` and export it from `src/lib/mod/index.ts`. Test it in `mod_permissions.test.ts`: an exact host covers only itself; `https://*.us.archive.org` covers `https://ia800100.us.archive.org` and `https://a.b.us.archive.org`, and not `https://us.archive.org`, `https://evil-us.archive.org`, `http://ia800100.us.archive.org` or `https://ia800100.us.archive.org:8443`; `http://*.example.test:8080` covers `http://a.example.test:8080` and not `http://a.example.test`. Verify `npx vitest run src/lib/mod` passes
- [ ] 2.3 Update the host rules in `docs/modules/lib/mod/README.md`: wildcard hosts in `show`, `connect`, `embed` and `code`, what they cover and do not cover (the bare host name, other schemes and ports), and the wildcards that stay rejected. Verify each example host in the section matches a test of 2.1 or 2.2

## 3. Policy and reports

- [ ] 3.1 Write the failing test first in `src/lib/core/sandbox/sandbox_reports.test.ts`: a blocked image from `https://ia800100.us.archive.org` with `show` for `https://*.us.archive.org` granted gives the generic message, with it denied gives the "declared but not granted" message, and a blocked image from `https://us.archive.org` with it granted gives the "Add it to permissions.show" message. Then make `declaresHost` use `permissionHostCovers`. Verify `npx vitest run src/lib/core/sandbox` passes
- [ ] 3.2 Add a test to `src/lib/core/sandbox/sandbox_policy.test.ts` that pins the policy of a mod granted `show` for `https://*.us.archive.org` and `https://upload.wikimedia.org`, with both hosts in `style-src`, `img-src`, `media-src` and `font-src` in sorted order and `connect-src 'none'`. Verify `npx vitest run src/lib/core/sandbox` passes with no change to `sandbox_policy.ts`
- [ ] 3.3 In `e2e/mod_sandbox.spec.ts`, add a "Wildcard hosts cover subdomains" group with the scenarios of the `mod-sandbox` delta, serving the hosts with `page.route` as design.md says ("Image from a subdomain of a granted wildcard host", "Deeper subdomain", "The wildcard's own host name is not covered", "Other scheme is not covered", "Wildcard host declared but not granted"). Use example hosts under `example.net` instead of `archive.org`, so no test reads like it needs the real site. Verify `npm run test:e2e -- e2e/mod_sandbox.spec.ts` passes in all three browsers
- [ ] 3.4 Update `docs/modules/lib/core/sandbox/README.md`: the policy table says granted hosts can be wildcard hosts and go in as written, and the reports section says a wildcard host that covers the blocked origin counts as declared, with an example. The example of the sample book list mod's policy says its three `show` hosts, `https://*.archive.org`, `https://covers.openlibrary.org` and `https://upload.wikimedia.org`, are added after `https://example.org` in `style-src`, `img-src`, `media-src` and `font-src`. Verify the examples match the tests of 3.1, 3.2 and 3.5
- [ ] 3.5 In `e2e/mod_sandbox.spec.ts`, update "Sample content hosts" so it expects the sample's `img-src` with its three `show` hosts, as design.md gives it. Verify `npm run test:e2e -- e2e/mod_sandbox.spec.ts` passes in all three browsers

## 4. Mod API version

- [ ] 4.1 Bump `MOD_API_VERSION` to `"0.1.3"`, and add a `"0.1.3"` entry to the surface guard in `mod_api_surface.test.ts`, equal to the `0.1.2` entry. Leave the older entries as they are. Update the version test in `mod_api_version.test.ts` and `APP_MOD_API_VERSION` in `e2e/mod_routes.ts`, and keep `TEST_MOD_API_RANGE` and the shipped mods' `api` ranges at `^0.1.0`. Verify `npx vitest run src/lib/core/engine` and `npm run build` pass
- [ ] 4.2 Update the mod API version in `docs/modules/lib/core/engine/README.md` (the mount context's `api` row, the check report example, "Mod API version" and the public entry point list). Verify `grep -rn "0\.1\.2" docs src e2e` matches only the `0.1.2` entry of the surface guard

## 5. Integration check

- [ ] 5.1 Run `npm run lint`, `npm run format:check`, `npm test`, `npm run build` and `npm run test:e2e`, and verify all pass, with the counts of 1.1 plus only the tests this change added, and with each test that 1.1 found failing because of the sample book list mod now passing in all three browsers. Run `openspec validate allow-wildcard-permission-hosts --strict` and verify it reports the change as valid
- [ ] 5.2 Add `.changeset/allow-wildcard-permission-hosts.md` with a `patch` bump, following the "Bump rule" section of `docs/releasing.md`: the mod API's patch bump (an addition) means an app patch bump. Summary: "Mods can declare wildcard hosts such as `https://*.example.org` in the `show`, `connect`, `embed` and `code` permissions." Verify `npx changeset status` lists the change as a patch

## Workflow follow-up

- Archive the change with `/opsx:archive` once it has been reviewed, syncing the `mod-loading`, `mod-sandbox` and `mod-api-version` deltas into the main specs.
