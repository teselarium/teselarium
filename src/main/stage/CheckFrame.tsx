import { useRef } from "react";
import type { ReactElement, SyntheticEvent } from "react";
import {
  attachCheckFrame,
  checkFrameLoadedAgain,
} from "../../lib/core/stage/index.ts";
import type { CheckSnapshot, Stage } from "../../lib/core/stage/index.ts";

interface CheckFrameProps {
  stage: Stage;
  check: CheckSnapshot;
}

/**
 * The frame a mod check runs now (the mount check, the listing of the mod's
 * tests or one test case): sandboxed like a mod's frame, with the document
 * the check gives, which has the mod's content policy. The page keys it by
 * the frame's key, so each frame of a check is a new iframe with a fresh
 * page. It is hidden by layout, not by `display: none`: it has the stage
 * area's size, sits behind the stage, is transparent and lets every pointer
 * event through. A frame that is not rendered may get no animation frames,
 * and a mod that waits for one or measures its layout while mounting would
 * hang or see a size of zero. `inert` keeps the checked mod from taking the
 * focus, and `aria-hidden` keeps it out of the accessibility tree. The first
 * `load` connects the check's session; any later `load` means the mod
 * navigated its frame, which ends the check.
 */
export function CheckFrame({ stage, check }: CheckFrameProps): ReactElement {
  const loadCount = useRef(0);

  function handleFrameLoad(event: SyntheticEvent<HTMLIFrameElement>): void {
    loadCount.current += 1;
    const frameWindow = event.currentTarget.contentWindow;
    if (loadCount.current === 1 && frameWindow !== null) {
      attachCheckFrame(stage, check.id, check.key, frameWindow);
      return;
    }
    checkFrameLoadedAgain(stage, check.id, check.key);
  }

  return (
    <iframe
      className="pointer-events-none absolute inset-0 -z-10 size-full border-0 opacity-0"
      title={`Check of ${check.title}`}
      data-check-id={check.id}
      sandbox="allow-scripts"
      srcDoc={check.sandboxDocument}
      inert
      aria-hidden="true"
      tabIndex={-1}
      onLoad={handleFrameLoad}
    />
  );
}
