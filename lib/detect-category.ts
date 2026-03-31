import type { CategorySlug } from './category-config'

/**
 * Infer the most relevant category from a free-text query.
 * Checked in priority order (most specific first); defaults to 'outfits'.
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
