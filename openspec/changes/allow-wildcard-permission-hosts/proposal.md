# Proposal

## Why

Some sites serve their files from many subdomains that change from file to file. Open Library's covers (`https://covers.openlibrary.org/b/id/…-L.jpg`) redirect to `https://archive.org/download/…`, which redirects again to Internet Archive storage servers such as `https://ia800100.us.archive.org`, and the content policy checks every redirect. A mod can only declare exact origins today, so it cannot list them all, and the covers are blocked even though `https://covers.openlibrary.org` is granted. The browser's content policy already understands wildcard subdomains (`https://*.us.archive.org`). Only the mod file format forbids them.

The sample book list mod already declares `show` for `https://covers.openlibrary.org` and `https://*.archive.org` (commit `4e719ce`), so its mod file is rejected today (`"permissions.show" entry 3: host "https://*.archive.org" must be an origin such as "https://example.org"`). Every test that loads the sample fails: 3 unit tests in `src/lib/mod/sample_mod.test.ts` and 79 e2e tests in Chromium (the stage, the viewer, the explorer, the check, the theme, the sidebar and the settings). This change makes the sample load again. A wildcard host does not cover its own host name, so `https://*.archive.org` does not cover the `https://archive.org` step of the redirect, and the sample also declares `https://archive.org` so that its covers are shown.

## What Changes

- **Wildcard hosts**: in `show`, `connect`, `embed` and `code`, a permission `host` can be a wildcard host: an `http:` or `https:` scheme, `*.` as the whole leftmost label, a host name of at least two labels, and an optional port, such as `https://*.us.archive.org` or `http://*.example.test:8080`. It covers every subdomain of that host name, at any depth, with the same scheme and port. It does not cover the host name itself: `https://*.us.archive.org` does not cover `https://us.archive.org`, as in the browser's content policy.
- **Still rejected**: `*` anywhere else (`https://cdn*.example.org`, `https://a.*.example.org`), a wildcard over a single label (`https://*.org`), a wildcard host in `open`, and everything rejected today (paths, queries, fragments, user info, other schemes). The error names the host as today.
- **Content policy**: a granted wildcard host goes into the frame's policy as written, in the directives of its category. The policy's directives and order do not change.
- **Blocked request reports**: a blocked origin counts as declared, or as declared but not granted, when a wildcard host of the category covers it, as it does for an exact host today.
- **`open` unchanged**: it keeps exact origins and `"*"`. A mod opens mods from a few known sites, and `"*"` already means any site.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mod-loading`: the requirement "Permission hosts are origins" allows wildcard hosts in `show`, `connect`, `embed` and `code`, and the "Wildcard host" scenario, which rejects `https://*.example.org`, is replaced by scenarios that accept it and reject the wildcards that stay invalid.
- `mod-sandbox`: a new requirement says which origins a wildcard host covers, for granting its category's requests and for reporting blocked ones.
- `mod-api-version`: the mod API version becomes `0.1.3`.

## Impact

- **Code**: `src/lib/mod/mod_permissions.ts` (validation, and a shared function that tells whether a permission host covers an origin, exported from the mod module), `src/lib/core/sandbox/sandbox_reports.ts` (uses that function). `src/lib/core/sandbox/sandbox_policy.ts` and `src/lib/core/permissions/mod_grants.ts` need no change.
- **Tests**: unit tests for the validation, the covering function and the reports; a policy test with a wildcard host; an e2e test that an image from a subdomain of a granted wildcard host loads. The tests that fail today because the sample mod is rejected pass again without changes, except the e2e test "Sample content hosts" (`e2e/mod_sandbox.spec.ts`), which pins the sample's `img-src` with `https://upload.wikimedia.org` only and must list the sample's four `show` hosts.
- **Docs**: host rules in `docs/modules/lib/mod/README.md`, and the policy and report sections of `docs/modules/lib/core/sandbox/README.md`, including its example of the sample book list mod's policy, which names only `https://upload.wikimedia.org`.
- **Sample mod**: `public/samples/mods/book_list/mod_conf.yaml` already declares the wildcard host this change accepts, and gets one more `show` entry, `https://archive.org` ("Shows the book covers"), for the first redirect of the Open Library covers. Without it, the covers of the Nobel laureates sample tiles are blocked with "Blocked by the sandbox policy (img-src).", since the browser reports the granted `https://covers.openlibrary.org` and not the redirect's target.
- **Mod API version**: patch bump, `0.1.2` → `0.1.3`. The change touches `mod-loading`'s mod file format, and it is an addition: `host` accepts values it rejected before, and every mod file that loaded before loads the same way, so `^0.1.0` ranges keep matching. The surface guard gets a `0.1.3` entry equal to `0.1.2`, since no name changes.
- **App version**: patch bump, following the mod API's patch bump.
- **Test tooling** (unrelated to wildcard hosts, included in this change on request): `npm run format:check` skips the sample markdown tiles; the e2e run sets `fullyParallel`; and the e2e tests of the 10-second mount and case limits move the page's clock past the limit instead of waiting for it. The app's limits do not change.
- **Out of scope**: wildcards in `open`; a check against the public suffix list (so `https://*.co.uk` is accepted, and the two-label rule only stops the plainest overreach); the message for a request blocked after a redirect from a granted host, which still reads "Blocked by the sandbox policy (img-src)."; changing the Nobel laureates sample tiles.
