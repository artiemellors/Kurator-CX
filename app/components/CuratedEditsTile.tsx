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

        {/* Tabs */}
        <div className="px-4 pt-4 relative shrink-0">
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

        {/* Image grid + floating CTA */}
        <div className="relative px-4 mt-3 pb-4 grow min-h-[150px] sm:min-h-0">
          <div className="flex gap-2 h-[150px] sm:h-full">
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

          {/* CTA — floats over the bottom-left of the image grid */}
          <button
            onClick={() => onExplore(activeIdx)}
            className="absolute bottom-4 left-4 px-5 py-2.5 rounded-full bg-white
                       border border-[#1768b0] text-[#1768b0] text-[13px] font-semibold
                       shadow-sm transition-all duration-200
                       hover:bg-[#1768b0] hover:text-white"
          >
            Explore the edit
          </button>
        </div>

      </div>
    </div>
  )
}
