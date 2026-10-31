import { useId, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import { Label } from "@/vendor/shadcn/ui/label.tsx";
import { Checkbox } from "@/vendor/shadcn/ui/checkbox.tsx";
import { describePermissionLine } from "../../lib/core/permissions/index.ts";
import type {
  SandboxSnapshot,
  SiteConsentAnswer,
  SiteConsentLine,
} from "../../lib/core/stage/index.ts";
import { StageDialog } from "./StageDialog.tsx";

interface SiteConsentDialogProps {
  /** The visible sandbox while it is asking. */
  sandbox: SandboxSnapshot;
  /** `null` for Escape. */
  onAnswer: (sandboxId: string, answer: SiteConsentAnswer | null) => void;
}

/** What a checkbox reports when it changes: `"indeterminate"` only for a mixed one. */
type CheckedState = boolean | "indeterminate";

interface ConsentLineRowProps {
  line: SiteConsentLine;
  isChecked: boolean;
  onCheck: (key: string, isChecked: boolean) => void;
}

/** Categories whose sites can receive what the mod shows or keeps. */
const DATA_CATEGORIES: ReadonlySet<string> = new Set(["connect", "code"]);

function listLineKeys(lines: readonly SiteConsentLine[]): string[] {
  const keys: string[] = [];
  for (const line of lines) {
    keys.push(line.key);
  }
  return keys;
}

/** The keys of the checked lines after one checkbox changed, in the order of the lines. */
function checkLineKey(
  lines: readonly SiteConsentLine[],
  checkedKeys: string[],
  changedKey: string,
  isChecked: boolean,
): string[] {
  const keys: string[] = [];
  for (const line of lines) {
    const wasChecked = checkedKeys.includes(line.key);
    const staysChecked = line.key === changedKey ? isChecked : wasChecked;
    if (staysChecked) {
      keys.push(line.key);
    }
  }
  return keys;
}

function sendsData(lines: readonly SiteConsentLine[]): boolean {
  for (const line of lines) {
    if (DATA_CATEGORIES.has(line.category)) {
      return true;
    }
  }
  return false;
}

/** One line: its checkbox labeled with the app's words, then the mod's reason as plain text. */
function ConsentLineRow({
  line,
  isChecked,
  onCheck,
}: ConsentLineRowProps): ReactElement {
  const checkboxId = useId();

  function handleCheckedChange(checked: CheckedState): void {
    onCheck(line.key, checked === true);
  }

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <Checkbox
          id={checkboxId}
          checked={isChecked}
          onCheckedChange={handleCheckedChange}
        />
        <Label
          htmlFor={checkboxId}
          className="leading-snug [overflow-wrap:anywhere]"
        >
          {describePermissionLine(line)}
        </Label>
      </div>
      <p className="m-0 pl-6 text-sm text-muted-foreground [overflow-wrap:anywhere]">
        In the mod's words: {line.reason}
      </p>
    </li>
  );
}

/**
 * The app's question before it starts a mod from another site that declares
 * permissions, a `StageDialog` like the action dialog: modal, out of every
 * frame's reach, with Show without them focused. It names the mod by its
 * title and source, lists one line per site and category, with a checkbox checked,
 * the app's verb and the mod's reason, and states the cost. Allow grants the
 * checked lines; Show without them refuses every line; both remember the
 * answer when Remember is checked. Escape refuses every line and remembers
 * nothing. The page renders it only while the visible sandbox is asking, and
 * keys it by sandbox, so each question starts with every line checked.
 */
export function SiteConsentDialog({
  sandbox,
  onAnswer,
}: SiteConsentDialogProps): ReactElement {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const rememberId = useId();
  const lines = sandbox.siteConsent?.lines ?? [];
  const [checkedKeys, setCheckedKeys] = useState<string[]>(listLineKeys(lines));
  const [remembers, setRemembers] = useState(false);

  function handleLineCheck(key: string, isChecked: boolean): void {
    setCheckedKeys(checkLineKey(lines, checkedKeys, key, isChecked));
  }

  function handleRememberChange(checked: CheckedState): void {
    setRemembers(checked === true);
  }

  function handleAllowClick(): void {
    onAnswer(sandbox.id, { allowed: checkedKeys, remember: remembers });
  }

  function handleShowWithoutClick(): void {
    onAnswer(sandbox.id, { allowed: [], remember: remembers });
  }

  function handleEscape(): void {
    onAnswer(sandbox.id, null);
  }

  if (sandbox.mod === null || sandbox.siteConsent === null) {
    return (
      <StageDialog
        shownKey={null}
        cancelRef={cancelRef}
        onCancel={handleEscape}
      />
    );
  }
  const lineItems: ReactElement[] = [];
  for (const line of lines) {
    lineItems.push(
      <ConsentLineRow
        key={line.key}
        line={line}
        isChecked={checkedKeys.includes(line.key)}
        onCheck={handleLineCheck}
      />,
    );
  }
  return (
    <StageDialog
      shownKey={sandbox.id}
      labelledBy={titleId}
      cancelRef={cancelRef}
      onCancel={handleEscape}
    >
      <h2
        id={titleId}
        className="text-lg font-semibold tracking-tight [overflow-wrap:anywhere]"
      >
        {sandbox.mod.title}
      </h2>
      {/* Under the title, so a mod that borrows another title still shows where it comes from. */}
      <code className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {sandbox.mod.source}
      </code>
      <p className="mt-4 mb-2">This mod comes from another site and asks to:</p>
      <ul className="m-0 flex list-none flex-col gap-3 rounded-md bg-muted p-3">
        {lineItems}
      </ul>
      <p className="mt-4 mb-0">
        Each site you allow can see that you used this mod.
        {sendsData(lines)
          ? " Sites allowed to exchange data or load code can also receive what the mod shows or keeps."
          : null}
      </p>
      <div className="mt-4 flex items-center gap-2">
        <Checkbox
          id={rememberId}
          checked={remembers}
          onCheckedChange={handleRememberChange}
        />
        <Label htmlFor={rememberId}>Remember my answer for this mod</Label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          ref={cancelRef}
          type="button"
          variant="outline"
          onClick={handleShowWithoutClick}
        >
          Show without them
        </Button>
        <Button type="button" onClick={handleAllowClick}>
          Allow
        </Button>
      </div>
    </StageDialog>
  );
}
