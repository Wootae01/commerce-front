import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const BACKEND = 'http://localhost:8080'

// 배포 사이트와 같은 출처로 보이도록, Spring이 맡는 경로만 백엔드로 넘긴다.
// /login: 네이버 콜백(/login/oauth2/...)과 local 개발용 로그인 화면·폼. React 로그인 화면은 /signin이다
// Host 헤더를 바꾸지 않아야(changeOrigin: false) Spring이 만드는 리다이렉트 주소가 5173을 가리킨다.
const backendPaths = ['/api', '/oauth2', '/login', '/logout', '/uploads', '/images']

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(backendPaths.map((path) => [path, { target: BACKEND }])),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
