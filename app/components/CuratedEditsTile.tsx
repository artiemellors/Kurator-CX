'use client'

import type { CollectionPreview } from '@/lib/look-session'
import { useSwipe } from '@/hooks/useSwipe'

interface Props {
  collections: CollectionPreview[]
  onExplore: (idx: number) => void
}

export default function CuratedEditsTile({ collections, onExplore }: Props) {
  const { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging, gapPx } = useSwipe(collections.length)

  return (
    <div
      className="col-span-2 -mx-4 sm:mx-0 bg-[#F4F5F6] sm:rounded-[16px]
                 overflow-hidden flex flex-col group min-h-[260px] sm:min-h-0"
      style={{ animation: 'fadeUp 0.5s ease both' }}
    >
      <div
        ref={trackRef}
        className="relative grow"
        style={{ padding: '12px 0 12px 12px' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full"
          style={{
            gap: `${gapPx}px`,
            transform: `translateX(${offset}px)`,
            transition: dragging ? 'none' : 'transform 380ms cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        >
          {collections.map((col, i) => {
            const images = col.products.filter(p => p.imageUrl).slice(0, 3)
            return (
              <div
                key={i}
                className="bg-white rounded-[12px] border-[1.5px] border-black/[0.06]
                           relative flex flex-col shrink-0"
                style={{ width: cardWidth > 0 ? `${cardWidth}px` : `calc(100% - 20px)` }}
              >
                <div className="px-4 pt-4 pb-4 grow overflow-hidden rounded-[12px]">
                  <div className="flex gap-2 h-full">
                    <div className="relative flex-[3] rounded-[10px] overflow-hidden bg-[#F4F5F6]">
                      {images[0]?.imageUrl && (
                        <img
                          src={images[0].imageUrl}
                          alt={images[0].name}
                          className="absolute inset-0 w-full h-full object-cover object-center"
                          style={{ animation: 'imgFadeIn 220ms ease-out' }}
                        />
                      )}
                    </div>
                    <div className="flex-[2] flex flex-col gap-2">
                      {[0, 1].map(j => (
                        <div key={j} className="relative flex-1 rounded-[10px] overflow-hidden bg-[#F4F5F6]">
                          {images[j + 1]?.imageUrl && (
                            <img
                              src={images[j + 1].imageUrl}
                              alt={images[j + 1].name}
                              className="absolute inset-0 w-full h-full object-cover object-center"
                              style={{ animation: `imgFadeIn ${220 + j * 60}ms ease-out` }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onExplore(i)}
                  className="absolute bottom-4 left-4 px-4 py-2 rounded-full bg-white
                             border border-[#1768b0] text-[#1768b0] text-[12px] font-semibold
                             shadow-sm transition-all duration-200 z-10 whitespace-nowrap
                             hover:bg-[#1768b0] hover:text-white"
                >
                  Shop {col.name}
                </button>
              </div>
            )
          })}
        </div>

        {activeIdx > 0 && (
          <button
            onClick={() => goTo(activeIdx - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full
                       bg-white shadow-md border border-black/[0.08]
                       flex items-center justify-center z-20
                       opacity-0 group-hover:opacity-100 transition-opacity duration-200
                       hover:bg-[#f4f5f6]"
          >
            <i className="fa-solid fa-chevron-left text-[10px] text-[#1a1a1a]" />
          </button>
        )}

        {activeIdx < collections.length - 1 && (
          <button
            onClick={() => goTo(activeIdx + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full
                       bg-white shadow-md border border-black/[0.08]
                       flex items-center justify-center z-20
                       opacity-0 group-hover:opacity-100 transition-opacity duration-200
                       hover:bg-[#f4f5f6]"
          >
            <i className="fa-solid fa-chevron-right text-[10px] text-[#1a1a1a]" />
          </button>
        )}
      </div>
    </div>
  )
}
