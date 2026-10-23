import { compare, isValid } from '../core/lib/semver';
/** Catalog entries strictly newer than the installed version; never downgrades, ignores unparsable versions. */
export function newerCatalogApps<C extends { id: string; version?: string }>(catalog: C[], installed: { id: string; version?: string }[], failed: Set<string> = new Set()): C[] {
  return catalog.filter((c) => {
    const have = installed.find((i) => i.id === c.id);
    return !!have && !!c.version && !!have.version && isValid(c.version) && isValid(have.version) && compare(c.version, have.version) > 0 && !failed.has(c.id + '@' + c.version);
  });
}
