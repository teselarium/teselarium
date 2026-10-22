// The frame loader: the only script the app puts in a mod's frame. It
// receives the mod's code and context from the engine, gives the mod its
// engine API object and mounts the mod. Inlined as text in the sandbox
// document, so it must never contain a closing script tag.

const CONNECT_METHOD = "sandbox.connect";
const BLOCKED_METHOD = "sandbox.blocked";
const MOUNT_FAILED_METHOD = "sandbox.mountFailed";
const DIALOG_BLOCKED_METHOD = "sandbox.dialogBlocked";
const THEME_CHANGED_METHOD = "theme.changed";

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

function describeMountError(error) {
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
}

function reportMountFailure(error) {
  sendNotification(MOUNT_FAILED_METHOD, { message: describeMountError(error) });
}

function flushPendingReports() {
  for (const params of loader.pendingReports) {
    sendNotification(BLOCKED_METHOD, params);
  }
  loader.pendingReports = [];
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
  mountMod(params.code).catch(reportMountFailure);
}

document.addEventListener("securitypolicyviolation", reportViolation);
window.addEventListener("message", connectToEngine);
