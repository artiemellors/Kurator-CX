'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import CuratedLooksTile from '../components/CuratedLooksTile'
import { type Outfit } from '../components/OutfitResults'
import { KmartProductCard, type CollectionProduct } from '../components/ProductCollections'
import { saveLookSession } from '@/lib/look-session'
import { detectCategory } from '@/lib/detect-category'

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

function SkeletonTile({ statusText }: { statusText?: string }) {
  return (
    <div className="col-span-2 bg-white rounded-[16px] border border-black/[0.08] p-5 sm:p-6 flex flex-col gap-5">
      <div className="skeleton h-6 w-36 rounded" />
      <div className="flex gap-6 border-b border-black/[0.08] pb-3">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-3 w-32 rounded" />
      </div>
      <div className="flex justify-center items-center py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}
               className={`shrink-0 skeleton rounded-full
                           w-[122px] h-[122px] sm:w-[150px] sm:h-[150px] xl:w-[210px] xl:h-[210px]
                           ${i > 0 ? '-ml-8 sm:-ml-10' : ''}`} />
        ))}
      </div>
      {/* Progress bar in place of the CTA — contextually tied to the tile loading */}
      <div>
        <p className="text-[12px] text-[rgba(26,26,26,0.4)] mb-2">
          {statusText ?? 'Curating your look…'}
        </p>
        <div className="relative h-px bg-black/[0.06] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 w-1/3 bg-[var(--accent)]"
            style={{ animation: 'progressSweep 1.8s ease-in-out infinite' }}
          />
        </div>
      </div>
    </div>
  )
}

function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const q = searchParams.get('q') ?? ''

  const [headerQuery, setHeaderQuery]         = useState(q)
  const [statuses, setStatuses]               = useState<string[]>([])
  const [outfits, setOutfits]                 = useState<Outfit[] | null>(null)
  const [refinements, setRefinements]         = useState<string[]>([])
  const [products, setProducts]               = useState<CollectionProduct[] | null>(null)
  const [productsLoading, setProductsLoading] = useState(false)
  const [bundleLoading, setBundleLoading]     = useState(false)
  const [error, setError]                     = useState<string | null>(null)
  const abortRef          = useRef<AbortController | null>(null)
  // Tracks whether the fast-path direct search returned 0 results.
  // When true, products from the SSE stream are used to fill the grid instead.
  const noDirectResultsRef = useRef(false)
  // Accumulates SSE products across multiple search_kmart calls, deduped by name+colour.
  const sseProductsRef     = useRef<CollectionProduct[]>([])

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

    noDirectResultsRef.current = false
    sseProductsRef.current     = []

    const category = detectCategory(searchQ)

    setProductsLoading(true)
    setBundleLoading(true)
    setOutfits(null)
    setRefinements([])
    setProducts(null)
    setStatuses([])
    setError(null)

    // Fast path — direct Kmart search, no AI
    fetch(`/api/products?q=${encodeURIComponent(searchQ)}&category=${category}`, {
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(({ products: raw }: { products: CollectionProduct[] }) => {
        if (controller.signal.aborted) return
        if (raw.length > 0) {
          setProducts(raw)
          setProductsLoading(false)
        } else {
          // No direct results — keep the skeleton going and wait for SSE products.
          // If the SSE stream already delivered some, use them immediately.
          noDirectResultsRef.current = true
          if (sseProductsRef.current.length > 0) {
            setProducts(sseProductsRef.current)
            setProductsLoading(false)
          }
          // Otherwise productsLoading stays true until SSE products arrive
          // (or the bundle search finishes with nothing).
        }
      })
      .catch(err => {
        if (controller.signal.aborted) return
        if ((err as Error).name !== 'AbortError') setError(String(err))
        setProductsLoading(false)
      })

    // Slow path — Claude decides what to search for and builds the outfit bundle
    fetchBundle(searchQ, category, controller.signal)
  }

  async function fetchBundle(searchQ: string, category: string, signal: AbortSignal) {
    // Track outfits and refinements locally so we can write them together to sessionStorage
    let latestOutfits: Outfit[] = []
    let latestRefinements: string[] = []

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQ, gender: null, category }),
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
          } else if (event.type === 'products') {
            // Products from the AI's search calls — used as grid fallback when
            // the direct Kmart search returns 0 (natural-language queries).
            if (noDirectResultsRef.current) {
              const incoming = event.result as CollectionProduct[]
              const seen = new Set(sseProductsRef.current.map(p => `${p.name}::${p.colour ?? ''}`))
              const fresh = incoming.filter(p => {
                const key = `${p.name}::${p.colour ?? ''}`
                if (seen.has(key)) return false
                seen.add(key)
                return true
              })
              sseProductsRef.current = [...sseProductsRef.current, ...fresh]
              setProducts(sseProductsRef.current)
              setProductsLoading(false)
            }
          } else if (event.type === 'done') {
            latestOutfits = event.result ?? []
            setOutfits(latestOutfits.length > 0 ? latestOutfits : null)
            if (latestOutfits.length > 0) {
              saveLookSession({ query: searchQ, outfits: latestOutfits, refinements: latestRefinements })
            }
            setBundleLoading(false)
            // If we still have no products (direct returned 0, SSE found nothing either),
            // resolve the loading state so the empty grid is shown.
            if (noDirectResultsRef.current) {
              setProducts(sseProductsRef.current)
              setProductsLoading(false)
            }
          } else if (event.type === 'refinements') {
            latestRefinements = event.result
            setRefinements(latestRefinements)
            if (latestOutfits.length > 0) {
              saveLookSession({ query: searchQ, outfits: latestOutfits, refinements: latestRefinements })
            }
          } else if (event.type === 'error') {
            console.error('[Bundle] SSE error event:', event.message)
            setBundleLoading(false)
            if (noDirectResultsRef.current) {
              setProducts(sseProductsRef.current)
              setProductsLoading(false)
            }
          }
        }
      }
    } catch (err) {
      if (!signal.aborted && (err as Error).name !== 'AbortError') setError(String(err))
    } finally {
      if (!signal.aborted) setBundleLoading(false)
    }
  }

  function handleHeaderSearch(newQ: string) {
    if (!newQ.trim()) return
    router.push(`/search?q=${encodeURIComponent(newQ.trim())}`)
  }

  function handleExplore(idx: number) {
    const category = detectCategory(q)
    router.push(`/look?q=${encodeURIComponent(q)}&idx=${idx}&category=${category}`)
  }

  // Only reserve a tile slot if the bundle is loading or succeeded
  const showTileSlot = bundleLoading || !!outfits
  const insertPos = Math.min(TILE_INSERT_POSITION, products?.length ?? 0)
  const gridItems: GridItem[] = (products && products.length > 0)
    ? [
        ...products.slice(0, showTileSlot ? insertPos : products.length).map(p => ({ type: 'product' as const, data: p })),
        ...(showTileSlot ? [{ type: 'tile' as const }] : []),
        ...(showTileSlot ? products.slice(insertPos).map(p => ({ type: 'product' as const, data: p })) : []),
      ]
    : []

  const showSkeletons = productsLoading
  const showGrid      = products !== null
  const showNoResults = !productsLoading && products !== null && products.length === 0

  // Suppress unused warning — refinements will be used in Slice 5
  void refinements

  return (
    <div className="min-h-screen bg-[--bg]">
      {/* Header with inline search */}
      <header
        className="sticky top-0 z-20 bg-white border-b border-black/[0.06]"
        style={{ animation: 'fadeDown 0.6s ease both' }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 h-20 flex items-center gap-4 sm:gap-6">
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

      <main className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 pb-16">

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-white border border-red-200 rounded px-4 py-3 mb-6">
            {error}
          </p>
        )}

        {/* Product grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-6 grid-flow-dense">
          {showSkeletons && (
            <>
              {Array.from({ length: insertPos || 4 }).map((_, i) => <SkeletonCard key={`pre-${i}`} />)}
              <SkeletonTile />
              {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={`post-${i}`} />)}
            </>
          )}
          {showNoResults && (
            <div className="col-span-2 sm:col-span-4 xl:col-span-5 py-16 text-center text-[rgba(26,26,26,0.4)] text-sm">
              No results found for &ldquo;{q}&rdquo; — try a different search
            </div>
          )}
          {showGrid && gridItems.map((item, i) => {
            if (item.type === 'tile') {
              if (outfits) return <CuratedLooksTile key="tile" outfits={outfits} onExplore={handleExplore} />
              if (bundleLoading) return <SkeletonTile key="tile" statusText={statuses[statuses.length - 1]} />
              return null
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
