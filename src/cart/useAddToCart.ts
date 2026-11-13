import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Cart } from '../api/types'
import { cartQueryKey } from './useCart'

export type AddToCart = {
  productId: number
  optionId: number
  quantity: number
}

// 같은 옵션이 이미 담겨 있으면 백엔드가 수량을 더한다. 응답은 담은 뒤 장바구니 전체라 그대로 캐시에 넣는다
export function useAddToCart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (item: AddToCart) => (await api<Cart>('/api/cart/items', { method: 'POST', body: item })).data,
    onSuccess: (cart) => queryClient.setQueryData(cartQueryKey, cart),
  })
}
