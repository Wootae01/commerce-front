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

function pageOf(content: unknown[], totalElements = content.length) {
  return ok({ content, page: 0, size: content.length, totalElements, totalPages: 1, hasNext: false })
}

// 전체 상품 칸이 상품 수를 알려고 부르는 검색. 다른 검색은 각 테스트가 따로 붙인다
const allProducts = (total: number) => http.get('/api/products', () => pageOf([], total))

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
    allProducts(32),
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

test('추천 상품 마지막 칸은 상품이 아니라 전체 상품 수와 함께 전체 목록으로 가는 칸이다', async () => {
  server.use(
    http.get('/api/products/featured', () => ok([mug])),
    http.get('/api/products/popular', () => ok([board])),
    allProducts(32),
  )

  renderHome()

  const tile = await screen.findByRole('link', { name: '전체 상품 32개 보기' })
  expect(tile).toHaveAttribute('href', '/products')
  expect(within(tile).getByText('32')).toBeInTheDocument()
})

test('인기 상품이 아직 없으면 새로 들어온 상품을 대신 보여 준다', async () => {
  const searches: string[] = []
  server.use(
    http.get('/api/products/featured', () => ok([mug])),
    http.get('/api/products/popular', () => ok([])),
    http.get('/api/products', ({ request }) => {
      searches.push(new URL(request.url).search)
      return pageOf([board])
    }),
  )

  renderHome()

  const newest = await screen.findByRole('region', { name: '새로 들어온 상품' })
  expect(await within(newest).findByText('대나무 도마')).toBeInTheDocument()
  expect(searches).toContain('?sortType=NEWEST&size=8')
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
    allProducts(32),
  )

  renderHome()

  await userEvent.click(await screen.findByRole('button', { name: '다시 불러오기' }))

  expect(await screen.findByText('스테인리스 머그 350ml')).toBeInTheDocument()
})
