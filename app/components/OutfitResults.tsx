'use client'

import { useState, useEffect, useRef } from 'react'
import VisualiserZone, { type VisualiserProduct } from './VisualiserZone'

export interface Product {
  name: string
  price: string
  colour?: string
  productUrl: string
  imageUrl: string
}

export interface OutfitItem {
  category: string
  description: string
  alternatives: Product[]
}

export interface Outfit {
  name: string
  description: string
  items: OutfitItem[]
}

function parsePrice(price: string): number {
  return parseFloat(price.replace(/[^0-9.]/g, '')) || 0
}

/** Renders a Kmart-style price with a superscript dollar sign. */
function KmartPrice({ price, className = '' }: { price: string; className?: string }) {
  const stripped = price.startsWith('$') ? price.slice(1) : price
  return (
    <span className={className}>
      <span className="text-[16px] font-bold align-top">$</span>
      {stripped}
    </span>
  )
}

export function ItemCard({
  item,
  idx,
  onIdxChange,
  animDelay,
}: {
  item: OutfitItem
  idx: number
  onIdxChange: (idx: number) => void
  animDelay: number
}) {
  const product = item.alternatives[idx]
  const count = item.alternatives.length

  const arrowClass = `w-8 h-8 rounded-full bg-white border border-black/[0.12] shadow-sm
                      flex items-center justify-center text-sm text-[--text-muted]
                      hover:border-black/30 hover:text-[--text] transition-all z-10`

  return (
    <div style={{ animation: `fadeUp 0.5s ${animDelay}ms ease both` }}>
      {/* card — entire card is a link to the product */}
      <a
        id="ItemCard"
        href={product.productUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative bg-white rounded-lg flex gap-4 sm:gap-6 min-h-[130px] sm:min-h-[148px]
          cursor-pointer transition-shadow duration-200 hover:shadow-md border border-black/[0.08] hover:border-black/20"
      >
        {/* left arrow — centred on left card edge, half overflowing */}
        {count > 1 && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onIdxChange((idx - 1 + count) % count) }}
            aria-label="Previous option"
            className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 ${arrowClass}`}
          >‹</button>
        )}

        {/* ItemCard — image thumbnail (flush to card edges) */}
        <div id="ItemCard-image" className="w-28 sm:w-[160px] shrink-0 bg-white rounded-l-lg overflow-hidden">
          {product.imageUrl ? (
            <img
              key={idx}
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              style={{
                animation: 'imgFadeIn 180ms ease-out, imgJiggle 350ms ease-out',
              }}
            />
          ) : null}
        </div>

        {/* ItemCard — content column */}
        <div id="ItemCard-content" className="flex-1 min-w-0 flex flex-col py-5 sm:py-6 pr-5 sm:pr-6">
          <p className="text-[9px] font-bold tracking-[0.22em] uppercase mb-1"
             style={{ color: 'var(--accent)' }}>
            {item.category}
          </p>
          <h3 className="font-sans text-[16px] font-normal leading-tight mb-1 text-[--text] line-clamp-2">
            {product.name}
          </h3>
          {/* always rendered to reserve vertical space; invisible when no colour */}
          <p className={`text-[11px] text-[--text-subtle] mb-1.5 ${product.colour ? '' : 'invisible'}`}>
            {product.colour || '\u00a0'}
          </p>
          <p className="text-xs leading-relaxed text-[--text-muted] line-clamp-2">
            {item.description}
          </p>
          <KmartPrice
            price={product.price}
            className="font-sans text-[24px] font-bold text-[--text] leading-none mt-auto pt-3"
          />
          {/* dots — in-flow below price, relate to the card/variant not just price */}
          {count > 1 && (
            <div className="flex gap-1.5 mt-2">
              {item.alternatives.map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-black/50' : 'bg-black/[0.15]'}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* right arrow — centred on right card edge, half overflowing */}
        {count > 1 && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onIdxChange((idx + 1) % count) }}
            aria-label="Next option"
            className={`absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 ${arrowClass}`}
          >›</button>
        )}
      </a>
    </div>
  )
}

function OutfitView({ outfit, groupLabel = 'Selected Look', totalLabel = 'Complete outfit', supportsVisualise, visualiseMode }: {
  outfit: Outfit
  groupLabel?: string
  totalLabel?: string
  supportsVisualise?: boolean
  visualiseMode?: 'room' | 'outfit'
}) {
  const [indices, setIndices] = useState<number[]>(() => outfit.items.map(() => 0))
  const [priceFlashing, setPriceFlashing] = useState(false)
  const [visualiserOpen, setVisualiserOpen] = useState(false)

  const visualiserProducts: VisualiserProduct[] = outfit.items
    .map((item, i) => item.alternatives[indices[i]])
    .filter((p): p is Product => !!p?.imageUrl)
    .map(p => ({ name: p.name, imageUrl: p.imageUrl }))

  const total = outfit.items.reduce((sum, item, i) => {
    return sum + parsePrice(item.alternatives[indices[i]]?.price ?? '$0')
  }, 0)

  const prevTotalRef = useRef(total)

  useEffect(() => {
    if (prevTotalRef.current !== total) {
      setPriceFlashing(true)
      const t = setTimeout(() => setPriceFlashing(false), 400)
      prevTotalRef.current = total
      return () => clearTimeout(t)
    }
  }, [total])

  return (
    <div id="OutfitView" className="grid gap-6 items-start grid-cols-1 lg:grid-cols-[300px_1fr]">
      {/* OutfitView — summary card (sticky sidebar) */}
      <div
        id="OutfitView-summary"
        className="bg-white lg:sticky lg:top-[172px] rounded-lg p-7 border border-black/[0.08]"
        style={{ animation: 'fadeUp 0.5s 60ms ease both' }}
      >
        <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[--text-subtle] mb-1.5">
          {groupLabel}
        </p>

        <h2 className="font-sans text-2xl font-bold leading-snug text-[--text] mb-3">
          {outfit.name}
        </h2>
        <p className="text-sm leading-relaxed text-[--text-muted] mb-7">
          {outfit.description}
        </p>

        {/* Summary card — total price row */}
        <div
          id="OutfitView-summary-total"
          className="flex items-end justify-between pt-5 mb-6 border-t border-black/[0.08]"
        >
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[--text-subtle] mb-1">
              {totalLabel}
            </p>
            <div
              style={{
                color: 'var(--accent)',
                animation: priceFlashing ? 'priceBounce 400ms ease-out' : undefined,
              }}
            >
              <KmartPrice
                price={`$${total.toFixed(2)}`}
                className="font-sans text-[32px] font-bold leading-none"
              />
            </div>
          </div>
          <div className="text-xs text-[--text-muted]">
            {outfit.items.length} pieces
          </div>
        </div>

        <button
          className="w-full py-3.5 text-[11px] font-bold tracking-[0.18em] uppercase
                     rounded transition-all duration-200 text-white"
          style={{ background: 'var(--accent)' }}
          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.9)' }}
          onMouseLeave={e => { e.currentTarget.style.filter = '' }}
        >
          Shop All Pieces →
        </button>

        {supportsVisualise && (
          <button
            onClick={() => setVisualiserOpen(v => !v)}
            className={`w-full py-3.5 text-[11px] font-bold tracking-[0.18em] uppercase
                       rounded transition-all duration-200 mt-2 border
                       ${visualiserOpen
                         ? 'border-[--accent] text-[--accent] bg-[rgba(23,104,176,0.04)]'
                         : 'border-black/[0.12] text-[--text] hover:border-[--accent] hover:text-[--accent]'
                       }`}
          >
            {visualiserOpen ? '← Back to your look' : visualiseMode === 'outfit' ? 'See it on you →' : 'See in your space →'}
          </button>
        )}
      </div>

      {/* OutfitView — right column: item cards OR visualiser zone */}
      {visualiserOpen ? (
        <VisualiserZone products={visualiserProducts} roomContext={outfit.name} visualiseMode={visualiseMode} />
      ) : (
        <div id="OutfitView-items" className="flex flex-col" style={{ gap: 'calc(var(--spacing) * 2)' }}>
          {outfit.items.map((item, i) => (
            <ItemCard
              key={item.category}
              item={item}
              idx={indices[i]}
              onIdxChange={newIdx => setIndices(prev => prev.map((v, j) => j === i ? newIdx : v))}
              animDelay={120 + i * 60}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OutfitResults({
  outfits,
  groupLabel,
  totalLabel,
  supportsVisualise,
  visualiseMode,
}: {
  outfits: Outfit[]
  groupLabel?: string
  totalLabel?: string
  supportsVisualise?: boolean
  visualiseMode?: 'room' | 'outfit'
}) {
  const [activeIdx, setActiveIdx] = useState(0)

  return (
    <div id="OutfitResults" className="max-w-[1600px] mx-auto px-4 sm:px-8 pb-16" style={{ animation: 'fadeUp 0.5s ease both' }}>
      {/* OutfitResults — sticky outfit tab bar */}
      <div id="OutfitResults-tabbar" className={`sticky top-20 z-10 -mx-4 sm:-mx-8 px-4 sm:px-8 pt-5 mb-6
        bg-white`}>
        <div className="flex gap-0 overflow-x-auto scrollbar-hide border-b border-black/[0.08]">
          {outfits.map((outfit, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`px-5 pb-3 pt-1 text-[11px] tracking-[0.12em]
                          uppercase transition-all duration-200 whitespace-nowrap shrink-0 border-b-2
                          ${i === activeIdx
                            ? `font-semibold border-[#1768B0] text-[#1768B0]`
                            : 'font-normal border-transparent text-black/30 hover:text-black/50'
                          }`}
            >
              {outfit.name}
            </button>
          ))}
        </div>
      </div>

      <OutfitView key={activeIdx} outfit={outfits[activeIdx]} groupLabel={groupLabel} totalLabel={totalLabel} supportsVisualise={supportsVisualise} visualiseMode={visualiseMode} />
    </div>
  )
}
