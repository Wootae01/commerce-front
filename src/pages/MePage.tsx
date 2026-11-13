import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { api, ApiError } from '../api/client'
import type { Me } from '../api/types'
import { meQueryKey, signInUrl, useLogout, useMe } from '../auth/auth'
import { Field } from '../ui/Field'

export function MePage() {
  const { me, isPending } = useMe()

  if (isPending) return null
  if (!me) return <Navigate to={signInUrl('/me')} replace />

  return (
    <div className="page grid max-w-xl gap-8 pt-6 md:pt-10">
      <h1 className="text-headline font-bold tracking-[-0.03em]">내 정보</h1>
      <MeForm me={me} />
      <LogoutButton />
    </div>
  )
}

function LogoutButton() {
  const logout = useLogout()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function onClick() {
    setBusy(true)
    setFailure(null)
    try {
      await logout()
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : '로그아웃하지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3 border-t border-rule pt-6">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="h-12 rounded-control border border-ink font-medium disabled:text-graphite"
      >
        로그아웃
      </button>
      {failure && (
        <p role="alert" className="rounded-control bg-danger-bg px-4 py-3 text-small text-danger">
          {failure}
        </p>
      )}
    </div>
  )
}

type MeInput = { name: string; phone: string; email: string; address: string; addressDetail: string }

function toInput(me: Me): MeInput {
  return {
    name: me.name,
    phone: me.phone,
    email: me.email,
    address: me.address ?? '',
    addressDetail: me.addressDetail ?? '',
  }
}

type MeErrors = Partial<Record<keyof MeInput, string>>

// 연락처는 하이픈·공백을 빼고 본다(주문서와 같다)
const onlyDigits = (value: string) => value.replace(/[\s-]/g, '')

// 백엔드 UserDTO 검증과 같은 규칙. 이메일은 백엔드(@Email)보다 엄격하지 않게 '무엇@무엇'만 본다
function validate(input: MeInput): MeErrors {
  const errors: MeErrors = {}
  if (!input.name.trim()) errors.name = '이름을 적어 주세요.'
  if (!/^010\d{8}$/.test(onlyDigits(input.phone))) errors.phone = '010으로 시작하는 숫자 11자리로 적어 주세요.'
  if (!/^[^\s@]+@[^\s@]+$/.test(input.email.trim())) errors.email = '이메일 형식으로 적어 주세요.'
  return errors
}

function MeForm({ me }: { me: Me }) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState<MeInput>(() => toInput(me))
  const [errors, setErrors] = useState<MeErrors>({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  function change(key: keyof MeInput, value: string) {
    setInput((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validate(input)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    setFailure(null)
    try {
      const { data } = await api<Me>('/api/users/me', {
        method: 'PUT',
        body: {
          name: input.name.trim(),
          phone: onlyDigits(input.phone),
          email: input.email.trim(),
          address: input.address.trim() || null,
          addressDetail: input.addressDetail.trim() || null,
        },
      })
      // 헤더·주문서도 같은 내 정보를 쓰므로 캐시를 바꾸고, 화면은 백엔드가 저장한 값으로 다시 채운다
      queryClient.setQueryData(meQueryKey, data)
      setInput(toInput(data))
      setSaved(true)
    } catch (error) {
      // 입력한 값은 그대로 두어 고쳐서 다시 저장할 수 있게 한다
      setFailure(error instanceof ApiError ? error.message : '저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <Field label="이름" value={input.name} error={errors.name} onChange={(v) => change('name', v)} autoComplete="name" />
      <Field
        label="연락처"
        value={input.phone}
        error={errors.phone}
        onChange={(v) => change('phone', v)}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder="01012345678"
      />
      <Field
        label="이메일"
        value={input.email}
        error={errors.email}
        onChange={(v) => change('email', v)}
        type="email"
        inputMode="email"
        autoComplete="email"
      />
      <Field label="주소" value={input.address} onChange={(v) => change('address', v)} autoComplete="street-address" />
      <Field label="상세 주소" value={input.addressDetail} onChange={(v) => change('addressDetail', v)} />

      <button
        type="submit"
        disabled={busy}
        className="h-12 rounded-control bg-ink font-medium text-paper disabled:bg-rule disabled:text-graphite"
      >
        저장
      </button>
      {failure && (
        <p role="alert" className="rounded-control bg-danger-bg px-4 py-3 text-small text-danger">
          {failure}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-control bg-success-bg px-4 py-3 text-body text-success">
          저장했습니다.
        </p>
      )}
    </form>
  )
}
