import { Search, ShoppingBag } from 'lucide-react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { signInUrl, useMe } from '../auth/auth'
import { useCart } from '../cart/useCart'
import { SHOP_NAME } from '../shop'

export function Header() {
  return (
    <header className="border-b border-ink bg-paper">
      <div className="page grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 py-3 md:grid-cols-[auto_1fr_auto] md:py-4">
        <Link to="/" className="text-lead font-bold tracking-[-0.04em] md:text-title">
          {SHOP_NAME}
        </Link>
        <SearchForm />
        <AccountLinks />
      </div>
    </header>
  )
}

function SearchForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // 자바스크립트가 없어도 action으로 상품 목록에 간다. 있으면 페이지를 다시 불러오지 않고 이동한다
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const keyword = new FormData(event.currentTarget).get('keyword')?.toString().trim() ?? ''
    navigate(keyword ? `/products?keyword=${encodeURIComponent(keyword)}` : '/products')
  }

  return (
    <form
      role="search"
      action="/products"
      onSubmit={onSubmit}
      className="col-span-2 row-start-2 md:col-span-1 md:row-start-1 md:col-start-2 md:max-w-md"
    >
      <label className="flex items-center gap-2 rounded-control border border-rule px-3 focus-within:border-ink">
        <Search size={18} aria-hidden="true" className="shrink-0 text-graphite" />
        <input
          type="search"
          name="keyword"
          aria-label="상품 검색"
          placeholder="찾는 물건"
          defaultValue={params.get('keyword') ?? ''}
          className="h-10 w-full bg-transparent text-body outline-none placeholder:text-graphite"
        />
      </label>
    </form>
  )
}

function AccountLinks() {
  const { isLoggedIn, isPending } = useMe()
  const location = useLocation()

  // 로그인 여부를 모르는 동안은 자리만 잡아 둬서 헤더가 흔들리지 않게 한다
  if (isPending) {
    return <div className="h-10 w-24" aria-hidden="true" />
  }

  const linkClass = 'text-small font-medium hover:underline underline-offset-4'

  return (
    <nav aria-label="내 쇼핑" className="flex items-center gap-4 justify-self-end">
      {isLoggedIn ? (
        <>
          <Link to="/orders" className={linkClass}>
            주문내역
          </Link>
          <Link to="/me" className={linkClass}>
            내 정보
          </Link>
          <CartLink />
        </>
      ) : (
        <Link to={signInUrl(location.pathname + location.search)} className={linkClass}>
          로그인
        </Link>
      )}
    </nav>
  )
}

function CartLink() {
  const { data: cart } = useCart()
  const count = cart?.items.length

  return (
    <Link
      to="/cart"
      aria-label={count === undefined ? '장바구니' : `장바구니, 상품 ${count}개`}
      className="flex h-10 items-center gap-1.5 rounded-control bg-ink px-3 text-paper"
    >
      <ShoppingBag size={18} aria-hidden="true" />
      {count !== undefined && <span className="num text-small font-bold">{count}</span>}
    </Link>
  )
}
