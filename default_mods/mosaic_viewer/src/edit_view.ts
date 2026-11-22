import type {
  ModEngine,
  ModYamlMapping,
  MosaicDraftEdits,
  MosaicDraftValidation,
} from "../../mod_api.d.ts";
import type { DraftKind } from "./draft_store.ts";

/** How long the viewer waits after the user stops typing before it validates the draft. */
export const VALIDATION_DELAY_MS = 500;

/** Where edit mode starts: what it edits, its first text, and what leaving and saving do. */
export interface EditStart {
  kind: DraftKind;
  /** The page's heading, such as `Edit "Shown mosaic"`. */
  heading: string;
  content: string;
  /** The stored mosaic it saves over, or `null` for a copy or a new mosaic. */
  address: string | null;
  /** For a copy, the address of the mosaic it copies, or `null`. */
  copiedFrom: string | null;
  storageKey: string;
  /** Leaves edit mode without saving. */
  onLeave: () => Promise<void>;
  /** Shows the saved mosaic, at its address. */
  onSaved: (address: string) => Promise<void>;
}

/** The mod's default config the form shows beside the draft's, for the mod reference it was read for. */
export interface DefaultConfig {
  reference: string;
  /** `null` while it loads, or when the mod cannot be inspected. */
  config: ModYamlMapping | null;
  isLoaded: boolean;
}

/** The parts of the edit page that change. */
export interface EditNodes {
  notice: HTMLElement;
  formTab: HTMLButtonElement;
  yamlTab: HTMLButtonElement;
  formNote: HTMLElement;
  formPanel: HTMLElement;
  yamlPanel: HTMLElement;
  textarea: HTMLTextAreaElement;
  problems: HTMLElement;
  hints: HTMLElement;
  saveButton: HTMLButtonElement;
  messages: HTMLElement;
}

/** Edit mode: the draft, its latest validation, and the page. Mutable. */
export interface EditView extends EditStart {
  engine: ModEngine;
  /** The text edit mode started with: the draft has unsaved changes when it differs. */
  baseContent: string;
  validation: MosaicDraftValidation | null;
  /** The number of the newest validation request: an older answer is ignored. */
  latestValidation: number;
  validationTimer: ReturnType<typeof setTimeout> | null;
  defaultConfig: DefaultConfig | null;
  nodes: EditNodes;
  /** Ctrl+S and Cmd+S, removed when edit mode is left. */
  keyHandler: (event: KeyboardEvent) => void;
  /** Sends the form's edits to the app and replaces the draft with the answer. */
  sendEdits: (edits: MosaicDraftEdits) => void;
}

/** Whether the draft differs from the text edit mode started with. */
export function hasUnsavedChanges(view: EditView): boolean {
  return view.content !== view.baseContent;
}
