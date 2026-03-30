'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { loadLookSession, type LookSession } from '@/lib/look-session'

function LookPageContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const q   = searchParams.get('q') ?? ''
  const idx = Math.max(0, parseInt(searchParams.get('idx') ?? '0', 10))

  const [session, setSession] = useState<LookSession | null>(null)
  const [ready, setReady]     = useState(false)
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

        {/* ── Product grid — Slice 3 ──────────────────────────────── */}
        <section className="pt-8 pb-8 border-b border-black/[0.06]">
          <div className="rounded-[12px] border border-black/[0.06] bg-white p-8
                          text-center text-[rgba(26,26,26,0.25)] text-sm">
            Product grid — Slice 3
          </div>
        </section>

        {/* ── Refinement zone — Slice 5 ───────────────────────────── */}
        <section className="pt-8">
          <div className="rounded-[12px] border border-black/[0.06] bg-white p-8
                          text-center text-[rgba(26,26,26,0.25)] text-sm">
            Refinement zone — Slice 5
          </div>
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
