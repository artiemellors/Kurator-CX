export interface Product {
  name: string
  price: string
  colour?: string
  productUrl?: string
  imageUrl?: string
  altImageUrl?: string
}

export interface Collection {
  id: string
  display_name: string
}

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT']

function mapProducts(candidates: Record<string, unknown>[]): Product[] {
  // Drop nationally OOS products (stateOOS contains all 8 AU states).
  // Partially OOS (some states) still shows — product is available somewhere.
  // Constructor.io responses have no stateOOS field, so they pass through unchanged.
  const inStock = candidates.filter(item => {
    const oos = (item.data as Record<string, unknown> | undefined)?.stateOOS as Record<string, unknown> | undefined
    if (!oos) return true
    return AU_STATES.some(s => !(s in oos))
  })

  // Deduplicate by (name, colour) — collapses size variants into one per colour
  const seen = new Set<string>()
  const deduplicated = inStock.filter(item => {
    const data = item.data as Record<string, unknown> | undefined
    const name = String(item.value ?? item.name ?? '')
    const colour = data?.Colour != null ? String(data.Colour) : ''
    const key = `${name}::${colour}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return deduplicated.map((item, i) => {
    const data = item.data as Record<string, unknown> | undefined
    const rawUrl = data?.url != null ? String(data.url)
      : item.url != null ? String(item.url)
      : item.productUrl != null ? String(item.productUrl)
      : item.pdpUrl != null ? String(item.pdpUrl)
      : undefined
    const imageUrl = data?.image_url != null ? String(data.image_url)
      : item.primaryImage != null
        ? String((item.primaryImage as Record<string, unknown>).url ?? item.primaryImage)
        : Array.isArray(item.images) && (item.images as unknown[]).length > 0
          ? String(((item.images as Record<string, unknown>[])[0]).url ?? (item.images as unknown[])[0])
          : item.imageUrl != null ? String(item.imageUrl)
          : item.image != null ? String(item.image)
          : item.thumbnail != null ? String(item.thumbnail)
          : undefined
    const altImageUrl = (() => {
      const altImages = data?.altImages
      if (!Array.isArray(altImages) || altImages.length === 0) return undefined
      const partial = String(altImages[0])
      if (!partial || partial === 'undefined') return undefined
      return `https://assets.kmart.com.au/transform/${partial}?io=transform:fill,width:580,height:725`
    })()
    return {
      name: String(
        item.value ??
        item.name ?? item.displayName ?? item.title ?? item.productName ??
        `Product ${i + 1}`
      ),
      price: (() => {
        const raw = data?.price ??
          (item.price as Record<string, unknown>)?.current ??
          (item.price as Record<string, unknown>)?.min ??
          (item.price as Record<string, unknown>)?.value ??
          item.priceLabel ?? item.salePrice ?? item.regularPrice ?? item.price ?? 'Unknown'
        return typeof raw === 'number' ? `$${raw.toFixed(2)}` : String(raw)
      })(),
      colour: data?.Colour != null ? String(data.Colour) : undefined,
      productUrl: rawUrl != null
        ? rawUrl.startsWith('http') ? rawUrl : `https://www.kmart.com.au${rawUrl}`
        : undefined,
      imageUrl,
      altImageUrl,
    }
  })
}

// NOTE: fetchCollections and browseCollection always use the Constructor.io endpoint.
// The vaisc proxy is search-only — it has no collection-browse equivalent.
// Both endpoints share the same API key so they stay in sync.
export async function fetchCollections(keywords: string[]): Promise<Collection[]> {
  const url =
    `https://ac.cnstrc.com/browse/collections` +
    `?key=key_GZTqlLr41FS2p7AY&c=ciojs-client-2.71.1&num_results_per_page=200`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  const json = await res.json() as Record<string, unknown>
  const all = ((json?.response as Record<string, unknown>)?.collections ?? []) as Array<{ id: string; display_name: string }>

  return all
    .filter(c => {
      const text = `${c.id} ${c.display_name}`.toLowerCase()
      return keywords.some(kw => text.includes(kw))
    })
    .map(c => ({ id: c.id, display_name: c.display_name }))
}

export async function browseCollection(collectionId: string): Promise<Product[]> {
  const url =
    `https://ac.cnstrc.com/browse/collection_id/${encodeURIComponent(collectionId)}` +
    `?key=key_GZTqlLr41FS2p7AY&c=ciojs-client-2.71.1&num_results_per_page=24`
  console.log(`\n[Collection] Browsing "${collectionId}"`)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    console.log(`[Collection] HTTP ${res.status} — returning empty`)
    return []
  }
  const json = await res.json() as Record<string, unknown>
  const candidates = ((json?.response as Record<string, unknown>)?.results ?? []) as Record<string, unknown>[]
  const products = mapProducts(candidates)
  console.log(`[Collection] ${products.length} products in "${collectionId}"`)
  return products
}

export async function searchKmart(query: string, categoryFilter = ''): Promise<Product[]> {
  const useVaisc = process.env.KMART_SEARCH_API === 'vaisc'

  const url = useVaisc
    ? `https://vaisc-search-api-nnsmv6as2a-ts.a.run.app/api/v1/search/${encodeURIComponent(query)}` +
      `?num_results_per_page=60&page=1&sort_by=relevance&sort_order=descending` +
      `&_dt=${Date.now()}&key=key_GZTqlLr41FS2p7AY` +
      `&visitor_id=1522831643.1770289670&user_id=` +
      `&filters%5BSeller%5D=Kmart` +
      categoryFilter
    : `https://ac.cnstrc.com/search/${encodeURIComponent(query)}` +
      `?key=key_GZTqlLr41FS2p7AY&c=ciojs-client-2.71.1&num_results_per_page=24` +
      categoryFilter

  console.log(`\n[Search${useVaisc ? '/vaisc' : ''}] ${query}`)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = useVaisc ? await res.text().catch(() => '') : ''
    console.log(`[Search${useVaisc ? '/vaisc' : ''}] HTTP ${res.status} — returning empty${body ? `: ${body.slice(0, 200)}` : ''}`)
    return []
  }
  const json = await res.json() as Record<string, unknown>
  const candidates = ((json?.response as Record<string, unknown>)?.results ?? []) as Record<string, unknown>[]
  const products = mapProducts(candidates)
  console.log(`[Search${useVaisc ? '/vaisc' : ''}] ${products.length} products for "${query}"`)
  return products
}
