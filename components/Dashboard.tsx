'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { exportDashboardPdf } from './exportPdf'

// ─── Types ────────────────────────────────────────────────────────────────────
interface RawRow { [key: string]: unknown }

interface Seller {
  name: string; alias: string; leads: number
  omzet: number; inkoop: number; marge: number
  commPct: number; commEur: number; nettoMarge: number
  margePct: number; nettoPct: number; aandeel: number
  color: string; owner: boolean
}

interface CostItem { label: string; amount: number }
interface Costs {
  fixed: CostItem[]
  variable: CostItem[]
  totalFixed: number
  totalVariable: number
  total: number
}

// ─── Constants ────────────────────────────────────────────────────────────────
const COMMISSION_RULES: Record<string, number> = {
  cliff: 0.10, einar: 0.10, ejnar: 0.10,
  christophe: 0.05, kristof: 0.05, cedric: 0.00,
}
const OWNER_KEYS = ['cedric']
const COLORS = ['#00b4d8','#f5a623','#2ecc71','#e88b4a','#a78bfa','#f472b6']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCommission(name: string) {
  const lower = name.toLowerCase()
  for (const [key, pct] of Object.entries(COMMISSION_RULES))
    if (lower.includes(key)) return { pct, owner: OWNER_KEYS.includes(key) }
  return { pct: 0, owner: false }
}

const fmt  = (n: number) => '€' + Math.round(n).toLocaleString('nl-BE')
const fpct = (n: number) => (n * 100).toFixed(1) + '%'

// ─── Parsers ──────────────────────────────────────────────────────────────────
function parseSalesExcel(file: File): Promise<{ sellers: Seller[]; period: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb   = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' })
        const rows = XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[wb.SheetNames[0]])
        const sellers: Seller[] = []
        let colorIdx = 0
        rows.forEach(row => {
          const name  = String(row['Accountmanager'] || '').trim()
          if (!name || !row['Verkoopprijs']) return
          const omzet  = Number(row['Verkoopprijs'] ?? 0)
          const inkoop = Number(row['Inkoopprijs']  ?? 0)
          const marge  = Number(row['Marge']        ?? omzet - inkoop)
          const leads  = Number(row['# Leads']      ?? 0)
          const { pct: commPct, owner } = getCommission(name)
          const commEur    = omzet * commPct
          const nettoMarge = marge - commEur
          sellers.push({
            name, alias: name.split(' ')[0], leads, omzet, inkoop, marge,
            commPct, commEur, nettoMarge,
            margePct: marge / omzet, nettoPct: nettoMarge / omzet,
            aandeel: 0, color: COLORS[colorIdx++ % COLORS.length], owner,
          })
        })
        const totalOmzet = sellers.reduce((a, s) => a + s.omzet, 0)
        sellers.forEach(s => s.aandeel = s.omzet / totalOmzet)
        sellers.sort((a, b) => b.omzet - a.omzet)
        const now = new Date()
        const months = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
        resolve({ sellers, period: `${months[now.getMonth()]} ${now.getFullYear()}` })
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function parseCostsExcel(file: File): Promise<Costs> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' })
        const fixed: CostItem[]    = []
        const variable: CostItem[] = []

        wb.SheetNames.forEach(sheetName => {
          const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1 })
          const isFixed = sheetName.toLowerCase().includes('vast')
          rows.forEach(row => {
            if (!Array.isArray(row) || (row as unknown[]).length < 2) return
            const r = row as unknown[]
            const label  = String(r[0] || '').trim()
            const amount = Number(r[1])
            if (!label || isNaN(amount) || amount <= 0) return
            if (isFixed) fixed.push({ label, amount })
            else variable.push({ label, amount })
          })
        })

        const totalFixed    = fixed.reduce((a, c) => a + c.amount, 0)
        const totalVariable = variable.reduce((a, c) => a + c.amount, 0)
        resolve({ fixed, variable, totalFixed, totalVariable, total: totalFixed + totalVariable })
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ─── Donut SVG ────────────────────────────────────────────────────────────────
function Donut({ sellers }: { sellers: Seller[] }) {
  const cx = 80, cy = 80, r = 68, ri = 46
  let start = -Math.PI / 2
  const paths = sellers.map((s, i) => {
    const angle = s.aandeel * 2 * Math.PI
    const end   = start + angle
    const x1 = cx + r*Math.cos(start), y1 = cy + r*Math.sin(start)
    const x2 = cx + r*Math.cos(end),   y2 = cy + r*Math.sin(end)
    const ix1= cx + ri*Math.cos(start),iy1= cy + ri*Math.sin(start)
    const ix2= cx + ri*Math.cos(end),  iy2= cy + ri*Math.sin(end)
    const lg = angle > Math.PI ? 1 : 0
    const d  = `M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ri} ${ri} 0 ${lg} 0 ${ix1} ${iy1} Z`
    start = end
    return <path key={i} d={d} fill={s.color} opacity={0.9} />
  })
  const total = sellers.reduce((a,s) => a+s.omzet, 0)
  return (
    <svg width={160} height={160} viewBox="0 0 160 160">
      {paths}
      <text x={80} y={76} textAnchor="middle" fontFamily="'Bebas Neue'" fontSize={18} fill="#f0f6ff">{fmt(total)}</text>
      <text x={80} y={91} textAnchor="middle" fontFamily="'DM Sans'" fontSize={9} fill="#6b8aaa">totaal omzet</text>
    </svg>
  )
}

// ─── Section title ─────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize:10, letterSpacing:3, textTransform:'uppercase', color:'#6b8aaa', marginBottom:16,
      display:'flex', alignItems:'center', gap:12 }}>
      {children}
      <div style={{ flex:1, height:1, background:'rgba(0,180,216,.12)' }} />
    </div>
  )
}

// ─── Seller card ───────────────────────────────────────────────────────────────
function SellerCard({ s, rank, maxOmzet }: { s: Seller; rank: number; maxOmzet: number }) {
  const barW = (s.omzet / maxOmzet * 100).toFixed(1)
  return (
    <div style={{ background:'#152842', border:'1px solid rgba(0,180,216,.12)', borderTop:`3px solid ${s.color}`,
      borderRadius:16, padding:24, position:'relative', overflow:'hidden',
      transition:'transform .2s, box-shadow .2s' }}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 16px 40px rgba(0,0,0,.3)'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}
    >
      <div style={{ position:'absolute', top:14, right:18, fontFamily:"'Bebas Neue'", fontSize:52, color:'rgba(255,255,255,.04)', lineHeight:1 }}>#{rank}</div>
      <div style={{ fontSize:16, fontWeight:700, color:'#f0f6ff', marginBottom:2 }}>{s.name}</div>
      <div style={{ fontSize:11, color:'#6b8aaa', marginBottom:18, display:'flex', alignItems:'center', gap:8 }}>
        {s.leads} leads
        <span style={{ background:s.owner?'rgba(245,166,35,.1)':'rgba(0,180,216,.12)',
          border:`1px solid ${s.owner?'rgba(245,166,35,.25)':'rgba(0,180,216,.2)'}`,
          borderRadius:20, padding:'2px 9px', fontSize:10, fontFamily:"'DM Mono'",
          color:s.owner?'#f5a623':'#90e0ef', letterSpacing:1 }}>
          {s.owner ? 'eigenaar · 0%' : `${(s.commPct*100).toFixed(0)}% commissie`}
        </span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:18 }}>
        {[
          { label:'Omzet',       val: fmt(s.omzet),      color:'#00b4d8' },
          { label:'Bruto marge', val: fpct(s.margePct),  color:'#f0f6ff' },
          { label:'Netto marge', val: fmt(s.nettoMarge), color:'#2ecc71' },
        ].map((m,i) => (
          <div key={i} style={{ background:'rgba(255,255,255,.03)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:'#6b8aaa', marginBottom:4 }}>{m.label}</div>
            <div style={{ fontFamily:"'DM Mono'", fontSize:14, fontWeight:500, color:m.color }}>{m.val}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#6b8aaa', marginBottom:6 }}>
          <span>Aandeel omzet</span><span style={{ color:s.color }}>{fpct(s.aandeel)}</span>
        </div>
        <div style={{ height:6, background:'rgba(255,255,255,.06)', borderRadius:99, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${barW}%`, background:s.color, borderRadius:99 }} />
        </div>
      </div>
    </div>
  )
}

// ─── Costs panel ──────────────────────────────────────────────────────────────
function CostsPanel({ costs, netResult }: { costs: Costs; netResult: number }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:8 }}>
      {/* Fixed costs */}
      <div style={{ background:'#152842', border:'1px solid rgba(0,180,216,.12)', borderTop:'3px solid #6b8aaa', borderRadius:16, padding:20 }}>
        <div style={{ fontSize:11, letterSpacing:2, textTransform:'uppercase', color:'#6b8aaa', marginBottom:16 }}>Vaste maandelijkse kosten</div>
        {costs.fixed.map((c,i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
            <span style={{ fontSize:12, color:'#f0f6ff' }}>{c.label}</span>
            <span style={{ fontFamily:"'DM Mono'", fontSize:12, color:'#6b8aaa' }}>{fmt(c.amount)}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, paddingTop:10,
          borderTop:'1px solid rgba(107,138,170,.3)' }}>
          <span style={{ fontWeight:700, fontSize:13, color:'#f0f6ff' }}>Totaal vast</span>
          <span style={{ fontFamily:"'DM Mono'", fontSize:13, fontWeight:700, color:'#e74c3c' }}>{fmt(costs.totalFixed)}</span>
        </div>
      </div>

      {/* Variable costs */}
      <div style={{ background:'#152842', border:'1px solid rgba(0,180,216,.12)', borderTop:'3px solid #e88b4a', borderRadius:16, padding:20 }}>
        <div style={{ fontSize:11, letterSpacing:2, textTransform:'uppercase', color:'#6b8aaa', marginBottom:16 }}>Variabele kosten</div>
        {costs.variable.map((c,i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
            <span style={{ fontSize:12, color:'#f0f6ff' }}>{c.label}</span>
            <span style={{ fontFamily:"'DM Mono'", fontSize:12, color:'#6b8aaa' }}>{fmt(c.amount)}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, paddingTop:10,
          borderTop:'1px solid rgba(107,138,170,.3)' }}>
          <span style={{ fontWeight:700, fontSize:13, color:'#f0f6ff' }}>Totaal variabel</span>
          <span style={{ fontFamily:"'DM Mono'", fontSize:13, fontWeight:700, color:'#e74c3c' }}>{fmt(costs.totalVariable)}</span>
        </div>
      </div>

      {/* Net result — full width */}
      <div style={{ gridColumn:'1 / -1', background: netResult >= 0 ? 'rgba(46,204,113,.08)' : 'rgba(231,76,60,.08)',
        border:`1px solid ${netResult >= 0 ? 'rgba(46,204,113,.3)' : 'rgba(231,76,60,.3)'}`,
        borderRadius:16, padding:'20px 28px',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:11, letterSpacing:2, textTransform:'uppercase', color:'#6b8aaa', marginBottom:6 }}>
            Netto bedrijfsresultaat
          </div>
          <div style={{ fontSize:12, color:'#6b8aaa' }}>
            Marge na commissies&nbsp;
            <span style={{ color:'#f0f6ff' }}>{fmt(costs.total + 0)}</span>
            &nbsp;min totale kosten&nbsp;
            <span style={{ color:'#e74c3c' }}>{fmt(costs.total)}</span>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:"'Bebas Neue'", fontSize:40, letterSpacing:2,
            color: netResult >= 0 ? '#2ecc71' : '#e74c3c', lineHeight:1 }}>
            {fmt(netResult)}
          </div>
          <div style={{ fontSize:11, color:'#6b8aaa', marginTop:4 }}>
            {netResult >= 0 ? '✓ positief resultaat' : '⚠ negatief resultaat'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Comparison table ─────────────────────────────────────────────────────────
function CompTable({ sellers }: { sellers: Seller[] }) {
  const totalOmzet = sellers.reduce((a,s)=>a+s.omzet,0)
  const totalMarge = sellers.reduce((a,s)=>a+s.marge,0)
  const totalComm  = sellers.reduce((a,s)=>a+s.commEur,0)
  const totalNetto = totalMarge - totalComm
  const totalLeads = sellers.reduce((a,s)=>a+s.leads,0)

  const tdBase: React.CSSProperties = {
    padding:'13px 14px', fontFamily:"'DM Mono'", fontSize:13, textAlign:'right',
    borderTop:'1px solid rgba(0,180,216,.07)', borderBottom:'1px solid rgba(0,180,216,.07)',
  }
  const thBase: React.CSSProperties = {
    fontSize:9, letterSpacing:2, textTransform:'uppercase', color:'#6b8aaa',
    fontWeight:500, padding:'0 14px 10px', textAlign:'right',
  }

  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:'0 6px' }}>
        <thead>
          <tr>
            {['Verkoper','Leads','Omzet','Inkoopprijs','Bruto Marge','Marge %','Commissie','Netto Marge','Netto %'].map((h,i) => (
              <th key={h} style={{ ...thBase, textAlign: i===0?'left':'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sellers.map((s,i) => (
            <tr key={i}>
              <td style={{ ...tdBase, background:'#152842', textAlign:'left', fontFamily:"'DM Sans'", fontWeight:600, fontSize:13,
                border:'1px solid rgba(0,180,216,.07)', borderRight:'none', borderRadius:'8px 0 0 8px', paddingLeft:18 }}>
                {s.name}{s.owner&&<span style={{ background:'rgba(245,166,35,.15)', color:'#f5a623', borderRadius:4, padding:'1px 6px', fontSize:9, marginLeft:6 }}>eigenaar</span>}
              </td>
              {[s.leads, fmt(s.omzet), fmt(s.inkoop), fmt(s.marge), fpct(s.margePct),
                s.commEur>0?fmt(s.commEur):'—', fmt(s.nettoMarge), fpct(s.nettoPct)].map((v,vi) => (
                <td key={vi} style={{ ...tdBase, background:'#152842',
                  color: vi===6?'#2ecc71': vi===7?'#2ecc71': vi===2?'#6b8aaa': vi===5?'#6b8aaa': '#90e0ef',
                  borderTop:'1px solid rgba(0,180,216,.07)', borderBottom:'1px solid rgba(0,180,216,.07)',
                  ...(vi===7?{borderRight:'1px solid rgba(0,180,216,.07)', borderRadius:'0 8px 8px 0'}:{}) }}>{v}</td>
              ))}
            </tr>
          ))}
          <tr>
            <td style={{ ...tdBase, background:'rgba(0,180,216,.12)', textAlign:'left', fontFamily:"'Bebas Neue'",
              fontSize:15, letterSpacing:2, color:'#00b4d8', border:'1px solid rgba(0,180,216,.2)',
              borderRight:'none', borderRadius:'8px 0 0 8px', paddingLeft:18 }}>TOTAAL</td>
            {[totalLeads, fmt(totalOmzet), fmt(sellers.reduce((a,s)=>a+s.inkoop,0)),
              fmt(totalMarge), fpct(totalMarge/totalOmzet), fmt(totalComm),
              fmt(totalNetto), fpct(totalNetto/totalOmzet)].map((v,vi) => (
              <td key={vi} style={{ ...tdBase, background:'rgba(0,180,216,.12)', fontWeight:700,
                color: vi===6?'#2ecc71': vi===7?'#2ecc71': '#90e0ef',
                border:'1px solid rgba(0,180,216,.2)', borderLeft:'none',
                ...(vi===7?{borderRadius:'0 8px 8px 0'}:{}) }}>{v}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Dashboard view ────────────────────────────────────────────────────────────
function DashboardView({ sellers, period, costs, onReset, onAddCosts, onRemoveCosts }:{
  sellers: Seller[]; period: string; costs: Costs | null
  onReset: ()=>void; onAddCosts: (f:File)=>void; onRemoveCosts: ()=>void
}) {
  const [saving, setSaving]     = useState(false)
  const [costsErr, setCostsErr] = useState('')
  const costsInputRef           = useRef<HTMLInputElement>(null)

  const totalOmzet = sellers.reduce((a,s)=>a+s.omzet,0)
  const totalMarge = sellers.reduce((a,s)=>a+s.marge,0)
  const totalComm  = sellers.reduce((a,s)=>a+s.commEur,0)
  const totalNetto = totalMarge - totalComm
  const totalLeads = sellers.reduce((a,s)=>a+s.leads,0)
  const maxOmzet   = Math.max(...sellers.map(s=>s.omzet))
  const netResult  = costs ? totalNetto - costs.total : null

  const handleCostsFile = async (file: File) => {
    setCostsErr('')
    try { onAddCosts(file) }
    catch { setCostsErr('Kon kostenbestand niet inlezen.') }
  }

  const savePdf = async () => {
    setSaving(true)
    try { exportDashboardPdf(sellers, period, costs ?? undefined) }
    finally { setSaving(false) }
  }

  // KPI cards
  const kpis = costs && netResult !== null ? [
    { label:'Totale Omzet',    val:fmt(totalOmzet), sub:`${totalLeads} leads`, color:'#00b4d8' },
    { label:'Netto na comm.',  val:fmt(totalNetto), sub:fpct(totalNetto/totalOmzet)+' marge', color:'#f5a623' },
    { label:'Totale kosten',   val:fmt(costs.total), sub:`vast ${fmt(costs.totalFixed)} · var. ${fmt(costs.totalVariable)}`, color:'#e74c3c' },
    { label:'Netto resultaat', val:fmt(netResult), sub: netResult>=0 ? '✓ positief' : '⚠ negatief', color: netResult>=0 ? '#2ecc71' : '#e74c3c' },
  ] : [
    { label:'Totale Omzet',   val:fmt(totalOmzet),  sub:`${totalLeads} leads · ${sellers.length} verkopers`, color:'#00b4d8' },
    { label:'Bruto Marge',    val:fmt(totalMarge),  sub:fpct(totalMarge/totalOmzet)+' van omzet', color:'#f5a623' },
    { label:'Netto Marge',    val:fmt(totalNetto),  sub:fpct(totalNetto/totalOmzet)+' na commissies', color:'#2ecc71' },
    { label:'Commissies',     val:fmt(totalComm),   sub:fpct(totalComm/totalOmzet)+' van omzet', color:'#6b8aaa' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#0d1f35' }}>
      {/* Toolbar */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'rgba(13,31,53,.95)',
        backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(0,180,216,.15)',
        padding:'12px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:22, letterSpacing:4, color:'#f0f6ff' }}>
          HIVO<span style={{ color:'#00b4d8' }}>LTA</span>
          <span style={{ fontSize:13, letterSpacing:2, color:'#6b8aaa', marginLeft:16, fontFamily:"'DM Sans'", fontWeight:400 }}>{period}</span>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={onReset} style={{ background:'transparent', border:'1px solid rgba(0,180,216,.3)',
            color:'#6b8aaa', borderRadius:99, padding:'8px 18px', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans'" }}>
            ← Nieuw bestand
          </button>
          {/* Costs upload button */}
          {!costs ? (
            <>
              <button onClick={()=>costsInputRef.current?.click()} style={{
                background:'rgba(0,180,216,.1)', border:'1px solid rgba(0,180,216,.4)',
                color:'#00b4d8', borderRadius:99, padding:'8px 18px', fontSize:12,
                cursor:'pointer', fontFamily:"'DM Sans'", fontWeight:600 }}>
                📎 Kostenbestand toevoegen
              </button>
              <input ref={costsInputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }}
                onChange={e=>{ if(e.target.files?.[0]) handleCostsFile(e.target.files[0]) }} />
            </>
          ) : (
            <button onClick={onRemoveCosts} style={{
              background:'rgba(231,76,60,.1)', border:'1px solid rgba(231,76,60,.3)',
              color:'#e74c3c', borderRadius:99, padding:'8px 18px', fontSize:12,
              cursor:'pointer', fontFamily:"'DM Sans'" }}>
              ✕ Kosten verwijderen
            </button>
          )}
          <button onClick={savePdf} disabled={saving} style={{
            background: saving ? 'rgba(0,180,216,.3)' : '#00b4d8',
            color:'#0d1f35', border:'none', borderRadius:99, padding:'8px 22px',
            fontSize:12, fontWeight:700, cursor: saving?'not-allowed':'pointer',
            fontFamily:"'DM Sans'", display:'flex', alignItems:'center', gap:8 }}>
            {saving ? '⏳ Opslaan...' : '⬇ Opslaan als PDF'}
          </button>
        </div>
      </div>
      {costsErr && <div style={{ background:'rgba(231,76,60,.1)', color:'#e74c3c', padding:'10px 32px', fontSize:12 }}>{costsErr}</div>}

      {/* Dashboard content */}
      <div id="hv-dashboard-root" style={{ padding:'48px 32px 64px', maxWidth:1100, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between',
          borderBottom:'1px solid rgba(0,180,216,.2)', paddingBottom:28, marginBottom:44 }}>
          <div>
            <div style={{ fontFamily:"'Bebas Neue'", fontSize:46, letterSpacing:4, color:'#f0f6ff', lineHeight:1 }}>
              HIVO<span style={{ color:'#00b4d8' }}>LTA</span>
            </div>
            <div style={{ fontSize:11, letterSpacing:3, textTransform:'uppercase', color:'#6b8aaa', marginTop:4 }}>Smart Energy Solutions</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:11, letterSpacing:2, textTransform:'uppercase', color:'#6b8aaa' }}>Verkoopoverzicht</div>
            <div style={{ fontFamily:"'Bebas Neue'", fontSize:22, letterSpacing:2, color:'#00b4d8' }}>{period}</div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:44 }}>
          {kpis.map((k,i) => (
            <div key={i} style={{ background:'#152842', border:'1px solid rgba(0,180,216,.12)',
              borderTop:`3px solid ${k.color}`, borderRadius:14, padding:'22px 20px 18px',
              transition:'transform .2s' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:'uppercase', color:'#6b8aaa', marginBottom:10 }}>{k.label}</div>
              <div style={{ fontFamily:"'Bebas Neue'", fontSize:32, letterSpacing:1, color:k.color, lineHeight:1 }}>{k.val}</div>
              <div style={{ fontSize:11, color:'#6b8aaa', marginTop:6, fontFamily:"'DM Mono'" }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Costs section — shown when costs loaded */}
        {costs && netResult !== null && (
          <>
            <SectionTitle>Kostenanalyse & Netto Resultaat</SectionTitle>
            <div style={{ marginBottom:44 }}>
              <CostsPanel costs={costs} netResult={netResult} />
            </div>
          </>
        )}

        {/* No costs yet — prompt */}
        {!costs && (
          <div style={{ marginBottom:44, background:'rgba(0,180,216,.04)',
            border:'1px dashed rgba(0,180,216,.25)', borderRadius:16,
            padding:'28px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontFamily:"'Bebas Neue'", fontSize:16, letterSpacing:2, color:'#00b4d8', marginBottom:4 }}>
                Kostenbestand toevoegen voor netto berekening
              </div>
              <div style={{ fontSize:12, color:'#6b8aaa' }}>
                Upload een Excel met vaste én variabele kosten om het netto bedrijfsresultaat te berekenen
              </div>
            </div>
            <button onClick={()=>costsInputRef.current?.click()} style={{
              background:'#00b4d8', color:'#0d1f35', border:'none', borderRadius:99,
              padding:'10px 24px', fontWeight:700, fontSize:13, cursor:'pointer',
              fontFamily:"'DM Sans'", whiteSpace:'nowrap', marginLeft:24 }}>
              📎 Bestand kiezen
            </button>
            <input ref={costsInputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }}
              onChange={e=>{ if(e.target.files?.[0]) handleCostsFile(e.target.files[0]) }} />
          </div>
        )}

        {/* Donut */}
        <SectionTitle>Omzetverdeling per verkoper</SectionTitle>
        <div style={{ display:'flex', alignItems:'center', gap:28, background:'#152842',
          border:'1px solid rgba(0,180,216,.12)', borderRadius:16, padding:'24px 28px', marginBottom:44 }}>
          <Donut sellers={sellers} />
          <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 24px' }}>
            {sellers.map((s,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:s.color, flexShrink:0 }} />
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:s.color }}>{s.alias}</div>
                  <div style={{ fontSize:11, color:'#6b8aaa', fontFamily:"'DM Mono'", marginTop:2 }}>
                    {fmt(s.omzet)} · {fpct(s.aandeel)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Seller cards */}
        <SectionTitle>Individuele prestaties</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:20, marginBottom:44 }}>
          {sellers.map((s,i) => <SellerCard key={i} s={s} rank={i+1} maxOmzet={maxOmzet} />)}
        </div>

        {/* Table */}
        <SectionTitle>Gedetailleerde vergelijking</SectionTitle>
        <div style={{ marginBottom:44 }}><CompTable sellers={sellers} /></div>

        {/* Commission boxes */}
        <SectionTitle>Commissiestructuur</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${sellers.length},1fr)`, gap:14, marginBottom:44 }}>
          {sellers.map((s,i) => (
            <div key={i} style={{ background:'#152842',
              border:`1px solid ${s.owner?'rgba(245,166,35,.2)':'rgba(0,180,216,.12)'}`,
              borderRadius:12, padding:'18px 16px', textAlign:'center',
              transition:'transform .2s' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
              <div style={{ fontSize:12, fontWeight:700, color:'#f0f6ff', marginBottom:8 }}>{s.alias}</div>
              <div style={{ fontFamily:"'Bebas Neue'", fontSize:32, color:s.owner?'#f5a623':'#00b4d8', lineHeight:1 }}>
                {(s.commPct*100).toFixed(0)}%
              </div>
              <div style={{ fontFamily:"'DM Mono'", fontSize:12, color:s.owner?'#f5a623':'#6b8aaa', marginTop:6 }}>
                {s.owner ? 'eigenaar' : fmt(s.commEur)}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          borderTop:'1px solid rgba(0,180,216,.12)', paddingTop:24 }}>
          <div style={{ fontFamily:"'Bebas Neue'", fontSize:16, letterSpacing:3, color:'#6b8aaa' }}>
            HIVO<span style={{ color:'#00b4d8' }}>LTA</span>
          </div>
          <div style={{ fontSize:10, color:'#6b8aaa', letterSpacing:1 }}>Vertrouwelijk — intern gebruik</div>
        </div>
      </div>
    </div>
  )
}

// ─── Upload screen ─────────────────────────────────────────────────────────────
function UploadScreen({ onFile }: { onFile: (f:File)=>void }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:'40px 24px', background:'#0d1f35' }}>
      <div style={{ marginBottom:48, textAlign:'center' }}>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:52, letterSpacing:6, color:'#f0f6ff', lineHeight:1 }}>
          HIVO<span style={{ color:'#00b4d8' }}>LTA</span>
        </div>
        <div style={{ fontSize:11, letterSpacing:3, textTransform:'uppercase', color:'#6b8aaa', marginTop:6 }}>
          Verkoopoverzicht Dashboard
        </div>
      </div>
      <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
        onDrop={e=>{e.preventDefault();setDrag(false);if(e.dataTransfer.files[0])onFile(e.dataTransfer.files[0])}}
        onClick={()=>inputRef.current?.click()}
        style={{ width:'100%', maxWidth:480,
          border:`2px dashed ${drag?'#00b4d8':'rgba(0,180,216,.3)'}`,
          borderRadius:20, background:drag?'rgba(0,180,216,.06)':'#152842',
          padding:'52px 32px', textAlign:'center', cursor:'pointer', transition:'all .2s' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>📊</div>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:22, letterSpacing:2, color:'#00b4d8', marginBottom:8 }}>
          Stap 1 — Sleep je verkoopbestand
        </div>
        <div style={{ fontSize:13, color:'#6b8aaa', marginBottom:24 }}>of klik om te kiezen</div>
        <div style={{ display:'inline-block', background:'#00b4d8', color:'#0d1f35',
          fontWeight:700, fontSize:13, padding:'10px 28px', borderRadius:99 }}>
          Bestand kiezen
        </div>
        <div style={{ fontSize:11, color:'#6b8aaa', marginTop:16, letterSpacing:1 }}>
          export-sales-by-account-manager.xlsx
        </div>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }}
          onChange={e=>{ if(e.target.files?.[0]) onFile(e.target.files[0]) }} />
      </div>
      <div style={{ marginTop:20, fontSize:12, color:'#6b8aaa', textAlign:'center', maxWidth:400 }}>
        Daarna kan je optioneel een <strong style={{ color:'#f0f6ff' }}>kostenbestand</strong> toevoegen<br/>
        voor de netto berekening (vaste + variabele kosten)
      </div>
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [sellers, setSellers] = useState<Seller[] | null>(null)
  const [period,  setPeriod]  = useState('')
  const [costs,   setCosts]   = useState<Costs | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleSalesFile = async (file: File) => {
    setLoading(true); setError('')
    try {
      const result = await parseSalesExcel(file)
      setSellers(result.sellers); setPeriod(result.period)
    } catch { setError('Kon het verkoopbestand niet inlezen.') }
    finally { setLoading(false) }
  }

  const handleCostsFile = async (file: File) => {
    try { setCosts(await parseCostsExcel(file)) }
    catch { /* handled in DashboardView */ }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', background:'#0d1f35', gap:20 }}>
      <div style={{ width:48, height:48, border:'3px solid rgba(0,180,216,.2)',
        borderTopColor:'#00b4d8', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
      <div style={{ fontFamily:"'DM Mono'", fontSize:13, color:'#6b8aaa', letterSpacing:2 }}>Verwerken…</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', background:'#0d1f35', gap:20 }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <div style={{ color:'#e74c3c', fontFamily:"'DM Mono'", fontSize:13 }}>{error}</div>
      <button onClick={()=>setError('')} style={{ background:'#00b4d8', color:'#0d1f35',
        border:'none', borderRadius:99, padding:'10px 28px', fontWeight:700, cursor:'pointer' }}>
        Opnieuw proberen
      </button>
    </div>
  )

  if (sellers) return (
    <DashboardView
      sellers={sellers} period={period} costs={costs}
      onReset={()=>{ setSellers(null); setCosts(null) }}
      onAddCosts={handleCostsFile}
      onRemoveCosts={()=>setCosts(null)}
    />
  )

  return <UploadScreen onFile={handleSalesFile} />
}
