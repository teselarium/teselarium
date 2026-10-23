import { useCallback, useEffect, useState } from "react";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import { createPortal } from "react-dom";
import { Alert, AlertDescription } from "@/vendor/shadcn/ui/alert.tsx";
import { THEME_FRAME_STYLES } from "../../lib/core/theme/index.ts";
import { fetchFile, parseMarkdown } from "../../lib/files/index.ts";
import type { FileFetchOptions } from "../../lib/files/index.ts";
import { PageMarkdown } from "./page_markdown.tsx";
import type { PageFile } from "./page_links.ts";

interface MarkdownPageProps {
  file: PageFile;
  fetchOptions: FileFetchOptions;
}

type PageLoad =
  | { status: "loading" }
  | { status: "loaded"; markdown: string }
  | { status: "failed"; message: string };

/** A load result, and the file it is for. */
interface LoadedPage {
  url: string;
  load: PageLoad;
}

/** Turned off when the page is left, so a late result is ignored. */
interface FetchTicket {
  isCurrent: boolean;
}

type SetLoadedPage = Dispatch<SetStateAction<LoadedPage | null>>;

const LOADING: PageLoad = Object.freeze({ status: "loading" });

/**
 * What the base stylesheet gives `html` and `body` in a mod frame, given to
 * the element that acts as the page's body. The only class selector, and it
 * never leaves the shadow root.
 */
const PAGE_HOST_RULES = `@layer opentesela {
  .page-body {
    box-sizing: border-box;
    min-height: 100%;
    padding: var(--ot-space-4);
    background-color: var(--ot-background);
    color: var(--ot-foreground);
    accent-color: var(--ot-primary);
    font-family: var(--ot-font-sans);
    font-size: var(--ot-font-size);
    line-height: var(--ot-line-height);
  }
}
`;

/**
 * The token blocks and the base stylesheet of a mod frame, then the host
 * rules. The `:root` block is inert in a shadow root, where the tokens inherit
 * from the page's `<html>`; the color scheme blocks serve color scheme
 * sections inside the page.
 */
const PAGE_STYLES = `${THEME_FRAME_STYLES}\n${PAGE_HOST_RULES}`;

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** The page's markdown body. The front matter is dropped. */
async function loadPageMarkdown(
  url: string,
  fetchOptions: FileFetchOptions,
): Promise<string> {
  const file = await fetchFile(url, fetchOptions);
  return parseMarkdown(file).body;
}

function settleLoaded(
  ticket: FetchTicket,
  setLoadedPage: SetLoadedPage,
  url: string,
  markdown: string,
): void {
  if (ticket.isCurrent) {
    setLoadedPage({ url, load: { status: "loaded", markdown } });
  }
}

function settleFailed(
  ticket: FetchTicket,
  setLoadedPage: SetLoadedPage,
  url: string,
  error: unknown,
): void {
  if (ticket.isCurrent) {
    setLoadedPage({
      url,
      load: { status: "failed", message: describeError(error) },
    });
  }
}

function cancelTicket(ticket: FetchTicket): void {
  ticket.isCurrent = false;
}

/** Attaches the page's shadow root once. React calls this when the host mounts. */
function attachPageShadow(
  setShadowRoot: Dispatch<SetStateAction<ShadowRoot | null>>,
  host: HTMLDivElement | null,
): void {
  if (host === null) {
    return;
  }
  setShadowRoot(host.shadowRoot ?? host.attachShadow({ mode: "open" }));
}

function renderLoadState(load: PageLoad): ReactElement | null {
  if (load.status === "failed") {
    // shadcn's Alert has `role="alert"`. The message names the file's address and the reason.
    return (
      <Alert
        variant="destructive"
        className="m-4 w-auto border-destructive [overflow-wrap:anywhere]"
      >
        <AlertDescription>{load.message}</AlertDescription>
      </Alert>
    );
  }
  if (load.status === "loading") {
    return <p className="p-4 text-muted-foreground">Loading…</p>;
  }
  return null;
}

/**
 * A markdown page, loaded each time it is shown and rendered in an isolated
 * shadow root that holds the theme tokens and the mods' base stylesheet, so
 * it looks exactly like a mod. The app's styles stay outside it, and its
 * styles stay inside. A failed load shows an alert outside the shadow root.
 */
export function MarkdownPage({
  file,
  fetchOptions,
}: MarkdownPageProps): ReactElement {
  const [loadedPage, setLoadedPage] = useState<LoadedPage | null>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
  const hostRef = useCallback(function attachHost(
    host: HTMLDivElement | null,
  ): void {
    attachPageShadow(setShadowRoot, host);
  }, []);
  const { baseUrl, fetch } = fetchOptions;
  useEffect(
    function loadPage(): () => void {
      const ticket: FetchTicket = { isCurrent: true };
      loadPageMarkdown(file.url, { baseUrl, fetch }).then(
        settleLoaded.bind(undefined, ticket, setLoadedPage, file.url),
        settleFailed.bind(undefined, ticket, setLoadedPage, file.url),
      );
      return cancelTicket.bind(undefined, ticket);
    },
    [file.url, baseUrl, fetch],
  );

  const load = loadedPage?.url === file.url ? loadedPage.load : LOADING;
  return (
    <>
      {renderLoadState(load)}
      <div
        className="min-h-full"
        data-page-host=""
        ref={hostRef}
        hidden={load.status !== "loaded"}
      />
      {shadowRoot !== null && load.status === "loaded"
        ? createPortal(
            <>
              <style>{PAGE_STYLES}</style>
              <div className="page-body">
                <PageMarkdown markdown={load.markdown} file={file} />
              </div>
            </>,
            shadowRoot,
          )
        : null}
    </>
  );
}
