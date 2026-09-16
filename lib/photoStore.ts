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
const DB_VERSION = 1
const STORE = 'previews'

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
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

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE)
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

/** Drop previews we no longer reference, so the database cannot grow forever. */
export async function prunePreviews(keepIds: string[]): Promise<void> {
  const keep = new Set(keepIds)
  const db = await open()
  if (!db) return
  try {
    const store = tx(db, 'readwrite')
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
  } catch {
    /* ignore */
  } finally {
    db.close()
  }
}
