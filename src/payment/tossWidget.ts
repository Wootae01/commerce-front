import { ANONYMOUS, loadTossPayments } from '@tosspayments/tosspayments-sdk'

// 토스 결제위젯을 이 파일 뒤에 감춘다. 화면은 이 모양만 알고, 테스트는 이 파일을 가짜로 바꾼다

export type PaymentWidget = {
  setAmount: (value: number) => Promise<void>
  requestPayment: (request: {
    orderId: string
    orderName: string
    customerName: string | null
    customerMobilePhone: string | null
  }) => Promise<void>
  // 화면을 떠날 때 그린 결제 수단·약관을 지운다
  destroy: () => Promise<void>
}

type MountOptions = {
  clientKey: string
  // 결제 고객 키. 없으면 비회원 결제로 연다
  customerKey: string | null
  amount: number
  methodsSelector: string
  agreementSelector: string
}

// 결제가 끝나면 토스가 이 주소로 보낸다. successUrl에는 paymentKey·orderId·amount, failUrl에는 code·message·orderId가 붙는다
export const PAYMENT_SUCCESS_PATH = '/payment/success'
export const PAYMENT_FAIL_PATH = '/payment/fail'

// 토스는 한 페이지에 결제수단 위젯을 하나만 허용한다. 앞 위젯이 아직 그려지는 중이거나 지워지기 전에 새로 그리면
// "하나의 결제수단 위젯만을 사용할 수 있어요." 오류가 난다(개발 모드에서 effect가 두 번 실행될 때 실제로 남).
// 그래서 앞 위젯이 실패하거나 destroy가 끝날 때까지 기다렸다가 그린다. 그린 위젯은 반드시 destroy해야 다음 위젯이 그려진다
let previousReleased: Promise<void> = Promise.resolve()

export async function mountPaymentWidget(options: MountOptions): Promise<PaymentWidget> {
  const waitForPrevious = previousReleased
  let release!: () => void
  previousReleased = new Promise((resolve) => {
    release = resolve
  })

  let methods: { destroy: () => Promise<void> }
  let agreement: { destroy: () => Promise<void> }
  let widgets: ReturnType<Awaited<ReturnType<typeof loadTossPayments>>['widgets']>
  try {
    await waitForPrevious
    const tossPayments = await loadTossPayments(options.clientKey)
    widgets = tossPayments.widgets({ customerKey: options.customerKey ?? ANONYMOUS })

    await widgets.setAmount({ currency: 'KRW', value: options.amount })
    ;[methods, agreement] = await Promise.all([
      widgets.renderPaymentMethods({ selector: options.methodsSelector }),
      widgets.renderAgreement({ selector: options.agreementSelector }),
    ])
  } catch (error) {
    release()
    throw error
  }

  return {
    destroy: async () => {
      try {
        await Promise.all([methods.destroy(), agreement.destroy()])
      } finally {
        release()
      }
    },
    setAmount: (value) => widgets.setAmount({ currency: 'KRW', value }),
    requestPayment: ({ customerName, customerMobilePhone, ...order }) =>
      widgets.requestPayment({
        ...order,
        customerName: customerName ?? undefined,
        customerMobilePhone: customerMobilePhone ?? undefined,
        successUrl: window.location.origin + PAYMENT_SUCCESS_PATH,
        failUrl: window.location.origin + PAYMENT_FAIL_PATH,
      }),
  }
}

// 구매자가 결제창을 닫은 것. 오류로 보여 주지 않는다
export function isUserCancel(error: unknown) {
  return (error as { code?: unknown } | null)?.code === 'USER_CANCEL'
}
