// 백엔드 응답 모양. 이름은 백엔드 DTO와 GLOSSARY.md를 따른다

// PageResponse: 목록 응답
export type Page<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
}

// ProductHomeDTO: 목록에 보이는 상품 하나
export type ProductSummary = {
  id: number
  // 사진이 없으면 기본 이미지 경로(/images/default.png)
  mainImageUrl: string
  name: string
  price: number
}

// ProductOptionDTO: 판매 중인 옵션. 단가 = 상품 가격 + 추가금
export type ProductOption = {
  id: number
  name: string
  stock: number
  additionalPrice: number
}

// ProductDetailDTO
export type ProductDetail = {
  id: number
  name: string
  price: number
  mainImageUrl: string
  // 메인 사진을 뺀 나머지 사진
  images: string[]
  description: string | null
  options: ProductOption[]
}

// ProductSortType
export type ProductSort = 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'BEST_SELLING'

// CartProductDTO: 장바구니에 담긴 상품 한 줄
export type CartItem = {
  id: number
  checked: boolean
  quantity: number
  // 단가(상품 가격 + 옵션 추가금)
  price: number
  mainImageUrl: string
  name: string
  optionName: string | null
}

// CartResponse. productsTotal은 선택한 상품의 상품 합계(배송비 제외)
export type Cart = {
  items: CartItem[]
  productsTotal: number
}

// OrderType: 장바구니 주문 / 바로구매
export type OrderType = 'CART' | 'BUY_NOW'

// OrderItemDTO: 주문 상품 한 줄. 장바구니 주문이면 id가 장바구니 상품 id다
export type OrderItem = {
  id: number
  quantity: number
  unitPrice: number
  // 상품별 합계(단가 × 수량)
  lineTotal: number
  mainImageUrl: string
  name: string
  optionName: string | null
}

// OrderPriceDTO: 결제 금액 = 상품 합계 + 배송비
export type OrderPrice = {
  productsTotal: number
  deliveryFee: number
  finalPrice: number
}

// OrderCheckoutResponse: 주문서
export type Checkout = {
  orderType: OrderType
  items: OrderItem[]
  // 배송지 입력란의 초기값
  orderer: {
    name: string | null
    phone: string | null
    address: string | null
    addressDetail: string | null
    customerKey: string | null
  }
  orderPrice: OrderPrice
  tossClientKey: string
}

// OrderPrepareResponseDTO: 결제하기를 누르면 만들어진 결제 준비 주문. 이 값으로 토스 결제를 요청한다
export type PreparedOrder = {
  orderId: string
  orderName: string
  amount: number
  customerName: string | null
  customerMobilePhone: string | null
}

// UserDTO: 내 정보. 주문서 배송지 입력란의 초기값으로도 쓴다
export type Me = {
  name: string
  phone: string
  address: string | null
  addressDetail: string | null
  email: string
}
