import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { server } from '../test/server'
import { renderWithClient } from '../test/render'
import { HomePage } from './HomePage'

const mug = { id: 1, mainImageUrl: '/images/default.png', name: '스테인리스 머그 350ml', price: 12000 }
const towel = { id: 2, mainImageUrl: '/uploads/towel.jpg', name: '면 행주 3장 묶음', price: 4500 }
const board = { id: 5, mainImageUrl: '/uploads/board.jpg', name: '대나무 도마', price: 15800 }

function ok<T>(data: T) {
  return HttpResponse.json({ status: 200, data })
}

function renderHome() {
  return renderWithClient(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

test('메인 노출 상품을 순서대로 보여 주고, 상품을 누르면 상세로 간다', async () => {
  server.use(
    http.get('/api/products/featured', () => ok([mug, towel])),
    http.get('/api/products/popular', () => ok([board])),
  )

  renderHome()

  const featured = await screen.findByRole('region', { name: '추천 상품' })
  const productLinks = (await within(featured).findAllByRole('link'))
    .map((link) => link.getAttribute('href'))
    .filter((href) => /^\/products\/\d+$/.test(href ?? ''))
  expect(productLinks).toEqual(['/products/1', '/products/2'])
  expect(within(featured).getByLabelText('12,000원')).toBeInTheDocument()
  expect(await screen.findByRole('region', { name: '인기 상품' })).toBeInTheDocument()
})

test('인기 상품이 아직 없으면 새로 들어온 상품을 대신 보여 준다', async () => {
  let newestQuery = ''
  server.use(
    http.get('/api/products/featured', () => ok([mug])),
    http.get('/api/products/popular', () => ok([])),
    http.get('/api/products', ({ request }) => {
      newestQuery = new URL(request.url).search
      return ok({ content: [board], page: 0, size: 8, totalElements: 1, totalPages: 1, hasNext: false })
    }),
  )

  renderHome()

  const newest = await screen.findByRole('region', { name: '새로 들어온 상품' })
  expect(await within(newest).findByText('대나무 도마')).toBeInTheDocument()
  expect(newestQuery).toContain('sortType=NEWEST')
  expect(screen.queryByRole('region', { name: '인기 상품' })).not.toBeInTheDocument()
})

test('불러오지 못하면 다시 시도할 수 있다', async () => {
  let featuredCalls = 0
  server.use(
    http.get('/api/products/featured', () => {
      featuredCalls += 1
      return featuredCalls === 1 ? new HttpResponse(null, { status: 500 }) : ok([mug])
    }),
    http.get('/api/products/popular', () => ok([board])),
  )

  renderHome()

  await userEvent.click(await screen.findByRole('button', { name: '다시 불러오기' }))

  expect(await screen.findByText('스테인리스 머그 350ml')).toBeInTheDocument()
})
