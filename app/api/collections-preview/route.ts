import { NextRequest } from 'next/server'
import { searchKmart, Product } from '@/lib/kmart-scraper'
import { runAgentLoop } from '@/lib/llm-agent'
import { getCategoryConfig } from '@/lib/category-config'

const SYSTEM_PROMPT = `You are a Kmart style editor creating themed editorial collections — curated ranges for discovery and browsing, NOT outfit bundles.

Each collection is a mood or lifestyle theme, not a "wear these together" suggestion. Think in terms of colour stories, occasions, and aesthetics — not what goes on a person's body at once.

Search strategy:
- Make 3–5 targeted searches to explore the theme space
- Look for products across different types (don't just search clothing)
- Prioritise products with strong, distinct colours

For each collection's preview images (product_ids):
- Pick exactly 3 products with visually distinct, complementary colours
- Together they should read as a colour palette / mood board
- Avoid 3 clothing items on models — that looks like an outfit suggestion

Call present_collections once you've found enough variety.`

export async function POST(req: NextRequest) {
  const { query, category } = await req.json() as { query: string; category?: string }
  if (!query?.trim()) return Response.json({ collections: [] })

  const config = getCategoryConfig(category ?? 'outfits')

  console.log(`[CollectionsPreview] Building previews for "${query}"`)

  try {
    const productMap = new Map<string, Product>()
    let searchIndex = 0

    const result = await runAgentLoop({
      system: SYSTEM_PROMPT,
      userMessage: `Create 2–3 themed editorial collections for: "${query}"`,
      maxTokens: 2048,
      maxTurns: 8,
      tools: [
        {
          name: 'search_kmart',
          description: 'Search Kmart Australia for products.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
        {
          name: 'present_collections',
          description: 'Present the final themed collections. Call after at least 3 searches.',
          parameters: {
            type: 'object',
            properties: {
              collections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Short editorial name (2–4 words, e.g. "Coastal Weekend", "Bold & Bright")',
                    },
                    description: {
                      type: 'string',
                      description: '2–3 sentences in a stylist\'s voice describing the mood, occasion, and aesthetic',
                    },
                    pivots: {
                      type: 'array',
                      items: { type: 'string' },
                      description: '3–4 style direction chips (e.g. "warmer palette", "under $30", "more casual")',
                    },
                    product_ids: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Exactly 3 product ids chosen for colour story — pick products with visually distinct, complementary colours that together read as a cohesive palette. Think mood board, not outfit.',
                    },
                  },
                  required: ['name', 'description', 'pivots', 'product_ids'],
                },
              },
            },
            required: ['collections'],
          },
        },
      ],
      terminalTool: 'present_collections',
      label: 'CollectionsPreview',
      onTool: async (calls) => {
        const fetched = await Promise.all(
          calls.map(c => searchKmart((c.args as { query: string }).query, config.categoryFilter))
        )
        return calls.map((c, i) => {
          const products = fetched[i].slice(0, 15)
          const si = searchIndex++
          const tagged = products.map((p, pi) => {
            const id = `q${si}p${pi}`
            productMap.set(id, p)
            return { id, name: p.name, price: p.price, ...(p.colour ? { colour: p.colour } : {}) }
          })
          return {
            id: c.id,
            name: c.name,
            result: tagged.length > 0 ? JSON.stringify(tagged) : 'No results found.',
          }
        })
      },
    })

    if (!result) return Response.json({ collections: [] })

    const raw = (result.args as {
      collections: Array<{ name: string; description: string; pivots: string[]; product_ids: string[] }>
    }).collections

    const collections = raw
      .map(col => ({
        name: col.name,
        description: col.description,
        pivots: Array.isArray(col.pivots) ? col.pivots.slice(0, 4) : [],
        products: (col.product_ids ?? [])
          .slice(0, 3)
          .map(id => productMap.get(id))
          .filter((p): p is Product => p !== undefined),
      }))
      .filter(col => col.products.length > 0)

    console.log(`[CollectionsPreview] Done — ${collections.length} collections`)
    return Response.json({ collections })

  } catch (err) {
    console.error('[CollectionsPreview] Route error:', err)
    return Response.json({ collections: [] })
  }
}
