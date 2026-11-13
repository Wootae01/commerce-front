import { Link } from 'react-router'
import type { ProductSummary } from '../api/types'
import { Price } from '../ui/Price'
import { ProductImage } from './ProductImage'

type ProductCardProps = {
  product: ProductSummary
  // 크게: 홈의 추천 1순위
  large?: boolean
  // 판매량 순위. 인기 상품처럼 순서가 정보일 때만 넘긴다
  rank?: number
  className?: string
}

export function ProductCard({ product, large = false, rank, className = '' }: ProductCardProps) {
  return (
    // 큰 카드는 두 줄 높이를 사진이 채우고(1fr), 이름·가격은 아래에 붙는다
    <Link
      to={`/products/${product.id}`}
      className={`group grid gap-2 ${large ? 'md:grid-rows-[1fr_auto]' : 'content-start'} ${className}`}
    >
      <ProductImage
        src={product.mainImageUrl}
        className={large ? 'aspect-[4/5] md:aspect-auto md:h-full md:min-h-0' : 'aspect-square'}
      />
      <div className={`grid gap-1 ${large ? 'md:gap-2' : ''}`}>
        <p className={`flex gap-2 ${large ? 'text-lead' : 'text-small'} group-hover:underline underline-offset-4`}>
          {rank !== undefined && (
            <span className="num font-bold" aria-label={`${rank}위`}>
              {rank}
            </span>
          )}
          <span>{product.name}</span>
        </p>
        <Price value={product.price} size={large ? 'headline' : 'lead'} />
      </div>
    </Link>
  )
}
