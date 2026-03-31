// ─── Category Config ──────────────────────────────────────────────────────────
// Single source of truth for all per-category behaviour.
// Add a new entry here to add a new category — no other changes required
// (assuming the Kmart search API returns relevant products for it).

export interface Tile { label: string; query: string }

export interface CategoryConfig {
  slug: string
  label: string
  heroHeadline: string
  heroSubline: string
  searchPlaceholder: string
  exampleQueries: string[]
  occasionSectionLabel: string
  // outfits has gender-keyed tiles; all others use a flat array
  occasionTiles: Record<'men' | 'women' | 'all', Tile[]> | Tile[]
  showGenderFilter: boolean
  supportsVisualise?: boolean
  visualiseMode?: 'room' | 'outfit'
  systemPrompt: string
  // URL-encoded Kmart category filter string appended to the search URL.
  // Decoded form shown in comments. Empty string = no category restriction.
  categoryFilter: string
  collectionKeywords: string[]
  itemGroupLabel: string
  totalLabel: string
  loadingCopy: { thinking: string[]; searching: string[]; curating: string[] }
}

// ─── Outfits ─────────────────────────────────────────────────────────────────

const OUTFITS_CONFIG: CategoryConfig = {
  slug: 'outfits',
  label: 'Outfits',
  heroHeadline: 'Find your complete look.',
  heroSubline: 'Style Intelligence',
  searchPlaceholder: 'e.g. smart casual for a job interview',
  exampleQueries: [
    'night out for a stag party',
    'smart casual for a job interview',
    'casual summer outfit for a man',
    'gym look for a woman',
    'beach day with the kids',
    'date night, a bit dressed up',
    'cosy winter layers',
    'weekend brunch, something relaxed',
    'streetwear for a teen boy',
    "workwear that doesn't feel boring",
  ],
  occasionSectionLabel: 'Popular occasions',
  showGenderFilter: true,
  supportsVisualise: true,
  visualiseMode: 'outfit',
  occasionTiles: {
    men: [
      { label: 'Stag Night',     query: 'night out for a stag party' },
      { label: 'Job Interview',  query: 'smart casual outfit for a job interview' },
      { label: 'Summer Casual',  query: 'casual summer outfit for men' },
      { label: 'Gym',            query: 'gym look for a guy' },
      { label: 'Beach Day',      query: 'beach day with the kids' },
      { label: 'Streetwear',     query: 'streetwear outfit for men' },
      { label: 'Workwear',       query: "workwear that doesn't feel boring" },
      { label: 'Weekend Brunch', query: 'weekend brunch, something relaxed' },
    ],
    women: [
      { label: 'Job Interview',  query: 'smart casual outfit for a job interview' },
      { label: 'Gym',            query: 'gym look for a woman' },
      { label: 'Beach Day',      query: 'beach day with the kids' },
      { label: 'Date Night',     query: 'date night, a bit dressed up' },
      { label: 'Winter Layers',  query: 'cosy winter layers' },
      { label: 'Weekend Brunch', query: 'weekend brunch, something relaxed' },
      { label: 'Workwear',       query: "workwear that doesn't feel boring" },
      { label: 'Garden Party',   query: 'garden party outfit' },
    ],
    all: [
      { label: 'Job Interview',  query: 'smart casual outfit for a job interview' },
      { label: 'Weekend Brunch', query: 'weekend brunch, something relaxed' },
      { label: 'Beach Day',      query: 'beach day with the kids' },
      { label: 'Date Night',     query: 'date night, a bit dressed up' },
      { label: 'Night Out',      query: 'night out outfit' },
      { label: 'Gym',            query: 'gym outfit' },
      { label: 'Winter Layers',  query: 'cosy winter layers' },
      { label: 'Workwear',       query: "workwear that doesn't feel boring" },
    ],
  },
  systemPrompt: `You are an outfit curator for Kmart Australia.

Step 1 — reason about the occasion before you search. Think through:
- Environment: where is this being worn? (outdoors, office, gym, restaurant, beach…)
- Activity level: standing still, walking, physical exertion, formal sitting?
- Formality: casual, smart casual, formal, sporty?
- Functional requirements: warmth, grip, coverage, breathability, waterproofing?
- Social context: who else is there, what impression does the wearer want to make?
Use this reasoning to decide exactly which product types to search for — including the right type of footwear (hiking boots vs heels vs trainers vs sandals), the appropriate outerwear, and the most suitable accessory for the situation.

Step 2 — in your FIRST response, call search_kmart and/or browse_collection for ALL required product types at once. Max 5 calls total.
- Plan your searches to cover Top (or Dress), Bottom, Footwear, and at least one Accessory suited to the occasion — use simple, non-gendered terms for accessories (e.g. "jewellery", "handbag", "belt", "cap", "scarf", "sunglasses") as Kmart does not index accessories by gender
- Use short, specific search queries — one product type per call (e.g. "bucket hat", "belt", "jewellery"). Do not combine multiple product types into one query — Constructor.io matches literally and "cap hat bucket hat" returns 0 results where "bucket hat" returns many
- Use browse_collection when a collection id is a strong match
- Use search_kmart for specific product types

Step 3 — once results are in, call present_outfits. Reference products by id only. Provide 2–4 named outfit pairings. Build as complete an outfit as the results allow — aim for Top (or Dress), Bottom, Footwear, and an Accessory, adding Outerwear when the occasion warrants it. Only create a slot if you have relevant products for it — do not file a clothing item or a second pair of shoes as an accessory. When selecting alternatives within each slot, apply the same functional requirements you established in Step 1 — choose options that suit the occasion, not just the most visually appealing. Group items by category (Top, Bottom, Footwear, Accessory, Bag, Outerwear, etc.) with 3–5 alternatives per slot. Use colour to build cohesive looks. You MUST call present_outfits even if some searches returned no results. Do not use emojis in outfit names or descriptions.

Gender and age rules — strictly enforce:
- Never mix men's and women's clothing in the same outfit
- If the request is for an adult (man or woman), never include children's, kids', toddler, or baby clothing
- If the request does not specify children, assume it is for an adult`,
  // filters[Category][]=Clothing, Activewear, Shoes
  categoryFilter:
    '&filters%5BCategory%5D%5B%5D=Clothing' +
    '&filters%5BCategory%5D%5B%5D=Activewear' +
    '&filters%5BCategory%5D%5B%5D=Shoes',
  collectionKeywords: [
    'dress', 'shirt', 'pants', 'jacket', 'shoes', 'footwear', 'skirt', 'jeans',
    'shorts', 'blazer', 'tracksuit', 'leggings', 'swimwear', 'sleepwear', 'top',
    'boot', 'heel', 'sneaker', 'apparel', 'clothing', 'fashion', 'wear', 'denim',
    'coat', 'suit', 'tshirt', 't-shirt', 'hoodie', 'jumper', 'cardigan', 'blouse',
    'vest', 'sock', 'hat', 'cap', 'bag', 'tote', 'sandal', 'flat', 'loafer',
    'mule', 'slipper', 'flannel', 'cargo', 'bucket', 'linen', 'cotton', 'hi-vis',
    'mens', 'womens', "men's", "women's", 'hi vis', 'everlast',
    'belt', 'jewellery', 'jewelry', 'scarf', 'sunglasses', 'accessory', 'accessories',
    'wallet', 'purse', 'clutch', 'backpack', 'crossbody', 'hair', 'watch',
  ],
  itemGroupLabel: 'Selected Look',
  totalLabel: 'Complete outfit',
  loadingCopy: {
    thinking: [
      'Reading your brief…',
      'Decoding your aesthetic…',
      'Working out what you need…',
      'Getting the picture…',
      'Thinking through the options…',
    ],
    searching: [
      'Hunting down the best fits…',
      'Browsing the racks…',
      'Sourcing the pieces…',
      'Checking every aisle…',
      'Comparing the options…',
      'Filtering out the noise…',
      'On the lookout for something good…',
      'Checking what\'s in stock…',
      'Sifting through the shelves…',
      'Scanning the collection…',
      'Finding the right pieces…',
      'Looking for a good match…',
    ],
    curating: [
      'Pulling the look together…',
      'Almost dressed…',
      'Finishing touches…',
      'Nearly ready to wear…',
      'Making sure it all works…',
      'Pairing things up…',
      'Getting the details right…',
      'Putting the final look together…',
    ],
  },
}

// ─── Home & Living ────────────────────────────────────────────────────────────

const HOME_CONFIG: CategoryConfig = {
  slug: 'home',
  label: 'Home & Living',
  heroHeadline: 'Style your space.',
  heroSubline: 'Home Intelligence',
  searchPlaceholder: 'e.g. cosy living room refresh with warm tones',
  exampleQueries: [
    'living room refresh with cushions, throws and a rug',
    'bedroom update with new linen, lighting and decor',
    'outdoor entertaining area with rugs, cushions and lighting',
    'gallery wall with frames and decorative accessories',
    'cosy reading nook with soft furnishings and a lamp',
    'dining room setting with table decor, candles and placemats',
    'home office desk setup with storage and decor',
    'kids bedroom with storage, lighting and fun decor',
  ],
  occasionSectionLabel: 'Popular looks',
  showGenderFilter: false,
  supportsVisualise: true,
  occasionTiles: [
    { label: 'Living Room Refresh', query: 'living room refresh with cushions, throws and a rug' },
    { label: 'Bedroom Makeover',    query: 'bedroom update with new linen, lighting and decor' },
    { label: 'Outdoor Entertaining', query: 'outdoor entertaining area with rugs, cushions and lighting' },
    { label: 'Gallery Wall',        query: 'gallery wall with frames and decorative accessories' },
    { label: 'Cosy Reading Nook',   query: 'cosy reading nook with soft furnishings and a lamp' },
    { label: 'Dining Room',         query: 'dining room setting with table decor, candles and placemats' },
    { label: 'Home Office',         query: 'home office desk setup with storage and decor' },
    { label: 'Kids Room',           query: 'kids bedroom with storage, lighting and fun decor' },
  ] as Tile[],
  systemPrompt: `You are a home styling curator for Kmart Australia. Your job is to build complete, shoppable room looks around the user's query.

Step 1 — reason about the space and intent before you search. Think through:
- Which room or area is this? (living room, bedroom, bathroom, outdoor, home office, kids room…)
- What is the user's primary anchor product or starting point, if any? (sofa, rug, bed frame, lamp, coffee table…)
- What mood or style are they after? (cosy, coastal, minimalist, warm tones, cool tones, earthy, maximalist…)
- What functional needs does this space have? (seating comfort, storage, lighting levels, soft furnishings, display, organisation…)
- What product types would make this space feel complete and cohesive?
Use this reasoning to build a specific search list — do not default to generic home terms.

Step 2 — in your FIRST response, fire ALL searches at once (4–5 calls). Never make just 1 search.
- Apply any colour or style cues from the query as modifiers on soft furnishing searches (e.g. "sage green cushion", "coastal rug") — not on furniture or structural pieces
- Use browse_collection when a collection id is a strong match

Step 3 — once results are in, call present_outfits. Reference products by id only. Provide 2–4 named room looks. For each look, group items by room element (Rug, Cushions, Lighting, Throws, Vase, Storage, etc.) with 3–5 alternatives per slot. When selecting alternatives, maintain the mood and functional coherence you established in Step 1. Build cohesive colour stories. Do not use emojis in look names or descriptions.`,
  // No category filter — Constructor.io's taxonomy doesn't cleanly map to top-level
  // names like "Furniture", so filtering causes false negatives (e.g. coffee tables
  // disappearing). The AI system prompt already restricts searches to home products.
  categoryFilter: '',
  collectionKeywords: [
    'cushion', 'rug', 'throw', 'linen', 'bedding', 'lighting', 'lamp', 'vase',
    'candle', 'frame', 'wall art', 'storage', 'basket', 'shelf', 'mirror', 'decor',
    'home', 'living', 'bedroom', 'bathroom', 'outdoor', 'garden', 'curtain', 'blind',
    'quilt', 'duvet', 'pillow', 'coverlet', 'sheeting', 'artificial', 'plant',
  ],
  itemGroupLabel: 'Room Look',
  totalLabel: 'Complete room',
  loadingCopy: {
    thinking: [
      'Reading your brief…',
      'Getting the picture…',
      'Thinking through the options…',
      'Imagining the space…',
    ],
    searching: [
      'Browsing the range…',
      'Checking every aisle…',
      'Scouring the shelves…',
      'Finding the right pieces…',
      'Looking for a good match…',
      'Sorting through the options…',
    ],
    curating: [
      'Pulling the look together…',
      'Finishing touches…',
      'Making sure it all works…',
      'Putting the final room together…',
    ],
  },
}

// ─── Kitchen & Dining ────────────────────────────────────────────────────────

const KITCHEN_CONFIG: CategoryConfig = {
  slug: 'kitchen',
  label: 'Kitchen & Dining',
  heroHeadline: 'Kit out your kitchen.',
  heroSubline: 'Kitchen Intelligence',
  searchPlaceholder: 'e.g. complete cookware set for weeknight dinners',
  exampleQueries: [
    'roast dinner cookware and serving pieces',
    'weeknight dinner pots, pans and utensils',
    'brunch table setting with appliances and tableware',
    'baking equipment, bakeware and storage',
    'meal prep containers, knives and chopping boards',
    'barbecue tools, platters and outdoor dining',
    'coffee station with appliances, mugs and storage',
    'kids lunch boxes, containers and drink bottles',
  ],
  occasionSectionLabel: 'Popular sets',
  showGenderFilter: false,
  supportsVisualise: true,
  occasionTiles: [
    { label: 'Sunday Roast',     query: 'roast dinner cookware and serving pieces' },
    { label: 'Weeknight Dinners', query: 'weeknight dinner pots, pans and utensils' },
    { label: 'Brunch at Home',   query: 'brunch table setting with appliances and tableware' },
    { label: 'Baking Day',       query: 'baking equipment, bakeware and storage' },
    { label: 'Meal Prep',        query: 'meal prep containers, knives and chopping boards' },
    { label: 'Outdoor BBQ',      query: 'barbecue tools, platters and outdoor dining' },
    { label: 'Coffee Corner',    query: 'coffee station with appliances, mugs and storage' },
    { label: 'Kids Lunches',     query: 'kids lunch boxes, containers and drink bottles' },
  ] as Tile[],
  systemPrompt: `You are a kitchen and dining curator for Kmart Australia. Your job is to build complete, shoppable kitchen sets around the user's query.

Step 1 — reason about the cooking or dining context before you search. Think through:
- What is the occasion or activity? (weeknight cooking, entertaining guests, baking day, meal prep, morning routine, outdoor BBQ, kids lunches…)
- What are the primary cooking methods or tasks involved? (stovetop, oven, barbecue, cold prep, blending, baking, serving…)
- What cookware, appliances, or tools does this activity specifically require?
- What tableware or serving pieces would complete the experience?
- Is there a style or aesthetic at play? (rustic, sleek, colourful, neutral, earthy, matching sets…)
- What practical storage or prep items would round out the set?
Use this reasoning to decide which specific product types to search for — not a generic kitchen checklist.

Step 2 — in your FIRST response, fire ALL searches at once (4–5 calls). Never make just 1 search.
- Use browse_collection when a collection id is a strong match

Step 3 — once results are in, call present_outfits. Reference products by id only. Provide 2–4 named kitchen sets. For each set, group items by type (Cookware, Utensils, Tableware, Storage, Appliance, etc.) with 3–5 alternatives per slot. When selecting alternatives, apply the same functional and aesthetic logic from Step 1. Build cohesive sets by colour and material. Do not use emojis in set names or descriptions.`,
  // No category filter — the AI system prompt restricts searches to kitchen/dining
  // products; a filter adds no benefit and risks blocking valid results.
  categoryFilter: '',
  collectionKeywords: [
    'cookware', 'pan', 'pot', 'knife', 'cutting board', 'utensil', 'mug', 'cup',
    'plate', 'bowl', 'glass', 'bakeware', 'storage', 'container', 'appliance',
    'kettle', 'toaster', 'blender', 'coffee', 'kitchen', 'dining', 'tableware',
    'serveware', 'colander', 'strainer', 'dinner', 'lunch', 'breakfast',
  ],
  itemGroupLabel: 'Kitchen Set',
  totalLabel: 'Complete set',
  loadingCopy: {
    thinking: [
      'Reading your brief…',
      'Getting the picture…',
      'Thinking through the options…',
      'Planning the kitchen…',
    ],
    searching: [
      'Browsing the range…',
      'Checking every aisle…',
      'Scanning the shelves…',
      'Finding the right pieces…',
      'Comparing the options…',
    ],
    curating: [
      'Bringing the set together…',
      'Finishing touches…',
      'Making sure it all fits…',
      'Putting the final set together…',
    ],
  },
}

// ─── Kids Parties ────────────────────────────────────────────────────────────

const PARTIES_CONFIG: CategoryConfig = {
  slug: 'parties',
  label: 'Kids Parties',
  heroHeadline: 'Plan the perfect party.',
  heroSubline: 'Party Intelligence',
  searchPlaceholder: 'e.g. dinosaur theme birthday party for a 5 year old',
  exampleQueries: [
    'rainbow theme birthday party decorations and tableware',
    'dinosaur theme party tableware, decorations and activities',
    'princess theme party supplies and dress up',
    'superhero theme party decorations and costumes',
    'unicorn party balloons, tableware and decorations',
    'outdoor summer birthday party supplies for kids',
    'movie night party setup for kids with decorations and snacks',
    'arts and crafts activity party for children',
  ],
  occasionSectionLabel: 'Popular themes',
  showGenderFilter: false,
  supportsVisualise: true,
  occasionTiles: [
    { label: 'Rainbow Birthday',  query: 'rainbow theme birthday party decorations and tableware' },
    { label: 'Dinosaur Party',    query: 'dinosaur theme party tableware, decorations and activities' },
    { label: 'Princess Party',    query: 'princess theme party supplies and dress up' },
    { label: 'Superhero Party',   query: 'superhero theme party decorations and costumes' },
    { label: 'Unicorn Party',     query: 'unicorn party balloons, tableware and decorations' },
    { label: 'Outdoor Party',     query: 'outdoor summer birthday party supplies for kids' },
    { label: 'Movie Night Party', query: 'movie night party setup for kids with decorations and snacks' },
    { label: 'Arts & Crafts',     query: 'arts and crafts activity party for children' },
  ] as Tile[],
  systemPrompt: `You are a kids party planning curator for Kmart Australia.

Step 1 — reason about the party before you search. Think through:
- What is the theme, character, or colour palette? (dinosaur, princess, rainbow, superhero, unicorn, space, jungle…)
- What is the party format? (indoor seated meal, backyard running around, craft activity, movie night, swimming…)
- What age group is this for? (toddlers, primary school, mixed ages…)
- What product categories does a party like this need? (decorations, tableware, balloons, costumes, activities, party favours, goody bags…)
- What specific colours, characters, or motifs should the searches reflect to feel on-theme?
Use this reasoning to build a targeted, specific search list — not just "party decorations".

Step 2 — in your FIRST response, call search_kmart and/or browse_collection for ALL required product types at once. Max 5 calls total.
- Use browse_collection when a collection id is a strong match
- Use search_kmart for specific product types

Step 3 — once results are in, call present_outfits. Reference products by id only. Provide 2–4 named party packs. For each pack, group items by category (Decorations, Tableware, Balloons, Costumes, Activities, etc.) with 3–5 alternatives per slot. When selecting alternatives, maintain the theme coherence you established in Step 1. Build cohesive packs by theme and colour. You MUST call present_outfits even if some searches returned no results. Do not use emojis in pack names or descriptions.`,
  // filters[Category][]=Balloons, Decorations, Candles & Toppers, Party Plates & Bowls,
  //   Party Napkins, Party Cups, Party Cutlery, Party Serveware & Accessories,
  //   Party Favours & Glow, Table Decor, Loots Bags & Invites, Pretend Play & Dress Up,
  //   Kids Art, Craft & Stationery
  categoryFilter:
    '&filters%5BCategory%5D%5B%5D=Balloons' +
    '&filters%5BCategory%5D%5B%5D=Decorations' +
    '&filters%5BCategory%5D%5B%5D=Candles%20%26%20Toppers' +
    '&filters%5BCategory%5D%5B%5D=Party%20Plates%20%26%20Bowls' +
    '&filters%5BCategory%5D%5B%5D=Party%20Napkins' +
    '&filters%5BCategory%5D%5B%5D=Party%20Cups' +
    '&filters%5BCategory%5D%5B%5D=Party%20Cutlery' +
    '&filters%5BCategory%5D%5B%5D=Party%20Serveware%20%26%20Accessories' +
    '&filters%5BCategory%5D%5B%5D=Party%20Favours%20%26%20Glow' +
    '&filters%5BCategory%5D%5B%5D=Table%20Decor' +
    '&filters%5BCategory%5D%5B%5D=Loots%20Bags%20%26%20Invites' +
    '&filters%5BCategory%5D%5B%5D=Pretend%20Play%20%26%20Dress%20Up' +
    '&filters%5BCategory%5D%5B%5D=Kids%20Art%2C%20Craft%20%26%20Stationery',
  collectionKeywords: [
    'party', 'balloon', 'decoration', 'tableware', 'plate', 'cup', 'napkin',
    'banner', 'streamer', 'confetti', 'costume', 'dress up', 'game', 'activity',
    'craft', 'goody bag', 'birthday', 'celebration', 'pinata', 'candle', 'topper',
  ],
  itemGroupLabel: 'Party Pack',
  totalLabel: 'Complete party pack',
  loadingCopy: {
    thinking: [
      'Reading your brief…',
      'Planning the party…',
      'Getting the picture…',
      'Thinking through the theme…',
    ],
    searching: [
      'Browsing the range…',
      'Checking every aisle…',
      'Finding the right pieces…',
      'Sourcing the supplies…',
      'Scanning the collection…',
    ],
    curating: [
      'Pulling the party together…',
      'Finishing touches…',
      'Getting the details right…',
      'Almost party-ready…',
    ],
  },
}

// ─── Easter ──────────────────────────────────────────────────────────────────

const EASTER_CONFIG: CategoryConfig = {
  slug: 'easter',
  label: 'Easter',
  heroHeadline: 'Make Easter memorable.',
  heroSubline: 'Easter Curator',
  searchPlaceholder: 'e.g. Easter egg hunt supplies for kids',
  exampleQueries: [
    'Easter egg hunt baskets, buckets and outdoor decorations',
    'Easter table setting with tableware, centrepieces and decorations',
    'Easter gift basket fillers, novelties and plush toys',
    'Easter brunch tableware, serveware and decorations',
    'kids Easter activity kit with crafts, games and novelties',
  ],
  occasionSectionLabel: 'Popular looks',
  showGenderFilter: false,
  supportsVisualise: true,
  occasionTiles: [
    { label: 'Egg Hunt',      query: 'Easter egg hunt baskets, buckets and outdoor decorations' },
    { label: 'Easter Table',  query: 'Easter table setting with tableware, centrepieces and decorations' },
    { label: 'Easter Basket', query: 'Easter gift basket fillers, novelties and plush toys' },
    { label: 'Easter Brunch', query: 'Easter brunch tableware, serveware and decorations' },
    { label: 'Kids Easter',   query: 'kids Easter activity kit with crafts, games and novelties' },
  ] as Tile[],
  systemPrompt: `You are an Easter styling and gifting curator for Kmart Australia.

Step 1 — reason about the Easter request before you search. Think through:
- Which aspect of Easter does this focus on? (egg hunt, table setting, gift basket, brunch hosting, kids activities, home decoration, or a combination…)
- Who is the audience? (young children, primary-age kids, whole family, adults hosting, mixed ages…)
- What mood or aesthetic? (traditional pastels, bold and colourful, natural/earthy, playful and character-driven…)
- What specific product types does this experience call for? Think beyond the obvious Easter items to the full set needed — containers, tableware, activities, serving pieces, fillers, outdoor items
Use this reasoning to build a specific, targeted search list.

Step 2 — in your FIRST response, call search_kmart and/or browse_collection for ALL required product types at once. Max 5 calls total.
- Use browse_collection when a collection id is a strong match
- Use search_kmart for specific product types

Step 3 — once results are in, call present_outfits. Reference products by id only. Provide 2–3 named Easter sets. For each set, group items by category (Decorations, Tableware, Baskets, Activities, etc.) with 3–5 alternatives per slot. When selecting alternatives, apply the same functional and aesthetic reasoning from Step 1. Favour pastel palettes and seasonal items where appropriate. You MUST call present_outfits even if some searches returned no results. Do not use emojis in set names or descriptions.`,
  // filters[Category][]=Decorations, Table Decor, Candles & Toppers, Balloons,
  //   Party Plates & Bowls, Party Napkins, Party Cups, Party Serveware & Accessories,
  //   Kids Art, Craft & Stationery, Pretend Play & Dress Up
  categoryFilter:
    '&filters%5BCategory%5D%5B%5D=Decorations' +
    '&filters%5BCategory%5D%5B%5D=Table%20Decor' +
    '&filters%5BCategory%5D%5B%5D=Candles%20%26%20Toppers' +
    '&filters%5BCategory%5D%5B%5D=Balloons' +
    '&filters%5BCategory%5D%5B%5D=Party%20Plates%20%26%20Bowls' +
    '&filters%5BCategory%5D%5B%5D=Party%20Napkins' +
    '&filters%5BCategory%5D%5B%5D=Party%20Cups' +
    '&filters%5BCategory%5D%5B%5D=Party%20Serveware%20%26%20Accessories' +
    '&filters%5BCategory%5D%5B%5D=Kids%20Art%2C%20Craft%20%26%20Stationery' +
    '&filters%5BCategory%5D%5B%5D=Pretend%20Play%20%26%20Dress%20Up',
  collectionKeywords: [
    'easter', 'egg', 'bunny', 'rabbit', 'seasonal', 'basket', 'hunt', 'pastel',
    'spring', 'chick', 'decoration', 'tableware', 'craft', 'activity',
  ],
  itemGroupLabel: 'Easter Set',
  totalLabel: 'Complete Easter set',
  loadingCopy: {
    thinking: [
      'Planning your Easter…',
      'Getting into the Easter spirit…',
      'Thinking through the theme…',
    ],
    searching: [
      'Hunting for products…',
      'Searching the shelves…',
      'Finding the best picks…',
      'Scanning the range…',
    ],
    curating: [
      'Curating your Easter set…',
      'Putting it all together…',
      'Finishing touches…',
      'Almost ready…',
    ],
  },
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const CATEGORY_SLUGS = ['outfits', 'home', 'kitchen', 'parties', 'easter'] as const
export type CategorySlug = typeof CATEGORY_SLUGS[number]

const CATEGORIES: Record<CategorySlug, CategoryConfig> = {
  outfits: OUTFITS_CONFIG,
  home: HOME_CONFIG,
  kitchen: KITCHEN_CONFIG,
  parties: PARTIES_CONFIG,
  easter: EASTER_CONFIG,
}

export function getCategoryConfig(slug: string): CategoryConfig {
  return CATEGORIES[slug as CategorySlug] ?? CATEGORIES['outfits']
}
