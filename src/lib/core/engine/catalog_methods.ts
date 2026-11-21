import type { Catalog } from "./catalog.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";

/**
 * `catalog.list`: the catalog, with resolved addresses. It needs no
 * permission, since the addresses come from the instantiation, and its params
 * are ignored.
 */
async function listCatalog(context: ModMethodContext): Promise<Catalog> {
  const catalog = await context.readCatalog();
  return catalog;
}

/** The `catalog.*` requests: reading the catalog of mods, collections and mosaics. */
export const CATALOG_METHODS: ModMethodTable = {
  "catalog.list": listCatalog,
};
