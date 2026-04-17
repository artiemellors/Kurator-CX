import svgPaths from "./svg-9pozf3ngm3";

interface ButtonUniqueProps {
  label?: string
  onClick?: () => void
}

export default function ButtonUnique({ label = "Explore", onClick }: ButtonUniqueProps) {
  return (
    <button
      onClick={onClick}
      className="group content-stretch flex items-center overflow-clip relative rounded-[4px]"
    >
      <div className="flex gap-[4px] items-center py-[8px]">
        <span className="leading-[20px] text-[#1a374a] text-[14px] whitespace-nowrap">
          {label}
        </span>
        <div className="overflow-clip relative rounded-[2px] shrink-0 size-[16px]
                        transition-transform duration-200 group-hover:translate-x-[3px]">
          <div className="absolute inset-[20.92%_13.21%_20.75%_13.04%]">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.8 9.33333">
              <path d={svgPaths.p2191bc00} fill="#1A374A" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  )
}
