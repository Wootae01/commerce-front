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

// UserDTO: 내 정보. 주문서 배송지 입력란의 초기값으로도 쓴다
export type Me = {
  name: string
  phone: string
  address: string | null
  addressDetail: string | null
  email: string
}
