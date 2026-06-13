import type { CSSProperties } from 'react'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

interface Props {
  name: string
  color: string
  avatarUrl?: string | null
  size?: number
}

const base: CSSProperties = {
  borderRadius: '50%',
  flexShrink: 0,
  userSelect: 'none',
}

export default function EmpAvatar({ name, color, avatarUrl, size = 22 }: Props) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        title={name}
        style={{ ...base, width: size, height: size, objectFit: 'cover', display: 'inline-block' }}
      />
    )
  }
  return (
    <span
      title={name}
      style={{
        ...base,
        width: size, height: size,
        background: color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.42), fontWeight: 700, color: 'white',
      }}
    >
      {getInitials(name)}
    </span>
  )
}
