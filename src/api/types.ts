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

// UserDTO: 내 정보. 주문서 배송지 입력란의 초기값으로도 쓴다
export type Me = {
  name: string
  phone: string
  address: string | null
  addressDetail: string | null
  email: string
}
