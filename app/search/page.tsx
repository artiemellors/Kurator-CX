'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import CuratedLooksTile from '../components/CuratedLooksTile'
import OutfitResults, { type Outfit } from '../components/OutfitResults'
import { KmartProductCard, type CollectionProduct } from '../components/ProductCollections'

// Where the CuratedLooksTile is inserted in the product grid (0-indexed)
const TILE_INSERT_POSITION = 4

type GridItem =
  | { type: 'product'; data: CollectionProduct }
  | { type: 'tile' }

function SkeletonCard() {
  return (
    <div className="flex flex-col">
      <div className="skeleton aspect-[4/5] w-full rounded-[8px] bg-[#F4F5F6]" />
      <div className="pt-2 space-y-1.5">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-4 w-1/3 rounded mt-1" />
      </div>
    </div>
  )
}

function SkeletonTile() {
  return (
    <div className="col-span-2 bg-white rounded-[16px] border border-black/[0.08] p-5 sm:p-6 flex flex-col gap-5">
      <div className="skeleton h-6 w-36 rounded" />
      <div className="flex gap-6 border-b border-black/[0.08] pb-3">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-3 w-32 rounded" />
      </div>
      <div className="flex gap-2 sm:gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[68px] h-[68px] sm:w-20 sm:h-20 skeleton rounded-full" />
        ))}
      </div>
      <div className="skeleton h-3 w-32 rounded mx-auto" />
    </div>
  )
}

function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const q = searchParams.get('q') ?? ''

  const [headerQuery, setHeaderQuery]   = useState(q)
  const [statuses, setStatuses]         = useState<string[]>([])
  const [outfits, setOutfits]           = useState<Outfit[] | null>(null)
  const [products, setProducts]         = useState<CollectionProduct[] | null>(null)
  const [productsLoading, setProductsLoading] = useState(false)
  const [bundleLoading, setBundleLoading]     = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [showOutfits, setShowOutfits]   = useState(false)
  const outfitsRef = useRef<HTMLDivElement>(null)
  const abortRef   = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!q) return
    setHeaderQuery(q)
    runSearch(q)
    return () => abortRef.current?.abort()
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  function runSearch(searchQ: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setProductsLoading(true)
    setBundleLoading(true)
    setOutfits(null)
    setProducts(null)
    setStatuses([])
    setError(null)
    setShowOutfits(false)

    // Fast path — direct Kmart search, no AI
    fetch(`/api/products?q=${encodeURIComponent(searchQ)}&category=outfits`, {
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(({ products: raw }: { products: CollectionProduct[] }) => {
        setProducts(raw)
        setProductsLoading(false)
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') setError(String(err))
        setProductsLoading(false)
      })

    // Slow path — Claude decides what to search for and builds the outfit bundle
    fetchBundle(searchQ, controller.signal)
  }

  async function fetchBundle(searchQ: string, signal: AbortSignal) {
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQ, gender: null, category: 'outfits' }),
        signal,
      })

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const event = JSON.parse(line.slice(6))
          if (event.type === 'status') {
            setStatuses(prev => [...prev, event.message])
          } else if (event.type === 'done') {
            setOutfits(event.result)
            setBundleLoading(false)
          } else if (event.type === 'error') {
            setBundleLoading(false)
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(String(err))
    } finally {
      setBundleLoading(false)
    }
  }

  function handleHeaderSearch(newQ: string) {
    if (!newQ.trim()) return
    router.push(`/search?q=${encodeURIComponent(newQ.trim())}`)
  }

  function handleExplore() {
    setShowOutfits(true)
    setTimeout(() => outfitsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  // Build grid: products with tile slot always reserved at TILE_INSERT_POSITION
  const insertPos = Math.min(TILE_INSERT_POSITION, products?.length ?? 0)
  const gridItems: GridItem[] = products
    ? [
        ...products.slice(0, insertPos).map(p => ({ type: 'product' as const, data: p })),
        { type: 'tile' as const },
        ...products.slice(insertPos).map(p => ({ type: 'product' as const, data: p })),
      ]
    : []

  const showSkeletons = productsLoading
  const showGrid      = products !== null

  return (
    <div className="min-h-screen bg-[--bg]">
      {/* Header with inline search */}
      <header
        className="sticky top-0 z-20 bg-white border-b border-black/[0.06]"
        style={{ animation: 'fadeDown 0.6s ease both' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-8 h-20 flex items-center gap-4 sm:gap-6">
          <a href="/" className="flex items-center shrink-0">
            <Image src="/Logo.svg" alt="Kmart" width={100} height={32} priority />
          </a>
          <form
            onSubmit={e => { e.preventDefault(); handleHeaderSearch(headerQuery) }}
            className="flex-1 flex max-w-xl"
          >
            <div className="flex w-full bg-white border overflow-hidden transition-all duration-200
                            focus-within:shadow-[0_0_0_2px_rgba(23,104,176,0.1)]
                            border-black/[0.15] rounded-[8px] focus-within:border-[#1768B0]">
              <input
                value={headerQuery}
                onChange={e => setHeaderQuery(e.target.value)}
                className="flex-1 min-w-0 bg-transparent outline-none px-4 py-3 text-[#1a1a1a]
                           text-[14px] placeholder:text-[rgba(26,26,26,0.35)]"
                placeholder="Search…"
              />
              <button
                type="submit"
                disabled={productsLoading}
                className="shrink-0 px-4 text-white bg-[#1768B0] border-none cursor-pointer
                           hover:brightness-90 transition-all disabled:opacity-50"
              >
                <i className={`fa-solid fa-wand-magic-sparkles text-[13px]${productsLoading ? ' animate-search-rock' : ''}`} />
              </button>
            </div>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 pb-16">

        {/* Bundle loading progress — shown after products appear while Claude builds the tile */}
        {bundleLoading && !productsLoading && (
          <div className="mb-6" style={{ animation: 'fadeUp 0.3s ease both' }}>
            <p className="text-sm text-[rgba(26,26,26,0.5)]">
              {statuses[statuses.length - 1] ?? 'Curating your look…'}
            </p>
            <div className="relative h-px bg-black/[0.06] overflow-hidden mt-2">
              <div
                className="absolute inset-y-0 left-0 w-1/3 bg-[var(--accent)]"
                style={{ animation: 'progressSweep 1.8s ease-in-out infinite' }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-white border border-red-200 rounded px-4 py-3 mb-6">
            {error}
          </p>
        )}

        {/* Product grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-6">
          {showSkeletons && (
            <>
              {Array.from({ length: insertPos || 4 }).map((_, i) => <SkeletonCard key={`pre-${i}`} />)}
              <SkeletonTile />
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={`post-${i}`} />)}
            </>
          )}
          {showGrid && gridItems.map((item, i) => {
            if (item.type === 'tile') {
              return outfits
                ? <CuratedLooksTile key="tile" outfits={outfits} onExplore={handleExplore} />
                : <SkeletonTile key="tile" />
            }
            return (
              <KmartProductCard
                key={`p-${i}`}
                p={item.data}
                animDelay={(i % 8) * 35}
              />
            )
          })}
        </div>

        {/* Full outfit results — revealed by EXPLORE THE LOOK */}
        {showOutfits && outfits && (
          <div ref={outfitsRef} className="mt-16 pt-8 border-t border-black/[0.08]">
            <OutfitResults outfits={outfits} />
          </div>
        )}
      </main>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  )
}
