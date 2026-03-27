'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import html2canvas from 'html2canvas'

// ─── Types ───────────────────────────────────────────────────────────────────
interface RawRow {
  Accountmanager?: string
  '# Leads'?: number
  Marge?: number
  'Margin %'?: number
  'Verkoopmarge %'?: number
  Inkoopprijs?: number
  Verkoopprijs?: number
  [key: string]: unknown
}

interface Seller {
  name: string
  alias: string
  leads: number
  omzet: number
  inkoop: number
  marge: number
  commPct: number
  commEur: number
  nettoMarge: number
  margePct: number
  nettoPct: number
  aandeel: number
  color: string
  owner: boolean
}

// ─── Commission rules ─────────────────────────────────────────────────────────
const COMMISSION_RULES: Record<string, number> = {
  cliff: 0.10,
  einar: 0.10,
  ejnar: 0.10,
  christophe: 0.05,
  kristof: 0.05,
  cedric: 0.00,
}

const COLORS = ['#00b4d8', '#f5a623', '#2ecc71', '#e88b4a', '#a78bfa', '#f472b6']

const OWNER_KEYS = ['cedric']

function getCommission(name: string): { pct: number; owner: boolean } {
  const lower = name.toLowerCase()
  for (const [key, pct] of Object.entries(COMMISSION_RULES)) {
    if (lower.includes(key)) return { pct, owner: OWNER_KEYS.includes(key) }
  }
  return { pct: 0, owner: false }
}

function getAlias(name: string): string {
  return name.split(' ')[0]
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  '€' + Math.round(n).toLocaleString('nl-BE')
const pct = (n: number) =>
  (n * 100).toFixed(1) + '%'

// ─── Donut SVG ────────────────────────────────────────────────────────────────
function Donut({ sellers }: { sellers: Seller[] }) {
  const cx = 80, cy = 80, r = 68, ri = 46
  let start = -Math.PI / 2
  const paths = sellers.map((s, i) => {
    const angle = s.aandeel * 2 * Math.PI
    const end   = start + angle
    const x1 = cx + r * Math.cos(start),  y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(end),    y2 = cy + r * Math.sin(end)
    const ix1= cx + ri* Math.cos(start),  iy1= cy + ri* Math.sin(start)
    const ix2= cx + ri* Math.cos(end),    iy2= cy + ri* Math.sin(end)
    const lg = angle > Math.PI ? 1 : 0
    const d  = `M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ri} ${ri} 0 ${lg} 0 ${ix1} ${iy1} Z`
    start = end
    return <path key={i} d={d} fill={s.color} opacity={0.9} />
  })

  return (
    <svg width={160} height={160} viewBox="0 0 160 160">
      {paths}
      <text x={80} y={76} textAnchor="middle" fontFamily="'Bebas Neue'" fontSize={20} fill="#f0f6ff">
        {fmt(sellers.reduce((a, s) => a + s.omzet, 0))}
      </text>
      <text x={80} y={92} textAnchor="middle" fontFamily="'DM Sans'" fontSize={9} fill="#6b8aaa">
        totaal omzet
      </text>
    </svg>
  )
}

// ─── Upload Screen ────────────────────────────────────────────────────────────
function UploadScreen({ onFile }: { onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }, [onFile])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'var(--navy)' }}>
      {/* Logo */}
      <div style={{ marginBottom: 48, textAlign: 'center' }} className="animate-fade-down">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 52, letterSpacing: 6, color: 'var(--white)', lineHeight: 1 }}>
          HIVO<span style={{ color: 'var(--cyan)' }}>LTA</span>
        </div>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 6 }}>
          Verkoopoverzicht Dashboard
        </div>
      </div>

      {/* Drop zone */}
      <div
        className="animate-fade-up"
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%', maxWidth: 480,
          border: `2px dashed ${drag ? 'var(--cyan)' : 'rgba(0,180,216,.3)'}`,
          borderRadius: 20,
          background: drag ? 'rgba(0,180,216,.06)' : 'var(--card)',
          padding: '52px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all .2s',
          boxShadow: drag ? '0 0 40px rgba(0,180,216,.15)' : 'none',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 2, color: 'var(--cyan)', marginBottom: 8 }}>
          Sleep je Excel hier naartoe
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
          of klik om een bestand te kiezen
        </div>
        <div style={{
          display: 'inline-block',
          background: 'var(--cyan)',
          color: 'var(--navy)',
          fontWeight: 700,
          fontSize: 13,
          padding: '10px 28px',
          borderRadius: 99,
          letterSpacing: 1,
        }}>
          Bestand kiezen
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 20, letterSpacing: 1 }}>
          .xlsx · export-sales-by-account-manager
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]) }}
        />
      </div>

      {/* Column hint */}
      <div className="animate-fade-up" style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['Accountmanager', '# Leads', 'Inkoopprijs', 'Verkoopprijs', 'Marge'].map(col => (
          <span key={col} style={{
            background: 'rgba(0,180,216,.08)',
            border: '1px solid rgba(0,180,216,.2)',
            borderRadius: 6,
            padding: '4px 12px',
            fontSize: 11,
            fontFamily: "'DM Mono'",
            color: 'var(--cyan2)',
            letterSpacing: 1,
          }}>{col}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Dashboard render ─────────────────────────────────────────────────────────
function DashboardView({ sellers, period, onReset }: { sellers: Seller[]; period: string; onReset: () => void }) {
  const dashRef  = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)

  const totalOmzet  = sellers.reduce((a, s) => a + s.omzet, 0)
  const totalMarge  = sellers.reduce((a, s) => a + s.marge, 0)
  const totalComm   = sellers.reduce((a, s) => a + s.commEur, 0)
  const totalNetto  = totalMarge - totalComm
  const totalLeads  = sellers.reduce((a, s) => a + s.leads, 0)
  const maxOmzet    = Math.max(...sellers.map(s => s.omzet))

  const saveImage = async () => {
    if (!dashRef.current) return
    setSaving(true)
    try {
      const canvas = await html2canvas(dashRef.current, {
        backgroundColor: '#0d1f35',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const link = document.createElement('a')
      link.download = `hivolta-dashboard-${period.replace(/\s/g, '-').toLowerCase()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)', position: 'relative' }}>
      {/* Top toolbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,31,53,.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,180,216,.15)',
        padding: '12px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 4, color: 'var(--white)' }}>
          HIVO<span style={{ color: 'var(--cyan)' }}>LTA</span>
          <span style={{ fontSize: 13, letterSpacing: 2, color: 'var(--muted)', marginLeft: 16, fontFamily: "'DM Sans'", fontWeight: 400 }}>
            {period}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onReset} style={{
            background: 'transparent',
            border: '1px solid rgba(0,180,216,.3)',
            color: 'var(--muted)',
            borderRadius: 99,
            padding: '8px 20px',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: "'DM Sans'",
            transition: 'all .2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(0,180,216,.3)')}
          >
            ← Nieuw bestand
          </button>
          <button onClick={saveImage} disabled={saving} style={{
            background: saving ? 'rgba(0,180,216,.3)' : 'var(--cyan)',
            color: 'var(--navy)',
            border: 'none',
            borderRadius: 99,
            padding: '8px 24px',
            fontSize: 12,
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans'",
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all .2s',
          }}>
            {saving ? (
              <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--navy)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Opslaan...</>
            ) : (
              <><span>⬇</span> Opslaan als afbeelding</>
            )}
          </button>
        </div>
      </div>

      {/* Dashboard content */}
      <div ref={dashRef} style={{ padding: '48px 32px 64px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div className="animate-fade-down" style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(0,180,216,.2)',
          paddingBottom: 28, marginBottom: 44,
        }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 46, letterSpacing: 4, color: 'var(--white)', lineHeight: 1 }}>
              HIVO<span style={{ color: 'var(--cyan)' }}>LTA</span>
            </div>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>
              Smart Energy Solutions
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)' }}>Verkoopoverzicht</div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 2, color: 'var(--cyan)' }}>{period}</div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="animate-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 44 }}>
          {[
            { label: 'Totale Omzet',  val: fmt(totalOmzet),  sub: `${totalLeads} leads · ${sellers.length} verkopers`, accent: 'var(--cyan)',  top: 'var(--cyan)' },
            { label: 'Bruto Marge',   val: fmt(totalMarge),  sub: pct(totalMarge/totalOmzet) + ' van omzet',            accent: 'var(--gold)',  top: 'var(--gold)' },
            { label: 'Netto Marge',   val: fmt(totalNetto),  sub: pct(totalNetto/totalOmzet) + ' na commissies',        accent: 'var(--green)', top: 'var(--green)' },
            { label: 'Commissies',    val: fmt(totalComm),   sub: pct(totalComm/totalOmzet) + ' van omzet',             accent: 'var(--muted)', top: 'var(--muted)' },
          ].map((k, i) => (
            <div key={i} style={{
              background: 'var(--card)',
              border: '1px solid rgba(0,180,216,.12)',
              borderRadius: 14,
              padding: '22px 20px 18px',
              borderTop: `3px solid ${k.top}`,
              transition: 'transform .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>{k.label}</div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, letterSpacing: 1, color: k.accent, lineHeight: 1 }}>{k.val}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, fontFamily: "'DM Mono'" }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Donut + legend */}
        <SectionTitle>Omzetverdeling per verkoper</SectionTitle>
        <div className="animate-fade-up" style={{
          display: 'flex', alignItems: 'center', gap: 28,
          background: 'var(--card)', border: '1px solid rgba(0,180,216,.12)',
          borderRadius: 16, padding: '24px 28px', marginBottom: 44,
        }}>
          <Donut sellers={sellers} />
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
            {sellers.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.alias}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'DM Mono'", marginTop: 2 }}>
                    {fmt(s.omzet)} · {pct(s.aandeel)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Seller cards */}
        <SectionTitle>Individuele prestaties</SectionTitle>
        <div className="animate-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20, marginBottom: 44 }}>
          {sellers.map((s, i) => (
            <SellerCard key={i} seller={s} rank={i + 1} maxOmzet={maxOmzet} />
          ))}
        </div>

        {/* Table */}
        <SectionTitle>Gedetailleerde vergelijking</SectionTitle>
        <div className="animate-fade-up" style={{ marginBottom: 44, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
            <thead>
              <tr>
                {['Verkoper','Leads','Omzet','Inkoopprijs','Bruto Marge','Marge %','Commissie','Netto Marge','Netto %'].map(h => (
                  <th key={h} style={{
                    fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
                    color: 'var(--muted)', fontWeight: 500, padding: '0 14px 10px',
                    textAlign: h === 'Verkoper' ? 'left' : 'right',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sellers.map((s, i) => (
                <tr key={i}>
                  <Td left><span style={{ fontWeight: 700 }}>{s.name}</span>{s.owner && <span style={{ background: 'rgba(245,166,35,.15)', color: 'var(--gold)', borderRadius: 4, padding: '1px 6px', fontSize: 9, marginLeft: 6 }}>eigenaar</span>}</Td>
                  <Td color="var(--cyan2)">{s.leads}</Td>
                  <Td color="var(--cyan2)">{fmt(s.omzet)}</Td>
                  <Td color="var(--muted)">{fmt(s.inkoop)}</Td>
                  <Td color="var(--white)">{fmt(s.marge)}</Td>
                  <Td color="var(--white)">{pct(s.margePct)}</Td>
                  <Td color="var(--muted)">{s.commEur > 0 ? fmt(s.commEur) : '—'}</Td>
                  <Td color="var(--green)" bold>{fmt(s.nettoMarge)}</Td>
                  <Td color="var(--green)">{pct(s.nettoPct)}</Td>
                </tr>
              ))}
              {/* Total row */}
              <tr>
                <Td left total>TOTAAL</Td>
                <Td total>{totalLeads}</Td>
                <Td total>{fmt(totalOmzet)}</Td>
                <Td total>{fmt(sellers.reduce((a,s)=>a+s.inkoop,0))}</Td>
                <Td total>{fmt(totalMarge)}</Td>
                <Td total>{pct(totalMarge/totalOmzet)}</Td>
                <Td total>{fmt(totalComm)}</Td>
                <Td total>{fmt(totalNetto)}</Td>
                <Td total>{pct(totalNetto/totalOmzet)}</Td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Commission */}
        <SectionTitle>Commissiestructuur</SectionTitle>
        <div className="animate-fade-up" style={{ display: 'grid', gridTemplateColumns: `repeat(${sellers.length},1fr)`, gap: 14, marginBottom: 44 }}>
          {sellers.map((s, i) => (
            <div key={i} style={{
              background: 'var(--card)',
              border: `1px solid ${s.owner ? 'rgba(245,166,35,.2)' : 'rgba(0,180,216,.12)'}`,
              borderRadius: 12, padding: '18px 16px', textAlign: 'center',
              transition: 'transform .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--white)', marginBottom: 8 }}>{s.alias}</div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: s.owner ? 'var(--gold)' : 'var(--cyan)', lineHeight: 1 }}>
                {(s.commPct * 100).toFixed(0)}%
              </div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: 12, color: s.owner ? 'var(--gold)' : 'var(--muted)', marginTop: 6 }}>
                {s.owner ? 'eigenaar' : fmt(s.commEur)}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: '1px solid rgba(0,180,216,.12)', paddingTop: 24,
        }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 16, letterSpacing: 3, color: 'var(--muted)' }}>
            HIVO<span style={{ color: 'var(--cyan)' }}>LTA</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1 }}>Vertrouwelijk — intern gebruik</div>
        </div>

      </div>
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
      color: 'var(--muted)', marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {children}
      <div style={{ flex: 1, height: 1, background: 'rgba(0,180,216,.12)' }} />
    </div>
  )
}

function Td({ children, left, color, bold, total }: {
  children: React.ReactNode
  left?: boolean; color?: string; bold?: boolean; total?: boolean
}) {
  return (
    <td style={{
      background: total ? 'rgba(0,180,216,.12)' : 'var(--card)',
      padding: '14px 14px',
      fontFamily: left ? "'DM Sans'" : "'DM Mono'",
      fontSize: total && left ? 14 : 13,
      fontFamily2: total && left ? "'Bebas Neue'" : undefined,
      textAlign: left ? 'left' : 'right',
      color: total ? 'var(--cyan2)' : (color || 'var(--white)'),
      fontWeight: bold || total ? 700 : 400,
      borderTop: `1px solid ${total ? 'rgba(0,180,216,.2)' : 'rgba(0,180,216,.07)'}`,
      borderBottom: `1px solid ${total ? 'rgba(0,180,216,.2)' : 'rgba(0,180,216,.07)'}`,
      ...(left ? {
        borderLeft: `1px solid ${total ? 'rgba(0,180,216,.2)' : 'rgba(0,180,216,.07)'}`,
        borderRadius: '8px 0 0 8px',
        paddingLeft: 18,
      } : {}),
    } as React.CSSProperties}>
      {total && left
        ? <span style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 2, color: 'var(--cyan)' }}>{children}</span>
        : children}
    </td>
  )
}

function SellerCard({ seller: s, rank, maxOmzet }: { seller: Seller; rank: number; maxOmzet: number }) {
  const barW = (s.omzet / maxOmzet * 100).toFixed(1)
  const mh = 36
  const bH = Math.round(s.margePct * mh * 2.8)
  const cH = s.commEur > 0 ? Math.max(4, Math.round(s.commEur / s.marge * bH)) : 0
  const nH = Math.max(4, bH - cH)

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid rgba(0,180,216,.12)',
      borderTop: `3px solid ${s.color}`,
      borderRadius: 16, padding: 24,
      position: 'relative', overflow: 'hidden',
      transition: 'transform .2s, box-shadow .2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,.3)' }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Ghost rank */}
      <div style={{ position: 'absolute', top: 14, right: 18, fontFamily: "'Bebas Neue'", fontSize: 52, color: 'rgba(255,255,255,.04)', lineHeight: 1 }}>#{rank}</div>

      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)', marginBottom: 2 }}>{s.name}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        {s.leads} leads
        <span style={{
          background: s.owner ? 'rgba(245,166,35,.1)' : 'rgba(0,180,216,.12)',
          border: `1px solid ${s.owner ? 'rgba(245,166,35,.25)' : 'rgba(0,180,216,.2)'}`,
          borderRadius: 20, padding: '2px 9px',
          fontSize: 10, fontFamily: "'DM Mono'",
          color: s.owner ? 'var(--gold)' : 'var(--cyan2)',
          letterSpacing: 1,
        }}>
          {s.owner ? 'eigenaar · 0%' : `${(s.commPct * 100).toFixed(0)}% commissie`}
        </span>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Omzet', val: fmt(s.omzet), color: 'var(--cyan)' },
          { label: 'Bruto marge', val: pct(s.margePct), color: 'var(--white)' },
          { label: 'Netto marge', val: fmt(s.nettoMarge), color: 'var(--green)' },
        ].map((m, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 14, fontWeight: 500, color: m.color }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>
          <span>Aandeel omzet</span>
          <span style={{ color: s.color }}>{pct(s.aandeel)}</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${barW}%`, background: s.color, borderRadius: 99 }} />
        </div>
      </div>

      {/* Waterfall */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 50, marginTop: 14 }}>
        {[
          { h: bH, color: 'rgba(0,180,216,.5)', label: 'bruto' },
          { h: cH, color: 'rgba(231,76,60,.6)',  label: 'comm.' },
          { h: nH, color: s.color,               label: 'netto' },
        ].map((col, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            {col.h > 0 && <div style={{ width: '100%', height: col.h, background: col.color, borderRadius: '4px 4px 0 0', minHeight: 4 }} />}
            <div style={{ fontSize: 8, color: 'var(--muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{col.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Excel parser ─────────────────────────────────────────────────────────────
function parseExcel(file: File): Promise<{ sellers: Seller[]; period: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data  = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb    = XLSX.read(data, { type: 'array' })
        const ws    = wb.Sheets[wb.SheetNames[0]]
        const rows  = XLSX.utils.sheet_to_json<RawRow>(ws)

        const sellers: Seller[] = []
        let colorIdx = 0

        rows.forEach(row => {
          const name = String(row['Accountmanager'] || '').trim()
          if (!name || name === '' || !row['Verkoopprijs']) return

          const omzet  = Number(row['Verkoopprijs'] ?? 0)
          const inkoop = Number(row['Inkoopprijs']  ?? 0)
          const marge  = Number(row['Marge']        ?? omzet - inkoop)
          const leads  = Number(row['# Leads']      ?? 0)

          const { pct: commPct, owner } = getCommission(name)
          const commEur    = omzet * commPct
          const nettoMarge = marge - commEur

          sellers.push({
            name,
            alias: getAlias(name),
            leads,
            omzet,
            inkoop,
            marge,
            commPct,
            commEur,
            nettoMarge,
            margePct:  marge / omzet,
            nettoPct:  nettoMarge / omzet,
            aandeel:   0, // filled below
            color:     COLORS[colorIdx++ % COLORS.length],
            owner,
          })
        })

        const totalOmzet = sellers.reduce((a, s) => a + s.omzet, 0)
        sellers.forEach(s => s.aandeel = s.omzet / totalOmzet)

        // Sort by omzet desc
        sellers.sort((a, b) => b.omzet - a.omzet)

        // Period from filename or today
        const now    = new Date()
        const months = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
        const period = `${months[now.getMonth()]} ${now.getFullYear()}`

        resolve({ sellers, period })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [sellers, setSellers] = useState<Seller[] | null>(null)
  const [period,  setPeriod]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleFile = async (file: File) => {
    setLoading(true)
    setError('')
    try {
      const result = await parseExcel(file)
      setSellers(result.sellers)
      setPeriod(result.period)
    } catch {
      setError('Kon het bestand niet inlezen. Controleer of het het juiste formaat heeft.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)', gap: 20 }}>
      <div style={{ width: 48, height: 48, border: '3px solid rgba(0,180,216,.2)', borderTopColor: 'var(--cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontFamily: "'DM Mono'", fontSize: 13, color: 'var(--muted)', letterSpacing: 2 }}>Bestand verwerken…</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)', gap: 20 }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <div style={{ color: 'var(--red)', fontFamily: "'DM Mono'", fontSize: 13 }}>{error}</div>
      <button onClick={() => setError('')} style={{ background: 'var(--cyan)', color: 'var(--navy)', border: 'none', borderRadius: 99, padding: '10px 28px', fontWeight: 700, cursor: 'pointer' }}>Opnieuw proberen</button>
    </div>
  )

  if (sellers) return <DashboardView sellers={sellers} period={period} onReset={() => setSellers(null)} />

  return <UploadScreen onFile={handleFile} />
}
