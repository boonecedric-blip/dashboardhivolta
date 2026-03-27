import { jsPDF } from 'jspdf'

// ─── Brand colours (hardcoded — no CSS vars) ──────────────────────────────────
const C = {
  navy:   [13,  31,  53]  as [number,number,number],
  navy2:  [22,  45,  71]  as [number,number,number],
  card:   [21,  40,  66]  as [number,number,number],
  cyan:   [0,   180, 216] as [number,number,number],
  cyan2:  [144, 224, 239] as [number,number,number],
  gold:   [245, 166, 35]  as [number,number,number],
  green:  [46,  204, 113] as [number,number,number],
  red:    [231, 76,  60]  as [number,number,number],
  white:  [240, 246, 255] as [number,number,number],
  muted:  [107, 138, 170] as [number,number,number],
}

type RGB = [number,number,number]

interface Seller {
  name: string; alias: string; leads: number
  omzet: number; inkoop: number; marge: number
  commPct: number; commEur: number; nettoMarge: number
  margePct: number; nettoPct: number; aandeel: number
  color: string; owner: boolean
}

// hex → rgb tuple
function hex2rgb(hex: string): RGB {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return [r,g,b]
}

const fmt  = (n: number) => '€' + Math.round(n).toLocaleString('nl-BE')
const fpct = (n: number) => (n*100).toFixed(1)+'%'

interface CostItem { label: string; amount: number }
interface Costs {
  fixed: CostItem[]; variable: CostItem[]
  totalFixed: number; totalVariable: number; total: number
}

export function exportDashboardPdf(sellers: Seller[], period: string, costs?: Costs) {
  // A4 portrait  (210 × 297 mm)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, H = 297
  let y = 0

  // ── helpers ────────────────────────────────────────────────────────────────
  const fill  = (rgb: RGB) => doc.setFillColor(...rgb)
  const stroke= (rgb: RGB) => doc.setDrawColor(...rgb)
  const color = (rgb: RGB) => doc.setTextColor(...rgb)
  const rect  = (x:number,y:number,w:number,h:number,r=0) =>
    r > 0 ? doc.roundedRect(x,y,w,h,r,r,'F') : doc.rect(x,y,w,h,'F')
  const line  = (x1:number,y1:number,x2:number,y2:number) => doc.line(x1,y1,x2,y2)

  // ── BACKGROUND ─────────────────────────────────────────────────────────────
  fill(C.navy); rect(0,0,W,H)

  // subtle cyan glow top-left
  doc.setGState(doc.GState({ opacity: 0.06 }))
  fill(C.cyan); doc.ellipse(30, 40, 60, 40, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))

  // ── HEADER ─────────────────────────────────────────────────────────────────
  y = 14
  // Hivolta wordmark
  doc.setFont('helvetica','bold')
  doc.setFontSize(28)
  color(C.white); doc.text('HIVO', 14, y)
  const hivoW = doc.getTextWidth('HIVO')
  color(C.cyan);  doc.text('LTA', 14 + hivoW, y)

  doc.setFont('helvetica','normal')
  doc.setFontSize(6.5)
  color(C.muted); doc.text('SMART ENERGY SOLUTIONS', 14, y + 4.5)

  // Period top-right
  doc.setFont('helvetica','normal')
  doc.setFontSize(7)
  color(C.muted)
  const periodLabel = 'VERKOOPOVERZICHT'
  doc.text(periodLabel, W-14, y-5, { align:'right' })
  doc.setFont('helvetica','bold')
  doc.setFontSize(11)
  color(C.cyan)
  doc.text(period.toUpperCase(), W-14, y, { align:'right' })

  // header rule
  y += 7
  stroke(C.cyan); doc.setLineWidth(0.25)
  doc.setGState(doc.GState({ opacity: 0.3 }))
  line(14, y, W-14, y)
  doc.setGState(doc.GState({ opacity: 1 }))
  y += 8

  // ── KPI STRIP ──────────────────────────────────────────────────────────────
  const totalOmzet = sellers.reduce((a,s)=>a+s.omzet, 0)
  const totalMarge = sellers.reduce((a,s)=>a+s.marge, 0)
  const totalComm  = sellers.reduce((a,s)=>a+s.commEur, 0)
  const totalNetto = totalMarge - totalComm
  const totalLeads = sellers.reduce((a,s)=>a+s.leads, 0)

  const kpis = [
    { label:'TOTALE OMZET',  val: fmt(totalOmzet), sub:`${totalLeads} leads`,              top: C.cyan  },
    { label:'BRUTO MARGE',   val: fmt(totalMarge), sub: fpct(totalMarge/totalOmzet),        top: C.gold  },
    { label:'NETTO MARGE',   val: fmt(totalNetto), sub: fpct(totalNetto/totalOmzet),        top: C.green },
    { label:'COMMISSIES',    val: fmt(totalComm),  sub: fpct(totalComm/totalOmzet)+' omzet',top: C.muted },
  ]

  const kW = (W-28-9) / 4
  kpis.forEach((k, i) => {
    const x = 14 + i*(kW+3)
    fill(C.card); rect(x, y, kW, 22, 2)
    // top accent bar
    fill(k.top); rect(x, y, kW, 1.2, 1)
    // label
    doc.setFont('helvetica','normal'); doc.setFontSize(5.5)
    color(C.muted); doc.text(k.label, x+3, y+6)
    // value
    doc.setFont('helvetica','bold'); doc.setFontSize(11)
    color(k.top); doc.text(k.val, x+3, y+13)
    // sub
    doc.setFont('helvetica','normal'); doc.setFontSize(5.5)
    color(C.muted); doc.text(k.sub, x+3, y+18.5)
  })
  y += 27

  // ── SECTION TITLE helper ───────────────────────────────────────────────────
  const sectionTitle = (title: string) => {
    doc.setFont('helvetica','normal'); doc.setFontSize(6)
    color(C.muted); doc.text(title, 14, y)
    stroke(C.cyan); doc.setLineWidth(0.2)
    doc.setGState(doc.GState({ opacity: 0.2 }))
    line(14 + doc.getTextWidth(title) + 3, y-1, W-14, y-1)
    doc.setGState(doc.GState({ opacity: 1 }))
    y += 5
  }

  // ── OMZET DONUT (simple pie slices) ────────────────────────────────────────
  sectionTitle('OMZETVERDELING PER VERKOPER')

  const PIE_CX = 35, PIE_CY = y + 18, PIE_R = 14, PIE_RI = 9
  // Draw donut slices
  let startAngle = -90
  sellers.forEach(s => {
    const sliceDeg = s.aandeel * 360
    const endAngle = startAngle + sliceDeg
    // jsPDF doesn't natively do arcs easily; approximate with filled pie + white inner circle
    fill(hex2rgb(s.color))
    // Draw via lines (simple approximation for small radii)
    const steps = Math.max(12, Math.round(sliceDeg / 3))
    doc.setFillColor(...hex2rgb(s.color))
    // Use polygon
    // Draw pie slice as filled polygon using lines
    doc.setFillColor(...hex2rgb(s.color))
    doc.setDrawColor(...hex2rgb(s.color))
    // Draw as multiple triangles from center
    for (let t = 0; t < steps; t++) {
      const a1 = (startAngle + (sliceDeg * t / steps)) * Math.PI / 180
      const a2 = (startAngle + (sliceDeg * (t+1) / steps)) * Math.PI / 180
      doc.triangle(
        PIE_CX, PIE_CY,
        PIE_CX + PIE_R * Math.cos(a1), PIE_CY + PIE_R * Math.sin(a1),
        PIE_CX + PIE_R * Math.cos(a2), PIE_CY + PIE_R * Math.sin(a2),
        'F'
      )
    }
    startAngle = endAngle
  })
  // Inner circle (hole)
  fill(C.navy); doc.circle(PIE_CX, PIE_CY, PIE_RI, 'F')
  // Center text
  doc.setFont('helvetica','bold'); doc.setFontSize(5.5)
  color(C.white)
  const cLabel = fmt(totalOmzet)
  doc.text(cLabel, PIE_CX, PIE_CY+1, { align:'center' })
  doc.setFont('helvetica','normal'); doc.setFontSize(4)
  color(C.muted); doc.text('totaal omzet', PIE_CX, PIE_CY+4, { align:'center' })

  // Legend
  const legX = PIE_CX + PIE_R + 8
  sellers.forEach((s, i) => {
    const ly = y + 8 + i * 9
    fill(hex2rgb(s.color)); doc.circle(legX+2, ly-1.5, 2, 'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(7)
    color(hex2rgb(s.color)); doc.text(s.alias, legX+6, ly)
    doc.setFont('helvetica','normal'); doc.setFontSize(5.5)
    color(C.muted); doc.text(`${fmt(s.omzet)}  ·  ${fpct(s.aandeel)}`, legX+6, ly+3.5)
  })

  y += 42

  // ── SELLER CARDS (2×2 grid) ────────────────────────────────────────────────
  sectionTitle('INDIVIDUELE PRESTATIES')

  const cW = (W-28-5)/2, cH = 36
  sellers.forEach((s, i) => {
    const cx = 14 + (i%2)*(cW+5)
    const cy = y + Math.floor(i/2)*(cH+4)
    const sc = hex2rgb(s.color)

    fill(C.card); rect(cx, cy, cW, cH, 2)
    // top accent
    fill(sc); rect(cx, cy, cW, 1.2, 1)

    // ghost rank
    doc.setFont('helvetica','bold'); doc.setFontSize(28)
    doc.setTextColor(255,255,255); doc.setGState(doc.GState({ opacity:0.04 }))
    doc.text(`#${i+1}`, cx+cW-4, cy+18, { align:'right' })
    doc.setGState(doc.GState({ opacity:1 }))

    // Name
    doc.setFont('helvetica','bold'); doc.setFontSize(8)
    color(C.white); doc.text(s.name, cx+3, cy+7)

    // Badge
    const badgeTxt = s.owner ? 'eigenaar · 0%' : `${(s.commPct*100).toFixed(0)}% commissie`
    const bx = cx+3, by = cy+11.5
    doc.setFont('helvetica','normal'); doc.setFontSize(5)
    const bW = doc.getTextWidth(badgeTxt) + 4
    fill(s.owner ? [69,47,10] as RGB : [0,45,54] as RGB)
    rect(bx, by-3.2, bW, 4.5, 1)
    color(s.owner ? C.gold : C.cyan2); doc.text(badgeTxt, bx+2, by)

    // 3 metrics
    const metrics = [
      { l:'OMZET',       v: fmt(s.omzet),      c: C.cyan  },
      { l:'BRUTO MARGE', v: fpct(s.margePct),  c: C.white },
      { l:'NETTO MARGE', v: fmt(s.nettoMarge), c: C.green },
    ]
    const mW = (cW-10)/3
    metrics.forEach((m,mi) => {
      const mx = cx+3 + mi*(mW+2)
      const my = cy+18
      fill(C.navy2); rect(mx, my, mW, 11, 1)
      doc.setFont('helvetica','normal'); doc.setFontSize(4.5)
      color(C.muted); doc.text(m.l, mx+1.5, my+4)
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5)
      color(m.c); doc.text(m.v, mx+1.5, my+9)
    })

    // Omzet bar
    const barX = cx+3, barY = cy+31.5, barW2 = cW-6
    doc.setFont('helvetica','normal'); doc.setFontSize(4.5)
    color(C.muted); doc.text('Aandeel omzet', barX, barY)
    color(sc); doc.text(fpct(s.aandeel), cx+cW-3, barY, { align:'right' })
    // track
    fill(C.navy2); rect(barX, barY+1.5, barW2, 2, 1)
    // fill
    fill(sc); rect(barX, barY+1.5, barW2*s.aandeel, 2, 1)
  })

  y += 2*(cH+4) + 6

  // ── COMPARISON TABLE ────────────────────────────────────────────────────────
  sectionTitle('GEDETAILLEERDE VERGELIJKING')

  const cols = [
    { h:'VERKOPER',      w:42, align:'left'  as const },
    { h:'LEADS',         w:10, align:'right' as const },
    { h:'OMZET',         w:24, align:'right' as const },
    { h:'INKOOPPRIJS',   w:24, align:'right' as const },
    { h:'BRUTO MARGE',   w:22, align:'right' as const },
    { h:'MARGE %',       w:14, align:'right' as const },
    { h:'COMMISSIE',     w:20, align:'right' as const },
    { h:'NETTO MARGE',   w:22, align:'right' as const },
    { h:'NETTO %',       w:14, align:'right' as const },
  ]
  const tX = 14
  const rowH = 7.5

  // header row
  fill(C.cyan); doc.setGState(doc.GState({ opacity:0.15 }))
  rect(tX, y, W-28, rowH, 1)
  doc.setGState(doc.GState({ opacity:1 }))
  let cx2 = tX + 1.5
  cols.forEach(col => {
    doc.setFont('helvetica','normal'); doc.setFontSize(4.5)
    color(C.muted)
    doc.text(col.h, col.align==='right' ? cx2+col.w-1.5 : cx2, y+4.8, { align: col.align })
    cx2 += col.w
  })
  y += rowH

  // data rows
  sellers.forEach((s, i) => {
    const bg: RGB = i%2===0 ? C.card : C.navy2
    fill(bg); rect(tX, y, W-28, rowH, 0)

    const vals = [
      s.name + (s.owner ? ' ★' : ''),
      String(s.leads),
      fmt(s.omzet),
      fmt(s.inkoop),
      fmt(s.marge),
      fpct(s.margePct),
      s.commEur>0 ? fmt(s.commEur) : '—',
      fmt(s.nettoMarge),
      fpct(s.nettoPct),
    ]
    cx2 = tX + 1.5
    vals.forEach((v, vi) => {
      const col = cols[vi]
      let c: RGB = C.white
      if (vi===0) c = s.owner ? C.gold : C.white
      if (vi===7) c = C.green
      if (vi===8) c = C.green
      if (vi===3 || vi===6) c = C.muted
      if (vi===1 || vi===2) c = C.cyan2
      doc.setFont(vi===0?'helvetica':'courier', vi===0?'normal':'normal')
      doc.setFontSize(vi===0 ? 6 : 6)
      color(c)
      doc.text(v, col.align==='right' ? cx2+col.w-1.5 : cx2, y+4.8, { align: col.align })
      cx2 += col.w
    })
    y += rowH
  })

  // total row
  fill(C.cyan); doc.setGState(doc.GState({ opacity:0.18 }))
  rect(tX, y, W-28, rowH, 1)
  doc.setGState(doc.GState({ opacity:1 }))
  const totals = ['TOTAAL', String(totalLeads), fmt(totalOmzet),
    fmt(sellers.reduce((a,s)=>a+s.inkoop,0)), fmt(totalMarge), fpct(totalMarge/totalOmzet),
    fmt(totalComm), fmt(totalNetto), fpct(totalNetto/totalOmzet)]
  cx2 = tX + 1.5
  totals.forEach((v, vi) => {
    const col = cols[vi]
    const c: RGB = vi===0 ? C.cyan : vi>=7 ? C.green : C.cyan2
    doc.setFont('helvetica','bold'); doc.setFontSize(vi===0?7:6)
    color(c)
    doc.text(v, col.align==='right' ? cx2+col.w-1.5 : cx2, y+4.8, { align: col.align })
    cx2 += col.w
  })
  y += rowH + 8

  // ── COMMISSION BOXES ────────────────────────────────────────────────────────
  sectionTitle('COMMISSIESTRUCTUUR')

  const boxW = (W-28-(sellers.length-1)*4) / sellers.length
  sellers.forEach((s, i) => {
    const bx = 14 + i*(boxW+4)
    fill(s.owner ? [40,28,6] as RGB : C.card)
    stroke(s.owner ? C.gold : C.cyan)
    doc.setLineWidth(0.3)
    doc.setGState(doc.GState({ opacity:0.3 }))
    doc.roundedRect(bx, y, boxW, 20, 2, 2, 'FD')
    doc.setGState(doc.GState({ opacity:1 }))

    doc.setFont('helvetica','bold'); doc.setFontSize(7)
    color(C.white); doc.text(s.alias, bx+boxW/2, y+6, { align:'center' })
    doc.setFont('helvetica','bold'); doc.setFontSize(14)
    color(s.owner ? C.gold : C.cyan)
    doc.text(`${(s.commPct*100).toFixed(0)}%`, bx+boxW/2, y+13.5, { align:'center' })
    doc.setFont('helvetica','normal'); doc.setFontSize(5.5)
    color(s.owner ? C.gold : C.muted)
    doc.text(s.owner ? 'eigenaar' : fmt(s.commEur), bx+boxW/2, y+18.5, { align:'center' })
  })
  y += 28

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  stroke(C.cyan); doc.setLineWidth(0.2)
  doc.setGState(doc.GState({ opacity:0.2 }))
  line(14, y, W-14, y)
  doc.setGState(doc.GState({ opacity:1 }))
  y += 4
  doc.setFont('helvetica','bold'); doc.setFontSize(9)
  color(C.muted); doc.text('HIVO', 14, y)
  const hw = doc.getTextWidth('HIVO')
  color(C.cyan); doc.text('LTA', 14+hw, y)
  doc.setFont('helvetica','normal'); doc.setFontSize(5.5)
  color(C.muted); doc.text('Vertrouwelijk — intern gebruik', W-14, y, { align:'right' })

  // ── COSTS SECTION ────────────────────────────────────────────────────────────
  if (costs) {
    if (y > H - 80) { doc.addPage(); fill(C.navy); rect(0,0,W,H); y = 14 }
    sectionTitle('KOSTENANALYSE & NETTO RESULTAAT')

    const totalNettoCom = sellers.reduce((a,s)=>a+s.marge-s.commEur, 0)
    const netResult = totalNettoCom - costs.total

    // Two cost columns
    const colW = (W-28-6)/2
    const startY = y

    // Fixed costs box
    fill(C.card); rect(14, y, colW, 6+costs.fixed.length*7+14, 2)
    fill(C.muted); rect(14, y, colW, 1.2, 1)
    doc.setFont('helvetica','normal'); doc.setFontSize(5.5)
    color(C.muted); doc.text('VASTE MAANDELIJKSE KOSTEN', 17, y+5)
    let fy = y + 10
    costs.fixed.forEach(c => {
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); color(C.white)
      doc.text(c.label, 17, fy)
      doc.setFont('courier','normal'); color(C.muted)
      doc.text(fmt(c.amount), 14+colW-3, fy, {align:'right'})
      fy += 7
    })
    // Fixed total
    stroke(C.muted); doc.setLineWidth(0.2)
    doc.setGState(doc.GState({opacity:0.3})); line(17, fy-1, 14+colW-3, fy-1); doc.setGState(doc.GState({opacity:1}))
    doc.setFont('helvetica','bold'); doc.setFontSize(7); color(C.white); doc.text('Totaal vast', 17, fy+4)
    doc.setFont('courier','bold'); color([231,76,60] as [number,number,number])
    doc.text(fmt(costs.totalFixed), 14+colW-3, fy+4, {align:'right'})

    // Variable costs box
    const vx = 14+colW+6
    const varH = 6+costs.variable.length*7+14
    fill(C.card); rect(vx, startY, colW, varH, 2)
    fill([232,139,74] as [number,number,number]); rect(vx, startY, colW, 1.2, 1)
    doc.setFont('helvetica','normal'); doc.setFontSize(5.5); color(C.muted)
    doc.text('VARIABELE KOSTEN', vx+3, startY+5)
    let vy = startY + 10
    costs.variable.forEach(c => {
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); color(C.white)
      doc.text(c.label, vx+3, vy)
      doc.setFont('courier','normal'); color(C.muted)
      doc.text(fmt(c.amount), vx+colW-3, vy, {align:'right'})
      vy += 7
    })
    stroke(C.muted); doc.setLineWidth(0.2)
    doc.setGState(doc.GState({opacity:0.3})); line(vx+3, vy-1, vx+colW-3, vy-1); doc.setGState(doc.GState({opacity:1}))
    doc.setFont('helvetica','bold'); doc.setFontSize(7); color(C.white); doc.text('Totaal variabel', vx+3, vy+4)
    doc.setFont('courier','bold'); color([231,76,60] as [number,number,number])
    doc.text(fmt(costs.totalVariable), vx+colW-3, vy+4, {align:'right'})

    y = Math.max(fy, vy) + 16

    // Net result bar
    const netColor: [number,number,number] = netResult >= 0 ? C.green : C.red
    fill(netResult>=0 ? [20,60,35] as [number,number,number] : [60,20,20] as [number,number,number])
    rect(14, y, W-28, 18, 2)
    stroke(netColor); doc.setLineWidth(0.4)
    doc.setGState(doc.GState({opacity:0.5})); doc.roundedRect(14,y,W-28,18,2,2,'S'); doc.setGState(doc.GState({opacity:1}))
    doc.setFont('helvetica','normal'); doc.setFontSize(6); color(C.muted)
    doc.text('NETTO BEDRIJFSRESULTAAT', 18, y+6)
    doc.setFont('helvetica','normal'); doc.setFontSize(6); color(C.white)
    doc.text(`Marge na comm. ${fmt(totalNettoCom)}  −  Kosten ${fmt(costs.total)}`, 18, y+12)
    doc.setFont('helvetica','bold'); doc.setFontSize(14); color(netColor)
    doc.text(fmt(netResult), W-18, y+12, {align:'right'})
    y += 26
  }

  // ── SAVE ───────────────────────────────────────────────────────────────────
  doc.save(`hivolta-dashboard-${period.replace(/\s/g,'-').toLowerCase()}.pdf`)
}
