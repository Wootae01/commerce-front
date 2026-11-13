import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test } from 'vitest'
import type { PaymentResult } from '../api/types'
import { server } from '../test/server'
import { renderWithClient } from '../test/render'
import { PaymentFailPage, PaymentSuccessPage } from './PaymentResultPage'

const me = { name: '홍길동', phone: '01012345678', address: null, addressDetail: null, email: 'user@example.com' }

const paid: PaymentResult = {
  orderNumber: 'ORDER-1',
  amount: 31500,
  method: '카드',
  approvedAt: '2026-11-13 15:20:42',
  orderStatus: 'PAID',
  failureMessage: null,
}
const pending: PaymentResult = { ...paid, method: null, approvedAt: null, orderStatus: 'PAYMENT_PENDING' }

function body(status: number, data: unknown) {
  return HttpResponse.json({ status, data }, { status })
}

function loggedIn() {
  server.use(
    http.get('/api/users/me', () => body(200, me)),
    http.get('/api/cart', () => body(200, { items: [], productsTotal: 0 })),
  )
}

// 토스가 결제 뒤 successUrl에 붙여 보내는 값
const SUCCESS = '/payment/success?paymentType=NORMAL&orderId=ORDER-1&paymentKey=pk-1&amount=31500'

function renderAt(path: string) {
  return renderWithClient(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/payment/fail" element={<PaymentFailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('토스가 돌려준 값으로 결제 승인을 요청하고, 끝나면 결제 금액·수단·주문번호를 보여 준다', async () => {
  loggedIn()
  let sent: unknown = null
  server.use(
    http.post('/api/payments/confirm', async ({ request }) => {
      sent = await request.json()
      return body(200, paid)
    }),
  )

  renderAt(SUCCESS)

  expect(await screen.findByRole('heading', { name: '결제가 끝났습니다' })).toBeInTheDocument()
  expect(sent).toEqual({ paymentKey: 'pk-1', orderId: 'ORDER-1', amount: 31500 })
  expect(screen.getByLabelText('결제 금액')).toHaveTextContent('31,500')
  expect(screen.getByText('카드')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '주문 상세 보기' })).toHaveAttribute('href', '/orders/ORDER-1')
})

test('결제 실패면 실패 이유를 보여 주고 장바구니로 돌아가게 한다', async () => {
  loggedIn()
  server.use(
    http.post('/api/payments/confirm', () =>
      HttpResponse.json({ status: 400, message: '카드 한도가 초과되었습니다.' }, { status: 400 }),
    ),
  )

  renderAt(SUCCESS)

  expect(await screen.findByRole('heading', { name: '결제하지 못했습니다' })).toBeInTheDocument()
  expect(screen.getByText('카드 한도가 초과되었습니다.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '장바구니로 가기' })).toHaveAttribute('href', '/cart')
})

test('결과 모름(202)이면 다시 결제하지 말라고 안내하고, 결과 다시 확인으로 확정된 결과를 보여 준다', async () => {
  loggedIn()
  let checks = 0
  server.use(
    http.post('/api/payments/confirm', () => body(202, pending)),
    http.get('/api/payments/ORDER-1', () => {
      checks += 1
      return body(200, checks === 1 ? pending : paid)
    }),
  )

  renderAt(SUCCESS)

  expect(await screen.findByRole('heading', { name: '결제 결과를 확인하고 있습니다' })).toBeInTheDocument()
  expect(screen.getByText(/다시 결제하지 말고/)).toBeInTheDocument()

  const recheck = screen.getByRole('button', { name: '결과 다시 확인' })
  await userEvent.click(recheck)
  expect(await screen.findByText('아직 결과가 나오지 않았습니다. 잠시 뒤 다시 확인해 주세요.')).toBeInTheDocument()

  await userEvent.click(recheck)
  expect(await screen.findByRole('heading', { name: '결제가 끝났습니다' })).toBeInTheDocument()
})

test('결과 다시 확인에서 결제 실패로 확정되면 실패 이유를 보여 준다', async () => {
  loggedIn()
  server.use(
    http.post('/api/payments/confirm', () => body(202, pending)),
    http.get('/api/payments/ORDER-1', () =>
      body(200, { ...pending, orderStatus: 'PAYMENT_FAILED', failureMessage: '결제 시간이 만료되었습니다.' }),
    ),
  )

  renderAt(SUCCESS)

  await userEvent.click(await screen.findByRole('button', { name: '결과 다시 확인' }))

  expect(await screen.findByRole('heading', { name: '결제하지 못했습니다' })).toBeInTheDocument()
  expect(screen.getByText('결제 시간이 만료되었습니다.')).toBeInTheDocument()
})

test('이미 처리된 주문(409)이면 실제 결제 결과를 조회해, 결제가 끝났으면 그대로 보여 준다', async () => {
  loggedIn()
  server.use(
    http.post('/api/payments/confirm', () =>
      HttpResponse.json({ status: 409, message: '이미 처리된 주문입니다.' }, { status: 409 }),
    ),
    http.get('/api/payments/ORDER-1', () => body(200, paid)),
  )

  renderAt(SUCCESS)

  expect(await screen.findByRole('heading', { name: '결제가 끝났습니다' })).toBeInTheDocument()
})

test('결제할 수 없는 주문이면(취소된 주문 등) 이유와 함께 주문내역으로 안내한다', async () => {
  loggedIn()
  server.use(
    http.post('/api/payments/confirm', () =>
      HttpResponse.json({ status: 409, message: '결제 가능한 상태가 아닙니다.' }, { status: 409 }),
    ),
    http.get('/api/payments/ORDER-1', () => body(200, { ...pending, orderStatus: 'CANCELED' })),
  )

  renderAt(SUCCESS)

  expect(await screen.findByRole('heading', { name: '결제를 확인하지 못했습니다' })).toBeInTheDocument()
  expect(screen.getByText('결제 가능한 상태가 아닙니다.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '주문내역 보기' })).toHaveAttribute('href', '/orders')
})

test('토스 값이 빠져 있으면 승인을 요청하지 않는다', async () => {
  loggedIn()
  let called = false
  server.use(
    http.post('/api/payments/confirm', () => {
      called = true
      return body(200, paid)
    }),
  )

  renderAt('/payment/success?orderId=ORDER-1')

  expect(await screen.findByRole('heading', { name: '결제를 확인하지 못했습니다' })).toBeInTheDocument()
  expect(called).toBe(false)
})

test('토스 결제창에서 실패하면 토스가 준 이유를 보여 준다', async () => {
  loggedIn()

  renderAt('/payment/fail?code=REJECT_CARD_COMPANY&message=%EC%B9%B4%EB%93%9C%EC%82%AC%EC%97%90%EC%84%9C%20%EA%B1%B0%EC%A0%88%ED%96%88%EC%8A%B5%EB%8B%88%EB%8B%A4.&orderId=ORDER-1')

  expect(await screen.findByRole('heading', { name: '결제하지 못했습니다' })).toBeInTheDocument()
  expect(screen.getByText('카드사에서 거절했습니다.')).toBeInTheDocument()
})

test('결제창에서 직접 취소했으면 취소했다고만 알린다', async () => {
  loggedIn()

  renderAt('/payment/fail?code=PAY_PROCESS_CANCELED&message=%EC%B7%A8%EC%86%8C&orderId=ORDER-1')

  expect(await screen.findByRole('heading', { name: '결제를 취소했습니다' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '장바구니로 가기' })).toBeInTheDocument()
})
