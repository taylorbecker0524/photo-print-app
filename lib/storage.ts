// Persistent storage for cart with TTL.
// Falls back gracefully if localStorage isn't available (private browsing, etc).

const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

type Stored<T> = { value: T; expiresAt: number }

function isAvailable(): boolean {
  try {
    const k = '__archive_test__'
    localStorage.setItem(k, k)
    localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

export function setWithTTL<T>(key: string, value: T, ttlMs: number = CART_TTL_MS): void {
  if (!isAvailable()) {
    // Fall back to sessionStorage so the current session still works
    try { sessionStorage.setItem(key, JSON.stringify(value)) } catch {}
    return
  }
  const wrapped: Stored<T> = { value, expiresAt: Date.now() + ttlMs }
  try {
    localStorage.setItem(key, JSON.stringify(wrapped))
  } catch {
    // Quota exceeded or other write failure — fall back to session
    try { sessionStorage.setItem(key, JSON.stringify(value)) } catch {}
  }
}

export function getWithTTL<T>(key: string): T | null {
  // Check session first (in case we fell back during set)
  try {
    const sess = sessionStorage.getItem(key)
    if (sess) {
      try { return JSON.parse(sess) as T } catch { /* fall through */ }
    }
  } catch {}

  if (!isAvailable()) return null
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Stored<T>
    if (!parsed || typeof parsed !== 'object' || !('expiresAt' in parsed)) {
      // Old format without TTL — treat as expired
      localStorage.removeItem(key)
      return null
    }
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(key)
      return null
    }
    return parsed.value
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export function clearStored(key: string): void {
  try { localStorage.removeItem(key) } catch {}
  try { sessionStorage.removeItem(key) } catch {}
}
