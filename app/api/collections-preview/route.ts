import { NextRequest } from 'next/server'
import { searchKmart, Product } from '@/lib/kmart-scraper'
import { runAgentLoop } from '@/lib/llm-agent'
import { getCategoryConfig } from '@/lib/category-config'

export async function POST(req: NextRequest) {
  const { query, category } = await req.json() as { query: string; category?: string }
  if (!query?.trim()) return Response.json({ collections: [] })

  const config = getCategoryConfig(category ?? 'outfits')

  const SYSTEM_PROMPT = `You are a Kmart style editor creating themed editorial collections for the ${config.label} category — curated ranges for discovery and browsing, NOT outfit bundles.

Each collection is a mood or lifestyle theme. Think in terms of colour stories, occasions, and aesthetics.

Search strategy:
- Use short, specific product-type queries — one product type per call (e.g. "cushion cover", "floor lamp", "ceramic vase"). Do NOT use long descriptive phrases.
- If a search returns 0 results, move on immediately — do not retry similar terms.
- Make 3–5 searches across different product types relevant to the ${config.label} category.
- Call present_collections as soon as you have 6+ products across your searches.

For each collection's preview images (product_ids):
- Pick exactly 3 products with visually distinct, complementary colours
- Together they should read as a colour palette / mood board`

  console.log(`[CollectionsPreview] Building previews for "${query}"`)
  try {
    const productMap = new Map<string, Product>()
    let searchIndex = 0

    const result = await runAgentLoop({
      system: SYSTEM_PROMPT,
      userMessage: `Create 2–3 themed editorial collections for: "${query}"`,
      maxTokens: 2048,
      maxTurns: 10,
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
          description: 'Present the final themed collections. Call as soon as you have 6+ products — do not keep searching if you already have enough variety.',
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
                      description: '3–4 short, concrete filter chips that are immediately obvious — use price points ("Under $20", "Under $50"), style modes ("Casual", "Smart casual", "Active"), or occasions ("Beach day", "Weekend", "Going out"). Avoid vague aesthetic terms like "warmer palette".',
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
          const allProducts = fetched[i]
          const products = allProducts.slice(0, 15)
          const si = searchIndex++
          // Store full result set so we can return it as productPool
          allProducts.forEach((p, pi) => {
            const id = `q${si}p${pi}`
            productMap.set(id, p)
          })
          const tagged = products.map((p, pi) => ({
            id: `q${si}p${pi}`,
            name: p.name,
            price: p.price,
            ...(p.colour ? { colour: p.colour } : {}),
          }))
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

    // All products fetched across every search call
    const allFetched = Array.from(productMap.values())

    const collections = raw
      .map(col => {
        const tileIds = new Set((col.product_ids ?? []).slice(0, 3))
        const tileProducts = Array.from(tileIds)
          .map(id => productMap.get(id))
          .filter((p): p is Product => p !== undefined)
        // Pool = everything fetched, excluding the 3 tile picks, deduped by name+colour
        const tileKeys = new Set(tileProducts.map(p => `${p.name}::${p.colour ?? ''}`))
        const productPool = allFetched.filter(
          p => !tileKeys.has(`${p.name}::${p.colour ?? ''}`)
        )
        return {
          name: col.name,
          description: col.description,
          pivots: Array.isArray(col.pivots) ? col.pivots.slice(0, 4) : [],
          products: tileProducts,
          productPool,
        }
      })
      .filter(col => col.products.length > 0)

    console.log(`[CollectionsPreview] Done — ${collections.length} collections`)
    return Response.json({ collections })

  } catch (err) {
    console.error('[CollectionsPreview] Route error:', err)
    return Response.json({ collections: [] })
  }
}
