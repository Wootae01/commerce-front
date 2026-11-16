import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// 배포 사이트와 같은 출처로 보이도록, Spring이 맡는 경로만 백엔드로 넘긴다.
// /login: 네이버 콜백(/login/oauth2/...)과 local 개발용 로그인 화면·폼. React 로그인 화면은 /signin이다
// Host 헤더를 바꾸지 않아야(changeOrigin: false) Spring이 만드는 리다이렉트 주소가 5173을 가리킨다.
const backendPaths = ['/api', '/oauth2', '/login', '/logout', '/uploads', '/images']

export default defineConfig(({ mode }) => {
  // 백엔드가 8080이 아닌 곳(예: Docker 블루그린의 8082)에 떠 있으면 BACKEND_URL로 바꾼다.
  // 셸 환경변수나 .env.local에 둘 수 있다. VITE_ 접두사가 아니라 브라우저 코드에는 노출되지 않는다.
  const backend = loadEnv(mode, process.cwd(), '').BACKEND_URL || 'http://localhost:8080'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: Object.fromEntries(backendPaths.map((path) => [path, { target: backend }])),
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
