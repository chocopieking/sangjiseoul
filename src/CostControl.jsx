// ══════════════════════════════════════════════════════════════
// 💰 외주비 원가통제 시스템 — Phase 2
// ══════════════════════════════════════════════════════════════
import { useState, useMemo, useCallback } from "react"

// ── 표준단가 DB ──────────────────────────────────────────────
export const STD_RATES = [
  { cat:"구조",        basis:"연면적",   lo:90000,  std:130000, hi:200000, rlo:5.0, rstd:8.0, rhi:12.0 },
  { cat:"기계(MEP)",   basis:"연면적",   lo:70000,  std:110000, hi:170000, rlo:4.0, rstd:7.0, rhi:10.0 },
  { cat:"전기통신",    basis:"연면적",   lo:50000,  std:90000,  hi:140000, rlo:3.5, rstd:6.0, rhi:9.0  },
  { cat:"소방",        basis:"연면적",   lo:20000,  std:35000,  hi:60000,  rlo:1.5, rstd:2.5, rhi:4.0  },
  { cat:"토목",        basis:"대지면적", lo:500000, std:900000, hi:1500000,rlo:5.0, rstd:9.0, rhi:14.0 },
  { cat:"조경",        basis:"대지면적", lo:300000, std:600000, hi:1000000,rlo:3.0, rstd:6.0, rhi:10.0 },
  { cat:"지반조사",    basis:"대지면적", lo:200000, std:400000, hi:700000, rlo:2.0, rstd:4.0, rhi:7.0  },
  { cat:"흙막이",      basis:"대지면적", lo:400000, std:800000, hi:1400000,rlo:4.0, rstd:8.0, rhi:13.0 },
  { cat:"현황측량",    basis:"대지면적", lo:80000,  std:150000, hi:250000, rlo:0.8, rstd:1.5, rhi:2.5  },
  { cat:"교통영향평가",basis:"대지면적", lo:400000, std:700000, hi:1200000,rlo:3.0, rstd:6.0, rhi:10.0 },
  { cat:"환경평가",    basis:"대지면적", lo:150000, std:300000, hi:600000, rlo:1.5, rstd:3.0, rhi:6.0  },
  { cat:"CG",          basis:"연면적",   lo:8000,   std:18000,  hi:35000,  rlo:0.5, rstd:1.2, rhi:2.5  },
  { cat:"건축외주",    basis:"연면적",   lo:15000,  std:35000,  hi:80000,  rlo:1.5, rstd:3.0, rhi:6.0  },
  { cat:"견적",        basis:"연면적",   lo:5000,   std:12000,  hi:25000,  rlo:0.5, rstd:1.0, rhi:2.0  },
  { cat:"친환경인증",  basis:"연면적",   lo:10000,  std:22000,  hi:40000,  rlo:0.8, rstd:1.5, rhi:3.0  },
  { cat:"BIM",         basis:"연면적",   lo:12000,  std:25000,  hi:50000,  rlo:1.0, rstd:2.0, rhi:4.0  },
  { cat:"경관",        basis:"연면적",   lo:8000,   std:18000,  hi:35000,  rlo:0.5, rstd:1.2, rhi:2.5  },
  { cat:"실내건축",    basis:"연면적",   lo:20000,  std:50000,  hi:100000, rlo:2.0, rstd:4.0, rhi:8.0  },
  { cat:"프리랜서",    basis:"연면적",   lo:5000,   std:15000,  hi:40000,  rlo:1.0, rstd:2.5, rhi:6.0  },
  { cat:"해외협력사",  basis:"연면적",   lo:20000,  std:60000,  hi:150000, rlo:3.0, rstd:7.0, rhi:15.0 },
]

const STD_MAP = Object.fromEntries(STD_RATES.map(r => [r.cat, r]))

// ── 경보 등급 ─────────────────────────────────────────────────
function getAlertLevel(devPct) {
  if (devPct === null || devPct === undefined) return null
  if (devPct <= 0)   return { label:"✅ 정상",   color:"#059669", bg:"#D1FAE5", action:"" }
  if (devPct <= 15)  return { label:"🔵 관리",   color:"#185FA5", bg:"#DBEAFE", action:"" }
  if (devPct <= 30)  return { label:"🟡 주의",   color:"#D97706", bg:"#FEF3C7", action:"본부장 확인" }
  if (devPct <= 50)  return { label:"🟠 위험",   color:"#DC2626", bg:"#FEE2E2", action:"본부장 승인 필수" }
  return               { label:"🔴 한도초과", color:"#7F1D1D", bg:"#FFE4E6", action:"경영진 결재 필수" }
}

function getCostRateLevel(rate) {
  if (!rate) return null
  if (rate <= 40) return { label:"🟢 우수", color:"#059669", bg:"#D1FAE5" }
  if (rate <= 50) return { label:"🔵 양호", color:"#185FA5", bg:"#DBEAFE" }
  if (rate <= 60) return { label:"🟡 주의", color:"#D97706", bg:"#FEF3C7" }
  if (rate <= 70) return { label:"🟠 위험", color:"#DC2626", bg:"#FEE2E2" }
  return            { label:"🔴 심각", color:"#7F1D1D", bg:"#FFE4E6" }
}

// ── 숫자 포맷 ─────────────────────────────────────────────────
const fA  = n => n >= 1e8 ? `${(n/1e8).toFixed(2)}억` : n >= 1e4 ? `${(n/1e4).toFixed(0)}만` : n > 0 ? n.toLocaleString() : "-"
const fN  = n => (n || 0).toLocaleString()
const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0

// ══════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ══════════════════════════════════════════════════════════════
export function CostControlTab({ projects=[], vendorsDB={}, cashItems=[], vendorPayments=[], canWrite=false }) {
  const [view, setView]     = useState("dashboard") // dashboard | estimate | limits | report
  const [projLimits, setProjLimits] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sjs_cost_limits") || "{}") } catch { return {} }
  })

  const saveLimits = (next) => {
    setProjLimits(next)
    try { localStorage.setItem("sjs_cost_limits", JSON.stringify(next)) } catch {}
  }

  // ── 전체 외주비 집계 ─────────────────────────────────────────
  const extSummary = useMemo(() => {
    const byProj  = {}
    const byCat   = {}
    let totalAmt  = 0

    Object.values(vendorsDB).forEach(v => {
      (v.paymentHistory || []).forEach(ph => {
        const pj  = (ph.project || "").trim()
        const cat = (ph.type    || "기타").trim()
        const amt = ph.totalAmt || 0
        if (!pj || amt <= 0) return
        totalAmt += amt
        if (!byProj[pj]) byProj[pj] = { total: 0, cats: {}, paid: ph.paidSum || 0, remain: ph.remain || 0 }
        byProj[pj].total      += amt
        byProj[pj].cats[cat]   = (byProj[pj].cats[cat] || 0) + amt
        byCat[cat]             = (byCat[cat] || 0) + amt
      })
    })

    // 현누계 (cashItems 입금완료 기준)
    const yr = String(new Date().getFullYear())
    const revenue = cashItems.filter(i => i.paidDate?.startsWith(yr))
                             .reduce((s, i) => s + (i.amount || 0), 0)

    return { byProj, byCat, totalAmt, revenue,
      costRate: revenue > 0 ? Math.round(totalAmt / revenue * 100) : null }
  }, [vendorsDB, cashItems])

  // ── 탭 버튼 ───────────────────────────────────────────────────
  const VIEWS = [
    ["dashboard", "📊 원가 대시보드"],
    ["estimate",  "🔍 견적 검토 (경보)"],
    ["limits",    "🔒 프로젝트별 한도"],
    ["report",    "📥 리포트 다운로드"],
  ]

  const S = {
    card: { background:"#fff", borderRadius:14, border:"1px solid #E5E7EB", padding:"18px 20px", marginBottom:16 },
    hdr:  { fontSize:14, fontWeight:800, color:"#111827", marginBottom:14 },
    lbl:  { fontSize:12, color:"#6B7280", marginBottom:4, display:"block", fontWeight:600 },
    inp:  { padding:"8px 12px", border:"1.5px solid #E5E7EB", borderRadius:8, fontSize:13,
            width:"100%", boxSizing:"border-box", outline:"none", fontFamily:"inherit" },
  }

  return (
    <div>
      {/* 서브탭 네비 */}
      <div style={{display:"flex",gap:0,marginBottom:18,borderBottom:"2px solid #E5E7EB",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {VIEWS.map(([id,lbl])=>(
          <button key={id} onClick={()=>setView(id)}
            style={{padding:"10px 18px",border:"none",background:"none",fontSize:13.5,
              fontWeight:view===id?800:500,cursor:"pointer",flexShrink:0,
              color:view===id?"#DC2626":"#6B7280",
              borderBottom:view===id?"3px solid #DC2626":"3px solid transparent",marginBottom:-2}}>
            {lbl}
          </button>
        ))}
      </div>

      {view === "dashboard" && <Dashboard summary={extSummary} projLimits={projLimits} cashItems={cashItems}/>}
      {view === "estimate"  && <EstimateChecker canWrite={canWrite}/>}
      {view === "limits"    && <ProjectLimits projects={projects} projLimits={projLimits} saveLimits={saveLimits} extSummary={extSummary} canWrite={canWrite}/>}
      {view === "report"    && <ReportDownload extSummary={extSummary} projLimits={projLimits} projects={projects} cashItems={cashItems}/>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 대시보드 뷰
// ══════════════════════════════════════════════════════════════
function Dashboard({ summary, projLimits, cashItems }) {
  const { byProj, byCat, totalAmt, revenue, costRate } = summary
  const rateLevel = getCostRateLevel(costRate)
  const yr = String(new Date().getFullYear())

  const topProjs = Object.entries(byProj)
    .sort((a,b) => b[1].total - a[1].total).slice(0, 10)
  const topCats  = Object.entries(byCat)
    .sort((a,b) => b[1] - a[1]).slice(0, 10)

  // 한도 초과 프로젝트
  const overLimit = Object.entries(byProj).filter(([pj, d]) => {
    const lim = projLimits[pj]?.limitAmt
    return lim && d.total > lim
  })

  return (
    <div>
      {/* KPI 카드 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {[
          ["💰 총 외주비(이력)", fA(totalAmt), "#DC2626", "#FEE2E2"],
          ["💧 현누계 매출",      fA(revenue),  "#059669", "#D1FAE5"],
          ["📊 외주비율",
            costRate ? `${costRate}%` : "매출 없음",
            rateLevel?.color || "#6B7280",
            rateLevel?.bg || "#F3F4F6"],
          ["🏢 분석 프로젝트",   `${Object.keys(byProj).length}개`, "#6366F1", "#EEF2FF"],
        ].map(([l,v,color,bg])=>(
          <div key={l} style={{background:bg, borderRadius:14, padding:"16px 18px", border:`1.5px solid ${color}30`}}>
            <div style={{fontSize:12, color, fontWeight:700, marginBottom:6}}>{l}</div>
            <div style={{fontSize:26, fontWeight:900, color}}>{v}</div>
          </div>
        ))}
      </div>

      {/* 외주비율 경보 배너 */}
      {rateLevel && (
        <div style={{background:rateLevel.bg, border:`2px solid ${rateLevel.color}`,
          borderRadius:12, padding:"14px 18px", marginBottom:16,
          display:"flex", alignItems:"center", gap:14}}>
          <div style={{fontSize:24}}>{rateLevel.label.split(" ")[0]}</div>
          <div>
            <div style={{fontSize:15, fontWeight:800, color:rateLevel.color}}>
              현재 외주비율 {costRate}% — {rateLevel.label}
            </div>
            <div style={{fontSize:13, color:"#374151", marginTop:2}}>
              목표: 45~50% | 현재: {costRate}% | 초과: {costRate > 50 ? `+${costRate-50}%p` : "없음"}
              {costRate > 60 && " ⚠ 즉각적인 원가통제 조치 필요"}
            </div>
          </div>
          <div style={{marginLeft:"auto", textAlign:"right"}}>
            <div style={{fontSize:11, color:"#6B7280"}}>목표 달성을 위해</div>
            <div style={{fontSize:13, fontWeight:700, color:rateLevel.color}}>
              {revenue > 0 ? `외주비 ${fA(revenue * 0.5)} 이하 유지` : "-"}
            </div>
          </div>
        </div>
      )}

      {/* 한도 초과 경보 */}
      {overLimit.length > 0 && (
        <div style={{background:"#FEE2E2", border:"2px solid #DC2626", borderRadius:12, padding:"14px 18px", marginBottom:16}}>
          <div style={{fontSize:14, fontWeight:800, color:"#DC2626", marginBottom:8}}>
            🚨 외주비 한도 초과 프로젝트 ({overLimit.length}건)
          </div>
          {overLimit.map(([pj, d]) => {
            const lim = projLimits[pj]?.limitAmt || 0
            const over = d.total - lim
            return (
              <div key={pj} style={{display:"flex", justifyContent:"space-between", fontSize:13,
                padding:"6px 0", borderBottom:"1px solid #FECACA"}}>
                <span style={{fontWeight:600}}>{pj.slice(0,40)}</span>
                <span style={{color:"#DC2626", fontWeight:700}}>
                  한도 {fA(lim)} 대비 {fA(over)} 초과
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        {/* 프로젝트별 외주비 TOP10 */}
        <div style={{background:"#fff", borderRadius:14, border:"1px solid #E5E7EB", overflow:"hidden"}}>
          <div style={{padding:"14px 18px", background:"linear-gradient(135deg,#DC2626,#EF4444)", color:"#fff"}}>
            <div style={{fontSize:14, fontWeight:800}}>🏗 프로젝트별 외주비 TOP 10</div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%", borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#FEF2F2"}}>
                  {["프로젝트명","외주비","공종수","한도대비"].map((h,i)=>(
                    <th key={i} style={{padding:"8px 12px", fontSize:11.5, fontWeight:700,
                      color:"#DC2626", borderBottom:"1px solid #FECACA",
                      textAlign:i===0?"left":"right", whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topProjs.map(([pj, d], i) => {
                  const lim = projLimits[pj]?.limitAmt
                  const ratio = lim ? Math.round(d.total/lim*100) : null
                  const isOver = ratio && ratio > 100
                  return (
                    <tr key={pj} style={{background: isOver ? "#FEF2F2" : i%2===0?"#fff":"#FFF7F7",
                      borderBottom:"1px solid #FEE2E2"}}>
                      <td style={{padding:"8px 12px", fontSize:12, fontWeight:600,
                        maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                        {pj.slice(0,30)}
                      </td>
                      <td style={{padding:"8px 12px", fontSize:12, fontWeight:700,
                        color:"#DC2626", textAlign:"right"}}>{fA(d.total)}</td>
                      <td style={{padding:"8px 12px", fontSize:12, textAlign:"right",
                        color:"#6B7280"}}>{Object.keys(d.cats).length}</td>
                      <td style={{padding:"8px 12px", fontSize:12, textAlign:"right",
                        color: isOver ? "#DC2626" : ratio ? "#059669" : "#9CA3AF",
                        fontWeight: isOver ? 700 : 400}}>
                        {ratio ? `${ratio}%${isOver?" ⚠":""}` : "한도 미설정"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 공종별 외주비 */}
        <div style={{background:"#fff", borderRadius:14, border:"1px solid #E5E7EB", overflow:"hidden"}}>
          <div style={{padding:"14px 18px", background:"linear-gradient(135deg,#312E81,#6366F1)", color:"#fff"}}>
            <div style={{fontSize:14, fontWeight:800}}>📊 공종별 외주비 현황</div>
          </div>
          <div style={{padding:"8px 0"}}>
            {topCats.map(([cat, amt], i) => {
              const std = STD_MAP[cat]
              const maxAmt = topCats[0][1]
              const barW = Math.round(amt/maxAmt*100)
              return (
                <div key={cat} style={{padding:"7px 16px", borderBottom: i<topCats.length-1?"1px solid #F3F4F6":"none"}}>
                  <div style={{display:"flex", justifyContent:"space-between", marginBottom:4}}>
                    <span style={{fontSize:12.5, fontWeight:700, color:"#374151"}}>{cat}</span>
                    <span style={{fontSize:12, fontWeight:700, color:"#6366F1"}}>{fA(amt)}</span>
                  </div>
                  <div style={{height:6, background:"#E5E7EB", borderRadius:3, overflow:"hidden"}}>
                    <div style={{height:"100%", width:`${barW}%`, background:"#6366F1", borderRadius:3}}/>
                  </div>
                  {std && (
                    <div style={{fontSize:10.5, color:"#9CA3AF", marginTop:2}}>
                      표준단가: {fN(std.std)}원/평 | 경보기준: {fN(Math.round(std.std*1.3))}원/평
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 견적 검토 (편차 경보) 뷰
// ══════════════════════════════════════════════════════════════
function EstimateChecker({ canWrite }) {
  const [form, setForm]         = useState({
    projName:"", cat:"", area:0, areaType:"연면적",
    estAmt:0, serviceFee:0, note:""
  })
  const [results, setResults]   = useState([])
  const [history, setHistory]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("sjs_estimate_history") || "[]") } catch { return [] }
  })

  const u = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const check = () => {
    const { projName, cat, area, areaType, estAmt, serviceFee } = form
    if (!cat || !estAmt) { alert("공종과 견적금액을 입력하세요"); return }

    const std    = STD_MAP[cat]
    const areas  = Number(area)
    const est    = Number(estAmt)
    const fee    = Number(serviceFee)

    const result = {
      id: Date.now(),
      projName, cat, area: areas, areaType, estAmt: est, serviceFee: fee,
      note: form.note, date: new Date().toISOString().slice(0,10),
    }

    // 평당단가 검토
    if (std && areas > 0) {
      const py    = areas / 3.3058
      const upEst = est / py
      const dev   = Math.round((upEst - std.std) / std.std * 100)
      const alert = getAlertLevel(dev)
      result.upEst = Math.round(upEst)
      result.upStd = std.std
      result.upHi  = std.hi
      result.devPct = dev
      result.alertLevel = alert
    }

    // 용역비 대비 검토
    if (std && fee > 0) {
      const ratioEst = Math.round(est / fee * 100)
      const ratioStd = std.rstd
      const ratioDev = Math.round((ratioEst - ratioStd) / ratioStd * 100)
      result.ratioEst = ratioEst
      result.ratioStd = ratioStd
      result.ratioAlert = getAlertLevel(ratioDev)
    }

    const next = [result, ...history].slice(0, 50)
    setHistory(next)
    setResults([result])
    try { localStorage.setItem("sjs_estimate_history", JSON.stringify(next)) } catch {}
  }

  const inp = { padding:"8px 12px", border:"1.5px solid #E5E7EB", borderRadius:8, fontSize:13,
                width:"100%", boxSizing:"border-box", outline:"none", fontFamily:"inherit" }
  const sel = { ...inp, background:"#fff" }

  return (
    <div>
      {/* 입력 패널 */}
      <div style={{background:"#fff", borderRadius:14, border:"2px solid #DC2626", padding:"20px", marginBottom:16}}>
        <div style={{fontSize:15, fontWeight:800, color:"#DC2626", marginBottom:16}}>
          🔍 견적 적정성 검토 — 표준단가 대비 편차 자동 경보
        </div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12}}>
          <div>
            <label style={{fontSize:12, color:"#6B7280", fontWeight:600, display:"block", marginBottom:4}}>프로젝트명</label>
            <input value={form.projName} onChange={e=>u("projName",e.target.value)}
              placeholder="프로젝트명 입력" style={inp}/>
          </div>
          <div>
            <label style={{fontSize:12, color:"#DC2626", fontWeight:700, display:"block", marginBottom:4}}>공종 *</label>
            <select value={form.cat} onChange={e=>u("cat",e.target.value)} style={sel}>
              <option value="">공종 선택</option>
              {STD_RATES.map(r=>(
                <option key={r.cat} value={r.cat}>{r.cat} ({r.basis})</option>
              ))}
              <option value="기타">기타 (기준 없음)</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:12, color:"#6B7280", fontWeight:600, display:"block", marginBottom:4}}>
              {form.cat ? STD_MAP[form.cat]?.basis || "면적" : "면적"} (m²)
            </label>
            <input type="number" value={form.area || ""} onChange={e=>u("area",e.target.value)}
              placeholder="면적 입력 (m²)" style={inp}/>
          </div>
          <div>
            <label style={{fontSize:12, color:"#DC2626", fontWeight:700, display:"block", marginBottom:4}}>견적금액 (원) *</label>
            <input type="number" value={form.estAmt || ""} onChange={e=>u("estAmt",e.target.value)}
              placeholder="견적금액 입력 (원)" style={inp}/>
          </div>
          <div>
            <label style={{fontSize:12, color:"#6B7280", fontWeight:600, display:"block", marginBottom:4}}>상지 용역비 (원, 선택)</label>
            <input type="number" value={form.serviceFee || ""} onChange={e=>u("serviceFee",e.target.value)}
              placeholder="용역비 입력 (원) — 비율 검토용" style={inp}/>
          </div>
          <div>
            <label style={{fontSize:12, color:"#6B7280", fontWeight:600, display:"block", marginBottom:4}}>비고</label>
            <input value={form.note} onChange={e=>u("note",e.target.value)}
              placeholder="비고 (협력업체명 등)" style={inp}/>
          </div>
        </div>
        <button onClick={check}
          style={{padding:"11px 28px", background:"linear-gradient(135deg,#DC2626,#EF4444)",
            color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:800,
            cursor:"pointer", boxShadow:"0 2px 8px rgba(220,38,38,.3)"}}>
          🔍 견적 검토 실행
        </button>
      </div>

      {/* 검토 결과 */}
      {results.map(r => (
        <CheckResult key={r.id} r={r}/>
      ))}

      {/* 검토 이력 */}
      {history.length > 0 && (
        <div style={{background:"#fff", borderRadius:14, border:"1px solid #E5E7EB", overflow:"hidden"}}>
          <div style={{padding:"12px 18px", background:"#F8FAFC", borderBottom:"1px solid #E5E7EB",
            display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div style={{fontSize:14, fontWeight:700}}>📋 견적 검토 이력 ({history.length}건)</div>
            <button onClick={()=>{setHistory([]);localStorage.removeItem("sjs_estimate_history")}}
              style={{padding:"5px 10px", background:"#FEE2E2", color:"#DC2626", border:"none",
                borderRadius:7, fontSize:12, cursor:"pointer"}}>초기화</button>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%", borderCollapse:"collapse", minWidth:700}}>
              <thead>
                <tr style={{background:"#F8FAFC"}}>
                  {["날짜","프로젝트","공종","견적금액","평당단가","표준단가","편차","판정","조치"].map((h,i)=>(
                    <th key={i} style={{padding:"8px 12px", fontSize:11.5, fontWeight:700,
                      color:"#6B7280", borderBottom:"1px solid #E5E7EB",
                      textAlign:i<3?"left":"right", whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((r, i) => {
                  const al = r.alertLevel
                  return (
                    <tr key={r.id} style={{background:al?.bg||"#fff", borderBottom:"1px solid #E5E7EB"}}>
                      <td style={{padding:"8px 12px", fontSize:12, color:"#6B7280"}}>{r.date}</td>
                      <td style={{padding:"8px 12px", fontSize:12, fontWeight:600, maxWidth:140,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                        {r.projName || "-"}
                      </td>
                      <td style={{padding:"8px 12px", fontSize:12}}>{r.cat}</td>
                      <td style={{padding:"8px 12px", fontSize:12, textAlign:"right", fontWeight:700}}>{fA(r.estAmt)}</td>
                      <td style={{padding:"8px 12px", fontSize:12, textAlign:"right"}}>{r.upEst ? fN(r.upEst) : "-"}</td>
                      <td style={{padding:"8px 12px", fontSize:12, textAlign:"right", color:"#185FA5"}}>{r.upStd ? fN(r.upStd) : "-"}</td>
                      <td style={{padding:"8px 12px", fontSize:12, textAlign:"right",
                        color:al?.color||"#6B7280", fontWeight:700}}>
                        {r.devPct !== undefined ? `${r.devPct > 0 ? "+" : ""}${r.devPct}%` : "-"}
                      </td>
                      <td style={{padding:"8px 12px", fontSize:12, textAlign:"right", fontWeight:700,
                        color:al?.color||"#9CA3AF"}}>{al?.label || "기준없음"}</td>
                      <td style={{padding:"8px 12px", fontSize:11.5, textAlign:"right",
                        color:"#DC2626", fontWeight:al?.action ? 700 : 400}}>
                        {al?.action || "-"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// 검토 결과 카드
function CheckResult({ r }) {
  const al = r.alertLevel
  const needApprove = al && (al.label.includes("위험") || al.label.includes("초과"))

  return (
    <div style={{borderRadius:14, border:`2px solid ${al?.color || "#E5E7EB"}`,
      background:al?.bg || "#F8FAFC", padding:"20px", marginBottom:16}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16}}>
        <div>
          <div style={{fontSize:16, fontWeight:800, color:"#111827", marginBottom:4}}>
            검토 결과: {r.projName || "프로젝트 미입력"} — {r.cat}
          </div>
          <div style={{fontSize:13, color:"#6B7280"}}>견적금액: {fN(r.estAmt)}원 ({fA(r.estAmt)})</div>
        </div>
        {al && (
          <div style={{textAlign:"center", background:"#fff", borderRadius:12,
            padding:"12px 20px", border:`1.5px solid ${al.color}`}}>
            <div style={{fontSize:22, fontWeight:900, color:al.color}}>{al.label}</div>
            {al.action && <div style={{fontSize:12, color:al.color, fontWeight:700, marginTop:4}}>⚡ {al.action}</div>}
          </div>
        )}
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>
        {/* 평당단가 비교 */}
        {r.upEst && (
          <div style={{background:"#fff", borderRadius:10, padding:"14px 16px", border:"1px solid #E5E7EB"}}>
            <div style={{fontSize:12, color:"#6B7280", fontWeight:600, marginBottom:8}}>📐 평당단가 비교</div>
            {[
              ["견적 단가",  fN(r.upEst)+"원/평", al?.color || "#374151"],
              ["표준 단가",  fN(r.upStd)+"원/평", "#185FA5"],
              ["상한 단가",  fN(r.upHi)+"원/평",  "#D97706"],
              ["편차",       `${r.devPct > 0 ? "+" : ""}${r.devPct}%`, al?.color || "#374151"],
            ].map(([l,v,c])=>(
              <div key={l} style={{display:"flex", justifyContent:"space-between",
                fontSize:13, marginBottom:4}}>
                <span style={{color:"#6B7280"}}>{l}</span>
                <span style={{fontWeight:700, color:c}}>{v}</span>
              </div>
            ))}
            {/* 편차 바 */}
            <div style={{marginTop:8}}>
              <div style={{height:8, background:"#E5E7EB", borderRadius:4, overflow:"hidden"}}>
                <div style={{height:"100%", width:`${Math.min(r.upEst/r.upHi*100, 100)}%`,
                  background:al?.color || "#059669", borderRadius:4}}/>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:10, color:"#9CA3AF", marginTop:2}}>
                <span>0</span>
                <span>표준 {fN(r.upStd)}</span>
                <span>상한 {fN(r.upHi)}</span>
              </div>
            </div>
          </div>
        )}

        {/* 용역비 대비 */}
        {r.ratioEst && (
          <div style={{background:"#fff", borderRadius:10, padding:"14px 16px", border:"1px solid #E5E7EB"}}>
            <div style={{fontSize:12, color:"#6B7280", fontWeight:600, marginBottom:8}}>💰 용역비 대비 비율</div>
            {[
              ["견적 비율", `${r.ratioEst}%`, r.ratioAlert?.color || "#374151"],
              ["표준 비율", `${r.ratioStd}%`, "#185FA5"],
              ["판정",      r.ratioAlert?.label || "-", r.ratioAlert?.color || "#6B7280"],
            ].map(([l,v,c])=>(
              <div key={l} style={{display:"flex", justifyContent:"space-between",
                fontSize:13, marginBottom:4}}>
                <span style={{color:"#6B7280"}}>{l}</span>
                <span style={{fontWeight:700, color:c}}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* 표준단가 참고 */}
        {r.cat && STD_MAP[r.cat] && (
          <div style={{background:"#fff", borderRadius:10, padding:"14px 16px", border:"1px solid #E5E7EB"}}>
            <div style={{fontSize:12, color:"#6B7280", fontWeight:600, marginBottom:8}}>📋 {r.cat} 표준 참고</div>
            {[
              ["하한", fN(STD_MAP[r.cat].lo)+"원/평"],
              ["표준", fN(STD_MAP[r.cat].std)+"원/평"],
              ["상한", fN(STD_MAP[r.cat].hi)+"원/평"],
              ["경보기준", fN(Math.round(STD_MAP[r.cat].std*1.3))+"원/평"],
            ].map(([l,v])=>(
              <div key={l} style={{display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4}}>
                <span style={{color:"#6B7280"}}>{l}</span>
                <span style={{fontWeight:l==="경보기준"?700:400, color:l==="경보기준"?"#DC2626":"#374151"}}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 승인 필요 안내 */}
      {needApprove && (
        <div style={{marginTop:14, background:"#7F1D1D", borderRadius:10, padding:"12px 16px",
          display:"flex", alignItems:"center", gap:10}}>
          <div style={{fontSize:20}}>⚡</div>
          <div>
            <div style={{fontSize:14, fontWeight:800, color:"#FECACA"}}>승인 필요 — {al.action}</div>
            <div style={{fontSize:12, color:"#FCA5A5", marginTop:2}}>
              표준단가 대비 {r.devPct}% 초과. 계약 전 결재 라인 승인 후 진행하세요.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 프로젝트별 한도 설정
// ══════════════════════════════════════════════════════════════
function ProjectLimits({ projects, projLimits, saveLimits, extSummary, canWrite }) {
  const [editId, setEditId] = useState(null)
  const [draft,  setDraft]  = useState({})

  const projList = projects
    .filter(p => p.type === "계약" || p.type === "확정")
    .sort((a,b) => (b.serviceFee||0) - (a.serviceFee||0))
    .slice(0, 60)

  const save = (pId) => {
    const next = { ...projLimits, [pId]: { ...projLimits[pId], ...draft } }
    saveLimits(next)
    setEditId(null)
  }

  return (
    <div>
      <div style={{background:"#fff", borderRadius:14, border:"1px solid #E5E7EB",
        padding:"14px 18px", marginBottom:14, display:"flex", gap:12, alignItems:"center",
        flexWrap:"wrap"}}>
        <div style={{fontSize:14, fontWeight:800}}>🔒 프로젝트별 외주비 한도 설정</div>
        <div style={{fontSize:13, color:"#6B7280"}}>각 프로젝트의 외주비 한도를 설정하면 실제 집행액과 비교하여 초과 경보를 발생시킵니다.</div>
      </div>

      <div style={{overflowX:"auto", background:"#fff", borderRadius:14,
        border:"1px solid #E5E7EB", overflow:"hidden"}}>
        <table style={{width:"100%", borderCollapse:"collapse", minWidth:800}}>
          <thead>
            <tr style={{background:"#F8FAFC"}}>
              {["프로젝트명","본부","용역비(원)","외주비 한도(원)","한도비율(%)","집행액(실적)",
                "한도대비","원가등급",canWrite?"설정":""].filter(Boolean).map((h,i)=>(
                <th key={i} style={{padding:"10px 12px", fontSize:12, fontWeight:700,
                  color:"#374151", borderBottom:"2px solid #6366F1",
                  textAlign:i<2?"left":"right", whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projList.map((p, i) => {
              const pId    = p.id || p.name
              const lim    = projLimits[pId] || {}
              const svcFee = p.serviceFee || p.totalFee || 0
              const extAmt = extSummary.byProj[p.name]?.total || 0
              const limAmt = lim.limitAmt || 0
              const limPct = lim.limitPct || 50
              const autoLim= svcFee * limPct / 100
              const effLim = limAmt || autoLim
              const useRatio = effLim > 0 ? Math.round(extAmt/effLim*100) : null
              const costR  = svcFee > 0 && extAmt > 0 ? Math.round(extAmt/svcFee*100) : null
              const lvl    = getCostRateLevel(costR)
              const isEdit = editId === pId
              const isOver = useRatio && useRatio > 100

              return (
                <tr key={pId} style={{background:isOver?"#FEF2F2":i%2===0?"#fff":"#F9FAFB",
                  borderBottom:"1px solid #E5E7EB"}}>
                  <td style={{padding:"10px 12px", fontSize:13, fontWeight:700, maxWidth:200,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                    {p.name}
                  </td>
                  <td style={{padding:"10px 12px", fontSize:12, color:"#6B7280"}}>
                    {(p.depts||[]).join("·") || "-"}
                  </td>
                  <td style={{padding:"10px 12px", fontSize:13, textAlign:"right", color:"#059669", fontWeight:600}}>
                    {svcFee > 0 ? fN(svcFee) : "-"}
                  </td>
                  <td style={{padding:"10px 12px", textAlign:"right"}}>
                    {isEdit ? (
                      <input type="number" value={draft.limitAmt || ""} style={{width:130,
                        padding:"5px 8px", border:"1.5px solid #6366F1", borderRadius:7, fontSize:12}}
                        onChange={e=>setDraft(d=>({...d,limitAmt:Number(e.target.value)}))}
                        placeholder={autoLim > 0 ? fN(Math.round(autoLim)) : "직접 입력"}/>
                    ) : (
                      <span style={{fontSize:13, fontWeight:limAmt?700:400,
                        color:limAmt?"#374151":"#9CA3AF"}}>
                        {limAmt ? fN(limAmt) : svcFee > 0 ? `자동(${limPct}%): ${fN(Math.round(autoLim))}` : "미설정"}
                      </span>
                    )}
                  </td>
                  <td style={{padding:"10px 12px", textAlign:"right"}}>
                    {isEdit ? (
                      <input type="number" value={draft.limitPct || limPct} style={{width:60,
                        padding:"5px 8px", border:"1.5px solid #6366F1", borderRadius:7, fontSize:12}}
                        onChange={e=>setDraft(d=>({...d,limitPct:Number(e.target.value)}))}/>
                    ) : (
                      <span style={{fontSize:13, color:"#6366F1", fontWeight:600}}>{limPct}%</span>
                    )}
                  </td>
                  <td style={{padding:"10px 12px", fontSize:13, textAlign:"right",
                    color:extAmt>0?"#DC2626":"#9CA3AF", fontWeight:extAmt>0?700:400}}>
                    {extAmt > 0 ? fN(extAmt) : "-"}
                  </td>
                  <td style={{padding:"10px 12px", textAlign:"right", fontSize:13,
                    color:isOver?"#DC2626":useRatio?"#059669":"#9CA3AF",
                    fontWeight:isOver?800:600}}>
                    {useRatio ? `${useRatio}%${isOver?" ⚠":""}` : "-"}
                  </td>
                  <td style={{padding:"10px 12px", textAlign:"right"}}>
                    {lvl ? (
                      <span style={{fontSize:12, fontWeight:700, color:lvl.color,
                        background:lvl.bg, padding:"3px 8px", borderRadius:6}}>
                        {lvl.label}
                      </span>
                    ) : <span style={{fontSize:12, color:"#9CA3AF"}}>-</span>}
                  </td>
                  {canWrite && (
                    <td style={{padding:"10px 12px", textAlign:"center"}}>
                      {isEdit ? (
                        <div style={{display:"flex", gap:5, justifyContent:"center"}}>
                          <button onClick={()=>save(pId)} style={{padding:"5px 10px",
                            background:"#059669", color:"#fff", border:"none",
                            borderRadius:7, fontSize:12, cursor:"pointer"}}>저장</button>
                          <button onClick={()=>setEditId(null)} style={{padding:"5px 10px",
                            background:"#F3F4F6", color:"#6B7280", border:"none",
                            borderRadius:7, fontSize:12, cursor:"pointer"}}>취소</button>
                        </div>
                      ) : (
                        <button onClick={()=>{setEditId(pId);setDraft(lim)}} style={{padding:"5px 10px",
                          background:"#EEF2FF", color:"#6366F1", border:"none",
                          borderRadius:7, fontSize:12, cursor:"pointer"}}>설정</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 리포트 다운로드
// ══════════════════════════════════════════════════════════════
function ReportDownload({ extSummary, projLimits, projects, cashItems }) {
  const [downloading, setDownloading] = useState(false)

  const download = async () => {
    setDownloading(true)
    try {
      const XLSX = await import("xlsx")
      const wb   = XLSX.utils.book_new()

      // Sheet 1: 원가 대시보드 요약
      const yr = String(new Date().getFullYear())
      const revenue = cashItems.filter(i=>i.paidDate?.startsWith(yr))
                               .reduce((s,i)=>s+(i.amount||0),0)
      const {totalAmt, byProj, byCat} = extSummary

      const s1 = [
        ["항목","수치","비고"],
        ["분석 기준일", new Date().toLocaleDateString("ko-KR"), ""],
        ["총 외주비(이력)", totalAmt, "원"],
        ["현누계 매출", revenue, "원"],
        ["외주비율", revenue>0 ? +(totalAmt/revenue*100).toFixed(1) : "N/A", "%"],
        ["분석 프로젝트 수", Object.keys(byProj).length, "개"],
        ["공종 수", Object.keys(byCat).length, "개"],
        [""],
        ["경보 기준","",""],
        ["🟢 우수", "40% 이하", "정상 운영"],
        ["🔵 양호", "41~50%",  "모니터링"],
        ["🟡 주의", "51~60%",  "본부장 보고"],
        ["🟠 위험", "61~70%",  "경영진 승인"],
        ["🔴 심각", "70% 초과","즉시 조치"],
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s1), "① 원가 대시보드")

      // Sheet 2: 공종별 표준단가
      const s2 = [["공종","면적기준","하한(원/평)","표준(원/평)","상한(원/평)","경보기준(+30%)","용역비대비표준(%)"],
        ...STD_RATES.map(r=>[r.cat,r.basis,r.lo,r.std,r.hi,Math.round(r.std*1.3),r.rstd])]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s2), "② 공종별 표준단가 DB")

      // Sheet 3: 프로젝트별 원가분석
      const s3 = [["프로젝트명","외주비합계(원)","용역비(원)","외주비율(%)","주요공종","한도(원)","한도대비(%)","원가등급"]]
      Object.entries(byProj).sort((a,b)=>b[1].total-a[1].total).forEach(([pj,d])=>{
        const proj  = projects.find(p=>p.name===pj)
        const fee   = proj?.serviceFee || proj?.totalFee || 0
        const ratio = fee>0 ? +(d.total/fee*100).toFixed(1) : ""
        const lim   = projLimits[pj]?.limitAmt || 0
        const limRatio = lim>0 ? +(d.total/lim*100).toFixed(1) : ""
        const top3  = Object.entries(d.cats).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c])=>c).join(", ")
        const lvl   = getCostRateLevel(ratio || null)
        s3.push([pj, d.total, fee||"", ratio||"", top3, lim||"", limRatio||"", lvl?.label||""])
      })
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s3), "③ 프로젝트별 원가분석")

      // Sheet 4: 공종별 집계
      const grand = Object.values(byCat).reduce((s,v)=>s+v,0)
      const s4 = [["공종","외주비합계(원)","구성비(%)","2026매출대비(%)","경보수준"]]
      Object.entries(byCat).sort((a,b)=>b[1]-a[1]).forEach(([cat,amt])=>{
        const pctG = +(amt/grand*100).toFixed(1)
        const pctR = revenue>0 ? +(amt/revenue*100).toFixed(1) : ""
        const lvl  = pctR>20?"🔴즉시조치":pctR>10?"🟠위험":pctR>5?"🟡주의":"🔵관리"
        s4.push([cat, amt, pctG, pctR||"", lvl])
      })
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s4), "④ 공종별 외주비 집계")

      // 다운로드
      const buf  = XLSX.write(wb, {bookType:"xlsx", type:"array"})
      const blob = new Blob([buf], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = `외주비원가통제_리포트_${new Date().toISOString().slice(0,10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch(e) {
      alert("다운로드 오류: " + e.message)
    }
    setDownloading(false)
  }

  const { totalAmt, byProj, byCat, revenue, costRate } = extSummary
  const rateLevel = getCostRateLevel(costRate)

  return (
    <div>
      <div style={{background:"#fff", borderRadius:14, border:"2px solid #0C447C",
        padding:"24px", marginBottom:16, textAlign:"center"}}>
        <div style={{fontSize:40, marginBottom:12}}>📥</div>
        <div style={{fontSize:18, fontWeight:800, color:"#0C447C", marginBottom:8}}>
          외주비 원가통제 리포트 다운로드
        </div>
        <div style={{fontSize:13, color:"#6B7280", marginBottom:20, lineHeight:1.8}}>
          현재 시스템 데이터를 기반으로 4개 시트 엑셀 리포트를 생성합니다.<br/>
          ① 원가 대시보드 요약  ② 공종별 표준단가 DB  ③ 프로젝트별 원가분석  ④ 공종별 집계
        </div>

        {/* 현재 현황 요약 */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20}}>
          {[
            ["총 외주비", fA(totalAmt), "#DC2626"],
            ["현누계 매출", fA(revenue), "#059669"],
            ["외주비율", costRate ? `${costRate}%` : "-", rateLevel?.color || "#6B7280"],
            ["분석 프로젝트", `${Object.keys(byProj).length}개`, "#6366F1"],
          ].map(([l,v,c])=>(
            <div key={l} style={{background:"#F8FAFC", borderRadius:10, padding:"12px"}}>
              <div style={{fontSize:11, color:"#6B7280", fontWeight:600}}>{l}</div>
              <div style={{fontSize:18, fontWeight:800, color:c, marginTop:4}}>{v}</div>
            </div>
          ))}
        </div>

        <button onClick={download} disabled={downloading}
          style={{padding:"14px 40px", background:downloading?"#9CA3AF":
            "linear-gradient(135deg,#0C447C,#185FA5)",
            color:"#fff", border:"none", borderRadius:12, fontSize:15,
            fontWeight:800, cursor:downloading?"not-allowed":"pointer",
            boxShadow:"0 4px 12px rgba(12,68,124,.3)"}}>
          {downloading ? "⏳ 생성 중..." : "📥 엑셀 리포트 다운로드"}
        </button>
        <div style={{marginTop:10, fontSize:12, color:"#9CA3AF"}}>
          파일명: 외주비원가통제_리포트_{new Date().toISOString().slice(0,10)}.xlsx
        </div>
      </div>
    </div>
  )
}
