import type { CatalogListing } from "./catalog_listing.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";

/**
 * `catalog.list`: the app's catalog, with resolved addresses. It needs no
 * permission, since the addresses come from the instantiation, and its params
 * are ignored.
 */
async function listCatalog(context: ModMethodContext): Promise<CatalogListing> {
  const listing = await context.readCatalog();
  return listing;
}

/** The `catalog.*` requests: reading the app's catalog of mods, collections and mosaics. */
export const CATALOG_METHODS: ModMethodTable = {
  "catalog.list": listCatalog,
};
