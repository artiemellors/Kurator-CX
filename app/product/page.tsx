'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { loadLookSession, type CollectionPreview } from '@/lib/look-session'
import type { Outfit } from '@/app/components/OutfitResults'
import { KmartProductCard, type CollectionProduct } from '@/app/components/ProductCollections'
import CuratedLooksTile from '@/app/components/CuratedLooksTile'
import CuratedEditsTile from '@/app/components/CuratedEditsTile'

// ── Grey placeholder blocks ──────────────────────────────────────────────────

function Grey({ className }: { className: string }) {
  return <div className={`bg-[#F4F5F6] rounded-[8px] ${className}`} />
}

// ── PDP content ──────────────────────────────────────────────────────────────

function ProductPageContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const q        = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? 'outfits'
  const name     = searchParams.get('name') ?? ''
  const price    = searchParams.get('price') ?? ''
  const imageUrl = searchParams.get('image') ?? ''
  const colour   = searchParams.get('colour') ?? undefined

  const [outfits,     setOutfits]     = useState<Outfit[]>([])
  const [collections, setCollections] = useState<CollectionPreview[]>([])
  const [similar,     setSimilar]     = useState<CollectionProduct[]>([])

  useEffect(() => {
    const session = loadLookSession(q)
    if (!session) return
    setOutfits(session.outfits ?? [])
    setCollections(session.collections ?? [])

    // Merge every collection's productPool, dedupe by name+colour, exclude current product
    const pool = new Map<string, CollectionProduct>()
    session.collections.forEach(col => {
      ;(col.productPool ?? []).forEach(p => {
        const key = `${p.name}::${p.colour ?? ''}`
        if (!pool.has(key)) pool.set(key, p)
      })
    })
    const currentKey = `${name}::${colour ?? ''}`
    setSimilar(Array.from(pool.values()).filter(p => `${p.name}::${p.colour ?? ''}` !== currentKey))
  }, [q, name, colour])

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-black/[0.06]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 h-16 flex items-center gap-4">
          <a href="/" className="flex items-center shrink-0">
            <Image src="/Logo.svg" alt="Kmart" width={88} height={28} priority />
          </a>
          <button
            onClick={() => router.back()}
            className="ml-auto text-[13px] text-[rgba(26,26,26,0.5)] hover:text-[#1a1a1a]
                       transition-colors flex items-center gap-1.5"
          >
            <i className="fa-solid fa-arrow-left text-[11px]" />
            Back
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 pb-20">

        {/* ── Product hero ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-16">

          {/* Left — product image(s) */}
          <div className="flex flex-col gap-2">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[12px] bg-[#F4F5F6]">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={name}
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
              )}
            </div>
          </div>

          {/* Right — product info + grey placeholders */}
          <div className="flex flex-col gap-4 pt-2">
            {/* Name */}
            <h1 className="text-[22px] sm:text-[26px] font-bold leading-[1.25] text-[#1a1a1a] tracking-[-0.2px]">
              {name || <Grey className="h-8 w-3/4" />}
            </h1>

            {/* Price */}
            <p className="text-[28px] font-bold text-[#1a1a1a] leading-none">
              {price ? (
                <>
                  <span className="text-[18px] align-top mt-1 inline-block">$</span>
                  {price.startsWith('$') ? price.slice(1) : price}
                </>
              ) : (
                <Grey className="h-8 w-24" />
              )}
            </p>

            {colour && (
              <p className="text-[13px] text-[rgba(26,26,26,0.5)]">{colour}</p>
            )}

            {/* Rating placeholder */}
            <Grey className="h-5 w-36" />

            {/* Add to bag placeholder */}
            <Grey className="h-12 w-full" />

            {/* Payment options placeholder */}
            <Grey className="h-10 w-full" />

            {/* Delivery / fulfilment options placeholder */}
            <div className="flex gap-3">
              <Grey className="h-16 flex-1" />
              <Grey className="h-16 flex-1" />
              <Grey className="h-16 flex-1" />
            </div>

            {/* Delivery address placeholder */}
            <Grey className="h-8 w-48" />

            {/* Description accordion placeholder */}
            <Grey className="h-10 w-full" />

            {/* Returns accordion placeholder */}
            <Grey className="h-10 w-full" />
          </div>
        </div>

        {/* ── Bundle tile ── */}
        {outfits.length > 0 && (
          <div className="mb-16">
            <CuratedLooksTile
              outfits={outfits}
              onExplore={(idx) =>
                router.push(`/look?q=${encodeURIComponent(q)}&idx=${idx}&category=${category}`)
              }
            />
          </div>
        )}

        {/* ── Collections tile ── */}
        {collections.length > 0 && (
          <div className="mb-12">
            <CuratedEditsTile
              collections={collections}
              onExplore={(idx) =>
                router.push(`/edit?q=${encodeURIComponent(q)}&idx=${idx}&category=${category}`)
              }
            />
          </div>
        )}

        {/* ── Similar products ── */}
        {similar.length > 0 && (
          <div>
            <h2 className="font-bold text-[20px] text-[#1a1a1a] mb-6">More to explore</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-8">
              {similar.slice(0, 20).map((p, i) => (
                <KmartProductCard
                  key={i}
                  p={p}
                  animDelay={(i % 10) * 30}
                  searchQuery={q}
                  category={category}
                />
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

export default function ProductPage() {
  return (
    <Suspense>
      <ProductPageContent />
    </Suspense>
  )
}
