import { X } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import { closeSandbox, reloadTiles } from "../../lib/core/stage/index.ts";
import type { SandboxSnapshot, Stage } from "../../lib/core/stage/index.ts";
import { IssueList } from "./IssueList.tsx";

interface StageBarProps {
  stage: Stage;
  sandbox: SandboxSnapshot;
}

function renderModSummary(sandbox: SandboxSnapshot): ReactElement {
  if (sandbox.mod === null) {
    return <code>{sandbox.hash}</code>;
  }
  return (
    <>
      <strong className="font-semibold">{sandbox.mod.title}</strong>{" "}
      <span className="text-muted-foreground">{sandbox.mod.version}</span>{" "}
      <code className="text-muted-foreground">{sandbox.mod.source}</code>
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
    <section
      className="rounded-lg border bg-card px-3 py-2 text-card-foreground"
      aria-label="Stage bar"
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          {renderModSummary(sandbox)}
        </div>
        {sandbox.canReloadTiles ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReloadClick}
          >
            Reload tiles
          </Button>
        ) : null}
        {sandbox.canClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={handleCloseClick}
          >
            <X />
          </Button>
        ) : null}
      </div>
      <IssueList issues={sandbox.issues} />
    </section>
  );
}
