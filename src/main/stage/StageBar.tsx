import type { ReactElement } from "react";
import { closeSandbox, reloadTiles } from "../../lib/core/stage/index.ts";
import type { SandboxSnapshot, Stage } from "../../lib/core/stage/index.ts";
import { IssueList } from "./IssueList.tsx";

interface StageBarProps {
  stage: Stage;
  sandbox: SandboxSnapshot;
}

function renderModSummary(sandbox: SandboxSnapshot): ReactElement {
  if (sandbox.mod === null) {
    return <code className="stage-bar-link">{sandbox.hash}</code>;
  }
  return (
    <>
      <strong className="stage-bar-title">{sandbox.mod.title}</strong>{" "}
      <span className="stage-bar-version">{sandbox.mod.version}</span>{" "}
      <code className="stage-bar-source">{sandbox.mod.source}</code>
    </>
  );
}

/** The visible sandbox's title, version and source, its buttons and its issues. */
export function StageBar({ stage, sandbox }: StageBarProps): ReactElement {
  function handleReloadClick(): void {
    void reloadTiles(stage, sandbox.id);
  }

  function handleCloseClick(): void {
    closeSandbox(stage, sandbox.id);
  }

  return (
    <section className="stage-bar" aria-label="Stage bar">
      <div className="stage-bar-header">
        <div className="stage-bar-mod">{renderModSummary(sandbox)}</div>
        {sandbox.canReloadTiles ? (
          <button type="button" onClick={handleReloadClick}>
            Reload tiles
          </button>
        ) : null}
        {sandbox.canClose ? (
          <button type="button" aria-label="Close" onClick={handleCloseClick}>
            ×
          </button>
        ) : null}
      </div>
      <IssueList issues={sandbox.issues} />
    </section>
  );
}
