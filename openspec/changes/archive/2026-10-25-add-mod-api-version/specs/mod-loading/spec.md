## ADDED Requirements

### Requirement: API range in the mod file
The `mod` mapping SHALL accept an optional `api` key whose value is a semver range in npm's syntax. The loaded mod SHALL carry the range as `api`, or `null` when the key is missing. A value that is not a non-empty string, or not a valid range, SHALL fail with a mod format error whose message says that `api` must be a semver range.

#### Scenario: Caret range
- **WHEN** a mod file has `api: "^0.1.0"` under `mod`
- **THEN** the loaded mod's `api` is `"^0.1.0"`

#### Scenario: No api key
- **WHEN** a mod file has only `name: "minimal"`, `version: "0.1.0"` and `entrypoint: "./main.js"` under `mod`
- **THEN** the loaded mod's `api` is `null`

#### Scenario: Not a range
- **WHEN** a mod file has `api: "latest"` under `mod`
- **THEN** loading fails with a mod format error whose message says that `api` must be a semver range

#### Scenario: Range written as a number
- **WHEN** a mod file has `api: 0.1` under `mod`
- **THEN** loading fails with a mod format error whose message says that `api` must be a semver range
