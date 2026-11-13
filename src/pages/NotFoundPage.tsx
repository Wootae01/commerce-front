import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="page grid gap-6 pt-16 md:pt-24">
      <h1 className="text-headline font-bold tracking-[-0.03em]">찾는 페이지가 없습니다</h1>
      <p className="max-w-prose text-lead text-graphite">
        주소가 바뀌었거나 없는 페이지입니다. 홈에서 다시 찾아보세요.
      </p>
      <div>
        <Link
          to="/"
          className="inline-flex h-12 items-center rounded-control bg-ink px-6 text-body font-medium text-paper"
        >
          홈으로 가기
        </Link>
      </div>
    </section>
  )
}
