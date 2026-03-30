import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { searchKmart, browseCollection, Product } from '@/lib/kmart-scraper'
import type { Outfit, OutfitItem, Product as OutfitProduct } from '@/app/components/OutfitResults'

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status !== 529 || attempt === maxAttempts) throw err
      const delay = Math.pow(2, attempt) * 1000
      console.log(`[Refine] 529 overloaded — retry ${attempt}/${maxAttempts - 1} in ${delay / 1000}s…`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

function buildOutfitContext(outfit: Outfit): string {
  const lines = [`Outfit name: "${outfit.name}"`]
  outfit.items.forEach((item, itemIdx) => {
    const products = item.alternatives
      .map((alt, altIdx) => {
        const id = `existing_${itemIdx}_${altIdx}`
        const parts = [id, alt.name, alt.price]
        if (alt.colour) parts.push(alt.colour)
        return `    ${parts.join(' | ')}`
      })
      .join('\n')
    lines.push(`  ${item.category} (slot ${itemIdx}):\n${products}`)
  })
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const { refinement, outfit, originalQuery } = await req.json() as {
    refinement: string
    outfit: Outfit
    originalQuery: string
  }

  if (!refinement?.trim() || !outfit) {
    return Response.json({ error: 'Missing refinement or outfit' }, { status: 400 })
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`[Refine] query="${originalQuery}" refinement="${refinement}"`)

  // Pre-populate productMap with all existing outfit products using stable IDs
  const productMap = new Map<string, Product>()
  outfit.items.forEach((item, itemIdx) => {
    item.alternatives.forEach((alt, altIdx) => {
      const id = `existing_${itemIdx}_${altIdx}`
      productMap.set(id, alt)
    })
  })

  const outfitContext = buildOutfitContext(outfit)

  const SYSTEM_PROMPT = `You are a personal stylist refining an existing outfit for a customer.

Original search: "${originalQuery}"
Customer's request: "${refinement}"

Current outfit:
${outfitContext}

Your job:
1. Analyse what the customer wants to change. Be surgical — if they mention one item, only change that slot unless overall outfit coherence requires more.
2. For slots you are KEEPING: reference their existing IDs directly in present_outfits — do NOT re-search them.
3. For slots you are CHANGING: use search_kmart to find suitable replacements, then reference the new product IDs.
4. Once all needed searches are done, call present_outfits with the complete updated outfit.

Rules:
- Keep the same outfit name unless the refinement fundamentally changes the look
- Each slot must have at least 1 alternative; aim for 2–3 where possible
- Existing IDs look like existing_0_0, existing_1_2 etc. — use them exactly as shown
- New search result IDs will be assigned automatically (q0p0, q0p1, etc.)
- Always include at minimum: a top (or dress), bottom, and footwear`

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
            description: 'Search Kmart Australia for products. Returns up to 10 products with id, name, price, and colour.',
            input_schema: {
              type: 'object' as const,
              properties: { query: { type: 'string', description: 'Search query, e.g. "men\'s chino trousers"' } },
              required: ['query'],
            },
          },
          {
            name: 'browse_collection',
            description: 'Browse a Kmart collection by its id to get products curated for that theme.',
            input_schema: {
              type: 'object' as const,
              properties: { collection_id: { type: 'string' } },
              required: ['collection_id'],
            },
          },
          {
            name: 'present_outfits',
            description: 'Present the refined outfit. Call once all needed searches are complete.',
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
                            category:     { type: 'string' },
                            description:  { type: 'string' },
                            alternatives: {
                              type: 'array',
                              description: 'Product IDs — either existing_X_Y for kept items or new search result IDs',
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
                  description: '4–6 short refinement suggestions relevant to this updated look. Each should be a 2–5 word lowercase phrase.',
                },
              },
              required: ['outfits'],
            },
          },
        ]

        const messages: Anthropic.MessageParam[] = [
          { role: 'user', content: `Refine this outfit: "${refinement}"` },
        ]

        let searchIndex = 0
        let turn = 0

        while (true) {
          turn++
          console.log(`[Refine] Turn ${turn} — calling API…`)

          const response = await withRetry<Anthropic.Message>(() => client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools,
            tool_choice: { type: 'any' },
            messages,
          }))

          console.log(`[Refine] Turn ${turn} — stop_reason: ${response.stop_reason}, tokens: in=${response.usage.input_tokens} out=${response.usage.output_tokens}`)
          messages.push({ role: 'assistant', content: response.content })

          if (response.stop_reason === 'end_turn') {
            send({ type: 'error', message: 'Claude finished without calling present_outfits' })
            break
          }

          const toolBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
          )

          // ── present_outfits ───────────────────────────────────────────────
          const presentBlock = toolBlocks.find(b => b.name === 'present_outfits')
          if (presentBlock) {
            const raw = (presentBlock.input as {
              outfits: Array<{
                name: string
                description: string
                items: Array<{ category: string; description: string; alternatives: string[] }>
              }>
              refinements?: string[]
            })

            // Resolve product IDs — handles both existing_X_Y and new q0p0 IDs
            const resolvedOutfits: Outfit[] = raw.outfits.map(o => ({
              name:        o.name,
              description: o.description ?? '',
              items:       o.items.map((item): OutfitItem => ({
                category:    item.category,
                description: item.description ?? '',
                alternatives: item.alternatives
                  .map(id => productMap.get(id))
                  .filter((p): p is Product => p !== undefined) as unknown as OutfitProduct[],
              })).filter(item => item.alternatives.length > 0),
            }))

            const outfitCount = resolvedOutfits.length
            const kept    = resolvedOutfits[0]?.items.flatMap(i => i.alternatives).filter(p => {
              // rough check: see if any existing_ ID resolves to this product
              return Array.from(productMap.entries()).some(([k, v]) => k.startsWith('existing_') && v === p)
            }).length ?? 0
            console.log(`[Refine] Resolved ${outfitCount} outfit(s). Kept ~${kept} existing products.`)

            send({ type: 'done', result: resolvedOutfits[0] ?? null })

            const chips = Array.isArray(raw.refinements)
              ? raw.refinements.filter(r => typeof r === 'string').slice(0, 6)
              : []
            if (chips.length > 0) send({ type: 'refinements', result: chips })

            return
          }

          // ── search_kmart / browse_collection ─────────────────────────────
          const fetchBlocks = [
            ...toolBlocks.filter(b => b.name === 'search_kmart'),
            ...toolBlocks.filter(b => b.name === 'browse_collection'),
          ]

          if (fetchBlocks.length === 0) {
            send({ type: 'error', message: 'Unexpected: no tool calls and no present_outfits' })
            break
          }

          fetchBlocks.forEach(b => {
            const label = b.name === 'search_kmart'
              ? (b.input as { query: string }).query
              : (b.input as { collection_id: string }).collection_id
            send({ type: 'status', message: b.name === 'search_kmart' ? `Searching for "${label}"…` : `Browsing "${label}"…` })
          })

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
            console.log(`[Refine] "${b.name === 'search_kmart' ? (b.input as {query:string}).query : (b.input as {collection_id:string}).collection_id}" → ${products.length} products`)
            return {
              type:        'tool_result' as const,
              tool_use_id: b.id,
              content:     tagged.length > 0
                ? JSON.stringify(tagged)
                : 'No results found.',
            }
          })

          messages.push({ role: 'user', content: toolResults })
        }
      } catch (err) {
        console.error('[Refine] Route error:', err)
        send({ type: 'error', message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
