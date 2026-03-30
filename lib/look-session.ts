import type { Outfit } from '@/app/components/OutfitResults'

export interface LookSession {
  query: string
  outfits: Outfit[]
  refinements: string[]
}

const KEY = 'kurator_look'

export function saveLookSession(session: LookSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {}
}

export function loadLookSession(query: string): LookSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as LookSession
    // Invalidate if the stored query doesn't match the URL
    if (data.query !== query) return null
    return data
  } catch {
    return null
  }
}
