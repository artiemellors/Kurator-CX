'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { loadLookSession, saveLookSession, type LookSession } from '@/lib/look-session'
import { ItemCard, type Outfit } from '@/app/components/OutfitResults'
import { ProductCollections, type ProductCollection } from '@/app/components/ProductCollections'

function LookPageContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const q   = searchParams.get('q') ?? ''
  const idx = Math.max(0, parseInt(searchParams.get('idx') ?? '0', 10))

  const [session, setSession]           = useState<LookSession | null>(null)
  const [ready, setReady]               = useState(false)
  const [indices, setIndices]           = useState<number[]>([])
  const [refineQuery, setRefineQuery]   = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [typedText, setTypedText]       = useState('')
  const [collections, setCollections]   = useState<ProductCollection[] | null>(null)
  const [refining, setRefining]         = useState(false)
  const [refineStatus, setRefineStatus] = useState<string | null>(null)
  const [refineError, setRefineError]   = useState<string | null>(null)
  const [refineCount, setRefineCount]   = useState(0)
  const [heroSlot, setHeroSlot]         = useState(0)
  const tabsRef        = useRef<HTMLDivElement>(null)
  const refineAbortRef = useRef<AbortController | null>(null)
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

  // Fetch collections once the session is ready — pass outfit products as seed
  // so the collections AI has a head-start pool of already-found products.
  // Depends on [q, ready] so it runs once on load and again if the query changes,
  // but NOT on every refinement (ready stays true after first load).
  useEffect(() => {
    if (!q || !ready || !session) return
    setCollections(null)
    const seedProducts = session.outfits.flatMap(o => o.items.flatMap(i => i.alternatives))
    fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, seedProducts }),
    })
      .then(r => r.json())
      .then(({ collections: c }) => setCollections(c ?? []))
      .catch(() => setCollections([]))
  }, [q, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeOutfit = session?.outfits[idx] ?? session?.outfits[0]

  useEffect(() => {
    if (activeOutfit) setIndices(activeOutfit.items.map(() => 0))
    setHeroSlot(0)
  }, [idx, activeOutfit])

  useEffect(() => {
    const container = tabsRef.current
    if (!container) return
    const tab = container.children[idx] as HTMLElement | undefined
    tab?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [idx])

  // Abort any in-flight refinement on unmount
  useEffect(() => () => { refineAbortRef.current?.abort() }, [])

  // Auto-dismiss error after 4s
  useEffect(() => {
    if (!refineError) return
    const t = setTimeout(() => setRefineError(null), 4000)
    return () => clearTimeout(t)
  }, [refineError])

  if (!ready || !session || !activeOutfit) return null

  function switchOutfit(i: number) {
    router.replace(`/look?q=${encodeURIComponent(q)}&idx=${i}`)
  }

  function setItemIdx(itemIdx: number, altIdx: number) {
    setIndices(prev => prev.map((v, i) => i === itemIdx ? altIdx : v))
  }

  async function handleRefine(refinedQ: string) {
    const trimmed = refinedQ.trim()
    if (!trimmed || refining) return

    // Cancel any in-flight refinement
    refineAbortRef.current?.abort()
    const controller = new AbortController()
    refineAbortRef.current = controller

    setRefining(true)
    setRefineStatus(null)
    setRefineError(null)
    setRefineQuery('')

    let resolved = false

    try {
      const res = await fetch('/api/refine', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refinement: trimmed, outfit: activeOutfit, originalQuery: q }),
        signal:  controller.signal,
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
          if (controller.signal.aborted) return
          const event = JSON.parse(line.slice(6))

          if (event.type === 'status') {
            setRefineStatus(event.message)

          } else if (event.type === 'done') {
            resolved = true
            if (!event.result) {
              setRefineError("Couldn't update the look — try again")
              setRefining(false)
              setRefineStatus(null)
              return
            }
            const refined = event.result as Outfit
            setSession(prev => {
              if (!prev) return prev
              const newOutfits = prev.outfits.map((o, i) => i === idx ? refined : o)
              const next = { ...prev, outfits: newOutfits }
              saveLookSession(next)
              return next
            })
            setIndices(refined.items.map(() => 0))
            setRefineCount(c => c + 1)
            setRefining(false)
            setRefineStatus(null)

          } else if (event.type === 'refinements') {
            setSession(prev => {
              if (!prev) return prev
              const next = { ...prev, refinements: event.result as string[] }
              saveLookSession(next)
              return next
            })

          } else if (event.type === 'error') {
            resolved = true
            setRefineError("Couldn't update the look — try again")
            setRefining(false)
            setRefineStatus(null)
          }
        }
      }

      // Stream closed without a done/error event (network drop, server crash)
      if (!resolved) {
        setRefineError("Couldn't update the look — try again")
        setRefining(false)
        setRefineStatus(null)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setRefineError("Couldn't update the look — try again")
      setRefining(false)
      setRefineStatus(null)
    }
  }

  const heroItem   = activeOutfit.items[heroSlot]
  const heroImage  = heroItem?.alternatives[indices[heroSlot] ?? 0]?.imageUrl
                  ?? heroItem?.alternatives[0]?.imageUrl
  // Strip: all items except the current hero, carrying their original index for indices lookup
  const stripItems = activeOutfit.items
    .map((item, i) => ({ item, originalIdx: i }))
    .filter(({ originalIdx }) => originalIdx !== heroSlot)

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
                  {stripItems.map(({ item, originalIdx }) => {
                    const altIdx = indices[originalIdx] ?? 0
                    const img    = item.alternatives[altIdx]?.imageUrl
                                ?? item.alternatives[0]?.imageUrl
                    return (
                      <button
                        key={originalIdx}
                        onClick={() => setHeroSlot(originalIdx)}
                        className={`flex-1 min-h-0 rounded-lg overflow-hidden bg-[#F4F5F6]
                                    ring-2 ring-transparent hover:ring-[#1768b0]/30
                                    transition-all duration-150
                                    ${refining ? 'skeleton' : ''}`}>
                        {!refining && img && (
                          <img
                            key={`strip-${originalIdx}-${altIdx}`}
                            src={img}
                            alt={item.alternatives[0]?.name}
                            className="w-full h-full object-cover"
                            style={{ animation: 'imgFadeIn 220ms ease-out' }}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Hero — RIGHT, takes remaining width */}
              <div className={`flex-[2] min-h-0 rounded-xl overflow-hidden bg-[#F4F5F6]
                               ${refining ? 'skeleton' : ''}`}>
                {!refining && heroImage && (
                  <img
                    key={`hero-${heroSlot}-${indices[heroSlot]}`}
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
              <div className={`aspect-[4/5] bg-[#F4F5F6] ${refining ? 'skeleton' : ''}`}>
                {!refining && heroImage && (
                  <img
                    key={`m-hero-${heroSlot}-${indices[heroSlot]}`}
                    src={heroImage}
                    alt={heroItem?.alternatives[0]?.name}
                    className="w-full h-full object-cover"
                    style={{ animation: 'imgFadeIn 220ms ease-out' }}
                  />
                )}
              </div>
              {stripItems.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pt-2 px-4 sm:px-8">
                  {stripItems.map(({ item, originalIdx }) => {
                    const altIdx = indices[originalIdx] ?? 0
                    const img    = item.alternatives[altIdx]?.imageUrl
                                ?? item.alternatives[0]?.imageUrl
                    return (
                      <button
                        key={originalIdx}
                        onClick={() => setHeroSlot(originalIdx)}
                        className={`w-[28vw] min-w-[88px] max-w-[130px] aspect-[4/5]
                                    shrink-0 rounded-lg overflow-hidden bg-[#F4F5F6]
                                    ring-2 ring-transparent active:ring-[#1768b0]/30
                                    ${refining ? 'skeleton' : ''}`}>
                        {!refining && img && (
                          <img
                            key={`m-strip-${originalIdx}-${altIdx}`}
                            src={img}
                            alt={item.alternatives[0]?.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </button>
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

            {/* Product cards / skeleton */}
            {refining ? (
              <div className="flex flex-col gap-4">
                {/* Live status text */}
                {refineStatus && (
                  <p className="text-[12px] text-[rgba(26,26,26,0.4)] -mb-1">
                    {refineStatus}
                  </p>
                )}
                {activeOutfit.items.map((_, i) => (
                  <div key={i}
                       className="rounded-lg flex min-h-[130px] sm:min-h-[148px]
                                  border border-black/[0.06] overflow-hidden">
                    {/* image placeholder */}
                    <div className="w-28 sm:w-[160px] shrink-0 skeleton" />
                    {/* text placeholders */}
                    <div className="flex-1 flex flex-col justify-center gap-2.5
                                    py-5 sm:py-6 px-4 sm:px-6">
                      <div className="skeleton h-2 w-14 rounded-full" />
                      <div className="skeleton h-4 w-full rounded" />
                      <div className="skeleton h-4 w-3/5 rounded" />
                      <div className="skeleton h-5 w-1/4 rounded mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div key={`items-${idx}-${refineCount}`} className="flex flex-col gap-4">
                {activeOutfit.items.map((item, i) => (
                  <ItemCard
                    key={`${idx}-${i}-${refineCount}`}
                    item={item}
                    idx={indices[i] ?? 0}
                    onIdxChange={newIdx => setItemIdx(i, newIdx)}
                    animDelay={i * 60}
                  />
                ))}
              </div>
            )}

            {/* ── Refinement chips (always in-flow) ─────────────────── */}
            {session.refinements.length > 0 && !refining && (
              <div key={`chips-${refineCount}`}
                   className="border-t border-black/[0.06] pt-6 mt-6"
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

            {/* ── Refinement input — fixed on mobile, in-flow on desktop ── */}
            <div className="fixed bottom-0 left-0 right-0 z-20
                            bg-white/75 backdrop-blur-xl
                            shadow-[0_-1px_0_0_rgba(0,0,0,0.05)]
                            px-4 pt-2.5 pb-10
                            lg:static lg:bottom-auto lg:left-auto lg:right-auto lg:z-auto
                            lg:bg-transparent lg:backdrop-blur-none lg:shadow-none
                            lg:border-t lg:border-black/[0.06]
                            lg:px-0 lg:pt-6 lg:pb-8 lg:mt-6">
              {refineError && (
                <p className="text-[12px] text-red-500 mb-2 px-1">{refineError}</p>
              )}
              <form onSubmit={e => { e.preventDefault(); handleRefine(refineQuery) }}>
                <div className={`flex items-center gap-2.5 bg-white rounded-full
                                border transition-all duration-200
                                px-4 py-2.5 lg:px-5 lg:py-3.5
                                ${refining
                                  ? 'border-black/[0.08]'
                                  : 'border-black/[0.12] focus-within:border-[#1768b0]/50 focus-within:shadow-[0_0_0_3px_rgba(23,104,176,0.06)]'
                                }`}>
                  <i className={`text-[12px] lg:text-[13px] text-black/25 shrink-0 fa-solid
                                 ${refining ? 'fa-spinner animate-spin' : 'fa-wand-magic-sparkles'}`} />
                  <input
                    value={refineQuery}
                    onChange={e => setRefineQuery(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    disabled={refining}
                    placeholder={
                      refining
                        ? (refineStatus ?? 'Updating look…')
                        : (!inputFocused && !refineQuery) ? typedText : 'What would you change?'
                    }
                    className="flex-1 min-w-0 bg-transparent outline-none
                               text-[13px] lg:text-[14px]
                               text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.38)]
                               disabled:cursor-not-allowed"
                  />
                  {refining ? (
                    <button
                      type="button"
                      onClick={() => {
                        refineAbortRef.current?.abort()
                        setRefining(false)
                        setRefineStatus(null)
                      }}
                      className="shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-full
                                 flex items-center justify-center
                                 border border-black/[0.12] text-black/40
                                 hover:border-black/25 hover:text-black/60
                                 transition-all duration-200"
                    >
                      <i className="fa-solid fa-xmark text-[11px] lg:text-[12px]" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!refineQuery.trim()}
                      className="shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-full
                                 flex items-center justify-center
                                 bg-[#1768b0] text-white transition-opacity duration-200"
                    >
                      <i className="fa-solid fa-arrow-up text-[11px] lg:text-[12px]" />
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Spacer reserves space for the fixed bar on mobile */}
            <div className="h-24 lg:hidden" />

          </div>
        </div>
      </div>

      {/* ── Shop the look — Claude-curated collections ───────────────────── */}
      <ProductCollections collections={collections} stickyTop="top-14" />
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
