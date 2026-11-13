import type { OrderStatus } from '../api/types'

// 주문 상태 이름은 GLOSSARY.md와 백엔드 OrderStatus 문구를 따른다
const LABEL: Record<OrderStatus, string> = {
  READY: '결제 준비',
  PAYMENT_PENDING: '결제 확인 중',
  PAYMENT_FAILED: '결제 실패',
  PAID: '결제완료',
  PREPARING: '배송준비',
  SHIPPING: '배송중',
  CANCEL_REQUESTED: '취소 처리 중',
  CANCELED: '취소완료',
  DELIVERED: '배송완료',
}

export function orderStatusLabel(status: OrderStatus) {
  return LABEL[status]
}

// 백엔드는 결제완료(PAID) 주문만 사용자 취소를 받는다
export function canCancel(status: OrderStatus) {
  return status === 'PAID'
}

// "2026-11-13T15:20:42" → "2026.11.13"
export function formatOrderDate(value: string) {
  return value.slice(0, 10).replaceAll('-', '.')
}
