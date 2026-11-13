import { createBrowserRouter } from 'react-router'
import { AppLayout } from './layout/AppLayout'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PaymentFailPage, PaymentSuccessPage } from './pages/PaymentResultPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { SignInPage } from './pages/SignInPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/signin', element: <SignInPage /> },
      { path: '/products/:id', element: <ProductDetailPage /> },
      { path: '/cart', element: <CartPage /> },
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/payment/success', element: <PaymentSuccessPage /> },
      { path: '/payment/fail', element: <PaymentFailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
