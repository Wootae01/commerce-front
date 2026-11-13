import { formatWon } from './format'

type PriceProps = {
  value: number
  // 목록은 lead, 상품 상세·결제 금액은 headline 이상
  size?: 'body' | 'lead' | 'title' | 'headline' | 'display'
  className?: string
}

const sizeClass: Record<NonNullable<PriceProps['size']>, string> = {
  body: 'text-body',
  lead: 'text-lead',
  title: 'text-title',
  headline: 'text-headline',
  display: 'text-display',
}

// 이 가게에서 가장 눈에 띄는 요소. 숫자는 넓고 굵게, 원은 한 단계 작게 붙인다
export function Price({ value, size = 'lead', className = '' }: PriceProps) {
  const text = formatWon(value)
  return (
    <span className={`inline-flex items-baseline gap-0.5 ${sizeClass[size]} ${className}`} aria-label={`${text}원`}>
      <span className="num font-bold" aria-hidden="true">
        {text}
      </span>
      <span className="text-[0.62em] font-medium" aria-hidden="true">
        원
      </span>
    </span>
  )
}
