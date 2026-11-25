/**
 * The tiles mod: a mod the e2e tests own (e2e/test_mods.ts), so the tests of
 * the engine, the stage, the default mods and the app need no shipped sample.
 *
 * It lists each tile as an `<li>` with its title and, while the config's
 * `show_images` is on, its image. Without tiles, it shows the config's
 * `empty_text` as a status. It reads the storage key `starts` when it
 * mounts, shows it, and writes it back one higher. It keeps its engine API
 * object and its mount context on `globalThis.probe`, so a test can send
 * requests as this mod.
 */

const STARTS_KEY = "starts";
const DEFAULT_EMPTY_TEXT = "There are no tiles.";

function readTileTitle(tile) {
  const title = tile.metadata.title;
  if (typeof title !== "string") {
    return tile.source;
  }
  return title;
}

function shouldShowImage(view, tile) {
  return (
    view.config.show_images === true && typeof tile.metadata.image === "string"
  );
}

function buildTileImage(tile) {
  const image = document.createElement("img");
  image.alt = `Image of ${readTileTitle(tile)}`;
  image.src = tile.metadata.image;
  return image;
}

function buildTileItem(view, tile) {
  const item = document.createElement("li");
  if (shouldShowImage(view, tile)) {
    item.append(buildTileImage(tile));
  }
  const title = document.createElement("span");
  title.textContent = readTileTitle(tile);
  item.append(title);
  return item;
}

function readEmptyText(config) {
  if (typeof config.empty_text !== "string") {
    return DEFAULT_EMPTY_TEXT;
  }
  return config.empty_text;
}

function buildTileContent(view) {
  if (view.tiles.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.setAttribute("role", "status");
    emptyMessage.textContent = readEmptyText(view.config);
    return emptyMessage;
  }
  const tileList = document.createElement("ul");
  for (const tile of view.tiles) {
    tileList.append(buildTileItem(view, tile));
  }
  return tileList;
}

function buildStartsText(starts) {
  const startsText = document.createElement("p");
  startsText.dataset.starts = String(starts);
  startsText.textContent = `Started ${starts} times before`;
  return startsText;
}

function renderTiles(view) {
  const heading = document.createElement("h1");
  heading.textContent = view.title;
  view.main.replaceChildren(
    heading,
    buildStartsText(view.starts),
    buildTileContent(view),
  );
}

function showChangedTiles(view, params) {
  view.tiles = params.tiles;
  renderTiles(view);
}

/** The starts stored before this one: the stored number, or 0 for anything else. */
function readStarts(stored) {
  if (typeof stored !== "number") {
    return 0;
  }
  return stored;
}

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(engine, context) {
  globalThis.probe = { engine, context };
  const view = {
    main: document.createElement("main"),
    title: context.mod.title,
    config: context.config,
    tiles: context.tiles,
    starts: 0,
  };
  engine.on("tiles.changed", showChangedTiles.bind(undefined, view));
  document.body.replaceChildren(view.main);
  view.starts = readStarts(
    await engine.request("storage.get", { key: STARTS_KEY }),
  );
  renderTiles(view);
  await engine.request("storage.set", {
    key: STARTS_KEY,
    value: view.starts + 1,
  });
}
