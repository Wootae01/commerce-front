import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { OrderDetail, PaymentResult } from '../api/types'

export const ordersListKey = ['orders', 'list'] as const

export function useOrderDetail(orderNumber: string) {
  return useQuery({
    queryKey: ['orders', orderNumber, 'detail'],
    queryFn: async () => (await api<OrderDetail>(`/api/orders/${encodeURIComponent(orderNumber)}`)).data,
  })
}

export const orderStatusKey = (orderNumber: string) => ['orders', orderNumber, 'status'] as const

// 상세 응답에는 주문 상태가 화면 문구로만 있어, 상태 코드(와 실패 이유)는 결제 결과 조회로 받는다
export function useOrderStatus(orderNumber: string) {
  return useQuery({
    queryKey: orderStatusKey(orderNumber),
    queryFn: async () => (await api<PaymentResult>(`/api/payments/${encodeURIComponent(orderNumber)}`)).data,
  })
}
