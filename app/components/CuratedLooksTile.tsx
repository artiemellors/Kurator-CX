'use client'

import { useState } from 'react'
import type { Outfit } from './OutfitResults'

interface Props {
  outfits: Outfit[]
  onExplore: () => void
}

export default function CuratedLooksTile({ outfits, onExplore }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const activeOutfit = outfits[activeIdx]

  // First alternative image for each outfit item slot
  const images = activeOutfit.items
    .map(item => item.alternatives[0])
    .filter((p): p is NonNullable<typeof p> => !!p?.imageUrl)

  return (
    <div
      className="col-span-2 bg-white rounded-[16px] border border-black/[0.08] p-5 sm:p-6 flex flex-col gap-5"
      style={{ animation: 'fadeUp 0.5s ease both' }}
    >
      <h2 className="text-[22px] font-bold text-[#1a1a1a] leading-tight">Curated looks</h2>

      {/* Outfit tab bar */}
      <div className="flex border-b border-black/[0.08]">
        {outfits.map((outfit, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`px-3 sm:px-4 pb-2.5 pt-0.5 text-[10px] sm:text-[11px] tracking-[0.12em]
                        uppercase whitespace-nowrap border-b-2 transition-all duration-200
                        ${i === activeIdx
                          ? 'font-semibold border-[#1768B0] text-[#1768B0]'
                          : 'font-normal border-transparent text-black/30 hover:text-black/50'
                        }`}
          >
            {outfit.name}
          </button>
        ))}
      </div>

      {/* Product images as circles — 4 on mobile, all on sm+ */}
      <div className="flex gap-2 sm:gap-3">
        {images.map((p, i) => (
          <div
            key={`${activeIdx}-${i}`}
            className={`shrink-0 w-[68px] h-[68px] sm:w-20 sm:h-20 rounded-full overflow-hidden bg-[#F4F5F6]
                        ${i >= 4 ? 'hidden sm:block' : ''}`}
            style={{ animation: `fadeUp 250ms ${i * 60}ms ease both` }}
          >
            <img
              src={p.imageUrl}
              alt={p.name}
              className="w-full h-full object-cover object-top"
            />
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onExplore}
        className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#1768B0] text-center py-1
                   hover:opacity-70 transition-opacity"
      >
        Explore the look →
      </button>
    </div>
  )
}
