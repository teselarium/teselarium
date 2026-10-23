import { useMemo, useSyncExternalStore } from "react";

/**
 * The snapshot of an external store (the stage, the sidebar layout, the
 * section switches), re-rendered after every change. `subscribe` and `read`
 * are the store's own functions, bound to `store`.
 */
export function useStoreSnapshot<Store, Snapshot>(
  store: Store,
  subscribe: (store: Store, listener: () => void) => () => void,
  read: (store: Store) => Snapshot,
): Snapshot {
  const boundSubscribe = useMemo(
    function bindSubscribe(): (listener: () => void) => () => void {
      return subscribe.bind(undefined, store);
    },
    [store, subscribe],
  );
  const boundRead = useMemo(
    function bindRead(): () => Snapshot {
      return read.bind(undefined, store);
    },
    [store, read],
  );
  return useSyncExternalStore(boundSubscribe, boundRead);
}
