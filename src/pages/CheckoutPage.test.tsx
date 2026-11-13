import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Checkout } from '../api/types'
import { server } from '../test/server'
import { renderWithClient } from '../test/render'
import { CheckoutPage } from './CheckoutPage'

// 토스 결제위젯은 브라우저에서 토스 서버와 통신하므로 테스트에서는 가짜로 바꾼다
const widget = vi.hoisted(() => ({
  setAmount: vi.fn(async (_value: number) => {}),
  destroy: vi.fn(async () => {}),
  requestPayment: vi.fn(async (_request: unknown) => {}),
}))
const mount = vi.hoisted(() => vi.fn(async (_options: unknown) => widget))
vi.mock('../payment/tossWidget', () => ({
  mountPaymentWidget: mount,
  isUserCancel: (error: unknown) => (error as { code?: string })?.code === 'USER_CANCEL',
}))

beforeEach(() => {
  widget.setAmount.mockClear()
  widget.requestPayment.mockReset()
  mount.mockClear()
})

const me = { name: '홍길동', phone: '01012345678', address: '서울시 중구 세종대로 110', addressDetail: '101호', email: 'user@example.com' }

const cartCheckout: Checkout = {
  orderType: 'CART',
  items: [
    { id: 7, quantity: 2, unitPrice: 12000, lineTotal: 24000, mainImageUrl: '/images/default.png', name: '스테인리스 머그 350ml', optionName: '화이트' },
    { id: 8, quantity: 1, unitPrice: 4500, lineTotal: 4500, mainImageUrl: '/images/default.png', name: '면 행주 3장 묶음', optionName: '단품' },
  ],
  orderer: { name: '홍길동', phone: '01012345678', address: '서울시 중구 세종대로 110', addressDetail: '101호', customerKey: 'customer-key-1' },
  orderPrice: { productsTotal: 28500, deliveryFee: 3000, finalPrice: 31500 },
  tossClientKey: 'test_gck_docs',
}

const prepared = {
  orderId: 'ORDER-1',
  orderName: '스테인리스 머그 350ml 외 1건',
  amount: 31500,
  successUrl: 'http://localhost:8080/pay/loading',
  failUrl: 'http://localhost:8080/pay/fail',
  customerName: '홍길동',
  customerMobilePhone: '01012345678',
}

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ status, data }, { status })
}

function loggedIn() {
  server.use(
    http.get('/api/users/me', () => ok(me)),
    http.get('/api/cart', () => ok({ items: [], productsTotal: 0 })),
  )
}

function CurrentPath() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

function renderCheckout(path = '/checkout') {
  return renderWithClient(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('로그인 전이면 이 주문서로 돌아오는 로그인 화면으로 간다', async () => {
  server.use(http.get('/api/users/me', () => HttpResponse.json({ status: 401, message: '' }, { status: 401 })))

  renderCheckout('/checkout?productId=1&optionId=11&quantity=2')

  expect(await screen.findByTestId('path')).toHaveTextContent(
    '/signin?returnTo=%2Fcheckout%3FproductId%3D1%26optionId%3D11%26quantity%3D2',
  )
})

test('장바구니 주문: 주문 상품과 상품 합계 + 배송비 = 결제 금액을 보여 주고, 배송지를 내 정보로 채운다', async () => {
  loggedIn()
  server.use(http.get('/api/orders/checkout/cart', () => ok(cartCheckout)))

  renderCheckout()

  const items = await screen.findByRole('list', { name: '주문 상품' })
  expect(within(items).getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByLabelText('상품 합계')).toHaveTextContent('28,500')
  expect(screen.getByLabelText('배송비')).toHaveTextContent('3,000')
  expect(screen.getByLabelText('결제 금액')).toHaveTextContent('31,500')
  expect(screen.getByRole('textbox', { name: '받는 사람' })).toHaveValue('홍길동')
  expect(screen.getByRole('textbox', { name: '주소' })).toHaveValue('서울시 중구 세종대로 110')
  await waitFor(() =>
    expect(mount).toHaveBeenCalledWith(
      expect.objectContaining({ clientKey: 'test_gck_docs', customerKey: 'customer-key-1', amount: 31500 }),
    ),
  )
})

test('바로구매: 상품·옵션·수량으로 주문서를 받는다', async () => {
  loggedIn()
  let query = ''
  server.use(
    http.get('/api/orders/checkout/buy-now', ({ request }) => {
      query = new URL(request.url).search
      return ok({ ...cartCheckout, orderType: 'BUY_NOW', items: [cartCheckout.items[0]] })
    }),
  )

  renderCheckout('/checkout?productId=1&optionId=11&quantity=2')

  expect(await screen.findByRole('list', { name: '주문 상품' })).toBeInTheDocument()
  expect(query).toBe('?productId=1&optionId=11&quantity=2')
})

test('장바구니에서 고른 상품이 없으면 장바구니로 돌려보낸다', async () => {
  loggedIn()
  server.use(http.get('/api/orders/checkout/cart', () => ok({ ...cartCheckout, items: [] })))

  renderCheckout()

  expect(await screen.findByText('주문할 상품이 없습니다.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '장바구니로 가기' })).toHaveAttribute('href', '/cart')
})

test('연락처 형식이 틀리면 주문을 만들지 않고 알려 준다', async () => {
  loggedIn()
  let created = false
  server.use(
    http.get('/api/orders/checkout/cart', () => ok(cartCheckout)),
    http.post('/api/orders', () => {
      created = true
      return ok(prepared, 201)
    }),
  )

  renderCheckout()

  const phone = await screen.findByRole('textbox', { name: '연락처' })
  await userEvent.clear(phone)
  await userEvent.type(phone, '010-1234')
  await userEvent.click(screen.getByRole('button', { name: '31,500원 결제하기' }))

  expect(await screen.findByText('010으로 시작하는 숫자 11자리로 적어 주세요.')).toBeInTheDocument()
  expect(created).toBe(false)
  expect(widget.requestPayment).not.toHaveBeenCalled()
})

test('결제하기: 배송지와 주문할 장바구니 상품으로 주문을 만들고, 위젯으로 결제를 요청한다', async () => {
  loggedIn()
  let body: unknown = null
  server.use(
    http.get('/api/orders/checkout/cart', () => ok(cartCheckout)),
    http.post('/api/orders', async ({ request }) => {
      body = await request.json()
      return ok(prepared, 201)
    }),
  )

  renderCheckout()

  await userEvent.type(await screen.findByRole('textbox', { name: '요청 사항' }), '문 앞에 놓아 주세요')
  await userEvent.click(screen.getByRole('button', { name: '31,500원 결제하기' }))

  await waitFor(() => expect(widget.requestPayment).toHaveBeenCalled())
  expect(body).toEqual({
    orderType: 'CART',
    cartProductIds: [7, 8],
    customerKey: 'customer-key-1',
    name: '홍길동',
    phone: '01012345678',
    address: '서울시 중구 세종대로 110',
    addressDetail: '101호',
    requestNote: '문 앞에 놓아 주세요',
  })
  expect(widget.requestPayment).toHaveBeenCalledWith({
    orderId: 'ORDER-1',
    orderName: '스테인리스 머그 350ml 외 1건',
    customerName: '홍길동',
    customerMobilePhone: '01012345678',
  })
})

test('주문을 만들며 정해진 금액이 화면 금액과 다르면 결제하지 않고 알린다', async () => {
  loggedIn()
  server.use(
    http.get('/api/orders/checkout/cart', () => ok(cartCheckout)),
    http.post('/api/orders', () => ok({ ...prepared, amount: 33500 }, 201)),
  )

  renderCheckout()

  await userEvent.click(await screen.findByRole('button', { name: '31,500원 결제하기' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('결제 금액이 33,500원으로 바뀌었습니다')
  expect(widget.requestPayment).not.toHaveBeenCalled()
})

test('주문을 만들지 못하면(재고 부족 등) 이유를 보여 준다', async () => {
  loggedIn()
  server.use(
    http.get('/api/orders/checkout/cart', () => ok(cartCheckout)),
    http.post('/api/orders', () => HttpResponse.json({ status: 400, message: '재고가 부족합니다.' }, { status: 400 })),
  )

  renderCheckout()

  await userEvent.click(await screen.findByRole('button', { name: '31,500원 결제하기' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('재고가 부족합니다.')
  expect(widget.requestPayment).not.toHaveBeenCalled()
})

test('결제창을 닫으면 오류 없이 주문서에 남는다', async () => {
  loggedIn()
  server.use(
    http.get('/api/orders/checkout/cart', () => ok(cartCheckout)),
    http.post('/api/orders', () => ok(prepared, 201)),
  )
  widget.requestPayment.mockRejectedValueOnce(Object.assign(new Error('취소'), { code: 'USER_CANCEL' }))

  renderCheckout()

  const pay = await screen.findByRole('button', { name: '31,500원 결제하기' })
  await userEvent.click(pay)

  await waitFor(() => expect(pay).toBeEnabled())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
