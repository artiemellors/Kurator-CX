'use client'

import { useState, useRef, useEffect } from 'react'
import type { CollectionPreview } from '@/lib/look-session'

// ── Shared swipe logic ────────────────────────────────────────────────────────

const PEEK_PX = 20
const GAP_PX  = 8

function useSwipe(count: number) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [dragging, setDragging]   = useState(false)
  const [dragDelta, setDragDelta] = useState(0)
  const [cardWidth, setCardWidth] = useState(0)
  const trackRef   = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const dirLocked  = useRef<'h' | 'v' | null>(null)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setCardWidth(entries[0].contentRect.width - GAP_PX - PEEK_PX)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function goTo(i: number) { setActiveIdx(Math.max(0, Math.min(count - 1, i))) }

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    dirLocked.current = null
    setDragging(false); setDragDelta(0)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchStart.current) return
    const dx = e.touches[0].clientX - touchStart.current.x
    const dy = e.touches[0].clientY - touchStart.current.y
    if (!dirLocked.current) {
      if (Math.abs(dx) > Math.abs(dy) + 4) dirLocked.current = 'h'
      else if (Math.abs(dy) > Math.abs(dx) + 4) dirLocked.current = 'v'
      else return
    }
    if (dirLocked.current === 'v') return
    e.preventDefault(); setDragging(true); setDragDelta(dx)
  }

  function onTouchEnd() {
    if (dragging) {
      if (dragDelta < -48) goTo(activeIdx + 1)
      else if (dragDelta > 48) goTo(activeIdx - 1)
    }
    setDragging(false); setDragDelta(0)
    touchStart.current = null; dirLocked.current = null
  }

  const step   = cardWidth + GAP_PX
  const offset = cardWidth > 0 ? -activeIdx * step + (dragging ? dragDelta : 0) : 0

  return { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging }
}

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

// ── Proto A: Editorial / text-forward ─────────────────────────────────────────
// Text leads: big collection name + description, then a thumbnail strip.
// Products support the idea rather than composing it visually.

export function ProtoA({ collections, onExplore }: { collections: CollectionPreview[]; onExplore: (idx: number) => void }) {
  const { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging } = useSwipe(collections.length)

  return (
    <div className="bg-white rounded-[16px] border border-black/[0.08] overflow-hidden group">
      <div
        ref={trackRef}
        className="relative"
        style={{ padding: '20px 0 20px 20px' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex"
          style={{
            gap: `${GAP_PX}px`,
            transform: `translateX(${offset}px)`,
            transition: dragging ? 'none' : 'transform 380ms cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        >
          {collections.map((col, i) => {
            const images = col.products.filter(p => p.imageUrl).slice(0, 5)
            return (
              <div
                key={i}
                className="shrink-0 flex flex-col gap-4"
                style={{ width: cardWidth > 0 ? `${cardWidth}px` : `calc(100% - ${PEEK_PX}px)` }}
              >
                {/* Text leads — anchors meaning before images */}
                <div className="pr-4">
                  <p className="text-[10px] tracking-[1.4px] uppercase font-semibold text-[#1768b0]/80 mb-1.5">
                    Curated edit
                  </p>
                  <h3 className="font-bold text-[22px] sm:text-[26px] leading-[1.2] text-[#1a1a1a] tracking-[-0.3px] mb-2">
                    {col.name}
                  </h3>
                  {col.description && (
                    <p className="text-[13px] text-[rgba(26,26,26,0.55)] leading-[1.55] line-clamp-2">
                      {col.description}
                    </p>
                  )}
                </div>
                {/* Equal-weight thumbnail strip — shelf, not composition */}
                <div className="flex gap-2 pr-4">
                  {images.map((p, j) => (
                    <div key={j} className="relative flex-1 aspect-square rounded-[8px] overflow-hidden bg-[#F4F5F6]">
                      {p.imageUrl && (
                        <img src={p.imageUrl} alt={p.name}
                          className="absolute inset-0 w-full h-full object-cover object-center" />
                      )}
                    </div>
                  ))}
                </div>
                {/* Text CTA — understated arrow link */}
                <button
                  onClick={() => onExplore(i)}
                  className="self-start flex items-center gap-1.5 text-[13px] font-semibold
                             text-[#1768b0] hover:underline underline-offset-2 transition-all"
                >
                  Shop the edit
                  <i className="fa-solid fa-arrow-right text-[10px]" />
                </button>
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
// Equal-size square thumbnails in a horizontal row.
// No composition hierarchy — "browse these" not "wear these together".

export function ProtoB({ collections, onExplore }: { collections: CollectionPreview[]; onExplore: (idx: number) => void }) {
  const { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging } = useSwipe(collections.length)

  return (
    <div className="bg-[#F4F5F6] rounded-[16px] overflow-hidden group">
      <div
        ref={trackRef}
        className="relative"
        style={{ padding: '12px 0 12px 12px' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex"
          style={{
            gap: `${GAP_PX}px`,
            transform: `translateX(${offset}px)`,
            transition: dragging ? 'none' : 'transform 380ms cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        >
          {collections.map((col, i) => {
            const images = col.products.filter(p => p.imageUrl).slice(0, 6)
            return (
              <div
                key={i}
                className="bg-white rounded-[12px] border-[1.5px] border-black/[0.06]
                           shrink-0 flex flex-col gap-3 p-4"
                style={{ width: cardWidth > 0 ? `${cardWidth}px` : `calc(100% - ${PEEK_PX}px)` }}
              >
                {/* Header: name + pill CTA side by side */}
                <div className="flex items-start justify-between gap-3">
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
                {/* Flat equal-size shelf */}
                <div className="flex gap-2">
                  {images.map((p, j) => (
                    <div key={j}
                      className="relative shrink-0 flex-1 aspect-square rounded-[8px] overflow-hidden bg-[#F4F5F6]">
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

// ── Proto C: Banner / hero with overlay ───────────────────────────────────────
// Full-bleed card: hero product image behind gradient, name + description over it,
// small thumbnail row + CTA pinned to bottom. Magazine spread feel.

export function ProtoC({ collections, onExplore }: { collections: CollectionPreview[]; onExplore: (idx: number) => void }) {
  const { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging } = useSwipe(collections.length)

  return (
    <div
      className="rounded-[16px] overflow-hidden group"
      style={{ background: '#F4F5F6', padding: '12px 0 12px 12px' }}
    >
      <div
        ref={trackRef}
        className="relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex"
          style={{
            gap: `${GAP_PX}px`,
            transform: `translateX(${offset}px)`,
            transition: dragging ? 'none' : 'transform 380ms cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        >
          {collections.map((col, i) => {
            const images  = col.products.filter(p => p.imageUrl)
            const hero    = images[0]
            const thumbs  = images.slice(1, 5)
            return (
              <div
                key={i}
                className="shrink-0 relative rounded-[12px] overflow-hidden"
                style={{
                  width: cardWidth > 0 ? `${cardWidth}px` : `calc(100% - ${PEEK_PX}px)`,
                  aspectRatio: '16 / 7',
                  minHeight: '180px',
                }}
              >
                {/* Hero background image */}
                {hero?.imageUrl && (
                  <img src={hero.imageUrl} alt={col.name}
                    className="absolute inset-0 w-full h-full object-cover object-center" />
                )}
                {/* Gradient overlay — left-heavy so text is legible */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />

                {/* Content layer */}
                <div className="absolute inset-0 p-5 flex flex-col justify-between">
                  {/* Top: label + name + description */}
                  <div>
                    <p className="text-[10px] tracking-[1.4px] uppercase font-semibold text-white/60 mb-1">
                      Curated edit
                    </p>
                    <h3 className="font-bold text-[20px] sm:text-[24px] leading-[1.2] text-white tracking-[-0.2px]">
                      {col.name}
                    </h3>
                    {col.description && (
                      <p className="text-[12px] text-white/65 leading-[1.45] mt-1.5 line-clamp-2 max-w-[220px]">
                        {col.description}
                      </p>
                    )}
                  </div>
                  {/* Bottom: thumbnail row + CTA */}
                  <div className="flex items-end justify-between gap-4">
                    <div className="flex gap-1.5">
                      {thumbs.map((p, j) => (
                        <div key={j}
                          className="w-10 h-10 sm:w-14 sm:h-14 rounded-[6px] overflow-hidden
                                     border border-white/30 bg-white/15 shrink-0">
                          {p.imageUrl && (
                            <img src={p.imageUrl} alt={p.name}
                              className="w-full h-full object-cover object-center" />
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => onExplore(i)}
                      className="shrink-0 px-4 py-2 rounded-full bg-white
                                 text-[#1768b0] text-[12px] font-semibold
                                 hover:bg-[#1768b0] hover:text-white transition-all"
                    >
                      Shop edit
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

// ── Proto D: Colour surface only ──────────────────────────────────────────────
// Identical layout to the current CuratedEditsTile but with a subtle brand-tinted
// background instead of neutral grey. Minimum-change surface differentiation.

export function ProtoD({ collections, onExplore }: { collections: CollectionPreview[]; onExplore: (idx: number) => void }) {
  const { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging } = useSwipe(collections.length)

  return (
    <div
      className="rounded-[16px] overflow-hidden group min-h-[260px] sm:min-h-0"
      style={{ background: 'rgba(23,104,176,0.08)', padding: '12px 0 12px 12px' }}
    >
      <div
        ref={trackRef}
        className="relative grow"
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
            const images = col.products.filter(p => p.imageUrl).slice(0, 3)
            return (
              <div
                key={i}
                className="bg-white rounded-[12px] border-[1.5px] border-[#1768b0]/[0.15]
                           relative flex flex-col shrink-0"
                style={{ width: cardWidth > 0 ? `${cardWidth}px` : `calc(100% - ${PEEK_PX}px)` }}
              >
                <div className="px-4 pt-4 pb-14 grow overflow-hidden rounded-[12px]">
                  <div className="flex gap-2 h-full">
                    <div className="relative flex-[3] rounded-[10px] overflow-hidden bg-[#F4F5F6]">
                      {images[0]?.imageUrl && (
                        <img src={images[0].imageUrl} alt={images[0].name}
                          className="absolute inset-0 w-full h-full object-cover object-center" />
                      )}
                    </div>
                    <div className="flex-[2] flex flex-col gap-2">
                      {[0, 1].map(j => (
                        <div key={j} className="relative flex-1 rounded-[10px] overflow-hidden bg-[#F4F5F6]">
                          {images[j + 1]?.imageUrl && (
                            <img src={images[j + 1].imageUrl} alt={images[j + 1].name}
                              className="absolute inset-0 w-full h-full object-cover object-center" />
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
        <NavArrows activeIdx={activeIdx} total={collections.length} goTo={goTo} />
      </div>
    </div>
  )
}

// ── Proto E: Static 2-col grid (no swipe) ────────────────────────────────────
// All collections visible at once, no carousel. Catalogue/browse feel.
// Clicking anywhere on the card navigates through.

export function ProtoE({ collections, onExplore }: { collections: CollectionPreview[]; onExplore: (idx: number) => void }) {
  return (
    <div>
      <p className="text-[10px] tracking-[1.4px] uppercase font-semibold text-[rgba(26,26,26,0.35)] mb-3">
        Shop the edits
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {collections.map((col, i) => {
          const images = col.products.filter(p => p.imageUrl).slice(0, 4)
          return (
            <div
              key={i}
              className="bg-white rounded-[12px] border border-black/[0.08] p-4 flex flex-col gap-3
                         hover:border-black/20 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => onExplore(i)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-[14px] leading-[1.3] text-[#1a1a1a]">{col.name}</h3>
                <i className="fa-solid fa-arrow-right text-[11px] text-[rgba(26,26,26,0.25)] mt-0.5 shrink-0" />
              </div>
              {/* Equal thumbnails: 4 in a row */}
              <div className="flex gap-1.5">
                {images.map((p, j) => (
                  <div key={j} className="relative flex-1 aspect-square rounded-[6px] overflow-hidden bg-[#F4F5F6]">
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt={p.name}
                        className="absolute inset-0 w-full h-full object-cover object-center" />
                    )}
                  </div>
                ))}
              </div>
              {col.description && (
                <p className="text-[11px] text-[rgba(26,26,26,0.45)] leading-[1.45] line-clamp-2">
                  {col.description}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
