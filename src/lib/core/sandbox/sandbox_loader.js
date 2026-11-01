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
const RENDER_BODY_METHOD = "tiles.renderBody";
const OPEN_LINK_METHOD = "links.open";
const OPEN_PLAYER_METHOD = "players.open";

const TILE_BODY_ELEMENT = "ot-tile-body";
const RENDERED_EVENT = "ot-rendered";
// The prefix of the ids of a rendered body, which its `#…` links leave out.
const HEADING_ID_PREFIX = "user-content-";

const loader = {
  port: null,
  pendingReports: [],
  nextRequestId: 1,
  pendingRequests: new Map(),
  eventHandlers: new Map(),
  // The mount context, kept until `mount` is called so a theme change can still reach it.
  context: null,
  mounted: false,
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

function requestEngine(method, params) {
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

// Before the mod's handlers run: they read the new attribute, and a mod
// still being imported mounts with the newest theme.
function applyThemeChanged(theme) {
  applyColorScheme(theme);
  if (isTheme(theme) && !loader.mounted && loader.context !== null) {
    loader.context.theme = theme;
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
  replaceBlockedDialogs();
  startFrameMode(params);
}

// A rendered tile body: setting `tile` asks the engine for its body and shows
// it in the light DOM, so the theme and the mod's CSS style it. A custom
// element must extend HTMLElement.
class TileBodyElement extends HTMLElement {
  #tile = null;
  // Counts the requests, so only the answer for the newest tile is shown.
  #requestCount = 0;

  get tile() {
    return this.#tile;
  }

  set tile(tile) {
    this.#tile = tile;
    this.#requestCount += 1;
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
    this.innerHTML = result.html;
    this.dispatchEvent(new Event(RENDERED_EVENT, { bubbles: true }));
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
