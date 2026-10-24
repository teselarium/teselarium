## ADDED Requirements

### Requirement: Test file in the mod file
The `mod` mapping SHALL accept an optional `test_path` key, a non-empty string resolved against the mod file's location. The loaded mod SHALL carry the resolved address as `testSource`, or `null` when the key is missing. Loading a mod SHALL NOT request the test file. A `test_path` that is not a non-empty string SHALL fail with a mod format error whose message says that `test_path` must be a non-empty string.

#### Scenario: Test file next to the mod file
- **WHEN** the mod at `https://example.org/mods/clock/mod_conf.yaml` declares `test_path: "./test.js"`
- **THEN** the loaded mod's `testSource` is `https://example.org/mods/clock/test.js`
- **AND** the test file is not requested

#### Scenario: No test file
- **WHEN** a mod file has only `name: "minimal"`, `version: "0.1.0"` and `entrypoint: "./main.js"` under `mod`
- **THEN** the loaded mod's `testSource` is `null`

#### Scenario: Empty test path
- **WHEN** a mod file has `test_path: ""`
- **THEN** loading fails with a mod format error whose message says that `test_path` must be a non-empty string
