import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { searchKmart, browseCollection, fetchCollections, Product } from '@/lib/kmart-scraper'

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status !== 529 || attempt === maxAttempts) throw err
      const delay = Math.pow(2, attempt) * 1000
      console.log(`[Collections] 529 overloaded — retry ${attempt}/${maxAttempts - 1} in ${delay / 1000}s…`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

const SYSTEM_PROMPT = `You are a Kmart Australia fashion editor creating shoppable edits.

Given a style request, create exactly 3 distinct themed collections of products from Kmart.
Each collection should have:
- A short editorial name (2–4 words, e.g. "Coastal Weekend", "Smart Casual", "Bold & Bright")
- 6–10 products sourced by searching or browsing Kmart

Think about what themed angles would complement the request, then search for each.
Use search_kmart for specific items and browse_collection when a Kmart collection fits a theme.
You may make multiple searches per collection to fill it out.

Once you have enough products, call present_collections with your results.`

export async function POST(req: NextRequest) {
  const { query } = await req.json() as { query: string }
  if (!query?.trim()) return Response.json({ collections: [] })

  console.log(`[Collections] Building collections for "${query}"`)

  const availableCollections = await fetchCollections([])
  const collectionContext = availableCollections.length > 0
    ? `\n\nAvailable Kmart collections you can browse:\n${availableCollections.map(c => `  ${c.id} → ${c.display_name}`).join('\n')}`
    : ''

  const client = new Anthropic()

  const tools: Anthropic.Tool[] = [
    {
      name: 'search_kmart',
      description: 'Search Kmart Australia for products. Returns up to 10 products.',
      input_schema: {
        type: 'object' as const,
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
    {
      name: 'browse_collection',
      description: 'Browse a Kmart collection by its id.',
      input_schema: {
        type: 'object' as const,
        properties: { collection_id: { type: 'string' } },
        required: ['collection_id'],
      },
    },
    {
      name: 'present_collections',
      description: 'Present the final themed collections. Call once all searches are done.',
      input_schema: {
        type: 'object' as const,
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
                  description: 'Product ids from search results to include in this collection',
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

  const productMap = new Map<string, Product>()
  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Create 3 themed product collections for: "${query}"${collectionContext}`,
  }]

  let searchIndex = 0

  for (let turn = 0; turn < 12; turn++) {
    const response = await withRetry<Anthropic.Message>(() => client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      tool_choice: { type: 'any' },
      messages,
    }))

    console.log(`[Collections] Turn ${turn + 1} — stop_reason: ${response.stop_reason}`)
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') break

    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )

    const presentBlock = toolBlocks.find(b => b.name === 'present_collections')
    if (presentBlock) {
      const raw = (presentBlock.input as {
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

    const fetchBlocks = [
      ...toolBlocks.filter(b => b.name === 'search_kmart'),
      ...toolBlocks.filter(b => b.name === 'browse_collection'),
    ]

    const results = await Promise.all(
      fetchBlocks.map(b =>
        b.name === 'search_kmart'
          ? searchKmart((b.input as { query: string }).query)
          : browseCollection((b.input as { collection_id: string }).collection_id)
      )
    )

    const toolResults: Anthropic.ToolResultBlockParam[] = fetchBlocks.map((b, i) => {
      const products = results[i].slice(0, 10)
      const si = searchIndex++
      const tagged = products.map((p, pi) => {
        const id = `q${si}p${pi}`
        productMap.set(id, p)
        return { id, name: p.name, price: p.price, ...(p.colour ? { colour: p.colour } : {}) }
      })
      return {
        type: 'tool_result' as const,
        tool_use_id: b.id,
        content: tagged.length > 0
          ? JSON.stringify(tagged)
          : 'No results found.',
      }
    })

    messages.push({ role: 'user', content: toolResults })
  }

  return Response.json({ collections: [] })
}
