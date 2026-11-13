import { expect, test } from 'vitest'
import { safeReturnTo } from './auth'

// 백엔드 LoginReturnTo와 같은 규칙: 사이트 안 경로만 받는다
test.each(['/', '/cart', '/products/3?option=1'])('사이트 안 경로 %s는 그대로 쓴다', (path) => {
  expect(safeReturnTo(path)).toBe(path)
})

test.each([null, '', 'cart', '//evil.com', '/\\evil.com', 'https://evil.com', '/cart\nx'])(
  '%s는 홈으로 바꾼다',
  (value) => {
    expect(safeReturnTo(value)).toBe('/')
  },
)
