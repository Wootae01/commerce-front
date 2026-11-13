import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Cart } from '../api/types'
import { cartQueryKey } from './useCart'

// 장바구니를 바꾸는 요청은 모두 바뀐 뒤 장바구니 전체를 돌려준다. 그 응답으로 캐시를 바꿔 다시 그린다
function useCartMutation<V>(request: (variables: V) => Promise<Cart>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (cart) => queryClient.setQueryData(cartQueryKey, cart),
  })
}

export function useUpdateCartItem() {
  return useCartMutation(
    async ({ id, ...change }: { id: number; quantity?: number; checked?: boolean }) =>
      (await api<Cart>(`/api/cart/items/${id}`, { method: 'PATCH', body: change })).data,
  )
}

export function useRemoveCartItem() {
  return useCartMutation(
    async (id: number) => (await api<Cart>(`/api/cart/items/${id}`, { method: 'DELETE' })).data,
  )
}

// 한 번에 바꾸는 API가 없어 상품마다 보낸다. 상태가 이미 같은 상품은 보내지 않는다
export function useSelectAll() {
  return useCartMutation(async ({ cart, checked }: { cart: Cart; checked: boolean }) => {
    let latest = cart
    for (const item of cart.items.filter((i) => i.checked !== checked)) {
      latest = (await api<Cart>(`/api/cart/items/${item.id}`, { method: 'PATCH', body: { checked } })).data
    }
    return latest
  })
}
