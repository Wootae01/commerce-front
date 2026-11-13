import { waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, test } from 'vitest'
import { server } from '../test/server'
import { renderHookWithClient } from '../test/render'
import { loginUrl, useMe } from './auth'

const me = { name: '홍길동', phone: '01012345678', address: '서울', addressDetail: '101호', email: 'user@example.com' }

describe('useMe', () => {
  test('내 정보가 200이면 로그인 상태이고 내 정보를 준다', async () => {
    server.use(http.get('/api/users/me', () => HttpResponse.json({ status: 200, data: me })))

    const { result } = renderHookWithClient(() => useMe())

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.isLoggedIn).toBe(true)
    expect(result.current.me).toEqual(me)
  })

  test('401이면 오류가 아니라 로그아웃 상태다', async () => {
    server.use(
      http.get('/api/users/me', () =>
        HttpResponse.json({ status: 401, message: '로그인이 필요합니다.' }, { status: 401 }),
      ),
    )

    const { result } = renderHookWithClient(() => useMe())

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.isLoggedIn).toBe(false)
    expect(result.current.me).toBeNull()
    expect(result.current.isError).toBe(false)
  })

  test('그 밖의 오류는 로그아웃으로 보지 않고 오류로 둔다', async () => {
    server.use(http.get('/api/users/me', () => new HttpResponse(null, { status: 500 })))

    const { result } = renderHookWithClient(() => useMe())

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.isError).toBe(true)
    expect(result.current.isLoggedIn).toBe(false)
  })
})

describe('loginUrl', () => {
  test('네이버 로그인으로 보내고 돌아올 경로를 returnTo로 넘긴다', () => {
    expect(loginUrl('/products/3?option=1')).toBe(
      '/oauth2/authorization/naver?returnTo=%2Fproducts%2F3%3Foption%3D1',
    )
  })
})
