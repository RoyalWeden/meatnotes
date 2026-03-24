// Isomorphic shortlink ID computation — works in Node (build time) and browser (runtime).
// Uses FNV-1a 32-bit hash of the slug → base-36 → first 6 chars.
//
// WARNING: Do NOT change this algorithm after deployment.
// Existing /s/<id> URLs are permanent external links that must keep working.

export function computeShortlinkId(slug: string, manualId?: string): string {
  if (manualId?.trim()) return manualId.trim()

  // FNV-1a 32-bit
  let hash = 0x811c9dc5
  for (let i = 0; i < slug.length; i++) {
    hash ^= slug.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36).slice(0, 6)
}
