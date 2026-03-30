import { NextRequest } from 'next/server'
import { searchKmart, browseCollection, Product } from '@/lib/kmart-scraper'
import type { Outfit, OutfitItem, Product as OutfitProduct } from '@/app/components/OutfitResults'
import { runAgentLoop } from '@/lib/llm-agent'

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

  const productMap = new Map<string, Product>()
  outfit.items.forEach((item, itemIdx) => {
    item.alternatives.forEach((alt, altIdx) => {
      productMap.set(`existing_${itemIdx}_${altIdx}`, alt)
    })
  })

  const SYSTEM_PROMPT = `You are a personal stylist refining an existing outfit for a customer.

Original search: "${originalQuery}"
Customer's request: "${refinement}"

Current outfit:
${buildOutfitContext(outfit)}

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
        let searchIndex = 0

        const result = await runAgentLoop({
          system: SYSTEM_PROMPT,
          userMessage: `Refine this outfit: "${refinement}"`,
          maxTokens: 4096,
          tools: [
            {
              name: 'search_kmart',
              description: 'Search Kmart Australia for products. Returns up to 10 products with id, name, price, and colour.',
              parameters: {
                type: 'object',
                properties: { query: { type: 'string', description: "Search query, e.g. \"men's chino trousers\"" } },
                required: ['query'],
              },
            },
            {
              name: 'browse_collection',
              description: 'Browse a Kmart collection by its id to get products curated for that theme.',
              parameters: {
                type: 'object',
                properties: { collection_id: { type: 'string' } },
                required: ['collection_id'],
              },
            },
            {
              name: 'present_outfits',
              description: 'Present the refined outfit. Call once all needed searches are complete.',
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
                              category:    { type: 'string' },
                              description: { type: 'string' },
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
          ],
          terminalTool: 'present_outfits',
          onTurn: turn => console.log(`[Refine] Turn ${turn} — calling AI…`),
          onTool: async (calls) => {
            calls.forEach(c => {
              const isSearch = c.name === 'search_kmart'
              const label = isSearch ? (c.args as { query: string }).query : (c.args as { collection_id: string }).collection_id
              send({ type: 'status', message: isSearch ? `Searching for "${label}"…` : `Browsing "${label}"…` })
            })

            const fetched = await Promise.all(
              calls.map(c =>
                c.name === 'search_kmart'
                  ? searchKmart((c.args as { query: string }).query)
                  : browseCollection((c.args as { collection_id: string }).collection_id)
              )
            )

            return calls.map((c, i) => {
              const products = fetched[i].slice(0, 10)
              const si = searchIndex++
              const tagged = products.map((p, pi) => {
                const id = `q${si}p${pi}`
                productMap.set(id, p)
                return { id, name: p.name, price: p.price, ...(p.colour ? { colour: p.colour } : {}) }
              })
              const label = c.name === 'search_kmart'
                ? (c.args as { query: string }).query
                : (c.args as { collection_id: string }).collection_id
              console.log(`[Refine] "${label}" → ${products.length} products`)
              return {
                id: c.id,
                name: c.name,
                result: tagged.length > 0 ? JSON.stringify(tagged) : 'No results found.',
              }
            })
          },
        })

        if (!result) {
          send({ type: 'error', message: 'AI finished without calling present_outfits' })
          return
        }

        const raw = result.args as {
          outfits: Array<{
            name: string
            description: string
            items: Array<{ category: string; description: string; alternatives: string[] }>
          }>
          refinements?: string[]
        }

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

        const kept = resolvedOutfits[0]?.items.flatMap(i => i.alternatives).filter(p =>
          Array.from(productMap.entries()).some(([k, v]) => k.startsWith('existing_') && v === p)
        ).length ?? 0
        console.log(`[Refine] Resolved ${resolvedOutfits.length} outfit(s). Kept ~${kept} existing products.`)

        send({ type: 'done', result: resolvedOutfits[0] ?? null })

        const chips = Array.isArray(raw.refinements)
          ? raw.refinements.filter(r => typeof r === 'string').slice(0, 6)
          : []
        if (chips.length > 0) send({ type: 'refinements', result: chips })

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
