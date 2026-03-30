'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { loadLookSession, type LookSession } from '@/lib/look-session'
import { KmartProductCard, type CollectionProduct } from '@/app/components/ProductCollections'
import type { OutfitItem } from '@/app/components/OutfitResults'

/** Maps an OutfitItem alternative at a given index to the CollectionProduct shape */
function toCollectionProduct(item: OutfitItem, altIdx: number): CollectionProduct | null {
  const p = item.alternatives[altIdx]
  if (!p) return null
  return { name: p.name, price: p.price, colour: p.colour, productUrl: p.productUrl, imageUrl: p.imageUrl }
}

/**
 * One outfit slot: category label + product card + swap affordance.
 * altIdx state is local — resets automatically when the parent remounts
 * this component (via key={outfitIdx-slotIdx}) on outfit tab switch.
 */
function SlotCard({ item, animDelay }: { item: OutfitItem; animDelay: number }) {
  const [altIdx, setAltIdx] = useState(0)
  const hasAlts = item.alternatives.length > 1

  const product = toCollectionProduct(item, altIdx)
  if (!product) return null

  function cycleNext() {
    setAltIdx(i => (i + 1) % item.alternatives.length)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Category label */}
      <p className="text-[10px] font-semibold tracking-[1.2px] uppercase text-[rgba(26,26,26,0.35)]">
        {item.category}
      </p>

      {/* key={altIdx} replays the fadeUp animation on each swap */}
      <KmartProductCard
        key={altIdx}
        p={product}
        animDelay={altIdx === 0 ? animDelay : 0}
      />

      {/* Swap affordance — only shown when multiple alternatives exist */}
      {hasAlts && (
        <div className="flex items-center justify-between px-0.5 mt-0.5">
          {/* Dot indicators — tap to jump to a specific alternative */}
          <div className="flex items-center gap-1.5">
            {item.alternatives.map((_, i) => (
              <button
                key={i}
                onClick={() => setAltIdx(i)}
                aria-label={`Option ${i + 1} of ${item.alternatives.length}`}
                className={`w-[6px] h-[6px] rounded-full transition-all duration-200
                  ${i === altIdx
                    ? 'bg-[#1768b0]'
                    : 'bg-black/[0.15] hover:bg-black/[0.35]'
                  }`}
              />
            ))}
          </div>

          {/* Cycle button */}
          <button
            onClick={cycleNext}
            className="flex items-center gap-1 text-[11px] text-[rgba(26,26,26,0.38)]
                       hover:text-[#1768b0] transition-colors group"
          >
            <i className="fa-solid fa-rotate text-[10px] transition-transform duration-300
                          group-hover:rotate-180" />
            <span>Try others</span>
          </button>
        </div>
      )}
    </div>
  )
}

function LookPageContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const q   = searchParams.get('q') ?? ''
  const idx = Math.max(0, parseInt(searchParams.get('idx') ?? '0', 10))

  const [session, setSession]       = useState<LookSession | null>(null)
  const [ready, setReady]           = useState(false)
  const [refineQuery, setRefineQuery] = useState('')
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const data = loadLookSession(q)
    if (!data) {
      router.replace(`/search?q=${encodeURIComponent(q)}`)
      return
    }
    setSession(data)
    setReady(true)
  }, [q, router])

  // Scroll the active tab into view whenever idx changes
  useEffect(() => {
    const container = tabsRef.current
    if (!container) return
    const tab = container.children[idx] as HTMLElement | undefined
    tab?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [idx])

  if (!ready || !session) return null

  const activeOutfit = session.outfits[idx] ?? session.outfits[0]

  function switchOutfit(i: number) {
    router.replace(`/look?q=${encodeURIComponent(q)}&idx=${i}`)
  }

  function handleRefine(refinedQ: string) {
    const trimmed = refinedQ.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="min-h-screen bg-[--bg]">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-black/[0.06]"
              style={{ animation: 'fadeDown 0.4s ease both' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-8 h-16 flex items-center">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[rgba(26,26,26,0.6)] hover:text-[#1768B0]
                       transition-colors shrink-0 pr-4"
            aria-label="Back to search results"
          >
            <i className="fa-solid fa-chevron-left text-[12px]" />
            <span className="text-[13px]">Results</span>
          </button>

          {/* Logo — centered */}
          <div className="flex-1 flex justify-center">
            <a href="/">
              <Image src="/Logo.svg" alt="Kmart" width={88} height={28} priority />
            </a>
          </div>

          {/* Spacer matching back button width */}
          <div className="w-[72px] shrink-0" />
        </div>
      </header>

      {/* ── Outfit tab bar — sticky below header ───────────────────── */}
      {session.outfits.length > 1 && (
        <div className="sticky top-16 z-20 bg-white border-b border-black/[0.08]"
             style={{ animation: 'fadeDown 0.5s ease both' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-8">
            <div ref={tabsRef} className="flex overflow-x-auto scrollbar-hide">
              {session.outfits.map((outfit, i) => (
                <button
                  key={i}
                  onClick={() => switchOutfit(i)}
                  className="relative shrink-0 pb-3 pt-3 mr-6 last:mr-0"
                >
                  <span className={`block text-[11px] tracking-[1.32px] uppercase whitespace-nowrap
                                   transition-colors duration-150
                    ${i === idx
                      ? 'font-bold text-[#1768b0]'
                      : 'font-normal text-black/30 hover:text-black/50'
                    }`}>
                    {outfit.name}
                  </span>
                  {i === idx && (
                    <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#1768b0]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-8 pb-24">

        {/* ── Look hero ──────────────────────────────────────────────── */}
        {/*  key={idx} re-mounts on tab switch so the animation replays  */}
        <div key={idx} className="pt-8 pb-8 border-b border-black/[0.06]"
             style={{ animation: 'fadeUp 0.35s ease both' }}>

          {/* Context — the original search query */}
          <p className="text-[11px] tracking-[1.2px] uppercase text-[rgba(26,26,26,0.35)] mb-3">
            Curated for &ldquo;{q}&rdquo;
          </p>

          <h1 className="text-[28px] sm:text-[32px] font-bold text-[#1a1a1a] leading-tight mb-3">
            {activeOutfit.name}
          </h1>

          {activeOutfit.description && (
            <p className="text-[15px] text-[rgba(26,26,26,0.5)] leading-relaxed max-w-xl">
              {activeOutfit.description}
            </p>
          )}
        </div>

        {/* ── Product grid ───────────────────────────────────────── */}
        <section key={`grid-${idx}`} className="pt-8 pb-8 border-b border-black/[0.06]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-6">
            {activeOutfit.items.map((item, i) => (
              <SlotCard key={`${idx}-${i}`} item={item} animDelay={i * 60} />
            ))}
          </div>
        </section>

        {/* ── Refinement zone ─────────────────────────────────────── */}
        <section className="pt-8" style={{ animation: 'fadeUp 0.5s 0.2s ease both' }}>

          {/* Section label */}
          <p className="text-[10px] font-semibold tracking-[1.2px] uppercase
                        text-[rgba(26,26,26,0.35)] mb-4">
            Refine this look
          </p>

          {/* Chips — only shown when refinements are available */}
          {session.refinements.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {session.refinements.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleRefine(chip)}
                  className="px-4 py-2 rounded-full border border-black/[0.12] bg-white
                             text-[13px] text-[rgba(26,26,26,0.65)]
                             hover:border-[#1768b0] hover:text-[#1768b0]
                             transition-colors duration-150 whitespace-nowrap"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Freeform stylist input */}
          <form
            onSubmit={e => { e.preventDefault(); handleRefine(refineQuery) }}
            className="rounded-[14px] bg-[#EAF1FA] p-4 sm:p-5 flex flex-col gap-3"
          >
            <p className="text-[12px] font-semibold tracking-[0.6px] uppercase text-[#1768b0]/70">
              Ask the stylist
            </p>
            <div className="flex items-center gap-2 bg-white rounded-[10px] border border-[#1768b0]/20
                            focus-within:border-[#1768b0] focus-within:shadow-[0_0_0_2px_rgba(23,104,176,0.1)]
                            transition-all duration-200 px-4 py-3">
              <i className="fa-solid fa-wand-magic-sparkles text-[13px] text-[#1768b0]/50 shrink-0" />
              <input
                value={refineQuery}
                onChange={e => setRefineQuery(e.target.value)}
                placeholder="What would you change?"
                className="flex-1 min-w-0 bg-transparent outline-none text-[14px]
                           text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.35)]"
              />
              {refineQuery.trim() && (
                <button
                  type="submit"
                  className="shrink-0 text-[13px] font-semibold text-[#1768b0]
                             hover:text-[#1768b0]/70 transition-colors"
                >
                  Go
                </button>
              )}
            </div>
          </form>

        </section>

      </main>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <LookPageContent />
    </Suspense>
  )
}
