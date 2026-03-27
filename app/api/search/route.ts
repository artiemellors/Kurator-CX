import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { searchKmart, browseCollection, fetchCollections, Product } from '@/lib/kmart-scraper'
import { getCategoryConfig } from '@/lib/category-config'

// Retry wrapper for Anthropic API calls — 529 overloaded errors are transient
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isOverloaded = (err as { status?: number }).status === 529
      if (!isOverloaded || attempt === maxAttempts) throw err
      const delay = Math.pow(2, attempt) * 1000  // 2s, 4s, 8s
      console.log(`[API] 529 overloaded — retry ${attempt}/${maxAttempts - 1} in ${delay / 1000}s…`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

// Keyword-based gender filter applied at the data layer as a backstop.
// Kmart product names reliably contain gendered terms we can check against.
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

  // Fetch category-relevant collections in parallel with building the prompt
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
        const client = new Anthropic()

        const tools: Anthropic.Tool[] = [
          {
            name: 'search_kmart',
            description: "Search Kmart Australia for products. Returns up to 10 products, each with an id, name, price, and colour.",
            input_schema: {
              type: 'object' as const,
              properties: { query: { type: 'string', description: "Search query, e.g. \"men's black t-shirt\"" } },
              required: ['query'],
            },
          },
          {
            name: 'browse_collection',
            description: 'Browse a Kmart collection by its id to get products curated for that theme.',
            input_schema: {
              type: 'object' as const,
              properties: { collection_id: { type: 'string', description: 'The collection id, e.g. "blazers-for-women"' } },
              required: ['collection_id'],
            },
          },
          {
            name: 'present_outfits',
            description: 'Present the final outfit recommendations. Call once all searches are done.',
            input_schema: {
              type: 'object' as const,
              properties: {
                outfits: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      items: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            category: { type: 'string' },
                            description: { type: 'string' },
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
                  description: '4–6 short refinement suggestions the user could apply to this search. Each should be a 2–5 word lowercase phrase, e.g. "make it more casual", "darker tones", "tighter budget", "add a layer", "more formal". Vary them — cover at least one price direction, one style shift, and one tone or colour direction.',
                },
              },
              required: ['outfits'],
            },
          },
        ]

        const productMap = new Map<string, Product>()  // what Claude sees (10/search)
        const fullPool = new Map<string, Product>()    // everything fetched (24/search)
        const messages: Anthropic.MessageParam[] = [{ role: 'user', content: query }]
        let turn = 0
        let searchIndex = 0

        while (true) {
          turn++
          console.log(`\n[Claude] Turn ${turn} — calling API…`)
          const response = await withRetry(() => client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            tools,
            tool_choice: { type: 'any' },
            messages,
          }))
          console.log(`[Claude] Turn ${turn} — stop_reason: ${response.stop_reason}, blocks: ${response.content.length}, tokens: in=${response.usage.input_tokens} out=${response.usage.output_tokens}`)

          // Log any reasoning/text Claude emits before tool calls
          for (const block of response.content) {
            if (block.type === 'text' && block.text.trim()) {
              console.log(`[Claude] Thinking: ${block.text.slice(0, 500)}${block.text.length > 500 ? '…' : ''}`)
            }
          }

          messages.push({ role: 'assistant', content: response.content })

          if (response.stop_reason === 'end_turn') {
            send({ type: 'error', message: 'Claude finished without calling present_outfits' })
            break
          }

          if (response.stop_reason === 'tool_use') {
            const toolBlocks = response.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
            )

            const presentBlock = toolBlocks.find(b => b.name === 'present_outfits')
            if (presentBlock) {
              const rawOutfits = (presentBlock.input as {
                outfits: Array<{
                  name: string
                  description: string
                  items: Array<{ category: string; description: string; alternatives: string[] }>
                }>
              }).outfits
              const outfitCount = Array.isArray(rawOutfits) ? rawOutfits.length : '?'
              console.log(`[Claude] present_outfits called — ${outfitCount} outfits`)
              if (Array.isArray(rawOutfits)) {
                rawOutfits.forEach((o, i) => {
                  console.log(`[Claude]   Outfit ${i + 1}: "${o.name}" — ${o.items?.length ?? 0} slots`)
                })
              }

              // Collect all product IDs referenced in outfit slots
              const usedInOutfits = new Set(
                rawOutfits.flatMap(o => o.items.flatMap(i => i.alternatives))
              )

              // Resolve product IDs back to full product objects
              const outfits = rawOutfits.map(outfit => ({
                ...outfit,
                items: outfit.items.map(item => ({
                  ...item,
                  alternatives: item.alternatives
                    .map(id => productMap.get(id))
                    .filter((p): p is Product => p !== undefined),
                })),
              }))

              // Send outfit results immediately — don't wait for collections
              send({ type: 'done', result: outfits })

              // Emit AI-generated refinement chips
              const rawRefinements = (presentBlock.input as { refinements?: unknown }).refinements
              const refinements = Array.isArray(rawRefinements)
                ? (rawRefinements as string[]).filter(r => typeof r === 'string').slice(0, 6)
                : []
              if (refinements.length > 0) {
                send({ type: 'refinements', result: refinements })
              }

              // Build collections from full pool products not used in outfits
              const unusedProducts = [...fullPool.entries()]
                .filter(([id]) => !usedInOutfits.has(id))
                .map(([id, p]) => ({ id, name: p.name, price: p.price, colour: p.colour }))

              console.log(`[Collections] ${unusedProducts.length} unused products in pool for collections`)

              if (unusedProducts.length >= 8) {
                send({ type: 'status', message: 'Curating collections…' })
                try {
                  // Pass products as a JSON array with numeric ids — same format Claude already
                  // knows from outfit search results. Sonnet reliably echoes back the ids it's given.
                  const productList = unusedProducts.map((p, i) => ({
                    id: i,
                    name: p.name,
                    price: p.price,
                    ...(p.colour ? { colour: p.colour } : {}),
                  }))

                  const targetPerCollection = Math.min(20, Math.floor(unusedProducts.length / 2))
                  const collectionsResponse = await withRetry(() => client.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 4096,
                    system: `You are a product merchandiser for a Kmart ${config.label} finder app.
A user searched for: "${query}".${gender && config.showGenderFilter ? ` The user is shopping for ${gender === 'men' ? 'a man' : 'a woman'} — only include ${gender}'s products.` : ''}
Group these products into 2–3 themed collections that complement that search.
Give each collection a short evocative name (e.g. "Resort Ready", "Off-Duty Cool", "Weekend Edit") that feels relevant to the user's intent.
Aim for ${targetPerCollection} products per collection. Every product should appear in exactly one collection — distribute them all.
Each product has a numeric "id" field. Use those exact id values in your response.
Respond ONLY with valid JSON: { "collections": [{ "name": string, "products": number[] }] }`,
                    messages: [{
                      role: 'user',
                      content: JSON.stringify(productList),
                    }],
                  }))

                  const text = (collectionsResponse.content[0] as Anthropic.TextBlock).text
                  console.log(`[Collections] Sonnet raw response: ${text.slice(0, 300)}`)
                  // Extract JSON by matching balanced braces (greedy regex fails when model
                  // appends text after the closing brace that itself contains a `}`)
                  const extractJson = (s: string): string | null => {
                    const start = s.indexOf('{')
                    if (start === -1) return null
                    let depth = 0
                    for (let i = start; i < s.length; i++) {
                      if (s[i] === '{') depth++
                      else if (s[i] === '}' && --depth === 0) return s.slice(start, i + 1)
                    }
                    return null
                  }
                  const jsonStr = extractJson(text)
                  if (jsonStr) {
                    const { collections: rawCollections } = JSON.parse(jsonStr) as {
                      collections: Array<{ name: string; products: number[] }>
                    }
                    const resolvedCollections = rawCollections
                      .map(col => ({
                        name: col.name,
                        products: col.products
                          .flatMap(idx => {
                            const entry = unusedProducts[idx]
                            if (!entry) return []
                            const product = fullPool.get(entry.id)
                            return product ? [product] : []
                          })
                          .slice(0, 20),
                      }))
                      .filter(col => col.products.length >= 4)

                    console.log(`[Collections] ${resolvedCollections.length} collections resolved`)
                    if (resolvedCollections.length > 0) {
                      send({ type: 'collections', result: resolvedCollections })
                    }
                  }
                } catch (collErr) {
                  console.error('[Collections] Failed to curate collections:', collErr)
                  // Non-fatal — outfit results already sent
                }
              }

              return
            }

            const searchBlocks = toolBlocks.filter(b => b.name === 'search_kmart')
            const browseBlocks = toolBlocks.filter(b => b.name === 'browse_collection')

            const allFetchBlocks = [
              ...searchBlocks.map(b => ({ block: b, type: 'search' as const, label: (b.input as { query: string }).query })),
              ...browseBlocks.map(b => ({ block: b, type: 'browse' as const, label: (b.input as { collection_id: string }).collection_id })),
            ]

            allFetchBlocks.forEach(({ type, label }) => {
              send({ type: 'status', message: type === 'search' ? `Searching for "${label}"…` : `Browsing collection "${label}"…` })
            })
            console.log(`[Claude] Tool calls (${allFetchBlocks.length}): ${allFetchBlocks.map(f => `${f.type === 'search' ? 'search_kmart' : 'browse_collection'}("${f.label}")`).join(', ')}`)

            const t0 = Date.now()
            const results = await Promise.all(
              allFetchBlocks.map(({ type, label }) =>
                type === 'search' ? searchKmart(label, config.categoryFilter) : browseCollection(label)
              )
            )
            console.log(`[Search] All ${allFetchBlocks.length} fetches done in ${Date.now() - t0}ms`)

            const toolResults: Anthropic.ToolResultBlockParam[] = allFetchBlocks.map(({ block, type, label }, i) => {
              const allProducts = config.showGenderFilter ? filterByGender(results[i], gender) : results[i]
              const products = allProducts.slice(0, 10)  // Claude sees top 10
              const si = searchIndex++
              console.log(`[${type === 'search' ? 'search_kmart' : 'browse_collection'}] "${label}" → ${allProducts.length} total, ${products.length} to Claude`)
              if (products.length > 0) {
                send({ type: 'status', message: `Found ${products.length} options for "${label}"` })
              } else {
                send({ type: 'status', message: `No results for "${label}" — skipping` })
              }

              // Tag Claude's 10 products and store in both maps
              const tagged = products.map((p, pi) => {
                const id = `q${si}p${pi}`
                productMap.set(id, p)
                fullPool.set(id, p)
                return { id, name: p.name, price: p.price, ...(p.colour ? { colour: p.colour } : {}) }
              })

              // Store the remaining products in fullPool only (not visible to Claude)
              allProducts.slice(10).forEach((p, pi) => {
                const id = `q${si}x${pi}`
                fullPool.set(id, p)
              })

              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: tagged.length > 0
                  ? JSON.stringify(tagged)
                  : 'No results found. Skip this category and proceed with what you have.',
              }
            })
            messages.push({ role: 'user', content: toolResults })
          }
        }
      } catch (err) {
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
