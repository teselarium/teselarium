# Spec Delta

## ADDED Requirements

### Requirement: Sites links ask as their mosaic does
For a sandbox opened with `sites` naming a mosaic file served from another origin, the app SHALL ask about the mosaic's `show` lines, show them in their own group, and remember the answer for that mosaic file exactly as for a mod opened from that mosaic. A decision remembered for that mosaic file, whichever mod it was given with, SHALL apply without asking.

#### Scenario: Remembered from the mosaic
- **WHEN** the user allowed a foreign mosaic's lines with Remember checked while opening that mosaic, then opens a run link to another mod with that mosaic as `sites`
- **THEN** the new sandbox starts without the site consent dialog, with the mosaic's lines granted

#### Scenario: Asked once for a new mosaic
- **WHEN** a run link has `sites` naming a foreign mosaic with no remembered decision
- **THEN** the site consent dialog shows the mosaic's lines in a group that names the mosaic's title and address, before the mod's frame is created
