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
  const [inputFocused, setInputFocused] = useState(false)
  const [typedText, setTypedText]     = useState('')
  const tabsRef     = useRef<HTMLDivElement>(null)
  const phraseIdxRef  = useRef(0)
  const charIdxRef    = useRef(0)
  const isDeletingRef = useRef(false)

  const REFINE_PHRASES = [
    'What would you change?',
    "What's more your look?",
    'What style do you like?',
    'Too casual? Too formal?',
    'Different colour palette?',
    'Add a layer?',
  ]

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function tick() {
      const phrase = REFINE_PHRASES[phraseIdxRef.current]
      const isDeleting = isDeletingRef.current

      if (!isDeleting) {
        charIdxRef.current++
        setTypedText(phrase.slice(0, charIdxRef.current))
        if (charIdxRef.current === phrase.length) {
          isDeletingRef.current = true
          timer = setTimeout(tick, 1800)
          return
        }
        timer = setTimeout(tick, 55)
      } else {
        charIdxRef.current--
        setTypedText(phrase.slice(0, charIdxRef.current))
        if (charIdxRef.current === 0) {
          isDeletingRef.current = false
          phraseIdxRef.current = (phraseIdxRef.current + 1) % REFINE_PHRASES.length
          timer = setTimeout(tick, 300)
          return
        }
        timer = setTimeout(tick, 30)
      }
    }

    timer = setTimeout(tick, 900)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const data = loadLookSession(q)
    if (!data) { router.replace(`/search?q=${encodeURIComponent(q)}`); return }
    setSession(data)
    setReady(true)
  }, [q, router])

  const activeOutfit = session?.outfits[idx] ?? session?.outfits[0]

  useEffect(() => {
    if (activeOutfit) setIndices(activeOutfit.items.map(() => 0))
  }, [idx, activeOutfit])

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

  const heroItem   = activeOutfit.items[0]
  const heroImage  = heroItem?.alternatives[indices[0] ?? 0]?.imageUrl
                  ?? heroItem?.alternatives[0]?.imageUrl
  const stripItems = activeOutfit.items.slice(1)

  return (
    <div className="min-h-screen bg-[--bg]">

      {/* ── Nav: sticky, logo right ────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-black/[0.06]"
              style={{ animation: 'fadeDown 0.4s ease both' }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 h-14 flex items-center">
          <a href="/">
            <Image src="/Logo.svg" alt="Kmart" width={80} height={26} priority />
          </a>
        </div>
      </header>

      {/* ── Full-width back bar — page-level action, all breakpoints ─ */}
      <div className="bg-white border-b border-black/[0.06]"
           style={{ animation: 'fadeDown 0.45s ease both' }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-[rgba(26,26,26,0.45)]
                       hover:text-[#1768B0] transition-colors"
          >
            <i className="fa-solid fa-chevron-left text-[11px]" />
            <span className="text-[12px]">Back to results</span>
          </button>
        </div>
      </div>

      {/* ── Main grid ────────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto">
        <div className="lg:grid lg:grid-cols-[1fr_440px] lg:gap-10 lg:px-8">

          {/* ══ LEFT: image gallery ══════════════════════════════════ */}
          {/*
            On desktop the gallery is sticky below the nav and fills the
            remaining viewport height — so the images are never cropped by
            dead space below. The strip moves to the LEFT of the hero.
          */}
          <div className="lg:sticky lg:top-14 lg:self-start
                          lg:h-[calc(100vh-3.5rem)]">

            {/* Desktop: strip LEFT + hero RIGHT, both fill panel height */}
            <div className="hidden lg:flex gap-2 h-full py-8"
                 key={`gallery-${idx}`}
                 style={{ animation: 'fadeUp 0.4s ease both' }}>

              {/* Thumbnail strip — LEFT, proportional 4:5 images */}
              {stripItems.length > 0 && (
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  {stripItems.map((item, i) => {
                    const altIdx = indices[i + 1] ?? 0
                    const img    = item.alternatives[altIdx]?.imageUrl
                                ?? item.alternatives[0]?.imageUrl
                    return (
                      <div key={i}
                           className="flex-1 min-h-0 rounded-lg overflow-hidden bg-[#F4F5F6]">
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

              {/* Hero — RIGHT, takes remaining width */}
              <div className="flex-[2] min-h-0 rounded-xl overflow-hidden bg-[#F4F5F6]">
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
            </div>

            {/* Mobile: full-bleed hero + horizontal thumbnail strip */}
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
              {stripItems.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pt-2 px-4 sm:px-8">
                  {stripItems.map((item, i) => {
                    const altIdx = indices[i + 1] ?? 0
                    const img    = item.alternatives[altIdx]?.imageUrl
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
          {/*
            flex-col + min-h ensures the column is at least as tall as the
            gallery so mt-auto on the refinement zone pins it to the bottom.
            sticky bottom-0 then keeps it anchored as the page scrolls.
          */}
          <div className="px-4 sm:px-8 lg:px-0 pt-6 lg:pt-8 pb-16">

            {/* Outfit tabs */}
            {session.outfits.length > 1 && (
              <div className="sticky top-14 z-10 bg-white
                              border-b border-black/[0.08] mb-6
                              -mx-4 sm:-mx-8 lg:mx-0 px-4 sm:px-8 lg:px-0">
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

            {/* Editorial header */}
            <div key={`info-${idx}`} className="mb-5"
                 style={{ animation: 'fadeUp 0.35s ease both' }}>
              <p className="text-[10px] tracking-[1.2px] uppercase
                            text-[rgba(26,26,26,0.35)] mb-2">
                Curated for &ldquo;{q}&rdquo;
              </p>
              {session.outfits.length <= 1 && (
                <h1 className="text-[24px] sm:text-[28px] font-bold text-[#1a1a1a]
                               leading-tight mb-3">
                  {activeOutfit.name}
                </h1>
              )}
              {activeOutfit.description && (
                <p className="text-[14px] text-[rgba(26,26,26,0.5)] leading-relaxed">
                  {activeOutfit.description}
                </p>
              )}
            </div>

            {/* Hairline separator */}
            <div className="border-t border-black/[0.06] mb-5" />

            {/* Product cards */}
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

            {/* ── Refinement chips (always in-flow) ─────────────────── */}
            {session.refinements.length > 0 && (
              <div className="border-t border-black/[0.06] pt-6 mt-6"
                   style={{ animation: 'fadeUp 0.5s 0.2s ease both' }}>
                <div className="flex flex-wrap gap-2">
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
              </div>
            )}

            {/* Spacer so content isn't hidden behind fixed bar on mobile */}
            <div className="h-24 lg:hidden" />

          </div>
        </div>
      </div>

      {/* ── Refinement input — fixed bottom on mobile, in-flow on desktop ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20
                      bg-white border-t border-black/[0.06]
                      px-4 pt-3 pb-8
                      lg:static lg:bottom-auto lg:left-auto lg:right-auto lg:z-auto
                      lg:bg-transparent lg:border-t-0
                      lg:max-w-[1600px] lg:mx-auto
                      lg:px-8 lg:pt-0 lg:pb-0"
           style={{ animation: 'fadeUp 0.5s 0.2s ease both' }}>
        {/* On desktop we want the input inside the right column — constrain width */}
        <div className="lg:max-w-[440px] lg:ml-auto lg:pr-0 lg:pb-8 lg:pt-6 lg:border-t lg:border-black/[0.06]">
          <form onSubmit={e => { e.preventDefault(); handleRefine(refineQuery) }}>
            <div className="flex items-center gap-3 bg-white rounded-full
                            border border-black/[0.12]
                            focus-within:border-[#1768b0]/50
                            focus-within:shadow-[0_0_0_3px_rgba(23,104,176,0.06)]
                            transition-all duration-200 px-5 py-3.5">
              <i className="fa-solid fa-wand-magic-sparkles text-[13px] text-black/25 shrink-0" />
              <input
                value={refineQuery}
                onChange={e => setRefineQuery(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={(!inputFocused && !refineQuery) ? typedText : 'What would you change?'}
                className="flex-1 min-w-0 bg-transparent outline-none text-[14px]
                           text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.38)]"
              />
              <button
                type="submit"
                disabled={!refineQuery.trim()}
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                           bg-[#1768b0] text-white
                           disabled:opacity-40
                           transition-opacity duration-200"
              >
                <i className="fa-solid fa-arrow-up text-[12px]" />
              </button>
            </div>
          </form>
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
