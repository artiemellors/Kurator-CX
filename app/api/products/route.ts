import { NextRequest } from 'next/server'
import { searchKmart } from '@/lib/kmart-scraper'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''

  if (!q.trim()) return Response.json({ products: [] })

  // No category filter — let Constructor.io return whatever matches the raw query.
  // The AI agent (in /api/search) handles category-specific filtering separately.
  const products = await searchKmart(q.trim())
  console.log(`[Products] Direct search "${q}" → ${products.length} products`)
  return Response.json({ products })
}
