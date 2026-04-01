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
    <div className="col-span-2 -mx-4 sm:mx-0 bg-[#F4F5F6] sm:rounded-[16px] px-3 py-3 sm:p-3"
         style={{ animation: 'fadeUp 0.5s ease both' }}>
      <div className="bg-white rounded-[12px] border-[1.5px] border-black/[0.06]
                      flex flex-col gap-4 pt-4 pb-4 overflow-hidden">

        {/* Title */}
        <div className="px-4 shrink-0">
          <h2 className="font-bold text-[20px] leading-[1.35] text-black tracking-[0.07px]">
            Curated edits
          </h2>
        </div>

        {/* Tabs */}
        <div className="px-4 relative shrink-0">
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

        {/* Image grid — 1 large left, 2 small right stacked */}
        <div className="px-4 shrink-0">
          <div className="flex gap-2 h-[200px]">
            <div className="flex-[3] rounded-lg overflow-hidden bg-[#F4F5F6]">
              {images[0]?.imageUrl && (
                <img
                  key={`${activeIdx}-0`}
                  src={images[0].imageUrl}
                  alt={images[0].name}
                  className="w-full h-full object-cover object-top"
                  style={{ animation: 'imgFadeIn 220ms ease-out' }}
                />
              )}
            </div>
            <div className="flex-[2] flex flex-col gap-2">
              {([images[1], images[2]] as typeof images).map((img, i) => (
                <div key={i} className="flex-1 rounded-lg overflow-hidden bg-[#F4F5F6]">
                  {img?.imageUrl && (
                    <img
                      key={`${activeIdx}-${i + 1}`}
                      src={img.imageUrl}
                      alt={img.name}
                      className="w-full h-full object-cover object-top"
                      style={{ animation: `imgFadeIn ${220 + i * 60}ms ease-out` }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-4 shrink-0">
          <button
            onClick={() => onExplore(activeIdx)}
            className="w-full py-3.5 rounded-full border border-[#1768b0] text-[#1768b0]
                       text-[15px] font-semibold transition-all duration-200
                       hover:bg-[#1768b0] hover:text-white"
          >
            Explore the edit
          </button>
        </div>

      </div>
    </div>
  )
}
