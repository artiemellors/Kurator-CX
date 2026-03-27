'use client'

import { useState, useEffect, useRef } from 'react'
import type { Outfit } from './OutfitResults'

interface Props {
  outfits: Outfit[]
  onExplore: () => void
}

export default function CuratedLooksTile({ outfits, onExplore }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const tabsRef = useRef<HTMLDivElement>(null)
  const activeOutfit = outfits[activeIdx]

  useEffect(() => {
    const container = tabsRef.current
    if (!container) return
    const tab = container.children[activeIdx] as HTMLElement | undefined
    tab?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [activeIdx])

  // One image per outfit slot — this is the look, not alternatives
  const images = activeOutfit.items
    .map(item => item.alternatives[0])
    .filter((p): p is NonNullable<typeof p> => !!p?.imageUrl)

  return (
    <div
      className="col-span-2 self-start bg-white rounded-[12px] border border-black/[0.06]
                 flex flex-col gap-5 p-5"
      style={{ animation: 'fadeUp 0.5s ease both' }}
    >
      {/* Header */}
      <div className="flex items-end justify-between">
        <h2 className="font-bold text-[20px] leading-[1.35] text-black tracking-[0.07px]">
          Curated looks
        </h2>
        <button
          onClick={onExplore}
          className="text-[#1768b0] text-[11px] font-bold tracking-[1.98px] uppercase whitespace-nowrap
                     hover:text-[#0d4d7f] transition-colors leading-none pb-0.5"
        >
          Explore more →
        </button>
      </div>

      {/* Tabs */}
      <div className="relative">
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

      {/* Overlapping circles — horizontally scrollable */}
      <div className="overflow-x-auto overflow-y-hidden -mx-5 px-5 scrollbar-hide">
        <div className="flex items-center min-w-max py-2">
          {images.map((p, i) => (
            <div
              key={`${activeIdx}-${i}`}
              className={`relative h-[110px] w-[107px] rounded-[100px] shrink-0 overflow-hidden bg-[#F4F5F6]
                         transition-transform hover:scale-105 hover:z-10 ${i > 0 ? '-ml-8' : ''}`}
              style={{ animation: `fadeUp 250ms ${i * 40}ms ease both` }}
            >
              <img
                src={p.imageUrl}
                alt={p.name}
                className="absolute inset-0 w-full h-full object-cover object-top"
              />
              <div className="absolute inset-[-1px] rounded-[101px] border border-[rgba(227,229,232,0.6)] pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
