import type { OrderStatus } from '../api/types'
import { orderStatusLabel } from './status'

// 색은 상태를 알릴 때만: 결과를 기다리는 중(주황), 결제 실패(빨강), 끝난 주문(회색)
const TONE: Partial<Record<OrderStatus, string>> = {
  PAYMENT_PENDING: 'bg-pending-bg text-pending',
  CANCEL_REQUESTED: 'bg-pending-bg text-pending',
  PAYMENT_FAILED: 'bg-danger-bg text-danger',
  CANCELED: 'bg-shelf text-graphite',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-control px-2 py-0.5 text-small font-medium ${TONE[status] ?? 'bg-ink text-paper'}`}>
      {orderStatusLabel(status)}
    </span>
  )
}
