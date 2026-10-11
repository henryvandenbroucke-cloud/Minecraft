import { MemoryStore, type KeyValueStore } from '../sim/save';

/**
 * Browser storage with a graceful fallback. If localStorage is blocked (private mode, quota, or
 * sandboxed iframe), the game keeps running on memory and reports that in the status line.
 */
export function openBrowserStore(): { store: KeyValueStore; persistent: boolean } {
  try {
    const ls = window.localStorage;
    const probe = '__saltline_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      persistent: true,
      store: {
        getItem: (k) => ls.getItem(k),
        setItem: (k, v) => ls.setItem(k, v),
        removeItem: (k) => ls.removeItem(k),
      },
    };
  } catch {
    return { persistent: false, store: new MemoryStore() };
  }
}

export const SETTINGS_KEY = 'saltline.settings.v1';
