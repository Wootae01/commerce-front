import { useId } from 'react'

// 이름표·입력칸·오류 문구 한 벌. 오류가 있으면 입력칸이 오류 문구를 설명으로 가리킨다
export function Field({
  label,
  value,
  error,
  onChange,
  type = 'text',
  ...input
}: {
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
  type?: string
  inputMode?: 'numeric' | 'email'
  autoComplete?: string
  placeholder?: string
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-small font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`h-11 rounded-control border px-3 text-body outline-none focus:border-ink ${
          error ? 'border-danger' : 'border-rule'
        }`}
        {...input}
      />
      {error && (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
