const won = new Intl.NumberFormat('ko-KR')

// 12000 → "12,000"
export function formatWon(value: number) {
  return won.format(value)
}
