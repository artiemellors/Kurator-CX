import { NextRequest } from 'next/server'
import { searchKmart, browseCollection, fetchCollections, Product } from '@/lib/kmart-scraper'
import { runAgentLoop } from '@/lib/llm-agent'

const SYSTEM_PROMPT = `You are a Kmart Australia fashion editor creating outfit-based shoppable edits.

Given a style request, create exactly 3 distinct themed collections. Each collection must be OUTFIT-READY — a curated mix of product categories that together build a complete look (tops, bottoms, footwear, outerwear, accessories). Never fill a collection with only one category.

Each collection needs:
- A short editorial name (2–4 words, e.g. "Coastal Weekend", "Smart Casual", "Bold & Bright")
- 8–12 products drawn from multiple outfit categories (aim for at least 4 different categories per collection)

Search strategy:
- Think about what outfit themes complement the request, then search for each component category
- Use search_kmart for specific items (e.g. "linen trousers", "white sneakers", "crossbody bag")
- Use browse_collection when a Kmart collection fits a theme

Product ordering — apply "colour story + outfit adjacency":
1. Group products by colour family (neutrals/whites first, then earth tones, then mid-tones, then accents/brights)
2. Within each colour group, place items that would be worn together adjacent to each other
3. The result should read as visually cohesive rows and naturally shoppable outfit pairings

Once you have enough products, call present_collections with your results in this deliberate order.`

export async function POST(req: NextRequest) {
  const { query } = await req.json() as { query: string }
  if (!query?.trim()) return Response.json({ collections: [] })

  console.log(`[Collections] Building collections for "${query}"`)

  const availableCollections = await fetchCollections([])
  const collectionContext = availableCollections.length > 0
    ? `\n\nAvailable Kmart collections you can browse:\n${availableCollections.map(c => `  ${c.id} → ${c.display_name}`).join('\n')}`
    : ''

  try {
    const productMap = new Map<string, Product>()
    let searchIndex = 0

    const result = await runAgentLoop({
      system: SYSTEM_PROMPT,
      userMessage: `Create 3 themed product collections for: "${query}"${collectionContext}`,
      maxTokens: 4096,
      maxTurns: 12,
      tools: [
        {
          name: 'search_kmart',
          description: 'Search Kmart Australia for products. Returns up to 10 products.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
        {
          name: 'browse_collection',
          description: 'Browse a Kmart collection by its id.',
          parameters: {
            type: 'object',
            properties: { collection_id: { type: 'string' } },
            required: ['collection_id'],
          },
        },
        {
          name: 'present_collections',
          description: 'Present the final themed collections. Call once all searches are done.',
          parameters: {
            type: 'object',
            properties: {
              collections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Short editorial collection name' },
                    product_ids: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Product ids ordered by colour story + outfit adjacency: neutrals/whites first, then earth tones, then mid-tones, then accents. Within each colour group, items worn together appear adjacent.',
                    },
                  },
                  required: ['name', 'product_ids'],
                },
              },
            },
            required: ['collections'],
          },
        },
      ],
      terminalTool: 'present_collections',
      onTool: async (calls) => {
        const fetched = await Promise.all(
          calls.map(c =>
            c.name === 'search_kmart'
              ? searchKmart((c.args as { query: string }).query)
              : browseCollection((c.args as { collection_id: string }).collection_id)
          )
        )
        return calls.map((c, i) => {
          const products = fetched[i].slice(0, 10)
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
      collections: Array<{ name: string; product_ids: string[] }>
    }).collections

    const collections = raw
      .map(col => ({
        name: col.name,
        products: col.product_ids
          .map(id => productMap.get(id))
          .filter((p): p is Product => p !== undefined),
      }))
      .filter(col => col.products.length > 0)

    console.log(`[Collections] Done — ${collections.length} collections, ${collections.reduce((n, c) => n + c.products.length, 0)} products total`)
    return Response.json({ collections })

  } catch (err) {
    console.error('[Collections] Route error:', err)
    return Response.json({ collections: [] })
  }
}
