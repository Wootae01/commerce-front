import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

// 테스트마다 캐시를 새로 쓰고, 실패를 다시 시도하지 않는다
export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function wrapperWith(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

export function renderWithClient(ui: ReactElement, client = createTestQueryClient()) {
  return { client, ...render(ui, { wrapper: wrapperWith(client) }) }
}

export function renderHookWithClient<T>(hook: () => T, client = createTestQueryClient()) {
  return { client, ...renderHook(hook, { wrapper: wrapperWith(client) }) }
}
