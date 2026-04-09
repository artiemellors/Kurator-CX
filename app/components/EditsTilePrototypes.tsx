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

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-block text-[9px] font-mono font-bold text-amber-500 uppercase
                     tracking-widest bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
      {label}
    </span>
  )
}

// ── Proto A: Editorial / text-forward ─────────────────────────────────────────

export function ProtoA({ collections, onExplore }: { collections: CollectionPreview[]; onExplore: (idx: number) => void }) {
  const { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging } = useSwipe(collections.length)

  return (
    // Outer col-span wrapper: badge in white space above, grey tile below
    <div className="col-span-2 flex flex-col">
      <div className="mb-1.5 px-1 sm:px-0">
        <Badge label="A — Text-forward" />
      </div>
      <div className="-mx-4 sm:mx-0 bg-[#F4F5F6] sm:rounded-[16px] overflow-hidden flex flex-col group grow min-h-[280px] sm:min-h-0">
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
              const images = col.products.filter(p => p.imageUrl).slice(0, 5)
              return (
                <div
                  key={i}
                  className="bg-white rounded-[12px] border-[1.5px] border-black/[0.06]
                             shrink-0 flex flex-col"
                  style={{ width: cardWidth > 0 ? `${cardWidth}px` : `calc(100% - ${PEEK_PX}px)` }}
                >
                  {/* Text section: label + CTA on same row, name + description below */}
                  <div className="px-4 pt-4 pb-3 shrink-0">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-[10px] tracking-[1.4px] uppercase font-semibold text-[#1768b0]/80">
                        Curated edit
                      </p>
                      <button
                        onClick={() => onExplore(i)}
                        className="shrink-0 flex items-center gap-1 text-[12px] font-semibold
                                   text-[#1768b0] hover:underline underline-offset-2 transition-all"
                      >
                        Shop the edit
                        <i className="fa-solid fa-arrow-right text-[9px]" />
                      </button>
                    </div>
                    <h3 className="font-bold text-[22px] sm:text-[26px] leading-[1.2] text-[#1a1a1a]
                                   tracking-[-0.3px] mb-1.5">
                      {col.name}
                    </h3>
                    {col.description && (
                      <p className="text-[13px] text-[rgba(26,26,26,0.55)] leading-[1.55] line-clamp-1">
                        {col.description.split(/[.!?]/)[0]}
                      </p>
                    )}
                  </div>

                  {/* Image strip — 4:5 portrait on mobile, fills card height on desktop */}
                  <div className="grow min-h-0 flex gap-2 px-4 pb-4">
                    {images.map((p, j) => (
                      <div key={j} className="relative flex-1 aspect-[4/5] sm:aspect-auto rounded-[8px] overflow-hidden bg-[#F4F5F6]">
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
    </div>
  )
}

// ── Proto B: Product shelf ────────────────────────────────────────────────────

export function ProtoB({ collections, onExplore }: { collections: CollectionPreview[]; onExplore: (idx: number) => void }) {
  const { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging } = useSwipe(collections.length)

  return (
    // Outer col-span wrapper stretches to row height; grey tile fills it via grow.
    <div className="col-span-2 flex flex-col">
      <div className="mb-1.5 px-1 sm:px-0">
        <Badge label="B — Shelf" />
      </div>
      {/* Grey tile fills remaining height after badge */}
      <div className="-mx-4 sm:mx-0 bg-[#F4F5F6] sm:rounded-[16px] overflow-hidden grow flex flex-col group">
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
              const images = col.products.filter(p => p.imageUrl).slice(0, 4)
              return (
                <div
                  key={i}
                  className="bg-white rounded-[12px] border-[1.5px] border-black/[0.06]
                             shrink-0 flex flex-col p-4 gap-3"
                  style={{ width: cardWidth > 0 ? `${cardWidth}px` : `calc(100% - ${PEEK_PX}px)` }}
                >
                  {/* Header: name + pill CTA */}
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

                  {/* Image shelf — fills remaining card height, no fixed aspect ratio */}
                  <div className="grow min-h-0 flex gap-2">
                    {images.map((p, j) => (
                      <div key={j}
                        className="relative flex-1 rounded-[8px] overflow-hidden bg-[#F4F5F6]">
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
    </div>
  )
}

// ── Proto C: Hero tile ────────────────────────────────────────────────────────

export function ProtoC({ collections, onExplore }: { collections: CollectionPreview[]; onExplore: (idx: number) => void }) {
  const { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging } = useSwipe(collections.length)

  return (
    // Outer col-span wrapper stretches to row height; grey tile fills it via grow.
    <div className="col-span-2 flex flex-col">
      <div className="mb-1.5 px-1 sm:px-0">
        <Badge label="C — Hero tile" />
      </div>
      {/* Grey tile fills remaining height after badge */}
      <div className="-mx-4 sm:mx-0 bg-[#F4F5F6] sm:rounded-[16px] overflow-hidden grow flex flex-col group">
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
              const hero = col.products.find(p => p.imageUrl)
              return (
                // No aspect-ratio — card stretches to fill the track height (= row height - badge - padding)
                <div
                  key={i}
                  className="shrink-0 relative rounded-[12px] overflow-hidden"
                  style={{ width: cardWidth > 0 ? `${cardWidth}px` : `calc(100% - ${PEEK_PX}px)` }}
                >
                  {hero?.imageUrl && (
                    <img src={hero.imageUrl} alt={col.name}
                      className="absolute inset-0 w-full h-full object-cover object-center" />
                  )}
                  {/* Soft bottom gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent" />
                  {/* Content */}
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
    </div>
  )
}
