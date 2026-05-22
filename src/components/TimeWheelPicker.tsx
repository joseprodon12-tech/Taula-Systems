'use client'

import { useRef, useEffect, useCallback, useMemo } from 'react'
import { useT } from '@/context/LocaleContext'

const ITEM_H = 44
const VISIBLE = 5
const PAD_H = ITEM_H * Math.floor(VISIBLE / 2)  // 88
const BOX_H = ITEM_H * VISIBLE                   // 220

type SlotItem = { kind: 'slot'; value: string }
type SepItem  = { kind: 'sep';  label: string }
type WheelItem = SlotItem | SepItem

function buildItems(lunch: string[], dinner: string[], dinarLabel: string, soparLabel: string): WheelItem[] {
  const out: WheelItem[] = []
  if (lunch.length > 0) {
    out.push({ kind: 'sep', label: dinarLabel })
    lunch.forEach(v => out.push({ kind: 'slot', value: v }))
  }
  if (dinner.length > 0) {
    out.push({ kind: 'sep', label: soparLabel })
    dinner.forEach(v => out.push({ kind: 'slot', value: v }))
  }
  return out
}

function firstSlotIdx(items: WheelItem[]): number {
  return items.findIndex(it => it.kind === 'slot')
}

function nearestSlotIdx(items: WheelItem[], from: number): number {
  for (let d = 0; d < items.length; d++) {
    if (from + d < items.length && items[from + d].kind === 'slot') return from + d
    if (from - d >= 0 && items[from - d].kind === 'slot') return from - d
  }
  return from
}

interface Props {
  lunchSlots: string[]
  dinnerSlots: string[]
  selected: string
  onSelect: (time: string) => void
}

export default function TimeWheelPicker({ lunchSlots, dinnerSlots, selected, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const progRef = useRef(false)
  const { t } = useT()
  const dinarLabel = t('avui.dinar')
  const soparLabel = t('avui.sopar')

  const items = useMemo(
    () => buildItems(lunchSlots, dinnerSlots, dinarLabel, soparLabel),
    [lunchSlots, dinnerSlots, dinarLabel, soparLabel]
  )

  function go(idx: number, smooth: boolean) {
    if (!scrollRef.current) return
    progRef.current = true
    scrollRef.current.scrollTo({ top: idx * ITEM_H, behavior: smooth ? 'smooth' : 'auto' })
    setTimeout(() => { progRef.current = false }, 350)
  }

  useEffect(() => {
    const idx = selected
      ? items.findIndex(it => it.kind === 'slot' && it.value === selected)
      : firstSlotIdx(items)
    if (idx >= 0) go(idx, false)
  }, [items])

  const handleScroll = useCallback(() => {
    if (progRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (!scrollRef.current) return
      const rawIdx = Math.round(scrollRef.current.scrollTop / ITEM_H)
      const clamped = Math.max(0, Math.min(rawIdx, items.length - 1))
      const targetIdx = nearestSlotIdx(items, clamped)
      const item = items[targetIdx]

      if (targetIdx !== clamped) go(targetIdx, true)
      if (item?.kind === 'slot' && item.value !== selected) onSelect(item.value)
    }, 80)
  }, [items, selected, onSelect])

  return (
    // Stacking order within this container:
    // z-1: highlight bar (behind scroll content)
    // z-2: scroll container (transparent bg, text above highlight)
    // z-3: fade overlays (above scroll content, fade edges)
    <div style={{ position: 'relative', height: BOX_H, userSelect: 'none' }}>
      <style>{`.twp::-webkit-scrollbar{display:none}`}</style>

      {/* Center selection highlight — z-1, behind scroll content */}
      <div aria-hidden style={{
        position: 'absolute', top: PAD_H, left: 0, right: 0, height: ITEM_H,
        background: 'var(--surface)', border: '1.5px solid var(--border)',
        borderRadius: 8, pointerEvents: 'none', zIndex: 1,
      }} />

      {/* Scrollable wheel — z-2, transparent so highlight shows through behind text */}
      <div
        ref={scrollRef}
        className="twp"
        onScroll={handleScroll}
        role="listbox"
        aria-label="Selector d'hora"
        style={{
          position: 'relative', zIndex: 2,
          height: BOX_H,
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          paddingTop: PAD_H,
          paddingBottom: PAD_H,
          background: 'transparent',
          scrollbarWidth: 'none',
        } as React.CSSProperties}
      >
        {items.map((item, i) =>
          item.kind === 'sep' ? (
            <div
              key={`sep-${item.label}`}
              aria-hidden
              style={{
                height: ITEM_H,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                scrollSnapAlign: 'none',
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              {item.label}
            </div>
          ) : (
            <div
              key={item.value}
              role="option"
              aria-selected={item.value === selected}
              onClick={() => { onSelect(item.value); go(i, true) }}
              style={{
                height: ITEM_H,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                scrollSnapAlign: 'center',
                fontSize: 20,
                fontWeight: item.value === selected ? 600 : 400,
                color: item.value === selected ? 'var(--primary)' : 'var(--text)',
                cursor: 'pointer',
              }}
            >
              {item.value}
            </div>
          )
        )}
      </div>

      {/* Top fade — z-3, above scroll content */}
      <div aria-hidden style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: PAD_H,
        background: 'linear-gradient(to bottom, var(--bg) 30%, transparent)',
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* Bottom fade — z-3, above scroll content */}
      <div aria-hidden style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: PAD_H,
        background: 'linear-gradient(to top, var(--bg) 30%, transparent)',
        pointerEvents: 'none', zIndex: 3,
      }} />
    </div>
  )
}
