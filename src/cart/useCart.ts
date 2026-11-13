import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Cart } from '../api/types'
import { useMe } from '../auth/auth'

export const cartQueryKey = ['cart'] as const

// 장바구니는 로그인한 사람만 있다. 로그인 전에는 부르지 않는다
export function useCart() {
  const { isLoggedIn } = useMe()
  return useQuery({
    queryKey: cartQueryKey,
    queryFn: async () => (await api<Cart>('/api/cart')).data,
    enabled: isLoggedIn,
  })
}
