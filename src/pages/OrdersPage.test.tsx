import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, test } from 'vitest'
import type { OrderSummary } from '../api/types'
import { server } from '../test/server'
import { renderWithClient } from '../test/render'
import { OrdersPage } from './OrdersPage'

const me = { name: '홍길동', phone: '01012345678', address: null, addressDetail: null, email: 'user@example.com' }

function product(id: number, productName: string) {
  return { id, productName, optionName: '단품', quantity: 1, price: 12000, mainImageURL: '/images/default.png' }
}

const paidOrder: OrderSummary = {
  orderNumber: 'ORDER-2',
  orderDate: '2026-11-13T15:20:42',
  orderStatus: 'PAID',
  productDTOS: [product(1, '스테인리스 머그 350ml'), product(2, '면 행주 3장 묶음')],
  finalPrice: 31500,
}
const failedOrder: OrderSummary = {
  orderNumber: 'ORDER-1',
  orderDate: '2026-11-12T09:00:00',
  orderStatus: 'PAYMENT_FAILED',
  productDTOS: [product(3, '대나무 도마')],
  finalPrice: 18800,
}

function pageOf(content: OrderSummary[], page: number, hasNext: boolean) {
  return HttpResponse.json({
    status: 200,
    data: { content, page, size: 10, totalElements: 11, totalPages: 2, hasNext },
  })
}

function loggedIn() {
  server.use(
    http.get('/api/users/me', () => HttpResponse.json({ status: 200, data: me })),
    http.get('/api/cart', () => HttpResponse.json({ status: 200, data: { items: [], productsTotal: 0 } })),
  )
}

function CurrentPath() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

function renderOrders() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/orders']}>
      <Routes>
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('로그인 전이면 주문내역으로 돌아오는 로그인 화면으로 간다', async () => {
  server.use(http.get('/api/users/me', () => HttpResponse.json({ status: 401, message: '' }, { status: 401 })))

  renderOrders()

  expect(await screen.findByTestId('path')).toHaveTextContent('/signin?returnTo=%2Forders')
})

test('주문마다 주문일·상태·대표 상품·결제 금액을 보여 주고 상세로 이어진다', async () => {
  loggedIn()
  server.use(http.get('/api/orders', () => pageOf([paidOrder, failedOrder], 0, false)))

  renderOrders()

  const paid = await screen.findByRole('link', { name: /스테인리스 머그 350ml 외 1건/ })
  expect(paid).toHaveAttribute('href', '/orders/ORDER-2')
  expect(within(paid).getByText('2026.11.13')).toBeInTheDocument()
  expect(within(paid).getByText('결제완료')).toBeInTheDocument()
  expect(within(paid).getByLabelText('31,500원')).toBeInTheDocument()

  const failed = screen.getByRole('link', { name: /대나무 도마/ })
  expect(within(failed).getByText('결제 실패')).toBeInTheDocument()
})

test('더 보기를 누르면 다음 페이지를 이어 붙인다', async () => {
  loggedIn()
  const pages: string[] = []
  server.use(
    http.get('/api/orders', ({ request }) => {
      const page = new URL(request.url).searchParams.get('page') ?? '0'
      pages.push(page)
      return page === '0' ? pageOf([paidOrder], 0, true) : pageOf([failedOrder], 1, false)
    }),
  )

  renderOrders()

  await userEvent.click(await screen.findByRole('button', { name: '더 보기' }))

  expect(await screen.findByRole('link', { name: /대나무 도마/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /스테인리스 머그/ })).toBeInTheDocument()
  expect(pages).toEqual(['0', '1'])
  expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument()
})

test('주문이 없으면 쇼핑하러 가게 한다', async () => {
  loggedIn()
  server.use(
    http.get('/api/orders', () =>
      HttpResponse.json({ status: 200, data: { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, hasNext: false } }),
    ),
  )

  renderOrders()

  expect(await screen.findByText('아직 주문한 상품이 없습니다.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '상품 보러 가기' })).toHaveAttribute('href', '/products')
})
