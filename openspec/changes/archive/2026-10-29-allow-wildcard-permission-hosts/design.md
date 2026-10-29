# Design

## Context

See proposal.md - Why. The current state that shapes the approach:

- `src/lib/mod/mod_permissions.ts` validates hosts with `isOriginHost`: the text must parse as an `http:` or `https:` URL whose `origin` is the text itself, and the host name must not contain `*`. Engines disagree on `*` in a host name: Node, Firefox and WebKit keep it (`new URL("https://*.example.org").origin` is `"https://*.example.org"`), while Chromium encodes it (`"https://%2A.example.org"`). So a wildcard host cannot be validated or matched by parsing it as written, since the app runs the validation in the browser.
- `src/lib/core/sandbox/sandbox_policy.ts` copies granted hosts into the directives of their category as written. CSP host sources already accept a leading `*.`, which matches one or more subdomain labels and never the bare host name.
- `src/lib/core/sandbox/sandbox_reports.ts` decides between "add it to permissions", "declared but not granted" and the generic message with `declaresHost`, an exact comparison of the permission's host with the blocked origin.
- `src/lib/core/permissions/mod_grants.ts` grants whole permission lists by the mod's origin and never looks inside a `show`, `connect`, `embed` or `code` host. Its `open` matching (`"*"` or exact origin) stays as it is, since `open` gets no wildcards.
- The baseline is not green. The sample book list mod declares `show` for `https://upload.wikimedia.org`, `https://covers.openlibrary.org` and `https://*.archive.org`, and its mod file is rejected, so 3 unit tests and 79 e2e tests in Chromium fail. Once wildcard hosts are accepted, the sample loads and they pass unchanged, except "Sample content hosts" in `e2e/mod_sandbox.spec.ts`, which pins the sample's `img-src`. The sample also gets a fourth `show` host, `https://archive.org`: the Open Library covers redirect from `https://covers.openlibrary.org` to `https://archive.org` and then to `https://ia….us.archive.org`, and `https://*.archive.org` does not cover `https://archive.org`. The expectation becomes `img-src data: blob: ${appOrigin} https://*.archive.org https://archive.org https://covers.openlibrary.org https://upload.wikimedia.org;`: the app's origin is `http://localhost:4173` in the e2e tests, and `http:` sorts before `https:`, and `*` before letters. The sample's book tiles use only `https://upload.wikimedia.org`, so the e2e tests need no route for the new hosts.

## Goals / Non-Goals

**Goals:**
- One function decides whether a permission host covers an origin, and the reports use it, so the reports never disagree with the validation.
- What a wildcard host covers is what the browser's policy allows for it, so a granted wildcard host never produces a "not declared" message for a request the policy allowed, and the other way round.

**Non-Goals:**
- Matching in the app's own code what the browser's policy already enforces. The policy stays the only enforcement for the four categories.
- Reproducing CSP's scheme upgrade (an `http:` source also allows `https:`) in the reports. It applies to exact hosts today and the reports ignore it there too; a request it allows is never blocked, so it never reaches the reports.

## Decisions

### Validate a wildcard host by checking the rest as an origin

`isWildcardHost(host)` accepts a host when:

1. the text starts with `http://*.` or `https://*.`;
2. the text without that `*.`, its base (`https://us.archive.org` for `https://*.us.archive.org`), passes `isOriginHost`, so paths, queries, fragments, user info, trailing slashes, other schemes and any other `*` are rejected the same way;
3. the base's host name is a domain of at least two labels (not an IPv4 address, whose last label is numeric).

The `*` is never given to the URL parser, so validation gives the same answer in every engine (see Context).

`checkPermissionHost` keeps its order: `"*"` first, then `isOriginHost`, then, outside `open`, `isWildcardHost`. A wildcard host in `open` gets its own message (`… host "https://*.example.org": wildcard hosts are not allowed in permissions.open`), like `"*"` outside `open` does today. In the four categories, the message for an invalid host names both forms: `must be an origin such as "https://example.org", or a wildcard host such as "https://*.example.org"`. In `open`, it stays as it is.

The loaded permission keeps the host as written; `ModPermission` does not change shape, so the mount context, `mods.inspect` and the surface guard see the same keys.

*Alternatives:* (a) a regular expression over the text. Rejected: the URL parser already normalizes and rejects what the rule must reject (ports out of range, IPv6 literals, user info), and the regex would have to repeat it. (b) Storing a parsed `{ scheme, suffix, port }` on the permission. Rejected: it changes the shape mods receive in `context.permissions` for no gain, since only the reports need to match.

### One covering function, exported from the mod module

`permissionHostCovers(host: string, origin: string): boolean`, next to the validation in `mod_permissions.ts` and exported from `src/lib/mod/index.ts`:

- an exact host covers the origin equal to it;
- a wildcard host covers an origin with the same protocol and the same port (`URL.port`, which is `""` for the default port) as its parsed base, whose host name ends with `.` + the base's host name. The leading dot is what excludes the bare host name and `https://evil-us.archive.org`.

`declaresHost` in `sandbox_reports.ts` calls it instead of `===`. `mod_grants.ts` does not: `"*"` in `open` is a different rule, and moving it into the shared function would make `permissionHostCovers` accept `"*"` for every category.

*Alternative:* matching in `sandbox_reports.ts` only. Rejected: the rule belongs with the host format it reads, and the mod module is where the format is defined and tested.

### No change to the policy builder

The wildcard host goes into the directives as written, sorted with the other hosts. `*` sorts before letters and digits, so `https://*.us.archive.org` lists before `https://upload.wikimedia.org`; the order is still stable for the same input, which is all the policy needs. A test pins a policy with a wildcard host.

### The mod API bump is an entry, not a surface change

`MOD_API_VERSION` becomes `0.1.3`. `SURFACE_BY_VERSION` in `mod_api_surface.test.ts` gets a `0.1.3` entry equal to `0.1.2`: the guard sees names, and no name changes, but its rule is that the version's entry must exist. `TEST_MOD_API_RANGE` and the shipped mods' `api` ranges stay `^0.1.0`, since a patch bump keeps them matching.

### E2E coverage with a routed wildcard host

The sandbox e2e test serves a mod on the app's origin that declares `show` for `https://*.covers.example.net` and shows images from `https://a.covers.example.net` and `https://covers.example.net`, both answered locally with `page.route`, as the sample covers already are. The first loads; the second is blocked and reported with the "add it to permissions.show" message. Only the browser can prove that the policy matches as the reports do.

## Risks / Trade-offs

- [A wildcard over a public suffix, such as `https://*.co.uk` or `https://*.github.io`, covers sites of many owners] → The two-label rule stops `*.org`, but not these. The permission's `reason` and the future permission prompt are where a user judges it; a public suffix list is out of scope.
- [A mod author writes `https://*.us.archive.org` expecting it to cover `https://us.archive.org`] → The docs say it does not, and the blocked request is reported with the exact origin to add.
- [A granted host redirects to the bare host name of a wildcard, as `https://covers.openlibrary.org` does to `https://archive.org`] → The browser reports the original, granted origin and not the redirect's target, so the report is the generic "Blocked by the sandbox policy (img-src)." and cannot name the host to add. The sample declares `https://archive.org` next to `https://*.archive.org`; a report that names the redirect as the likely cause is out of scope (see proposal.md - Impact).
- [Browsers disagree on CSP wildcard matching] → CSP3 defines `*.` the same way in Chromium, Firefox and WebKit; the e2e test runs in all three.
