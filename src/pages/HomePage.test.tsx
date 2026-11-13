import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { HomePage } from './HomePage'

test('홈 화면이 그려진다', () => {
  render(<HomePage />)
  expect(screen.getByRole('heading', { name: 'Commerce' })).toBeInTheDocument()
})
