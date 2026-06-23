'use client'

import React, { Fragment, useRef, useState, useEffect } from 'react'
import type { Table, Reservation } from '@/db/schema'
import { useT } from '@/context/LocaleContext'

// ── Constants ──────────────────────────────────────────────────────────────────
const SLOT_MIN       = 15
const GAP_PX         = 48
const HEADER_H       = 36
const SEC_H          = 26
const DRAG_THRESHOLD = 6
const ZOOM_MIN       = 0.3
const ZOOM_MAX       = 3.0
const ZOOM_STEP      = 0.25

function ganttDimensions(tableCount: number): {
  rowH: number; slotPx: number; tableColW: number; tableColWMobile: number
} {
  if (tableCount <= 10) return { rowH: 72, slotPx: 44, tableColW: 96, tableColWMobile: 64 }
  if (tableCount <= 20) return { rowH: 56, slotPx: 36, tableColW: 84, tableColWMobile: 56 }
  if (tableCount <= 30) return { rowH: 44, slotPx: 32, tableColW: 76, tableColWMobile: 52 }
  return                       { rowH: 36, slotPx: 28, tableColW: 68, tableColWMobile: 48 }
}

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

function buildSegs(lunch: [string, string] | null, dinner: [string, string] | null, pxPerMin: number): Seg[] {
  const segs: Seg[] = []
  let offset = 0
  const buf = lunch && dinner ? BREAK_BUFFER_MIN : 0
  if (lunch) {
    const [s, e] = [toMin(lunch[0]), toMin(lunch[1]) + buf]
    segs.push({ startMin: s, endMin: e, offsetPx: offset })
    offset += (e - s) * pxPerMin + GAP_PX
  }
  if (dinner) {
    const [s, e] = [toMin(dinner[0]) - buf, toMin(dinner[1])]
    segs.push({ startMin: s, endMin: e, offsetPx: offset })
  }
  return segs
}

function totalWidth(segs: Seg[], pxPerMin: number): number {
  if (!segs.length) return 0
  const last = segs[segs.length - 1]
  return last.offsetPx + (last.endMin - last.startMin) * pxPerMin
}

function timeToX(t: string, segs: Seg[], pxPerMin: number): number | null {
  const min = toMin(t)
  for (const s of segs) {
    if (min >= s.startMin && min <= s.endMin)
      return s.offsetPx + (min - s.startMin) * pxPerMin
  }
  return null
}

function xToTime(x: number, segs: Seg[], slotPx: number): string | null {
  for (const s of segs) {
    const w = (s.endMin - s.startMin) * (slotPx / SLOT_MIN)
    if (x >= s.offsetPx && x < s.offsetPx + w)
      return toTime(s.startMin + Math.floor((x - s.offsetPx) / slotPx) * SLOT_MIN)
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
function blockBg(r: Reservation): string {
  if (r.status === 'no_show')  return 'rgba(220,50,50,0.30)'
  if (r.status === 'arrived')  return 'var(--block-arrived)'
  if (r.status === 'standby' || !r.table_number) return 'var(--block-standby)'
  return 'var(--block-pending)'
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
  onWarning?: (msg: string) => void
}

export default function GanttView({
  tables, reservations, date, lunchHours, dinnerHours, onSlotClick, onReservationClick, onReservationMove, onWarning,
}: Props) {
  const { t } = useT()
  const { rowH: ROW_H, slotPx: SLOT_PX, tableColW: TABLE_COL_W, tableColWMobile: TABLE_COL_W_MOBILE }
    = ganttDimensions(tables.length)
  const BASE_PX_PER_MIN = SLOT_PX / SLOT_MIN

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState<number>(() => {
    if (typeof window === 'undefined') return 1
    const s = localStorage.getItem('gantt-zoom')
    const v = s ? parseFloat(s) : 1
    return isNaN(v) ? 1 : Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v))
  })
  const zoomRef = useRef(zoom)
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { localStorage.setItem('gantt-zoom', String(zoom)) }, [zoom])

  const PX_PER_MIN = BASE_PX_PER_MIN * zoom
  const SLOT_PX_Z  = SLOT_PX * zoom

  const segs     = buildSegs(lunchHours, dinnerHours, PX_PER_MIN)
  const contentW = totalWidth(segs, PX_PER_MIN)

  const [localReservations, setLocalReservations] = useState(reservations)
  useEffect(() => { setLocalReservations(reservations) }, [reservations])

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

  // ── Pinch-to-zoom ─────────────────────────────────────────────────────────
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        pinchRef.current = { startDist: Math.hypot(dx, dy), startZoom: zoomRef.current }
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length !== 2 || !pinchRef.current) return
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const raw = pinchRef.current.startZoom * (dist / pinchRef.current.startDist)
      setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, raw)))
    }

    function onTouchEnd() { pinchRef.current = null }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const byTable = distribute(tables, localReservations)

  function isOverCapacity(r: Reservation): boolean {
    if (!r.table_number) return false
    const tbl = tables.find(t => t.number === r.table_number && t.section === r.section)
             ?? tables.find(t => t.number === r.table_number)
    return !!tbl && tbl.capacity > 0 && r.party_size > tbl.capacity
  }

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

  // Hour markers (solid lines + labels)
  const hourMarkers: { label: string; x: number }[] = []
  for (const s of segs) {
    const firstHour = Math.ceil(s.startMin / 60) * 60
    for (let m = firstHour; m <= s.endMin; m += 60)
      hourMarkers.push({ label: toTime(m), x: s.offsetPx + (m - s.startMin) * PX_PER_MIN })
  }

  // Quarter-hour markers (dashed lines, no label). Skip minutes that coincide with hours.
  const quarterMarkers: { x: number; isHalf: boolean }[] = []
  for (const s of segs) {
    const first15 = Math.ceil(s.startMin / 15) * 15
    for (let m = first15; m < s.endMin; m += 15) {
      if (m % 60 === 0) continue
      quarterMarkers.push({
        x: s.offsetPx + (m - s.startMin) * PX_PER_MIN,
        isHalf: m % 30 === 0,
      })
    }
  }

  const isToday = date === todayIso()
  const nowX = isToday ? timeToX(nowTime, segs, PX_PER_MIN) : null

  const indoorTables  = tables.filter(tbl => tbl.section === 'indoor')
  const outdoorTables = tables.filter(tbl => tbl.section === 'outdoor')
  const hasBoth = indoorTables.length > 0 && outdoorTables.length > 0

  const groups: { label: string; tables: Table[] }[] = []
  if (indoorTables.length)  groups.push({ label: t('config.taules.sala'),     tables: indoorTables })
  if (outdoorTables.length) groups.push({ label: t('config.taules.terrassa'), tables: outdoorTables })

  type RowMeta = { tbl: Table; rowBg: string; isLast: boolean }
  const groupMetas: { label: string; rows: RowMeta[] }[] = []
  let bgIdx = 0
  for (let gi = 0; gi < groups.length; gi++) {
    const rows: RowMeta[] = groups[gi].tables.map((tbl, ti) => ({
      tbl,
      rowBg: bgIdx++ % 2 === 1 ? 'rgba(0,0,0,0.04)' : '#ffffff',
      isLast: gi === groups.length - 1 && ti === groups[gi].tables.length - 1,
    }))
    groupMetas.push({ label: groups[gi].label, rows })
  }

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
    const x = clientX - rect.left + container.scrollLeft
    const y = clientY - rect.top
    const time = xToTime(x, segs, SLOT_PX_Z)
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

      if (targetTable.capacity > 0 && r.party_size > targetTable.capacity) {
        onWarning?.(`⚠️ La taula ${targetTable.number} té capacitat per ${targetTable.capacity}p — el grup és de ${r.party_size}p`)
      }

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

  // ── Zoom button style ─────────────────────────────────────────────────────
  const zoomBtnStyle: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* Zoom controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <button
          style={zoomBtnStyle}
          onClick={() => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
          title="Allunyar"
          aria-label="Zoom out"
        >−</button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 32, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          style={zoomBtnStyle}
          onClick={() => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
          title="Apropar"
          aria-label="Zoom in"
        >+</button>
        {zoom !== 1 && (
          <button
            style={{ ...zoomBtnStyle, fontSize: 11, width: 'auto', padding: '0 8px' }}
            onClick={() => setZoom(1)}
            title="Restablir zoom"
          >↺</button>
        )}
      </div>

      {/* Gantt grid */}
      <div style={{ display: 'flex', border: '1px solid rgba(0,0,0,0.2)', borderRadius: 12, overflow: 'hidden' }}>

        {/* ── LEFT COLUMN: table labels, always visible ── */}
        <div style={{
          flexShrink: 0,
          width: tableColW,
          borderRight: '1px solid rgba(0,0,0,0.15)',
          background: '#ffffff',
        }}>
          <div style={{
            height: HEADER_H,
            background: '#f3f4f6',
            borderBottom: '2px solid rgba(0,0,0,0.15)',
          }} />

          {groupMetas.map((gm) => (
            <Fragment key={gm.label}>
              {hasBoth && (
                <div style={{
                  height: SEC_H,
                  display: 'flex', alignItems: 'center', paddingLeft: 12,
                  background: '#f3f4f6',
                  borderBottom: '1px solid rgba(0,0,0,0.12)',
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
                  borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.12)',
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{tbl.number}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tbl.capacity}p</span>
                </div>
              ))}
            </Fragment>
          ))}
        </div>

        {/* ── RIGHT CONTENT: scrolls horizontally ── */}
        <div ref={containerRef} style={{ flex: 1, overflowX: 'auto', position: 'relative' }}>

          {/* Header: hour labels */}
          <div style={{
            position: 'relative', width: contentW, height: HEADER_H,
            background: '#f3f4f6', borderBottom: '2px solid rgba(0,0,0,0.15)',
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
          </div>

          {/* Rows */}
          {groupMetas.map((gm) => (
            <Fragment key={gm.label}>
              {hasBoth && (
                <div style={{
                  width: contentW, height: SEC_H,
                  background: '#f3f4f6',
                  borderBottom: '1px solid rgba(0,0,0,0.12)',
                }} />
              )}

              {gm.rows.map(({ tbl, rowBg, isLast }) => {
                let ghostEl: React.ReactNode = null
                if (ghost?.tableId === tbl.id) {
                  const gx = timeToX(ghost.time, segs, PX_PER_MIN)
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
                      borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.12)',
                      cursor: 'pointer',
                    }}
                    onClick={e => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const time = xToTime(e.clientX - rect.left, segs, SLOT_PX_Z)
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

                    {/* Quarter-hour dashed lines */}
                    {quarterMarkers.map((q, qi) => (
                      <div key={qi} style={{
                        position: 'absolute', left: q.x, top: 0, bottom: 0, width: 1,
                        borderLeft: `1px dashed ${q.isHalf ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.08)'}`,
                        pointerEvents: 'none', zIndex: 1,
                      }} />
                    ))}

                    {/* Hour solid lines */}
                    {hourMarkers.map(m => (
                      <div key={m.x} style={{
                        position: 'absolute', left: m.x, top: 0, bottom: 0,
                        width: 1, background: 'rgba(0,0,0,0.25)', pointerEvents: 'none', zIndex: 1,
                      }} />
                    ))}

                    {/* Reservation blocks */}
                    {(byTable.get(tbl.id) ?? []).map(r => {
                      const x = timeToX(r.time, segs, PX_PER_MIN)
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden' }}>
                            {(r.status === 'standby' || !r.table_number || isOverCapacity(r)) && w >= 40 && (
                              <span style={{ fontSize: 14, lineHeight: 1, color: '#FCD34D', flexShrink: 0 }}>⚠</span>
                            )}
                            <span style={{
                              fontSize: 14, fontWeight: 700,
                              color: blockFg(r),
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {w < 60
                                ? `×${r.party_size}`
                                : w < 100
                                  ? r.customer_name.split(' ').map(n => n[0]).join('').slice(0, 3).toUpperCase()
                                  : r.customer_name}
                            </span>
                          </div>
                          {w >= 60 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                              <span style={{ fontSize: 13, whiteSpace: 'nowrap', color: blockSubFg(r) }}>
                                ×{r.party_size}
                              </span>
                              {r.notes && (
                                <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: blockSubFg(r), fontStyle: 'italic' }}>
                                  {r.notes.length > 8 ? r.notes.slice(0, 8) + '…' : r.notes}
                                </span>
                              )}
                            </div>
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

          {/* Now line */}
          {nowX !== null && (
            <div style={{
              position: 'absolute', left: nowX, top: 0, bottom: 0,
              width: 2, background: 'var(--primary)', pointerEvents: 'none', zIndex: 3,
              borderRadius: 1,
            }}>
              <div style={{
                position: 'absolute',
                top: HEADER_H - 4,
                left: -3,
                width: 8, height: 8,
                borderRadius: '50%',
                background: 'var(--primary)',
              }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
