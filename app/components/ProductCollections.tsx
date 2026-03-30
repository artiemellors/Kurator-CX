'use client'

import { useState, useEffect, useRef } from 'react'

export interface CollectionProduct {
  name: string
  price: string
  colour?: string
  productUrl?: string
  imageUrl?: string
  altImageUrl?: string
}

export interface ProductCollection {
  name: string
  products: CollectionProduct[]
}

function SkeletonCard() {
  return (
    <div className="flex flex-col">
      <div className="skeleton aspect-[4/5] w-full rounded-[8px] bg-[#F4F5F6]" />
      <div className="pt-2 space-y-1.5">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-4 w-1/3 rounded mt-1" />
      </div>
    </div>
  )
}

export function KmartProductCard({ p, animDelay }: { p: CollectionProduct; animDelay: number }) {
  const hasAlt = !!p.altImageUrl
  const [showAlt, setShowAlt] = useState(false)
  const cardRef = useRef<HTMLAnchorElement>(null)
  // Stable random delay per card (150–550ms) so cards in the same row don't flip together
  const delayRef = useRef(Math.floor(Math.random() * 400) + 150)

  useEffect(() => {
    if (!hasAlt) return
    // Desktop: hover handles it
    if (window.matchMedia('(hover: hover)').matches) return

    const el = cardRef.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | null = null

    // Flip when card scrolls into view; revert when it leaves — scroll-driven, not timer-driven
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        timer = setTimeout(() => setShowAlt(true), delayRef.current)
      } else {
        if (timer) { clearTimeout(timer); timer = null }
        setShowAlt(false)
      }
    }, { threshold: 0.25 })

    observer.observe(el)
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [hasAlt])

  return (
    <a
      ref={cardRef}
      href={p.productUrl ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col"
      style={{ animation: `fadeUp 300ms ${animDelay}ms ease both` }}
      onMouseEnter={() => hasAlt && setShowAlt(true)}
      onMouseLeave={() => hasAlt && setShowAlt(false)}
    >
      <div className="relative bg-[#F4F5F6] overflow-hidden rounded-[8px]">
        <div className="aspect-[4/5] w-full relative">
          {p.imageUrl && (
            <img
              src={p.imageUrl}
              alt={p.name}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
              style={{
                opacity: showAlt && hasAlt ? 0 : 1,
                animation: 'imgFadeIn 300ms ease-out',
              }}
            />
          )}
          {hasAlt && (
            <img
              src={p.altImageUrl}
              alt={p.name}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
              style={{ opacity: showAlt ? 1 : 0 }}
            />
          )}
        </div>
      </div>
      <div className="pt-3 pb-4 flex flex-col">
        <p className="text-[16px] font-normal leading-[1.3] line-clamp-2 text-[#1a1a1a] mb-2">
          {p.name}
        </p>
        {p.colour && (
          <p className="text-[11px] text-[rgba(26,26,26,0.5)] mb-3">{p.colour}</p>
        )}
        <p className="font-bold text-[#1a1a1a] leading-none text-[24px]">
          <span className="text-[16px] font-bold align-top" style={{ marginTop: '3px', display: 'inline-block' }}>$</span>
          {p.price.startsWith('$') ? p.price.slice(1) : p.price}
        </p>
      </div>
    </a>
  )
}

export function ProductCollections({
  collections,
  stickyTop = 'top-20',
}: {
  collections: ProductCollection[] | null
  stickyTop?: string
}) {
  const [activeTab, setActiveTab] = useState(0)
  const isLoading = collections === null

  // Reset active tab when collections change
  if (!isLoading && activeTab >= collections.length && collections.length > 0) {
    setActiveTab(0)
  }

  if (!isLoading && collections.length === 0) return null

  const activeCollection = isLoading ? null : collections[activeTab]

  return (
    <div className="w-full bg-white border-t border-black/[0.06]">
    <div id="ProductCollections" className="max-w-[1600px] mx-auto px-4 sm:px-8 pb-16">

      {/* Section heading */}
      <p className="text-2xl font-bold text-[#1a1a1a] mt-8 mb-5">Shop the edit</p>

      {/* ProductCollections — sticky collection tab bar */}
      <div id="ProductCollections-tabbar" className={`sticky ${stickyTop} z-10 bg-white -mx-4 sm:-mx-8 px-4 sm:px-8 pt-4 mb-6`}>
        <div className="flex gap-0 overflow-x-auto scrollbar-hide border-b border-black/[0.08]">
          {isLoading ? (
            <>
              <div className="skeleton h-4 w-20 mx-5 mb-3 rounded" />
              <div className="skeleton h-4 w-16 mx-5 mb-3 rounded" />
              <div className="skeleton h-4 w-24 mx-5 mb-3 rounded" />
            </>
          ) : (
            collections.map((col, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-5 pb-3 pt-1 text-[11px] tracking-[0.12em]
                            uppercase transition-all duration-200 whitespace-nowrap shrink-0 border-b-2
                            ${i === activeTab
                              ? `font-semibold border-[#1768B0] text-[#1768B0]`
                              : 'font-normal border-transparent text-black/30 hover:text-black/50'
                            }`}
              >
                {col.name}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ProductCollections — product grid */}
      <div
        id="ProductCollections-grid"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6"
      >
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : activeCollection ? (
          activeCollection.products.map((p, i) => (
            <KmartProductCard
              key={`${activeTab}-${i}`}
              p={p}
              animDelay={i * 35}
            />
          ))
        ) : null}
      </div>
    </div>
    </div>
  )
}
