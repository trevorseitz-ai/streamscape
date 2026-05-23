/**
 * Profile **Save Preferences** → immediate Discover feed teardown (mounted Discover only).
 * Replaces tab-focus polling: **`flushDiscoverFeedCachesAfterProfileSave`** runs right after **`user_profiles`** / AsyncStorage write succeeds.
 */

type Listener = () => void | Promise<void>;
const listeners = new Set<Listener>();

export function subscribeDiscoverFeedFlushAfterProfileSave(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Call from **`profile.tsx`** **`handleSave`** immediately after persisted prefs succeed. */
export function flushDiscoverFeedCachesAfterProfileSave(): void {
  for (const listener of [...listeners]) {
    try {
      void Promise.resolve(listener());
    } catch (err) {
      console.warn('[Discover] Profile-save flush subscriber failed:', err);
    }
  }
}
