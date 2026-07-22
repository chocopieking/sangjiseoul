// ══════════════════════════════════════════════════════════════
// 📋 주간보고 탭
// 프로젝트별 : 주요일정 로그 / 설계단계 진행현황 / 주간 AGENDA / 담당자
// 모든 데이터는 project.weeklyReport 객체에 영속 저장
// ══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react"

// ── 색상·스타일 헬퍼 ──────────────────────────────────────────
const C = {
  navy:"#0C447C",navyM:"#185FA5",navyL:"#E6F1FB",
  green:"#1D9E75",greenL:"#EAF3DE",
  amber:"#BA7517",amberL:"#FAEEDA",
  red:"#A32D2D",  redL:"#FCEBEB",
  gray:"#888780", grayL:"#F1EFE8",
}
const card  = (x={})=>({background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:14,padding:"18px 22px",marginBottom:16,...x})
const th    = (a="left")=>({padding:"9px 12px",textAlign:a,fontSize:12,fontWeight:600,color:"var(--color-text-secondary,#888)",background:"var(--color-background-secondary,#f8f8f6)",borderBottom:"1px solid var(--color-border-tertiary,#eee)",whiteSpace:"nowrap"})
const td    = (a="left")=>({padding:"8px 12px",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",textAlign:a,fontSize:13,verticalAlign:"top"})
const inp   = (w="100%")=>({width:w,padding:"7px 9px",border:"1px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:13,fontFamily:"inherit",background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)",boxSizing:"border-box"})
const btn   = (bg=C.navyM,fg="#fff")=>({padding:"7px 14px",background:bg,color:fg,border:"none",borderRadius:9,fontSize:13,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5})
const lbl   = ()=>({display:"block",fontSize:11,color:C.gray,fontWeight:600,marginBottom:3})
const badge = (bg,fg)=>({display:"inline-flex",padding:"2px 9px",borderRadius:9,fontSize:11,fontWeight:700,background:bg,color:fg})

const now = ()=>new Date().toISOString()
const fDate = iso=>iso?iso.slice(0,10):""
const fDT   = iso=>{ if(!iso) return "-"; const d=new Date(iso); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}` }
const getWeek = ()=>{ const d=new Date(); const start=new Date(d.getFullYear(),0,1); const w=Math.ceil(((d-start)/86400000+start.getDay()+1)/7); return `${d.getFullYear()}-W${String(w).padStart(2,"0")}` }

// ── 설계 단계 기본값 (프로젝트별 커스텀 가능) ───────────────────
export const DEFAULT_DESIGN_STAGES = [
  {id:"contract",  label:"계약시",   color:C.navyM},
  {id:"review",    label:"심의",     color:C.amber},
  {id:"permit",    label:"인허가",   color:C.green},
  {id:"impl",      label:"실시설계", color:"#534AB7"},
  {id:"site",      label:"현장관리", color:C.red},
]
const STAGE_COLORS = [C.navyM, C.amber, C.green, "#534AB7", C.red, "#D85A30", "#7C5295", "#2E86AB"]

// ── 일정 카테고리 기본값 ──────────────────────────────────────────
export const DEFAULT_SCHED_CATS = [
  {id:"design",   label:"설계",     color:C.navyM},
  {id:"meeting",  label:"회의",     color:C.amber},
  {id:"review",   label:"심의·인허가", color:C.green},
  {id:"site",     label:"현장",     color:C.red},
  {id:"admin",    label:"행정",     color:"#7C5295"},
  {id:"etc",      label:"기타",     color:C.gray},
]

// 빈 WeeklyReport 초기값
export const WEEKLY_REPORT_EMPTY = {
  scheduleLog:  [],
  schedCats:    null,  // null이면 DEFAULT_SCHED_CATS 사용
  stagesDef:    null,
  stages:       {},
  agendas:      [],
  contacts:     [],
}

// ─────────────────────────────────────────────────────────────
export function WeeklyReportTab({proj, setProjects, canWrite, currentUser}) {
  if(!proj?.id) return null
  const wr = proj.weeklyReport || WEEKLY_REPORT_EMPTY
  const [sub, setSub] = useState("schedule")   // schedule|stages|agenda|contacts

  const save = (patch) => {
    setProjects(prev=>prev.map(p=>p.id===proj.id
      ? {...p, weeklyReport:{...WEEKLY_REPORT_EMPTY,...(p.weeklyReport||{}),...patch}}
      : p
    ))
  }

  const SUBS = [
    {id:"schedule", label:"📅 주요일정"},
    {id:"stages",   label:"📊 설계진행현황"},
    {id:"agenda",   label:"📌 AGENDA"},
    {id:"contacts", label:"👤 담당자"},
  ]

  return (
    <div>
      {/* 서브 네비 */}
      <div style={{display:"flex",gap:3,marginBottom:14,flexWrap:"wrap"}}>
        {SUBS.map(s=>(
          <button key={s.id} onClick={()=>setSub(s.id)} style={{
            padding:"8px 16px",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",
            background:sub===s.id?C.navyM:"var(--color-background-secondary,#f0f0ee)",
            color:sub===s.id?"#fff":"var(--color-text-secondary,#777)",
            boxShadow:sub===s.id?"0 2px 8px rgba(12,68,124,.2)":"none",
          }}>{s.label}</button>
        ))}
      </div>

      {sub==="schedule" && <ScheduleLogSection wr={wr} save={save} canWrite={canWrite} proj={proj} currentUser={currentUser}/>}
      {sub==="stages"   && <StagesSection      wr={wr} save={save} canWrite={canWrite} proj={proj}/>}
      {sub==="agenda"   && <AgendaSection      wr={wr} save={save} canWrite={canWrite}/>}
      {sub==="contacts" && <ContactsSection    wr={wr} save={save} canWrite={canWrite}/>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 1) 주요일정 로그 — 날짜/구분/주요내용/메모 + 구분 커스텀 + 수정자 기록
// ══════════════════════════════════════════════════════════════

function ScheduleLogSection({wr, save, canWrite, proj, currentUser}) {
  const logs      = wr.scheduleLog || []
  const schedCats = wr.schedCats   || DEFAULT_SCHED_CATS

  // 입력 폼
  const [date,  setDate]  = useState(fDate(new Date().toISOString()))
  const [cat,   setCat]   = useState(schedCats[0]||"기타")
  const [text,  setText]  = useState("")
  const [memo,  setMemo]  = useState("")
  const [editId,setEditId]= useState(null)
  const [editDraft,setED] = useState({})
  const [filter,setFilter]= useState("")

  // 구분 관리
  const [showCatMgr, setShowCatMgr] = useState(false)
  const [newCat, setNewCat]         = useState("")
  const [editCatIdx, setEditCatIdx] = useState(null)
  const [editCatVal, setEditCatVal] = useState("")

  const byName = currentUser?.name || "알 수 없음"

  const add = () => {
    if(!text.trim()) return
    const entry = {
      id:`SL${Date.now()}`, date, category:cat,
      content: text.trim(), memo: memo.trim(),
      createdAt:now(), updatedAt:now(),
      createdBy: byName,
    }
    save({scheduleLog:[...logs,entry].sort((a,b)=>a.date.localeCompare(b.date))})
    setText(""); setMemo("")
  }

  const startEdit = e => { setEditId(e.id); setED({date:e.date, cat:e.category, text:e.content, memo:e.memo||""}) }
  const saveEdit  = () => {
    save({scheduleLog:logs.map(e=>e.id===editId?{...e,
      date:editDraft.date, category:editDraft.cat,
      content:editDraft.text, memo:editDraft.memo,
      updatedAt:now(), updatedBy:byName
    }:e)})
    setEditId(null)
  }
  const del = id => { if(window.confirm("이 일정 기록을 삭제하시겠습니까?")) save({scheduleLog:logs.filter(e=>e.id!==id)}) }

  // 구분 CRUD
  const addCat    = () => {
    const t=newCat.trim(); if(!t||schedCats.includes(t)) return
    save({schedCats:[...schedCats, t]}); setNewCat("")
  }
  const saveCat   = i => {
    const t=editCatVal.trim(); if(!t) return
    const next=[...schedCats]; next[i]=t
    save({schedCats:next}); setEditCatIdx(null)
  }
  const removeCat = i => {
    if(!window.confirm(`"${schedCats[i]}" 구분을 삭제하시겠습니까?`)) return
    save({schedCats:schedCats.filter((_,ri)=>ri!==i)})
  }
  const moveCat   = (i,d) => {
    const a=[...schedCats]; [a[i],a[i+d]]=[a[i+d],a[i]]; save({schedCats:a})
  }

  const filtered  = logs.filter(e=>!filter||e.category===filter||e.content?.includes(filter)||e.memo?.includes(filter))
  const catColor  = {계약:C.navyM,심의:C.amber,인허가:C.green,착공:"#534AB7",준공:C.green,변경:C.red,기타:C.gray}
  const getColor  = c => catColor[c] || C.navyM

  return (
    <div style={card()}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <div style={{fontSize:15,fontWeight:700}}>📅 주요일정 기록</div>
        {canWrite&&<button onClick={()=>setShowCatMgr(v=>!v)} style={{...btn(C.grayL,C.gray),padding:"5px 12px",fontSize:12}}>
          ⚙ 구분 관리
        </button>}
      </div>
      <div style={{fontSize:12,color:C.gray,marginBottom:14}}>
        날짜별 주요 사안을 기록합니다. 수정 시 수정자와 일시가 자동 기록됩니다.
      </div>

      {/* 구분 관리 패널 */}
      {showCatMgr && (
        <div style={{background:C.navyL,borderRadius:12,padding:"14px 16px",marginBottom:14,border:`1px solid ${C.navyM}22`}}>
          <div style={{fontSize:14,fontWeight:700,color:C.navyM,marginBottom:10}}>⚙ 구분 항목 관리</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
            {schedCats.map((c,i)=>(
              <div key={i} style={{display:"flex",gap:6,alignItems:"center"}}>
                <div style={{display:"flex",flexDirection:"column",gap:2}}>
                  <button onClick={()=>i>0&&moveCat(i,-1)} style={{...btn(C.navyL,C.navyM),padding:"1px 6px",fontSize:10,opacity:i===0?.3:1}}>▲</button>
                  <button onClick={()=>i<schedCats.length-1&&moveCat(i,1)} style={{...btn(C.navyL,C.navyM),padding:"1px 6px",fontSize:10,opacity:i===schedCats.length-1?.3:1}}>▼</button>
                </div>
                <div style={{width:10,height:10,borderRadius:"50%",background:getColor(c),flexShrink:0}}/>
                {editCatIdx===i
                  ? <>
                      <input value={editCatVal} onChange={e=>setEditCatVal(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")saveCat(i);if(e.key==="Escape")setEditCatIdx(null)}}
                        style={{...inp(),flex:1,padding:"5px 9px",fontSize:13}} autoFocus/>
                      <button onClick={()=>saveCat(i)} style={{...btn(C.green),padding:"5px 10px",fontSize:12}}>저장</button>
                      <button onClick={()=>setEditCatIdx(null)} style={{...btn(C.grayL,C.gray),padding:"5px 10px",fontSize:12}}>취소</button>
                    </>
                  : <>
                      <span style={{flex:1,fontSize:14,fontWeight:600}}>{c}</span>
                      <button onClick={()=>{setEditCatIdx(i);setEditCatVal(c)}} style={{...btn(C.navyL,C.navyM),padding:"4px 9px",fontSize:12}}>수정</button>
                      <button onClick={()=>removeCat(i)} style={{...btn(C.redL,C.red),padding:"4px 9px",fontSize:12}}>삭제</button>
                    </>
                }
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:7}}>
            <input value={newCat} onChange={e=>setNewCat(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addCat()}
              placeholder="새 구분 추가 (Enter)" style={{...inp(),flex:1,padding:"7px 10px",fontSize:13}}/>
            <button onClick={addCat} style={{...btn(C.navyM),padding:"7px 14px"}}>+ 추가</button>
          </div>
        </div>
      )}

      {/* 입력 폼 */}
      {canWrite && (
        <div style={{background:"#F8FAFC",borderRadius:12,padding:"14px 16px",marginBottom:14,border:"1px solid #E5E7EB"}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-start",marginBottom:8}}>
            <div style={{flexShrink:0}}>
              <label style={lbl()}>날짜</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...inp(),width:148}}/>
            </div>
            <div style={{flexShrink:0}}>
              <label style={lbl()}>구분</label>
              <select value={cat} onChange={e=>setCat(e.target.value)} style={{...inp(),width:120}}>
                {schedCats.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{flex:1,minWidth:200}}>
              <label style={lbl()}>주요내용 *</label>
              <input value={text} onChange={e=>setText(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&e.ctrlKey&&add()}
                placeholder="예: 변경계약 4차 완료" style={inp()}/>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
            <div style={{flex:1}}>
              <label style={lbl()}>메모 (선택)</label>
              <input value={memo} onChange={e=>setMemo(e.target.value)}
                placeholder="추가 메모, 참고사항 등" style={inp()}/>
            </div>
            <button onClick={add} style={{...btn(C.navyM),padding:"10px 18px",flexShrink:0}}>+ 추가</button>
          </div>
          <div style={{fontSize:11,color:C.gray,marginTop:6}}>Ctrl+Enter로도 추가 가능</div>
        </div>
      )}

      {/* 필터 */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
        <button onClick={()=>setFilter("")} style={{...btn(filter?"#F3F4F6":""+C.navyM,filter?"#374151":"#fff"),padding:"5px 12px",fontSize:12,borderRadius:20}}>전체</button>
        {schedCats.map(c=>(
          <button key={c} onClick={()=>setFilter(f=>f===c?"":c)}
            style={{...btn(filter===c?getColor(c):C.grayL,filter===c?"#fff":C.gray),padding:"5px 12px",fontSize:12,borderRadius:20}}>
            {c}
          </button>
        ))}
      </div>

      {/* 타임라인 */}
      {filtered.length===0
        ? <div style={{padding:"24px",textAlign:"center",color:C.gray,fontSize:13}}>등록된 일정이 없습니다.</div>
        : <div style={{position:"relative"}}>
            <div style={{position:"absolute",left:120,top:0,bottom:0,width:2,background:"#E5E7EB"}}/>
            {filtered.slice().reverse().map(e=>(
              <div key={e.id} style={{display:"flex",gap:14,marginBottom:12,alignItems:"flex-start"}}>
                {/* 날짜 */}
                <div style={{width:112,flexShrink:0,textAlign:"right",paddingTop:4}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#111827"}}>{e.date}</div>
                </div>
                {/* 도트 */}
                <div style={{width:12,height:12,borderRadius:"50%",background:getColor(e.category),flexShrink:0,marginTop:4,zIndex:1,border:"2px solid #fff",boxShadow:`0 0 0 2px ${getColor(e.category)}`}}/>
                {/* 카드 */}
                <div style={{flex:1,background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"11px 14px",boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
                  {editId===e.id
                    ? <div>
                        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
                          <input type="date" value={editDraft.date} onChange={ev=>setED(p=>({...p,date:ev.target.value}))} style={{...inp(),width:148}}/>
                          <select value={editDraft.cat} onChange={ev=>setED(p=>({...p,cat:ev.target.value}))} style={{...inp(),width:120}}>
                            {schedCats.map(c=><option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:8}}>
                          <div>
                            <label style={lbl()}>주요내용</label>
                            <input value={editDraft.text} onChange={ev=>setED(p=>({...p,text:ev.target.value}))} style={inp()}/>
                          </div>
                          <div>
                            <label style={lbl()}>메모</label>
                            <input value={editDraft.memo||""} onChange={ev=>setED(p=>({...p,memo:ev.target.value}))} placeholder="메모" style={inp()}/>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={saveEdit} style={{...btn(C.green),padding:"5px 12px",fontSize:12}}>저장</button>
                          <button onClick={()=>setEditId(null)} style={{...btn(C.grayL,C.gray),padding:"5px 12px",fontSize:12}}>취소</button>
                        </div>
                      </div>
                    : <>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:e.memo?6:0,flexWrap:"wrap"}}>
                          <span style={{...badge(getColor(e.category)+"22",getColor(e.category)),fontSize:11}}>{e.category}</span>
                          <span style={{fontSize:14,fontWeight:700,color:"#111827",flex:1}}>{e.content}</span>
                          <div style={{display:"flex",gap:5,marginLeft:"auto"}}>
                            {canWrite&&<button onClick={()=>startEdit(e)} style={{...btn(C.navyL,C.navyM),padding:"3px 9px",fontSize:12}}>수정</button>}
                            {canWrite&&<button onClick={()=>del(e.id)} style={{...btn(C.redL,C.red),padding:"3px 9px",fontSize:12}}>삭제</button>}
                          </div>
                        </div>
                        {e.memo&&<div style={{fontSize:13,color:"#6B7280",background:"#F8FAFC",borderRadius:8,padding:"6px 10px",marginBottom:4}}>
                          📝 {e.memo}
                        </div>}
                        <div style={{fontSize:11,color:"#9CA3AF",marginTop:4}}>
                          {e.createdBy&&`등록: ${e.createdBy} `}{fDT(e.createdAt)}
                          {e.updatedAt!==e.createdAt&&` · 수정: ${e.updatedBy||""} ${fDT(e.updatedAt)}`}
                        </div>
                      </>
                  }
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 2) 설계진행현황 (단계별) — 단계 추가/수정/삭제/순서변경 가능
// ══════════════════════════════════════════════════════════════
function StagesSection({wr, save, canWrite, proj}) {
  const stagesDef = wr.stagesDef || DEFAULT_DESIGN_STAGES
  const stages    = wr.stages || {}
  const [editStage, setEditStage]   = useState(null)
  const [draft, setDraft]           = useState({})
  const [editingDef, setEditingDef] = useState(false)
  const [defDraft, setDefDraft]     = useState(null)

  // 단계정의 편집 시작/저장/취소
  const startDefEdit = () => { setDefDraft(stagesDef.map(s=>({...s}))); setEditingDef(true) }
  const saveDefEdit  = () => { save({stagesDef: defDraft}); setEditingDef(false) }
  const cancelDefEdit= () => setEditingDef(false)
  const addStage = () => {
    const idx = defDraft.length
    setDefDraft(p=>[...p,{id:`stage_${Date.now()}`,label:"새 단계",color:STAGE_COLORS[idx%STAGE_COLORS.length]}])
  }
  const removeStage = i => setDefDraft(p=>p.filter((_,ri)=>ri!==i))
  const moveStage = (i,dir) => setDefDraft(p=>{ const a=[...p]; const j=i+dir; if(j<0||j>=a.length) return a; [a[i],a[j]]=[a[j],a[i]]; return a })
  const updateStageDef = (i,k,v) => setDefDraft(p=>p.map((s,ri)=>ri===i?{...s,[k]:v}:s))

  // 기성/매출 연동: cashflowPlan에서 실적 합산
  const totalServiceFee = proj.serviceFee || 0
  const totalActual = (proj.cashflowPlan||[]).reduce((s,e)=>s+(e.actual||0),0)   // 억원
  const achieveRate = totalServiceFee>0 ? (totalActual*1e8/totalServiceFee*100) : 0

  const startEdit = stageId => {
    setEditStage(stageId)
    setDraft({...{startDate:"",endDate:"",progress:0,currentNote:""},...stages[stageId]})
  }
  const saveSt = ()=>{
    save({stages:{...stages,[editStage]:{...draft,updatedAt:now()}}})
    setEditStage(null)
  }

  return (
    <div>
      {/* 전체 진행률 개요 */}
      <div style={{...card(),background:C.navyL,padding:"16px 20px",marginBottom:12}}>
        <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,color:C.navyM,fontWeight:600,marginBottom:2}}>용역비 (VAT 별도)</div>
            <div style={{fontSize:22,fontWeight:800,color:C.navy}}>{(totalServiceFee/1e8).toFixed(2)}억</div>
          </div>
          <div>
            <div style={{fontSize:11,color:C.green,fontWeight:600,marginBottom:2}}>누계 입금기성 (cashflowPlan 합산)</div>
            <div style={{fontSize:22,fontWeight:800,color:C.green}}>{totalActual.toFixed(2)}억</div>
          </div>
          <div>
            <div style={{fontSize:11,color:C.amber,fontWeight:600,marginBottom:2}}>기성률</div>
            <div style={{fontSize:22,fontWeight:800,color:C.amber}}>{achieveRate.toFixed(1)}%</div>
          </div>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:11,color:C.navy,fontWeight:600,marginBottom:4}}>전체 진행 바</div>
            <div style={{height:10,background:"rgba(12,68,124,.15)",borderRadius:5,overflow:"hidden"}}>
              <div style={{width:`${Math.min(achieveRate,100).toFixed(1)}%`,height:"100%",background:C.navyM,borderRadius:5,transition:"width .4s"}}/>
            </div>
          </div>
        </div>
        <div style={{fontSize:11,color:C.navyM,marginTop:8}}>※ 누계 입금기성은 "프로젝트 정보 → 연도별 월수금계획" 입금실적 합산값입니다.</div>
      </div>

      {/* 단계정의 관리 버튼 */}
      {canWrite && !editingDef && (
        <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
          <button onClick={startDefEdit} style={{...btn(C.navyL,C.navyM),padding:"6px 14px",fontSize:12}}>⚙ 설계단계 추가·수정·삭제</button>
          <span style={{fontSize:11,color:C.gray}}>{stagesDef.length}단계 · 클릭해서 단계명 변경, 추가, 삭제</span>
        </div>
      )}

      {/* 단계정의 편집 패널 */}
      {editingDef && defDraft && (
        <div style={{...card(),border:`1.5px solid ${C.navyM}`,marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:12,color:C.navyM}}>⚙ 설계단계 구성 편집</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
            {defDraft.map((s,i)=>(
              <div key={s.id} style={{display:"flex",gap:8,alignItems:"center"}}>
                <div style={{display:"flex",flexDirection:"column",gap:2}}>
                  <button onClick={()=>moveStage(i,-1)} disabled={i===0} style={{...btn(C.navyL,C.navyM),padding:"2px 6px",fontSize:10,opacity:i===0?.4:1}}>▲</button>
                  <button onClick={()=>moveStage(i,1)} disabled={i===defDraft.length-1} style={{...btn(C.navyL,C.navyM),padding:"2px 6px",fontSize:10,opacity:i===defDraft.length-1?.4:1}}>▼</button>
                </div>
                <div style={{width:18,height:18,borderRadius:4,background:s.color,flexShrink:0,border:"2px solid rgba(0,0,0,.1)"}}/>
                <input value={s.label} onChange={e=>updateStageDef(i,"label",e.target.value)}
                  style={{...inp(140),fontWeight:600}} placeholder="단계명"/>
                <input type="color" value={s.color} onChange={e=>updateStageDef(i,"color",e.target.value)}
                  style={{width:36,height:32,padding:2,border:"1px solid #ccc",borderRadius:6,cursor:"pointer"}}/>
                <button onClick={()=>removeStage(i)} style={{...btn(C.redL,C.red),padding:"4px 10px",fontSize:12}}>삭제</button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={addStage} style={{...btn(C.green),padding:"6px 14px",fontSize:12}}>+ 단계 추가</button>
            <button onClick={saveDefEdit} style={{...btn(C.navyM),padding:"6px 14px",fontSize:12}}>✓ 저장</button>
            <button onClick={cancelDefEdit} style={{...btn(C.grayL,C.gray),padding:"6px 14px",fontSize:12}}>취소</button>
          </div>
        </div>
      )}

      {/* 단계별 카드 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:12}}>
        {stagesDef.map(stage=>{
          const st = stages[stage.id] || {}
          const prog = st.progress||0
          return (
            <div key={stage.id} style={{...card(),marginBottom:0,borderLeft:`4px solid ${stage.color}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:14,fontWeight:700,color:stage.color}}>{stage.label}</span>
                {canWrite&&<button onClick={()=>startEdit(stage.id)} style={{...btn(C.grayL,C.gray),padding:"4px 10px",fontSize:11}}>편집</button>}
              </div>

              {editStage===stage.id
                ? <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div><label style={lbl()}>시작일</label><input type="date" value={draft.startDate||""} onChange={e=>setDraft(p=>({...p,startDate:e.target.value}))} style={inp()}/></div>
                      <div><label style={lbl()}>종료일</label><input type="date" value={draft.endDate||""} onChange={e=>setDraft(p=>({...p,endDate:e.target.value}))} style={inp()}/></div>
                    </div>
                    <div>
                      <label style={lbl()}>진행률 {draft.progress||0}%</label>
                      <input type="range" min={0} max={100} step={5} value={draft.progress||0} onChange={e=>setDraft(p=>({...p,progress:+e.target.value}))} style={{width:"100%",accentColor:stage.color}}/>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.gray}}><span>0%</span><span>50%</span><span>100%</span></div>
                    </div>
                    <div>
                      <label style={lbl()}>현재일정 메모</label>
                      <textarea value={draft.currentNote||""} onChange={e=>setDraft(p=>({...p,currentNote:e.target.value}))} rows={2} style={{...inp(),resize:"vertical"}} placeholder="예: 실시설계 도서 작성중"/>
                    </div>
                    <div style={{display:"flex",gap:7}}>
                      <button onClick={saveSt} style={{...btn(C.green),padding:"6px 14px",fontSize:12}}>저장</button>
                      <button onClick={()=>setEditStage(null)} style={{...btn(C.grayL,C.gray),padding:"6px 14px",fontSize:12}}>취소</button>
                    </div>
                  </div>
                : <>
                    <div style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.gray,marginBottom:3}}>
                        <span>{st.startDate||"미정"} ~ {st.endDate||"미정"}</span>
                        <span style={{fontWeight:700,color:stage.color}}>{prog}%</span>
                      </div>
                      <div style={{height:8,background:"var(--color-border-tertiary,#eee)",borderRadius:4,overflow:"hidden"}}>
                        <div style={{width:`${prog}%`,height:"100%",background:stage.color,borderRadius:4,transition:"width .3s"}}/>
                      </div>
                    </div>
                    {st.currentNote&&<div style={{fontSize:12,color:"var(--color-text-primary)",background:"var(--color-background-secondary,#f8f8f6)",borderRadius:7,padding:"7px 10px",marginBottom:6}}>{st.currentNote}</div>}
                    {st.updatedAt&&<div style={{fontSize:10.5,color:C.gray}}>수정: {fDT(st.updatedAt)}</div>}
                  </>
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 3) AGENDA — 주차별 안건 관리
// ══════════════════════════════════════════════════════════════
function AgendaSection({wr, save, canWrite}) {
  const agendas = wr.agendas || []
  const [selWeek, setSelWeek] = useState(getWeek)
  const [newItem, setNewItem] = useState("")
  const [editAg, setEditAg]   = useState(null)   // {agIdx, itemIdx, text}
  const [showAll, setShowAll] = useState(false)

  const thisAg = agendas.find(a=>a.week===selWeek)
  const items  = thisAg?.items || []

  const ensureWeek = ()=>{
    if(!thisAg) {
      const ag={id:`AG${Date.now()}`,week:selWeek,items:[],createdAt:now(),updatedAt:now()}
      save({agendas:[...agendas,ag].sort((a,b)=>b.week.localeCompare(a.week))})
      return false  // 아직 생성 안 됨 — 다음 호출에서
    }
    return true
  }

  const addItem = ()=>{
    const t=newItem.trim(); if(!t) return
    const item={id:`AI${Date.now()}`,text:t,done:false,createdAt:now(),updatedAt:now()}
    if(thisAg){
      save({agendas:agendas.map(a=>a.week===selWeek?{...a,items:[...a.items,item],updatedAt:now()}:a)})
    } else {
      const ag={id:`AG${Date.now()}`,week:selWeek,items:[item],createdAt:now(),updatedAt:now()}
      save({agendas:[...agendas,ag].sort((a,b)=>b.week.localeCompare(a.week))})
    }
    setNewItem("")
  }

  const toggleDone = (itemId)=>{
    save({agendas:agendas.map(a=>a.week===selWeek?{...a,items:a.items.map(i=>i.id===itemId?{...i,done:!i.done,updatedAt:now()}:i),updatedAt:now()}:a)})
  }
  const delItem = (itemId)=>{
    save({agendas:agendas.map(a=>a.week===selWeek?{...a,items:a.items.filter(i=>i.id!==itemId),updatedAt:now()}:a)})
  }
  const saveEditItem = ()=>{
    const {agWeek,itemId,text}=editAg
    save({agendas:agendas.map(a=>a.week===agWeek?{...a,items:a.items.map(i=>i.id===itemId?{...i,text,updatedAt:now()}:i),updatedAt:now()}:a)})
    setEditAg(null)
  }

  // 모든 주차 목록 (선택용)
  const allWeeks = [...new Set([...agendas.map(a=>a.week), selWeek])].sort().reverse()

  return (
    <div>
      {/* 주차 선택 */}
      <div style={{...card(),padding:"12px 16px",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        <span style={{fontSize:13,fontWeight:700,color:C.navy}}>주차 선택:</span>
        <input type="week" value={selWeek} onChange={e=>setSelWeek(e.target.value)} style={inp(180)}/>
        <button onClick={()=>setSelWeek(getWeek())} style={{...btn(C.navyL,C.navyM),padding:"5px 12px",fontSize:12}}>이번 주</button>
        <button onClick={()=>setShowAll(v=>!v)} style={{...btn(C.grayL,C.gray),padding:"5px 12px",fontSize:12}}>{showAll?"현재 주차만":"전체 주차 보기"}</button>
      </div>

      {/* 현재 주차 AGENDA */}
      <div style={card()}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:700}}>{selWeek} 주간 AGENDA</div>
          <span style={{...badge(C.navyL,C.navyM),fontSize:12}}>{items.length}건</span>
          <span style={{...badge(items.filter(i=>i.done).length===items.length&&items.length>0?C.greenL:C.amberL,items.filter(i=>i.done).length===items.length&&items.length>0?C.green:C.amber),fontSize:12}}>
            완료 {items.filter(i=>i.done).length}/{items.length}
          </span>
        </div>

        {canWrite&&(
          <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"flex-end"}}>
            <textarea value={newItem} onChange={e=>setNewItem(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();addItem()} }}
              placeholder={"새 안건 입력 (Ctrl+Enter로 추가)\n여러 줄로 자유롭게 작성하세요."} rows={3}
              style={{...inp(),flex:1,resize:"vertical",lineHeight:1.6,minHeight:72}}/>
            <button onClick={addItem} style={{...btn(C.navyM),padding:"10px 16px",alignSelf:"flex-end"}}>+ 추가</button>
          </div>
        )}

        {items.length===0
          ? <div style={{padding:"20px",textAlign:"center",color:C.gray,fontSize:13}}>이번 주 AGENDA가 없습니다.{canWrite?" 위에서 추가해주세요.":""}</div>
          : <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {items.map((item,idx)=>(
                <div key={item.id} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 13px",borderRadius:9,background:item.done?"var(--color-background-secondary,#f0f0ee)":"var(--color-background-primary,#fff)",border:`0.5px solid ${item.done?C.green+"44":"var(--color-border-tertiary,#eee)"}`,opacity:item.done?.75:1}}>
                  <span style={{fontSize:14,fontWeight:700,color:C.navy,flexShrink:0,paddingTop:1}}>{idx+1}.</span>
                  {canWrite&&<input type="checkbox" checked={item.done} onChange={()=>toggleDone(item.id)} style={{marginTop:3,accentColor:C.green,cursor:"pointer",flexShrink:0}}/>}
                  {editAg?.itemId===item.id
                    ? <div style={{flex:1,display:"flex",flexDirection:"column",gap:7}}>
                        <textarea value={editAg.text} onChange={e=>setEditAg(p=>({...p,text:e.target.value}))}
                          onKeyDown={e=>{ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();saveEditItem()} }}
                          rows={3} style={{...inp(),resize:"vertical",whiteSpace:"pre-wrap",lineHeight:1.6}}/>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={saveEditItem} style={{...btn(C.green),padding:"4px 10px",fontSize:11}}>저장</button>
                          <button onClick={()=>setEditAg(null)} style={{...btn(C.grayL,C.gray),padding:"4px 10px",fontSize:11}}>취소</button>
                          <span style={{fontSize:10,color:C.gray,alignSelf:"center"}}>Ctrl+Enter로 저장</span>
                        </div>
                      </div>
                    : <div style={{flex:1}}>
                        <div style={{fontSize:13.5,fontWeight:500,textDecoration:item.done?"line-through":"none",color:item.done?C.gray:"var(--color-text-primary)",whiteSpace:"pre-wrap",lineHeight:1.7}}>{item.text}</div>
                        <div style={{fontSize:10.5,color:C.gray,marginTop:2}}>
                          등록: {fDT(item.createdAt)}{item.updatedAt!==item.createdAt?` · 수정: ${fDT(item.updatedAt)}`:""}
                        </div>
                      </div>
                  }
                  {canWrite&&editAg?.itemId!==item.id&&(
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      <button onClick={()=>setEditAg({agWeek:selWeek,itemId:item.id,text:item.text})} style={{...btn(C.navyL,C.navyM),padding:"3px 8px",fontSize:11}}>수정</button>
                      <button onClick={()=>delItem(item.id)} style={{...btn(C.redL,C.red),padding:"3px 8px",fontSize:11}}>삭제</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
        }
        {thisAg?.updatedAt&&<div style={{fontSize:10.5,color:C.gray,marginTop:8}}>최종 수정: {fDT(thisAg.updatedAt)}</div>}
      </div>

      {/* 전체 주차 이력 */}
      {showAll && agendas.length>0 && (
        <div style={card()}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>📋 전체 주차 AGENDA 이력</div>
          {agendas.map(ag=>(
            <div key={ag.id} style={{marginBottom:16,borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",paddingBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <button onClick={()=>{setSelWeek(ag.week);setShowAll(false)}} style={{...btn(C.navyL,C.navyM),padding:"3px 10px",fontSize:12}}>{ag.week}</button>
                <span style={{fontSize:12,color:C.gray}}>안건 {ag.items.length}건 · 완료 {ag.items.filter(i=>i.done).length}건</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                {ag.items.map((item,idx)=>(
                  <div key={item.id} style={{display:"flex",gap:8,fontSize:13,color:item.done?C.gray:"var(--color-text-primary)",textDecoration:item.done?"line-through":"none"}}>
                    <span style={{color:C.navyM,fontWeight:700,flexShrink:0}}>{idx+1}.</span>
                    <span style={{whiteSpace:"pre-wrap",lineHeight:1.6}}>{item.text}</span>
                    {item.done&&<span style={{...badge(C.greenL,C.green),fontSize:10,flexShrink:0}}>완료</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 4) 담당자 관리
// ══════════════════════════════════════════════════════════════
const ORG_TYPES = ["발주처","로컬사(건축사무소)","시공사","감리사","협력업체","기타"]

function ContactsSection({wr, save, canWrite}) {
  const contacts = wr.contacts || []
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft]       = useState(null)
  const [editId, setEditId]     = useState(null)
  const [filterType, setFilterType] = useState("")
  const [search, setSearch]     = useState("")

  const empty = {org:"",orgType:"발주처",name:"",title:"",phone:"",email:"",note:""}

  const openNew  = ()=>{ setDraft({...empty}); setEditId(null); setShowForm(true) }
  const openEdit = c=>{ setDraft({...c}); setEditId(c.id); setShowForm(true) }

  const saveContact = ()=>{
    if(!draft.name.trim()&&!draft.org.trim()) return
    if(editId){
      save({contacts:contacts.map(c=>c.id===editId?{...c,...draft,updatedAt:now()}:c)})
    } else {
      save({contacts:[...contacts,{...draft,id:`CT${Date.now()}`,createdAt:now(),updatedAt:now()}]})
    }
    setShowForm(false); setDraft(null); setEditId(null)
  }
  const del = id=>{ if(window.confirm("이 담당자 정보를 삭제하시겠습니까?")) save({contacts:contacts.filter(c=>c.id!==id)}) }

  const filtered = contacts.filter(c=>{
    const matchType = !filterType||c.orgType===filterType
    const matchSearch = !search||c.name.includes(search)||c.org.includes(search)||c.phone?.includes(search)
    return matchType&&matchSearch
  })

  const typeColor={발주처:C.navyM,"로컬사(건축사무소)":C.green,시공사:C.amber,감리사:"#534AB7",협력업체:C.red,기타:C.gray}

  return (
    <div>
      {/* 검색/필터 */}
      <div style={{...card(),padding:"12px 16px",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름·기관·연락처 검색" style={inp(200)}/>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={inp(160)}>
          <option value="">전체 구분</option>
          {ORG_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        {canWrite&&<button onClick={openNew} style={{...btn(C.navyM),marginLeft:"auto"}}>+ 담당자 추가</button>}
      </div>

      {/* 입력/수정 폼 */}
      {showForm&&draft&&(
        <div style={{...card(),borderLeft:`4px solid ${C.navyM}`,marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>{editId?"담당자 수정":"새 담당자 등록"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>
            <div>
              <label style={lbl()}>구분</label>
              <select value={draft.orgType} onChange={e=>setDraft(p=>({...p,orgType:e.target.value}))} style={inp()}>
                {ORG_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{gridColumn:"span 2"}}>
              <label style={lbl()}>기관/회사명</label>
              <input value={draft.org} onChange={e=>setDraft(p=>({...p,org:e.target.value}))} placeholder="예: (주)와이즈피앤디" style={inp()}/>
            </div>
            <div><label style={lbl()}>성명</label><input value={draft.name} onChange={e=>setDraft(p=>({...p,name:e.target.value}))} placeholder="홍길동" style={inp()}/></div>
            <div><label style={lbl()}>직위/직책</label><input value={draft.title} onChange={e=>setDraft(p=>({...p,title:e.target.value}))} placeholder="대표, 팀장, 과장 등" style={inp()}/></div>
            <div><label style={lbl()}>연락처</label><input value={draft.phone} onChange={e=>setDraft(p=>({...p,phone:e.target.value}))} placeholder="010-0000-0000" style={inp()}/></div>
            <div><label style={lbl()}>이메일</label><input value={draft.email} onChange={e=>setDraft(p=>({...p,email:e.target.value}))} placeholder="email@example.com" style={inp()}/></div>
            <div style={{gridColumn:"span 2"}}><label style={lbl()}>메모</label><input value={draft.note} onChange={e=>setDraft(p=>({...p,note:e.target.value}))} placeholder="추가 메모" style={inp()}/></div>
          </div>
          <div style={{display:"flex",gap:7}}>
            <button onClick={saveContact} style={btn(C.navyM)}>저장</button>
            <button onClick={()=>{setShowForm(false);setDraft(null);setEditId(null)}} style={btn(C.grayL,C.gray)}>취소</button>
          </div>
        </div>
      )}

      {/* 담당자 목록 */}
      {filtered.length===0
        ? <div style={{...card(),padding:"30px",textAlign:"center",color:C.gray,fontSize:13}}>등록된 담당자가 없습니다.{canWrite?" \"+ 담당자 추가\"로 등록하세요.":""}</div>
        : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:10}}>
            {filtered.map(c=>(
              <div key={c.id} style={{...card(),marginBottom:0,borderLeft:`4px solid ${typeColor[c.orgType]||C.gray}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div>
                    <span style={badge(typeColor[c.orgType]+"22",typeColor[c.orgType]||C.gray)}>{c.orgType}</span>
                    {c.org&&<div style={{fontSize:12,color:C.gray,marginTop:3}}>{c.org}</div>}
                  </div>
                  {canWrite&&<div style={{display:"flex",gap:4}}>
                    <button onClick={()=>openEdit(c)} style={{...btn(C.navyL,C.navyM),padding:"3px 8px",fontSize:11}}>수정</button>
                    <button onClick={()=>del(c.id)} style={{...btn(C.redL,C.red),padding:"3px 8px",fontSize:11}}>삭제</button>
                  </div>}
                </div>
                <div style={{fontSize:15,fontWeight:700,color:"var(--color-text-primary)",marginBottom:2}}>{c.name}{c.title&&<span style={{fontSize:12,fontWeight:400,color:C.gray,marginLeft:6}}>{c.title}</span>}</div>
                {c.phone&&<div style={{fontSize:13,color:C.navyM,fontWeight:600,marginBottom:1}}>📞 {c.phone}</div>}
                {c.email&&<div style={{fontSize:12,color:C.green}}>✉ {c.email}</div>}
                {c.note&&<div style={{fontSize:12,color:C.gray,marginTop:5,padding:"5px 8px",background:"var(--color-background-secondary,#f8f8f6)",borderRadius:6}}>{c.note}</div>}
                <div style={{fontSize:10.5,color:C.gray,marginTop:6}}>
                  등록: {fDT(c.createdAt)}{c.updatedAt!==c.createdAt?` · 수정: ${fDT(c.updatedAt)}`:""}
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}
