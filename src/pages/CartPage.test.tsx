import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, test } from 'vitest'
import type { Cart, CartItem } from '../api/types'
import { server } from '../test/server'
import { renderWithClient } from '../test/render'
import { CartPage } from './CartPage'

const me = { name: '홍길동', phone: '01012345678', address: null, addressDetail: null, email: 'user@example.com' }

const mug: CartItem = {
  id: 1,
  checked: true,
  quantity: 2,
  price: 12000,
  mainImageUrl: '/images/default.png',
  name: '스테인리스 머그 350ml',
  optionName: '화이트',
}
const towel: CartItem = {
  id: 2,
  checked: true,
  quantity: 1,
  price: 4500,
  mainImageUrl: '/images/default.png',
  name: '면 행주 3장 묶음',
  optionName: '단품',
}
const board: CartItem = {
  id: 3,
  checked: false,
  quantity: 1,
  price: 21800,
  mainImageUrl: '/images/default.png',
  name: '대나무 도마',
  optionName: '대 (40×28cm)',
}

// 백엔드처럼 선택한 상품만 더한다
function cartOf(items: CartItem[]): Cart {
  return { items, productsTotal: items.filter((i) => i.checked).reduce((sum, i) => sum + i.price * i.quantity, 0) }
}

function ok<T>(data: T) {
  return HttpResponse.json({ status: 200, data })
}

function loggedInWith(cart: Cart) {
  server.use(
    http.get('/api/users/me', () => ok(me)),
    http.get('/api/cart', () => ok(cart)),
  )
}

function CurrentPath() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

function renderCart() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/cart']}>
      <Routes>
        <Route path="/cart" element={<CartPage />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  )
}

function rowOf(name: string) {
  return screen.getByRole('listitem', { name })
}

test('로그인 전이면 장바구니로 돌아오는 로그인 화면으로 간다', async () => {
  server.use(http.get('/api/users/me', () => HttpResponse.json({ status: 401, message: '' }, { status: 401 })))

  renderCart()

  expect(await screen.findByTestId('path')).toHaveTextContent('/signin?returnTo=%2Fcart')
})

test('비어 있으면 상품을 보러 가게 한다', async () => {
  loggedInWith(cartOf([]))

  renderCart()

  expect(await screen.findByText('장바구니가 비어 있습니다.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '상품 보러 가기' })).toHaveAttribute('href', '/products')
})

test('상품마다 상품별 합계를, 아래에는 선택한 상품의 상품 합계를 보여 준다', async () => {
  loggedInWith(cartOf([mug, towel, board]))

  renderCart()

  const row = await screen.findByRole('listitem', { name: '스테인리스 머그 350ml' })
  expect(within(row).getByText('화이트')).toBeInTheDocument()
  expect(within(row).getByLabelText('상품별 합계')).toHaveTextContent('24,000')
  // 머그 24,000 + 행주 4,500. 선택하지 않은 도마는 빠진다
  expect(screen.getByLabelText('상품 합계')).toHaveTextContent('28,500')
  expect(screen.getByRole('button', { name: '선택한 상품 2개 주문하기' })).toBeEnabled()
})

test('선택을 바꾸면 백엔드에 보내고, 돌려받은 장바구니로 상품 합계를 다시 그린다', async () => {
  loggedInWith(cartOf([mug, towel]))
  let body: unknown = null
  server.use(
    http.patch('/api/cart/items/2', async ({ request }) => {
      body = await request.json()
      return ok(cartOf([mug, { ...towel, checked: false }]))
    }),
  )

  renderCart()

  await userEvent.click(await screen.findByRole('checkbox', { name: '면 행주 3장 묶음 선택' }))

  expect(body).toEqual({ checked: false })
  expect(await screen.findByRole('button', { name: '선택한 상품 1개 주문하기' })).toBeInTheDocument()
  expect(screen.getByLabelText('상품 합계')).toHaveTextContent('24,000')
})

test('수량을 늘리면 바뀐 수량을 보낸다', async () => {
  loggedInWith(cartOf([mug]))
  let body: unknown = null
  server.use(
    http.patch('/api/cart/items/1', async ({ request }) => {
      body = await request.json()
      return ok(cartOf([{ ...mug, quantity: 3 }]))
    }),
  )

  renderCart()

  await userEvent.click(await screen.findByRole('button', { name: '스테인리스 머그 350ml 수량 늘리기' }))

  expect(body).toEqual({ quantity: 3 })
  expect(await within(rowOf('스테인리스 머그 350ml')).findByLabelText('상품별 합계')).toHaveTextContent('36,000')
})

test('삭제하면 그 상품이 빠진다', async () => {
  loggedInWith(cartOf([mug, towel]))
  server.use(http.delete('/api/cart/items/1', () => ok(cartOf([towel]))))

  renderCart()

  await userEvent.click(await screen.findByRole('button', { name: '스테인리스 머그 350ml 삭제' }))

  expect(await screen.findByRole('button', { name: '선택한 상품 1개 주문하기' })).toBeInTheDocument()
  expect(screen.queryByRole('listitem', { name: '스테인리스 머그 350ml' })).not.toBeInTheDocument()
})

test('전체 선택은 선택하지 않은 상품만 골라 선택한다', async () => {
  loggedInWith(cartOf([mug, board]))
  const patched: string[] = []
  server.use(
    http.patch('/api/cart/items/:id', ({ params }) => {
      patched.push(String(params.id))
      return ok(cartOf([mug, { ...board, checked: true }]))
    }),
  )

  renderCart()

  await userEvent.click(await screen.findByRole('checkbox', { name: '전체 선택' }))

  expect(await screen.findByRole('button', { name: '선택한 상품 2개 주문하기' })).toBeInTheDocument()
  expect(patched).toEqual(['3'])
})

test('선택한 상품이 없으면 주문할 수 없고, 있으면 주문서로 간다', async () => {
  loggedInWith(cartOf([{ ...mug, checked: false }]))

  const { unmount } = renderCart()

  expect(await screen.findByRole('button', { name: '선택한 상품 0개 주문하기' })).toBeDisabled()
  unmount()

  loggedInWith(cartOf([mug]))
  renderCart()

  await userEvent.click(await screen.findByRole('button', { name: '선택한 상품 1개 주문하기' }))

  expect(await screen.findByTestId('path')).toHaveTextContent('/checkout')
})
