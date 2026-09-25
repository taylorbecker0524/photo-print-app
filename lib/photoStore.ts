// Local storage for the small on-screen copies of a customer's photos.
//
// Why this exists: leaving the studio for checkout unmounts it, and coming back
// used to show an empty page — the whole order gone with no warning. Rebuilding
// it needs the pictures back, and the original files cannot be serialised: a
// File is a handle the browser will not recreate for us.
//
// The preview JPEGs can be. They are roughly 60KB each, so twenty photos is
// about a megabyte — nothing for IndexedDB, and far too much for localStorage,
// which is why it is IndexedDB and not the simpler option.
//
// Everything here fails quietly. A browser in private mode, or one with site
// data blocked, will refuse to open the database; when that happens the studio
// behaves exactly as it did before, which is to say the order does not survive
// the trip. That is worth degrading to, and not worth an error message about.

const DB_NAME = 'archive-photos'
// Version 2 adds the print store below. Existing databases upgrade in place and
// keep their previews; only the new store is created.
const DB_VERSION = 2
const STORE = 'previews'
/**
 * Print-quality copies, roughly 400KB each.
 *
 * Previews alone were not enough. A preview is ~60KB and fine on screen, but a
 * reload left the studio holding nothing else — the original File is a handle
 * the browser discards, and printing a thumbnail would produce a visibly bad
 * print. So the order could be rebuilt but not actually placed, and the
 * customer only found out at the checkout button.
 *
 * These are the same bytes checkout would have uploaded anyway, made early and
 * kept, so returning to a saved cart works rather than asking someone to find
 * and re-pick every photo.
 */
const PRINT_STORE = 'prints'

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
        if (!db.objectStoreNames.contains(PRINT_STORE)) db.createObjectStore(PRINT_STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      // Safari can leave an open() hanging forever if a previous tab holds a
      // version lock. Nothing here is worth blocking an import on.
      setTimeout(() => resolve(null), 3000)
    } catch {
      resolve(null)
    }
  })
}

function tx(db: IDBDatabase, mode: IDBTransactionMode, store: string = STORE) {
  return db.transaction(store, mode).objectStore(store)
}

/** Save one preview. Overwrites any previous blob for that photo id. */
export async function putPreview(id: string, blob: Blob): Promise<void> {
  const db = await open()
  if (!db) return
  try {
    await new Promise<void>((resolve) => {
      const r = tx(db, 'readwrite').put(blob, id)
      r.onsuccess = () => resolve()
      r.onerror = () => resolve()
    })
  } catch {
    /* ignore */
  } finally {
    db.close()
  }
}

/** Fetch the previews for a set of photo ids. Missing ids are simply absent. */
export async function getPreviews(ids: string[]): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>()
  if (ids.length === 0) return out
  const db = await open()
  if (!db) return out
  try {
    const store = tx(db, 'readonly')
    await Promise.all(
      ids.map(
        (id) =>
          new Promise<void>((resolve) => {
            const r = store.get(id)
            r.onsuccess = () => {
              if (r.result instanceof Blob) out.set(id, r.result)
              resolve()
            }
            r.onerror = () => resolve()
          })
      )
    )
  } catch {
    /* ignore */
  } finally {
    db.close()
  }
  return out
}

/** Save one print-quality copy. */
export async function putPrint(id: string, blob: Blob): Promise<void> {
  const db = await open()
  if (!db) return
  try {
    await new Promise<void>((resolve) => {
      const r = tx(db, 'readwrite', PRINT_STORE).put(blob, id)
      r.onsuccess = () => resolve()
      r.onerror = () => resolve()
    })
  } catch {
    /* ignore */
  } finally {
    db.close()
  }
}

/** Fetch print-quality copies for a set of photo ids. Missing ids are absent. */
export async function getPrints(ids: string[]): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>()
  if (ids.length === 0) return out
  const db = await open()
  if (!db) return out
  try {
    const store = tx(db, 'readonly', PRINT_STORE)
    await Promise.all(
      ids.map(
        (id) =>
          new Promise<void>((resolve) => {
            const r = store.get(id)
            r.onsuccess = () => {
              if (r.result instanceof Blob) out.set(id, r.result)
              resolve()
            }
            r.onerror = () => resolve()
          })
      )
    )
  } catch {
    /* ignore */
  } finally {
    db.close()
  }
  return out
}

/**
 * Drop previews and print copies we no longer reference, so the database cannot
 * grow forever. Both stores are pruned together — print copies are the larger
 * of the two by roughly seven times, so leaving them behind is what would
 * actually fill a phone's storage allowance.
 */
export async function prunePreviews(keepIds: string[]): Promise<void> {
  const keep = new Set(keepIds)
  const db = await open()
  if (!db) return
  try {
    for (const storeName of [STORE, PRINT_STORE]) {
      const store = tx(db, 'readwrite', storeName)
      await new Promise<void>((resolve) => {
        const r = store.getAllKeys()
        r.onsuccess = () => {
          const keys = (r.result ?? []) as IDBValidKey[]
          keys.forEach((k) => {
            if (typeof k === 'string' && !keep.has(k)) store.delete(k)
          })
          resolve()
        }
        r.onerror = () => resolve()
      })
    }
  } catch {
    /* ignore */
  } finally {
    db.close()
  }
}
