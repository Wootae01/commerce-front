import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { api, ApiError } from '../api/client'
import type { CancelResult, OrderDetail, OrderStatus } from '../api/types'
import { signInUrl, useMe } from '../auth/auth'
import { OrderStatusBadge } from '../orders/OrderStatusBadge'
import { orderStatusKey, ordersListKey, useOrderDetail, useOrderStatus } from '../orders/queries'
import { canCancel, formatOrderDate } from '../orders/status'
import { ProductImage } from '../products/ProductImage'
import { formatWon } from '../ui/format'
import { Price } from '../ui/Price'

export function OrderDetailPage() {
  const { orderNumber = '' } = useParams()
  const location = useLocation()
  const { isLoggedIn, isPending: mePending } = useMe()
  const detail = useOrderDetail(orderNumber)
  const status = useOrderStatus(orderNumber)

  if (mePending) return null
  if (!isLoggedIn) return <Navigate to={signInUrl(location.pathname)} replace />

  if (detail.isError) {
    const notFound = detail.error instanceof ApiError && detail.error.status === 404
    return (
      <section className="page grid justify-items-start gap-6 pt-16 md:pt-24">
        <h1 className="text-headline font-bold tracking-[-0.03em]">
          {notFound ? '주문을 찾을 수 없습니다' : '주문을 불러오지 못했습니다'}
        </h1>
        {notFound ? (
          <Link to="/orders" className="inline-flex h-12 items-center rounded-control bg-ink px-6 font-medium text-paper">
            주문내역 보기
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => detail.refetch()}
            className="h-10 rounded-control border border-ink px-4 text-small font-medium"
          >
            다시 불러오기
          </button>
        )}
      </section>
    )
  }
  if (detail.isPending) {
    return <div className="page pt-10"><div className="h-40 bg-shelf" aria-busy="true" /></div>
  }

  return (
    <OrderView
      order={detail.data}
      status={status.data?.orderStatus}
      failureMessage={detail.data.paymentInfo.failureMessage ?? status.data?.failureMessage ?? null}
      onRecheck={() => status.refetch()}
    />
  )
}

function OrderView({
  order,
  status,
  failureMessage,
  onRecheck,
}: {
  order: OrderDetail
  status: OrderStatus | undefined
  failureMessage: string | null
  onRecheck: () => void
}) {
  const { shippingInfo, paymentInfo, orderPrice } = order
  // 취소 응답. 취소완료면 상태가 바뀌어 취소 버튼이 사라지므로 안내는 여기서 보여 준다
  const [canceled, setCanceled] = useState<CancelResult | null>(null)

  return (
    <article className="page grid gap-10 pt-6 md:grid-cols-12 md:pt-10">
      <header className="grid gap-2 md:col-span-12">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-headline font-bold tracking-[-0.03em]">주문 상세</h1>
          {status && <OrderStatusBadge status={status} />}
        </div>
        <p className="flex flex-wrap gap-x-6 gap-y-1 text-small text-graphite">
          <span>
            주문일 <span className="num text-ink">{formatOrderDate(order.orderDate)}</span>
          </span>
          <span>
            주문번호 <span className="num break-all text-ink">{order.orderNumber}</span>
          </span>
        </p>
      </header>

      <div className="grid content-start gap-10 md:col-span-8">
        {canceled?.orderStatus === 'CANCELED' && (
          <p role="status" className="rounded-control bg-success-bg px-4 py-3 text-body text-success">
            주문을 취소했습니다. {formatWon(canceled.cancelAmount)}원을 {canceled.refundMethod ?? '결제 수단'}로 환불합니다.
          </p>
        )}
        {status === 'CANCEL_REQUESTED' && <CancelProcessing onRecheck={onRecheck} />}
        {status === 'PAYMENT_FAILED' && failureMessage && (
          <p className="rounded-control bg-danger-bg px-4 py-3 text-body text-danger">{failureMessage}</p>
        )}

        <Section title="주문 상품">
          <ul aria-label="주문 상품">
            {order.orderItems.map((item) => (
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
        </Section>

        <Section title="배송지">
          <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-body">
            <dt className="text-small text-graphite">받는 사람</dt>
            <dd>{shippingInfo.receiverName}</dd>
            <dt className="text-small text-graphite">연락처</dt>
            <dd className="num">{shippingInfo.receiverPhone}</dd>
            <dt className="text-small text-graphite">주소</dt>
            <dd>{[shippingInfo.address, shippingInfo.addressDetail].filter(Boolean).join(' ')}</dd>
            {shippingInfo.requestMessage && (
              <>
                <dt className="text-small text-graphite">요청 사항</dt>
                <dd>{shippingInfo.requestMessage}</dd>
              </>
            )}
          </dl>
        </Section>
      </div>

      <aside className="grid content-start gap-4 md:sticky md:top-6 md:col-span-4 md:self-start">
        <dl className="grid grid-cols-[1fr_auto] items-baseline gap-y-2 border-t border-ink pt-4">
          <dt className="text-small text-graphite">상품 합계</dt>
          <dd className="text-right">
            <Price value={orderPrice.productsTotal} size="body" />
          </dd>
          <dt className="text-small text-graphite">배송비</dt>
          <dd className="text-right">
            <Price value={orderPrice.deliveryFee} size="body" />
          </dd>
          <dt className="border-t border-rule pt-3 font-medium">결제 금액</dt>
          <dd aria-label="결제 금액" className="border-t border-rule pt-3 text-right">
            <Price value={orderPrice.finalPrice} size="headline" />
          </dd>
          {paymentInfo.paymentMethod && (
            <>
              <dt className="text-small text-graphite">결제 수단</dt>
              <dd className="text-right">{paymentInfo.paymentMethod}</dd>
            </>
          )}
        </dl>
        {status && canCancel(status) && <CancelOrder order={order} onCanceled={setCanceled} />}
      </aside>
    </article>
  )
}

// 주문 취소: 결제가 끝난 주문을 취소해 환불받는다. 한 번 더 확인한 뒤 요청한다
function CancelOrder({ order, onCanceled }: { order: OrderDetail; onCanceled: (result: CancelResult) => void }) {
  const queryClient = useQueryClient()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function cancel() {
    setBusy(true)
    setFailure(null)
    try {
      const { data } = await api<CancelResult>(`/api/orders/${encodeURIComponent(order.orderNumber)}/cancel`, {
        method: 'POST',
      })
      // 200 취소완료든 202 취소 처리 중이든, 화면은 새로 받은 주문 상태로 그린다
      onCanceled(data)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderStatusKey(order.orderNumber) }),
        queryClient.invalidateQueries({ queryKey: ordersListKey }),
      ])
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : '주문을 취소하지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  if (!asking) {
    return (
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="h-12 rounded-control border border-ink font-medium"
        >
          주문 취소
        </button>
      </div>
    )
  }

  return (
    <div className="grid gap-3 rounded-control border border-ink p-4">
      <p className="text-body">
        주문을 취소하면 결제한 <span className="num font-bold">{formatWon(order.orderPrice.finalPrice)}원</span>을
        환불합니다. 취소할까요?
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="h-12 rounded-control bg-ink font-medium text-paper disabled:bg-rule disabled:text-graphite"
        >
          주문 취소하기
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={busy}
          className="h-12 rounded-control border border-rule font-medium"
        >
          그만두기
        </button>
      </div>
      {failure && (
        <p role="alert" className="rounded-control bg-danger-bg px-4 py-3 text-small text-danger">
          {failure}
        </p>
      )}
    </div>
  )
}

// 취소 처리 중: 토스에 취소를 요청했지만 결과를 아직 모른다. 백엔드가 같은 요청으로 다시 확인해 끝낸다
function CancelProcessing({ onRecheck }: { onRecheck: () => void }) {
  return (
    <div className="grid justify-items-start gap-3 rounded-control bg-pending-bg px-4 py-3 text-pending">
      <p className="text-body">
        취소를 요청했고 환불 결과를 확인하고 있습니다. 다시 취소하지 마세요. 잠시 뒤 결과를 확인해 주세요.
      </p>
      <button
        type="button"
        onClick={onRecheck}
        className="h-10 rounded-control border border-pending px-4 text-small font-medium"
      >
        결과 다시 확인
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="border-b border-ink pb-2 text-title font-bold">{title}</h2>
      {children}
    </section>
  )
}
