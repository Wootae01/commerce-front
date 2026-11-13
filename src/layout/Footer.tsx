import { SHOP_NAME } from '../shop'

export function Footer() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="page grid gap-2 py-8 text-small text-graphite md:grid-cols-2">
        <p className="font-medium text-ink">{SHOP_NAME}</p>
        <p className="max-w-prose md:justify-self-end md:text-right">
          포트폴리오용 데모 상점입니다. 토스페이먼츠 테스트 결제로 동작해 실제로 돈이 나가지 않습니다.
        </p>
      </div>
    </footer>
  )
}
