# Proposal

## Why

The `mod-loading` requirement "Permission hosts are origins" grew to about 640 characters when `allow-wildcard-permission-hosts` added wildcard hosts to it, and it now states three rules at once: hosts are origins, wildcard hosts are allowed outside `open`, and `"*"` is allowed in `open`. `openspec validate --specs --strict` fails on it (`Requirement text is very long (>500 characters)`), the only one of the 18 main specs that does.

## What Changes

- **Split into three requirements, with the same meaning**:
  - "Permission host format", which replaces "Permission hosts are origins", keeps the origin rule and the format error for any other value, and names the two exceptions without spelling them out. The new name is needed because OpenSpec does not let a modified requirement drop scenarios, nor a requirement be removed and added under the same name: the old one is removed and this one added.
  - "Wildcard hosts outside open", new, holds the wildcard host rule: allowed in `show`, `connect`, `embed` and `code`, `*.` as the whole leftmost label followed by at least two labels, a `*` anywhere else rejected, and a wildcard host in `open` rejected.
  - "Any site in open", new, holds the `"*"` rule.
- **Scenarios move to the rule they test**: "Host with a port", "Host with a path" and "Other scheme" go to "Permission host format"; the six wildcard scenarios move to "Wildcard hosts outside open"; "Any site for open" and "Any site outside open" move to "Any site in open". No scenario is added, removed or reworded.
- **No behavior change**: every host the mod file accepts or rejects today, and every message, stays the same.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mod-loading`: "Permission hosts are origins" is removed; "Permission host format", "Wildcard hosts outside open" and "Any site in open" are added, holding its rules and its eleven scenarios.

## Impact

- **Specs**: `openspec/specs/mod-loading/spec.md` at archive time. `openspec validate --specs --strict` passes for all 18 specs.
- **Code, tests and docs**: none. The unit tests in `src/lib/mod/mod_permissions.test.ts` are grouped by function, not by requirement, and `docs/modules/lib/mod/README.md` already lists the three rules as separate points.
- **Mod API version**: no bump. The change touches `mod-loading`'s mod file format only in how its spec is worded: the hosts the format accepts and rejects, and their messages, do not change, so no mod sees a difference.
- **App version**: no bump. The changeset is empty, as the change ships nothing to the people who use or instantiate the app.
