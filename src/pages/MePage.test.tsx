import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, test } from 'vitest'
import type { Me } from '../api/types'
import { useMe } from '../auth/auth'
import { server } from '../test/server'
import { renderWithClient } from '../test/render'
import { MePage } from './MePage'

const me: Me = {
  name: '홍길동',
  phone: '01012345678',
  address: '서울시 중구 세종대로 110',
  addressDetail: '3층',
  email: 'user@example.com',
}

function loggedIn(user: Me = me) {
  server.use(http.get('/api/users/me', () => HttpResponse.json({ status: 200, data: user })))
}

function CurrentPath() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

function renderMe() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/me']}>
      <Routes>
        <Route path="/me" element={<MePage />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('내 정보로 입력칸을 채우고, 고쳐서 저장하면 백엔드가 돌려준 값으로 다시 보여 준다', async () => {
  loggedIn()
  let saved: unknown
  server.use(
    http.put('/api/users/me', async ({ request }) => {
      saved = await request.json()
      // 백엔드가 저장한 값을 돌려준다(여기서는 상세 주소를 비운 채로 돌려준다고 가정)
      return HttpResponse.json({ status: 200, data: { ...me, name: '김철수', phone: '01098765432', addressDetail: null } })
    }),
  )
  const user = userEvent.setup()

  renderMe()

  const name = await screen.findByLabelText('이름')
  expect(name).toHaveValue('홍길동')
  expect(screen.getByLabelText('연락처')).toHaveValue('01012345678')
  expect(screen.getByLabelText('이메일')).toHaveValue('user@example.com')
  expect(screen.getByLabelText('주소')).toHaveValue('서울시 중구 세종대로 110')
  expect(screen.getByLabelText('상세 주소')).toHaveValue('3층')

  await user.clear(name)
  await user.type(name, '김철수')
  await user.clear(screen.getByLabelText('연락처'))
  await user.type(screen.getByLabelText('연락처'), '010-9876-5432')
  await user.click(screen.getByRole('button', { name: '저장' }))

  expect(await screen.findByRole('status')).toHaveTextContent('저장했습니다')
  expect(saved).toEqual({
    name: '김철수',
    phone: '01098765432',
    address: '서울시 중구 세종대로 110',
    addressDetail: '3층',
    email: 'user@example.com',
  })
  await waitFor(() => expect(screen.getByLabelText('상세 주소')).toHaveValue(''))
})

test('이름이 비었거나 연락처·이메일 형식이 틀리면 저장하지 않고 칸마다 이유를 알려 준다', async () => {
  loggedIn()
  let putCalls = 0
  server.use(
    http.put('/api/users/me', () => {
      putCalls += 1
      return HttpResponse.json({ status: 200, data: me })
    }),
  )
  const user = userEvent.setup()

  renderMe()

  await user.clear(await screen.findByLabelText('이름'))
  await user.clear(screen.getByLabelText('연락처'))
  await user.type(screen.getByLabelText('연락처'), '0212345678')
  await user.clear(screen.getByLabelText('이메일'))
  await user.type(screen.getByLabelText('이메일'), 'user@')
  await user.click(screen.getByRole('button', { name: '저장' }))

  expect(screen.getByLabelText('이름')).toHaveAccessibleDescription('이름을 적어 주세요.')
  expect(screen.getByLabelText('연락처')).toHaveAccessibleDescription('010으로 시작하는 숫자 11자리로 적어 주세요.')
  expect(screen.getByLabelText('이메일')).toHaveAccessibleDescription('이메일 형식으로 적어 주세요.')
  expect(putCalls).toBe(0)

  // 고치면 저장한다
  await user.type(screen.getByLabelText('이름'), '홍길동')
  await user.clear(screen.getByLabelText('연락처'))
  await user.type(screen.getByLabelText('연락처'), '01012345678')
  await user.type(screen.getByLabelText('이메일'), 'example.com')
  await user.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByRole('status')).toHaveTextContent('저장했습니다')
  expect(putCalls).toBe(1)
})

test('저장하지 못하면 이유를 보여 주고 입력한 값은 그대로 둔다', async () => {
  loggedIn()
  server.use(
    http.put('/api/users/me', () =>
      HttpResponse.json({ status: 400, message: '이메일 형식이 올바르지 않습니다.' }, { status: 400 }),
    ),
  )
  const user = userEvent.setup()

  renderMe()

  await user.type(await screen.findByLabelText('상세 주소'), ' 301호')
  await user.click(screen.getByRole('button', { name: '저장' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('이메일 형식이 올바르지 않습니다.')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByLabelText('상세 주소')).toHaveValue('3층 301호')
})

// 홈 자리에 두어 로그아웃 뒤 로그인 상태를 본다
function LoginStateProbe() {
  const { isLoggedIn, isPending } = useMe()
  if (isPending) return null
  return <p data-testid="login-state">{isLoggedIn ? '로그인' : '로그아웃'}</p>
}

test('로그아웃하면 로그인 상태를 지우고 홈으로 간다', async () => {
  let loggedOut = false
  server.use(
    http.get('/api/users/me', () =>
      loggedOut
        ? HttpResponse.json({ status: 401, message: '' }, { status: 401 })
        : HttpResponse.json({ status: 200, data: me }),
    ),
    http.post('/api/logout', () => {
      loggedOut = true
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const user = userEvent.setup()

  renderWithClient(
    <MemoryRouter initialEntries={['/me']}>
      <Routes>
        <Route path="/me" element={<MePage />} />
        <Route path="/" element={<LoginStateProbe />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  )

  await user.click(await screen.findByRole('button', { name: '로그아웃' }))

  expect(await screen.findByTestId('login-state')).toHaveTextContent('로그아웃')
  expect(loggedOut).toBe(true)
})
