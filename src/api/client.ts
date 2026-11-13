// 백엔드 /api 호출. 성공 응답은 { status, data }, 오류 응답은 { status, message, errors }다.
// 세션 쿠키로 인증하고(같은 출처), GET이 아닌 요청에는 XSRF-TOKEN 쿠키 값을 X-XSRF-TOKEN 헤더로 붙인다.

const CSRF_COOKIE = 'XSRF-TOKEN'
const CSRF_HEADER = 'X-XSRF-TOKEN'

export type ApiResult<T> = {
  // 200·201 외에 202(결과 모름, 취소 처리 중)를 화면이 구분해야 해서 함께 돌려준다
  status: number
  data: T
}

export class ApiError extends Error {
  readonly status: number
  // 입력값 검증 실패 때 필드별 메시지
  readonly errors?: Record<string, string>

  constructor(status: number, message: string, errors?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type QueryValue = string | number | boolean | undefined | null

export type ApiOptions = {
  method?: Method
  body?: unknown
  query?: Record<string, QueryValue>
  signal?: AbortSignal
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const method = options.method ?? 'GET'
  const url = buildUrl(path, options.query)
  const token = readCookie(CSRF_COOKIE)

  let response = await send(url, method, options, token)

  // 세션이 바뀌어 토큰이 맞지 않으면 서버가 403과 함께 새 토큰 쿠키를 내려준다. 새 토큰으로 한 번만 다시 보낸다.
  // 403으로 거절된 요청은 처리되지 않았으므로 다시 보내도 두 번 처리되지 않는다
  if (response.status === 403 && method !== 'GET') {
    const freshToken = readCookie(CSRF_COOKIE)
    if (freshToken && freshToken !== token) {
      response = await send(url, method, options, freshToken)
    }
  }

  const body = await readJson(response)
  if (!response.ok) {
    // 서버가 메시지를 주지 않으면(게이트웨이 오류 등) HTTP 상태 문구 대신 한국어 안내를 쓴다
    throw new ApiError(
      response.status,
      messageOf(body) ?? `요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요. (${response.status})`,
      errorsOf(body),
    )
  }
  return { status: response.status, data: (body as { data: T } | null)?.data as T }
}

function send(url: string, method: Method, options: ApiOptions, token: string | undefined) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (method !== 'GET' && token) {
    headers[CSRF_HEADER] = token
  }
  return fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'same-origin',
    signal: options.signal,
  })
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(path, window.location.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

function readCookie(name: string) {
  const prefix = `${name}=`
  const found = document.cookie.split('; ').find((part) => part.startsWith(prefix))
  return found ? decodeURIComponent(found.slice(prefix.length)) || undefined : undefined
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function messageOf(body: unknown) {
  const message = (body as { message?: unknown } | null)?.message
  return typeof message === 'string' ? message : undefined
}

function errorsOf(body: unknown) {
  const errors = (body as { errors?: unknown } | null)?.errors
  return errors && typeof errors === 'object' ? (errors as Record<string, string>) : undefined
}
