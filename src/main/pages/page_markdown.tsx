import { useMemo } from "react";
import type { ComponentProps, ReactElement } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import type { Components, UrlTransform } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { mapPageLink, resolvePageImage } from "./page_links.ts";
import type { PageFile } from "./page_links.ts";
import { PAGE_SANITIZE_SCHEMA } from "./page_sanitize_schema.ts";

interface PageMarkdownProps {
  /** The file's body, without its front matter. */
  markdown: string;
  file: PageFile;
}

const REMARK_PLUGINS = [remarkGfm];

// Sanitizing runs after `rehype-raw`, so the HTML written in the markdown is sanitized too.
const REHYPE_PLUGINS: ComponentProps<typeof Markdown>["rehypePlugins"] = [
  rehypeRaw,
  [rehypeSanitize, PAGE_SANITIZE_SCHEMA],
];

/** Unsafe protocols are dropped first, then links and images follow the page's rules. */
function transformPageUrl(file: PageFile, url: string, key: string): string {
  const safeUrl = defaultUrlTransform(url);
  if (safeUrl === "") {
    return safeUrl;
  }
  if (key === "src") {
    return resolvePageImage(safeUrl, file);
  }
  return mapPageLink(safeUrl, file).href;
}

type PageAnchorProps = ComponentProps<"a"> & { node?: unknown };

/** A link to another site opens in a new browsing context, without access to the app. */
function PageAnchor(
  file: PageFile,
  { node, ...props }: PageAnchorProps,
): ReactElement {
  void node;
  const href = props.href ?? "";
  if (href === "" || !mapPageLink(href, file).isExternal) {
    return <a {...props} />;
  }
  return <a {...props} target="_blank" rel="noopener noreferrer" />;
}

function buildPageComponents(file: PageFile): Components {
  const components: Components = { a: PageAnchor.bind(undefined, file) };
  return components;
}

/**
 * A page's markdown as React elements: GitHub-flavored markdown, the safe
 * subset of HTML, and the page's link and image rules. It holds no event
 * handlers: links are plain anchors that the browser follows.
 */
export function PageMarkdown({
  markdown,
  file,
}: PageMarkdownProps): ReactElement {
  const urlTransform = useMemo(
    function bindUrlTransform(): UrlTransform {
      return transformPageUrl.bind(undefined, file);
    },
    [file],
  );
  const components = useMemo(
    function bindComponents(): Components {
      return buildPageComponents(file);
    },
    [file],
  );
  return (
    <Markdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      urlTransform={urlTransform}
      components={components}
    >
      {markdown}
    </Markdown>
  );
}
