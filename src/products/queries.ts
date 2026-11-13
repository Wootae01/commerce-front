import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Page, ProductDetail, ProductSort, ProductSummary } from '../api/types'

export function useProductDetail(id: number) {
  return useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: async () => (await api<ProductDetail>(`/api/products/${id}`)).data,
    enabled: Number.isInteger(id) && id > 0,
  })
}

// 관리자가 고른 메인 노출 상품(순서 있음)
export function useFeaturedProducts() {
  return useQuery({
    queryKey: ['products', 'featured'],
    queryFn: async () => (await api<ProductSummary[]>('/api/products/featured')).data,
  })
}

// 최근 30일 판매량 순
export function usePopularProducts(size: number) {
  return useQuery({
    queryKey: ['products', 'popular', size],
    queryFn: async () => (await api<ProductSummary[]>('/api/products/popular', { query: { size } })).data,
  })
}

export type ProductSearch = {
  keyword?: string
  sortType?: ProductSort
  page?: number
  size?: number
}

export function useProductSearch(search: ProductSearch, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['products', 'search', search],
    queryFn: async () => (await api<Page<ProductSummary>>('/api/products', { query: search })).data,
    enabled: options.enabled,
  })
}
