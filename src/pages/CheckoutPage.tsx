import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import { api, ApiError } from '../api/client'
import type { Checkout, PreparedOrder } from '../api/types'
import { signInUrl, useMe } from '../auth/auth'
import { isUserCancel, mountPaymentWidget, type PaymentWidget } from '../payment/tossWidget'
import { ProductImage } from '../products/ProductImage'
import { formatWon } from '../ui/format'
import { Price } from '../ui/Price'

// 바로구매면 주소에 상품·옵션·수량이 있고, 없으면 장바구니에서 고른 상품으로 하는 장바구니 주문이다
type BuyNow = { productId: number; optionId: number; quantity: number }

function readBuyNow(params: URLSearchParams): BuyNow | null {
  const productId = Number(params.get('productId'))
  const optionId = Number(params.get('optionId'))
  const quantity = Number(params.get('quantity'))
  if (![productId, optionId, quantity].every((n) => Number.isInteger(n) && n > 0)) return null
  return { productId, optionId, quantity }
}

export function CheckoutPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const { isLoggedIn, isPending: mePending } = useMe()
  const buyNow = readBuyNow(params)

  const checkout = useQuery({
    queryKey: ['checkout', buyNow ?? 'cart'],
    queryFn: async () =>
      buyNow
        ? (await api<Checkout>('/api/orders/checkout/buy-now', { query: buyNow })).data
        : (await api<Checkout>('/api/orders/checkout/cart')).data,
    enabled: isLoggedIn,
    staleTime: 0,
    gcTime: 0,
  })

  if (mePending) return null
  if (!isLoggedIn) return <Navigate to={signInUrl(location.pathname + location.search)} replace />

  return (
    <div className="page grid gap-8 pt-6 md:pt-10">
      <h1 className="text-headline font-bold tracking-[-0.03em]">주문서</h1>
      {checkout.isError ? (
        <Message text={checkout.error.message || '주문서를 불러오지 못했습니다.'}>
          <button
            type="button"
            onClick={() => checkout.refetch()}
            className="h-10 rounded-control border border-ink px-4 text-small font-medium"
          >
            다시 불러오기
          </button>
        </Message>
      ) : checkout.isPending ? (
        <div className="h-40 bg-shelf" aria-busy="true" />
      ) : checkout.data.items.length === 0 ? (
        <Message text="주문할 상품이 없습니다.">
          <Link to="/cart" className="inline-flex h-12 items-center rounded-control bg-ink px-6 font-medium text-paper">
            장바구니로 가기
          </Link>
        </Message>
      ) : (
        <CheckoutForm checkout={checkout.data} buyNow={buyNow} onPriceChanged={() => checkout.refetch()} />
      )}
    </div>
  )
}

type Receiver = { name: string; phone: string; address: string; addressDetail: string; requestNote: string }
type ReceiverErrors = Partial<Record<keyof Receiver, string>>

// 백엔드 OrderCreateRequestDTO 검증과 같은 규칙. 연락처는 하이픈·공백을 빼고 본다
const onlyDigits = (value: string) => value.replace(/[\s-]/g, '')

function validate(receiver: Receiver): ReceiverErrors {
  const errors: ReceiverErrors = {}
  if (!receiver.name.trim()) errors.name = '받는 사람을 적어 주세요.'
  if (!/^010\d{8}$/.test(onlyDigits(receiver.phone))) errors.phone = '010으로 시작하는 숫자 11자리로 적어 주세요.'
  if (!receiver.address.trim()) errors.address = '주소를 적어 주세요.'
  if (!receiver.addressDetail.trim()) errors.addressDetail = '상세 주소를 적어 주세요.'
  return errors
}

function CheckoutForm({
  checkout,
  buyNow,
  onPriceChanged,
}: {
  checkout: Checkout
  buyNow: BuyNow | null
  onPriceChanged: () => void
}) {
  const { orderer, orderPrice } = checkout
  const [receiver, setReceiver] = useState<Receiver>({
    name: orderer.name ?? '',
    phone: orderer.phone ?? '',
    address: orderer.address ?? '',
    addressDetail: orderer.addressDetail ?? '',
    requestNote: '',
  })
  const [errors, setErrors] = useState<ReceiverErrors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const widget = useRef<PaymentWidget | null>(null)
  const [widgetFailed, setWidgetFailed] = useState(false)

  const methodsId = `payment-methods-${useId().replace(/:/g, '')}`
  const agreementId = `payment-agreement-${useId().replace(/:/g, '')}`

  // 위젯은 처음 연 주문서 값으로 한 번만 그린다. 결제 금액이 바뀌면 아래 effect가 금액만 바꾼다
  const mountOptions = useRef({
    clientKey: checkout.tossClientKey,
    customerKey: orderer.customerKey,
    amount: orderPrice.finalPrice,
    methodsSelector: `#${methodsId}`,
    agreementSelector: `#${agreementId}`,
  })

  // 결제 수단·약관은 토스가 그린다. 화면을 떠나거나(개발 모드의 두 번 실행 포함) 다시 그릴 때는 먼저 지운다
  useEffect(() => {
    let cancelled = false
    let mounted: PaymentWidget | null = null
    mountPaymentWidget(mountOptions.current)
      .then((created) => {
        if (cancelled) {
          void created.destroy()
          return
        }
        mounted = created
        widget.current = created
      })
      .catch(() => {
        if (!cancelled) setWidgetFailed(true)
      })
    return () => {
      cancelled = true
      widget.current = null
      void mounted?.destroy()
    }
  }, [])

  useEffect(() => {
    widget.current?.setAmount(orderPrice.finalPrice)
  }, [orderPrice.finalPrice])

  function change(field: keyof Receiver, value: string) {
    setReceiver((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFailure(null)

    const found = validate(receiver)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    if (!widget.current) {
      setFailure('결제 수단을 불러오는 중입니다. 잠시 뒤 다시 눌러 주세요.')
      return
    }

    setPaying(true)
    try {
      const body = {
        orderType: checkout.orderType,
        ...(buyNow ?? { cartProductIds: checkout.items.map((item) => item.id) }),
        customerKey: orderer.customerKey,
        name: receiver.name.trim(),
        phone: onlyDigits(receiver.phone),
        address: receiver.address.trim(),
        addressDetail: receiver.addressDetail.trim(),
        requestNote: receiver.requestNote.trim(),
      }
      const prepared = (await api<PreparedOrder>('/api/orders', { method: 'POST', body })).data

      // 주문서를 연 뒤 가격이나 배송비가 바뀌었으면, 바뀐 금액을 보여 주고 다시 결제하게 한다
      if (prepared.amount !== orderPrice.finalPrice) {
        setFailure(
          `결제 금액이 ${formatWon(prepared.amount)}원으로 바뀌었습니다. 주문서를 다시 확인한 뒤 결제해 주세요.`,
        )
        onPriceChanged()
        return
      }

      await widget.current.setAmount(prepared.amount)
      await widget.current.requestPayment({
        orderId: prepared.orderId,
        orderName: prepared.orderName,
        customerName: prepared.customerName,
        customerMobilePhone: prepared.customerMobilePhone,
      })
    } catch (error) {
      if (isUserCancel(error)) return
      setFailure(
        error instanceof ApiError
          ? error.message
          : '결제를 시작하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
      )
    } finally {
      setPaying(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-10 md:grid-cols-12">
      <div className="grid content-start gap-10 md:col-span-8">
        <section className="grid gap-3">
          <h2 className="border-b border-ink pb-2 text-title font-bold">주문 상품</h2>
          <ul aria-label="주문 상품">
            {checkout.items.map((item) => (
              <li key={item.id} className="flex gap-3 border-b border-rule py-3">
                <ProductImage src={item.mainImageUrl} className="size-16 shrink-0" />
                <div className="grid flex-1 gap-1">
                  <p className="text-body">{item.name}</p>
                  <p className="text-small text-graphite">
                    {item.optionName} <span className="num">{formatWon(item.unitPrice)}원 × {item.quantity}</span>
                  </p>
                </div>
                <Price value={item.lineTotal} size="body" />
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4">
          <h2 className="border-b border-ink pb-2 text-title font-bold">배송지</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="받는 사람" value={receiver.name} error={errors.name} onChange={(v) => change('name', v)} autoComplete="name" />
            <Field
              label="연락처"
              value={receiver.phone}
              error={errors.phone}
              onChange={(v) => change('phone', v)}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="01012345678"
            />
          </div>
          <Field
            label="주소"
            value={receiver.address}
            error={errors.address}
            onChange={(v) => change('address', v)}
            autoComplete="street-address"
          />
          <Field
            label="상세 주소"
            value={receiver.addressDetail}
            error={errors.addressDetail}
            onChange={(v) => change('addressDetail', v)}
          />
          <Field
            label="요청 사항"
            value={receiver.requestNote}
            onChange={(v) => change('requestNote', v)}
            placeholder="선택"
          />
        </section>

        <section className="grid gap-3">
          <h2 className="border-b border-ink pb-2 text-title font-bold">결제 수단</h2>
          {widgetFailed && (
            <p className="text-small text-danger">결제 수단을 불러오지 못했습니다. 페이지를 새로 고쳐 주세요.</p>
          )}
          <div id={methodsId} />
          <div id={agreementId} />
        </section>
      </div>

      <aside className="grid content-start gap-4 md:sticky md:top-6 md:col-span-4 md:self-start">
        <dl className="grid grid-cols-[1fr_auto] items-baseline gap-y-2 border-t border-ink pt-4">
          <dt className="text-small text-graphite">상품 합계</dt>
          <dd aria-label="상품 합계" className="text-right">
            <Price value={orderPrice.productsTotal} size="body" />
          </dd>
          <dt className="text-small text-graphite">배송비</dt>
          <dd aria-label="배송비" className="text-right">
            <Price value={orderPrice.deliveryFee} size="body" />
          </dd>
          <dt className="border-t border-rule pt-3 font-medium">결제 금액</dt>
          <dd aria-label="결제 금액" className="border-t border-rule pt-3 text-right">
            <Price value={orderPrice.finalPrice} size="headline" />
          </dd>
        </dl>
        <button
          type="submit"
          disabled={paying}
          className="h-12 rounded-control bg-ink font-medium text-paper disabled:bg-rule disabled:text-graphite"
        >
          {formatWon(orderPrice.finalPrice)}원 결제하기
        </button>
        {failure && (
          <p role="alert" className="rounded-control bg-danger-bg px-4 py-3 text-small text-danger">
            {failure}
          </p>
        )}
      </aside>
    </form>
  )
}

function Field({
  label,
  value,
  error,
  onChange,
  type = 'text',
  ...input
}: {
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
  type?: string
  inputMode?: 'numeric'
  autoComplete?: string
  placeholder?: string
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-small font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`h-11 rounded-control border px-3 text-body outline-none focus:border-ink ${
          error ? 'border-danger' : 'border-rule'
        }`}
        {...input}
      />
      {error && (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function Message({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className="grid justify-items-start gap-4 border-t border-ink pt-6">
      <p className="text-lead">{text}</p>
      {children}
    </div>
  )
}
