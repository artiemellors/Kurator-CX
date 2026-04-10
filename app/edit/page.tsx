'use client'

import { Suspense, useState, useEffect, useRef, type ReactNode } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { loadLookSession, type CollectionPreview } from '@/lib/look-session'
import type { Outfit } from '@/app/components/OutfitResults'
import { KmartProductCard, type CollectionProduct } from '../components/ProductCollections'
import CuratedLooksTile from '../components/CuratedLooksTile'

function SkeletonProductCard() {
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

function EditPageContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const q        = searchParams.get('q') ?? ''
  const idx      = Math.max(0, parseInt(searchParams.get('idx') ?? '0', 10))
  const category = searchParams.get('category') ?? 'outfits'

  const [collections, setCollections]               = useState<CollectionPreview[]>([])
  const [outfitsByCollection, setOutfitsByCollection] = useState<Record<number, Outfit[]>>({})
  const [activeIdx, setActiveIdx]                   = useState(idx)
  const [currentPivots, setCurrentPivots]           = useState<string[]>([])
  const [refining, setRefining]                     = useState(false)
  const [refineCount, setRefineCount]               = useState(0)
  const [ready, setReady]                           = useState(false)
  const [products, setProducts]                     = useState<CollectionProduct[] | null>(null)
  const [loading, setLoading]                       = useState(false)
  const [error, setError]                           = useState<string | null>(null)
  const [headerQuery, setHeaderQuery]               = useState(q)

  const fetchedOutfitsRef    = useRef(new Set<number>())
  const refineControllerRef  = useRef<AbortController | null>(null)

  // Load collections from session storage (outfits are collection-specific, fetched separately)
  useEffect(() => {
    const session = loadLookSession(q)
    if (session?.collections && session.collections.length > 0) {
      setCollections(session.collections)
      const resolved = Math.min(idx, session.collections.length - 1)
      setActiveIdx(resolved)
      setCurrentPivots(session.collections[resolved]?.pivots ?? [])
    }
    setReady(true)
  }, [q, idx])

  // Fetch products for the active collection on load / tab switch
  useEffect(() => {
    if (!ready || collections.length === 0) return
    const col = collections[activeIdx]
    if (!col) return

    // Fast path — use cached product pool immediately
    if (col.productPool && col.productPool.length > 0) {
      setProducts(col.productPool)
      setLoading(false)
      return
    }

    // Slow path — LLM builds the product feed
    setProducts(null)
    setLoading(true)
    setError(null)

    const controller = new AbortController()
    fetch('/api/edit-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, collection: col, category }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(({ products: raw }: { products: CollectionProduct[] }) => {
        if (!controller.signal.aborted) {
          setProducts(raw ?? [])
          setLoading(false)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted && (err as Error).name !== 'AbortError') {
          setError(String(err))
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [ready, activeIdx, collections, q, category])

  // Fetch collection-specific outfit ideas once products are available
  useEffect(() => {
    if (!products || products.length === 0 || !activeCollection) return
    if (fetchedOutfitsRef.current.has(activeIdx)) return

    fetchedOutfitsRef.current.add(activeIdx)

    const controller = new AbortController()
    fetch('/api/collection-outfits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: q,
        collection: { name: activeCollection.name, description: activeCollection.description },
        products,
        category,
      }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(({ outfits: raw }: { outfits: Outfit[] }) => {
        if (!controller.signal.aborted) {
          setOutfitsByCollection(prev => ({ ...prev, [activeIdx]: raw ?? [] }))
        }
      })
      .catch(() => { /* outfit tile simply won't show */ })

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, activeIdx])

  function handleHeaderSearch(newQ: string) {
    if (!newQ.trim()) return
    router.push(`/search?q=${encodeURIComponent(newQ.trim())}`)
  }

  function handleTabSwitch(i: number) {
    setActiveIdx(i)
    setCurrentPivots(collections[i]?.pivots ?? [])
    setRefineCount(0)
  }

  function handlePivotClick(pivot: string) {
    if (!activeCollection || refining) return

    refineControllerRef.current?.abort()
    const controller = new AbortController()
    refineControllerRef.current = controller

    setRefining(true)
    setProducts(null)

    fetch('/api/edit-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, collection: { ...activeCollection, pivots: [pivot] }, category }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(({ products: raw, pivots: newPivots }: { products: CollectionProduct[]; pivots?: string[] }) => {
        if (controller.signal.aborted) return
        setProducts(raw ?? [])
        if (newPivots?.length) setCurrentPivots(newPivots)
        setRefineCount(c => c + 1)
        setRefining(false)
      })
      .catch(err => {
        if (!controller.signal.aborted && (err as Error).name !== 'AbortError') {
          setError(String(err))
          setRefining(false)
        }
      })
  }

  const activeCollection = collections[activeIdx]
  const activeOutfits    = outfitsByCollection[activeIdx] ?? []

  return (
    <div className="min-h-screen bg-[--bg]">
      {/* Header */}
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
                className="shrink-0 px-4 text-white bg-[#1768B0] border-none cursor-pointer
                           hover:brightness-90 transition-all"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-[13px]" />
              </button>
            </div>
          </form>
          <button
            onClick={() => router.back()}
            className="shrink-0 text-[13px] text-[rgba(26,26,26,0.5)] hover:text-[#1a1a1a]
                       transition-colors flex items-center gap-1.5"
          >
            <i className="fa-solid fa-arrow-left text-[11px]" />
            Back
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 pb-16">

        {/* Collection tabs — sibling collections */}
        {collections.length > 1 && (
          <div className="mb-6 border-b border-black/[0.08]">
            <div className="flex overflow-x-auto scrollbar-hide">
              {collections.map((col, i) => (
                <button
                  key={i}
                  onClick={() => handleTabSwitch(i)}
                  className="relative shrink-0 pb-3 pt-0.5 mr-6 last:mr-0"
                >
                  <span className={`block text-[11px] tracking-[1.32px] uppercase whitespace-nowrap
                                    transition-colors duration-150
                    ${i === activeIdx
                      ? 'font-bold text-[#1768b0]'
                      : 'font-normal text-black/30 hover:text-black/50'
                    }`}>
                    {col.name}
                  </span>
                  {i === activeIdx && (
                    <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#1768b0]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Editorial header */}
        {activeCollection && (
          <div className="mb-8" style={{ animation: 'fadeUp 0.4s ease both' }}>
            <h1 className="font-bold text-[28px] sm:text-[36px] leading-[1.2] text-black tracking-[-0.3px] mb-3">
              {activeCollection.name}
            </h1>
            <p className="text-[15px] text-[rgba(26,26,26,0.6)] leading-[1.6] max-w-xl">
              {activeCollection.description}
            </p>
            {/* Refinement chips — single-click, AI generates a fresh set after each */}
            {!refining && currentPivots.length > 0 && (
              <div
                key={`chips-${refineCount}`}
                className="border-t border-black/[0.06] pt-5 mt-5"
                style={{ animation: 'fadeUp 0.5s 0.1s ease both' }}
              >
                <div className="flex flex-wrap gap-2">
                  {currentPivots.map((pivot, i) => (
                    <button
                      key={i}
                      onClick={() => handlePivotClick(pivot)}
                      className="px-4 py-2 rounded-full border border-black/[0.12] bg-white
                                 text-[13px] text-[rgba(26,26,26,0.65)]
                                 hover:border-[#1768b0] hover:text-[#1768b0]
                                 transition-colors duration-150 whitespace-nowrap"
                    >
                      {pivot}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-white border border-red-200 rounded px-4 py-3 mb-6">
            {error}
          </p>
        )}

        {/* Not found — no session */}
        {ready && collections.length === 0 && (
          <div className="py-16 text-center text-[rgba(26,26,26,0.4)] text-sm">
            Collection not found —{' '}
            <button
              onClick={() => router.push(`/search?q=${encodeURIComponent(q)}`)}
              className="text-[#1768b0] underline"
            >
              return to search
            </button>
          </div>
        )}

        {/* Refining banner */}
        {refining && (
          <p className="text-[12px] text-[rgba(26,26,26,0.4)] mb-4 flex items-center gap-2">
            <i className="fa-solid fa-wand-magic-sparkles animate-pulse" />
            Refining…
          </p>
        )}

        {/* Product grid — outfit tile spliced in at position 12 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-6">
          {loading && Array.from({ length: 10 }).map((_, i) => (
            <SkeletonProductCard key={i} />
          ))}
          {!loading && products && products.length === 0 && (
            <div className="col-span-2 sm:col-span-4 xl:col-span-5 py-16 text-center
                            text-[rgba(26,26,26,0.4)] text-sm">
              No products found for this collection
            </div>
          )}
          {!loading && products && (() => {
            const TILE_AT = 12
            const tile = activeOutfits.length > 0 ? (
              <CuratedLooksTile
                key="outfit-tile"
                outfits={activeOutfits}
                category={category}
                onExplore={(oi) => router.push(`/look?q=${encodeURIComponent(q)}&idx=${oi}&category=${category}`)}
              />
            ) : null
            const items: ReactNode[] = []
            products.forEach((p, i) => {
              if (i === TILE_AT && tile) items.push(tile)
              items.push(
                <KmartProductCard key={`p-${i}`} p={p} animDelay={(i % 10) * 30} searchQuery={q} category={category} />
              )
            })
            if (products.length <= TILE_AT && tile) items.push(tile)
            return items
          })()}
        </div>

      </main>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <EditPageContent />
    </Suspense>
  )
}
