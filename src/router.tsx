import { createBrowserRouter } from 'react-router'
import { AppLayout } from './layout/AppLayout'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { SignInPage } from './pages/SignInPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/signin', element: <SignInPage /> },
      { path: '/products/:id', element: <ProductDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
