import { useRef } from "react";
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
 * its document built in memory. The first `load` connects the mod's session;
 * any later `load` means the mod navigated its frame, so it is stopped.
 */
export function SandboxFrame({
  stage,
  sandbox,
  sandboxDocument,
}: SandboxFrameProps): ReactElement {
  const loadCount = useRef(0);

  function handleFrameLoad(event: SyntheticEvent<HTMLIFrameElement>): void {
    loadCount.current += 1;
    const frameWindow = event.currentTarget.contentWindow;
    if (loadCount.current === 1 && frameWindow !== null) {
      attachFrame(stage, sandbox.id, frameWindow);
      return;
    }
    frameLoadedAgain(stage, sandbox.id);
  }

  return (
    <iframe
      className="sandbox-frame"
      title={sandbox.mod?.title ?? sandbox.id}
      sandbox="allow-scripts"
      srcDoc={sandboxDocument}
      onLoad={handleFrameLoad}
    />
  );
}
