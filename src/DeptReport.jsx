// ══════════════════════════════════════════════════════════════
// 📋 본부별 주간보고 — 상지서울 업무회의록 스타일
// 프로젝트/실행계획서/주간보고(주요일정·설계진행현황) 데이터를 그대로 읽어와
// 본부별로 프로젝트 카드를 늘어놓는 "보고용" 읽기 화면. 값 수정은 각 원본 화면
// (프로젝트 상세정보 / 실행계획서 / 주간보고)에서 하면 여기 자동 반영된다.
// ══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react"
import { useDepts } from "./DeptContext.jsx"
import { calcPnlTotals } from "./data.js"
import { WEEKLY_REPORT_EMPTY, DEFAULT_DESIGN_STAGES } from "./WeeklyReport.jsx"

const fW  = v => v ? Math.round(v).toLocaleString()+"원" : "-"
const fA  = v => v>0 ? (v/1e8).toFixed(2)+"억원" : "-"
const toPy = m2 => m2 ? +(m2/3.3058).toFixed(1) : 0
const fDate = s => s ? String(s).slice(0,10) : "-"

export function DeptReportPage({projects=[], cashItems=[], currentUser, setTab, setSelProjId, setDetailTab}) {
  const {DEPTS, DEPT_COLORS} = useDepts()
  const [selDept, setSelDept] = useState(DEPTS?.[0]||"")
  const [q, setQ] = useState("")

  const deptProjects = useMemo(()=>{
    let list = projects.filter(p=>(p.depts||[]).includes(selDept))
    if(q.trim()) { const ql=q.trim().toLowerCase(); list = list.filter(p=>(p.name||"").toLowerCase().includes(ql)) }
    return list.sort((a,b)=>(b.serviceFee||0)-(a.serviceFee||0))
  },[projects, selDept, q])

  return (
    <div style={{maxWidth:1400,margin:"0 auto"}}>
      <div style={{fontSize:24.2,fontWeight:800,color:"#0B6E63",marginBottom:6}}>📋 본부별 주간보고</div>
      <div style={{fontSize:14.3,color:"#64748B",marginBottom:18}}>
        프로젝트 상세정보 · 실행계획서 · 주간보고(주요일정·설계진행현황)에 입력된 내용을 그대로 모아 보여줍니다.
        값을 고치려면 카드 우측 상단 "상세 열기"로 들어가서 수정하면 여기에도 바로 반영됩니다.
      </div>

      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        {(DEPTS||[]).map(d=>{
          const cnt = projects.filter(p=>(p.depts||[]).includes(d)).length
          return (
            <button key={d} onClick={()=>setSelDept(d)}
              style={{padding:"8px 16px",borderRadius:20,border:`1.5px solid ${selDept===d?(DEPT_COLORS?.[d]||"#0E9C8C"):"#E5E7EB"}`,
                background:selDept===d?(DEPT_COLORS?.[d]||"#0E9C8C"):"#fff",color:selDept===d?"#fff":"#334155",
                fontSize:14.3,fontWeight:700,cursor:"pointer"}}>
              {d} <span style={{opacity:.75,fontWeight:400}}>({cnt})</span>
            </button>
          )
        })}
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="프로젝트명 검색"
          style={{marginLeft:"auto",padding:"8px 14px",border:"1.5px solid #E5E7EB",borderRadius:20,fontSize:14.3,minWidth:220}}/>
      </div>

      {deptProjects.length===0
        ? <div style={{padding:"60px 0",textAlign:"center",color:"#94A3B8",fontSize:15.4}}>이 본부에 등록된 프로젝트가 없습니다.</div>
        : deptProjects.map(p=>(
            <ProjectReportCard key={p.id} p={p} cashItems={cashItems}
              onOpen={()=>{ setTab("projects"); setSelProjId(p.id); setDetailTab && setDetailTab("basic") }}/>
          ))
      }
    </div>
  )
}

function InfoRow({label, value, strong}) {
  if(value===undefined || value===null || value==="") return null
  return (
    <div style={{display:"flex",gap:8,marginBottom:6,fontSize:13.6,alignItems:"baseline"}}>
      <span style={{color:"#94A3B8",width:74,flexShrink:0}}>{label}</span>
      <span style={{color:"#0F172A",fontWeight:strong?800:600,wordBreak:"break-word"}}>{value}</span>
    </div>
  )
}

function ProjectReportCard({p, cashItems, onOpen}) {
  const wr = p.weeklyReport || WEEKLY_REPORT_EMPTY
  const stagesDef = wr.stagesDef || DEFAULT_DESIGN_STAGES
  const stages = wr.stages || {}
  const scheduleLog = (wr.scheduleLog||[]).slice().sort((a,b)=>a.date.localeCompare(b.date))

  const versions = p.versions||[]
  const latest = versions.reduce((mx,v)=>(!mx||(v.round||0)>(mx.round||0))?v:mx, versions[0])
  const pnl = latest ? calcPnlTotals(latest) : null

  // 매출누계 — 월수금계획(cashItems)에서 이 프로젝트로 실제 입금된 금액 합계 (기존 화면들과 동일한 매칭 방식)
  const paidTotal = useMemo(()=>cashItems
    .filter(i=>i.paidDate && (i.projectName===p.name || (i.projectName && i.projectName.includes(p.name.slice(0,6)))))
    .reduce((s,i)=>s+(i.amount||0),0)
  ,[cashItems, p.name])
  const feeBase = p.serviceFee || p.totalFee || 0
  const pct = feeBase>0 ? Math.min(100, Math.round(paidTotal/feeBase*100)) : 0

  const staffLine = (p.staffMembers||[]).filter(m=>m.name||m.title).map(m=>`${m.title||""}${m.name?" "+m.name:""}`).join(", ")

  return (
    <div style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:14,padding:"20px 26px",marginBottom:22,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingBottom:12,borderBottom:"2px solid #F1F5F9"}}>
        <div style={{fontSize:18.7,fontWeight:800,color:"#0B6E63"}}>[부] {p.name}</div>
        <button onClick={onOpen} style={{padding:"6px 14px",background:"#E3F6F3",color:"#0B6E63",border:"none",borderRadius:8,fontSize:13.2,fontWeight:700,cursor:"pointer"}}>
          상세 열기 →
        </button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.1fr 1fr 1fr",gap:24}}>
        {/* 좌: 기본정보 */}
        <div>
          <InfoRow label="PM" value={p.pm}/>
          <InfoRow label="발주처" value={p.client}/>
          <InfoRow label="담당자" value={[p.clientPm,p.clientTel].filter(Boolean).join(" · ")}/>
          <InfoRow label="계약일" value={fDate(p.contractDate)}/>
          <InfoRow label="공동분담" value={p.jvShareText}/>
          <InfoRow label="투입인원" value={staffLine}/>
          <div style={{height:8}}/>
          <InfoRow label="총용역비" value={fW(feeBase)} strong/>
          <InfoRow label="실행금액" value={pnl?fW(pnl.total):"-"}/>
          <InfoRow label="매출누계" value={`${fW(paidTotal)} (기성률 ${pct}%)`}/>
          <div style={{height:6,background:"#F1F5F9",borderRadius:3,overflow:"hidden",marginTop:2,marginBottom:10}}>
            <div style={{height:"100%",width:`${pct}%`,background:pct>=100?"#059669":"#0E9C8C",borderRadius:3}}/>
          </div>
          <InfoRow label="대지면적" value={p.siteArea?`${p.siteArea.toLocaleString()}㎡ (${toPy(p.siteArea)}평)`:null}/>
          <InfoRow label="연면적" value={p.floorArea?`${p.floorArea.toLocaleString()}㎡ (${toPy(p.floorArea)}평)`:null}/>
          <InfoRow label="규모" value={p.scale}/>
          <InfoRow label="공사비" value={p.constructionCost?`${p.constructionCost}억원`:null}/>
        </div>

        {/* 중: 주요일정 + 설계진행현황 */}
        <div>
          <div style={{fontSize:13.2,fontWeight:800,color:"#64748B",marginBottom:8}}>📅 주요일정</div>
          <div style={{fontSize:13.2,lineHeight:1.9,marginBottom:16,maxHeight:190,overflowY:"auto",paddingRight:4}}>
            {scheduleLog.length===0
              ? <span style={{color:"#CBD5E1"}}>등록된 일정이 없습니다</span>
              : scheduleLog.map(e=>(
                  <div key={e.id}>▷ {e.content}{e.memo?`(${e.memo})`:""} : {e.date}</div>
                ))
            }
          </div>
          <div style={{fontSize:13.2,fontWeight:800,color:"#64748B",marginBottom:8}}>📐 설계 진행 현황</div>
          {stagesDef.map(s=>{
            const st = stages[s.id]||{}
            const prog = st.progress||0
            return (
              <div key={s.id} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:2}}>
                  <span style={{color:s.color,fontWeight:700}}>{s.label}</span>
                  <span style={{color:"#64748B"}}>{prog}%{st.startDate?` · ${st.startDate}~${st.endDate||""}`:""}</span>
                </div>
                <div style={{height:7,background:"#F1F5F9",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${prog}%`,background:s.color,borderRadius:4,transition:"width .4s"}}/>
                </div>
              </div>
            )
          })}
        </div>

        {/* 우: AGENDA + 교차검토 */}
        <div>
          <div style={{fontSize:13.2,fontWeight:800,color:"#64748B",marginBottom:8}}>📌 AGENDA</div>
          <div style={{fontSize:13.6,lineHeight:1.9,whiteSpace:"pre-wrap",marginBottom:16,color:"#334155"}}>
            {p.agendaNotes || <span style={{color:"#CBD5E1"}}>등록된 내용이 없습니다</span>}
          </div>
          <div style={{fontSize:13.2,fontWeight:800,color:"#64748B",marginBottom:8}}>🔍 설계도면 교차 검토</div>
          <div style={{fontSize:13.6,lineHeight:1.9,whiteSpace:"pre-wrap",color:"#334155"}}>
            {p.crossReviewNotes || <span style={{color:"#CBD5E1"}}>등록된 내용이 없습니다</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
