# Spec Delta

## ADDED Requirements

### Requirement: Theme setting in the mod file
The `mod` mapping SHALL accept an optional `theme` key whose value is `"default"` or `"none"`, defaulting to `"default"`. The loaded mod SHALL carry the value as `theme`. Any other value SHALL fail with a mod format error whose message says that `theme` must be `"default"` or `"none"`.

#### Scenario: No theme key
- **WHEN** a mod file has only `name: "minimal"`, `version: "0.1.0"` and `entrypoint: "./main.js"` under `mod`
- **THEN** the loaded mod's `theme` is `"default"`

#### Scenario: Opt out
- **WHEN** a mod file has `theme: "none"` under `mod`
- **THEN** the loaded mod's `theme` is `"none"`

#### Scenario: Unknown theme value
- **WHEN** a mod file has `theme: "dark"` under `mod`
- **THEN** loading fails with a mod format error whose message says that `theme` must be `"default"` or `"none"`
