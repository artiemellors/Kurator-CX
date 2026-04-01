import { NextRequest } from 'next/server'
import { searchKmart, browseCollection, fetchCollections, Product } from '@/lib/kmart-scraper'
import { getCategoryConfig } from '@/lib/category-config'
import { runAgentLoop } from '@/lib/llm-agent'
import type { CollectionPreview } from '@/lib/look-session'

export async function POST(req: NextRequest) {
  const { query, collection, category } = await req.json() as {
    query: string
    collection: CollectionPreview
    category?: string
  }

  if (!query?.trim() || !collection) return Response.json({ products: [] })

  const config = getCategoryConfig(category ?? 'outfits')

  console.log(`[EditProducts] Fetching products for "${collection.name}" (query="${query}")`)

  const availableCollections = await fetchCollections(config.collectionKeywords)
  const collectionContext = availableCollections.length > 0
    ? `\n\nAvailable Kmart collections you can browse:\n${availableCollections.map(c => `  ${c.id} → ${c.display_name}`).join('\n')}`
    : ''

  const SYSTEM_PROMPT = `You are a Kmart Australia stylist building a shoppable product feed for a themed editorial collection.

Your goal: find 20–30 products that match the collection's theme, mood, and aesthetic.

Search rules:
- Use short, specific queries — one product type per search call (e.g. "linen shirt", "white sneakers")
- Make at least 4 search calls to cover the range of product types that fit the theme
- Browse relevant Kmart collections if any match the theme
- Once you have 20+ products, call present_products

Product selection criteria:
- All products must feel coherent with the collection theme
- Cover a variety of product types — do not repeat the same type more than 3 times
- Prefer products with images

When done, call present_products with an ordered list of product IDs.${collectionContext}`

  const userMessage = `Collection: "${collection.name}"
Description: ${collection.description}
Style direction: ${collection.pivots.join(', ')}
User search: "${query}"`

  try {
    const productMap = new Map<string, Product>()
    let searchIndex = 0

    // Pre-populate with the 3 preview products already in the collection
    collection.products.forEach((p, i) => {
      productMap.set(`preview_${i}`, p as Product)
    })

    const result = await runAgentLoop({
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 4096,
      maxTurns: 10,
      tools: [
        {
          name: 'search_kmart',
          description: 'Search Kmart Australia for products. Returns up to 20 products.',
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
          name: 'present_products',
          description: 'Present the final ordered product list. Call after at least 4 searches.',
          parameters: {
            type: 'object',
            properties: {
              product_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Ordered list of product IDs from the search results.',
              },
            },
            required: ['product_ids'],
          },
        },
      ],
      terminalTool: 'present_products',
      onTool: async (calls) => {
        const fetched = await Promise.all(
          calls.map(c =>
            c.name === 'search_kmart'
              ? searchKmart((c.args as { query: string }).query, config.categoryFilter)
              : browseCollection((c.args as { collection_id: string }).collection_id)
          )
        )
        return calls.map((c, i) => {
          const products = fetched[i].slice(0, 20)
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

    if (!result) return Response.json({ products: [] })

    const { product_ids } = result.args as { product_ids: string[] }
    const products = (product_ids ?? [])
      .map(id => productMap.get(id))
      .filter((p): p is Product => p !== undefined && !!p.imageUrl)

    // Append any preview products not already included, so the tile images always appear
    const included = new Set(products.map(p => p.name))
    for (const p of collection.products) {
      if (!included.has(p.name) && p.imageUrl) products.push(p as Product)
    }

    console.log(`[EditProducts] Done — ${products.length} products for "${collection.name}"`)
    return Response.json({ products })

  } catch (err) {
    console.error('[EditProducts] Route error:', err)
    return Response.json({ products: [] })
  }
}
