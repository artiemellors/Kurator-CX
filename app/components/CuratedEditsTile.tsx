'use client'

import { useState, useRef, useEffect } from 'react'
import type { CollectionPreview } from '@/lib/look-session'

interface Props {
  collections: CollectionPreview[]
  onExplore: (idx: number) => void
}

const PEEK_PX = 20  // px of next card visible beyond active card
const GAP_PX  = 8   // px gap between cards

export default function CuratedEditsTile({ collections, onExplore }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [dragging, setDragging]   = useState(false)
  const [dragDelta, setDragDelta] = useState(0)
  const [cardWidth, setCardWidth] = useState(0)

  const wrapperRef  = useRef<HTMLDivElement>(null)
  const trackRef    = useRef<HTMLDivElement>(null)
  const touchStart  = useRef<{ x: number; y: number } | null>(null)
  const dirLocked   = useRef<'h' | 'v' | null>(null)

  // Measure the track container's content width (inside its left padding).
  // cardWidth = trackWidth - GAP_PX - PEEK_PX so the next card peeks exactly PEEK_PX
  // from the right edge of the grey overflow-hidden wrapper.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      setCardWidth(w - GAP_PX - PEEK_PX)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function goTo(idx: number) {
    setActiveIdx(Math.max(0, Math.min(collections.length - 1, idx)))
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    dirLocked.current  = null
    setDragging(false)
    setDragDelta(0)
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
    e.preventDefault()
    setDragging(true)
    setDragDelta(dx)
  }

  function onTouchEnd() {
    const THRESHOLD = 48
    if (dragging) {
      if (dragDelta < -THRESHOLD) goTo(activeIdx + 1)
      else if (dragDelta > THRESHOLD) goTo(activeIdx - 1)
    }
    setDragging(false)
    setDragDelta(0)
    touchStart.current = null
    dirLocked.current  = null
  }

  // step = cardWidth + GAP_PX = trackWidth - PEEK_PX (snaps so next card peeks PEEK_PX)
  const step       = cardWidth + GAP_PX
  const offset     = cardWidth > 0 ? -activeIdx * step + (dragging ? dragDelta : 0) : 0
  const translateX = `${offset}px`

  return (
    // min-h-[260px] gives the grey wrapper a definite height on mobile (tile is alone in its row,
    // so CSS Grid won't stretch it). sm+ the grid stretch + grow chain handles it.
    <div
      ref={wrapperRef}
      className="col-span-2 -mx-4 sm:mx-0 bg-[#F4F5F6] sm:rounded-[16px]
                 overflow-hidden flex flex-col group min-h-[260px] sm:min-h-0"
      style={{ animation: 'fadeUp 0.5s ease both' }}
    >
      {/* Track container — padding on all sides except right (next card peeks to edge) */}
      <div
        ref={trackRef}
        className="relative grow"
        style={{ padding: '12px 0 12px 12px' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Sliding track — h-full propagates definite height down to cards */}
        <div
          className="flex h-full"
          style={{
            gap: `${GAP_PX}px`,
            transform: `translateX(${translateX})`,
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
                style={{ width: cardWidth > 0 ? `${cardWidth}px` : `calc(100% - ${PEEK_PX}px)` }}
              >
                {/* Image grid — grow fills the card height passed down from h-full track */}
                <div className="px-4 pt-4 pb-4 grow overflow-hidden rounded-[12px]">
                  <div className="flex gap-2 h-full">
                    {/* Large left image */}
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
                    {/* Two stacked right images */}
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
                {/* CTA — absolute relative to card so it never clips on long names */}
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

        {/* Desktop prev arrow — visible on group-hover */}
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

        {/* Desktop next arrow — visible on group-hover */}
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
