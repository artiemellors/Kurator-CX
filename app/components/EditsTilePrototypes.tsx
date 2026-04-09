'use client'

import type { CollectionPreview } from '@/lib/look-session'
import { useSwipe, GAP_PX, PEEK_PX } from '@/hooks/useSwipe'

function NavArrows({ activeIdx, total, goTo }: { activeIdx: number; total: number; goTo: (i: number) => void }) {
  return (
    <>
      {activeIdx > 0 && (
        <button onClick={() => goTo(activeIdx - 1)}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full
                     bg-white shadow-md border border-black/[0.08]
                     flex items-center justify-center z-20
                     opacity-0 group-hover:opacity-100 transition-opacity">
          <i className="fa-solid fa-chevron-left text-[10px] text-[#1a1a1a]" />
        </button>
      )}
      {activeIdx < total - 1 && (
        <button onClick={() => goTo(activeIdx + 1)}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full
                     bg-white shadow-md border border-black/[0.08]
                     flex items-center justify-center z-20
                     opacity-0 group-hover:opacity-100 transition-opacity">
          <i className="fa-solid fa-chevron-right text-[10px] text-[#1a1a1a]" />
        </button>
      )}
    </>
  )
}

function ProtoLabel({ letter }: { letter: string }) {
  return (
    <span className="absolute top-2 left-2 z-10 text-[9px] font-mono font-bold text-amber-600
                     bg-amber-50/90 border border-amber-200 rounded px-1.5 py-0.5 leading-none">
      {letter}
    </span>
  )
}

// ── Proto A: Editorial / text-forward ─────────────────────────────────────────

export function ProtoA({ collections, onExplore }: { collections: CollectionPreview[]; onExplore: (idx: number) => void }) {
  const { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging } = useSwipe(collections.length)

  return (
    <div className="col-span-2 -mx-4 sm:mx-0 bg-[#F4F5F6] sm:rounded-[16px] overflow-hidden flex flex-col group min-h-[280px] sm:min-h-0">
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
            gap: `${GAP_PX}px`,
            transform: `translateX(${offset}px)`,
            transition: dragging ? 'none' : 'transform 380ms cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        >
          {collections.map((col, i) => {
            const images = col.products.filter(p => p.imageUrl).slice(0, 2)
            return (
              <div
                key={i}
                className="bg-white rounded-[12px] border-[1.5px] border-black/[0.06]
                           shrink-0 flex flex-col"
                style={{ width: cardWidth > 0 ? `${cardWidth}px` : `calc(100% - ${PEEK_PX}px)` }}
              >
                <div className="px-4 pt-4 pb-3 shrink-0">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-[10px] tracking-[1.4px] uppercase font-semibold text-[#1768b0]/80">
                      Curated edit
                    </p>
                    <button
                      onClick={() => onExplore(i)}
                      className="shrink-0 flex items-center gap-1 text-[12px] font-normal
                                 text-[#1768b0] hover:underline underline-offset-2 transition-all"
                    >
                      Explore
                      <i className="fa-solid fa-arrow-right text-[9px]" />
                    </button>
                  </div>
                  <h3 className="font-bold text-[22px] sm:text-[26px] leading-[1.2] text-[#1a1a1a]
                                 tracking-[-0.3px] mb-1.5">
                    {col.name}
                  </h3>
                  {col.description && (
                    <p className="hidden sm:block text-[13px] text-[rgba(26,26,26,0.55)] leading-[1.55] line-clamp-1">
                      {col.description.split(/[.!?]/)[0]}
                    </p>
                  )}
                </div>

                <div className="grow min-h-0 flex gap-2 px-4 pb-4">
                  {images.map((p, j) => (
                    <div key={j} className="relative flex-1 aspect-[4/5] sm:aspect-auto rounded-[8px] overflow-hidden bg-[#F4F5F6]">
                      {j === 0 && <ProtoLabel letter="A" />}
                      {p.imageUrl && (
                        <img src={p.imageUrl} alt={p.name}
                          className="absolute inset-0 w-full h-full object-cover object-center" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <NavArrows activeIdx={activeIdx} total={collections.length} goTo={goTo} />
      </div>
    </div>
  )
}

// ── Proto B: Product shelf ────────────────────────────────────────────────────

export function ProtoB({ collections, onExplore }: { collections: CollectionPreview[]; onExplore: (idx: number) => void }) {
  const { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging } = useSwipe(collections.length)

  return (
    <div className="col-span-2 -mx-4 sm:mx-0 bg-[#F4F5F6] sm:rounded-[16px] overflow-hidden flex flex-col group min-h-[220px] sm:min-h-0">
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
            gap: `${GAP_PX}px`,
            transform: `translateX(${offset}px)`,
            transition: dragging ? 'none' : 'transform 380ms cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        >
          {collections.map((col, i) => {
            const images = col.products.filter(p => p.imageUrl).slice(0, 2)
            return (
              <div
                key={i}
                className="bg-white rounded-[12px] border-[1.5px] border-black/[0.06]
                           shrink-0 flex flex-col p-4 gap-3"
                style={{ width: cardWidth > 0 ? `${cardWidth}px` : `calc(100% - ${PEEK_PX}px)` }}
              >
                <div className="flex items-start justify-between gap-3 shrink-0">
                  <div>
                    <p className="text-[10px] tracking-[1.2px] uppercase text-[rgba(26,26,26,0.35)] mb-0.5">
                      Shop the edit
                    </p>
                    <h3 className="font-bold text-[15px] leading-[1.25] text-[#1a1a1a]">{col.name}</h3>
                  </div>
                  <button
                    onClick={() => onExplore(i)}
                    className="shrink-0 text-[11px] font-semibold text-[#1768b0]
                               border border-[#1768b0] rounded-full px-3 py-1.5 whitespace-nowrap
                               hover:bg-[#1768b0] hover:text-white transition-all"
                  >
                    See all
                  </button>
                </div>

                <div className="grow min-h-0 flex gap-2">
                  {images.map((p, j) => (
                    <div key={j} className="relative flex-1 aspect-[4/5] sm:aspect-auto rounded-[8px] overflow-hidden bg-[#F4F5F6]">
                      {j === 0 && <ProtoLabel letter="B" />}
                      {p.imageUrl && (
                        <img src={p.imageUrl} alt={p.name}
                          className="absolute inset-0 w-full h-full object-cover object-center" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <NavArrows activeIdx={activeIdx} total={collections.length} goTo={goTo} />
      </div>
    </div>
  )
}

// ── Proto C: Hero tile ────────────────────────────────────────────────────────

export function ProtoC({ collections, onExplore }: { collections: CollectionPreview[]; onExplore: (idx: number) => void }) {
  const { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging, gapPx } = useSwipe(collections.length, 0, GAP_PX)

  return (
    <div className="col-span-2 -mx-4 sm:mx-0 bg-[#0E3E68] sm:bg-transparent flex flex-col group min-h-[240px] sm:min-h-0">
      <div
        ref={trackRef}
        className="relative grow p-3 pr-7 sm:p-0 overflow-hidden sm:rounded-[12px]"
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
            const hero = col.products.find(p => p.imageUrl)
            return (
              <div
                key={i}
                className="shrink-0 relative rounded-[12px] overflow-hidden"
                style={{ width: cardWidth > 0 ? `${cardWidth}px` : '100%' }}
              >
                {hero?.imageUrl && (
                  <img src={hero.imageUrl} alt={col.name}
                    className="absolute inset-0 w-full h-full object-cover object-center" />
                )}
                <ProtoLabel letter="C" />
                <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute inset-0 p-4 flex flex-col justify-end">
                  <div className="flex items-end justify-between gap-3">
                    <h3 className="font-bold text-[18px] sm:text-[22px] leading-[1.2] text-white tracking-[-0.2px]">
                      {col.name} Edit
                    </h3>
                    <button
                      onClick={() => onExplore(i)}
                      className="shrink-0 px-4 py-2 rounded-full bg-white text-[#1768b0]
                                 text-[12px] font-semibold hover:bg-[#1768b0] hover:text-white transition-all"
                    >
                      Shop
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <NavArrows activeIdx={activeIdx} total={collections.length} goTo={goTo} />
      </div>
    </div>
  )
}
