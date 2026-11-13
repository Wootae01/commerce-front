import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, test } from 'vitest'
import { Header } from '../layout/Header'
import { server } from '../test/server'
import { renderWithClient } from '../test/render'
import { ProductDetailPage } from './ProductDetailPage'

const me = { name: '홍길동', phone: '01012345678', address: null, addressDetail: null, email: 'user@example.com' }

const mug = {
  id: 1,
  name: '스테인리스 머그 350ml',
  price: 12000,
  mainImageUrl: '/images/default.png',
  images: [],
  description: '이중 벽 구조라 뜨겁지 않습니다.',
  options: [
    { id: 11, name: '화이트', stock: 40, additionalPrice: 0 },
    { id: 12, name: '대용량', stock: 3, additionalPrice: 2000 },
    { id: 13, name: '세이지', stock: 0, additionalPrice: 0 },
  ],
}

const towel = {
  id: 2,
  name: '면 행주 3장 묶음',
  price: 4500,
  mainImageUrl: '/images/default.png',
  images: [],
  description: '',
  options: [{ id: 21, name: '단품', stock: 120, additionalPrice: 0 }],
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

function loggedOut() {
  server.use(http.get('/api/users/me', () => HttpResponse.json({ status: 401, message: '' }, { status: 401 })))
}

function CurrentPath() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

function renderProduct(id: number) {
  return renderWithClient(
    <MemoryRouter initialEntries={[`/products/${id}`]}>
      <Header />
      <Routes>
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('옵션마다 추가금과 재고를 보여 주고, 품절 옵션은 고를 수 없다', async () => {
  loggedOut()
  server.use(http.get('/api/products/1', () => ok(mug)))

  renderProduct(1)

  expect(await screen.findByRole('heading', { name: '스테인리스 머그 350ml' })).toBeInTheDocument()
  const options = screen.getByRole('radiogroup', { name: '옵션' })
  expect(within(options).getByRole('radio', { name: /화이트/ })).toBeEnabled()
  expect(within(options).getByRole('radio', { name: /대용량.*\+2,000원.*3개 남음/ })).toBeEnabled()
  expect(within(options).getByRole('radio', { name: /세이지.*품절/ })).toBeDisabled()
})

test('옵션을 고르기 전에는 담을 수 없고, 고르면 합계가 (가격 + 추가금) × 수량이 된다', async () => {
  loggedIn()
  server.use(http.get('/api/products/1', () => ok(mug)))

  renderProduct(1)

  const add = await screen.findByRole('button', { name: '장바구니에 담기' })
  expect(add).toBeDisabled()

  await userEvent.click(screen.getByRole('radio', { name: /대용량/ }))
  await userEvent.click(screen.getByRole('button', { name: '수량 늘리기' }))

  expect(add).toBeEnabled()
  expect(screen.getByLabelText('합계')).toHaveTextContent('28,000')
})

test('수량은 고른 옵션의 재고보다 늘릴 수 없다', async () => {
  loggedIn()
  server.use(http.get('/api/products/1', () => ok(mug)))

  renderProduct(1)

  await userEvent.click(await screen.findByRole('radio', { name: /대용량/ }))
  const more = screen.getByRole('button', { name: '수량 늘리기' })
  await userEvent.click(more)
  await userEvent.click(more)

  expect(screen.getByRole('spinbutton', { name: '수량' })).toHaveValue(3)
  expect(more).toBeDisabled()
})

test('옵션이 단품 하나면 고르는 칸 없이 바로 담을 수 있다', async () => {
  loggedIn()
  server.use(http.get('/api/products/2', () => ok(towel)))

  renderProduct(2)

  expect(await screen.findByRole('button', { name: '장바구니에 담기' })).toBeEnabled()
  expect(screen.queryByRole('radiogroup', { name: '옵션' })).not.toBeInTheDocument()
})

test('장바구니에 담으면 상품·옵션·수량을 보내고, 헤더 장바구니 수가 바뀐다', async () => {
  loggedIn()
  let body: unknown = null
  server.use(
    http.get('/api/products/1', () => ok(mug)),
    http.post('/api/cart/items', async ({ request }) => {
      body = await request.json()
      return ok({ items: [{ id: 100 }], productsTotal: 0 }, 201)
    }),
  )

  renderProduct(1)

  await userEvent.click(await screen.findByRole('radio', { name: /화이트/ }))
  await userEvent.click(screen.getByRole('button', { name: '장바구니에 담기' }))

  expect(await screen.findByText('장바구니에 담았습니다.')).toBeInTheDocument()
  expect(body).toEqual({ productId: 1, optionId: 11, quantity: 1 })
  expect(screen.getByRole('link', { name: '장바구니, 상품 1개' })).toBeInTheDocument()
})

test('로그인 전에 담으려 하면 이 상품으로 돌아오는 로그인 화면으로 간다', async () => {
  loggedOut()
  server.use(http.get('/api/products/2', () => ok(towel)))

  renderProduct(2)

  await userEvent.click(await screen.findByRole('button', { name: '장바구니에 담기' }))

  expect(await screen.findByTestId('path')).toHaveTextContent('/signin?returnTo=%2Fproducts%2F2')
})

test('바로구매는 고른 옵션과 수량으로 주문서에 간다', async () => {
  loggedIn()
  server.use(http.get('/api/products/1', () => ok(mug)))

  renderProduct(1)

  await userEvent.click(await screen.findByRole('radio', { name: /화이트/ }))
  await userEvent.click(screen.getByRole('button', { name: '수량 늘리기' }))
  await userEvent.click(screen.getByRole('button', { name: '바로구매' }))

  expect(await screen.findByTestId('path')).toHaveTextContent('/checkout?productId=1&optionId=11&quantity=2')
})

test('없는 상품이면 안내한다', async () => {
  loggedOut()
  server.use(
    http.get('/api/products/999', () =>
      HttpResponse.json({ status: 404, message: '해당 상품을 찾을 수 없습니다.' }, { status: 404 }),
    ),
  )

  renderProduct(999)

  expect(await screen.findByRole('heading', { name: '상품을 찾을 수 없습니다' })).toBeInTheDocument()
})
