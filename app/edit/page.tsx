'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { loadLookSession, type CollectionPreview } from '@/lib/look-session'
import type { Outfit } from '@/app/components/OutfitResults'
import { KmartProductCard, type CollectionProduct } from '../components/ProductCollections'

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

function OutfitCallout({ outfit, onViewLook }: { outfit: Outfit; onViewLook: () => void }) {
  const items = outfit.items.slice(0, 6)

  return (
    <div className="mb-10 -mx-4 sm:mx-0 bg-[#F4F5F6] sm:rounded-[16px] px-3 py-3">
      <div className="bg-white rounded-[12px] border-[1.5px] border-black/[0.06] overflow-hidden">
        {/* Header row */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-black/[0.05]">
          <div>
            <p className="text-[10px] tracking-[1.2px] uppercase font-semibold text-[rgba(26,26,26,0.4)] mb-0.5">
              Styled Look
            </p>
            <p className="text-[14px] font-semibold text-[#1a1a1a] leading-snug">
              {outfit.name}
            </p>
          </div>
          <button
            onClick={onViewLook}
            className="shrink-0 flex items-center gap-1.5 text-[12px] font-semibold
                       text-[#1768b0] hover:text-[#1254a0] transition-colors"
          >
            View the look
            <i className="fa-solid fa-arrow-right text-[10px]" />
          </button>
        </div>

        {/* Horizontal product strip */}
        <div className="flex overflow-x-auto scrollbar-hide gap-2 px-3 py-3">
          {items.map((item, i) => {
            const product = item.alternatives[0]
            if (!product?.imageUrl) return null
            return (
              <a
                key={i}
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 w-[120px] sm:w-[140px] group"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[8px] bg-[#f9f9f9]
                                border border-black/[0.06] mb-1.5">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <p className="text-[10px] text-[rgba(26,26,26,0.4)] uppercase tracking-[0.8px] mb-0.5 truncate">
                  {item.category}
                </p>
                <p className="text-[12px] font-semibold text-[#1a1a1a]">{product.price}</p>
              </a>
            )
          })}
        </div>

        {/* Description */}
        {outfit.description && (
          <p className="px-4 pb-4 text-[12px] text-[rgba(26,26,26,0.5)] leading-[1.6] italic">
            &ldquo;{outfit.description}&rdquo;
          </p>
        )}
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

  const [collections, setCollections] = useState<CollectionPreview[]>([])
  const [outfits, setOutfits]         = useState<Outfit[]>([])
  const [activeIdx, setActiveIdx]     = useState(idx)
  // null = use collection's own pivots; string[] = user-overridden subset
  const [overridePivots, setOverridePivots] = useState<string[] | null>(null)
  const [ready, setReady]             = useState(false)
  const [products, setProducts]       = useState<CollectionProduct[] | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [headerQuery, setHeaderQuery] = useState(q)

  // Load collections + outfits from session storage
  useEffect(() => {
    const session = loadLookSession(q)
    if (session?.collections && session.collections.length > 0) {
      setCollections(session.collections)
      setActiveIdx(Math.min(idx, session.collections.length - 1))
    }
    if (session?.outfits && session.outfits.length > 0) {
      setOutfits(session.outfits)
    }
    setReady(true)
  }, [q, idx])

  // Fetch products for the active collection (re-runs when pivots change)
  useEffect(() => {
    if (!ready || collections.length === 0) return
    const col = collections[activeIdx]
    if (!col) return

    // If the session already has a product pool from the preview fetch and the
    // user hasn't overridden pivots, show it immediately — no LLM call needed.
    if (!overridePivots && col.productPool && col.productPool.length > 0) {
      setProducts(col.productPool)
      setLoading(false)
      return
    }

    // Effective pivots: user override or collection defaults
    const effectivePivots = overridePivots ?? col.pivots
    const collectionWithPivots = { ...col, pivots: effectivePivots }

    setProducts(null)
    setLoading(true)
    setError(null)

    const controller = new AbortController()
    fetch('/api/edit-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, collection: collectionWithPivots, category }),
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
  }, [ready, activeIdx, overridePivots, collections, q, category])

  function handleHeaderSearch(newQ: string) {
    if (!newQ.trim()) return
    router.push(`/search?q=${encodeURIComponent(newQ.trim())}`)
  }

  function handleTabSwitch(i: number) {
    // Batch both updates — single render, single fetch
    setActiveIdx(i)
    setOverridePivots(null)
  }

  function handlePivotToggle(pivot: string) {
    const col = collections[activeIdx]
    if (!col) return
    // Base list to toggle against: override if set, otherwise all collection pivots
    const current = overridePivots ?? col.pivots
    const next = current.includes(pivot)
      ? current.filter(p => p !== pivot)
      : [...current, pivot]
    // If back to full set → clear override (treated as default)
    const isDefault = col.pivots.every(p => next.includes(p)) && next.length === col.pivots.length
    setOverridePivots(isDefault ? null : next)
  }

  const activeCollection = collections[activeIdx]
  // Derive which pivots are currently "on" for rendering chip state
  const activePivotSet = new Set(overridePivots ?? activeCollection?.pivots ?? [])

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
            <p className="text-[15px] text-[rgba(26,26,26,0.6)] leading-[1.6] max-w-xl mb-5">
              {activeCollection.description}
            </p>
            {/* Pivot chips — click to refine */}
            {activeCollection.pivots.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeCollection.pivots.map((pivot, i) => {
                  const isActive = activePivotSet.has(pivot)
                  return (
                    <button
                      key={i}
                      onClick={() => handlePivotToggle(pivot)}
                      className={`px-3 py-1.5 rounded-full border text-[12px] font-medium
                                  transition-all duration-150 active:scale-95
                        ${isActive
                          ? 'border-[#1768b0] text-[#1768b0] bg-[rgba(23,104,176,0.06)]'
                          : 'border-black/[0.12] text-[rgba(26,26,26,0.4)] bg-white hover:border-black/30 hover:text-[rgba(26,26,26,0.6)]'
                        }`}
                    >
                      {isActive && (
                        <i className="fa-solid fa-check text-[9px] mr-1.5 align-middle" />
                      )}
                      {pivot}
                    </button>
                  )
                })}
                {/* Reset link — only shown when overriding */}
                {overridePivots !== null && (
                  <button
                    onClick={() => setOverridePivots(null)}
                    className="px-3 py-1.5 rounded-full text-[11px] text-[rgba(26,26,26,0.35)]
                               hover:text-[rgba(26,26,26,0.6)] transition-colors underline underline-offset-2"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Outfit callout */}
        {outfits.length > 0 && (
          <OutfitCallout
            outfit={outfits[0]}
            onViewLook={() => router.push(`/look?q=${encodeURIComponent(q)}&idx=0&category=${category}`)}
          />
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

        {/* Product grid */}
        {loading && overridePivots !== null && (
          <p className="text-[12px] text-[rgba(26,26,26,0.4)] mb-4 flex items-center gap-2">
            <i className="fa-solid fa-wand-magic-sparkles animate-pulse" />
            Refining…
          </p>
        )}
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
          {!loading && products && products.map((p, i) => (
            <KmartProductCard key={`p-${i}`} p={p} animDelay={(i % 10) * 30} />
          ))}
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
