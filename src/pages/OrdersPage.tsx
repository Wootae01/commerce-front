import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router'
import { api } from '../api/client'
import type { OrderSummary, Page } from '../api/types'
import { signInUrl, useMe } from '../auth/auth'
import { OrderStatusBadge } from '../orders/OrderStatusBadge'
import { ordersListKey } from '../orders/queries'
import { formatOrderDate } from '../orders/status'
import { Price } from '../ui/Price'

const PAGE_SIZE = 10

export function OrdersPage() {
  const { isLoggedIn, isPending: mePending } = useMe()
  const orders = useInfiniteQuery({
    queryKey: ordersListKey,
    queryFn: async ({ pageParam }) =>
      (await api<Page<OrderSummary>>('/api/orders', { query: { page: pageParam, size: PAGE_SIZE } })).data,
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    enabled: isLoggedIn,
  })

  if (mePending) return null
  if (!isLoggedIn) return <Navigate to={signInUrl('/orders')} replace />

  const list = orders.data?.pages.flatMap((page) => page.content) ?? []

  return (
    <div className="page grid gap-8 pt-6 md:pt-10">
      <h1 className="text-headline font-bold tracking-[-0.03em]">주문내역</h1>
      {orders.isError ? (
        <div className="grid justify-items-start gap-3">
          <p className="text-body">주문내역을 불러오지 못했습니다. 잠시 뒤 다시 불러와 주세요.</p>
          <button
            type="button"
            onClick={() => orders.refetch()}
            className="h-10 rounded-control border border-ink px-4 text-small font-medium"
          >
            다시 불러오기
          </button>
        </div>
      ) : orders.isPending ? (
        <div className="h-40 bg-shelf" aria-busy="true" />
      ) : list.length === 0 ? (
        <div className="grid justify-items-start gap-4 border-t border-ink pt-6">
          <p className="text-lead">아직 주문한 상품이 없습니다.</p>
          <Link to="/products" className="inline-flex h-12 items-center rounded-control bg-ink px-6 font-medium text-paper">
            상품 보러 가기
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          <ul className="border-t border-ink">
            {list.map((order) => (
              <li key={order.orderNumber} className="border-b border-rule">
                <OrderRow order={order} />
              </li>
            ))}
          </ul>
          {orders.hasNextPage && (
            <button
              type="button"
              onClick={() => orders.fetchNextPage()}
              disabled={orders.isFetchingNextPage}
              className="h-12 justify-self-center rounded-control border border-ink px-8 font-medium disabled:text-graphite"
            >
              더 보기
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function OrderRow({ order }: { order: OrderSummary }) {
  const [first, ...rest] = order.productDTOS
  const summary = first ? (rest.length > 0 ? `${first.productName} 외 ${rest.length}건` : first.productName) : '주문 상품'

  return (
    <Link
      to={`/orders/${encodeURIComponent(order.orderNumber)}`}
      className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="num text-small text-graphite">{formatOrderDate(order.orderDate)}</span>
        <OrderStatusBadge status={order.orderStatus} />
      </div>
      <Price value={order.finalPrice} size="lead" className="row-span-2 self-center" />
      <p className="text-body group-hover:underline underline-offset-4">{summary}</p>
    </Link>
  )
}
