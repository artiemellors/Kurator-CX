'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const OCCASION_TILES = [
  { label: 'Job Interview',  query: 'smart casual outfit for a job interview' },
  { label: 'Weekend Brunch', query: 'weekend brunch, something relaxed' },
  { label: 'Beach Day',      query: 'beach day with the kids' },
  { label: 'Date Night',     query: 'date night, a bit dressed up' },
  { label: 'Night Out',      query: 'night out outfit' },
  { label: 'Gym',            query: 'gym outfit' },
  { label: 'Winter Layers',  query: 'cosy winter layers' },
  { label: 'Workwear',       query: "workwear that doesn't feel boring" },
]

export default function Home() {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const router = useRouter()

  function handleSearch(q: string) {
    if (!q.trim()) return
    router.push(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="min-h-screen bg-[--bg] flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-20 bg-white border-b border-black/[0.06]"
        style={{ animation: 'fadeDown 0.6s ease both' }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 h-20 flex items-center">
          <Image src="/Logo.svg" alt="Kmart" width={130} height={41} priority />
        </div>
      </header>

      {/* Main — vertically centred search */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div
          className="w-full max-w-xl"
          style={{ animation: 'fadeUp 0.7s 0.1s ease both', opacity: 0 }}
        >
          <h1
            className="font-sans font-bold text-[#1a1a1a] mb-8 leading-[1.1]"
            style={{ fontSize: 'clamp(28px, 5vw, 48px)' }}
          >
            Find your complete look.
          </h1>

          <form
            onSubmit={e => { e.preventDefault(); handleSearch(query) }}
            className="flex w-full bg-white border overflow-hidden transition-all duration-200
                       focus-within:shadow-[0_0_0_3px_rgba(23,104,176,0.1)]
                       border-black/[0.2] rounded-[10px] focus-within:border-[#1768B0]"
          >
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={focused ? 'e.g. smart casual for a job interview' : 'What are you looking for?'}
              className="flex-1 min-w-0 bg-transparent border-none outline-none px-6 py-[18px]
                         text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.35)]"
              style={{ fontSize: '16px', zoom: 0.875 }}
            />
            <button
              type="submit"
              className="shrink-0 px-7 text-white flex items-center justify-center
                         border-none cursor-pointer transition-all hover:brightness-90 active:scale-[0.98]"
              style={{ background: '#1768B0' }}
            >
              <i className="fa-solid fa-wand-magic-sparkles text-[15px]" />
            </button>
          </form>

          {/* Occasion tiles */}
          <div
            className="mt-8"
            style={{ animation: 'fadeUp 0.5s 0.3s ease both', opacity: 0 }}
          >
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] mb-3">
              Popular occasions
            </p>
            <div className="flex flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-x-visible scrollbar-hide gap-2 pb-1">
              {OCCASION_TILES.map(tile => (
                <button
                  key={tile.label}
                  type="button"
                  onClick={() => handleSearch(tile.query)}
                  className="flex-shrink-0 px-4 py-2 bg-white transition-all duration-150 cursor-pointer active:scale-[0.98]
                             border border-[#1768B0] rounded-full text-sm font-normal text-[#1768B0]
                             hover:bg-[#1768B0] hover:text-white"
                >
                  {tile.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
