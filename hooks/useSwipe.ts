'use client'

import { useState, useRef, useEffect } from 'react'

export const PEEK_PX = 20
export const GAP_PX  = 8

export function useSwipe(count: number, peekPx = PEEK_PX, gapPx = GAP_PX) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [dragDelta, setDragDelta] = useState(0)
  const [cardWidth, setCardWidth] = useState(0)
  const trackRef   = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const dirLocked  = useRef<'h' | 'v' | null>(null)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setCardWidth(entries[0].contentRect.width - gapPx - peekPx)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [gapPx, peekPx])

  function goTo(i: number) { setActiveIdx(Math.max(0, Math.min(count - 1, i))) }

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    dirLocked.current = null
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
    setDragDelta(dx)
  }

  function onTouchEnd() {
    if (dragDelta < -48) goTo(activeIdx + 1)
    else if (dragDelta > 48) goTo(activeIdx - 1)
    setDragDelta(0)
    touchStart.current = null
    dirLocked.current = null
  }

  const step     = cardWidth + gapPx
  const offset   = cardWidth > 0 ? -activeIdx * step + dragDelta : 0
  const dragging = dragDelta !== 0

  return { trackRef, activeIdx, goTo, onTouchStart, onTouchMove, onTouchEnd, cardWidth, offset, dragging, gapPx }
}
