import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { server } from '../test/server'
import { renderWithClient } from '../test/render'
import { Header } from './Header'

const me = { name: '홍길동', phone: '01012345678', address: null, addressDetail: null, email: 'user@example.com' }

function renderAt(path: string) {
  return renderWithClient(
    <MemoryRouter initialEntries={[path]}>
      <Header />
    </MemoryRouter>,
  )
}

test('로그인 전: 로그인 화면으로 가면서 지금 보던 경로를 넘긴다', async () => {
  server.use(
    http.get('/api/users/me', () => HttpResponse.json({ status: 401, message: '로그인이 필요합니다.' }, { status: 401 })),
  )

  renderAt('/products/3')

  const login = await screen.findByRole('link', { name: '로그인' })
  expect(login).toHaveAttribute('href', '/signin?returnTo=%2Fproducts%2F3')
  expect(screen.queryByRole('link', { name: '주문내역' })).not.toBeInTheDocument()
})

test('로그인 후: 장바구니에 담긴 상품 수와 주문내역·내 정보가 보인다', async () => {
  server.use(
    http.get('/api/users/me', () => HttpResponse.json({ status: 200, data: me })),
    http.get('/api/cart', () =>
      HttpResponse.json({ status: 200, data: { items: [{ id: 1 }, { id: 2 }], productsTotal: 0 } }),
    ),
  )

  renderAt('/')

  expect(await screen.findByRole('link', { name: '장바구니, 상품 2개' })).toHaveAttribute('href', '/cart')
  expect(screen.getByRole('link', { name: '주문내역' })).toHaveAttribute('href', '/orders')
  expect(screen.getByRole('link', { name: '내 정보' })).toHaveAttribute('href', '/me')
  expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument()
})

test('검색하면 상품 목록으로 검색어를 넘긴다', async () => {
  server.use(
    http.get('/api/users/me', () => HttpResponse.json({ status: 401, message: '' }, { status: 401 })),
  )

  renderAt('/')

  const form = await screen.findByRole('search')
  expect(form).toHaveAttribute('action', '/products')
  expect(screen.getByRole('searchbox', { name: '상품 검색' })).toHaveAttribute('name', 'keyword')
})
