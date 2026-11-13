import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { server } from '../test/server'
import { api, ApiError } from './client'

function setCsrfCookie(value: string) {
  document.cookie = `XSRF-TOKEN=${value}; path=/`
}

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

describe('응답', () => {
  test('{ status, data }에서 data를 꺼내고 상태 코드도 돌려준다', async () => {
    server.use(http.get('/api/products/1', () => HttpResponse.json({ status: 200, data: { id: 1 } })))

    const result = await api<{ id: number }>('/api/products/1')

    expect(result).toEqual({ status: 200, data: { id: 1 } })
  })

  test('202(결과 모름)는 오류가 아니라 상태 코드로 구분한다', async () => {
    server.use(
      http.post('/api/payments/confirm', () =>
        HttpResponse.json({ status: 202, data: { orderStatus: 'PAYMENT_PENDING' } }, { status: 202 }),
      ),
    )

    const result = await api('/api/payments/confirm', { method: 'POST', body: {} })

    expect(result.status).toBe(202)
  })

  test('쿼리 파라미터를 붙인다. 값이 없으면 뺀다', async () => {
    let requested = ''
    server.use(
      http.get('/api/products', ({ request }) => {
        requested = new URL(request.url).search
        return HttpResponse.json({ status: 200, data: [] })
      }),
    )

    await api('/api/products', { query: { keyword: '컵', sort: undefined, page: 0 } })

    expect(requested).toBe('?keyword=%EC%BB%B5&page=0')
  })
})

describe('오류', () => {
  test('오류 응답은 상태 코드·메시지·필드 오류를 가진 ApiError로 던진다', async () => {
    server.use(
      http.put('/api/users/me', () =>
        HttpResponse.json(
          { status: 400, message: '입력값이 올바르지 않습니다.', errors: { phone: '형식이 맞지 않습니다.' } },
          { status: 400 },
        ),
      ),
    )
    setCsrfCookie('token')

    const error = await api('/api/users/me', { method: 'PUT', body: {} }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      message: '입력값이 올바르지 않습니다.',
      errors: { phone: '형식이 맞지 않습니다.' },
    })
  })

  test('본문이 JSON이 아니어도 상태 코드로 ApiError를 던진다', async () => {
    server.use(http.get('/api/cart', () => new HttpResponse('Bad Gateway', { status: 502 })))

    const error = await api('/api/cart').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, message: '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요. (502)' })
  })
})

describe('CSRF', () => {
  test('GET이 아닌 요청에는 XSRF-TOKEN 쿠키 값을 X-XSRF-TOKEN 헤더로 붙이고 본문을 JSON으로 보낸다', async () => {
    let header: string | null = null
    let body: unknown = null
    server.use(
      http.post('/api/cart/items', async ({ request }) => {
        header = request.headers.get('X-XSRF-TOKEN')
        body = await request.json()
        return HttpResponse.json({ status: 200, data: null })
      }),
    )
    setCsrfCookie('abc')

    await api('/api/cart/items', { method: 'POST', body: { optionId: 3, quantity: 1 } })

    expect(header).toBe('abc')
    expect(body).toEqual({ optionId: 3, quantity: 1 })
  })

  test('403이면 새로 받은 쿠키로 한 번만 다시 보낸다', async () => {
    const sent: (string | null)[] = []
    server.use(
      http.delete('/api/cart/items/1', ({ request }) => {
        sent.push(request.headers.get('X-XSRF-TOKEN'))
        if (sent.length === 1) {
          // 서버가 거절하면서 새 토큰 쿠키를 내려준 상황
          setCsrfCookie('fresh')
          return HttpResponse.json({ status: 403, message: '권한이 없습니다.' }, { status: 403 })
        }
        return HttpResponse.json({ status: 200, data: null })
      }),
    )
    setCsrfCookie('stale')

    const result = await api('/api/cart/items/1', { method: 'DELETE' })

    expect(sent).toEqual(['stale', 'fresh'])
    expect(result.status).toBe(200)
  })

  test('쿠키가 그대로면 다시 보내지 않고 403을 던진다', async () => {
    let calls = 0
    server.use(
      http.delete('/api/cart/items/1', () => {
        calls += 1
        return HttpResponse.json({ status: 403, message: '권한이 없습니다.' }, { status: 403 })
      }),
    )
    setCsrfCookie('same')

    const error = await api('/api/cart/items/1', { method: 'DELETE' }).catch((e: unknown) => e)

    expect(calls).toBe(1)
    expect(error).toMatchObject({ status: 403 })
  })
})
