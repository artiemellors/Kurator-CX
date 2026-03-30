import { NextRequest } from 'next/server'
import { GoogleGenAI, Type, FunctionCallingConfigMode, type FunctionDeclaration } from '@google/genai'
import { searchKmart, browseCollection, fetchCollections, Product } from '@/lib/kmart-scraper'

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = (err as { status?: number }).status
      const retryable = status === 429 || status === 503
      if (!retryable || attempt === maxAttempts) throw err
      const delay = Math.pow(2, attempt) * 1000
      console.log(`[Collections] ${status} — retry ${attempt}/${maxAttempts - 1} in ${delay / 1000}s…`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

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

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

  const functionDeclarations: FunctionDeclaration[] = [
    {
      name: 'search_kmart',
      description: 'Search Kmart Australia for products. Returns up to 10 products.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING },
        },
        required: ['query'],
      },
    },
    {
      name: 'browse_collection',
      description: 'Browse a Kmart collection by its id.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          collection_id: { type: Type.STRING },
        },
        required: ['collection_id'],
      },
    },
    {
      name: 'present_collections',
      description: 'Present the final themed collections. Call once all searches are done.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          collections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: 'Short editorial collection name' },
                product_ids: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
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
  ]
  const tools = [{ functionDeclarations }]

  const productMap = new Map<string, Product>()
  const contents: object[] = [{
    role: 'user',
    parts: [{ text: `Create 3 themed product collections for: "${query}"${collectionContext}` }],
  }]

  let searchIndex = 0

  for (let turn = 0; turn < 12; turn++) {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents,
      config: {
        maxOutputTokens: 4096,
        systemInstruction: SYSTEM_PROMPT,
        tools,
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
      },
    }))

    const functionCalls = response.functionCalls ?? []
    console.log(`[Collections] Turn ${turn + 1} — ${functionCalls.length} function call(s)`)

    if (response.candidates?.[0]?.content) {
      contents.push(response.candidates[0].content)
    }

    if (functionCalls.length === 0) break

    const presentCall = functionCalls.find(c => c.name === 'present_collections')
    if (presentCall) {
      const raw = (presentCall.args as {
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
    }

    const fetchCalls = functionCalls.filter(
      c => c.name === 'search_kmart' || c.name === 'browse_collection'
    )

    const results = await Promise.all(
      fetchCalls.map(c =>
        c.name === 'search_kmart'
          ? searchKmart((c.args as { query: string }).query)
          : browseCollection((c.args as { collection_id: string }).collection_id)
      )
    )

    const functionResponses = fetchCalls.map((c, i) => {
      const products = results[i].slice(0, 10)
      const si = searchIndex++
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
              : 'No results found.',
          },
        },
      }
    })

    contents.push({ role: 'user', parts: functionResponses })
  }

  return Response.json({ collections: [] })
}
