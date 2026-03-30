import { NextRequest } from 'next/server'
import { GoogleGenAI, Type, FunctionCallingConfigMode, type FunctionDeclaration } from '@google/genai'
import { searchKmart, browseCollection, fetchCollections, Product } from '@/lib/kmart-scraper'
import { getCategoryConfig } from '@/lib/category-config'

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = (err as { status?: number }).status
      const retryable = status === 429 || status === 503
      if (!retryable || attempt === maxAttempts) {
        console.error(`[API] Error (status=${status ?? 'none'}, attempt=${attempt}):`, err)
        throw err
      }
      const delay = Math.pow(2, attempt) * 1000
      console.log(`[API] ${status} — retry ${attempt}/${maxAttempts - 1} in ${delay / 1000}s…`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

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
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

        const functionDeclarations: FunctionDeclaration[] = [
          {
            name: 'search_kmart',
            description: "Search Kmart Australia for products. Returns up to 10 products, each with an id, name, price, and colour.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                query: { type: Type.STRING, description: "Search query, e.g. \"men's black t-shirt\"" },
              },
              required: ['query'],
            },
          },
          {
            name: 'browse_collection',
            description: 'Browse a Kmart collection by its id to get products curated for that theme.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                collection_id: { type: Type.STRING, description: 'The collection id, e.g. "blazers-for-women"' },
              },
              required: ['collection_id'],
            },
          },
          {
            name: 'present_outfits',
            description: 'Present the final outfit recommendations. Call once all searches are done.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                outfits: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name:        { type: Type.STRING },
                      description: { type: Type.STRING },
                      items: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            category:    { type: Type.STRING },
                            description: { type: Type.STRING },
                            alternatives: {
                              type: Type.ARRAY,
                              description: 'Product ids from search results',
                              items: { type: Type.STRING },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                refinements: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '4–6 short refinement suggestions the user could apply to this search. Each should be a 2–5 word lowercase phrase, e.g. "make it more casual", "darker tones", "tighter budget", "add a layer", "more formal". Vary them — cover at least one price direction, one style shift, and one tone or colour direction.',
                },
              },
              required: ['outfits'],
            },
          },
        ]
        const tools = [{ functionDeclarations }]

        const productMap = new Map<string, Product>()
        const contents: object[] = [{ role: 'user', parts: [{ text: query }] }]
        let turn = 0
        let searchIndex = 0

        while (true) {
          turn++
          console.log(`\n[Gemini] Turn ${turn} — calling API…`)

          const response = await withRetry(() => ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents,
            config: {
              maxOutputTokens: 8192,
              systemInstruction: SYSTEM_PROMPT,
              tools,
              toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
            },
          }))

          const functionCalls = response.functionCalls ?? []
          console.log(`[Gemini] Turn ${turn} — ${functionCalls.length} function call(s)`)

          // Log any text parts
          for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if ('text' in part && (part as { text: string }).text?.trim()) {
              const t = (part as { text: string }).text
              console.log(`[Gemini] Text: ${t.slice(0, 300)}${t.length > 300 ? '…' : ''}`)
            }
          }

          // Accumulate the model turn in history
          if (response.candidates?.[0]?.content) {
            contents.push(response.candidates[0].content)
          }

          if (functionCalls.length === 0) {
            send({ type: 'error', message: 'Gemini finished without calling present_outfits' })
            break
          }

          // ── present_outfits ───────────────────────────────────────────
          const presentCall = functionCalls.find(c => c.name === 'present_outfits')
          if (presentCall) {
            const args = presentCall.args as {
              outfits: Array<{
                name: string
                description: string
                items: Array<{ category: string; description: string; alternatives: string[] }>
              }>
              refinements?: string[]
            }

            const rawOutfits = args.outfits ?? []
            console.log(`[Gemini] present_outfits called — ${rawOutfits.length} outfits`)
            rawOutfits.forEach((o, i) => {
              console.log(`[Gemini]   Outfit ${i + 1}: "${o.name}" — ${o.items?.length ?? 0} slots`)
            })

            const outfits = rawOutfits.map(outfit => ({
              ...outfit,
              items: outfit.items.map(item => ({
                ...item,
                alternatives: item.alternatives
                  .map(id => productMap.get(id))
                  .filter((p): p is Product => p !== undefined),
              })),
            }))

            send({ type: 'done', result: outfits })

            const refinements = Array.isArray(args.refinements)
              ? (args.refinements as string[]).filter(r => typeof r === 'string').slice(0, 6)
              : []
            if (refinements.length > 0) send({ type: 'refinements', result: refinements })

            return
          }

          // ── search_kmart / browse_collection ─────────────────────────
          const fetchCalls = functionCalls.filter(
            c => c.name === 'search_kmart' || c.name === 'browse_collection'
          )

          if (fetchCalls.length === 0) {
            send({ type: 'error', message: 'Unexpected: no recognised function calls' })
            break
          }

          fetchCalls.forEach(c => {
            const isSearch = c.name === 'search_kmart'
            const label = isSearch
              ? (c.args as { query: string }).query
              : (c.args as { collection_id: string }).collection_id
            send({
              type: 'status',
              message: isSearch ? `Searching for "${label}"…` : `Browsing collection "${label}"…`,
            })
          })

          console.log(`[Gemini] Tool calls (${fetchCalls.length}): ${fetchCalls.map(c => `${c.name}("${c.name === 'search_kmart' ? (c.args as {query:string}).query : (c.args as {collection_id:string}).collection_id}")`).join(', ')}`)

          const t0 = Date.now()
          const results = await Promise.all(
            fetchCalls.map(c =>
              c.name === 'search_kmart'
                ? searchKmart((c.args as { query: string }).query, config.categoryFilter)
                : browseCollection((c.args as { collection_id: string }).collection_id)
            )
          )
          console.log(`[Search] All ${fetchCalls.length} fetches done in ${Date.now() - t0}ms`)

          const functionResponses = fetchCalls.map((c, i) => {
            const isSearch = c.name === 'search_kmart'
            const label = isSearch
              ? (c.args as { query: string }).query
              : (c.args as { collection_id: string }).collection_id
            const allProducts = config.showGenderFilter ? filterByGender(results[i], gender) : results[i]
            const products = allProducts.slice(0, 10)
            const si = searchIndex++
            console.log(`[${isSearch ? 'search_kmart' : 'browse_collection'}] "${label}" → ${allProducts.length} total, ${products.length} to Gemini`)

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
              functionResponse: {
                name: c.name,
                id: c.id,
                response: {
                  result: tagged.length > 0
                    ? JSON.stringify(tagged)
                    : 'No results found. Skip this category and proceed with what you have.',
                },
              },
            }
          })

          contents.push({ role: 'user', parts: functionResponses })
        }
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
