import type { Outfit, Product } from '@/app/components/OutfitResults'
import type { CollectionProduct } from '@/app/components/ProductCollections'

export interface CollectionPreview {
  name: string
  description: string
  pivots: string[]
  products: Product[]           // 3 representative products for tile preview images
  productPool?: CollectionProduct[] // full fetched pool — pre-fills the edit page
}

export interface LookSession {
  query: string
  outfits: Outfit[]
  refinements: string[]
  collections: CollectionPreview[]
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
    // Backfill collections for sessions saved before this field existed
    if (!Array.isArray(data.collections)) data.collections = []
    return data
  } catch {
    return null
  }
}
