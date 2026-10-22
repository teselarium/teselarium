import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { createStage, followHistory } from "./lib/core/stage/index.ts";
import { buildThemeTokenStyles } from "./lib/core/theme/index.ts";
import { DEFAULT_MODS } from "./main/default_mods.ts";
import {
  createAppTheme,
  readStartColorScheme,
} from "./main/theme/app_theme.ts";

// The tokens the app's own styles use, before anything renders.
const tokenStyle = document.createElement("style");
tokenStyle.textContent = buildThemeTokenStyles();
document.head.append(tokenStyle);

const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");

// Built once outside React, so StrictMode's double effect run in dev does not launch mods twice.
const stage = createStage({
  history: window.history,
  defaults: DEFAULT_MODS,
  appOrigin: window.location.origin,
  baseUrl: document.baseURI,
  storage: window.localStorage,
  colorScheme: readStartColorScheme(window.localStorage, systemQuery),
});

// Same lifetime as the stage: it tells the stage when the color scheme changes.
const appTheme = createAppTheme({
  storage: window.localStorage,
  systemQuery,
  stage,
  root: document.documentElement,
});

function followCurrentEntry(): void {
  followHistory(stage, window.location.hash, window.history.state);
}

followCurrentEntry();
// Fragment navigations fire `popstate` too, so `hashchange` is not needed.
window.addEventListener("popstate", followCurrentEntry);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App stage={stage} appTheme={appTheme} />
  </StrictMode>,
);
