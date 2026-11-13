import { X } from 'lucide-react'
import { useId } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import type { Cart, CartItem } from '../api/types'
import { signInUrl, useMe } from '../auth/auth'
import { useRemoveCartItem, useSelectAll, useUpdateCartItem } from '../cart/cartMutations'
import { useCart } from '../cart/useCart'
import { ProductImage } from '../products/ProductImage'
import { Price } from '../ui/Price'
import { QuantityStepper } from '../ui/QuantityStepper'

// 장바구니 수량에는 재고 정보가 없다. 재고는 결제할 때 백엔드가 확인한다
const MAX_QUANTITY = 99

export function CartPage() {
  const { isLoggedIn, isPending: mePending } = useMe()
  const cart = useCart()

  if (mePending) return null
  if (!isLoggedIn) return <Navigate to={signInUrl('/cart')} replace />

  return (
    <div className="page grid gap-8 pt-6 md:pt-10">
      <h1 className="text-headline font-bold tracking-[-0.03em]">장바구니</h1>
      {cart.isError ? (
        <div className="grid justify-items-start gap-3">
          <p className="text-body">장바구니를 불러오지 못했습니다. 잠시 뒤 다시 불러와 주세요.</p>
          <button
            type="button"
            onClick={() => cart.refetch()}
            className="h-10 rounded-control border border-ink px-4 text-small font-medium"
          >
            다시 불러오기
          </button>
        </div>
      ) : cart.isPending ? (
        <div className="h-40 bg-shelf" aria-busy="true" />
      ) : cart.data.items.length === 0 ? (
        <EmptyCart />
      ) : (
        <CartContents cart={cart.data} />
      )}
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="grid justify-items-start gap-4 border-t border-ink pt-6">
      <p className="text-lead">장바구니가 비어 있습니다.</p>
      <Link to="/products" className="inline-flex h-12 items-center rounded-control bg-ink px-6 font-medium text-paper">
        상품 보러 가기
      </Link>
    </div>
  )
}

function CartContents({ cart }: { cart: Cart }) {
  const navigate = useNavigate()
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const selectAll = useSelectAll()
  const busy = update.isPending || remove.isPending || selectAll.isPending
  const failed = update.error ?? remove.error ?? selectAll.error

  const selectedCount = cart.items.filter((item) => item.checked).length
  const allSelected = selectedCount === cart.items.length

  // 같은 상품을 옵션만 달리 담았으면 옵션 이름까지 붙여 구분한다
  const labelOf = (item: CartItem) =>
    cart.items.filter((other) => other.name === item.name).length > 1 ? `${item.name} ${item.optionName ?? ''}`.trim() : item.name

  return (
    <div className="grid gap-10 md:grid-cols-12 md:gap-10">
      <section className="grid content-start md:col-span-8" aria-label="담은 상품">
        <div className="flex items-center gap-3 border-b border-ink pb-3">
          <input
            id="select-all"
            type="checkbox"
            checked={allSelected}
            disabled={busy}
            onChange={() => selectAll.mutate({ cart, checked: !allSelected })}
            className="size-5 accent-ink"
          />
          <label htmlFor="select-all" className="text-small font-medium">
            전체 선택
          </label>
          <span className="num text-small text-graphite">
            {selectedCount}/{cart.items.length}
          </span>
        </div>

        <ul>
          {cart.items.map((item) => (
            <CartRow
              key={item.id}
              item={item}
              label={labelOf(item)}
              disabled={busy}
              onCheck={(checked) => update.mutate({ id: item.id, checked })}
              onQuantity={(quantity) => update.mutate({ id: item.id, quantity })}
              onRemove={() => remove.mutate(item.id)}
            />
          ))}
        </ul>

        {failed && (
          <p role="alert" className="mt-4 rounded-control bg-danger-bg px-4 py-3 text-small text-danger">
            {failed.message || '장바구니를 바꾸지 못했습니다. 다시 시도해 주세요.'}
          </p>
        )}
      </section>

      <aside className="grid content-start gap-4 md:sticky md:top-6 md:col-span-4 md:self-start">
        <div className="grid gap-2 border-t border-ink pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-medium">상품 합계</span>
            <output aria-label="상품 합계">
              <Price value={cart.productsTotal} size="headline" />
            </output>
          </div>
          <p className="text-small text-graphite">배송비는 주문서에서 더해집니다.</p>
        </div>
        <button
          type="button"
          disabled={selectedCount === 0 || busy}
          onClick={() => navigate('/checkout')}
          className="h-12 rounded-control bg-ink font-medium text-paper disabled:bg-rule disabled:text-graphite"
        >
          선택한 상품 {selectedCount}개 주문하기
        </button>
      </aside>
    </div>
  )
}

function CartRow({
  item,
  label,
  disabled,
  onCheck,
  onQuantity,
  onRemove,
}: {
  item: CartItem
  label: string
  disabled: boolean
  onCheck: (checked: boolean) => void
  onQuantity: (quantity: number) => void
  onRemove: () => void
}) {
  const nameId = useId()
  const checkboxId = useId()

  return (
    <li aria-labelledby={nameId} className="flex gap-3 border-b border-rule py-4">
      <input
        id={checkboxId}
        type="checkbox"
        aria-label={`${label} 선택`}
        checked={item.checked}
        disabled={disabled}
        onChange={(event) => onCheck(event.target.checked)}
        className="mt-1 size-5 shrink-0 accent-ink"
      />
      <ProductImage src={item.mainImageUrl} className="size-20 shrink-0" />
      <div className="grid flex-1 gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <label id={nameId} htmlFor={checkboxId} className="text-body">
              {item.name}
            </label>
            <p className="text-small text-graphite">
              {item.optionName && <span>{item.optionName}</span>}{' '}
              <Price value={item.price} size="body" className="text-graphite" />
            </p>
          </div>
          <button
            type="button"
            aria-label={`${label} 삭제`}
            disabled={disabled}
            onClick={onRemove}
            className="flex size-8 shrink-0 items-center justify-center rounded-control text-graphite hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <QuantityStepper
            value={item.quantity}
            max={MAX_QUANTITY}
            label={`${label} 수량`}
            disabled={disabled}
            onChange={onQuantity}
          />
          <output aria-label="상품별 합계">
            <Price value={item.price * item.quantity} size="lead" />
          </output>
        </div>
      </div>
    </li>
  )
}
