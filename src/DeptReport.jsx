// ══════════════════════════════════════════════════════════════
// 📋 본부별 주간보고 — 상지서울 업무회의록 스타일
// 프로젝트/실행계획서/주간보고(주요일정·설계진행현황) 데이터를 그대로 읽어와
// 본부별로 프로젝트 카드를 늘어놓는 "보고용" 읽기 화면. 값 수정은 각 원본 화면
// (프로젝트 상세정보 / 실행계획서 / 주간보고)에서 하면 여기 자동 반영된다.
// ══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react"
import { useDepts } from "./DeptContext.jsx"
import { calcPnlTotals } from "./data.js"
import { WEEKLY_REPORT_EMPTY, DEFAULT_DESIGN_STAGES, calcStageProgress, calcOverallProgress, daysBetween, upsertScheduleEntry } from "./WeeklyReport.jsx"

const fW  = v => v ? Math.round(v).toLocaleString()+"원" : "-"
const fA  = v => v>0 ? (v/1e8).toFixed(2)+"억원" : "-"
const toPy = m2 => m2 ? +(m2/3.3058).toFixed(1) : 0
const fDate = s => s ? String(s).slice(0,10) : "-"

export function DeptReportPage({projects=[], setProjects, cashItems=[], currentUser, setTab, setSelProjId, setDetailTab, deptReportOrder={}, setDeptReportOrder}) {
  const {DEPTS, DEPT_COLORS} = useDepts()
  const [selDept, setSelDept] = useState(DEPTS?.[0]||"")
  const [q, setQ] = useState("")
  const [reorderMode, setReorderMode] = useState(false)
  const [showHidden, setShowHidden] = useState(false)

  const deptAll = useMemo(()=>projects.filter(p=>(p.depts||[]).includes(selDept)), [projects, selDept])
  const hiddenCount = useMemo(()=>deptAll.filter(p=>p.hideFromWeeklyReport).length, [deptAll])

  const deptProjects = useMemo(()=>{
    let list = deptAll.filter(p=>showHidden || !p.hideFromWeeklyReport)
    if(q.trim()) { const ql=q.trim().toLowerCase(); list = list.filter(p=>(p.name||"").toLowerCase().includes(ql)) }
    // 저장된 수동 순서가 있으면 그 순서를 우선 적용하고, 순서에 없는(새로 추가된) 프로젝트는 용역비 큰 순으로 뒤에 붙인다
    const order = deptReportOrder[selDept] || []
    const orderIdx = new Map(order.map((id,i)=>[id,i]))
    return list.sort((a,b)=>{
      const ai = orderIdx.has(a.id) ? orderIdx.get(a.id) : Infinity
      const bi = orderIdx.has(b.id) ? orderIdx.get(b.id) : Infinity
      if(ai!==bi) return ai-bi
      return (b.serviceFee||0)-(a.serviceFee||0)
    })
  },[deptAll, q, deptReportOrder, selDept, showHidden])

  const toggleHide = (projId, hide) => {
    setProjects && setProjects(prev=>prev.map(p=>p.id===projId?{...p, hideFromWeeklyReport:hide}:p))
  }

  // 현재(검색 필터 없는) 본부 전체 목록 기준 순서를 저장 — 검색 중엔 이동 버튼을 숨겨 혼동을 막는다
  const moveProject = (projId, dir) => {
    const fullList = deptAll.filter(p=>showHidden || !p.hideFromWeeklyReport)
    const order = deptReportOrder[selDept]?.length ? deptReportOrder[selDept] : fullList.map(p=>p.id)
    const idx = order.indexOf(projId)
    if(idx===-1) return
    const swapWith = idx + dir
    if(swapWith<0 || swapWith>=order.length) return
    const next = [...order]
    ;[next[idx], next[swapWith]] = [next[swapWith], next[idx]]
    setDeptReportOrder(prev=>({...prev, [selDept]: next}))
  }

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
            <button key={d} onClick={()=>{setSelDept(d); setReorderMode(false)}}
              style={{padding:"8px 16px",borderRadius:20,border:`1.5px solid ${selDept===d?(DEPT_COLORS?.[d]||"#0E9C8C"):"#E5E7EB"}`,
                background:selDept===d?(DEPT_COLORS?.[d]||"#0E9C8C"):"#fff",color:selDept===d?"#fff":"#334155",
                fontSize:14.3,fontWeight:700,cursor:"pointer"}}>
              {d} <span style={{opacity:.75,fontWeight:400}}>({cnt})</span>
            </button>
          )
        })}
        <button onClick={()=>{setReorderMode(v=>!v); setQ("")}}
          style={{padding:"8px 16px",borderRadius:20,border:`1.5px solid ${reorderMode?"#7C3AED":"#E5E7EB"}`,
            background:reorderMode?"#7C3AED":"#fff",color:reorderMode?"#fff":"#334155",fontSize:14.3,fontWeight:700,cursor:"pointer"}}>
          {reorderMode?"✓ 순서 편집 완료":"↕ 순서 편집"}
        </button>
        {hiddenCount>0 && (
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13.6,color:"#64748B",cursor:"pointer"}}>
            <input type="checkbox" checked={showHidden} onChange={e=>setShowHidden(e.target.checked)}/>
            숨김 {hiddenCount}건 포함 보기
          </label>
        )}
        {!reorderMode && (
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="프로젝트명 검색"
            style={{marginLeft:"auto",padding:"8px 14px",border:"1.5px solid #E5E7EB",borderRadius:20,fontSize:14.3,minWidth:220}}/>
        )}
      </div>
      {reorderMode && (
        <div style={{background:"#F3EEFF",border:"1px solid #DDD6FE",borderRadius:10,padding:"10px 16px",marginBottom:14,fontSize:13.6,color:"#5B21B6"}}>
          ↕ 순서 편집 모드입니다 — 카드의 ▲▼ 버튼으로 이 본부 안에서 프로젝트 순서를 원하는 대로 옮기세요. 옮긴 순서는 저장되어 다음에 들어와도 그대로 유지됩니다.
        </div>
      )}

      {deptProjects.length===0
        ? <div style={{padding:"60px 0",textAlign:"center",color:"#94A3B8",fontSize:15.4}}>
            {hiddenCount>0 && !showHidden ? "표시할 프로젝트가 없습니다 (숨긴 프로젝트만 있음 — 위 체크박스로 확인해보세요)" : "이 본부에 등록된 프로젝트가 없습니다."}
          </div>
        : deptProjects.map((p,i)=>(
            <ProjectReportCard key={p.id} p={p} cashItems={cashItems} setProjects={setProjects} currentUser={currentUser}
              onOpen={anchor=>{ setTab("projects"); setSelProjId(p.id); setDetailTab && setDetailTab("basic")
                if(anchor) setTimeout(()=>document.getElementById(anchor)?.scrollIntoView({behavior:"smooth",block:"start"}), 200) }}
              onOpenVendors={()=>setTab("vendors")}
              reorderMode={reorderMode}
              canMoveUp={i>0} canMoveDown={i<deptProjects.length-1}
              onMoveUp={()=>moveProject(p.id,-1)} onMoveDown={()=>moveProject(p.id,1)}
              onHide={()=>toggleHide(p.id,true)} onUnhide={()=>toggleHide(p.id,false)}/>
          ))
      }
    </div>
  )
}

function InfoRow({label, value, strong, editable, onSave}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value||"")
  if(!editable && (value===undefined || value===null || value==="")) return null
  return (
    <div style={{display:"flex",gap:8,marginBottom:6,fontSize:13.6,alignItems:"baseline"}}>
      <span style={{color:"#94A3B8",width:74,flexShrink:0}}>{label}</span>
      {editing ? (
        <span style={{display:"flex",gap:5,flex:1}}>
          <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"){onSave(draft);setEditing(false)} if(e.key==="Escape")setEditing(false) }}
            style={{flex:1,fontSize:13.6,padding:"2px 6px",border:"1px solid #7C3AED",borderRadius:5}}/>
          <button onClick={()=>{onSave(draft);setEditing(false)}} style={{fontSize:12,color:"#7C3AED",background:"none",border:"none",cursor:"pointer",fontWeight:700}}>✓</button>
        </span>
      ) : (
        <span style={{color:"#0F172A",fontWeight:strong?800:600,wordBreak:"break-word",flex:1}}>
          {value || <span style={{color:"#CBD5E1",fontWeight:400}}>미입력</span>}
          {editable && <button onClick={()=>{setDraft(value||"");setEditing(true)}} style={{marginLeft:6,fontSize:11,color:"#94A3B8",background:"none",border:"none",cursor:"pointer"}}>✎</button>}
        </span>
      )}
    </div>
  )
}

function ProjectReportCard({p, cashItems, setProjects, currentUser, onOpen, onOpenVendors, reorderMode, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onHide, onUnhide}) {
  const wr = p.weeklyReport || WEEKLY_REPORT_EMPTY
  const stagesDef = wr.stagesDef || DEFAULT_DESIGN_STAGES
  const stages = wr.stages || {}
  const scheduleLog = (wr.scheduleLog||[]).slice().sort((a,b)=>b.date.localeCompare(a.date))
  const hidden = !!p.hideFromWeeklyReport
  const overall = calcOverallProgress(stagesDef, stages)

  // 이번 주 AGENDA(최신 주차) — 4~5개 정도만 요약 표시, 전체 이력은 주간보고 탭에 계속 쌓임
  const agendas = wr.agendas || []
  const latestAgenda = agendas.slice().sort((a,b)=>b.week.localeCompare(a.week))[0]

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

  // 투입인원 — 직급(임원/부장/차장/과장/대리/사원)별로 묶어서 표시
  const STAFF_TITLES = ["임원","부장","차장","과장","대리","사원"]
  const staffByTitle = useMemo(()=>{
    const groups = {}
    ;(p.staffMembers||[]).filter(m=>m.name||m.title).forEach(m=>{
      const t = STAFF_TITLES.find(t=>m.title&&m.title.includes(t)) || m.title || "기타"
      groups[t] = groups[t] || []
      if(m.name) groups[t].push(m.name)
    })
    return groups
  },[p.staffMembers])
  const staffSummary = Object.entries(staffByTitle).map(([t,names])=>`${t} ${names.length}명${names.length?"("+names.join(",")+")":""}`).join(" · ")

  // 필드 하나를 저장 — 프로젝트 상세정보와 같은 데이터를 바로 고치므로 상호 100% 동기화되고,
  // PM 등 핵심 담당자가 바뀌면 "주요일정"에 변경 이력을 자동으로 남긴다.
  const saveField = (field, label, value) => {
    if(!setProjects) return
    setProjects(prev=>prev.map(pp=>{
      if(pp.id!==p.id) return pp
      const old = pp[field]
      let nextWr = pp.weeklyReport || WEEKLY_REPORT_EMPTY
      if(label && old && value && old!==value){
        const today = new Date().toISOString().slice(0,10)
        const byName = currentUser?.name || "알 수 없음"
        nextWr = {...nextWr, scheduleLog: upsertScheduleEntry(nextWr.scheduleLog,
          {date:today, category:`${label} 변경`, content:`${label} 변경: ${old} → ${value}`, sourceKey:`histlog:${field}:${Date.now()}`}, byName)}
      }
      return {...pp, [field]:value, weeklyReport:nextWr}
    }))
  }

  const jumpBtn = (label, anchor, action) => (
    <button onClick={action || (()=>onOpen(anchor))}
      style={{padding:"4px 11px",background:"#F8FAFC",color:"#334155",border:"1px solid #E5E7EB",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
      {label} →
    </button>
  )

  return (
    <div style={{background:hidden?"#F8FAFC":"#fff",border:`1px solid ${hidden?"#E2E8F0":"#E5E7EB"}`,borderRadius:14,padding:"20px 26px",marginBottom:22,boxShadow:hidden?"none":"0 1px 4px rgba(0,0,0,.05)",opacity:hidden?.65:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:12,borderBottom:"2px solid #F1F5F9",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {reorderMode && (
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              <button onClick={onMoveUp} disabled={!canMoveUp}
                style={{width:26,height:22,border:"1px solid #DDD6FE",borderRadius:5,background:canMoveUp?"#F3EEFF":"#F8FAFC",
                  color:canMoveUp?"#7C3AED":"#CBD5E1",cursor:canMoveUp?"pointer":"default",fontSize:12,lineHeight:1}}>▲</button>
              <button onClick={onMoveDown} disabled={!canMoveDown}
                style={{width:26,height:22,border:"1px solid #DDD6FE",borderRadius:5,background:canMoveDown?"#F3EEFF":"#F8FAFC",
                  color:canMoveDown?"#7C3AED":"#CBD5E1",cursor:canMoveDown?"pointer":"default",fontSize:12,lineHeight:1}}>▼</button>
            </div>
          )}
          <div style={{fontSize:18.7,fontWeight:800,color:hidden?"#94A3B8":"#0B6E63"}}>[부] {p.name}</div>
          {hidden && <span style={{fontSize:11.5,fontWeight:800,color:"#94A3B8",background:"#E2E8F0",borderRadius:5,padding:"2px 8px"}}>숨김</span>}
        </div>
        <div style={{display:"flex",gap:6}}>
          {hidden
            ? <button onClick={onUnhide} style={{padding:"6px 14px",background:"#E3F6F3",color:"#0B6E63",border:"none",borderRadius:8,fontSize:13.2,fontWeight:700,cursor:"pointer"}}>🙉 다시 표시</button>
            : <button onClick={onHide} style={{padding:"6px 14px",background:"#F8FAFC",color:"#64748B",border:"1px solid #E5E7EB",borderRadius:8,fontSize:13.2,fontWeight:700,cursor:"pointer"}}>🙈 숨기기</button>
          }
          <button onClick={()=>onOpen()} style={{padding:"6px 14px",background:"#E3F6F3",color:"#0B6E63",border:"none",borderRadius:8,fontSize:13.2,fontWeight:700,cursor:"pointer"}}>
            상세 열기 →
          </button>
        </div>
      </div>

      {/* 빠른 이동 링크 */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {jumpBtn("🤝 협력업체", null, onOpenVendors)}
        {jumpBtn("💧 월수금계획", "sec-cashflow")}
        {jumpBtn("📄 계약서·서류", "sec-certs")}
        {jumpBtn("📋 주간보고 전체", "sec-weekly")}
        {jumpBtn("📐 실행계획서", "sec-info")}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.15fr 1.15fr 1fr 1fr",gap:20}}>
        {/* 1열: 기본정보 */}
        <div>
          <InfoRow label="PM" value={p.pm} editable={!!setProjects} onSave={v=>saveField("pm","PM",v)}/>
          <InfoRow label="발주처" value={p.client} editable={!!setProjects} onSave={v=>saveField("client","발주처",v)}/>
          <InfoRow label="담당자" value={[p.clientPm,p.clientTel].filter(Boolean).join(" · ")} editable={!!setProjects} onSave={v=>saveField("clientPm","발주처 담당자",v)}/>
          <InfoRow label="계약일" value={fDate(p.contractDate)}/>
          <div style={{height:8}}/>
          <InfoRow label="공동분담" value={p.jvShareText}/>
          <InfoRow label="분담이행" value={p.jvExecText}/>
          <InfoRow label="투입인원" value={staffSummary}/>
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

        {/* 2열: 설계 진행 현황 — 단계별 기간·일수·자동 진행률 + 전체 타임라인(오늘 위치) */}
        <div>
          <div style={{fontSize:13.2,fontWeight:800,color:"#64748B",marginBottom:8}}>📐 설계 진행 현황</div>
          {stagesDef.filter(s=>stages[s.id]?.startDate||stages[s.id]?.endDate).length===0
            ? <div style={{fontSize:12.5,color:"#CBD5E1"}}>등록된 단계 일정이 없습니다</div>
            : stagesDef.map((s,i)=>{
                const st = stages[s.id]||{}
                if(!st.startDate && !st.endDate) return null
                const prog = calcStageProgress(st.startDate, st.endDate)
                const days = daysBetween(st.startDate, st.endDate)
                const isCurrent = overall.currentStageId===s.id
                return (
                  <div key={s.id} style={{marginBottom:10}}>
                    <div style={{fontSize:12.5,marginBottom:2}}>
                      <span style={{color:s.color,fontWeight:700}}>{i+1}. {s.label}</span>
                      {isCurrent && <span style={{marginLeft:5,fontSize:10,fontWeight:800,color:"#fff",background:s.color,borderRadius:3,padding:"0 5px"}}>진행중</span>}
                    </div>
                    <div style={{fontSize:11.6,color:"#94A3B8",marginBottom:3}}>
                      {st.startDate||"?"} ~ {st.endDate||"?"}{days!=null?`(${days}일)`:""}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{flex:1,height:7,background:"#F1F5F9",borderRadius:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${prog}%`,background:s.color,borderRadius:4}}/>
                      </div>
                      <span style={{fontSize:11.6,fontWeight:700,color:s.color,width:32,textAlign:"right"}}>{prog}%</span>
                    </div>
                  </div>
                )
              })
          }
          {overall.overallStart && (
            <div style={{marginTop:12,paddingTop:10,borderTop:"1px dashed #E5E7EB"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11.6,color:"#64748B",marginBottom:3}}>
                <span>전체 진행률</span><span style={{fontWeight:800,color:"#0B6E63"}}>오늘 {overall.pct}%</span>
              </div>
              <div style={{position:"relative",height:16,background:"#fff",border:"1px solid #E5E7EB",borderRadius:5,display:"flex",overflow:"visible"}}>
                {stagesDef.filter(s=>stages[s.id]?.startDate && stages[s.id]?.endDate).map(s=>{
                  const d = daysBetween(stages[s.id].startDate, stages[s.id].endDate) || 0
                  const totalDays = daysBetween(overall.overallStart, overall.overallEnd) || 1
                  const w = Math.max(2, d/totalDays*100)
                  return <div key={s.id} title={s.label} style={{width:`${w}%`,background:s.color,opacity:s.id===overall.currentStageId?1:.5,borderRight:"1px solid #fff"}}/>
                })}
                <div style={{position:"absolute",left:`${overall.pct}%`,top:-3,bottom:-3,width:2,background:"#DC2626"}}/>
              </div>
            </div>
          )}
        </div>

        {/* 3열: 주요일정 (별도 배치) */}
        <div>
          <div style={{fontSize:13.2,fontWeight:800,color:"#64748B",marginBottom:8}}>📅 주요일정</div>
          <div style={{fontSize:12.8,lineHeight:1.9,maxHeight:280,overflowY:"auto",paddingRight:4}}>
            {scheduleLog.length===0
              ? <span style={{color:"#CBD5E1"}}>등록된 일정이 없습니다</span>
              : scheduleLog.map(e=>(
                  <div key={e.id}>▷ {e.date} {e.content}{e.memo?`(${e.memo})`:""}</div>
                ))
            }
          </div>
        </div>

        {/* 4열: AGENDA(주차 누적) + 설계도면 교차검토 */}
        <div>
          <div style={{fontSize:13.2,fontWeight:800,color:"#64748B",marginBottom:8}}>
            📌 AGENDA {latestAgenda&&<span style={{fontWeight:400,color:"#94A3B8"}}>({latestAgenda.week})</span>}
          </div>
          <div style={{fontSize:13.2,lineHeight:1.8,marginBottom:16,color:"#334155"}}>
            {!latestAgenda || latestAgenda.items.length===0
              ? <span style={{color:"#CBD5E1"}}>등록된 내용이 없습니다</span>
              : latestAgenda.items.slice(0,5).map((it,i)=>(
                  <div key={it.id} style={{marginBottom:4,textDecoration:it.done?"line-through":"none",color:it.done?"#94A3B8":"#334155"}}>{i+1}. {it.text}</div>
                ))
            }
          </div>
          <div style={{fontSize:13.2,fontWeight:800,color:"#64748B",marginBottom:8}}>🔍 설계도면 교차 검토</div>
          <div style={{fontSize:13.2,lineHeight:1.8,whiteSpace:"pre-wrap",color:"#334155"}}>
            {p.crossReviewNotes || <span style={{color:"#CBD5E1"}}>등록된 내용이 없습니다</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
