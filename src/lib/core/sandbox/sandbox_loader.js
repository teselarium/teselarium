// The frame loader: the only script the app puts in a running mod's frame.
// It receives the mod's code and context from the engine, gives the mod its
// engine API object and mounts the mod. In the frames of a check's tests,
// the assertions and the test runner follow it in the same module script and
// add their modes to `frameModes`. Inlined as text in the sandbox document,
// so it must never contain a closing script tag.

const CONNECT_METHOD = "sandbox.connect";
const BLOCKED_METHOD = "sandbox.blocked";
const MOUNT_FAILED_METHOD = "sandbox.mountFailed";
const MOUNTED_METHOD = "sandbox.mounted";
const DIALOG_BLOCKED_METHOD = "sandbox.dialogBlocked";
const THEME_CHANGED_METHOD = "theme.changed";
const LAYOUT_CHANGED_METHOD = "layout.changed";
// The layouts a frame can have; the attribute ignores anything else.
const FRAME_LAYOUTS = Object.freeze(["contained", "theater", "fullscreen"]);
const RENDER_BODY_METHOD = "tiles.renderBody";
const OPEN_LINK_METHOD = "links.open";
const OPEN_PLAYER_METHOD = "players.open";
const LOAD_LIBRARY_METHOD = "libs.load";

const TILE_BODY_ELEMENT = "ot-tile-body";
const RENDERED_EVENT = "ot-rendered";
const DIAGRAMS_DRAWN_EVENT = "ot-diagrams-drawn";
// The values of the element's `diagrams` property.
const DRAW_DIAGRAMS = "draw";
const KEEP_DIAGRAM_SOURCES = "source";
const MERMAID_BLOCK_SELECTOR = "pre > code.language-mermaid";
const DIAGRAM_SELECTOR = "figure[data-mermaid-source]";
const MERMAID_LIBRARY = Object.freeze({ name: "mermaid", version: "12" });
const DIAGRAM_ID_PREFIX = "ot-mermaid-";
// Marks a block in the queue, which the base stylesheet pulses.
const BUSY_ATTRIBUTE = "aria-busy";
// The mermaid theme variables, each drawn from a theme token.
const MERMAID_THEME_TOKENS = Object.freeze({
  background: "--ot-background",
  primaryColor: "--ot-card",
  primaryTextColor: "--ot-foreground",
  primaryBorderColor: "--ot-border",
  lineColor: "--ot-muted-foreground",
  secondaryColor: "--ot-muted",
  tertiaryColor: "--ot-accent",
  fontFamily: "--ot-font-sans",
});
// The token of the shadow mermaid's neo look draws under nodes: its base
// theme's light gray would glow on a dark background.
const MERMAID_SHADOW_TOKEN = "--ot-border";
// The option kept out of a diagram's own configuration, besides mermaid's own list.
const MERMAID_SECURE_OPTION = "htmlLabels";
// The prefix of the ids of a rendered body, which its `#…` links leave out.
const HEADING_ID_PREFIX = "user-content-";

// Where library stylesheets go: after the theme styles, or after the
// `<meta>` elements of a mod without them. Read when the loader starts,
// before the mod can add any stylesheet, so the mod's styles always follow
// the libraries' and win at equal specificity.
function findLibraryStyleAnchor() {
  const themeStyle = document.head.querySelector("style");
  if (themeStyle !== null) {
    return themeStyle;
  }
  const metas = document.head.querySelectorAll("meta");
  return metas.item(metas.length - 1);
}

const loader = {
  port: null,
  pendingReports: [],
  nextRequestId: 1,
  pendingRequests: new Map(),
  eventHandlers: new Map(),
  // The mount context, kept until `mount` is called so a theme or layout change can still reach it.
  context: null,
  mounted: false,
  // The newest theme, from the connect message and every theme change: the colors of the diagrams.
  theme: null,
  // The libraries installed or being installed in this frame, by name and version.
  libraries: new Map(),
  // The declared libraries installed or being installed in this frame, by
  // name: `{ version, installing }`. Requests that name the same library
  // share one install, whatever version spelling they use.
  declaredLibraries: new Map(),
  // The element the next library stylesheet goes after.
  lastLibraryStyle: findLibraryStyleAnchor(),
  // The diagram state of each connected tile body element, redrawn on a theme change.
  tileBodies: new Set(),
};

function sendNotification(method, params) {
  const notification = { jsonrpc: "2.0", method, params };
  loader.port.postMessage(notification);
}

function reportViolation(event) {
  const params = {
    blockedUrl: event.blockedURI,
    directive: event.effectiveDirective,
  };
  if (loader.port === null) {
    loader.pendingReports.push(params);
    return;
  }
  sendNotification(BLOCKED_METHOD, params);
}

function reportBlockedDialog(name) {
  sendNotification(DIALOG_BLOCKED_METHOD, { name });
}

// The sandbox has no allow-modals, so the browser shows none of these. The
// replacements return what the blocked originals return, and report the call
// so the mod's issue list says what to use instead. Methods, so each keeps
// the original's name.
const blockedDialogs = {
  alert() {
    reportBlockedDialog("alert");
    return undefined;
  },
  confirm() {
    reportBlockedDialog("confirm");
    return false;
  },
  prompt() {
    reportBlockedDialog("prompt");
    return null;
  },
  print() {
    reportBlockedDialog("print");
    return undefined;
  },
};

function replaceBlockedDialogs() {
  window.alert = blockedDialogs.alert;
  window.confirm = blockedDialogs.confirm;
  window.prompt = blockedDialogs.prompt;
  window.print = blockedDialogs.print;
}

function sendEngineRequest(method, params) {
  const id = loader.nextRequestId;
  loader.nextRequestId += 1;
  const pendingRequest = Promise.withResolvers();
  const request = { jsonrpc: "2.0", id, method, params: params ?? {} };
  try {
    loader.port.postMessage(request);
    loader.pendingRequests.set(id, pendingRequest);
  } catch (error) {
    pendingRequest.reject(error);
  }
  return pendingRequest.promise;
}

// Every request of the frame goes through here: the mod's, the test
// runner's and the tile body element's. `libs.load` is answered by the
// loader, which installs the code and gives the rest.
function requestEngine(method, params) {
  if (method === LOAD_LIBRARY_METHOD) {
    return requestLibrary(params);
  }
  return sendEngineRequest(method, params);
}

function buildLibraryKey(params) {
  const libraryKey = JSON.stringify([params?.name, params?.version]);
  return libraryKey;
}

function forgetLibrary(libraryKey, error) {
  loader.libraries.delete(libraryKey);
  throw error;
}

// The install of a declared library this request names: absent, `null` or
// the declared version all name it. Any other version goes to the engine,
// which refuses it.
function findDeclaredInstall(params) {
  const declared = loader.declaredLibraries.get(params?.name);
  if (declared === undefined) {
    return undefined;
  }
  const version = params?.version;
  if (
    version === undefined ||
    version === null ||
    version === declared.version
  ) {
    return declared.installing;
  }
  return undefined;
}

// A frame receives a library once: a second request shares the first one's
// promise. A failed request is forgotten, so a later one asks again.
function requestLibrary(params) {
  const declaredInstall = findDeclaredInstall(params);
  if (declaredInstall !== undefined) {
    return declaredInstall;
  }
  const libraryKey = buildLibraryKey(params);
  const pendingLibrary = loader.libraries.get(libraryKey);
  if (pendingLibrary !== undefined) {
    return pendingLibrary;
  }
  const library = sendEngineRequest(LOAD_LIBRARY_METHOD, params)
    .then(installLibraryAnswer)
    .catch(forgetLibrary.bind(undefined, libraryKey));
  loader.libraries.set(libraryKey, library);
  return library;
}

// A shipped library answers its `code`, a declared one its `files`.
function installLibraryAnswer(result) {
  if (Array.isArray(result?.files)) {
    return installDeclaredLibraryOnce(result);
  }
  return installLibrary(result);
}

function forgetDeclaredLibrary(name, error) {
  loader.declaredLibraries.delete(name);
  throw error;
}

// Two requests sent before either was answered get one install: the second
// answer shares the install of the first.
function installDeclaredLibraryOnce(result) {
  const declared = loader.declaredLibraries.get(result.name);
  if (declared !== undefined) {
    return declared.installing;
  }
  const installing = installDeclaredLibrary(result).catch(
    forgetDeclaredLibrary.bind(undefined, result.name),
  );
  loader.declaredLibraries.set(result.name, {
    version: result.version,
    installing,
  });
  return installing;
}
// The script could not be loaded, or threw while it ran. Errors of other scripts are ignored.
function rejectLibraryScript(installing, libraryName, codeUrl, event) {
  if (event instanceof ErrorEvent && event.filename !== codeUrl) {
    return;
  }
  const reason = event instanceof ErrorEvent ? `: ${event.message}` : "";
  installing.reject(
    new Error(
      `${LOAD_LIBRARY_METHOD}: the library "${libraryName}" could not be installed${reason}`,
    ),
  );
}

function stopWatchingScriptErrors(rejectScript) {
  window.removeEventListener("error", rejectScript);
}

// A classic script, so the library's top-level names become globals:
// mermaid's single-file build fails as a module.
function runClassicScript(codeUrl, libraryName) {
  const installing = Promise.withResolvers();
  const rejectScript = rejectLibraryScript.bind(
    undefined,
    installing,
    libraryName,
    codeUrl,
  );
  const script = document.createElement("script");
  script.addEventListener("load", installing.resolve);
  script.addEventListener("error", rejectScript);
  window.addEventListener("error", rejectScript);
  script.src = codeUrl;
  document.head.append(script);
  return installing.promise.finally(
    stopWatchingScriptErrors.bind(undefined, rejectScript),
  );
}

async function installScriptText(code, libraryName) {
  const codeBlob = new Blob([code], { type: "text/javascript" });
  const codeUrl = URL.createObjectURL(codeBlob);
  try {
    await runClassicScript(codeUrl, libraryName);
  } finally {
    URL.revokeObjectURL(codeUrl);
  }
}

// The mod receives the name and version, never the code.
async function installLibrary(result) {
  await installScriptText(result.code, result.name);
  const library = { name: result.name, version: result.version };
  return library;
}

// After the theme styles and the stylesheets of earlier libraries, so the
// libraries keep their order and every stylesheet the mod added follows them.
function installStyleText(text) {
  const style = document.createElement("style");
  style.textContent = text;
  if (loader.lastLibraryStyle?.isConnected === true) {
    loader.lastLibraryStyle.after(style);
  } else {
    document.head.prepend(style);
  }
  loader.lastLibraryStyle = style;
}

function listFilesOfKind(files, kind) {
  const filesOfKind = [];
  for (const file of files) {
    if (file.kind === kind) {
      filesOfKind.push(file);
    }
  }
  return filesOfKind;
}

// The data files as a mapping from path to text, with own properties only.
function buildDataFiles(files) {
  const entries = [];
  for (const file of listFilesOfKind(files, "data")) {
    entries.push([file.path, file.text]);
  }
  return Object.fromEntries(entries);
}

// The scripts in order, each run before the next, then the stylesheets.
// The mod receives the name, the version and the data files, never the
// text of a script or a stylesheet.
async function installDeclaredLibrary(result) {
  for (const file of listFilesOfKind(result.files, "script")) {
    await installScriptText(file.text, result.name);
  }
  for (const file of listFilesOfKind(result.files, "style")) {
    installStyleText(file.text);
  }
  const library = {
    name: result.name,
    version: result.version,
    files: buildDataFiles(result.files),
  };
  return library;
}

function onEngineEvent(event, handler) {
  const handlers = loader.eventHandlers.get(event) ?? [];
  handlers.push(handler);
  loader.eventHandlers.set(event, handlers);
}

const engine = Object.freeze({ request: requestEngine, on: onEngineEvent });

function buildResponseError(responseError) {
  const error = new Error(responseError.message);
  error.code = responseError.code;
  return error;
}

function settleRequest(response) {
  const pendingRequest = loader.pendingRequests.get(response.id);
  if (pendingRequest === undefined) {
    return;
  }
  loader.pendingRequests.delete(response.id);
  if (response.error !== undefined) {
    pendingRequest.reject(buildResponseError(response.error));
    return;
  }
  pendingRequest.resolve(response.result);
}

function callEventHandler(handler, params) {
  try {
    handler(params);
  } catch (error) {
    console.error(error);
  }
}

function dispatchNotification(notification) {
  // A copy, so a handler registered while dispatching waits for the next event.
  const handlers = (
    loader.eventHandlers.get(notification.method) ?? []
  ).slice();
  for (const handler of handlers) {
    callEventHandler(handler, notification.params);
  }
}

function isTheme(theme) {
  return (
    typeof theme === "object" &&
    theme !== null &&
    (theme.colorScheme === "light" || theme.colorScheme === "dark")
  );
}

// The attribute selects the theme tokens. Anything but a light or dark theme is ignored.
function applyColorScheme(theme) {
  if (!isTheme(theme)) {
    return;
  }
  document.documentElement.dataset.otColorScheme = theme.colorScheme;
}

// Before the mod's handlers run: they read the new attribute, a mod still
// being imported mounts with the newest theme, and the diagrams are drawn
// again with its colors.
function applyThemeChanged(theme) {
  applyColorScheme(theme);
  if (!isTheme(theme)) {
    return;
  }
  loader.theme = theme;
  if (!loader.mounted && loader.context !== null) {
    loader.context.theme = theme;
  }
  redrawTileBodies();
}

function isFrameLayout(layout) {
  return FRAME_LAYOUTS.includes(layout);
}

// The attribute the base stylesheet's width limit follows. Anything but one
// of the three layouts is ignored.
function applyLayout(layout) {
  if (!isFrameLayout(layout)) {
    return;
  }
  document.documentElement.dataset.otLayout = layout;
}

// Before the mod's handlers run: they read the new attribute, and a mod still
// being imported mounts with the newest layout.
function applyLayoutChanged(params) {
  const layout = params?.layout;
  applyLayout(layout);
  if (!isFrameLayout(layout)) {
    return;
  }
  if (!loader.mounted && loader.context !== null) {
    loader.context.layout = layout;
  }
}

function handlePortMessage(event) {
  const message = event.data;
  if (typeof message !== "object" || message === null) {
    return;
  }
  if (message.id !== undefined && message.id !== null) {
    settleRequest(message);
    return;
  }
  if (message.method === THEME_CHANGED_METHOD) {
    applyThemeChanged(message.params);
  }
  if (message.method === LAYOUT_CHANGED_METHOD) {
    applyLayoutChanged(message.params);
  }
  if (typeof message.method === "string") {
    dispatchNotification(message);
  }
}

function isConnectMessage(event) {
  const data = event.data;
  const isNotification =
    typeof data === "object" &&
    data !== null &&
    data.jsonrpc === "2.0" &&
    data.method === CONNECT_METHOD &&
    data.id === undefined;
  return (
    event.source === window.parent && isNotification && event.ports.length === 1
  );
}

function describeError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function importModCode(code) {
  const codeBlob = new Blob([code], { type: "text/javascript" });
  const codeUrl = URL.createObjectURL(codeBlob);
  try {
    const modModule = await import(codeUrl);
    return modModule;
  } finally {
    URL.revokeObjectURL(codeUrl);
  }
}

async function mountMod(code) {
  const modModule = await importModCode(code);
  if (typeof modModule.default !== "function") {
    throw new Error("the entrypoint has no default export function");
  }
  loader.mounted = true;
  await modModule.default(engine, loader.context);
  // Sent only once `mount` resolved: a failure is reported as mountFailed instead.
  sendNotification(MOUNTED_METHOD, {});
}

function reportMountFailure(error) {
  sendNotification(MOUNT_FAILED_METHOD, { message: describeError(error) });
}

function flushPendingReports() {
  for (const params of loader.pendingReports) {
    sendNotification(BLOCKED_METHOD, params);
  }
  loader.pendingReports = [];
}

function startMountMode(params) {
  mountMod(params.code).catch(reportMountFailure);
}

// What the frame does once connected, by mode. The loader has `mount`; the
// test runner adds `list` and `case`, so the loader does not depend on it.
const frameModes = { mount: startMountMode };

// `mount` without a `test` param, `list` for a test without a case name, and
// `case` for a test with one.
function readFrameMode(params) {
  const test = params.test;
  if (typeof test !== "object" || test === null) {
    return "mount";
  }
  if (test.caseName === null) {
    return "list";
  }
  return "case";
}

function startFrameMode(params) {
  const modeName = readFrameMode(params);
  const startMode = frameModes[modeName];
  if (typeof startMode !== "function") {
    reportMountFailure(
      new Error(`this frame cannot run the "${modeName}" mode`),
    );
    return;
  }
  startMode(params);
}

function connectToEngine(event) {
  if (loader.port !== null || !isConnectMessage(event)) {
    return;
  }
  window.removeEventListener("message", connectToEngine);
  loader.port = event.ports[0];
  loader.port.onmessage = handlePortMessage;
  flushPendingReports();
  const params = event.data.params;
  loader.context = params.context;
  applyColorScheme(params.context?.theme);
  applyLayout(params.context?.layout);
  if (isTheme(params.context?.theme)) {
    loader.theme = params.context.theme;
  }
  replaceBlockedDialogs();
  startFrameMode(params);
}

// The mermaid blocks of every tile body element of the frame. A block is
// drawn once it comes into view, one at a time, with a paint and a task
// between two (design.md of add-tile-body-diagrams, D5).
const diagramQueue = {
  // The blocks in view, oldest first.
  waiting: [],
  drawing: false,
  // The blocks not yet in view, by the element they replace.
  observed: new Map(),
  observer: new IntersectionObserver(queueVisibleBlocks),
  // Numbers the ids mermaid draws with, across the frame.
  nextDiagramNumber: 1,
  // The theme mermaid was last set up with.
  initializedTheme: null,
};

// What a tile body element knows about its diagrams. Kept apart from the
// element so the loader can redraw them without a public method.
function buildDiagramState(element) {
  const diagramState = { element, mode: DRAW_DIAGRAMS, blocks: new Set() };
  return diagramState;
}

function isPendingTarget(diagramState, target) {
  for (const block of diagramState.blocks) {
    if (block.target === target) {
      return true;
    }
  }
  return false;
}

// `target` is the `<pre>` or the `<figure>` the drawn diagram replaces.
function watchDiagramBlock(diagramState, target, source) {
  const block = {
    state: diagramState,
    target,
    source,
    queued: false,
    dropped: false,
  };
  diagramState.blocks.add(block);
  diagramQueue.observed.set(target, block);
  diagramQueue.observer.observe(target);
}

function watchMermaidBlocks(diagramState) {
  if (diagramState.mode !== DRAW_DIAGRAMS) {
    return;
  }
  const codes = diagramState.element.querySelectorAll(MERMAID_BLOCK_SELECTOR);
  for (const code of codes) {
    if (!isPendingTarget(diagramState, code.parentElement)) {
      watchDiagramBlock(diagramState, code.parentElement, code.textContent);
    }
  }
}

// Every drawn diagram becomes a pending block again, kept until its new drawing replaces it.
function redrawDiagrams(diagramState) {
  if (diagramState.mode !== DRAW_DIAGRAMS) {
    return;
  }
  const figures = diagramState.element.querySelectorAll(DIAGRAM_SELECTOR);
  for (const figure of figures) {
    if (!isPendingTarget(diagramState, figure)) {
      watchDiagramBlock(diagramState, figure, figure.dataset.mermaidSource);
    }
  }
}

function redrawTileBodies() {
  for (const diagramState of loader.tileBodies) {
    redrawDiagrams(diagramState);
  }
}

function isBlockKept(block) {
  return !block.dropped;
}

function markBlockBusy(block) {
  block.target.setAttribute(BUSY_ATTRIBUTE, "true");
}

function unmarkBlockBusy(block) {
  block.target.removeAttribute(BUSY_ATTRIBUTE);
}

// A block being drawn finishes, but its diagram is not shown. A block still
// in the element loses its busy mark.
function dropDiagramBlocks(diagramState) {
  for (const block of diagramState.blocks) {
    block.dropped = true;
    if (block.queued && diagramState.element.contains(block.target)) {
      unmarkBlockBusy(block);
    }
    diagramQueue.observed.delete(block.target);
    diagramQueue.observer.unobserve(block.target);
  }
  diagramState.blocks.clear();
  diagramQueue.waiting = diagramQueue.waiting.filter(isBlockKept);
}

function queueBlock(target) {
  const block = diagramQueue.observed.get(target);
  if (block === undefined) {
    return;
  }
  diagramQueue.observed.delete(target);
  diagramQueue.observer.unobserve(target);
  block.queued = true;
  markBlockBusy(block);
  diagramQueue.waiting.push(block);
}

function queueVisibleBlocks(entries) {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      queueBlock(entry.target);
    }
  }
  drawWaitingDiagrams();
}

function waitForAnimationFrame() {
  const frame = Promise.withResolvers();
  requestAnimationFrame(frame.resolve);
  return frame.promise;
}

function waitForTask() {
  const task = Promise.withResolvers();
  setTimeout(task.resolve, 0);
  return task.promise;
}

// The frame paints and handles input before each diagram.
async function pauseBeforeDiagram() {
  await waitForAnimationFrame();
  await waitForTask();
}

async function drawWaitingDiagrams() {
  if (diagramQueue.drawing) {
    return;
  }
  diagramQueue.drawing = true;
  try {
    while (diagramQueue.waiting.length > 0) {
      await pauseBeforeDiagram();
      const block = diagramQueue.waiting.shift();
      if (block !== undefined) {
        await drawDiagramBlock(block);
      }
    }
  } finally {
    diagramQueue.drawing = false;
  }
}

// Mermaid needs color values, not `var(--ot-…)`, so they come from the theme object.
function buildMermaidThemeVariables(theme) {
  const themeVariables = {};
  if (!isTheme(theme)) {
    return themeVariables;
  }
  themeVariables.darkMode = theme.colorScheme === "dark";
  for (const [variable, token] of Object.entries(MERMAID_THEME_TOKENS)) {
    const value = theme.tokens?.[token];
    if (typeof value === "string") {
      themeVariables[variable] = value;
    }
  }
  const shadowColor = theme.tokens?.[MERMAID_SHADOW_TOKEN];
  if (typeof shadowColor === "string") {
    themeVariables.dropShadow = `drop-shadow(1px 2px 2px ${shadowColor})`;
  }
  return themeVariables;
}

// The options a diagram's front matter or `%%{init}%%` directive cannot set:
// mermaid's default list, and HTML labels.
function buildMermaidSecureOptions(mermaid) {
  const secureOptions = [
    ...mermaid.mermaidAPI.defaultConfig.secure,
    MERMAID_SECURE_OPTION,
  ];
  return secureOptions;
}

// Strict: diagrams hold no click handlers. Without HTML labels, labels are
// SVG text: strict alone keeps an `<img>` written in a label. The layout and
// the look are mermaid's defaults, which a diagram may change.
function buildMermaidConfig(mermaid, theme) {
  const mermaidConfig = {
    startOnLoad: false,
    securityLevel: "strict",
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    secure: buildMermaidSecureOptions(mermaid),
    suppressErrorRendering: true,
    theme: "base",
    themeVariables: buildMermaidThemeVariables(theme),
  };
  return mermaidConfig;
}

function initializeMermaid(mermaid) {
  if (diagramQueue.initializedTheme === loader.theme) {
    return;
  }
  mermaid.initialize(buildMermaidConfig(mermaid, loader.theme));
  diagramQueue.initializedTheme = loader.theme;
}

async function renderDiagram(source) {
  await requestEngine(LOAD_LIBRARY_METHOD, MERMAID_LIBRARY);
  const mermaid = globalThis.mermaid;
  initializeMermaid(mermaid);
  const diagramId = DIAGRAM_ID_PREFIX + diagramQueue.nextDiagramNumber;
  diagramQueue.nextDiagramNumber += 1;
  const diagram = await mermaid.render(diagramId, source);
  return diagram.svg;
}

function showDiagram(block, svg) {
  if (!block.state.element.contains(block.target)) {
    return;
  }
  const figure = document.createElement("figure");
  figure.dataset.mermaidSource = block.source;
  figure.innerHTML = svg;
  block.target.replaceWith(figure);
}

function hasQueuedBlock(diagramState) {
  for (const block of diagramState.blocks) {
    if (block.queued) {
      return true;
    }
  }
  return false;
}

// A block that fails stays as it is, without its busy mark; a drawn one is
// replaced by a figure that has none. The event fires once no block of the
// element in view waits.
function finishDiagramBlock(block, svg) {
  const diagramState = block.state;
  diagramState.blocks.delete(block);
  if (block.dropped) {
    return;
  }
  if (svg === null) {
    unmarkBlockBusy(block);
  } else {
    showDiagram(block, svg);
  }
  if (!hasQueuedBlock(diagramState)) {
    diagramState.element.dispatchEvent(
      new Event(DIAGRAMS_DRAWN_EVENT, { bubbles: true }),
    );
  }
}

async function drawDiagramBlock(block) {
  let svg = null;
  try {
    svg = await renderDiagram(block.source);
  } catch (error) {
    console.warn(
      `${TILE_BODY_ELEMENT} could not draw a mermaid diagram: ${describeError(error)}`,
    );
  }
  finishDiagramBlock(block, svg);
}

function readDiagramsMode(value) {
  if (value !== DRAW_DIAGRAMS && value !== KEEP_DIAGRAM_SOURCES) {
    throw new TypeError(
      `${TILE_BODY_ELEMENT}: "diagrams" must be "${DRAW_DIAGRAMS}" or "${KEEP_DIAGRAM_SOURCES}", not ${JSON.stringify(value)}`,
    );
  }
  return value;
}

// A rendered tile body: setting `tile` asks the engine for its body and shows
// it in the light DOM, so the theme and the mod's CSS style it, then draws
// its mermaid blocks. A custom element must extend HTMLElement.
class TileBodyElement extends HTMLElement {
  #tile = null;
  // Counts the requests, so only the answer for the newest tile is shown.
  #requestCount = 0;
  #diagramState = buildDiagramState(this);

  get tile() {
    return this.#tile;
  }

  // `"draw"` draws the mermaid blocks, `"source"` keeps them as code.
  get diagrams() {
    return this.#diagramState.mode;
  }

  set diagrams(value) {
    this.#diagramState.mode = readDiagramsMode(value);
    if (value === KEEP_DIAGRAM_SOURCES) {
      dropDiagramBlocks(this.#diagramState);
      return;
    }
    watchMermaidBlocks(this.#diagramState);
  }

  connectedCallback() {
    loader.tileBodies.add(this.#diagramState);
  }

  // A body whose diagrams were not drawn when it left the document draws none.
  disconnectedCallback() {
    loader.tileBodies.delete(this.#diagramState);
    dropDiagramBlocks(this.#diagramState);
  }

  set tile(tile) {
    this.#tile = tile;
    this.#requestCount += 1;
    dropDiagramBlocks(this.#diagramState);
    const requestNumber = this.#requestCount;
    requestEngine(RENDER_BODY_METHOD, { source: tile?.source }).then(
      this.#showBody.bind(this, requestNumber),
      this.#showError.bind(this, requestNumber),
    );
  }

  #showBody(requestNumber, result) {
    if (requestNumber !== this.#requestCount) {
      return;
    }
    dropDiagramBlocks(this.#diagramState);
    this.innerHTML = result.html;
    this.dispatchEvent(new Event(RENDERED_EVENT, { bubbles: true }));
    // A listener may have set another tile.
    if (requestNumber === this.#requestCount) {
      watchMermaidBlocks(this.#diagramState);
    }
  }

  #showError(requestNumber, error) {
    if (requestNumber !== this.#requestCount) {
      return;
    }
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent = describeError(error);
    this.replaceChildren(message);
  }
}

function defineTileBodyElement() {
  if (customElements.get(TILE_BODY_ELEMENT) === undefined) {
    customElements.define(TILE_BODY_ELEMENT, TileBodyElement);
  }
}

function warnRejectedRequest(method, error) {
  console.warn(`${method} was rejected: ${describeError(error)}`);
}

function sendBodyRequest(method, params) {
  requestEngine(method, params).catch(
    warnRejectedRequest.bind(undefined, method),
  );
}

function findClickedElement(event, selector) {
  if (!(event.target instanceof Element)) {
    return null;
  }
  return event.target.closest(selector);
}

// `#notes` names the heading `user-content-notes`. A malformed escape is read as written.
function readHeadingId(link) {
  const fragment = link.getAttribute("href").slice(1);
  try {
    return HEADING_ID_PREFIX + decodeURIComponent(fragment);
  } catch {
    return HEADING_ID_PREFIX + fragment;
  }
}

// The heading nearest to the link: the first one inside the link's
// ancestors, from the nearest outward, so each body's links reach its own.
function findFragmentHeading(link) {
  const selector = `#${CSS.escape(readHeadingId(link))}`;
  let ancestor = link.parentElement;
  while (ancestor !== null) {
    const heading = ancestor.querySelector(selector);
    if (heading !== null) {
      return heading;
    }
    ancestor = ancestor.parentElement;
  }
  return null;
}

function scrollToFragment(link) {
  const heading = findFragmentHeading(link);
  if (heading !== null) {
    heading.scrollIntoView();
  }
}

// Clicks in rendered bodies that the mod did not cancel: a placeholder asks
// for its player, a link asks to open it, and a link to a heading scrolls to
// it. Neither link navigates the frame, which would stop the mod.
function handleBodyClick(event) {
  if (event.defaultPrevented) {
    return;
  }
  const placeholder = findClickedElement(event, "[data-ot-player]");
  if (placeholder !== null) {
    sendBodyRequest(OPEN_PLAYER_METHOD, { url: placeholder.dataset.otPlayer });
    return;
  }
  const link = findClickedElement(event, "a[data-ot-link]");
  if (link !== null) {
    event.preventDefault();
    sendBodyRequest(OPEN_LINK_METHOD, { url: link.href });
    return;
  }
  const fragmentLink = findClickedElement(event, "a[data-ot-fragment]");
  if (fragmentLink !== null) {
    event.preventDefault();
    scrollToFragment(fragmentLink);
  }
}

defineTileBodyElement();
document.addEventListener("securitypolicyviolation", reportViolation);
window.addEventListener("message", connectToEngine);
window.addEventListener("click", handleBodyClick);
