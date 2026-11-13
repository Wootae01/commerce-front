import { Navigate, useSearchParams } from 'react-router'
import { loginUrl, safeReturnTo, useMe } from '../auth/auth'

// 로그인 화면. Spring의 GET·POST /login과 겹치지 않게 /signin에 둔다
export function SignInPage() {
  const [params] = useSearchParams()
  const returnTo = safeReturnTo(params.get('returnTo'))
  const { isLoggedIn, isPending } = useMe()

  if (isPending) {
    return null
  }
  if (isLoggedIn) {
    return <Navigate to={returnTo} replace />
  }

  return (
    <section className="page pt-16 md:pt-24">
      <div className="grid max-w-md gap-8">
        <div className="grid gap-3">
          <h1 className="text-headline font-bold tracking-[-0.03em]">로그인</h1>
          <p className="text-body text-graphite">
            네이버 계정으로 로그인합니다. 처음이면 네이버에 등록된 이름·연락처로 바로 가입됩니다.
          </p>
        </div>

        {/* 네이버 로그인 버튼은 네이버 브랜드 색(#03C75A)을 따른다 */}
        <a
          href={loginUrl(returnTo)}
          className="flex h-12 items-center justify-center gap-3 rounded-control bg-[#03C75A] px-6 font-bold text-white"
        >
          <span aria-hidden="true" className="num text-lead font-black">
            N
          </span>
          네이버로 로그인
        </a>

        {import.meta.env.DEV && (
          <p className="border-t border-rule pt-4 text-small text-graphite">
            개발 서버에서는{' '}
            <a href="/login" className="font-medium text-ink underline underline-offset-4">
              개발용 아이디로 로그인
            </a>
            할 수 있습니다(user0~user999). 로그인한 뒤 홈으로 돌아옵니다.
          </p>
        )}
      </div>
    </section>
  )
}
