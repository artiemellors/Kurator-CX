'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { loadLookSession, type LookSession } from '@/lib/look-session'
import { ItemCard } from '@/app/components/OutfitResults'

function LookPageContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const q   = searchParams.get('q') ?? ''
  const idx = Math.max(0, parseInt(searchParams.get('idx') ?? '0', 10))

  const [session, setSession]         = useState<LookSession | null>(null)
  const [ready, setReady]             = useState(false)
  const [indices, setIndices]         = useState<number[]>([])
  const [refineQuery, setRefineQuery] = useState('')
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const data = loadLookSession(q)
    if (!data) { router.replace(`/search?q=${encodeURIComponent(q)}`); return }
    setSession(data)
    setReady(true)
  }, [q, router])

  const activeOutfit = session?.outfits[idx] ?? session?.outfits[0]

  // Reset per-item alt indices when outfit tab changes
  useEffect(() => {
    if (activeOutfit) setIndices(activeOutfit.items.map(() => 0))
  }, [idx, activeOutfit])

  // Scroll the active tab into view
  useEffect(() => {
    const container = tabsRef.current
    if (!container) return
    const tab = container.children[idx] as HTMLElement | undefined
    tab?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [idx])

  if (!ready || !session || !activeOutfit) return null

  function switchOutfit(i: number) {
    router.replace(`/look?q=${encodeURIComponent(q)}&idx=${i}`)
  }

  function setItemIdx(itemIdx: number, altIdx: number) {
    setIndices(prev => prev.map((v, i) => i === itemIdx ? altIdx : v))
  }

  function handleRefine(refinedQ: string) {
    const trimmed = refinedQ.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  // Gallery: first item = hero, rest = strip
  const heroItem  = activeOutfit.items[0]
  const heroImage = heroItem?.alternatives[indices[0] ?? 0]?.imageUrl
                 ?? heroItem?.alternatives[0]?.imageUrl
  const stripItems = activeOutfit.items.slice(1)

  return (
    <div className="min-h-screen bg-[--bg]">

      {/* ── Nav: logo right ──────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-black/[0.06]"
              style={{ animation: 'fadeDown 0.4s ease both' }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 h-14 flex items-center justify-end">
          <a href="/">
            <Image src="/Logo.svg" alt="Kmart" width={80} height={26} priority />
          </a>
        </div>
      </header>

      {/* ── Main: PDP 2-col on desktop, stacked on mobile ────────── */}
      <div className="max-w-[1600px] mx-auto">
        <div className="lg:grid lg:grid-cols-[1fr_440px] lg:gap-10 lg:px-8">

          {/* ══ LEFT: image gallery ══════════════════════════════════ */}
          <div className="lg:sticky lg:top-14 lg:self-start lg:py-8">

            {/* ── Desktop: hero + right vertical strip ── */}
            <div className="hidden lg:flex gap-2"
                 key={`gallery-${idx}`}
                 style={{ animation: 'fadeUp 0.4s ease both' }}>
              {/* Hero */}
              <div className="flex-[3] aspect-[4/5] rounded-xl overflow-hidden bg-[#F4F5F6]">
                {heroImage && (
                  <img
                    key={`hero-${indices[0]}`}
                    src={heroImage}
                    alt={heroItem?.alternatives[0]?.name}
                    className="w-full h-full object-cover"
                    style={{ animation: 'imgFadeIn 220ms ease-out' }}
                  />
                )}
              </div>

              {/* Vertical strip — same height as hero via flex stretch */}
              {stripItems.length > 0 && (
                <div className="flex-1 flex flex-col gap-2">
                  {stripItems.map((item, i) => {
                    const altIdx = indices[i + 1] ?? 0
                    const img = item.alternatives[altIdx]?.imageUrl
                               ?? item.alternatives[0]?.imageUrl
                    return (
                      <div key={i} className="flex-1 rounded-lg overflow-hidden bg-[#F4F5F6] min-h-0">
                        {img && (
                          <img
                            key={`strip-${i}-${altIdx}`}
                            src={img}
                            alt={item.alternatives[0]?.name}
                            className="w-full h-full object-cover"
                            style={{ animation: 'imgFadeIn 220ms ease-out' }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Mobile: full-bleed hero ── */}
            <div className="lg:hidden" key={`mobile-hero-${idx}`}
                 style={{ animation: 'fadeUp 0.4s ease both' }}>
              <div className="aspect-[4/5] bg-[#F4F5F6]">
                {heroImage && (
                  <img
                    key={`m-hero-${indices[0]}`}
                    src={heroImage}
                    alt={heroItem?.alternatives[0]?.name}
                    className="w-full h-full object-cover"
                    style={{ animation: 'imgFadeIn 220ms ease-out' }}
                  />
                )}
              </div>

              {/* Horizontal thumbnail strip */}
              {stripItems.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pt-2 px-4 sm:px-8">
                  {stripItems.map((item, i) => {
                    const altIdx = indices[i + 1] ?? 0
                    const img = item.alternatives[altIdx]?.imageUrl
                               ?? item.alternatives[0]?.imageUrl
                    return (
                      <div key={i}
                           className="w-[28vw] min-w-[88px] max-w-[130px] aspect-[4/5]
                                      shrink-0 rounded-lg overflow-hidden bg-[#F4F5F6]">
                        {img && (
                          <img
                            key={`m-strip-${i}-${altIdx}`}
                            src={img}
                            alt={item.alternatives[0]?.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ══ RIGHT: content ═══════════════════════════════════════ */}
          <div className="px-4 sm:px-8 lg:px-0 pt-5 lg:pt-8 pb-24">

            {/* Back */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-[rgba(26,26,26,0.45)]
                         hover:text-[#1768B0] transition-colors mb-5"
            >
              <i className="fa-solid fa-chevron-left text-[11px]" />
              <span className="text-[12px]">Back to results</span>
            </button>

            {/* Outfit tabs */}
            {session.outfits.length > 1 && (
              <div className="border-b border-black/[0.08] mb-6 -mx-4 sm:-mx-8 lg:mx-0
                              px-4 sm:px-8 lg:px-0">
                <div ref={tabsRef} className="flex overflow-x-auto scrollbar-hide">
                  {session.outfits.map((outfit, i) => (
                    <button key={i} onClick={() => switchOutfit(i)}
                            className="relative shrink-0 pb-3 pt-1 mr-6 last:mr-0">
                      <span className={`block text-[11px] tracking-[1.32px] uppercase
                                       whitespace-nowrap transition-colors duration-150
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
            )}

            {/* Look info */}
            <div key={`info-${idx}`} style={{ animation: 'fadeUp 0.35s ease both' }}>
              <p className="text-[10px] tracking-[1.2px] uppercase
                            text-[rgba(26,26,26,0.35)] mb-2">
                Curated for &ldquo;{q}&rdquo;
              </p>
              <h1 className="text-[24px] sm:text-[28px] font-bold text-[#1a1a1a]
                             leading-tight mb-3">
                {activeOutfit.name}
              </h1>
              {activeOutfit.description && (
                <p className="text-[14px] text-[rgba(26,26,26,0.5)] leading-relaxed mb-7">
                  {activeOutfit.description}
                </p>
              )}
            </div>

            {/* Product cards — ItemCard from OutfitResults */}
            <div key={`items-${idx}`} className="flex flex-col gap-4">
              {activeOutfit.items.map((item, i) => (
                <ItemCard
                  key={`${idx}-${i}`}
                  item={item}
                  idx={indices[i] ?? 0}
                  onIdxChange={newIdx => setItemIdx(i, newIdx)}
                  animDelay={i * 60}
                />
              ))}
            </div>

            {/* ── Refinement zone ───────────────────────────────────── */}
            <section className="pt-8 pb-4" style={{ animation: 'fadeUp 0.5s 0.2s ease both' }}>
              {session.refinements.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {session.refinements.map((chip, i) => (
                    <button key={i} onClick={() => handleRefine(chip)}
                            className="px-4 py-2 rounded-full border border-black/[0.12] bg-white
                                       text-[13px] text-[rgba(26,26,26,0.65)]
                                       hover:border-[#1768b0] hover:text-[#1768b0]
                                       transition-colors duration-150 whitespace-nowrap">
                      {chip}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={e => { e.preventDefault(); handleRefine(refineQuery) }}>
                <div className="flex items-center gap-3 bg-[#EAF1FA] rounded-full
                                border border-[#1768b0]/15
                                focus-within:border-[#1768b0]/40
                                focus-within:shadow-[0_0_0_3px_rgba(23,104,176,0.08)]
                                transition-all duration-200 px-5 py-3.5">
                  <i className="fa-solid fa-wand-magic-sparkles text-[13px] text-[#1768b0]/50 shrink-0" />
                  <input
                    value={refineQuery}
                    onChange={e => setRefineQuery(e.target.value)}
                    placeholder="What would you change?"
                    className="flex-1 min-w-0 bg-transparent outline-none text-[14px]
                               text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.38)]"
                  />
                  <button
                    type="submit"
                    disabled={!refineQuery.trim()}
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                               bg-[#1768b0] text-white
                               disabled:bg-[#1768b0]/20 disabled:text-[#1768b0]/40
                               transition-all duration-200"
                  >
                    <i className="fa-solid fa-arrow-up text-[12px]" />
                  </button>
                </div>
              </form>
            </section>

          </div>
        </div>
      </div>
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
