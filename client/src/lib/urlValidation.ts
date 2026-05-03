/** Accepts empty string; otherwise requires http(s) URL. */
export function isValidHttpUrl(s: string): boolean {
  const t = s.trim()
  if (!t) return true
  try {
    const u = new URL(t)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
