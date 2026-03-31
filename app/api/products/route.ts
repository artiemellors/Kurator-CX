import { NextRequest } from 'next/server'
import { searchKmart } from '@/lib/kmart-scraper'
import { getCategoryConfig } from '@/lib/category-config'

export async function GET(req: NextRequest) {
  const q        = req.nextUrl.searchParams.get('q') ?? ''
  const category = req.nextUrl.searchParams.get('category') ?? 'outfits'

  if (!q.trim()) return Response.json({ products: [] })

  // Apply category filter for outfits (restricts to Clothing/Activewear/Shoes).
  // Home and kitchen have no filter (empty string) since their taxonomy
  // doesn't cleanly map to Constructor.io filter values.
  const config   = getCategoryConfig(category)
  const products = await searchKmart(q.trim(), config.categoryFilter)
  console.log(`[Products] Direct search "${q}" → ${products.length} products`)
  return Response.json({ products })
}
