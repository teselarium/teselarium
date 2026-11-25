# default-mod-build Specification

## Purpose

Lets the default mods be written in TypeScript, split into modules and shipped with their tests, while the app serves each one as a plain mod at ./default_mods/<name>/: the build and the dev server bundle each mod's sources into self-contained modules, serve its other files unchanged and leave out source-only files, copy a plain JavaScript mod as it is so it can replace a default mod, and stop with an error that names the files when a mod cannot be built.

## Requirements

### Requirement: Default mods source folder
The repository SHALL keep the default mods' source in a top-level `default_mods/` folder, one subfolder per mod named after the mod. The app SHALL serve each subfolder at `./default_mods/<name>/`, in the dev server and in the built site's `default_mods/<name>/`. Files at the root of `default_mods/` SHALL NOT be mods and SHALL NOT be served.

#### Scenario: Viewer served from its source folder
- **WHEN** the repository has `default_mods/mod_viewer/mod_conf.yaml` and the app is built
- **THEN** the built site has `default_mods/mod_viewer/mod_conf.yaml`
- **AND** the dev server answers `/default_mods/mod_viewer/mod_conf.yaml` with the same content

#### Scenario: Root files are not served
- **WHEN** the repository has `default_mods/README.md` and `default_mods/mod_api.d.ts`, and the app is built
- **THEN** the built site has no `default_mods/README.md` and no `default_mods/mod_api.d.ts`

### Requirement: TypeScript entrypoint
When a mod folder has `src/main.ts`, the build SHALL serve `main.js` in its place: one self-contained ES module that holds `src/main.ts` and every module it imports, with no `import` statement and no dynamic import left.

#### Scenario: Split source becomes one file
- **WHEN** `default_mods/mod_explorer/src/main.ts` imports `./mod_cards.ts`, and the app is built
- **THEN** the built `default_mods/mod_explorer/main.js` has no `import` statement and no `import(` call
- **AND** opening the mod explorer lists the mods of its config

### Requirement: TypeScript tests
When a mod folder has `test/test.ts`, the build SHALL serve `test.js` in its place: one self-contained ES module that holds `test/test.ts` and every module it imports, built as the entrypoint is.

#### Scenario: Test helpers are inlined
- **WHEN** `default_mods/mod_viewer/test/test.ts` imports `./viewer_cases.ts`, and the app is built
- **THEN** the built `default_mods/mod_viewer/test.js` has no `import` statement and no `import(` call

### Requirement: Files that are not shipped
The build SHALL NOT serve a mod folder's `src/` and `test/` folders, its `README.md` or its `tsconfig.json`. It SHALL serve every other file of the folder unchanged, at the same path relative to the folder.

#### Scenario: Source left out, data copied
- **WHEN** a mod folder holds `mod_conf.yaml`, `README.md`, `src/main.ts`, `test/test.ts` and `book_type.md`, and the app is built
- **THEN** its built folder holds exactly `mod_conf.yaml`, `main.js`, `test.js` and `book_type.md`
- **AND** `mod_conf.yaml` and `book_type.md` are byte for byte the source files

### Requirement: Plain mods are copied unchanged
A mod folder without `src/main.ts` and without `test/test.ts` SHALL be served as it is, apart from the files that are not shipped, so a plain JavaScript mod placed in `default_mods/<name>/` replaces a default mod without a build setup of its own.

#### Scenario: Plain viewer replaces the vanilla one
- **WHEN** `default_mods/mod_viewer/` holds only a `mod_conf.yaml` and a hand-written `main.js`, and the app is built
- **THEN** the built `default_mods/mod_viewer/` holds the same two files, unchanged
- **AND** the mod explorer opens that mod as the viewer

### Requirement: Conflicting output names
When a mod folder has `src/main.ts` and also a `main.js`, or `test/test.ts` and also a `test.js`, the build SHALL fail with an error that names the mod folder and both files. The dev server SHALL answer the conflicting file with an error status and the same message.

#### Scenario: Hand-written main.js next to main.ts
- **WHEN** `default_mods/mod_viewer/` has `src/main.ts` and `main.js`, and the app is built
- **THEN** the build fails with an error that names `default_mods/mod_viewer/`, `src/main.ts` and `main.js`

### Requirement: Source that cannot be bundled
When a mod's TypeScript source cannot be bundled, for example because of a syntax error or a missing import, the build SHALL fail with an error that names the mod folder and the source file. The dev server SHALL answer the requested file with an error status and that message, so that opening or checking the mod reports a file that cannot be loaded.

#### Scenario: Syntax error while building
- **WHEN** `default_mods/mod_explorer/src/main.ts` has a syntax error and the app is built
- **THEN** the build fails with an error that names `default_mods/mod_explorer/` and `src/main.ts`

#### Scenario: Syntax error in dev
- **WHEN** the dev server runs, `default_mods/mod_explorer/src/main.ts` has a syntax error, and the Mods section is opened
- **THEN** the request for `/default_mods/mod_explorer/main.js` answers with an error status, and the stage reports that the entrypoint cannot be loaded

### Requirement: Same mods in dev and build
For each file it serves under `./default_mods/`, the dev server SHALL answer with the content the build gives that file. After a file of a mod folder changes, the dev server's next answers for that mod SHALL come from the changed files, without a restart.

#### Scenario: Edit while the dev server runs
- **WHEN** the dev server runs, the mod viewer's `src/main.ts` is changed, and the mod viewer is opened again
- **THEN** the mod viewer runs the changed code

### Requirement: Old default mods folder
When `public/default_mods/` exists, the build and the dev server SHALL fail at start with an error that names `public/default_mods/` and says that default mods now live in `default_mods/` at the repository's root.

#### Scenario: Fork with the old folder
- **WHEN** the repository has `public/default_mods/mod_viewer/mod_conf.yaml` and the app is built
- **THEN** the build fails with an error that names `public/default_mods/` and `default_mods/`
