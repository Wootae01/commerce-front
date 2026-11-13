import { Minus, Plus } from 'lucide-react'

type QuantityStepperProps = {
  value: number
  max: number
  // 화면 읽기용 이름. 여러 개가 한 화면에 있으면(장바구니) 상품 이름을 붙여 구분한다
  label?: string
  disabled?: boolean
  onChange: (value: number) => void
}

// 수량은 1 ~ max. 버튼과 직접 입력 모두 이 범위로 맞춘다
export function QuantityStepper({ value, max, label = '수량', disabled = false, onChange }: QuantityStepperProps) {
  const clamp = (n: number) => Math.max(1, Math.min(max, Number.isFinite(n) ? Math.trunc(n) : 1))
  const buttonClass = 'flex size-10 items-center justify-center rounded-control border border-rule disabled:text-rule'

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${label} 줄이기`}
        disabled={disabled || value <= 1}
        onClick={() => onChange(clamp(value - 1))}
        className={buttonClass}
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={1}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(clamp(event.target.valueAsNumber))}
        className="num h-10 w-14 rounded-control border border-rule text-center font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label={`${label} 늘리기`}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className={buttonClass}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
