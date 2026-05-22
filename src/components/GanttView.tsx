'use client'

import React, { Fragment, useRef, useState, useEffect } from 'react'
import type { Table, Reservation } from '@/db/schema'
import { useT } from '@/context/LocaleContext'

// ── Constants ──────────────────────────────────────────────────────────────────
const SLOT_MIN    = 15
const SLOT_PX     = 40
const PX_PER_MIN  = SLOT_PX / SLOT_MIN
const GAP_PX      = 48
const TABLE_COL_W = 88
const ROW_H      = 52
const HEADER_H   = 36
const SEC_H      = 26   // section label row height
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

const BREAK_BUFFER_MIN = 60  // 1h empty space before/after the gap

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
      if (tid && result.has(tid)) {
        result.get(tid)!.push(r)
        continue
      }
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

const STATUS_BG: Record<string, string> = {
  standby: '#FEF08A',
  pending: '#2E5BFF',
  arrived: '#10B981',
  no_show: '#94A3B8',
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
  tables, reservations, lunchHours, dinnerHours, onSlotClick, onReservationClick, onReservationMove,
}: Props) {
  const { t } = useT()
  const segs     = buildSegs(lunchHours, dinnerHours)
  const contentW = totalWidth(segs)

  const [localReservations, setLocalReservations] = useState(reservations)
  useEffect(() => { setLocalReservations(reservations) }, [reservations])

  const containerRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ tableId: string; time: string; reservationId: string } | null>(null)

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

  const indoorTables  = tables.filter(tbl => tbl.section === 'indoor')
  const outdoorTables = tables.filter(tbl => tbl.section === 'outdoor')
  const hasBoth = indoorTables.length > 0 && outdoorTables.length > 0

  const groups: { label: string; tables: Table[] }[] = []
  if (indoorTables.length)  groups.push({ label: t('config.taules.sala'),     tables: indoorTables })
  if (outdoorTables.length) groups.push({ label: t('config.taules.terrassa'), tables: outdoorTables })

  // Build Y positions for each table row (used for vertical hit-testing during drag)
  const tableRows: { id: string; yStart: number; yEnd: number }[] = []
  let rowY = HEADER_H
  for (const group of groups) {
    if (hasBoth) rowY += SEC_H
    for (const tbl of group.tables) {
      tableRows.push({ id: tbl.id, yStart: rowY, yEnd: rowY + ROW_H })
      rowY += ROW_H
    }
  }

  function getDropPos(clientX: number, clientY: number) {
    const container = containerRef.current
    if (!container) return null
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left - TABLE_COL_W + container.scrollLeft
    const y = clientY - rect.top
    const time = xToTime(x, segs)
    const tRow = tableRows.find(tr => y >= tr.yStart && y < tr.yEnd)
    return time && tRow ? { time, tableId: tRow.id } : null
  }

  function startDrag(e: React.PointerEvent<HTMLDivElement>, r: Reservation, tableId: string) {
    if (!onReservationMove) return
    e.preventDefault()
    e.stopPropagation()

    // Route all pointer events to the container so the drag can't escape
    containerRef.current?.setPointerCapture(e.pointerId)

    const startX = e.clientX
    const startY = e.clientY
    let active = false

    function onMove(ev: PointerEvent) {
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return
        active = true
        setDraggingId(r.id)
        // Disable container scroll so the browser doesn't hijack touch gestures
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

      if (!active) {
        onReservationClick(r.id)
        return
      }

      const pos = getDropPos(ev.clientX, ev.clientY)
      if (!pos || (pos.time === r.time && pos.tableId === tableId)) return

      // Reject if target slot overlaps an existing reservation in that table
      const targetRows = byTable.get(pos.tableId) ?? []
      const rStart = toMin(pos.time)
      const rEnd = rStart + r.duration_minutes
      const conflict = targetRows.some(e => {
        if (e.id === r.id) return false
        const eStart = toMin(e.time), eEnd = eStart + e.duration_minutes
        return rStart < eEnd && rEnd > eStart
      })
      if (conflict) return

      const targetTable = tables.find(tbl => tbl.id === pos.tableId)
      if (!targetTable) return

      // Optimistic update
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

  let globalRowIdx = 0

  return (
    <div ref={containerRef} style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{
          width: TABLE_COL_W, flexShrink: 0, height: HEADER_H,
          position: 'sticky', left: 0, zIndex: 3,
          background: 'var(--surface)', borderRight: '1px solid var(--border)',
        }} />
        <div style={{ position: 'relative', width: contentW, height: HEADER_H, flexShrink: 0 }}>
          {hourMarkers.map(m => (
            <span key={m.x} style={{
              position: 'absolute', left: m.x, top: '50%',
              transform: 'translate(-50%,-50%)',
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
        </div>
      </div>

      {/* ── Groups ── */}
      {groups.map((group, groupIdx) => (
        <Fragment key={group.label}>

          {/* Section label row — only when both sections exist */}
          {hasBoth && (
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
            }}>
              <div style={{
                width: TABLE_COL_W, flexShrink: 0, height: SEC_H,
                position: 'sticky', left: 0, zIndex: 2,
                background: 'var(--surface)', borderRight: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', paddingLeft: 12,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}>
                  {group.label}
                </span>
              </div>
              <div style={{ flex: 1, background: 'var(--surface)' }} />
            </div>
          )}

          {/* Table rows */}
          {group.tables.map((tbl) => {
            const isLast = groupIdx === groups.length - 1 && tbl.id === group.tables.at(-1)!.id
            const rowBg  = globalRowIdx++ % 2 === 1 ? 'rgba(0,0,0,0.013)' : 'transparent'

            let ghostEl: React.ReactNode = null
            if (ghost?.tableId === tbl.id) {
              const gx = timeToX(ghost.time, segs)
              const ghostRes = gx !== null ? localReservations.find(res => res.id === ghost.reservationId) : null
              if (gx !== null && ghostRes) {
                const gw = Math.max(Math.min(ghostRes.duration_minutes * PX_PER_MIN, contentW - gx) - 4, 8)
                ghostEl = (
                  <div
                    key="ghost"
                    style={{
                      position: 'absolute', left: gx + 2, top: 6, width: gw, height: ROW_H - 12,
                      border: `2px dashed ${STATUS_BG[ghostRes.status] ?? STATUS_BG.pending}`,
                      borderRadius: 6,
                      pointerEvents: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                )
              }
            }

            return (
              <div key={tbl.id} style={{
                display: 'flex',
                borderBottom: isLast ? 'none' : '1px solid var(--border)',
              }}>
                {/* Sticky label */}
                <div style={{
                  width: TABLE_COL_W, flexShrink: 0, height: ROW_H,
                  position: 'sticky', left: 0, zIndex: 2,
                  background: 'var(--bg)', borderRight: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 12,
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{tbl.number}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tbl.capacity}p</span>
                </div>

                {/* Time area */}
                <div
                  style={{
                    position: 'relative', width: contentW, height: ROW_H, flexShrink: 0,
                    cursor: 'pointer', background: rowBg,
                  }}
                  onClick={e => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const time = xToTime(e.clientX - rect.left, segs)
                    if (time) onSlotClick(tbl.id, time)
                  }}
                >
                  {/* Gap hatching — z-index 0 so it stays below hour lines */}
                  {segs.slice(0, -1).map((s, i) => (
                    <div key={i} style={{
                      position: 'absolute', pointerEvents: 'none', zIndex: 0,
                      left: s.offsetPx + (s.endMin - s.startMin) * PX_PER_MIN,
                      width: GAP_PX, top: 0, bottom: 0,
                      background: 'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,0.04) 3px,rgba(0,0,0,0.04) 6px)',
                    }} />
                  ))}

                  {/* Hour lines — z-index 1 so they render above gap hatching */}
                  {hourMarkers.map(m => (
                    <div key={m.x} style={{
                      position: 'absolute', left: m.x, top: 0, bottom: 0,
                      width: 1, background: 'var(--border)', pointerEvents: 'none', zIndex: 1,
                    }} />
                  ))}

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
                          background: STATUS_BG[r.status] ?? STATUS_BG.pending,
                          borderRadius: 6,
                          cursor: onReservationMove ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                          overflow: 'hidden',
                          padding: '3px 7px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                          opacity: isDragging ? 0.4 : (r.status === 'no_show' ? 0.55 : 1),
                          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                          border: r.status === 'standby' ? '1.5px solid #D97706' : 'none',
                          touchAction: 'none',
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          WebkitTouchCallout: 'none',
                        } as React.CSSProperties}
                      >
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: r.status === 'standby' ? '#854D0E' : '#fff',
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
                          <span style={{
                            fontSize: 10, whiteSpace: 'nowrap',
                            color: r.status === 'standby' ? '#92400E' : 'rgba(255,255,255,0.82)',
                          }}>
                            ×{r.party_size}
                          </span>
                        )}
                      </div>
                    )
                  })}

                          {/* Ghost block — drop target preview */}
                  {ghostEl}
                </div>
              </div>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
