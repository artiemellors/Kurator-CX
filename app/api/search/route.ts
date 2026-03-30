import { NextRequest } from 'next/server'
import { searchKmart, browseCollection, fetchCollections, Product } from '@/lib/kmart-scraper'
import { getCategoryConfig } from '@/lib/category-config'
import { runAgentLoop } from '@/lib/llm-agent'

const WOMENS_TERMS = /\b(women'?s?|ladies|girl'?s?|feminine|womens)\b/i
const MENS_TERMS   = /\b(men'?s?|guy'?s?|boys?|masculine|mens)\b/i

function filterByGender(products: Product[], gender: 'men' | 'women' | null): Product[] {
  if (!gender) return products
  const excludePattern = gender === 'men' ? WOMENS_TERMS : MENS_TERMS
  return products.filter(p => !excludePattern.test(p.name))
}

export async function POST(req: NextRequest) {
  const { query, gender, category } = await req.json() as {
    query: string
    gender: 'men' | 'women' | null
    category?: string
  }

  const config = getCategoryConfig(category ?? 'outfits')
  console.log(`\n${'='.repeat(60)}`)
  console.log(`[Request] query="${query}" gender=${gender ?? 'none'} category=${category ?? 'outfits'}`)

  const availableCollections = await fetchCollections(config.collectionKeywords)
  const collectionContext = availableCollections.length > 0
    ? `\n\nAvailable Kmart collections you can browse with browse_collection (id → display name):\n${availableCollections.map(c => `  ${c.id} → ${c.display_name}`).join('\n')}`
    : ''

  const SYSTEM_PROMPT = gender && config.showGenderFilter
    ? `${config.systemPrompt}${collectionContext}\n\nIMPORTANT: The user is shopping for ${gender === 'men' ? 'a man' : 'a woman'} — every search query and all outfit suggestions must be for ${gender}'s clothing only. Prefix all search_kmart queries with "${gender === 'men' ? "men's" : "women's"}" unless the user has already specified it.`
    : `${config.systemPrompt}${collectionContext}`

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

      try {
        const productMap = new Map<string, Product>()
        let searchIndex = 0

        const result = await runAgentLoop({
          system: SYSTEM_PROMPT,
          userMessage: query,
          maxTokens: 8192,
          tools: [
            {
              name: 'search_kmart',
              description: "Search Kmart Australia for products. Returns up to 10 products, each with an id, name, price, and colour.",
              parameters: {
                type: 'object',
                properties: { query: { type: 'string', description: "Search query, e.g. \"men's black t-shirt\"" } },
                required: ['query'],
              },
            },
            {
              name: 'browse_collection',
              description: 'Browse a Kmart collection by its id to get products curated for that theme.',
              parameters: {
                type: 'object',
                properties: { collection_id: { type: 'string', description: 'The collection id, e.g. "blazers-for-women"' } },
                required: ['collection_id'],
              },
            },
            {
              name: 'present_outfits',
              description: 'Present the final outfit recommendations. Call once all searches are done.',
              parameters: {
                type: 'object',
                properties: {
                  outfits: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name:        { type: 'string' },
                        description: { type: 'string' },
                        items: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              category:     { type: 'string' },
                              description:  { type: 'string' },
                              alternatives: {
                                type: 'array',
                                description: 'Product ids from search results',
                                items: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  refinements: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '4–6 short refinement suggestions. Each 2–5 word lowercase phrase. Vary them — cover at least one price direction, one style shift, and one tone or colour direction.',
                  },
                },
                required: ['outfits'],
              },
            },
          ],
          terminalTool: 'present_outfits',
          onTurn: turn => console.log(`\n[Search] Turn ${turn} — calling AI…`),
          onTool: async (calls) => {
            calls.forEach(c => {
              const isSearch = c.name === 'search_kmart'
              const label = isSearch ? (c.args as { query: string }).query : (c.args as { collection_id: string }).collection_id
              send({ type: 'status', message: isSearch ? `Searching for "${label}"…` : `Browsing collection "${label}"…` })
            })
            console.log(`[Search] Tool calls (${calls.length}): ${calls.map(c => `${c.name}("${c.name === 'search_kmart' ? (c.args as {query:string}).query : (c.args as {collection_id:string}).collection_id}")`).join(', ')}`)

            const t0 = Date.now()
            const fetched = await Promise.all(
              calls.map(c =>
                c.name === 'search_kmart'
                  ? searchKmart((c.args as { query: string }).query, config.categoryFilter)
                  : browseCollection((c.args as { collection_id: string }).collection_id)
              )
            )
            console.log(`[Search] All ${calls.length} fetches done in ${Date.now() - t0}ms`)

            return calls.map((c, i) => {
              const isSearch = c.name === 'search_kmart'
              const label = isSearch ? (c.args as { query: string }).query : (c.args as { collection_id: string }).collection_id
              const allProducts = config.showGenderFilter ? filterByGender(fetched[i], gender) : fetched[i]
              const products = allProducts.slice(0, 10)
              const si = searchIndex++
              console.log(`[${isSearch ? 'search_kmart' : 'browse_collection'}] "${label}" → ${allProducts.length} total, ${products.length} to AI`)

              if (products.length > 0) {
                send({ type: 'status', message: `Found ${products.length} options for "${label}"` })
              } else {
                send({ type: 'status', message: `No results for "${label}" — skipping` })
              }

              const tagged = products.map((p, pi) => {
                const id = `q${si}p${pi}`
                productMap.set(id, p)
                return { id, name: p.name, price: p.price, ...(p.colour ? { colour: p.colour } : {}) }
              })
              return {
                id: c.id,
                name: c.name,
                result: tagged.length > 0
                  ? JSON.stringify(tagged)
                  : 'No results found. Skip this category and proceed with what you have.',
              }
            })
          },
        })

        if (!result) {
          send({ type: 'error', message: 'AI finished without calling present_outfits' })
          return
        }

        const { outfits: rawOutfits, refinements: rawRefinements } = result.args as {
          outfits: Array<{
            name: string
            description: string
            items: Array<{ category: string; description: string; alternatives: string[] }>
          }>
          refinements?: string[]
        }

        console.log(`[Search] present_outfits — ${rawOutfits?.length ?? 0} outfits`)
        rawOutfits?.forEach((o, i) => console.log(`[Search]   Outfit ${i + 1}: "${o.name}" — ${o.items?.length ?? 0} slots`))

        const outfits = (rawOutfits ?? []).map(outfit => ({
          ...outfit,
          items: outfit.items.map(item => ({
            ...item,
            alternatives: item.alternatives
              .map(id => productMap.get(id))
              .filter((p): p is Product => p !== undefined),
          })),
        }))

        send({ type: 'done', result: outfits })

        const refinements = Array.isArray(rawRefinements)
          ? rawRefinements.filter(r => typeof r === 'string').slice(0, 6)
          : []
        if (refinements.length > 0) send({ type: 'refinements', result: refinements })

      } catch (err) {
        console.error('[Search] Route error:', err)
        send({ type: 'error', message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
