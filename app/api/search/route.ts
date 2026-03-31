import { NextRequest } from 'next/server'
import { searchKmart, browseCollection, fetchCollections, Product } from '@/lib/kmart-scraper'
import { getCategoryConfig } from '@/lib/category-config'
import { classifyCategory } from '@/lib/detect-category'
import { runAgentLoop } from '@/lib/llm-agent'

const WOMENS_TERMS = /\b(women'?s?|ladies|girl'?s?|feminine|womens)\b/i
const MENS_TERMS   = /\b(men'?s?|guy'?s?|boys?|masculine|mens)\b/i
// Children's/baby terms — excluded whenever the request is clearly for adults
const KIDS_TERMS   = /\b(kids?|children'?s?|toddler|infant|baby|babies|junior|youth|newborn)\b/i
// Signals in the query that confirm it is for children
const QUERY_KIDS   = /\b(kids?|children|toddler|infant|baby|junior|youth|little ones?)\b/i

function inferGender(query: string): 'men' | 'women' | null {
  const q = query.toLowerCase()
  if (/\b(for (a |the )?(man|men|guy|male|him|husband|boyfriend|dad|father|boy))\b/.test(q)) return 'men'
  if (/\b(for (a |the )?(woman|women|girl|female|her|wife|girlfriend|mum|mom|mother))\b/.test(q)) return 'women'
  if (/\b(men'?s|menswear|his |male )\b/.test(q)) return 'men'
  if (/\b(women'?s|womenswear|her |female )\b/.test(q)) return 'women'
  return null
}

function filterProducts(products: Product[], gender: 'men' | 'women' | null, queryIsForKids: boolean): Product[] {
  return products.filter(p => {
    const name = p.name
    // Always exclude opposite gender
    if (gender === 'men'   && WOMENS_TERMS.test(name)) return false
    if (gender === 'women' && MENS_TERMS.test(name))   return false
    // Exclude kids items when the query is for adults
    if (!queryIsForKids && KIDS_TERMS.test(name)) return false
    return true
  })
}

export async function POST(req: NextRequest) {
  const { query, gender: explicitGender } = await req.json() as {
    query: string
    gender: 'men' | 'women' | null
  }

  // AI-powered classification — runs in parallel with direct product search on client
  const category = await classifyCategory(query)
  const config = getCategoryConfig(category)
  // Use explicit gender if provided, otherwise infer from query text
  const gender = explicitGender ?? (config.showGenderFilter ? inferGender(query) : null)
  const queryIsForKids = QUERY_KIDS.test(query)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`[Request] query="${query}" gender=${gender ?? 'none'} (explicit=${explicitGender ?? 'none'}) kidsQuery=${queryIsForKids} category=${category ?? 'outfits'}`)

  const availableCollections = await fetchCollections(config.collectionKeywords)
  const collectionContext = availableCollections.length > 0
    ? `\n\nAvailable Kmart collections you can browse with browse_collection (id → display name):\n${availableCollections.map(c => `  ${c.id} → ${c.display_name}`).join('\n')}`
    : ''

  let SYSTEM_PROMPT = config.systemPrompt + collectionContext
  if (gender && config.showGenderFilter) {
    SYSTEM_PROMPT += `\n\nIMPORTANT: The user is shopping for ${gender === 'men' ? 'a man' : 'a woman'} — all outfit suggestions must be for ${gender}. Prefix clothing and footwear searches with "${gender === 'men' ? "men's" : "women's"}" (e.g. "women's jeans", "men's jacket"). Do NOT add a gender prefix to bags, accessories, jewellery, belts, hats, or scarves — Kmart does not gender-tag these (e.g. search "handbag" not "women's handbag", "belt" not "men's belt").`
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const send = (event: object) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          closed = true
        }
      }

      try {
        // Tell the client what category was classified so it can pass it to the look page
        send({ type: 'category', result: category })

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
                            required: ['category', 'alternatives'],
                          },
                        },
                      },
                      required: ['name', 'items'],
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
              const allProducts = config.showGenderFilter ? filterProducts(fetched[i], gender, queryIsForKids) : fetched[i]
              const products = allProducts.slice(0, 10)
              const si = searchIndex++
              console.log(`[${isSearch ? 'search_kmart' : 'browse_collection'}] "${label}" → ${allProducts.length} total, ${products.length} to AI`)

              // Emit full result set so the search page can fill the product grid
              // for natural-language queries that return 0 from direct Kmart search
              if (allProducts.length > 0) {
                send({ type: 'products', result: allProducts })
              }

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
        closed = true
        try { controller.close() } catch { /* already closed */ }
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
