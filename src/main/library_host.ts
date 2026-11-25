/**
 * The vanilla app's npm host: the address the app fetches the files of the
 * npm libraries mods declare from, as `<host><package>@<version>/<path>`.
 * The files are fetched by the app's page, never by a mod's frame. An
 * instantiation can point it at another npm CDN or a mirror, ending in `/`.
 */
export const NPM_HOST = "https://cdn.jsdelivr.net/npm/";
