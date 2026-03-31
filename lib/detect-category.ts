import type { CategorySlug } from './category-config'
import { CATEGORY_SLUGS } from './category-config'

/**
 * Regex-based category detection — instant, used as fallback.
 */

const SIGNALS: Partial<Record<CategorySlug, RegExp>> = {
  easter: /\b(easter|egg hunt|hot cross|bunny|rabbit)\b/i,
  parties: /\b(party|parties|birthday|balloon|celebrate|celebration|confetti|streamer|theme party|kids party|party supplies|party decor|party pack)\b/i,
  kitchen: /\b(cook(ware|ing)?|bak(e|ing|eware)|kitchen|pan|pots?|skillet|casserole|utensil|cutlery|recipe|dining set|bbq|barbecue|roast|wok|colander|coffee station|coffee maker|appliance|crockery|tableware|serveware)\b/i,
  home: /\b(living room|bedroom|bathroom|cushion|throw pillow|rug|area rug|home decor|interior|wall art|lamp|lighting|curtain|blind|sofa|couch|lounge|shelf|shelving|vase|candle|mirror|bedding|quilt|duvet|linen|frame|basket|storage unit|side table|coffee table|dining table|console table|tv unit|tv stand|entertainment unit|bookcase|bookshelf|desk|armchair|ottoman|wardrobe|dresser|chest of drawers|bed frame|mattress|furniture)\b/i,
}

const PRIORITY: CategorySlug[] = ['easter', 'parties', 'kitchen', 'home']

export function detectCategory(query: string): CategorySlug {
  for (const slug of PRIORITY) {
    if (SIGNALS[slug]?.test(query)) return slug
  }
  return 'outfits'
}

/**
 * AI-powered category classification — more accurate for natural language.
 * Falls back to regex if the AI call fails.
 */

const CLASSIFY_PROMPT = `You are a product search classifier for Kmart Australia.
Given a customer's search query, respond with ONLY the single most relevant category slug.

Categories:
- outfits — clothing, shoes, activewear, fashion accessories, jewellery, anything you wear
- home — furniture (tables, sofas, TV units, desks, chairs, bed frames), bedroom, bathroom, home decor, rugs, cushions, lighting, curtains, storage, mirrors, wall art, candles, vases
- kitchen — cookware, bakeware, appliances, utensils, dinnerware, glassware, serveware, food prep, kitchen storage, lunch boxes
- parties — party supplies, balloons, decorations, costumes, party tableware, celebration items
- easter — Easter eggs, Easter decorations, Easter baskets, hot cross buns, Easter novelties

Respond with ONLY the category slug (outfits, home, kitchen, parties, or easter). No explanation.`

export async function classifyCategory(query: string): Promise<CategorySlug> {
  const regexResult = detectCategory(query)

  try {
    const provider = (process.env.LLM_PROVIDER?.toLowerCase() ?? 'gemini') as 'gemini' | 'anthropic'

    let slug: string

    if (provider === 'gemini') {
      const { GoogleGenAI } = await import('@google/genai')
      const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })
      const model = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite-preview'
      const res = await client.models.generateContent({
        model,
        contents: query,
        config: {
          systemInstruction: CLASSIFY_PROMPT,
          maxOutputTokens: 16,
          temperature: 0,
        },
      })
      slug = (res.text ?? '').trim().toLowerCase()
    } else {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const client = new Anthropic()
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
      const res = await client.messages.create({
        model,
        max_tokens: 16,
        system: CLASSIFY_PROMPT,
        messages: [{ role: 'user', content: query }],
      })
      slug = (res.content[0] as { text: string }).text.trim().toLowerCase()
    }

    if ((CATEGORY_SLUGS as readonly string[]).includes(slug)) {
      if (slug !== regexResult) {
        console.log(`[Classify] AI="${slug}" overrides regex="${regexResult}" for "${query}"`)
      }
      return slug as CategorySlug
    }

    console.log(`[Classify] AI returned unknown slug "${slug}", falling back to regex="${regexResult}"`)
    return regexResult
  } catch (err) {
    console.log(`[Classify] AI failed, falling back to regex="${regexResult}":`, (err as Error).message)
    return regexResult
  }
}
