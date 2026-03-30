'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { loadLookSession, type LookSession } from '@/lib/look-session'

function LookPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const q   = searchParams.get('q') ?? ''
  const idx = Math.max(0, parseInt(searchParams.get('idx') ?? '0', 10))

  const [session, setSession] = useState<LookSession | null>(null)
  const [ready, setReady]     = useState(false)

  useEffect(() => {
    const data = loadLookSession(q)
    if (!data) {
      // No session data — send back to search to re-run
      router.replace(`/search?q=${encodeURIComponent(q)}`)
      return
    }
    setSession(data)
    setReady(true)
  }, [q, router])

  if (!ready || !session) return null

  const activeOutfit = session.outfits[idx] ?? session.outfits[0]

  return (
    <div className="min-h-screen bg-[--bg]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-black/[0.06]">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 h-16 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[#1a1a1a] hover:text-[#1768B0] transition-colors"
            aria-label="Back to search results"
          >
            <i className="fa-solid fa-chevron-left text-[13px]" />
            <span className="text-[14px]">Back</span>
          </button>
          <div className="flex-1 flex justify-center">
            <a href="/">
              <Image src="/Logo.svg" alt="Kmart" width={88} height={28} priority />
            </a>
          </div>
          {/* Spacer to balance the back button */}
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 pb-16">

        {/* Outfit tabs */}
        {session.outfits.length > 1 && (
          <div className="flex overflow-x-auto scrollbar-hide border-b border-black/[0.08] mb-8 -mx-4 sm:-mx-8 px-4 sm:px-8">
            {session.outfits.map((outfit, i) => (
              <button
                key={i}
                onClick={() => router.replace(`/look?q=${encodeURIComponent(q)}&idx=${i}`)}
                className="relative shrink-0 pb-3 pt-1 mr-6 last:mr-0"
              >
                <span className={`block text-[11px] tracking-[1.32px] uppercase whitespace-nowrap transition-colors
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
        )}

        {/* Look title */}
        <div className="mb-8" style={{ animation: 'fadeUp 0.4s ease both' }}>
          <h1 className="text-[28px] font-bold text-[#1a1a1a] leading-tight mb-2">
            {activeOutfit.name}
          </h1>
          {activeOutfit.description && (
            <p className="text-[15px] text-[rgba(26,26,26,0.5)] leading-relaxed">
              {activeOutfit.description}
            </p>
          )}
        </div>

        {/* Placeholder content — Slices 2–5 will build this out */}
        <div className="rounded-[12px] border border-black/[0.06] bg-white p-8 text-center text-[rgba(26,26,26,0.3)] text-sm">
          Product grid coming in Slice 3
        </div>

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
