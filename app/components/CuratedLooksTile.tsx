'use client'

import { useState, useEffect, useRef } from 'react'
import type { Outfit } from './OutfitResults'

interface Props {
  outfits: Outfit[]
  onExplore: () => void
}

// Irregular phase offsets per circle index — not regular multiples so motion feels non-uniform
const SCROLL_PHASES = [0, 1.9, 3.4, 5.1, 0.8, 2.7]
// Slightly different amplitudes (px) so each circle bobs a different amount
const SCROLL_AMPS   = [5, 7, 4, 6, 5, 7]

export default function CuratedLooksTile({ outfits, onExplore }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const tabsRef   = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const circleRefs = useRef<(HTMLDivElement | null)[]>([])
  const activeOutfit = outfits[activeIdx]

  // Scroll active tab into view
  useEffect(() => {
    const container = tabsRef.current
    if (!container) return
    const tab = container.children[activeIdx] as HTMLElement | undefined
    tab?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [activeIdx])

  // Reset gallery scroll + circle positions when outfit changes
  useEffect(() => {
    if (galleryRef.current) galleryRef.current.scrollLeft = 0
    circleRefs.current.forEach(el => { if (el) el.style.transform = '' })
  }, [activeIdx])

  // Scroll-driven sinusoidal bob: each circle gets a unique phase + amplitude
  // Effect ramps up from zero so circles start flat at rest
  useEffect(() => {
    const container = galleryRef.current
    if (!container) return

    const onScroll = () => {
      const sx = container.scrollLeft
      // Ramp factor: 0 at rest → 1 after ~80px of scroll so circles start flat
      const engage = Math.min(sx / 80, 1)
      circleRefs.current.forEach((el, i) => {
        if (!el) return
        const phase = SCROLL_PHASES[i % SCROLL_PHASES.length]
        const amp   = SCROLL_AMPS[i % SCROLL_AMPS.length]
        const y = Math.sin(sx * 0.013 + phase) * amp * engage
        el.style.transform = `translateY(${y.toFixed(2)}px)`
      })
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  // One image per outfit slot — this is the look, not alternatives
  const images = activeOutfit.items
    .map(item => item.alternatives[0])
    .filter((p): p is NonNullable<typeof p> => !!p?.imageUrl)

  return (
    // overflow-hidden keeps circles clipped at rounded corners
    <div
      className="col-span-2 bg-white rounded-[12px] border-[1.5px] border-black/[0.06]
                 flex flex-col gap-5 pt-5 pb-5 overflow-hidden"
      style={{ animation: 'fadeUp 0.5s ease both' }}
    >
      {/* Title */}
      <div className="px-5 shrink-0">
        <h2 className="font-bold text-[20px] leading-[1.35] text-black tracking-[0.07px]">
          Curated looks
        </h2>
      </div>

      {/* Tabs */}
      <div className="px-5 relative shrink-0">
        <div ref={tabsRef} className="flex overflow-x-auto scrollbar-hide">
          {outfits.map((outfit, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className="relative shrink-0 pb-3 pt-0.5 mr-5 last:mr-0"
            >
              <span className={`block text-[11px] tracking-[1.32px] uppercase whitespace-nowrap transition-colors
                ${i === activeIdx
                  ? 'font-bold text-[#1768b0]'
                  : 'font-normal text-black/30 hover:text-black/50'
                }`}>
                {outfit.name}
              </span>
              {i === activeIdx && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#1768b0]" />
              )}
            </button>
          ))}
        </div>
        <span className="absolute bottom-0 left-0 right-0 h-px bg-black/[0.08]" />
      </div>

      {/* Gallery
          - px-5 both sides so circles stay within padding (matching tab alignment)
          - Sized so 3 circles fit exactly: mobile 122px/-ml-8, desktop 150px/-ml-10
          - overflow-x-auto kicks in when a 4th circle pushes past the right padding
      */}
      <div ref={galleryRef} className="flex-1 min-h-0 overflow-x-auto scrollbar-hide">
        <div className="h-full flex items-center px-5 py-3 min-w-max">
          {images.map((p, i) => (
            // Outermost: scroll-driven Y bob (JS-controlled via ref)
            <div
              ref={el => { circleRefs.current[i] = el }}
              key={`${activeIdx}-${i}`}
              className={`shrink-0 ${i > 0 ? '-ml-8 sm:-ml-10' : ''}`}
              style={{ animation: `fadeUp 250ms ${i * 40}ms ease both` }}
            >
              {/* Middle: hover scale — separate so it doesn't fight the JS transform */}
              <div className="transition-transform hover:scale-105 hover:z-10">
                {/* Inner div: clips image to circle — overflow-hidden only here */}
                <div className="relative h-[122px] w-[122px] sm:h-[150px] sm:w-[150px] rounded-[100px] overflow-hidden bg-[#F4F5F6]">
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 rounded-[100px] border border-black/[0.15] pointer-events-none" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary CTA */}
      <div className="px-5 shrink-0">
        <button
          onClick={onExplore}
          className="w-full py-3.5 rounded-full border border-[#1768b0] text-[#1768b0]
                     text-[15px] font-semibold transition-all duration-200
                     hover:bg-[#1768b0] hover:text-white"
        >
          Explore the look
        </button>
      </div>
    </div>
  )
}
