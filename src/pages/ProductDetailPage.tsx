import { useId, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import type { ProductDetail, ProductOption } from '../api/types'
import { signInUrl, useMe } from '../auth/auth'
import { useAddToCart } from '../cart/useAddToCart'
import { ProductImage } from '../products/ProductImage'
import { useProductDetail } from '../products/queries'
import { formatWon } from '../ui/format'
import { Price } from '../ui/Price'
import { QuantityStepper } from '../ui/QuantityStepper'

// 이 개수 이하로 남으면 남은 개수를 알려 준다
const LOW_STOCK = 5

export function ProductDetailPage() {
  const { id } = useParams()
  const product = useProductDetail(Number(id))

  if (product.isError) {
    const notFound = product.error instanceof ApiError && product.error.status === 404
    return notFound ? <ProductNotFound /> : <LoadFailed onRetry={() => product.refetch()} />
  }
  if (product.isPending) {
    return (
      <div className="page grid gap-8 pt-6 md:grid-cols-12 md:pt-10" aria-busy="true">
        <div className="aspect-[4/5] bg-shelf md:col-span-7" />
      </div>
    )
  }
  return <ProductView key={product.data.id} product={product.data} />
}

function ProductView({ product }: { product: ProductDetail }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn, isPending: mePending } = useMe()
  const addToCart = useAddToCart()

  // 옵션이 하나뿐이면(보통 '단품') 고르는 칸 없이 그 옵션으로 정한다
  const singleOption = product.options.length === 1 ? product.options[0] : null
  const [optionId, setOptionId] = useState<number | null>(
    singleOption && singleOption.stock > 0 ? singleOption.id : null,
  )
  const [quantity, setQuantity] = useState(1)

  const option = product.options.find((o) => o.id === optionId) ?? null
  const maxQuantity = option?.stock ?? 1
  const unitPrice = product.price + (option?.additionalPrice ?? 0)
  const soldOut = product.options.every((o) => o.stock === 0)
  const canBuy = option !== null && !mePending

  function chooseOption(next: ProductOption) {
    setOptionId(next.id)
    setQuantity((q) => Math.min(q, next.stock))
    addToCart.reset()
  }

  function requireLogin() {
    if (isLoggedIn) return true
    navigate(signInUrl(location.pathname))
    return false
  }

  function onAddToCart() {
    if (!option || !requireLogin()) return
    addToCart.mutate({ productId: product.id, optionId: option.id, quantity })
  }

  function onBuyNow() {
    if (!option || !requireLogin()) return
    const params = new URLSearchParams({
      productId: String(product.id),
      optionId: String(option.id),
      quantity: String(quantity),
    })
    navigate(`/checkout?${params}`)
  }

  const extraImages = product.images.filter((src) => src && src !== product.mainImageUrl)

  return (
    <article className="page grid gap-8 pt-6 md:grid-cols-12 md:gap-10 md:pt-10">
      <div className="grid content-start gap-4 md:col-span-7">
        <ProductImage src={product.mainImageUrl} className="aspect-[4/5]" />
        {extraImages.map((src) => (
          <ProductImage key={src} src={src} className="aspect-[4/5]" />
        ))}
      </div>

      <div className="grid content-start gap-8 md:sticky md:top-6 md:col-span-5 md:self-start">
        <header className="grid gap-3">
          <h1 className="text-title font-bold tracking-[-0.03em] md:text-headline">{product.name}</h1>
          <Price value={product.price} size="display" />
          {product.description && <p className="max-w-prose text-body text-graphite">{product.description}</p>}
        </header>

        {product.options.length > 1 && (
          <OptionPicker options={product.options} selectedId={optionId} onChoose={chooseOption} />
        )}

        {soldOut ? (
          <p className="rounded-control bg-shelf px-4 py-3 text-body font-medium">품절된 상품입니다.</p>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <span className="text-small font-medium">수량</span>
            <QuantityStepper
              value={quantity}
              max={maxQuantity}
              disabled={option === null}
              onChange={(next) => {
                setQuantity(next)
                addToCart.reset()
              }}
            />
          </div>
        )}

        <div className="grid gap-4 border-t border-ink pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-body font-medium">합계</span>
            <output aria-label="합계" className="text-right">
              <Price value={unitPrice * quantity} size="title" />
            </output>
          </div>
          {option === null && !soldOut && <p className="text-small text-graphite">옵션을 선택해 주세요.</p>}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onAddToCart}
              disabled={!canBuy || addToCart.isPending}
              className="h-12 rounded-control border border-ink font-medium disabled:border-rule disabled:text-graphite"
            >
              장바구니에 담기
            </button>
            <button
              type="button"
              onClick={onBuyNow}
              disabled={!canBuy}
              className="h-12 rounded-control bg-ink font-medium text-paper disabled:bg-rule disabled:text-graphite"
            >
              바로구매
            </button>
          </div>

          <div aria-live="polite">
            {addToCart.isSuccess && (
              <p role="status" className="flex flex-wrap items-baseline justify-between gap-2 rounded-control bg-success-bg px-4 py-3 text-small text-success">
                <span>장바구니에 담았습니다.</span>
                <Link to="/cart" className="font-medium underline underline-offset-4">
                  장바구니 보기
                </Link>
              </p>
            )}
            {addToCart.isError && (
              <p role="alert" className="rounded-control bg-danger-bg px-4 py-3 text-small text-danger">
                {addToCart.error.message || '장바구니에 담지 못했습니다. 다시 시도해 주세요.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function OptionPicker({
  options,
  selectedId,
  onChoose,
}: {
  options: ProductOption[]
  selectedId: number | null
  onChoose: (option: ProductOption) => void
}) {
  const labelId = useId()
  return (
    <div className="grid gap-2">
      <p id={labelId} className="text-small font-medium">
        옵션
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="grid border-t border-rule">
        {options.map((option) => {
          const outOfStock = option.stock === 0
          return (
            <label
              key={option.id}
              className={`flex min-h-12 items-center gap-3 border-b border-rule py-2 ${
                outOfStock ? 'text-graphite' : 'cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name="option"
                checked={selectedId === option.id}
                disabled={outOfStock}
                onChange={() => onChoose(option)}
                className="size-4 accent-ink"
              />
              <span className={`flex-1 ${outOfStock ? 'line-through' : ''}`}>{option.name}</span>
              {option.additionalPrice > 0 && (
                <span className="num text-small">+{formatWon(option.additionalPrice)}원</span>
              )}
              {outOfStock ? (
                <span className="text-small">품절</span>
              ) : (
                option.stock <= LOW_STOCK && <span className="text-small text-pending">{option.stock}개 남음</span>
              )}
            </label>
          )
        })}
      </div>
    </div>
  )
}

function ProductNotFound() {
  return (
    <section className="page grid gap-6 pt-16 md:pt-24">
      <h1 className="text-headline font-bold tracking-[-0.03em]">상품을 찾을 수 없습니다</h1>
      <p className="max-w-prose text-lead text-graphite">판매가 끝났거나 주소가 잘못되었습니다.</p>
      <div>
        <Link to="/products" className="inline-flex h-12 items-center rounded-control bg-ink px-6 font-medium text-paper">
          전체 상품 보기
        </Link>
      </div>
    </section>
  )
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="page grid justify-items-start gap-4 pt-16">
      <p className="text-lead">상품을 불러오지 못했습니다. 잠시 뒤 다시 불러와 주세요.</p>
      <button type="button" onClick={onRetry} className="h-10 rounded-control border border-ink px-4 text-small font-medium">
        다시 불러오기
      </button>
    </section>
  )
}
