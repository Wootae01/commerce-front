import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test } from 'vitest'
import type { OrderDetail, OrderStatus } from '../api/types'
import { server } from '../test/server'
import { renderWithClient } from '../test/render'
import { OrderDetailPage } from './OrderDetailPage'

const me = { name: '홍길동', phone: '01012345678', address: null, addressDetail: null, email: 'user@example.com' }

const detail: OrderDetail = {
  orderNumber: 'ORDER-2',
  orderDate: '2026-11-13T15:20:42',
  ordererInfo: { name: '홍길동', phone: '010-1234-5678', email: 'user@example.com' },
  shippingInfo: {
    receiverName: '홍길동',
    receiverPhone: '01012345678',
    address: '서울시 중구 세종대로 110',
    addressDetail: '101호',
    requestMessage: '문 앞에 놓아 주세요',
  },
  paymentInfo: { paymentMethod: '카드', orderStatus: '결제완료', failureMessage: null },
  orderItems: [
    { id: 1, quantity: 2, unitPrice: 12000, lineTotal: 24000, mainImageUrl: '/images/default.png', name: '스테인리스 머그 350ml', optionName: '화이트' },
    { id: 2, quantity: 1, unitPrice: 4500, lineTotal: 4500, mainImageUrl: '/images/default.png', name: '면 행주 3장 묶음', optionName: '단품' },
  ],
  orderPrice: { productsTotal: 28500, deliveryFee: 3000, finalPrice: 31500 },
}

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ status, data }, { status })
}

function paymentOf(orderStatus: OrderStatus, failureMessage: string | null = null) {
  return {
    orderNumber: 'ORDER-2',
    amount: 31500,
    method: '카드',
    approvedAt: '2026-11-13 15:20:42',
    orderStatus,
    failureMessage,
  }
}

// 상세는 그대로 두고, 주문 상태 코드는 결제 결과 조회로 받는다. 호출마다 다음 상태를 돌려준다
function orderWith(...statuses: OrderStatus[]) {
  let call = 0
  server.use(
    http.get('/api/users/me', () => ok(me)),
    http.get('/api/cart', () => ok({ items: [], productsTotal: 0 })),
    http.get('/api/orders/ORDER-2', () => ok(detail)),
    http.get('/api/payments/ORDER-2', () => {
      const status = statuses[Math.min(call, statuses.length - 1)]
      call += 1
      return ok(paymentOf(status, status === 'PAYMENT_FAILED' ? '카드 한도가 초과되었습니다.' : null))
    }),
  )
}

function renderDetail(orderNumber = 'ORDER-2') {
  return renderWithClient(
    <MemoryRouter initialEntries={[`/orders/${orderNumber}`]}>
      <Routes>
        <Route path="/orders/:orderNumber" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('주문 상품·결제 금액·배송지·결제 수단을 보여 준다', async () => {
  orderWith('PAID')

  renderDetail()

  const items = await screen.findByRole('list', { name: '주문 상품' })
  expect(within(items).getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByLabelText('결제 금액')).toHaveTextContent('31,500')
  expect(screen.getByText('서울시 중구 세종대로 110 101호')).toBeInTheDocument()
  expect(screen.getByText('카드')).toBeInTheDocument()
  expect(await screen.findByText('결제완료')).toBeInTheDocument()
})

test('결제완료 주문만 취소할 수 있다', async () => {
  orderWith('DELIVERED')

  renderDetail()

  expect(await screen.findByText('배송완료')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '주문 취소' })).not.toBeInTheDocument()
})

test('결제 실패한 주문은 실패 이유를 보여 준다', async () => {
  orderWith('PAYMENT_FAILED')

  renderDetail()

  expect(await screen.findByText('결제 실패')).toBeInTheDocument()
  expect(screen.getByText('카드 한도가 초과되었습니다.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '주문 취소' })).not.toBeInTheDocument()
})

test('주문 취소는 한 번 더 확인한 뒤 요청하고, 취소완료면 환불 금액·수단을 알린다', async () => {
  orderWith('PAID', 'CANCELED')
  let cancelCalls = 0
  server.use(
    http.post('/api/orders/ORDER-2/cancel', () => {
      cancelCalls += 1
      return ok({
        orderNumber: 'ORDER-2',
        canceledAt: '2026-11-13T16:00:00',
        cancelAmount: 31500,
        refundMethod: '카드',
        errorMessage: null,
        orderStatus: 'CANCELED',
      })
    }),
  )

  renderDetail()

  await userEvent.click(await screen.findByRole('button', { name: '주문 취소' }))
  expect(cancelCalls).toBe(0)
  await userEvent.click(screen.getByRole('button', { name: '주문 취소하기' }))

  expect(await screen.findByRole('status')).toHaveTextContent('주문을 취소했습니다. 31,500원을 카드로 환불합니다.')
  expect(cancelCalls).toBe(1)
  expect(await screen.findByText('취소완료')).toBeInTheDocument()
})

test('취소 처리 중(202)이면 다시 취소하지 말라고 안내하고, 결과 다시 확인으로 상태를 새로 받는다', async () => {
  orderWith('PAID', 'CANCEL_REQUESTED', 'CANCELED')
  server.use(
    http.post('/api/orders/ORDER-2/cancel', () =>
      ok(
        { orderNumber: 'ORDER-2', canceledAt: null, cancelAmount: 0, refundMethod: null, errorMessage: null, orderStatus: 'CANCEL_REQUESTED' },
        202,
      ),
    ),
  )

  renderDetail()

  await userEvent.click(await screen.findByRole('button', { name: '주문 취소' }))
  await userEvent.click(screen.getByRole('button', { name: '주문 취소하기' }))

  expect(await screen.findByText(/다시 취소하지 마세요/)).toBeInTheDocument()
  expect(await screen.findByText('취소 처리 중')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: '결과 다시 확인' }))

  expect(await screen.findByText('취소완료')).toBeInTheDocument()
})

test('취소할 수 없으면 이유를 보여 준다', async () => {
  orderWith('PAID')
  server.use(
    http.post('/api/orders/ORDER-2/cancel', () =>
      HttpResponse.json({ status: 409, message: '현재 상태에서는 주문을 취소할 수 없습니다.' }, { status: 409 }),
    ),
  )

  renderDetail()

  await userEvent.click(await screen.findByRole('button', { name: '주문 취소' }))
  await userEvent.click(screen.getByRole('button', { name: '주문 취소하기' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('현재 상태에서는 주문을 취소할 수 없습니다.')
})

test('없는 주문이면 안내한다', async () => {
  server.use(
    http.get('/api/users/me', () => ok(me)),
    http.get('/api/orders/NOPE', () =>
      HttpResponse.json({ status: 404, message: '해당 주문이 존재하지 않습니다.' }, { status: 404 }),
    ),
    http.get('/api/payments/NOPE', () =>
      HttpResponse.json({ status: 404, message: '해당 주문이 존재하지 않습니다.' }, { status: 404 }),
    ),
  )

  renderDetail('NOPE')

  expect(await screen.findByRole('heading', { name: '주문을 찾을 수 없습니다' })).toBeInTheDocument()
})
