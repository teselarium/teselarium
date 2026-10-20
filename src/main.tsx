import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { createStage, followHistory } from "./lib/core/stage/index.ts";
import { DEFAULT_MODS } from "./main/default_mods.ts";

// Built once outside React, so StrictMode's double effect run in dev does not launch mods twice.
const stage = createStage({
  history: window.history,
  defaults: DEFAULT_MODS,
  appOrigin: window.location.origin,
  baseUrl: document.baseURI,
  storage: window.localStorage,
});

function followCurrentEntry(): void {
  followHistory(stage, window.location.hash, window.history.state);
}

followCurrentEntry();
// Fragment navigations fire `popstate` too, so `hashchange` is not needed.
window.addEventListener("popstate", followCurrentEntry);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App stage={stage} />
  </StrictMode>,
);
