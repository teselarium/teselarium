import { useMemo, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import {
  readStageSnapshot,
  subscribeStage,
} from "../../lib/core/stage/index.ts";
import type {
  SandboxSnapshot,
  Stage,
  StageSnapshot,
} from "../../lib/core/stage/index.ts";
import { SandboxFrame } from "./SandboxFrame.tsx";
import { StageBar } from "./StageBar.tsx";
import "./stage.css";

interface StageViewProps {
  stage: Stage;
}

function renderSandboxContent(
  stage: Stage,
  sandbox: SandboxSnapshot,
): ReactElement | null {
  if (sandbox.status === "failed") {
    return (
      <p className="sandbox-error" role="alert">
        {sandbox.errorMessage}
      </p>
    );
  }
  if (sandbox.status === "loading") {
    return <p className="sandbox-loading">Loading…</p>;
  }
  if (sandbox.sandboxDocument === null) {
    return null;
  }
  return (
    <SandboxFrame
      stage={stage}
      sandbox={sandbox}
      sandboxDocument={sandbox.sandboxDocument}
    />
  );
}

function renderSandbox(stage: Stage, sandbox: SandboxSnapshot): ReactElement {
  return (
    <div
      key={sandbox.id}
      className="sandbox"
      data-sandbox-id={sandbox.id}
      hidden={!sandbox.isVisible}
    >
      {renderSandboxContent(stage, sandbox)}
    </div>
  );
}

function findVisibleSandbox(snapshot: StageSnapshot): SandboxSnapshot | null {
  for (const sandbox of snapshot.sandboxes) {
    if (sandbox.isVisible) {
      return sandbox;
    }
  }
  return null;
}

/**
 * Every sandbox of the stage, in creation order and keyed by id, so a frame
 * never moves in the DOM (moving an iframe reloads it). Only the visible one
 * is shown, under the stage bar.
 */
export function StageView({ stage }: StageViewProps): ReactElement {
  const subscribe = useMemo(
    function bindSubscribe(): (listener: () => void) => () => void {
      return subscribeStage.bind(undefined, stage);
    },
    [stage],
  );
  const getSnapshot = useMemo(
    function bindGetSnapshot(): () => StageSnapshot {
      return readStageSnapshot.bind(undefined, stage);
    },
    [stage],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const visibleSandbox = findVisibleSandbox(snapshot);
  const sandboxes: ReactElement[] = [];
  for (const sandbox of snapshot.sandboxes) {
    sandboxes.push(renderSandbox(stage, sandbox));
  }
  return (
    <main className="stage">
      {visibleSandbox === null ? null : (
        <StageBar stage={stage} sandbox={visibleSandbox} />
      )}
      <div className="stage-sandboxes">{sandboxes}</div>
    </main>
  );
}
