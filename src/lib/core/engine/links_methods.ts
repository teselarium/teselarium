import type { YamlMapping } from "../../files/index.ts";
import type { LinkAction } from "./app_actions.ts";
import { askUser, throwInvalidParams } from "./mod_methods.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";

const LINK_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Reads the `url` of `links.open`: an absolute `http:` or `https:` address
 * without a user name or password. Returns its normalized `href`, where an
 * internationalized host is in punycode, so look-alike letters cannot hide
 * the real host. Raises `INVALID_PARAMS`.
 */
export function readLinkUrl(params: YamlMapping): string {
  const url = params.url;
  if (
    typeof url !== "string" ||
    !URL.canParse(url) ||
    !LINK_PROTOCOLS.has(new URL(url).protocol)
  ) {
    throwInvalidParams(
      "links.open",
      '"url" must be an http: or https: address',
    );
  }
  const address = new URL(url);
  if (address.username !== "" || address.password !== "") {
    throwInvalidParams(
      "links.open",
      '"url" must not hold a user name or password',
    );
  }
  return address.href;
}

/**
 * `links.open { url }`: asks the user to open the address in a new tab, and
 * answers whether the user opened it.
 */
async function openLink(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<boolean> {
  const action: LinkAction = { kind: "link", url: readLinkUrl(params) };
  return askUser(context, "links.open", action);
}

/** The `links.*` requests: web addresses the app opens for the user. */
export const LINKS_METHODS: ModMethodTable = {
  "links.open": openLink,
};
