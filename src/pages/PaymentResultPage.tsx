import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import { api, ApiError } from '../api/client'
import type { PaymentResult } from '../api/types'
import { signInUrl, useMe } from '../auth/auth'
import { cartQueryKey } from '../cart/useCart'
import { Price } from '../ui/Price'

// 결제 결과 화면. 용어는 GLOSSARY.md를 따른다: 결제 실패(+ 실패 이유), 결과 모름

type Outcome =
  | { kind: 'confirming' }
  | { kind: 'paid'; result: PaymentResult }
  // 결과 모름: 토스가 승인했는지 아직 알 수 없다. 실패가 아니다
  | { kind: 'unknown'; orderNumber: string; stillUnknown?: boolean }
  | { kind: 'failed'; reason: string }
  | { kind: 'problem'; message: string }

const DEFAULT_FAILURE = '결제 승인에 실패했습니다.'

// 결제 결과 조회로 확정된 결과를 화면 상태로 바꾼다
function outcomeOf(result: PaymentResult, fallbackMessage: string): Outcome {
  switch (result.orderStatus) {
    case 'PAID':
    case 'PREPARING':
    case 'SHIPPING':
    case 'DELIVERED':
      return { kind: 'paid', result }
    case 'PAYMENT_PENDING':
      return { kind: 'unknown', orderNumber: result.orderNumber }
    case 'PAYMENT_FAILED':
      return { kind: 'failed', reason: result.failureMessage ?? DEFAULT_FAILURE }
    default:
      return { kind: 'problem', message: fallbackMessage }
  }
}

async function fetchResult(orderNumber: string) {
  return (await api<PaymentResult>(`/api/payments/${encodeURIComponent(orderNumber)}`)).data
}

// 토스가 successUrl?paymentKey&orderId&amount로 보낸다. 이 값으로 백엔드에 결제 승인을 요청한다
export function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { isLoggedIn, isPending: mePending } = useMe()
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'confirming' })
  const started = useRef(false)

  const paymentKey = params.get('paymentKey')
  const orderId = params.get('orderId')
  const amount = Number(params.get('amount'))
  const complete = Boolean(paymentKey && orderId && Number.isInteger(amount) && amount > 0)

  useEffect(() => {
    // 개발 모드에서 effect가 두 번 돌아도 승인은 한 번만 요청한다(백엔드도 같은 paymentKey면 결과를 그대로 돌려준다)
    if (!isLoggedIn || !complete || started.current) return
    started.current = true

    api<PaymentResult>('/api/payments/confirm', { method: 'POST', body: { paymentKey, orderId, amount } })
      .then(({ status, data }) => {
        if (status === 202) {
          setOutcome({ kind: 'unknown', orderNumber: data.orderNumber })
          return
        }
        setOutcome(outcomeOf(data, DEFAULT_FAILURE))
      })
      .catch(async (error: unknown) => {
        const message = error instanceof ApiError ? error.message : '결제를 확인하지 못했습니다.'
        // 400: 결제 실패(메시지가 실패 이유). 결제되지 않았다
        if (error instanceof ApiError && error.status === 400) {
          setOutcome({ kind: 'failed', reason: message })
          return
        }
        // 409: 이미 처리된 주문. 앞선 요청에서 결제가 끝났을 수 있으므로 실제 결과를 본다
        if (error instanceof ApiError && error.status === 409 && orderId) {
          try {
            setOutcome(outcomeOf(await fetchResult(orderId), message))
            return
          } catch {
            // 조회도 실패하면 처음 오류를 보여 준다
          }
        }
        setOutcome({ kind: 'problem', message })
      })
  }, [isLoggedIn, complete, paymentKey, orderId, amount])

  // 장바구니 주문은 결제가 끝나면 주문한 상품이 장바구니에서 빠진다
  useEffect(() => {
    if (outcome.kind === 'paid') void queryClient.invalidateQueries({ queryKey: cartQueryKey })
  }, [outcome.kind, queryClient])

  if (mePending) return null
  if (!isLoggedIn) return <Navigate to={signInUrl(location.pathname + location.search)} replace />
  if (!complete) {
    return <Problem message="결제 정보가 올바르지 않습니다. 주문내역에서 결제 결과를 확인해 주세요." />
  }

  async function recheck(orderNumber: string) {
    try {
      const next = outcomeOf(await fetchResult(orderNumber), '결제 결과를 확인하지 못했습니다.')
      setOutcome(next.kind === 'unknown' ? { ...next, stillUnknown: true } : next)
    } catch {
      // 조회가 실패해도 결과 모름은 그대로다. 다시 확인할 수 있게 둔다
      setOutcome({ kind: 'unknown', orderNumber, stillUnknown: true })
    }
  }

  switch (outcome.kind) {
    case 'confirming':
      return (
        <ResultLayout title="결제를 확인하고 있습니다">
          <p className="text-body text-graphite" aria-live="polite">
            잠시만 기다려 주세요. 이 화면을 닫거나 다시 결제하지 마세요.
          </p>
        </ResultLayout>
      )
    case 'paid':
      return <Paid result={outcome.result} />
    case 'unknown':
      return <Unknown orderNumber={outcome.orderNumber} stillUnknown={outcome.stillUnknown} onRecheck={recheck} />
    case 'failed':
      return <Failed reason={outcome.reason} />
    case 'problem':
      return <Problem message={outcome.message} />
  }
}

// 토스 결제창에서 실패하면 failUrl?code&message&orderId로 온다. 백엔드 승인까지 가지 않은 경우다
export function PaymentFailPage() {
  const [params] = useSearchParams()
  const code = params.get('code')

  if (code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL') {
    return (
      <ResultLayout title="결제를 취소했습니다">
        <p className="text-body text-graphite">결제하지 않았으므로 주문이 진행되지 않았습니다.</p>
        <Actions>
          <PrimaryLink to="/cart">장바구니로 가기</PrimaryLink>
        </Actions>
      </ResultLayout>
    )
  }
  return <Failed reason={params.get('message') || DEFAULT_FAILURE} />
}

function Paid({ result }: { result: PaymentResult }) {
  return (
    <ResultLayout title="결제가 끝났습니다">
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-3 border-t border-ink pt-4">
        <dt className="text-small text-graphite">결제 금액</dt>
        <dd aria-label="결제 금액" className="text-right">
          <Price value={result.amount} size="headline" />
        </dd>
        {result.method && (
          <>
            <dt className="text-small text-graphite">결제 수단</dt>
            <dd className="text-right">{result.method}</dd>
          </>
        )}
        {result.approvedAt && (
          <>
            <dt className="text-small text-graphite">승인 시각</dt>
            <dd className="num text-right">{result.approvedAt}</dd>
          </>
        )}
        <dt className="text-small text-graphite">주문번호</dt>
        <dd className="num break-all text-right text-small">{result.orderNumber}</dd>
      </dl>
      <Actions>
        <PrimaryLink to={`/orders/${encodeURIComponent(result.orderNumber)}`}>주문 상세 보기</PrimaryLink>
        <SecondaryLink to="/">쇼핑 계속하기</SecondaryLink>
      </Actions>
    </ResultLayout>
  )
}

function Unknown({
  orderNumber,
  stillUnknown,
  onRecheck,
}: {
  orderNumber: string
  stillUnknown?: boolean
  onRecheck: (orderNumber: string) => Promise<void>
}) {
  const [checking, setChecking] = useState(false)
  return (
    <ResultLayout title="결제 결과를 확인하고 있습니다">
      <p className="rounded-control bg-pending-bg px-4 py-3 text-body text-pending">
        결제를 요청했지만 결과를 아직 받지 못했습니다. 다시 결제하지 말고 잠시 뒤 결과를 확인해 주세요. 주문내역에서도
        확인할 수 있습니다.
      </p>
      <div aria-live="polite">
        {stillUnknown && (
          <p className="text-small text-graphite">아직 결과가 나오지 않았습니다. 잠시 뒤 다시 확인해 주세요.</p>
        )}
      </div>
      <Actions>
        <button
          type="button"
          disabled={checking}
          onClick={async () => {
            setChecking(true)
            await onRecheck(orderNumber)
            setChecking(false)
          }}
          className="inline-flex h-12 items-center justify-center rounded-control bg-ink px-6 font-medium text-paper disabled:bg-rule disabled:text-graphite"
        >
          결과 다시 확인
        </button>
        <SecondaryLink to="/orders">주문내역 보기</SecondaryLink>
      </Actions>
    </ResultLayout>
  )
}

function Failed({ reason }: { reason: string }) {
  return (
    <ResultLayout title="결제하지 못했습니다">
      <p className="rounded-control bg-danger-bg px-4 py-3 text-body text-danger">{reason}</p>
      <p className="text-small text-graphite">결제되지 않았습니다. 장바구니에서 다시 주문할 수 있습니다.</p>
      <Actions>
        <PrimaryLink to="/cart">장바구니로 가기</PrimaryLink>
      </Actions>
    </ResultLayout>
  )
}

function Problem({ message }: { message: string }) {
  return (
    <ResultLayout title="결제를 확인하지 못했습니다">
      <p className="text-body text-graphite">{message}</p>
      <Actions>
        <PrimaryLink to="/orders">주문내역 보기</PrimaryLink>
      </Actions>
    </ResultLayout>
  )
}

function ResultLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="page pt-16 md:pt-24">
      <div className="grid max-w-lg gap-6">
        <h1 className="text-headline font-bold tracking-[-0.03em]">{title}</h1>
        {children}
      </div>
    </section>
  )
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3">{children}</div>
}

function PrimaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex h-12 items-center rounded-control bg-ink px-6 font-medium text-paper">
      {children}
    </Link>
  )
}

function SecondaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex h-12 items-center rounded-control border border-ink px-6 font-medium">
      {children}
    </Link>
  )
}
