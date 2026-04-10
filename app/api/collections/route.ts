import { NextRequest } from 'next/server'
import { searchKmart, browseCollection, fetchCollections, Product } from '@/lib/kmart-scraper'
import { runAgentLoop } from '@/lib/llm-agent'
import { getCategoryConfig } from '@/lib/category-config'

function buildCollectionsPrompt(categoryLabel: string, itemGroupLabel: string): string {
  return `You are a Kmart Australia ${categoryLabel} editor creating shoppable themed edits.

Given a request and a set of already-found products, create exactly 3 distinct themed collections. Each collection must be well-rounded — a curated mix of product types from different sub-categories. Never fill a collection with only one product type.

Each collection needs:
- A short editorial name (2–4 words, e.g. "Coastal Weekend", "Smart Casual", "Bold & Bright")
- At least 20 products that are relevant to the collection's theme, drawn from at least 5 different sub-categories

Search strategy:
- You already have some products from the initial search — check what types they cover first
- Then search for ADDITIONAL types that are missing or under-represented
- Make at least 6 search calls to build a large product pool
- Use search_kmart for specific items; use browse_collection when a Kmart collection fits a theme
- If a search returns 0 results, move on immediately — do not retry variants of the same item
- Once you have 60+ products OR have made 8+ searches, call present_collections straight away

Product ordering — group by what goes together:
1. Place items that would be worn or used together adjacent to each other (e.g. top → matching bottom → shoes → accessories)
2. Then move to the next natural grouping within the collection's theme
3. The result should read as naturally shoppable ${itemGroupLabel.toLowerCase()} pairings across the grid`
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
      maxTurns: 18,
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
                      description: 'Product ids ordered by outfit adjacency: items that go together appear adjacent (e.g. top → bottom → shoes). Then move to the next natural pairing.',
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
      label: 'Collections',
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

    if (!result) {
      console.log(`[Collections] Turn limit reached — falling back to ${productMap.size} found products`)
      return Response.json({ collections: [] })
    }

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
