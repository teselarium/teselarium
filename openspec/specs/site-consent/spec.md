# site-consent Specification

## Purpose

Lets the user decide which sites a mod from another origin may use: the app asks once in its own dialog before the mod starts, applies the answer to the mod's permissions, and can remember it for that mod until the user removes it in Settings.

## Requirements

### Requirement: Ask before a mod from another origin starts
When a mod whose mod file is served from another origin than the app declares a permission that has no remembered decision for that mod, the app SHALL show the site consent dialog before the mod's frame is created. The dialog SHALL be drawn by the app, outside every frame. A mod from the app's origin, a mod that declares no permission and a mod whose every declared permission has a remembered decision SHALL start without it.

#### Scenario: Foreign mod with a declared permission
- **WHEN** the user opens a mod at `https://mods.example.net/probe/mod_conf.yaml` that declares `show` for `https://upload.wikimedia.org`, with no remembered decision
- **THEN** the site consent dialog is shown and the mod has no frame yet

#### Scenario: Mod from the app's origin
- **WHEN** the user opens a mod served from the app's origin that declares `show` for a host
- **THEN** no site consent dialog is shown and images from that host load

#### Scenario: Foreign mod without permissions
- **WHEN** the user opens a mod from another origin that declares no permission
- **THEN** no site consent dialog is shown and the mod starts

### Requirement: What the dialog lists
The dialog SHALL name the mod by its title and the address of its mod file. It SHALL list one line for each declared category and host that has no remembered decision for that mod, with the category's verb, the host (`"*"` read as "any site") and the mod's reason, shown as plain text that the mod wrote. Each line SHALL have a checkbox labeled with the category's verb and the host, checked when the dialog opens.

#### Scenario: Lines of a foreign mod
- **WHEN** the dialog is shown for a mod that declares `show` for `https://upload.wikimedia.org` with reason `"Shows the book covers"` and `open` for `"*"` with reason `"Opens the mods you pick"`
- **THEN** it lists `show content from https://upload.wikimedia.org` with `Shows the book covers`, and `open mods from any site` with `Opens the mods you pick`, both checked

#### Scenario: Markup in a reason
- **WHEN** a mod's reason is `<b>Needed</b>`
- **THEN** the dialog shows the text `<b>Needed</b>`, not bold text

### Requirement: The dialog states the cost
The dialog SHALL say that each site the user allows can see that the user used this mod. When a listed line's category is `connect` or `code`, it SHALL also say that those sites can receive what the mod shows or keeps.

#### Scenario: Show only
- **WHEN** the dialog lists only `show` lines
- **THEN** it says that the allowed sites can see that the user used this mod, and says nothing about receiving data

#### Scenario: A connect line
- **WHEN** the dialog lists a `connect` line for `https://api.example.net`
- **THEN** it also says that the sites allowed to exchange data or load code can receive what the mod shows or keeps

### Requirement: Allow grants the checked lines
Choosing **Allow** SHALL grant the checked lines and refuse the unchecked ones, then start the mod. A granted line SHALL be granted as for a mod from the app's origin: its host allowed for the requests of its category, and listed in the mount context's `permissions.granted`.

#### Scenario: Allowed covers load
- **WHEN** the user leaves `show content from https://upload.wikimedia.org` checked and chooses Allow
- **THEN** the mod starts, images from `https://upload.wikimedia.org` load, and `context.permissions.granted` holds that permission

#### Scenario: One line unchecked
- **WHEN** the dialog lists `show` for `https://upload.wikimedia.org` and `connect` for `https://api.example.net`, the user unchecks the `connect` line and chooses Allow
- **THEN** the images load, a `fetch` to `https://api.example.net` is blocked, and `context.permissions.denied` holds the `connect` permission

### Requirement: Show without them refuses the listed lines
Choosing **Show without them** SHALL refuse every line the dialog lists, whether checked or not, and start the mod. Pressing Escape SHALL do the same without remembering anything. A mod started this way SHALL run as a mod from another origin ran before this change, except for lines allowed by a remembered decision.

#### Scenario: Run without the covers
- **WHEN** the user chooses Show without them for a mod that declares `show` for `https://upload.wikimedia.org`
- **THEN** the mod starts, images from `https://upload.wikimedia.org` are blocked, and a warning issue names the permission

#### Scenario: Escape
- **WHEN** the user presses Escape in the dialog with Remember checked
- **THEN** the mod starts without the listed permissions, and the dialog is shown again the next time the mod is opened

### Requirement: Remember keeps the answer for that mod
The dialog SHALL have a **Remember** checkbox, unchecked when it opens. With it checked, Allow and Show without them SHALL keep one decision per listed line, allowed or refused, for that mod file's address, category and host. A remembered decision SHALL apply only to the mod file at that address. A declared permission without a remembered decision SHALL still be asked.

#### Scenario: Remembered allow
- **WHEN** the user checks Remember, chooses Allow, closes the mod and opens the same mod again
- **THEN** no dialog is shown and the covers load

#### Scenario: Remembered refusal
- **WHEN** the user checks Remember, chooses Show without them and opens the same mod again
- **THEN** no dialog is shown and the covers are blocked

#### Scenario: Another mod declares the same site
- **WHEN** a decision is remembered for `show` `https://upload.wikimedia.org` of the mod at `https://mods.example.net/probe/mod_conf.yaml`, and the user opens a mod at `https://mods.example.net/other/mod_conf.yaml` that declares the same permission
- **THEN** the dialog is shown for the other mod

#### Scenario: A new permission in a later version
- **WHEN** a mod with a remembered decision for `show` `https://upload.wikimedia.org` is updated at the same address to also declare `connect` for `https://api.example.net`
- **THEN** the dialog lists only the `connect` line, and the remembered `show` decision applies without asking

### Requirement: Remembered decisions are kept in the app's storage
Remembered decisions SHALL be kept in the app's storage, under a key that no mod storage slot can use, and restored when the app is opened again. A stored entry that is not a valid decision SHALL be ignored and dropped. When the storage cannot be read or written, decisions SHALL still apply until the page is closed.

#### Scenario: Kept after a reload
- **WHEN** the user remembers Allow for a mod, reloads the app page and opens the mod again
- **THEN** no dialog is shown and the covers load

#### Scenario: Storage cannot be written
- **WHEN** writing to the app's storage fails and the user remembers Allow for a mod
- **THEN** opening the mod again in the same page shows no dialog, and no error is shown

#### Scenario: Mods cannot reach the decisions
- **WHEN** a decision is remembered and a running mod sends `storage.get` with any key
- **THEN** the result is never the stored decisions

### Requirement: The dialog waits for its mod to be visible
The dialog SHALL be shown only while its mod's sandbox is the visible one, and the mod SHALL stay unstarted until the user answers. When a mod written for another mod API also needs consent, the app SHALL ask about the mod API first; choosing Cancel there SHALL leave the mod unstarted without showing the site consent dialog.

#### Scenario: Opened by another mod
- **WHEN** the mod explorer opens a foreign mod that declares a permission
- **THEN** the new sandbox is visible and shows the site consent dialog

#### Scenario: Another API first
- **WHEN** a foreign mod written for another mod API and declaring a permission is opened, and the user chooses Run anyway
- **THEN** the site consent dialog is shown next

#### Scenario: Cancelled for another API
- **WHEN** the user chooses Cancel in the mod API question of such a mod
- **THEN** no site consent dialog is shown and the mod does not start

### Requirement: Checks and inspection never ask
`mods.inspect`, `mods.check` and the checks the app runs SHALL never show the site consent dialog. For a mod from another origin, they SHALL treat each declared permission with a remembered allow as granted, and every other one as denied.

#### Scenario: Inspect a foreign mod with a remembered allow
- **WHEN** the user remembered Allow for `show` `https://upload.wikimedia.org` of a foreign mod, and the mod explorer inspects that mod
- **THEN** no dialog is shown and the result's `permissions.granted` holds that permission

#### Scenario: Check a foreign mod without decisions
- **WHEN** a mod checks a foreign mod that declares `show` for `https://upload.wikimedia.org`, with no remembered decision
- **THEN** no dialog is shown, and the check mounts the mod with that permission denied

### Requirement: Ask before a foreign mosaic's permissions apply
When a mod is opened from a mosaic whose mosaic file is served from another origin than the app, and the mosaic declares a `show` line that has no remembered decision for that mosaic, the app SHALL show the site consent dialog before the mod's frame is created. A mosaic from the app's origin SHALL get its lines without asking. One dialog SHALL ask about the mod's lines and the mosaic's lines together.

#### Scenario: Foreign mosaic with a cover host
- **WHEN** the user opens a mosaic at `https://mosaics.example.net/maps/mosaic.yaml` that declares `show` for `https://covers.openlibrary.org`, with a mod from the app's origin and no remembered decision
- **THEN** the site consent dialog is shown, lists only the mosaic's line, and the mod has no frame yet

#### Scenario: Mosaic from the app's origin
- **WHEN** the user opens a mosaic served from the app's origin that declares `show` for a host
- **THEN** no site consent dialog is shown and images from that host load

#### Scenario: Foreign mosaic and foreign mod
- **WHEN** both the mosaic and its mod are served from other origins and each declares a line without a remembered decision
- **THEN** one dialog lists both lines

### Requirement: The dialog shows the mosaic's lines apart
When the dialog lists lines of a mosaic, it SHALL show them in a group of their own, after the mod's lines, that names the mosaic by its title and the address of its mosaic file. Each line SHALL show the verb, the host and the mosaic's reason as plain text, with a checkbox checked when the dialog opens. Allow, Show without them and Escape SHALL apply to the mosaic's lines as to the mod's.

#### Scenario: Lines of the mod and of the mosaic
- **WHEN** the dialog lists the mod's `show` for `https://upload.wikimedia.org` and the mosaic's `show` for `https://covers.openlibrary.org` with reason `"Shows the book covers"`
- **THEN** the mod's line is listed under the mod's title and address, and the mosaic's line under the mosaic's title and address, as `show content from https://covers.openlibrary.org` with `Shows the book covers`

#### Scenario: Allow with the mosaic's line unchecked
- **WHEN** the user unchecks the mosaic's line and chooses Allow
- **THEN** the mod's line is granted, the mosaic's line is refused, and images from `https://covers.openlibrary.org` are blocked

### Requirement: Remember keeps the answer for that mosaic
With **Remember** checked, Allow and Show without them SHALL keep one decision per listed mosaic line for that mosaic file's address, category and host, apart from the mod's decisions. A remembered mosaic decision SHALL apply only to the mosaic file at that address, whatever mod it names, and SHALL be kept and restored as the mod decisions are.

#### Scenario: Remembered mosaic allow
- **WHEN** the user checks Remember, allows the mosaic's line, closes the sandbox and opens the same mosaic again
- **THEN** no dialog is shown and the covers load

#### Scenario: Another mosaic with the same host
- **WHEN** a decision is remembered for `show` `https://covers.openlibrary.org` of one mosaic, and the user opens another mosaic file that declares the same line
- **THEN** the dialog is shown for the other mosaic

#### Scenario: Same mod without the mosaic
- **WHEN** a decision is remembered for a mosaic's line and the user opens a run link to the mosaic's mod alone
- **THEN** that decision is not applied to the mod

### Requirement: Inspecting a mosaic never asks
`mosaics.inspect` SHALL never show the site consent dialog. For a mosaic from another origin, it SHALL treat each `show` line with a remembered allow for that mosaic as granted, and every other one as denied.

#### Scenario: Inspect a foreign mosaic without decisions
- **WHEN** a mod inspects a foreign mosaic that declares `show` for `https://covers.openlibrary.org`, with no remembered decision
- **THEN** no dialog is shown and the result's `permissions.denied` holds that line

### Requirement: Sites links ask as their mosaic does
For a sandbox opened with `sites` naming a mosaic file served from another origin, the app SHALL ask about the mosaic's `show` lines, show them in their own group, and remember the answer for that mosaic file exactly as for a mod opened from that mosaic. A decision remembered for that mosaic file, whichever mod it was given with, SHALL apply without asking.

#### Scenario: Remembered from the mosaic
- **WHEN** the user allowed a foreign mosaic's lines with Remember checked while opening that mosaic, then opens a run link to another mod with that mosaic as `sites`
- **THEN** the new sandbox starts without the site consent dialog, with the mosaic's lines granted

#### Scenario: Asked once for a new mosaic
- **WHEN** a run link has `sites` naming a foreign mosaic with no remembered decision
- **THEN** the site consent dialog shows the mosaic's lines in a group that names the mosaic's title and address, before the mod's frame is created
