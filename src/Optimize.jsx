// ══════════════════════════════════════════════════════════════
// 경영최적화 탭 — 손익 시뮬레이터 · 인력효율 · 외주절감 · AI 분석제안
// ══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react"
import {
  BarChart, Bar, ComposedChart, Line, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, Legend, LabelList
} from "recharts"
import { fE, fW, fPct, BIZ_2026 } from "./data.js"
import { useDepts } from "./DeptContext.jsx"

// ── 스타일 (App.jsx 팔레트와 동일) ─────────────────────────────
const C = {
  navy:"#0C447C",navyM:"#185FA5",navyL:"#E6F1FB",
  green:"#1D9E75",greenL:"#EAF3DE",
  amber:"#BA7517",amberL:"#FAEEDA",
  red:"#A32D2D",  redL:"#FCEBEB",
  gray:"#888780", grayL:"#F1EFE8",
}
const S = {
  card:(x={})=>({background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:14,padding:"19px 22px",marginBottom:16,...x}),
  kpi:(accent=C.navyM)=>({background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:14,padding:"18px 20px",borderLeft:`6px solid ${accent}`}),
  grid:(c,g=16)=>({display:"grid",gridTemplateColumns:`repeat(${c},1fr)`,gap:g,marginBottom:g}),
  th:(a="left")=>({padding:"11px 13px",textAlign:a,fontSize:13,fontWeight:600,color:"var(--color-text-secondary,#888)",background:"var(--color-background-secondary,#f8f8f6)",borderBottom:"1px solid var(--color-border-tertiary,#eee)",whiteSpace:"nowrap"}),
  td:(a="right")=>({padding:"11px 13px",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",textAlign:a,fontSize:14.5,verticalAlign:"middle"}),
  bdg:(bg,fg)=>({display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:10,fontSize:12,fontWeight:600,background:bg,color:fg}),
}
const cardTitle = {fontSize:17,fontWeight:700,marginBottom:4,letterSpacing:-.2}
const cardNote  = {fontSize:12.5,color:C.gray,marginBottom:14}

// 안전한 숫자 변환 — NaN/Infinity 방지
const num  = (v,d=0) => { const n = Number(v); return Number.isFinite(n) ? n : d }
const safeDiv = (a,b,d=0) => (num(b)===0 ? d : num(a)/num(b))
const r2 = v => Math.round(num(v)*100)/100
const r3 = v => Math.round(num(v)*1000)/1000

// ── 큼직한 슬라이더 컨트롤 ─────────────────────────────────────
function Slider({label,value,onChange,min,max,step=1,unit="%",hint,color=C.navyM,negative}) {
  return (
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
        <span style={{fontSize:14,fontWeight:600}}>{label}</span>
        <span style={{fontSize:22,fontWeight:800,color,letterSpacing:-.5}}>{negative&&value>0?"-":""}{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(num(e.target.value))}
        style={{width:"100%",accentColor:color,cursor:"pointer",height:6}}/>
      {hint&&<div style={{fontSize:11.5,color:C.gray,marginTop:5,lineHeight:1.5}}>{hint}</div>}
    </div>
  )
}

// 굵고 큰 값 라벨
const BoldLabel = (color,suffix="억") => (props)=>{
  const {x,y,width,value} = props
  if (value==null) return null
  return <text x={x+width/2} y={y-10} textAnchor="middle" fontSize={15} fontWeight={800} fill={color}>{value}{suffix}</text>
}

// ══════════════════════════════════════════════════════════════
export function OptimizeTab({projects,deptStaff,pnlData}) {
  const {DEPTS,DEPT_COLORS,DEPT_BIZ} = useDepts()
  // ── 1) 실적 베이스라인 (1~5월 실적 기반, 연환산) ───────────────
  const base = useMemo(()=>{
    const actual = Array.isArray(pnlData) ? pnlData.slice(0,5) : []
    const n = actual.length || 1
    const sum = k => actual.reduce((s,row)=>s+num(row?.[k]),0)
    const labor5  = sum("sal")+sum("ot")+sum("etc_lbr")
    const sub5    = sum("sub_dir")+sum("sub_stl")
    const ovh5    = sum("exp")+sum("biz")+sum("fix")+sum("misc")+sum("shared")
    const rev5    = sum("rev")
    return {
      n, rev5, labor5, sub5, ovh5, cost5: labor5+sub5+ovh5,
      laborY: labor5/n*12, subY: sub5/n*12, ovhY: ovh5/n*12,
    }
  },[pnlData])

  const headcount = useMemo(()=>{
    if(!deptStaff||typeof deptStaff!=="object") return 0
    return Object.values(deptStaff).reduce((s,d)=>s+num(d?.total),0)
  },[deptStaff])
  const laborPerHead = safeDiv(base.laborY, headcount, 0)

  // ── 2) 시뮬레이터 상태 ────────────────────────────────────────
  const [revRate,  setRevRate]  = useState(90)
  const [hcDelta,  setHcDelta]  = useState(0)
  const [subCut,   setSubCut]   = useState(0)
  const [ovhCut,   setOvhCut]   = useState(0)

  const sim = useMemo(()=>{
    const revY   = num(BIZ_2026.revenueConfirmed) * revRate/100
    const laborY = Math.max(0, base.laborY + hcDelta*laborPerHead)
    const subY   = Math.max(0, base.subY * (1 - subCut/100))
    const ovhY   = Math.max(0, base.ovhY * (1 - ovhCut/100))
    const costY  = laborY + subY + ovhY
    const pnlY   = revY - costY
    const curRev = num(BIZ_2026.revenueConfirmed)
    const curCost= base.laborY + base.subY + base.ovhY
    const curPnl = curRev - curCost
    const bepGap = costY - revY
    return {revY,laborY,subY,ovhY,costY,pnlY,curRev,curCost,curPnl,bepGap}
  },[revRate,hcDelta,subCut,ovhCut,base,laborPerHead])

  const simChart = [
    {name:"현재 추세",   매출:r2(sim.curRev), 비용:r2(sim.curCost), 손익:r2(sim.curPnl)},
    {name:"시뮬레이션", 매출:r2(sim.revY),  비용:r2(sim.costY),  손익:r2(sim.pnlY)},
  ]

  // ── 3) 본부별 인력 효율 ───────────────────────────────────────
  const effRows = useMemo(()=>DEPTS.map(d=>{
    const biz = DEPT_BIZ[d]||{}, st = (deptStaff&&deptStaff[d])||{}
    const hc = num(st.total)
    const revPP  = safeDiv(num(biz.revCum), 5*hc, 0)
    const costPP = safeDiv(num(biz.cost5m), 5*hc, 0)
    const eff    = num(biz.cost5m)>0 ? num(biz.revCum)/num(biz.cost5m) : 0
    return {dept:d, hc, revCum:num(biz.revCum), cost5m:num(biz.cost5m), pnl5m:num(biz.pnl5m), revPP, costPP, eff}
  }),[deptStaff])

  const effChart = effRows.map(r=>({
    name:r.dept.replace("본부",""),
    "1인당 월매출":r3(r.revPP),
    "1인당 월비용":r3(r.costPP),
    fill:DEPT_COLORS[r.dept]||C.navyM,
  }))

  // ── 4) 외주 NEGO 절감 기회 ────────────────────────────────────
  const nego = useMemo(()=>{
    const cats = {}
    const list = Array.isArray(projects) ? projects : []
    list.forEach(p=>{
      const ver = Array.isArray(p?.versions) ? p.versions[p.versions.length-1] : null
      if(!ver?.vendors?.length) return
      ver.vendors.forEach(v=>{
        const contract = num(v?.contract)
        const final = num(v?.nego2)||num(v?.nego1)||contract
        const cat = v?.cat || "기타"
        const c = cats[cat] = cats[cat]||{cat,contract:0,final:0,negoContract:0,negoFinal:0,unNego:0,items:0}
        c.contract += contract; c.final += final; c.items++
        if (num(v?.nego1)||num(v?.nego2)) { c.negoContract+=contract; c.negoFinal+=final }
        else c.unNego += contract
      })
    })
    const rows = Object.values(cats).map(c=>{
      const saved = c.negoContract - c.negoFinal
      const rate  = c.negoContract>0 ? saved/c.negoContract : 0
      const potential = c.unNego * rate
      return {...c, saved, rate, potential}
    }).sort((a,b)=>(b.saved+b.potential)-(a.saved+a.potential))
    const totSaved = rows.reduce((s,r)=>s+r.saved,0)
    const totPot   = rows.reduce((s,r)=>s+r.potential,0)
    const totUnNego= rows.reduce((s,r)=>s+r.unNego,0)
    const withRate = rows.filter(r=>r.rate>0)
    const avgRate  = withRate.length ? withRate.reduce((s,r)=>s+r.rate,0)/withRate.length : 0
    return {rows, totSaved, totPot, totUnNego, avgRate}
  },[projects])

  // ── 5) AI 분석 제안 (규칙기반, 예외방어) ────────────────────────
  const suggestions = useMemo(()=>{
    const list = []
    try{
      effRows.filter(r=>r.revCum<0.5 && r.cost5m>3).forEach(r=>
        list.push({lv:"critical",title:`${r.dept} 매출 공백`,
          msg:`5개월 매출 ${fE(r.revCum)} 대비 비용 ${fE(r.cost5m)} (인원 ${r.hc}명). 매출형 프로젝트 전환 또는 타본부 지원 재배치 검토가 필요합니다.`}))

      if (sim.curCost>0 && sim.curPnl<0) {
        list.push({lv:"critical",title:"연간 BEP 미달 전망",
          msg:`확정매출 ${fE(sim.curRev)}을 전액 실현해도 연환산 비용 ${fE(sim.curCost)} 대비 ${fE(Math.abs(sim.curPnl))} 적자입니다. 비용 ${fPct(Math.abs(sim.curPnl)/sim.curCost*100)} 절감 또는 동액의 추가 매출이 필요합니다.`})
      }

      if (nego.totPot/1e8>0.1) {
        list.push({lv:"warning",title:"외주 NEGO 미적용 잔여",
          msg:`미협상 외주계약 ${fE(nego.totUnNego/1e8)}에 기존 평균 협상률 ${fPct(nego.avgRate*100)}을 적용하면 약 ${fE(nego.totPot/1e8)} 추가 절감이 가능합니다.`})
      }
      if (nego.totSaved>0) {
        list.push({lv:"info",title:"NEGO 절감 실적",
          msg:`협상 완료 외주에서 누적 ${fE(nego.totSaved/1e8)} 절감 (평균 ${fPct(nego.avgRate*100)}). 우수 협상 카테고리 단가를 전사 벤치마크로 활용을 권장합니다.`})
      }

      if (sim.curCost>0) {
        const laborShare = base.laborY/sim.curCost
        if (laborShare>0.35) list.push({lv:"warning",title:"인건비 비중 과다",
          msg:`연환산 인건비 ${fE(base.laborY)} — 총비용의 ${fPct(laborShare*100)}입니다. 1인당 연 ${fE(laborPerHead)} 기준, 자연감소·재배치를 우선 검토하세요.`})
      }

      list.push({lv:"warning",title:"수금 리스크 헤지",
        msg:"7월 14.32억·9월 6.99억 민간위험 기성이 포함되어 있습니다. 미실현 시 하반기 자금경색 우려 — 실현율 90% 시나리오로 자금계획을 이중화하는 것을 권장합니다."})
    }catch(e){
      list.push({lv:"info",title:"AI 분석 일부 보류",
        msg:"일부 데이터가 부족하여 자동분석을 건너뛰었습니다. 손익/인원 데이터를 입력하면 분석이 갱신됩니다."})
    }
    const order={critical:0,warning:1,info:2}
    return list.sort((a,b)=>order[a.lv]-order[b.lv])
  },[effRows,sim,nego,base,laborPerHead])

  const LV = {critical:{bg:C.redL,fg:C.red,label:"긴급"},warning:{bg:C.amberL,fg:"#633806",label:"주의"},info:{bg:C.navyL,fg:C.navyM,label:"참고"}}
  const pnlColor = v => v>=0?C.green:C.red

  return (
    <div>
      {/* ── KPI 요약 (대형) ── */}
      <div style={S.grid(4)}>
        <div style={S.kpi(C.red)}>
          <div style={{fontSize:13,color:C.gray,fontWeight:600,marginBottom:6}}>현재 추세 연간 손익</div>
          <div style={{fontSize:34,fontWeight:800,color:pnlColor(sim.curPnl),letterSpacing:-1}}>{fE(sim.curPnl)}</div>
          <div style={{fontSize:11.5,color:C.gray,marginTop:6}}>확정매출 {fE(sim.curRev)} − 연환산비용 {fE(sim.curCost)}</div>
        </div>
        <div style={S.kpi(pnlColor(sim.pnlY))}>
          <div style={{fontSize:13,color:C.gray,fontWeight:600,marginBottom:6}}>시뮬레이션 연간 손익</div>
          <div style={{fontSize:34,fontWeight:800,color:pnlColor(sim.pnlY),letterSpacing:-1}}>{fE(sim.pnlY)}</div>
          <div style={{fontSize:11.5,color:sim.pnlY-sim.curPnl>=0?C.green:C.red,marginTop:6,fontWeight:700}}>현재 대비 {sim.pnlY-sim.curPnl>=0?"+":""}{(sim.pnlY-sim.curPnl).toFixed(2)}억</div>
        </div>
        <div style={S.kpi(C.amber)}>
          <div style={{fontSize:13,color:C.gray,fontWeight:600,marginBottom:6}}>BEP까지 필요 추가매출</div>
          <div style={{fontSize:34,fontWeight:800,color:sim.bepGap>0?C.amber:C.green,letterSpacing:-1}}>{sim.bepGap>0?fE(sim.bepGap):"달성"}</div>
          <div style={{fontSize:11.5,color:C.gray,marginTop:6}}>시뮬레이션 조건 기준</div>
        </div>
        <div style={S.kpi(C.green)}>
          <div style={{fontSize:13,color:C.gray,fontWeight:600,marginBottom:6}}>외주 NEGO 절감 (실적+잠재)</div>
          <div style={{fontSize:34,fontWeight:800,color:C.green,letterSpacing:-1}}>{fE((nego.totSaved+nego.totPot)/1e8)}</div>
          <div style={{fontSize:11.5,color:C.gray,marginTop:6}}>실적 {fE(nego.totSaved/1e8)} · 잠재 {fE(nego.totPot/1e8)}</div>
        </div>
      </div>

      {/* ── 손익 시뮬레이터 ── */}
      <div style={{display:"grid",gridTemplateColumns:"380px 1fr",gap:16,marginBottom:16,alignItems:"stretch"}}>
        <div style={S.card({marginBottom:0})}>
          <div style={cardTitle}>⚙️ 손익 개선 시뮬레이터</div>
          <div style={cardNote}>1~5월 실적 연환산 기준 · 레버 조정 시 우측 즉시 반영</div>
          <Slider label="확정매출 실현율" value={revRate} onChange={setRevRate} min={60} max={110} step={5}
            hint={`확정매출 ${fE(BIZ_2026.revenueConfirmed)} 중 실현 비율 (민간위험 반영)`} color={C.navyM}/>
          <Slider label="인원 조정" value={hcDelta} onChange={setHcDelta} min={-15} max={5} unit="명"
            hint={`현재 ${headcount.toFixed(1)}명 · 1인당 연 인건비 ${fE(laborPerHead)}`} color={C.red}/>
          <Slider label="외주비 절감률" value={subCut} onChange={setSubCut} min={0} max={25} negative
            hint={`연환산 외주비 ${fE(base.subY)} · NEGO 평균 ${fPct(nego.avgRate*100)} 참고`} color={C.amber}/>
          <Slider label="경비·공통비 절감률" value={ovhCut} onChange={setOvhCut} min={0} max={30} negative
            hint={`연환산 경비+공통배부 ${fE(base.ovhY)}`} color={C.green}/>
          <button onClick={()=>{setRevRate(90);setHcDelta(0);setSubCut(0);setOvhCut(0)}}
            style={{padding:"9px 16px",background:C.grayL,color:"#555",border:"none",borderRadius:9,fontSize:13,fontWeight:600,cursor:"pointer"}}>초기화</button>
        </div>
        <div style={S.card({marginBottom:0})}>
          <div style={cardTitle}>현재 추세 vs 시뮬레이션 (연간, 억원)</div>
          <div style={cardNote}>비용 = 인건비 {fE(sim.laborY)} + 외주 {fE(sim.subY)} + 경비·공통 {fE(sim.ovhY)}</div>
          <ResponsiveContainer width="100%" height={420}>
            <ComposedChart data={simChart} barGap={14} barCategoryGap="28%" margin={{top:30,right:20,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
              <XAxis dataKey="name" tick={{fontSize:16,fontWeight:700}}/>
              <YAxis tick={{fontSize:13}} tickFormatter={v=>v+"억"}/>
              <Tooltip formatter={v=>`${v}억`} contentStyle={{fontSize:14}}/>
              <Legend wrapperStyle={{fontSize:14,fontWeight:600}} iconSize={16}/>
              <ReferenceLine y={0} stroke="#999"/>
              <Bar dataKey="매출" fill={C.navyM} radius={[8,8,0,0]} barSize={86}>
                <LabelList dataKey="매출" content={BoldLabel(C.navyM)}/>
              </Bar>
              <Bar dataKey="비용" fill={C.amber} radius={[8,8,0,0]} barSize={86}>
                <LabelList dataKey="비용" content={BoldLabel(C.amber)}/>
              </Bar>
              <Line dataKey="손익" stroke={C.red} strokeWidth={4} dot={{r:8,strokeWidth:2,fill:"#fff"}} activeDot={{r:10}}>
                <LabelList dataKey="손익" position="bottom" formatter={v=>`손익 ${v}억`} style={{fontSize:13,fontWeight:800,fill:C.red}}/>
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── AI 분석 제안 ── */}
      <div style={S.card()}>
        <div style={cardTitle}>🤖 AI 분석 제안</div>
        <div style={cardNote}>실적 데이터 기반 규칙 분석 · 우선순위순 (데이터가 부족하면 항목이 자동으로 줄어듭니다)</div>
        {suggestions.length===0
          ? <div style={{padding:"14px 16px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:13}}>현재 표시할 분석 결과가 없습니다.</div>
          : suggestions.map((s,i)=>(
            <div key={i} style={{display:"flex",gap:13,alignItems:"flex-start",padding:"13px 15px",borderRadius:11,background:LV[s.lv]?.bg||C.grayL,marginBottom:9}}>
              <span style={{...S.bdg(LV[s.lv]?.fg||C.gray,"#fff"),flexShrink:0,marginTop:1}}>{LV[s.lv]?.label||"참고"}</span>
              <div>
                <div style={{fontSize:14.5,fontWeight:700,color:LV[s.lv]?.fg||C.gray}}>{s.title}</div>
                <div style={{fontSize:13.5,color:"#444",marginTop:4,lineHeight:1.6}}>{s.msg}</div>
              </div>
            </div>
          ))}
      </div>

      {/* ── 본부별 인력 효율 ── */}
      <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:16,marginBottom:16}}>
        <div style={S.card({marginBottom:0})}>
          <div style={cardTitle}>👥 본부별 1인당 생산성 (월평균, 억원)</div>
          <div style={cardNote}>매출 막대가 비용 막대보다 낮으면 1인당 적자 구조입니다</div>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={effChart} barGap={10} barCategoryGap="22%" margin={{top:30,right:10,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
              <XAxis dataKey="name" tick={{fontSize:15,fontWeight:700}}/>
              <YAxis tick={{fontSize:13}}/>
              <Tooltip formatter={v=>`${v}억`} contentStyle={{fontSize:14}}/>
              <Legend wrapperStyle={{fontSize:14,fontWeight:600}} iconSize={16}/>
              <Bar dataKey="1인당 월매출" radius={[8,8,0,0]} barSize={60}>
                {effChart.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                <LabelList dataKey="1인당 월매출" content={BoldLabel(C.navy)}/>
              </Bar>
              <Bar dataKey="1인당 월비용" fill="#C9C7BF" radius={[8,8,0,0]} barSize={60}>
                <LabelList dataKey="1인당 월비용" content={BoldLabel("#888780")}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card({marginBottom:0})}>
          <div style={cardTitle}>효율지수 (5월 누계 매출 ÷ 비용)</div>
          <div style={cardNote}>1.0 이상이어야 본부 단위 손익분기 충족</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>
              <th style={S.th()}>본부</th><th style={S.th("right")}>인원</th>
              <th style={S.th("right")}>매출누계</th><th style={S.th("right")}>비용누계</th>
              <th style={S.th("right")}>손익</th><th style={S.th("right")}>효율지수</th>
            </tr></thead>
            <tbody>
              {effRows.map(r=>(
                <tr key={r.dept}>
                  <td style={{...S.td("left"),fontWeight:600}}><span style={{display:"inline-block",width:11,height:11,borderRadius:3,background:DEPT_COLORS[r.dept],marginRight:8,verticalAlign:"middle"}}/>{r.dept}</td>
                  <td style={S.td()}>{r.hc}명</td>
                  <td style={S.td()}>{fE(r.revCum)}</td>
                  <td style={S.td()}>{fE(r.cost5m)}</td>
                  <td style={{...S.td(),color:pnlColor(r.pnl5m),fontWeight:700}}>{fE(r.pnl5m)}</td>
                  <td style={S.td()}>
                    <span style={{...S.bdg(r.eff>=1?C.greenL:r.eff>=0.5?C.amberL:C.redL, r.eff>=1?"#27500A":r.eff>=0.5?"#633806":C.red),fontSize:14}}>
                      {r.eff.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 외주 NEGO 절감 기회 ── */}
      <div style={S.card()}>
        <div style={cardTitle}>🤝 외주비 NEGO 절감 분석</div>
        <div style={cardNote}>
          프로젝트 최신버전 협력업체 기준 · 협상실적 <b style={{color:C.green}}>{fE(nego.totSaved/1e8)}</b> ·
          미협상 잔여 {fE(nego.totUnNego/1e8)} ·
          평균 협상률 적용 시 잠재절감 <b style={{color:C.amber}}>{fE(nego.totPot/1e8)}</b>
        </div>
        {nego.rows.length===0
          ? <div style={{padding:"14px 16px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:13}}>등록된 협력업체 비용 데이터가 없습니다.</div>
          : <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}>
                <thead><tr>
                  <th style={S.th()}>공종</th><th style={S.th("right")}>건수</th>
                  <th style={S.th("right")}>계약합계</th><th style={S.th("right")}>협상절감</th>
                  <th style={S.th("right")}>협상률</th><th style={S.th("right")}>미협상 잔여</th>
                  <th style={S.th("right")}>잠재절감</th>
                </tr></thead>
                <tbody>
                  {nego.rows.slice(0,12).map(r=>(
                    <tr key={r.cat}>
                      <td style={{...S.td("left"),fontWeight:600}}>{r.cat}</td>
                      <td style={S.td()}>{r.items}</td>
                      <td style={S.td()}>{fW(r.contract)}</td>
                      <td style={{...S.td(),color:r.saved>0?C.green:C.gray,fontWeight:r.saved>0?700:400}}>{r.saved>0?fW(r.saved):"-"}</td>
                      <td style={S.td()}>{r.rate>0?<span style={{...S.bdg(C.greenL,"#27500A"),fontSize:13}}>{fPct(r.rate*100)}</span>:"-"}</td>
                      <td style={S.td()}>{r.unNego>0?fW(r.unNego):"-"}</td>
                      <td style={{...S.td(),fontWeight:700,color:r.potential>0?C.amber:C.gray}}>{r.potential>0?fW(r.potential):"-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>
    </div>
  )
}
