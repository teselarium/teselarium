import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import {
  readDroppedSelection,
  readPickedFiles,
  readPickedFolder,
} from "./picked_selection.ts";
import type { PickedSelection } from "./picked_selection.ts";

/** The file types the pickers offer. */
const MOSAIC_FILE_TYPES = ".yaml,.yml";

/** Touch-friendly buttons: at least 32px tall, as on a phone. */
const PICKER_BUTTON_CLASSES = "min-h-8";

interface FilePickersProps {
  /** "Choose files…" and "Choose folder…", or a single "Choose file…" for an update. */
  mode: "import" | "update";
  isDisabled: boolean;
  onPick: (selection: PickedSelection) => void;
  /** A drop the pickers cannot read, with its message. */
  onPickError: (message: string) => void;
}

function readInputFiles(event: ChangeEvent<HTMLInputElement>): File[] {
  const files = [...(event.target.files ?? [])];
  event.target.value = "";
  return files;
}

/**
 * The buttons that open the browser's file pickers, through hidden inputs,
 * and a drop zone for files and folders. A folder is read through
 * `webkitdirectory` or, dropped, through `webkitGetAsEntry`.
 */
export function FilePickers({
  mode,
  isDisabled,
  onPick,
  onPickError,
}: FilePickersProps): ReactElement {
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>): void {
    const files = readInputFiles(event);
    if (files.length > 0) {
      onPick(readPickedFiles(files));
    }
  }

  function handleFolderChange(event: ChangeEvent<HTMLInputElement>): void {
    const files = readInputFiles(event);
    if (files.length > 0) {
      onPick(readPickedFolder(files));
    }
  }

  function handleChooseFiles(): void {
    filesRef.current?.click();
  }

  function handleChooseFolder(): void {
    folderRef.current?.click();
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsOver(!isDisabled);
  }

  function handleDragLeave(): void {
    setIsOver(false);
  }

  async function readDrop(dataTransfer: DataTransfer): Promise<void> {
    try {
      const selection = await readDroppedSelection(dataTransfer);
      if (mode === "update") {
        const firstFile = selection.files.slice(0, 1);
        onPick({ folder: null, files: firstFile });
        return;
      }
      onPick(selection);
    } catch (error) {
      onPickError(error instanceof Error ? error.message : String(error));
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsOver(false);
    if (isDisabled) {
      return;
    }
    void readDrop(event.dataTransfer);
  }

  const dropText =
    mode === "import"
      ? "Or drop mosaic files or a folder here."
      : "Or drop the mosaic file here.";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className={PICKER_BUTTON_CLASSES}
          disabled={isDisabled}
          onClick={handleChooseFiles}
        >
          {mode === "import" ? "Choose files…" : "Choose file…"}
        </Button>
        {mode === "import" ? (
          <Button
            type="button"
            variant="outline"
            className={PICKER_BUTTON_CLASSES}
            disabled={isDisabled}
            onClick={handleChooseFolder}
          >
            Choose folder…
          </Button>
        ) : null}
      </div>
      <input
        ref={filesRef}
        type="file"
        aria-label={mode === "import" ? "Mosaic files" : "Mosaic file"}
        accept={MOSAIC_FILE_TYPES}
        multiple={mode === "import"}
        hidden
        onChange={handleFilesChange}
      />
      {mode === "import" ? (
        <input
          ref={folderRef}
          type="file"
          aria-label="Mosaic folder"
          // React does not know `webkitdirectory`, so it is passed as a plain attribute.
          {...{ webkitdirectory: "" }}
          hidden
          onChange={handleFolderChange}
        />
      ) : null}
      <div
        data-drop-zone=""
        data-over={isOver ? "" : undefined}
        className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground data-over:border-primary data-over:bg-muted"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dropText}
      </div>
    </div>
  );
}
