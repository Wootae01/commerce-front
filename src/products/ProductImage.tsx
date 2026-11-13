import { useState } from 'react'

const DEFAULT_IMAGE = '/images/default.png'

type ProductImageProps = {
  src: string | null | undefined
  className?: string
}

// 사진이 없거나(기본 이미지) 불러오지 못하면 진열대 색 자리만 남긴다. 이름은 카드가 따로 보여 준다
export function ProductImage({ src, className = '' }: ProductImageProps) {
  const [failed, setFailed] = useState(false)
  const hasPhoto = Boolean(src) && src !== DEFAULT_IMAGE && !failed

  return (
    <div className={`overflow-hidden bg-shelf ${className}`}>
      {hasPhoto && (
        <img
          src={src!}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}
