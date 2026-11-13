import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import type { Me } from '../api/types'

export const meQueryKey = ['me'] as const

// 로그인 여부는 내 정보 조회로 판단한다. 401은 오류가 아니라 로그아웃 상태다
async function fetchMe(): Promise<Me | null> {
  try {
    return (await api<Me>('/api/users/me')).data
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }
    throw error
  }
}

export function useMe() {
  const query = useQuery({ queryKey: meQueryKey, queryFn: fetchMe, staleTime: 5 * 60 * 1000 })
  const me = query.data ?? null
  return {
    me,
    isLoggedIn: me !== null,
    isPending: query.isPending,
    isError: query.isError,
  }
}

// 네이버 로그인을 시작한다. 로그인에 성공하면 백엔드가 returnTo 경로로 돌려보낸다(사이트 안 경로만)
export function loginUrl(returnTo: string) {
  return `/oauth2/authorization/naver?returnTo=${encodeURIComponent(returnTo)}`
}

// 로그인 화면 주소. Spring의 /login과 겹치지 않게 /signin을 쓴다
export function signInUrl(returnTo: string) {
  return `/signin?returnTo=${encodeURIComponent(returnTo)}`
}

// 백엔드 LoginReturnTo와 같은 규칙. "//host"나 "/\host"는 브라우저가 다른 사이트로 읽으므로 홈으로 바꾼다
export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/'
  }
  if ([...value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f)) {
    return '/'
  }
  return value
}
