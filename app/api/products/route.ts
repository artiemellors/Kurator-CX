import { NextRequest } from 'next/server'
import { searchKmart } from '@/lib/kmart-scraper'
import { getCategoryConfig } from '@/lib/category-config'

export async function GET(req: NextRequest) {
  const q        = req.nextUrl.searchParams.get('q') ?? ''
  const category = req.nextUrl.searchParams.get('category') ?? 'outfits'

  if (!q.trim()) return Response.json({ products: [] })

  const config   = getCategoryConfig(category)
  const products = await searchKmart(q.trim(), config.categoryFilter)
  console.log(`[Products] Direct search "${q}" → ${products.length} products`)
  return Response.json({ products })
}
