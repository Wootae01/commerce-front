import { setupServer } from 'msw/node'

// 테스트마다 server.use(...)로 필요한 API 응답을 붙인다.
export const server = setupServer()
