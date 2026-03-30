'use client'

import { useEffect, useState } from 'react'

interface Props {
  chips: string[]
  onRefine: (chip: string) => void
}

export default function RefinementChips({ chips, onRefine }: Props) {
  const [displayed, setDisplayed] = useState<string[]>(() => chips.map(() => ''))
  const [complete, setComplete]   = useState<boolean[]>(() => chips.map(() => false))

  useEffect(() => {
    setDisplayed(chips.map(() => ''))
    setComplete(chips.map(() => false))
    let cancelled = false
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

    async function run() {
      await sleep(200)
      for (let i = 0; i < chips.length; i++) {
        if (cancelled) return
        if (i > 0) await sleep(120)
        for (let c = 1; c <= chips[i].length; c++) {
          if (cancelled) return
          const chipIdx = i
          const charCount = c
          setDisplayed(prev => {
            const next = [...prev]
            next[chipIdx] = chips[chipIdx].slice(0, charCount)
            return next
          })
          await sleep(35)
        }
        if (cancelled) return
        setComplete(prev => { const next = [...prev]; next[i] = true; return next })
      }
    }

    run()
    return () => { cancelled = true }
  }, [chips])

  return (
    <div
      className="max-w-[1600px] mx-auto px-4 sm:px-8 pb-4"
      style={{ animation: 'fadeUp 0.3s ease both' }}
    >
      <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[--text-subtle] mb-2.5">
        Refine your search
      </p>
      <div className="flex flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-x-visible scrollbar-hide gap-2 pb-1">
        {chips.map((chip, i) =>
          displayed[i].length > 0 ? (
            <button
              key={chip}
              type="button"
              onClick={() => onRefine(chip)}
              className="flex-shrink-0 px-4 py-2 bg-white border border-[#1768B0] rounded-full
                         text-sm text-[#1768B0] whitespace-nowrap
                         transition-colors duration-150 cursor-pointer
                         hover:bg-[#1768B0] hover:text-white
                         active:scale-[0.98]"
              style={{ animation: 'chipIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
            >
              {displayed[i]}
              {!complete[i] && <span className="chip-cursor">▋</span>}
            </button>
          ) : null
        )}
      </div>
    </div>
  )
}
