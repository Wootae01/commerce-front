import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, test } from 'vitest'
import type { ProductSummary } from '../api/types'
import { server } from '../test/server'
import { renderWithClient } from '../test/render'
import { ProductsPage } from './ProductsPage'

function product(id: number, name: string, price: number): ProductSummary {
  return { id, name, price, mainImageUrl: '/images/default.png' }
}

const mug = product(1, '스테인리스 머그 350ml', 12000)
const towel = product(2, '면 행주 3장 묶음', 6500)

// 받은 검색 요청의 쿼리를 모아 둔다
function searchReturns(pages: { content: ProductSummary[]; hasNext: boolean; totalElements: number }[]) {
  const requests: URLSearchParams[] = []
  server.use(
    http.get('/api/products', ({ request }) => {
      const params = new URL(request.url).searchParams
      requests.push(params)
      const page = Number(params.get('page') ?? 0)
      const body = pages[page] ?? { content: [], hasNext: false, totalElements: 0 }
      return HttpResponse.json({
        status: 200,
        data: { ...body, page, size: 21, totalPages: pages.length },
      })
    }),
  )
  return requests
}

function CurrentPath() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

function renderProducts(entry: string) {
  return renderWithClient(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/products" element={<><ProductsPage /><CurrentPath /></>} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('주소의 검색 조건으로 상품을 찾아 결과 수와 상품을 보여 주고, 상품은 상세로 이어진다', async () => {
  const requests = searchReturns([{ content: [mug, towel], hasNext: false, totalElements: 2 }])

  renderProducts('/products?keyword=머그&minPrice=5000&maxPrice=20000&sortType=PRICE_ASC')

  expect(await screen.findByText('스테인리스 머그 350ml')).toBeInTheDocument()
  expect(screen.getByText('면 행주 3장 묶음')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('2개')

  const query = requests.at(-1)!
  expect(query.get('keyword')).toBe('머그')
  expect(query.get('minPrice')).toBe('5000')
  expect(query.get('maxPrice')).toBe('20000')
  expect(query.get('sortType')).toBe('PRICE_ASC')
  expect(query.get('page')).toBe('0')

  await userEvent.click(screen.getByRole('link', { name: /스테인리스 머그/ }))
  expect(screen.getByTestId('path')).toHaveTextContent('/products/1')
})

test('정렬·가격을 바꾸면 주소에 남기고 그 조건으로 다시 찾는다. 기간은 판매량순일 때만 고른다', async () => {
  const requests = searchReturns([{ content: [mug], hasNext: false, totalElements: 1 }])
  const user = userEvent.setup()

  renderProducts('/products?keyword=머그')
  await screen.findByText('스테인리스 머그 350ml')
  expect(screen.queryByRole('combobox', { name: '판매 기간' })).not.toBeInTheDocument()

  await user.selectOptions(screen.getByRole('combobox', { name: '정렬' }), '판매량순')
  await user.selectOptions(await screen.findByRole('combobox', { name: '판매 기간' }), '최근 1주일')
  expect(screen.getByTestId('path')).toHaveTextContent('sortType=BEST_SELLING')
  expect(screen.getByTestId('path')).toHaveTextContent('salesPeriod=WEEK')
  await waitFor(() => expect(requests.at(-1)!.get('salesPeriod')).toBe('WEEK'))
  expect(requests.at(-1)!.get('sortType')).toBe('BEST_SELLING')
  expect(requests.at(-1)!.get('keyword')).toBe('머그')

  // 판매량순이 아니면 기간은 뜻이 없으므로 고를 수 없고 주소에서도 빠진다
  await user.selectOptions(screen.getByRole('combobox', { name: '정렬' }), '낮은 가격순')
  expect(screen.queryByRole('combobox', { name: '판매 기간' })).not.toBeInTheDocument()
  expect(screen.getByTestId('path')).not.toHaveTextContent('salesPeriod')

  await user.type(screen.getByRole('spinbutton', { name: '최저 가격' }), '5000')
  await user.type(screen.getByRole('spinbutton', { name: '최고 가격' }), '20000')
  await user.click(screen.getByRole('button', { name: '가격 적용' }))
  expect(screen.getByTestId('path')).toHaveTextContent('minPrice=5000')
  expect(screen.getByTestId('path')).toHaveTextContent('maxPrice=20000')
  await waitFor(() => expect(requests.at(-1)!.get('minPrice')).toBe('5000'))
  expect(requests.at(-1)!.get('maxPrice')).toBe('20000')
  expect(requests.at(-1)!.get('sortType')).toBe('PRICE_ASC')
})

test('더 보기로 다음 페이지를 이어 붙이고, 조건을 바꾸면 첫 페이지부터 다시 보여 준다', async () => {
  const requests = searchReturns([
    { content: [mug], hasNext: true, totalElements: 2 },
    { content: [towel], hasNext: false, totalElements: 2 },
  ])
  const user = userEvent.setup()

  renderProducts('/products')
  await screen.findByText('스테인리스 머그 350ml')

  await user.click(screen.getByRole('button', { name: '더 보기' }))
  expect(await screen.findByText('면 행주 3장 묶음')).toBeInTheDocument()
  expect(screen.getByText('스테인리스 머그 350ml')).toBeInTheDocument()
  expect(requests.at(-1)!.get('page')).toBe('1')
  expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument()

  await user.selectOptions(screen.getByRole('combobox', { name: '정렬' }), '높은 가격순')
  await waitFor(() => expect(screen.queryByText('면 행주 3장 묶음')).not.toBeInTheDocument())
  expect(screen.getByText('스테인리스 머그 350ml')).toBeInTheDocument()
  expect(requests.at(-1)!.get('page')).toBe('0')
  expect(requests.at(-1)!.get('sortType')).toBe('PRICE_DESC')
})
