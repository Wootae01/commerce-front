import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, test } from 'vitest'
import { server } from '../test/server'
import { renderWithClient } from '../test/render'
import { SignInPage } from './SignInPage'

const me = { name: '홍길동', phone: '01012345678', address: null, addressDetail: null, email: 'user@example.com' }

function loggedOut() {
  server.use(
    http.get('/api/users/me', () => HttpResponse.json({ status: 401, message: '로그인이 필요합니다.' }, { status: 401 })),
  )
}

function CurrentPath() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

function renderAt(path: string) {
  return renderWithClient(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('네이버 로그인 버튼이 돌아갈 경로를 백엔드에 넘긴다', async () => {
  loggedOut()

  renderAt('/signin?returnTo=%2Fcart')

  expect(await screen.findByRole('link', { name: '네이버로 로그인' })).toHaveAttribute(
    'href',
    '/oauth2/authorization/naver?returnTo=%2Fcart',
  )
})

test('돌아갈 경로가 사이트 밖이면 홈으로 돌아오게 한다', async () => {
  loggedOut()

  renderAt('/signin?returnTo=%2F%2Fevil.com')

  expect(await screen.findByRole('link', { name: '네이버로 로그인' })).toHaveAttribute(
    'href',
    '/oauth2/authorization/naver?returnTo=%2F',
  )
})

test('이미 로그인했으면 돌아갈 경로로 바로 보낸다', async () => {
  server.use(http.get('/api/users/me', () => HttpResponse.json({ status: 200, data: me })))

  renderAt('/signin?returnTo=%2Forders')

  expect(await screen.findByTestId('path')).toHaveTextContent('/orders')
})
