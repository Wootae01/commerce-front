import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { ProductSummary } from '../api/types'
import { ProductCard } from '../products/ProductCard'
import { useFeaturedProducts, usePopularProducts, useProductSearch } from '../products/queries'
import { SHOP_NAME } from '../shop'

const LIST_SIZE = 8

export function HomePage() {
  return (
    <div className="page grid gap-16 pt-6 md:gap-24 md:pt-10">
      <h1 className="sr-only">{SHOP_NAME}</h1>
      <FeaturedSection />
      <PopularOrNewestSection />
    </div>
  )
}

// 추천 상품: 관리자가 고른 순서. 1순위를 크게 두고 나머지를 격자로 채운다.
// 마지막 칸은 전체 상품으로 가는 칸이라, 추천 상품이 8개면 모바일(2열)·데스크톱(4열) 모두 빈칸 없이 맞는다
function FeaturedSection() {
  const featured = useFeaturedProducts()

  return (
    <Section title="추천 상품">
      <Loadable query={featured}>
        {(products) => (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
            {products.map((product, index) =>
              index === 0 ? (
                <ProductCard key={product.id} product={product} large className="col-span-2 md:row-span-2" />
              ) : (
                <ProductCard key={product.id} product={product} />
              ),
            )}
            <AllProductsTile />
          </div>
        )}
      </Loadable>
    </Section>
  )
}

// 추천 격자의 마지막 칸. 사진 빠진 상품으로 보이지 않도록 전체 상품 수를 크게 적고, 이름·가격 줄을 두지 않는다
function AllProductsTile() {
  const all = useProductSearch({ size: 1 })
  const total = all.data?.totalElements

  return (
    <Link
      to="/products"
      aria-label={total === undefined ? '전체 상품 보기' : `전체 상품 ${total}개 보기`}
      className="group flex aspect-square flex-col justify-between bg-ink p-4 text-paper"
    >
      <span className="flex items-baseline gap-1">
        {total !== undefined && (
          <>
            <span className="num text-display font-bold leading-none">{total}</span>
            <span className="text-small">개 상품</span>
          </>
        )}
      </span>
      <span className="text-lead font-bold group-hover:underline underline-offset-4">전체 상품 보기</span>
    </Link>
  )
}

// 인기 상품은 판매량 순위라 순위 숫자를 붙인다. 아직 팔린 상품이 없으면 새로 들어온 상품으로 대신한다
function PopularOrNewestSection() {
  const popular = usePopularProducts(LIST_SIZE)
  const noSales = popular.isSuccess && popular.data.length === 0
  const newest = useProductSearch({ sortType: 'NEWEST', size: LIST_SIZE }, { enabled: noSales })

  if (noSales) {
    return (
      <Section title="새로 들어온 상품">
        <Loadable query={newest}>{(page) => <ProductGrid products={page.content} />}</Loadable>
      </Section>
    )
  }

  return (
    <Section title="인기 상품" note="최근 30일 동안 많이 팔린 순서">
      <Loadable query={popular}>{(products) => <ProductGrid products={products} ranked />}</Loadable>
    </Section>
  )
}

function ProductGrid({ products, ranked = false }: { products: ProductSummary[]; ranked?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} rank={ranked ? index + 1 : undefined} />
      ))}
    </div>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="grid gap-5">
      <div className="flex items-baseline justify-between gap-4 border-b border-ink pb-2">
        <h2 id={id} className="text-title font-bold tracking-[-0.03em]">
          {title}
        </h2>
        {note && <p className="text-small text-graphite">{note}</p>}
      </div>
      {children}
    </section>
  )
}

type QueryState<T> = {
  data: T | undefined
  isPending: boolean
  isError: boolean
  refetch: () => unknown
}

// 불러오는 중에는 진열대 색 칸으로 자리를 잡고, 실패하면 다시 불러올 수 있게 한다
function Loadable<T>({ query, children }: { query: QueryState<T>; children: (data: T) => ReactNode }) {
  if (query.isError) {
    return (
      <div className="grid justify-items-start gap-3 py-6">
        <p className="text-body">상품을 불러오지 못했습니다. 잠시 뒤 다시 불러와 주세요.</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="h-10 rounded-control border border-ink px-4 text-small font-medium"
        >
          다시 불러오기
        </button>
      </div>
    )
  }
  if (query.isPending || query.data === undefined) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-square bg-shelf" />
        ))}
      </div>
    )
  }
  return <>{children(query.data)}</>
}
