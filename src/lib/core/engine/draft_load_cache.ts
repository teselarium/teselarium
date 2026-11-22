/** How long a draft validation's load is reused, in milliseconds. */
export const DRAFT_LOAD_LIFETIME = 30_000;

interface CachedLoad {
  loading: Promise<unknown>;
  startedAt: number;
}

function readSystemTime(): number {
  return Date.now();
}

/**
 * The loads of draft validations, kept for `DRAFT_LOAD_LIFETIME` per
 * session, so a burst of validations while the user types loads each mod
 * file, tile type and collection once. Failed loads are kept too, so a
 * missing file is not requested again on each pause.
 */
export class DraftLoadCache {
  private readonly loads = new Map<string, CachedLoad>();
  private readonly readNow: () => number;

  constructor(readNow: () => number = readSystemTime) {
    this.readNow = readNow;
  }

  /** The cached load of `key` while it is fresh, or the one `load` starts. */
  load<T>(key: string, load: () => Promise<T>): Promise<T> {
    const now = this.readNow();
    const cachedLoad = this.loads.get(key);
    if (
      cachedLoad !== undefined &&
      now - cachedLoad.startedAt < DRAFT_LOAD_LIFETIME
    ) {
      return cachedLoad.loading as Promise<T>;
    }
    const loading = load();
    this.loads.set(key, { loading, startedAt: now });
    return loading;
  }
}

/** A load cache whose times come from `readNow`, `Date.now` by default. */
export function createDraftLoadCache(
  readNow: () => number = readSystemTime,
): DraftLoadCache {
  const cache = new DraftLoadCache(readNow);
  return cache;
}
