# Design

## Context

See proposal.md for the motivation. The pieces this change builds on:

- **`libs.load` today** (`src/lib/core/engine/libs_methods.ts`): a table of shipped libraries (`SHIPPED_LIBRARIES`, only mermaid), a per-page cache of each library's code (`loadCodeOnce`), and a handler that answers `{ name, version, code }`. The frame loader (`src/lib/core/sandbox/sandbox_loader.js`) keeps one promise per `[name, version]` key, installs `code` as a classic `<script>` from a `blob:` URL, and resolves the mod's request with `{ name, version }` only.
- **Method context**: each handler gets `ModMethodContext`, which holds the requesting `mod: LoadedMod` and `fetchOptions`. The handler can read the mod's declarations directly, with no new plumbing between frame and engine.
- **Fetching**: `fetchFile` (`src/lib/files/file_fetcher.ts`) is the shared fetcher for mod files and tiles. On a non-OK answer it throws a `FileFetchError` naming the address and the HTTP status, without the body.
- **Frame document** (`sandbox_document.ts`): `<meta>` policy, then the theme `<style>` (absent with `theme: "none"`), then the loader's module script. Mods add their styles after these. The policy's `style-src` and `script-src` already allow `blob:` and inline styles.
- **Settings of an instantiation**: `src/main/default_mods.ts` holds `DEFAULT_MODS`, which `main.tsx` resolves against `document.baseURI` and passes to the engine as `defaults`.
- **Spike** (jsDelivr, from the dev container): exact versions are served with `access-control-allow-origin: *` and `cache-control: public, max-age=31536000, immutable`. Ranges are served directly, without a redirect, with a 7-day cache. Missing packages, versions and files answer 404 with a one-line `text/plain` reason. `leaflet@1.9.4/dist/leaflet.js` is 148 KB (about 37 KB compressed). Leaflet's `latest` is 1.9.4, and 2.0 is still a beta.

## Goals / Non-Goals

**Goals:**

- Declared libraries reuse the `libs.load` path end to end: the same request, the same frame-side dedupe and the same classic-script install from `blob:`.
- The frame's content policy stays exactly as it is.
- Everything a declaration names is known when the mod file loads, so format errors come early and the inspection and the check can list and verify files without running the mod.

**Non-Goals:**

- Resolving a package's entry file from its `package.json` (`main`, `jsdelivr`, `exports`): authors list files explicitly.
- A general-purpose file API for mods: data files exist only as files of a declared library.
- Changing how shipped libraries are fetched or answered.

## Decisions

### 1. The engine fetches; the frame installs from `blob:`

The handler fetches the declared files in the app page and answers their text. The frame loader installs scripts and stylesheets from `blob:` URLs and hands data files to the mod.

- *Alternative: let the frame fetch from the npm host* by adding the host to `script-src`, `style-src` and `connect-src`. Rejected: it widens the policy of every mod that declares a library to the whole npm host. A script URL is also a way to send data out (sandbox README), which is the reason `code` exists.
- *Alternative: ES module imports through import maps.* Rejected for now: a `blob:` entrypoint cannot resolve them, and ESM-only packages are out of scope.

### 2. Library sources are resolved when the mod file loads

`mod_format.ts` reads and checks `libraries` (names, keys, `npm` with `semver`'s `valid` on the version part, paths, kinds). `mod_loader.ts` resolves each file's `source`:
- for an npm file, `<npm host><package>@<version>/<path>`;
- otherwise, the path against the mod file, like `entrypoint`.

`LoadedMod` gains `libraries: LoadedLibrary[]`, with `{ name, package, version, files: { path, source, kind }[] }`, plain data like the rest.

The npm host comes into the loader as a `ModLoadOptions` field (`npmHost`), because the loaded mod must carry resolved sources for the inspection and the check.

- *Alternative: keep `{ package, version, path }` and compute URLs in the handler.* Rejected: the inspection and the check would each need the host and the same computation.

### 3. The npm host is an instantiation setting

The vanilla value is `https://cdn.jsdelivr.net/npm/`, in a new `src/main/library_host.ts`. That file is the instantiation's choice, like `default_mods.ts`. `main.tsx` passes it to the stage and the engine, which put it in the load options of every mod load: open, inspect and check. The engine has no default of its own, so tests always name their host.

- *Alternative: hard-code jsDelivr in the engine.* Rejected: an intranet or a privacy-minded instance could not point the host elsewhere without patching the engine.
- *Alternative: put it in `DEFAULT_MODS`.* Rejected: it is not a default mod setting, and that type names a concept the stage already uses.

### 4. One fetch per file address per page; all files before installing

`buildLibsMethods` gets a second cache, from file address to a promise of its text, shared by every mod in the page. Shipped libraries keep their own cache. A failed fetch leaves the cache, as `forgetFailedCode` does today.

The handler fetches all of a library's files (`Promise.all`) before answering. A failure answers `-32001` and nothing reaches the frame, so a half-installed library is impossible.

The answer for a declared library is `{ name, version, files: [{ path, kind, text }] }`. The loader installs `script` files in order (awaiting each), then `style` files, and resolves the mod's request with `{ name, version, files }`. That last `files` holds only the `data` files, as a mapping from path to text. The mod never receives the text of a script or stylesheet. A case's `requests` record what the mod received, as for any request.

The frame loader's dedupe key becomes the library name for declared libraries. The handler normalises the version: absent, `null` or the declared version all name the same library. That way `{ name }` and `{ name, version: "1.9.4" }` share one install.

### 5. Error text from the host

Library fetches use a small wrapper around the shared fetcher's request. On a non-OK answer whose `content-type` is `text/plain` and whose body is at most 200 characters, it appends the body to the message, as in `libs.load: the library "leaflet" could not be loaded: https://cdn.jsdelivr.net/npm/leaflet@9.9.9/dist/leaflet.js answered 404 Not Found: Couldn't find the requested release version 9.9.9.`. `fetchFile` itself is unchanged, so the messages of tiles and mod files stay as they are. The bundle check uses the same wrapper, so its findings carry the same reason.

### 6. Library stylesheets go before the mod's

The loader installs a library stylesheet as a `<style>` element with the file's text. The policy already allows inline styles, and no `blob:` URL has to be revoked. It inserts the element right after the theme `<style>`, or at the start of `<head>` after the `<meta>` elements when the mod has `theme: "none"`. That puts it before any stylesheet the mod added.

Unlayered library rules still win over the base stylesheet, which lives in the `opentesela` layer. That is what a library such as Leaflet expects.

- *Alternative: append at the end of `<head>`.* Rejected: a mod that styles a library's classes before loading it would lose to the library at equal specificity, and the result would depend on timing.
- *Alternative: a `blob:` `<link>`.* Rejected: the same result with a URL to revoke and a load event to await. Relative `url()` in the CSS breaks either way, which is out of scope.

### 7. No consent, no permission

Declared libraries do not pass through `permissions`. The requests are the app's own (decision 1), to a host the instance chose (decision 3), from a list fixed in the mod file. That gives a mod no channel to send data out, which is what the consent dialog guards. The site consent code is not touched.

### 8. The bundle check fetches every declared file

`mod_bundle_check.ts` fetches each file after the entrypoint, through the same per-page cache. The mount check's `libs.load` is then served from that cache. Each failure is a `bundle` error whose source is the file's address, and any bundle error skips the mount check, as it does today.

### 9. Mod API surface and typings

`mod_api_surface.test.ts` gets a `0.1.10` entry that adds `libraries` to the mod file keys. The guard does not record the inspection's keys or `libs.load`'s params, so those are covered by their own tests. `MOD_API_VERSION` becomes `0.1.10`. `default_mods/mod_api.d.ts` gets `libraries` on the inspection type, so `mod_api_types.test.ts` keeps passing.

## Risks / Trade-offs

- [The npm host is down or blocked, as on networks with allowlists] → `libs.load` answers `-32001` naming the package, the file and the host, and the check reports it. Mods that must work offline declare files next to the mod. The docs say so.
- [Privacy: the npm host sees the user's address and the package names] → documented in the engine README and the mod guide. An instantiation can change the host.
- [No integrity: a compromised npm host could serve other code] → the same trust every site that uses jsDelivr places in it. npm's immutability covers republishing. Integrity can come later as a new optional key, which is why unknown keys are a format error now: an older app must not silently drop a hash.
- [Large data files travel over the channel as text and are recorded in test cases' `requests`] → acceptable for the sizes in view (the 1:110m world is 108 KB). Revisit if a mod needs megabytes.
- [A package whose browser build is ESM only] → a format error for `.mjs`. A `.js` file that is ESM fails to install, and `libs.load` rejects with the frame loader's existing "could not be installed" message. The guide tells authors to pick a UMD/IIFE build.
- [A page that embeds OpenTesela with its own content policy] → it must allow `connect-src` to the npm host. Added to the engine README's hosting note.

## Migration Plan

Additive. Existing mod files have no `libraries` key and load as before. A mod that uses `libraries` declares `api: "^0.1.10"`, so an older app asks the user before starting it. If it runs anyway, it fails with a clear `-32602` from `libs.load`, because the older app ignores the unknown `libraries` key. Rollback is reverting the change; no stored data is involved.
