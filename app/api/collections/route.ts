import { NextRequest } from 'next/server'
import { searchKmart, browseCollection, fetchCollections, Product } from '@/lib/kmart-scraper'
import { runAgentLoop } from '@/lib/llm-agent'
import { getCategoryConfig } from '@/lib/category-config'

function buildCollectionsPrompt(categoryLabel: string, itemGroupLabel: string): string {
  return `You are a Kmart Australia ${categoryLabel} editor creating shoppable themed edits.

Given a request and a set of already-found products, create exactly 3 distinct themed collections. Each collection must be well-rounded — a curated mix of product types from different sub-categories. Never fill a collection with only one product type.

Each collection needs:
- A short editorial name (2–4 words, e.g. "Coastal Weekend", "Smart Casual", "Bold & Bright")
- 20–30 products drawn from multiple sub-categories (aim for at least 5 different types per collection)

Search strategy:
- You already have some products from the initial search — check what types they cover first
- Then search for ADDITIONAL types that are missing or under-represented
- You MUST make at least 6 search calls before calling present_collections — build a large product pool
- Use search_kmart for specific items
- Use browse_collection when a Kmart collection fits a theme

Product ordering — apply "colour story + item adjacency":
1. Group products by colour family (neutrals/whites first, then earth tones, then mid-tones, then accents/brights)
2. Within each colour group, place items that would be used or displayed together adjacent to each other
3. The result should read as visually cohesive rows and naturally shoppable ${itemGroupLabel.toLowerCase()} pairings

Once you have at least 60 total products across seed + searches, call present_collections.`
}

export async function POST(req: NextRequest) {
  const { query, seedProducts, category } = await req.json() as {
    query: string
    seedProducts?: Array<{ name: string; price: string; colour?: string; productUrl?: string; imageUrl?: string }>
    category?: string
  }
  const config = getCategoryConfig(category ?? 'outfits')
  if (!query?.trim()) return Response.json({ collections: [] })

  console.log(`[Collections] Building collections for "${query}" category=${category ?? 'outfits'} (${seedProducts?.length ?? 0} seed products)`)

  const availableCollections = await fetchCollections(config.collectionKeywords)
  const collectionContext = availableCollections.length > 0
    ? `\n\nAvailable Kmart collections you can browse:\n${availableCollections.map(c => `  ${c.id} → ${c.display_name}`).join('\n')}`
    : ''

  try {
    const productMap = new Map<string, Product>()
    let searchIndex = 0

    // Pre-populate productMap with outfit seed products
    let seedContext = ''
    if (seedProducts && seedProducts.length > 0) {
      const seedList = seedProducts.map((p, i) => {
        const id = `seed_${i}`
        productMap.set(id, p as Product)
        return `  ${id} | ${p.name} | ${p.price}${p.colour ? ` | ${p.colour}` : ''}`
      })
      seedContext = `\n\nAlready-found products from the outfit search (use these IDs directly — do NOT re-search them):\n${seedList.join('\n')}`
    }

    const SYSTEM_PROMPT = buildCollectionsPrompt(config.label, config.itemGroupLabel)

    const result = await runAgentLoop({
      system: SYSTEM_PROMPT,
      userMessage: `Create 3 themed product collections for: "${query}"${seedContext}${collectionContext}`,
      maxTokens: 4096,
      maxTurns: 15,
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
          name: 'present_collections',
          description: 'Present the final themed collections. Call only after making at least 6 searches.',
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
              ? searchKmart((c.args as { query: string }).query, config.categoryFilter)
              : browseCollection((c.args as { collection_id: string }).collection_id)
          )
        )
        return calls.map((c, i) => {
          // Show AI up to 20 products per search (vs 10 for outfits) for a larger pool
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
