import { useInfiniteQuery } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '../api/client'
import type { Page, ProductSort, ProductSummary } from '../api/types'
import { ProductCard } from '../products/ProductCard'

const PAGE_SIZE = 21

// 검색 조건은 주소 쿼리에 둔다. 새로고침·뒤로 가기·링크 공유에도 같은 결과가 나온다
function readSearch(params: URLSearchParams) {
  return {
    keyword: params.get('keyword') ?? undefined,
    minPrice: params.get('minPrice') ?? undefined,
    maxPrice: params.get('maxPrice') ?? undefined,
    sortType: params.get('sortType') ?? undefined,
    salesPeriod: params.get('salesPeriod') ?? undefined,
  }
}

export function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const search = readSearch(params)

  const products = useInfiniteQuery({
    queryKey: ['products', 'search', 'list', search],
    queryFn: async ({ pageParam }) =>
      (await api<Page<ProductSummary>>('/api/products', { query: { ...search, page: pageParam, size: PAGE_SIZE } }))
        .data,
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
  })

  const list = products.data?.pages.flatMap((page) => page.content) ?? []
  const total = products.data?.pages[0]?.totalElements

  return (
    <div className="page grid gap-8 pt-6 md:pt-10">
      <header className="grid gap-1">
        <h1 className="text-headline font-bold tracking-[-0.03em]">
          {search.keyword ? `‘${search.keyword}’ 검색 결과` : '전체 상품'}
        </h1>
        {total !== undefined && (
          <p role="status" className="text-small text-graphite">
            <span className="num text-ink">{total}</span>개
          </p>
        )}
      </header>

      <Filters params={params} onChange={setParams} />

      {products.isError ? (
        <div className="grid justify-items-start gap-3">
          <p className="text-body">상품을 불러오지 못했습니다. 잠시 뒤 다시 불러와 주세요.</p>
          <button
            type="button"
            onClick={() => products.refetch()}
            className="h-10 rounded-control border border-ink px-4 text-small font-medium"
          >
            다시 불러오기
          </button>
        </div>
      ) : products.isPending ? (
        <div className="h-40 bg-shelf" aria-busy="true" />
      ) : list.length === 0 ? (
        <p className="text-lead">조건에 맞는 상품이 없습니다. 검색어나 가격을 바꿔 보세요.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
          {list.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
      {products.hasNextPage && !products.isError && (
        <button
          type="button"
          onClick={() => products.fetchNextPage()}
          disabled={products.isFetchingNextPage}
          className="h-12 justify-self-center rounded-control border border-ink px-8 font-medium disabled:text-graphite"
        >
          더 보기
        </button>
      )}
    </div>
  )
}

// 정렬 이름은 백엔드 ProductSortType 문구를 따른다
const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'NEWEST', label: '최신순' },
  { value: 'PRICE_ASC', label: '낮은 가격순' },
  { value: 'PRICE_DESC', label: '높은 가격순' },
  { value: 'BEST_SELLING', label: '판매량순' },
]

// 판매량을 셀 기간. 백엔드 SalesPeriod 문구를 따르고, 기본은 최근 1개월
const PERIODS = [
  { value: 'WEEK', label: '최근 1주일' },
  { value: 'MONTH', label: '최근 1개월' },
  { value: 'SIX_MONTHS', label: '최근 6개월' },
]

const selectClass = 'h-10 rounded-control border border-rule bg-paper px-3 text-small focus:border-ink'
const priceClass = 'num h-10 w-28 rounded-control border border-rule bg-paper px-3 text-small focus:border-ink'

function Filters({ params, onChange }: { params: URLSearchParams; onChange: (next: URLSearchParams) => void }) {
  const sortType = params.get('sortType') ?? 'NEWEST'

  // 조건 하나를 바꾸고 나머지(검색어 등)는 그대로 둔다. 비운 값은 주소에서 뺀다
  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    onChange(next)
  }

  function onSortChange(value: string) {
    // 판매량순이 아니면 기간은 뜻이 없으므로 주소에서 뺀다
    update({ sortType: value === 'NEWEST' ? null : value, ...(value === 'BEST_SELLING' ? {} : { salesPeriod: null }) })
  }

  function onPriceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    update({
      minPrice: form.get('minPrice')?.toString().trim() ?? null,
      maxPrice: form.get('maxPrice')?.toString().trim() ?? null,
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-3 border-y border-rule py-3">
      <select
        aria-label="정렬"
        value={sortType}
        onChange={(event) => onSortChange(event.target.value)}
        className={selectClass}
      >
        {SORTS.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </select>
      {sortType === 'BEST_SELLING' && (
        <select
          aria-label="판매 기간"
          value={params.get('salesPeriod') ?? 'MONTH'}
          onChange={(event) => update({ salesPeriod: event.target.value })}
          className={selectClass}
        >
          {PERIODS.map((period) => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
        </select>
      )}
      {/* 주소가 바뀌면(뒤로 가기 등) 입력칸도 주소 값으로 다시 채운다 */}
      <form
        key={`${params.get('minPrice')}-${params.get('maxPrice')}`}
        onSubmit={onPriceSubmit}
        className="flex items-center gap-2"
      >
        <input
          type="number"
          name="minPrice"
          min={0}
          inputMode="numeric"
          aria-label="최저 가격"
          placeholder="최저 가격"
          defaultValue={params.get('minPrice') ?? ''}
          className={priceClass}
        />
        <span aria-hidden="true" className="text-graphite">~</span>
        <input
          type="number"
          name="maxPrice"
          min={0}
          inputMode="numeric"
          aria-label="최고 가격"
          placeholder="최고 가격"
          defaultValue={params.get('maxPrice') ?? ''}
          className={priceClass}
        />
        <button type="submit" aria-label="가격 적용" className="h-10 rounded-control border border-ink px-4 text-small font-medium">
          적용
        </button>
      </form>
    </div>
  )
}
