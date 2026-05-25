'use client'

import React, { Fragment, useRef, useState, useEffect } from 'react'
import type { Table, Reservation } from '@/db/schema'
import { useT } from '@/context/LocaleContext'

// ── Constants ──────────────────────────────────────────────────────────────────
const SLOT_MIN    = 15
const SLOT_PX     = 40
const PX_PER_MIN  = SLOT_PX / SLOT_MIN
const GAP_PX      = 48
const TABLE_COL_W        = 88
const TABLE_COL_W_MOBILE = 60
const ROW_H   = 52
const HEADER_H = 36
const SEC_H   = 26
const DRAG_THRESHOLD = 6

// ── Time helpers ───────────────────────────────────────────────────────────────
function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function toTime(min: number): string {
  return `${Math.floor(min / 60).toString().padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}`
}

// ── Segments ───────────────────────────────────────────────────────────────────
type Seg = { startMin: number; endMin: number; offsetPx: number }

const BREAK_BUFFER_MIN = 60

function buildSegs(lunch: [string, string] | null, dinner: [string, string] | null): Seg[] {
  const segs: Seg[] = []
  let offset = 0
  const buf = lunch && dinner ? BREAK_BUFFER_MIN : 0
  if (lunch) {
    const [s, e] = [toMin(lunch[0]), toMin(lunch[1]) + buf]
    segs.push({ startMin: s, endMin: e, offsetPx: offset })
    offset += (e - s) * PX_PER_MIN + GAP_PX
  }
  if (dinner) {
    const [s, e] = [toMin(dinner[0]) - buf, toMin(dinner[1])]
    segs.push({ startMin: s, endMin: e, offsetPx: offset })
  }
  return segs
}

function totalWidth(segs: Seg[]): number {
  if (!segs.length) return 0
  const last = segs[segs.length - 1]
  return last.offsetPx + (last.endMin - last.startMin) * PX_PER_MIN
}

function timeToX(t: string, segs: Seg[]): number | null {
  const min = toMin(t)
  for (const s of segs) {
    if (min >= s.startMin && min <= s.endMin)
      return s.offsetPx + (min - s.startMin) * PX_PER_MIN
  }
  return null
}

function xToTime(x: number, segs: Seg[]): string | null {
  for (const s of segs) {
    const w = (s.endMin - s.startMin) * PX_PER_MIN
    if (x >= s.offsetPx && x < s.offsetPx + w)
      return toTime(s.startMin + Math.floor((x - s.offsetPx) / SLOT_PX) * SLOT_MIN)
  }
  return null
}

// ── Greedy distribution (honors table_number when set) ────────────────────────
function distribute(tables: Table[], reservations: Reservation[]): Map<string, Reservation[]> {
  const result = new Map<string, Reservation[]>(tables.map(t => [t.id, []]))
  const tableByNumber = new Map(tables.map(t => [t.number, t.id]))

  const sorted = [...reservations]
    .filter(r => r.status !== 'cancelled')
    .sort((a, b) => a.time.localeCompare(b.time))

  for (const r of sorted) {
    if (r.table_number) {
      const tid = tableByNumber.get(r.table_number)
      if (tid && result.has(tid)) { result.get(tid)!.push(r); continue }
    }
    const candidates = tables.filter(t => t.section === r.section)
    let placed = false
    for (const t of candidates) {
      const row = result.get(t.id)!
      const overlaps = row.some(e => {
        const eStart = toMin(e.time), eEnd = eStart + e.duration_minutes
        const rStart = toMin(r.time), rEnd = rStart + r.duration_minutes
        return rStart < eEnd && rEnd > eStart
      })
      if (!overlaps) { row.push(r); placed = true; break }
    }
    if (!placed && candidates.length) result.get(candidates.at(-1)!.id)!.push(r)
  }

  return result
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentTimeStr(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── Block colors ──────────────────────────────────────────────────────────────
// standby + unassigned (no table_number) → dark slate; no_show → translucent red
function blockBg(r: Reservation): string {
  if (r.status === 'no_show')  return 'rgba(220,50,50,0.30)'
  if (r.status === 'arrived')  return '#10B981'
  if (r.status === 'standby' || !r.table_number) return '#64748B'
  return '#2E5BFF'
}
function blockFg(r: Reservation): string {
  return r.status === 'no_show' ? '#7F1D1D' : '#fff'
}
function blockSubFg(r: Reservation): string {
  return r.status === 'no_show' ? 'rgba(127,29,29,0.75)' : 'rgba(255,255,255,0.82)'
}

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  tables: Table[]
  reservations: Reservation[]
  date: string
  lunchHours: [string, string] | null
  dinnerHours: [string, string] | null
  onSlotClick: (tableId: string, time: string) => void
  onReservationClick: (id: string) => void
  onReservationMove?: (reservationId: string, newTableId: string, newTime: string) => Promise<void>
}

export default function GanttView({
  tables, reservations, date, lunchHours, dinnerHours, onSlotClick, onReservationClick, onReservationMove,
}: Props) {
  const { t } = useT()
  const segs     = buildSegs(lunchHours, dinnerHours)
  const contentW = totalWidth(segs)

  const [localReservations, setLocalReservations] = useState(reservations)
  useEffect(() => { setLocalReservations(reservations) }, [reservations])

  // containerRef points to the RIGHT scrollable div — not the outer wrapper.
  // This fixes the Safari bug: position:sticky doesn't work inside overflow-x:auto.
  // The left column lives outside the scroll container entirely.
  const containerRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ tableId: string; time: string; reservationId: string } | null>(null)

  const [tableColW, setTableColW] = useState(TABLE_COL_W)
  useEffect(() => {
    function update() { setTableColW(window.innerWidth < 640 ? TABLE_COL_W_MOBILE : TABLE_COL_W) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const [nowTime, setNowTime] = useState(currentTimeStr)
  useEffect(() => {
    if (date !== todayIso()) return
    const id = setInterval(() => setNowTime(currentTimeStr()), 60000)
    return () => clearInterval(id)
  }, [date])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollLeft = 1
      requestAnimationFrame(() => { el.scrollLeft = 0 })
    })
  }, [])

  const byTable = distribute(tables, localReservations)

  if (!segs.length) return (
    <p style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
      {t('reserva.missatges.tancat')}
    </p>
  )

  if (!tables.length) return (
    <p style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
      {t('gantt.senseTaules')}{' '}
      <a href="/config" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
        {t('gantt.configLink')}
      </a>
    </p>
  )

  const hourMarkers: { label: string; x: number }[] = []
  for (const s of segs) {
    const firstHour = Math.ceil(s.startMin / 60) * 60
    for (let m = firstHour; m <= s.endMin; m += 60)
      hourMarkers.push({ label: toTime(m), x: s.offsetPx + (m - s.startMin) * PX_PER_MIN })
  }

  const isToday = date === todayIso()
  const nowX = isToday ? timeToX(nowTime, segs) : null

  const indoorTables  = tables.filter(tbl => tbl.section === 'indoor')
  const outdoorTables = tables.filter(tbl => tbl.section === 'outdoor')
  const hasBoth = indoorTables.length > 0 && outdoorTables.length > 0

  const groups: { label: string; tables: Table[] }[] = []
  if (indoorTables.length)  groups.push({ label: t('config.taules.sala'),     tables: indoorTables })
  if (outdoorTables.length) groups.push({ label: t('config.taules.terrassa'), tables: outdoorTables })

  // Pre-compute per-row metadata so left column and right content stay in sync
  type RowMeta = { tbl: Table; rowBg: string; isLast: boolean }
  const groupMetas: { label: string; rows: RowMeta[] }[] = []
  let bgIdx = 0
  for (let gi = 0; gi < groups.length; gi++) {
    const rows: RowMeta[] = groups[gi].tables.map((tbl, ti) => ({
      tbl,
      rowBg: bgIdx++ % 2 === 1 ? 'rgba(0,0,0,0.025)' : 'transparent',
      isLast: gi === groups.length - 1 && ti === groups[gi].tables.length - 1,
    }))
    groupMetas.push({ label: groups[gi].label, rows })
  }

  // Y positions for drag hit-testing — relative to containerRef (right content) top
  const tableRows: { id: string; yStart: number; yEnd: number }[] = []
  let rowY = HEADER_H
  for (const gm of groupMetas) {
    if (hasBoth) rowY += SEC_H
    for (const { tbl } of gm.rows) {
      tableRows.push({ id: tbl.id, yStart: rowY, yEnd: rowY + ROW_H })
      rowY += ROW_H
    }
  }

  function getDropPos(clientX: number, clientY: number) {
    const container = containerRef.current
    if (!container) return null
    const rect = container.getBoundingClientRect()
    // x: relative to right content area (no tableColW subtraction — container starts after it)
    const x = clientX - rect.left + container.scrollLeft
    const y = clientY - rect.top
    const time = xToTime(x, segs)
    const tRow = tableRows.find(tr => y >= tr.yStart && y < tr.yEnd)
    return time && tRow ? { time, tableId: tRow.id } : null
  }

  function startDrag(e: React.PointerEvent<HTMLDivElement>, r: Reservation, tableId: string) {
    if (!onReservationMove) return
    e.preventDefault()
    e.stopPropagation()
    containerRef.current?.setPointerCapture(e.pointerId)
    const startX = e.clientX, startY = e.clientY
    let active = false

    function onMove(ev: PointerEvent) {
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return
        active = true
        setDraggingId(r.id)
        if (containerRef.current) containerRef.current.style.touchAction = 'none'
      }
      const pos = getDropPos(ev.clientX, ev.clientY)
      if (pos) setGhost({ ...pos, reservationId: r.id })
    }

    function onUp(ev: PointerEvent) {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      containerRef.current?.releasePointerCapture(ev.pointerId)
      if (containerRef.current) containerRef.current.style.touchAction = ''
      setDraggingId(null)
      setGhost(null)

      if (!active) { onReservationClick(r.id); return }

      const pos = getDropPos(ev.clientX, ev.clientY)
      if (!pos || (pos.time === r.time && pos.tableId === tableId)) return

      const targetRows = byTable.get(pos.tableId) ?? []
      const rStart = toMin(pos.time), rEnd = rStart + r.duration_minutes
      const conflict = targetRows.some(e => {
        if (e.id === r.id) return false
        const eStart = toMin(e.time), eEnd = eStart + e.duration_minutes
        return rStart < eEnd && rEnd > eStart
      })
      if (conflict) return

      const targetTable = tables.find(tbl => tbl.id === pos.tableId)
      if (!targetTable) return

      setLocalReservations(prev => prev.map(res =>
        res.id === r.id
          ? { ...res, time: pos.time, section: targetTable.section, table_number: targetTable.number }
          : res
      ))
      onReservationMove!(r.id, pos.tableId, pos.time).catch(() => {
        setLocalReservations(prev => prev.map(res =>
          res.id === r.id
            ? { ...res, time: r.time, section: r.section, table_number: r.table_number }
            : res
        ))
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  // Two-column layout: LEFT column is never inside a scroll container (fixes Safari sticky bug).
  // RIGHT column scrolls horizontally. Both have identical row heights via constants.
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

      {/* ── LEFT COLUMN: table labels, always visible ── */}
      <div style={{
        flexShrink: 0,
        width: tableColW,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg)',
      }}>
        {/* Header corner — matches header height, no decorative box */}
        <div style={{
          height: HEADER_H,
          background: 'var(--surface)',
          borderBottom: '2px solid var(--border)',
        }} />

        {groupMetas.map((gm) => (
          <Fragment key={gm.label}>
            {hasBoth && (
              <div style={{
                height: SEC_H,
                display: 'flex', alignItems: 'center', paddingLeft: 12,
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}>
                  {gm.label}
                </span>
              </div>
            )}
            {gm.rows.map(({ tbl, rowBg, isLast }) => (
              <div key={tbl.id} style={{
                height: ROW_H,
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                paddingLeft: 12,
                background: rowBg,
                borderBottom: isLast ? 'none' : '1px solid var(--border)',
              }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{tbl.number}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tbl.capacity}p</span>
              </div>
            ))}
          </Fragment>
        ))}
      </div>

      {/* ── RIGHT CONTENT: scrolls horizontally ── */}
      <div ref={containerRef} style={{ flex: 1, overflowX: 'auto' }}>

        {/* Header: hour labels */}
        <div style={{
          position: 'relative', width: contentW, height: HEADER_H,
          background: 'var(--surface)', borderBottom: '2px solid var(--border)',
        }}>
          {hourMarkers.map(m => (
            <span key={m.x} style={{
              position: 'absolute', left: m.x, top: '50%',
              transform: m.x < 24 ? 'translateY(-50%)' : 'translate(-50%,-50%)',
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap',
            }}>{m.label}</span>
          ))}
          {segs.slice(0, -1).map((s, i) => (
            <span key={i} style={{
              position: 'absolute',
              left: s.offsetPx + (s.endMin - s.startMin) * PX_PER_MIN + GAP_PX / 2,
              top: '50%', transform: 'translate(-50%,-50%)',
              fontSize: 11, color: 'var(--text-muted)', letterSpacing: 3,
            }}>···</span>
          ))}
          {nowX !== null && (
            <div style={{
              position: 'absolute', left: nowX, top: 0, bottom: 0,
              width: 2, background: 'var(--primary)', pointerEvents: 'none', zIndex: 2,
              borderRadius: 1,
            }} />
          )}
        </div>

        {/* Rows */}
        {groupMetas.map((gm) => (
          <Fragment key={gm.label}>
            {/* Section spacer — mirrors left column section label height */}
            {hasBoth && (
              <div style={{
                width: contentW, height: SEC_H,
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
              }} />
            )}

            {gm.rows.map(({ tbl, rowBg, isLast }) => {
              let ghostEl: React.ReactNode = null
              if (ghost?.tableId === tbl.id) {
                const gx = timeToX(ghost.time, segs)
                const ghostRes = gx !== null ? localReservations.find(res => res.id === ghost.reservationId) : null
                if (gx !== null && ghostRes) {
                  const gw = Math.max(Math.min(ghostRes.duration_minutes * PX_PER_MIN, contentW - gx) - 4, 8)
                  ghostEl = (
                    <div key="ghost" style={{
                      position: 'absolute', left: gx + 2, top: 6, width: gw, height: ROW_H - 12,
                      border: `2px dashed ${blockBg(ghostRes)}`,
                      borderRadius: 6, pointerEvents: 'none', boxSizing: 'border-box', zIndex: 4,
                    }} />
                  )
                }
              }

              return (
                <div
                  key={tbl.id}
                  style={{
                    position: 'relative', width: contentW, height: ROW_H,
                    background: rowBg,
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                  onClick={e => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const time = xToTime(e.clientX - rect.left, segs)
                    if (time) onSlotClick(tbl.id, time)
                  }}
                >
                  {/* Gap hatching */}
                  {segs.slice(0, -1).map((s, i) => (
                    <div key={i} style={{
                      position: 'absolute', pointerEvents: 'none', zIndex: 0,
                      left: s.offsetPx + (s.endMin - s.startMin) * PX_PER_MIN,
                      width: GAP_PX, top: 0, bottom: 0,
                      background: 'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,0.05) 3px,rgba(0,0,0,0.05) 6px)',
                    }} />
                  ))}

                  {/* Hour lines */}
                  {hourMarkers.map(m => (
                    <div key={m.x} style={{
                      position: 'absolute', left: m.x, top: 0, bottom: 0,
                      width: 1, background: 'rgba(0,0,0,0.1)', pointerEvents: 'none', zIndex: 1,
                    }} />
                  ))}

                  {/* Now line — above blocks */}
                  {nowX !== null && (
                    <div style={{
                      position: 'absolute', left: nowX, top: 0, bottom: 0,
                      width: 2, background: 'var(--primary)', pointerEvents: 'none', zIndex: 3,
                      borderRadius: 1,
                    }} />
                  )}

                  {/* Reservation blocks */}
                  {(byTable.get(tbl.id) ?? []).map(r => {
                    const x = timeToX(r.time, segs)
                    if (x === null) return null
                    const w = Math.max(Math.min(r.duration_minutes * PX_PER_MIN, contentW - x) - 4, 8)
                    const isDragging = draggingId === r.id
                    return (
                      <div
                        key={r.id}
                        title={`${r.customer_name} · ×${r.party_size} · ${r.time}`}
                        onPointerDown={e => startDrag(e, r, tbl.id)}
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute', left: x + 2, top: 6, width: w, height: ROW_H - 12,
                          background: blockBg(r),
                          borderRadius: 6,
                          border: '1px solid rgba(0,0,0,0.15)',
                          cursor: onReservationMove ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                          overflow: 'hidden',
                          padding: '3px 7px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                          opacity: isDragging ? 0.4 : 1,
                          boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
                          touchAction: 'none',
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          WebkitTouchCallout: 'none',
                          zIndex: 2,
                        } as React.CSSProperties}
                      >
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          color: blockFg(r),
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {r.status === 'standby' && '⚠ '}
                          {w < 60
                            ? `×${r.party_size}`
                            : w < 100
                              ? r.customer_name.split(' ').map(n => n[0]).join('').slice(0, 3).toUpperCase()
                              : r.customer_name}
                        </span>
                        {w >= 60 && (
                          <span style={{ fontSize: 11, whiteSpace: 'nowrap', color: blockSubFg(r) }}>
                            ×{r.party_size}
                          </span>
                        )}
                      </div>
                    )
                  })}

                  {ghostEl}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
