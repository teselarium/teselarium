import { useRef, useState } from "react";
import type { ReactElement, SyntheticEvent } from "react";
import { attachFrame, frameLoadedAgain } from "../../lib/core/stage/index.ts";
import type { SandboxSnapshot, Stage } from "../../lib/core/stage/index.ts";

interface SandboxFrameProps {
  stage: Stage;
  sandbox: SandboxSnapshot;
  sandboxDocument: string;
}

/**
 * A mod's frame: sandboxed with scripts only, so it gets an opaque origin, and
 * its document built in memory. `allow="fullscreen *"` is a permissions
 * policy, not a sandbox flag: the mod can show an element fullscreen after a
 * click inside it, with the browser's own exit notice. The `*` is needed:
 * without it, fullscreen is allowed only for the origin the frame was
 * declared with, the app's for a `srcdoc` frame, which never matches the
 * sandbox's opaque origin. Firefox and WebKit then refuse (design.md, D8). The first `load` connects the mod's session;
 * any later `load` means the mod navigated its frame, so it is stopped.
 *
 * The frame stays hidden until one animation frame after it is connected:
 * before the frame loader handles `sandbox.connect`, the frame's document has
 * no color scheme yet, and a dark app would show it light for a moment.
 * Showing it right at connect still let one light frame through (design.md,
 * task 7.3).
 */
export function SandboxFrame({
  stage,
  sandbox,
  sandboxDocument,
}: SandboxFrameProps): ReactElement {
  const loadCount = useRef(0);
  const [isShown, setIsShown] = useState(false);

  function showConnectedFrame(): void {
    setIsShown(true);
  }

  function handleFrameLoad(event: SyntheticEvent<HTMLIFrameElement>): void {
    loadCount.current += 1;
    const frameWindow = event.currentTarget.contentWindow;
    if (loadCount.current === 1 && frameWindow !== null) {
      attachFrame(stage, sandbox.id, frameWindow);
      requestAnimationFrame(showConnectedFrame);
      return;
    }
    frameLoadedAgain(stage, sandbox.id);
  }

  return (
    <iframe
      className={
        isShown
          ? "sandbox-frame rounded-lg border shadow-panel"
          : "sandbox-frame sandbox-frame-loading rounded-lg border shadow-panel"
      }
      title={sandbox.mod?.title ?? sandbox.id}
      sandbox="allow-scripts"
      allow="fullscreen *"
      srcDoc={sandboxDocument}
      onLoad={handleFrameLoad}
    />
  );
}
