'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function Home() {
  const [query, setQuery]     = useState('')
  const [focused, setFocused] = useState(false)
  const router = useRouter()

  function handleSearch(q: string) {
    if (!q.trim()) return
    router.push(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="min-h-screen bg-[#f0f0f0] flex flex-col">

      {/* Header — logo + search bar */}
      <header
        className="sticky top-0 z-20 bg-white border-b border-black/[0.06]"
        style={{ animation: 'fadeDown 0.6s ease both' }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 h-16 flex items-center gap-4 sm:gap-6">
          <Image src="/Logo.svg" alt="Kmart" width={100} height={32} priority className="shrink-0" />
          <form
            onSubmit={e => { e.preventDefault(); handleSearch(query) }}
            className="flex flex-1 max-w-2xl bg-white border overflow-hidden transition-all duration-200
                       focus-within:shadow-[0_0_0_2px_rgba(23,104,176,0.1)]
                       border-black/[0.15] rounded-[8px] focus-within:border-[#1768B0]"
          >
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={focused ? 'e.g. smart casual for a job interview' : 'What are you looking for?'}
              className="flex-1 min-w-0 bg-transparent outline-none px-4 py-3 text-[#1a1a1a]
                         text-[14px] placeholder:text-[rgba(26,26,26,0.35)]"
              autoFocus
            />
            <button
              type="submit"
              className="shrink-0 px-4 text-white bg-[#1768B0] border-none cursor-pointer
                         hover:brightness-90 transition-all active:scale-[0.98]"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-[13px]" />
            </button>
          </form>
        </div>
      </header>

      {/* Wireframe page content */}
      <main
        className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6"
        style={{ animation: 'fadeUp 0.5s 0.15s ease both', opacity: 0 }}
      >

        {/* Hero banner placeholder */}
        <div className="w-full h-[180px] sm:h-[260px] rounded-xl bg-[#e0e0e0]" />

        {/* Category pill row */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {[96, 80, 112, 88, 104, 76, 96, 88].map((w, i) => (
            <div key={i} className="shrink-0 h-8 rounded-full bg-[#e0e0e0]" style={{ width: w }} />
          ))}
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="aspect-[4/5] w-full rounded-lg bg-[#e0e0e0]" />
              <div className="h-3 w-4/5 rounded bg-[#e0e0e0]" />
              <div className="h-3 w-3/5 rounded bg-[#e0e0e0]" />
              <div className="h-4 w-2/5 rounded bg-[#e0e0e0]" />
            </div>
          ))}
        </div>

      </main>
    </div>
  )
}
