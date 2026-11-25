/** The markdown file a page is rendered from. */
export interface PageFile {
  section: string;
  /** The file's absolute URL. Relative links and images resolve against it. */
  url: string;
}

/** What a link in a page becomes. An external link opens in a new browsing context. */
export interface PageLink {
  href: string;
  isExternal: boolean;
}

/** `<page>.md` or `./<page>.md`, with an optional fragment: a sibling page. */
const SIBLING_PAGE_PATTERN = /^(?:\.\/)?([A-Za-z0-9_-]+)\.md(?:#.*)?$/;

const INDEX_PAGE = "index";

/** `pages/<section>/index.md`, or `pages/<section>/<page>.md`, next to the app. */
export function buildPageFileUrl(
  baseUrl: string,
  section: string,
  page: string | null,
): string {
  const fileUrl = new URL(`pages/${section}/${page ?? INDEX_PAGE}.md`, baseUrl);
  return fileUrl.href;
}

function buildSiblingHash(section: string, page: string): string {
  if (page === INDEX_PAGE) {
    return `#/${section}`;
  }
  const siblingHash = `#/${section}/${page}`;
  return siblingHash;
}

function buildPageLink(href: string, isExternal: boolean): PageLink {
  const pageLink: PageLink = { href, isExternal };
  return pageLink;
}

/** Whether a link names a scheme (`https:`, `mailto:`), so it is not relative. */
function hasScheme(href: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(href);
}

/**
 * Maps a link in a page: a sibling markdown file opens as its page in the
 * app, an app address (`#/...`) stays, a link to another site opens in a new
 * browsing context, and any other relative link resolves against the page's
 * file.
 */
export function mapPageLink(href: string, file: PageFile): PageLink {
  const sibling = SIBLING_PAGE_PATTERN.exec(href);
  if (sibling !== null) {
    return buildPageLink(buildSiblingHash(file.section, sibling[1]), false);
  }
  if (href.startsWith("#/")) {
    return buildPageLink(href, false);
  }
  if (hasScheme(href)) {
    const isWeb = /^https?:/i.test(href);
    const isOtherSite =
      isWeb && new URL(href).origin !== new URL(file.url).origin;
    return buildPageLink(href, isOtherSite);
  }
  return buildPageLink(new URL(href, file.url).href, false);
}

/** A relative image address resolves against the page's file. */
export function resolvePageImage(src: string, file: PageFile): string {
  const imageUrl = new URL(src, file.url);
  return imageUrl.href;
}
