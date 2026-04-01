'use client'

import { useState } from 'react'
import type { CollectionPreview } from '@/lib/look-session'

interface Props {
  collections: CollectionPreview[]
  onExplore: (idx: number) => void
}

export default function CuratedEditsTile({ collections, onExplore }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const active = collections[activeIdx]
  const images = active?.products.filter(p => p.imageUrl).slice(0, 3) ?? []

  return (
    // Grey wrapper — flex col so the white card can grow to fill the CSS Grid row
    // (CSS Grid default align-self:stretch gives this div the row track height;
    //  percentage h-full is unreliable on auto-height implicit grid rows)
    <div className="col-span-2 -mx-4 sm:mx-0 bg-[#F4F5F6] sm:rounded-[16px] px-3 py-3 sm:p-3 flex flex-col"
         style={{ animation: 'fadeUp 0.5s ease both' }}>
      {/* White card — grows to fill the grey wrapper */}
      <div className="bg-white rounded-[12px] border-[1.5px] border-black/[0.06]
                      flex flex-col grow overflow-hidden">

        {/* Title */}
        <div className="px-4 pt-4 pb-0 shrink-0">
          <h2 className="font-bold text-[20px] leading-[1.35] text-black tracking-[0.07px]">
            Curated Edits
          </h2>
        </div>

        {/* Tabs */}
        <div className="px-4 mt-3 relative shrink-0">
          <div className="flex overflow-x-auto scrollbar-hide">
            {collections.map((col, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className="relative shrink-0 pb-3 pt-0.5 mr-5 last:mr-0"
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
          <span className="absolute bottom-0 left-0 right-0 h-px bg-black/[0.08]" />
        </div>

        {/* Image grid — grows to fill remaining white-card height.
            min-h-[200px] ensures a sensible size when the tile is alone in its row (mobile). */}
        <div className="px-4 mt-3 grow min-h-[150px] sm:min-h-0">
          <div className="flex gap-2 h-full">
            {/* Large left — img absolute so natural dimensions don't inflate layout height */}
            <div className="relative flex-[3] rounded-[10px] overflow-hidden bg-[#F4F5F6]">
              {images[0]?.imageUrl && (
                <img
                  key={`${activeIdx}-0`}
                  src={images[0].imageUrl}
                  alt={images[0].name}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  style={{ animation: 'imgFadeIn 220ms ease-out' }}
                />
              )}
            </div>
            {/* Two stacked right — slots always rendered so layout stays consistent */}
            <div className="flex-[2] flex flex-col gap-2">
              {[0, 1].map(i => (
                <div key={i} className="relative flex-1 rounded-[10px] overflow-hidden bg-[#F4F5F6]">
                  {images[i + 1]?.imageUrl && (
                    <img
                      key={`${activeIdx}-${i + 1}`}
                      src={images[i + 1].imageUrl}
                      alt={images[i + 1].name}
                      className="absolute inset-0 w-full h-full object-cover object-top"
                      style={{ animation: `imgFadeIn ${220 + i * 60}ms ease-out` }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-4 mt-3 pb-4 shrink-0">
          <button
            onClick={() => onExplore(activeIdx)}
            className="w-full py-3.5 rounded-full border border-black/[0.15] text-[#1a1a1a]
                       text-[15px] font-semibold transition-all duration-200
                       hover:border-black/30 hover:bg-black/[0.03]"
          >
            Explore the edit
          </button>
        </div>

      </div>
    </div>
  )
}
