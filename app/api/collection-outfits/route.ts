import { NextRequest } from 'next/server'
import { runAgentLoop } from '@/lib/llm-agent'
import { getCategoryConfig } from '@/lib/category-config'
import type { CollectionPreview } from '@/lib/look-session'
import type { CollectionProduct } from '@/app/components/ProductCollections'
import type { Outfit } from '@/app/components/OutfitResults'

export async function POST(req: NextRequest) {
  const { query, collection, products, category } = await req.json() as {
    query: string
    collection: Pick<CollectionPreview, 'name' | 'description'>
    products: CollectionProduct[]
    category?: string
  }

  if (!products?.length || !collection) return Response.json({ outfits: [] })

  const config = getCategoryConfig(category ?? 'outfits')

  // Tag products with stable IDs (image-only, up to 30)
  const tagged = products
    .filter(p => !!p.imageUrl)
    .slice(0, 30)
    .map((p, i) => ({ id: `p${i}`, ...p }))

  const productContext = tagged
    .map(p => `  ${p.id} | ${p.name} | ${p.price}${p.colour ? ` | ${p.colour}` : ''}`)
    .join('\n')

  const productMap = new Map(tagged.map(p => [p.id, p]))

  console.log(`[CollectionOutfits] Generating outfits for "${collection.name}" (${tagged.length} products)`)

  try {
    const result = await runAgentLoop({
      system: `You are a Kmart Australia ${config.label} stylist. Given a themed collection and a product list, create 2–3 outfit ideas using ONLY products from the list. Call present_outfits immediately — do not search for anything.`,
      userMessage: `Collection: "${collection.name}"
Theme: ${collection.description}

Available products:\n${productContext}`,
      maxTokens: 2048,
      maxTurns: 3,
      tools: [
        {
          name: 'present_outfits',
          description: 'Present 2–3 outfit ideas built from the provided product list. Call immediately.',
          parameters: {
            type: 'object',
            properties: {
              outfits: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Short outfit name (2–3 words)' },
                    description: { type: 'string', description: 'One sentence describing the look' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          category: { type: 'string', description: 'Item category, e.g. "Top", "Bottom", "Shoes"' },
                          description: { type: 'string', description: 'How this item works in the look' },
                          alternatives: {
                            type: 'array',
                            items: { type: 'string' },
                            description: '1–2 product IDs from the provided list only',
                          },
                        },
                        required: ['category', 'description', 'alternatives'],
                      },
                    },
                  },
                  required: ['name', 'description', 'items'],
                },
              },
            },
            required: ['outfits'],
          },
        },
      ],
      terminalTool: 'present_outfits',
      label: 'CollectionOutfits',
      onTool: async () => [], // present_outfits is the only tool and it's terminal
    })

    if (!result) return Response.json({ outfits: [] })

    const raw = (result.args as {
      outfits: Array<{
        name: string
        description: string
        items: Array<{ category: string; description: string; alternatives: string[] }>
      }>
    }).outfits

    const outfits: Outfit[] = raw
      .map(outfit => ({
        name: outfit.name,
        description: outfit.description,
        items: outfit.items
          .map(item => ({
            category: item.category,
            description: item.description,
            alternatives: item.alternatives
              .map(id => productMap.get(id))
              .filter((p): p is typeof tagged[number] => !!p?.imageUrl)
              .map(({ id: _id, ...p }) => ({
                name: p.name,
                price: p.price,
                colour: p.colour,
                productUrl: p.productUrl ?? '',
                imageUrl: p.imageUrl!,
              })),
          }))
          .filter(item => item.alternatives.length > 0),
      }))
      .filter(outfit => outfit.items.length >= 2)

    console.log(`[CollectionOutfits] Done — ${outfits.length} outfits for "${collection.name}"`)
    return Response.json({ outfits })

  } catch (err) {
    console.error('[CollectionOutfits] Error:', err)
    return Response.json({ outfits: [] })
  }
}
