import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { formatWon } from './format'
import { Price } from './Price'

test('원 단위로 세 자리마다 쉼표를 찍는다', () => {
  expect(formatWon(0)).toBe('0')
  expect(formatWon(3000)).toBe('3,000')
  expect(formatWon(1234567)).toBe('1,234,567')
})

test('가격은 숫자와 원을 함께 읽히게 그린다', () => {
  render(<Price value={12000} />)
  expect(screen.getByText('12,000')).toBeInTheDocument()
  expect(screen.getByLabelText('12,000원')).toBeInTheDocument()
})
