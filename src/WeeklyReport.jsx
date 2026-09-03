// ══════════════════════════════════════════════════════════════
// 📋 주간보고 탭
// 프로젝트별 : 주요일정 로그 / 설계단계 진행현황 / 주간 AGENDA / 담당자
// 모든 데이터는 project.weeklyReport 객체에 영속 저장
// ══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react"

// ── 색상·스타일 헬퍼 ──────────────────────────────────────────
const C = {
  navy:"#0C447C",navyM:"#0B6E63",navyL:"#E6F1FB",
  green:"#1D9E75",greenL:"#EAF3DE",
  amber:"#BA7517",amberL:"#FAEEDA",
  red:"#A32D2D",  redL:"#FCEBEB",
  gray:"#888780", grayL:"#F1EFE8",
}
const card  = (x={})=>({background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:14,padding:"18px 22px",marginBottom:16,...x})
const th    = (a="left")=>({padding:"9px 12px",textAlign:a,fontSize:13.2,fontWeight:600,color:"var(--color-text-secondary,#888)",background:"var(--color-background-secondary,#f8f8f6)",borderBottom:"1px solid var(--color-border-tertiary,#eee)",whiteSpace:"nowrap"})
const td    = (a="left")=>({padding:"8px 12px",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",textAlign:a,fontSize:14.3,verticalAlign:"top"})
const inp   = (w="100%")=>({width:w,padding:"7px 9px",border:"1px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:14.3,fontFamily:"inherit",background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)",boxSizing:"border-box"})
const btn   = (bg=C.navyM,fg="#fff")=>({padding:"7px 14px",background:bg,color:fg,border:"none",borderRadius:9,fontSize:14.3,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5})
const lbl   = ()=>({display:"block",fontSize:12,color:C.gray,fontWeight:600,marginBottom:3})
const badge = (bg,fg)=>({display:"inline-flex",padding:"2px 9px",borderRadius:9,fontSize:12,fontWeight:700,background:bg,color:fg})

const now = ()=>new Date().toISOString()
const fDate = iso=>iso?iso.slice(0,10):""
const fDT   = iso=>{ if(!iso) return "-"; const d=new Date(iso); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}` }
const getWeek = ()=>{ const d=new Date(); const start=new Date(d.getFullYear(),0,1); const w=Math.ceil(((d-start)/86400000+start.getDay()+1)/7); return `${d.getFullYear()}-W${String(w).padStart(2,"0")}` }

// ── 설계 단계 기본값(DEFAULT_DESIGN_STAGES)·유틸 함수는 파일 하단(WeeklyReportTab 앞)에 정의됨 ──

// ── 일정 카테고리 기본값 ──────────────────────────────────────────
export const DEFAULT_SCHED_CATS = [
  "설계", "회의", "심의·인허가", "현장", "행정", "기타"
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

// ══════════════════════════════════════════════════════════════
// 🔗 프로젝트 필드 ↔ 주요일정 자동 연동 유틸
// "계약일"/"수주일"처럼 프로젝트 상세정보와 주요일정에 같은 정보가 양쪽에 입력될 수 있는 값은
// 한쪽만 입력해도 서로 채워지도록 한다. 값이 서로 다르면(충돌) 자동으로 덮어쓰지 않고
// 호출부(화면)에서 사용자에게 확인을 받는다.
// ══════════════════════════════════════════════════════════════
export const FIELD_SYNC_RULES = [
  {field:"contractDate", label:"계약일", sourceKey:"field:contractDate",
    keywords:["계약체결","용역계약체결","설계계약","도급계약","계약 체결","계약일"]},
  {field:"orderDate", label:"수주일", sourceKey:"field:orderDate",
    keywords:["수주","낙찰","심사 및 당선","당선","선정"]},
]

// 주요일정의 구분/내용 텍스트가 위 연동 필드 중 하나와 관련 있어 보이면 그 규칙을 반환
export function matchFieldSyncRule(text){
  const t = (text||"")
  return FIELD_SYNC_RULES.find(r=>r.keywords.some(k=>t.includes(k))) || null
}

// scheduleLog에 항목을 추가하거나(중복이면 무시) 갱신한다(sourceKey 기준).
// - sourceKey가 있으면: 같은 sourceKey를 가진 기존 항목을 "그 하나만" 갱신 — 계약일처럼
//   한 프로젝트에 값이 하나여야 하는 정보가 중복 생성되는 것을 막는다.
// - sourceKey가 없으면: 날짜+구분+내용이 완전히 같은 항목이 이미 있는지 확인해 완전중복만 걸러낸다.
export function upsertScheduleEntry(scheduleLog, entry, byName){
  const log = scheduleLog || []
  const now2 = new Date().toISOString()
  if(entry.sourceKey){
    const idx = log.findIndex(e=>e.sourceKey===entry.sourceKey)
    if(idx>=0){
      const cur = log[idx]
      if(cur.date===entry.date && cur.category===entry.category && cur.content===entry.content) return log
      const next=[...log]
      next[idx] = {...cur, date:entry.date, category:entry.category, content:entry.content, memo:entry.memo??cur.memo, updatedAt:now2, updatedBy:byName}
      return next.sort((a,b)=>a.date.localeCompare(b.date))
    }
  }
  const dup = log.some(e=>e.date===entry.date && e.category===entry.category && e.content===entry.content)
  if(dup) return log
  const newEntry = {
    id:`SL${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    date:entry.date, category:entry.category, content:entry.content, memo:entry.memo||"",
    sourceKey:entry.sourceKey||"", createdAt:now2, updatedAt:now2, createdBy:byName,
  }
  return [...log, newEntry].sort((a,b)=>a.date.localeCompare(b.date))
}

// sourceKey가 특정 접두어로 시작하는 항목 전부 제거 — 예: 실행계획서 삭제 시 연동된 일정도 같이 제거
export function removeScheduleEntriesBySourcePrefix(scheduleLog, prefix){
  return (scheduleLog||[]).filter(e=>!(e.sourceKey||"").startsWith(prefix))
}
export function findScheduleEntriesBySourcePrefix(scheduleLog, prefix){
  return (scheduleLog||[]).filter(e=>(e.sourceKey||"").startsWith(prefix))
}
// 비슷한 항목(같은 날짜 + 구분/내용이 유사)이 이미 있는지 검사 — 수동입력·붙여넣기 중복 방지용 경고에 사용
export function findSimilarScheduleEntry(scheduleLog, {date, category, content}){
  const norm = s => (s||"").replace(/\s|\(.*?\)/g,"").toLowerCase()
  return (scheduleLog||[]).find(e=>
    e.date===date && (norm(e.category)===norm(category) || norm(e.content)===norm(content))
  )
}

// ─────────────────────────────────────────────────────────────
export const DEFAULT_DESIGN_STAGES = [
  {id:"contract",  label:"계약시",   color:C.navyM},
  {id:"review",    label:"심의",     color:C.amber},
  {id:"permit",    label:"인허가",   color:C.green},
  {id:"impl",      label:"실시설계", color:"#0E9C8C"},
  {id:"site",      label:"현장관리", color:C.red},
]
const STAGE_COLORS = [C.navyM, C.amber, C.green, "#0E9C8C", C.red, "#D85A30", "#7C5295", "#2E86AB"]

// ── 설계진행현황 날짜 계산 유틸 — WeeklyReport·DeptReport 양쪽에서 공용으로 사용 ──
// 일수(day count) 계산
export function daysBetween(startStr, endStr) {
  if(!startStr || !endStr) return null
  const s = new Date(startStr), e = new Date(endStr)
  return Math.round((e-s)/86400000)
}
// 단계 하나의 진행률(%) — 오늘 날짜가 시작일 이전이면 0%, 종료일 이후면 100%, 그 사이면 일수 비례
export function calcStageProgress(startStr, endStr, todayStr) {
  if(!startStr || !endStr) return 0
  const today = new Date(todayStr || new Date().toISOString().slice(0,10))
  const s = new Date(startStr), e = new Date(endStr)
  if(today<=s) return 0
  if(today>=e) return 100
  return Math.round((today-s)/(e-s)*100)
}
// 전체 단계(stagesDef+stages)를 하나의 타임라인(100%)으로 보고, 오늘이 몇 %/어느 단계에 와 있는지 계산
export function calcOverallProgress(stagesDef, stages, todayStr) {
  const withDates = stagesDef.map(s=>({...s, ...(stages[s.id]||{})})).filter(s=>s.startDate && s.endDate)
  if(withDates.length===0) return {pct:0, currentStageId:null, overallStart:null, overallEnd:null}
  const overallStart = withDates.reduce((mn,s)=>s.startDate<mn?s.startDate:mn, withDates[0].startDate)
  const overallEnd    = withDates.reduce((mx,s)=>s.endDate>mx?s.endDate:mx, withDates[0].endDate)
  const today = todayStr || new Date().toISOString().slice(0,10)
  const pct = calcStageProgress(overallStart, overallEnd, today)
  const current = withDates.find(s=>today>=s.startDate && today<=s.endDate)
  const currentStageId = current ? current.id : (today<overallStart ? withDates[0].id : withDates[withDates.length-1].id)
  return {pct, currentStageId, overallStart, overallEnd}
}

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
            padding:"8px 16px",border:"none",borderRadius:9,fontSize:14.3,fontWeight:700,cursor:"pointer",
            background:sub===s.id?C.navyM:"var(--color-background-secondary,#f0f0ee)",
            color:sub===s.id?"#fff":"var(--color-text-secondary,#777)",
            boxShadow:sub===s.id?"0 2px 8px rgba(12,68,124,.2)":"none",
          }}>{s.label}</button>
        ))}
      </div>

      {sub==="schedule" && <ScheduleLogSection wr={wr} save={save} canWrite={canWrite} proj={proj} setProjects={setProjects} currentUser={currentUser}/>}
      {sub==="stages"   && <StagesSection      wr={wr} save={save} canWrite={canWrite} proj={proj}/>}
      {sub==="agenda"   && <AgendaSection      wr={wr} save={save} canWrite={canWrite}/>}
      {sub==="contacts" && <ContactsSection    wr={wr} save={save} canWrite={canWrite}/>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 1) 주요일정 로그 — 날짜/구분(자유 텍스트)/주요내용/메모 + 일괄 붙여넣기 파싱 + 수정자 기록
// ══════════════════════════════════════════════════════════════

// "▷ 라벨 : 2025.05.06(메모)" 같은 텍스트를 여러 줄 붙여넣으면 자동으로 구분해 항목화한다.
// - 한 줄에 날짜가 여러 개면("2024.11.08(접수) / 2025.01.08(취하)") 각각 별도 항목으로 분리하고,
//   그때만 구분 라벨 뒤에 (접수)/(취하) 같은 태그를 붙여 구분한다.
// - "라벨 :" 로 끝나고 날짜가 없으면, 바로 다음 줄(들)에서 날짜를 찾는다.
// - 날짜가 없는 줄(들여쓰기된 부가설명 등)은 직전 항목의 메모에 이어붙인다.
export function parseBulkSchedule(text) {
  const lines = (text||"").split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0)
  const entries = []
  let pendingLabel = null

  const parseDateSegments = (str) => {
    return str.split("/").map(seg=>seg.trim()).filter(Boolean).map(seg=>{
      const m = seg.match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})\.?/)
      if(!m) return null
      const date = `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`
      const tagM = seg.match(/\(([^)]+)\)/)
      return {date, tag: tagM ? tagM[1] : ""}
    }).filter(Boolean)
  }

  for(const rawLine of lines){
    const isBullet = /^[▷▶]/.test(rawLine)
    if(isBullet){
      const line = rawLine.replace(/^[▷▶]\s*/,"")
      const colonIdx = line.search(/[:：]/)
      if(colonIdx===-1){ pendingLabel = line.trim(); continue }
      const part0 = line.slice(0,colonIdx).trim()
      const part1 = line.slice(colonIdx+1).trim()
      // "라벨 : 날짜"와 "날짜 : 라벨" 두 순서 모두 인식 — 콜론 앞쪽이 날짜형태면 날짜-먼저 순서로 판단
      const looksLikeDate = s => /\d{4}[.\-]\d{1,2}[.\-]\d{1,2}/.test(s)
      let label, rest
      if(looksLikeDate(part0) && !looksLikeDate(part1)){ label = part1; rest = part0 }
      else { label = part0; rest = part1 }
      if(!rest){ pendingLabel = label; continue }
      const segs = parseDateSegments(rest)
      if(segs.length===0){ pendingLabel = label; continue }
      if(segs.length===1){
        entries.push({date:segs[0].date, category:label, content:label, memo:segs[0].tag||""})
      } else {
        segs.forEach(s=>{
          const cat = s.tag ? `${label}(${s.tag})` : label
          entries.push({date:s.date, category:cat, content:cat, memo:""})
        })
      }
      pendingLabel = null
    } else {
      const cleaned = rawLine.replace(/^[-•]\s*/,"")
      const segs = parseDateSegments(cleaned)
      if(segs.length && pendingLabel){
        if(segs.length===1){
          entries.push({date:segs[0].date, category:pendingLabel, content:pendingLabel, memo:segs[0].tag||""})
        } else {
          segs.forEach(s=>{
            const cat = s.tag ? `${pendingLabel}(${s.tag})` : pendingLabel
            entries.push({date:s.date, category:cat, content:cat, memo:""})
          })
        }
        pendingLabel = null
      } else if(!segs.length && entries.length){
        const last = entries[entries.length-1]
        last.memo = last.memo ? `${last.memo} ${cleaned}` : cleaned
      }
    }
  }
  return entries.sort((a,b)=>a.date.localeCompare(b.date))
}

// 자유 텍스트 구분값에 안정적인 색을 부여 (즐겨찾기 프리셋에 있으면 그 색, 없으면 텍스트 해시로 팔레트에서 고정 배정)
const SCHED_PALETTE = [C.navyM, C.amber, C.green, "#0E9C8C", C.red, "#D85A30", "#7C5295", "#2E86AB", "#B45309", "#4B5563"]
function hashColor(str){
  let h=0; for(let i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0
  return SCHED_PALETTE[h%SCHED_PALETTE.length]
}

function ScheduleLogSection({wr, save, canWrite, proj, setProjects, currentUser}) {
  const logs      = wr.scheduleLog || []
  const presets   = wr.schedCats   || DEFAULT_SCHED_CATS

  // 입력 폼 (단건)
  const [date,  setDate]  = useState(fDate(new Date().toISOString()))
  const [cat,   setCat]   = useState("")
  const [text,  setText]  = useState("")
  const [memo,  setMemo]  = useState("")
  const [editId,setEditId]= useState(null)
  const [editDraft,setED] = useState({})
  const [filter,setFilter]= useState("")
  const [sortAsc, setSortAsc] = useState(false) // false=최신순(기본), true=오래된순

  // 자주 쓰는 구분(프리셋) 관리
  const [showCatMgr, setShowCatMgr] = useState(false)
  const [newCat, setNewCat]         = useState("")
  const [editCatIdx, setEditCatIdx] = useState(null)
  const [editCatVal, setEditCatVal] = useState("")

  // 일괄 붙여넣기
  const [showBulk, setShowBulk]     = useState(false)
  const [bulkText, setBulkText]     = useState("")
  const [bulkPreview, setBulkPreview] = useState(null) // 파싱 결과(편집 가능)

  const byName = currentUser?.name || "알 수 없음"

  // 계약일/수주일처럼 프로젝트 상세정보와 연동되는 항목이면, 비어있는 필드는 자동으로 채우고
  // 이미 다른 값이 있으면 사용자에게 확인 후에만 덮어쓴다 (동일 필드에 서로 다른 날짜가 중복 생기지 않도록).
  const trySyncField = (entry) => {
    if(!setProjects || !proj?.id) return
    const rule = matchFieldSyncRule(entry.category) || matchFieldSyncRule(entry.content)
    if(!rule) return
    const curVal = proj[rule.field]
    if(!curVal){
      setProjects(prev=>prev.map(p=>p.id===proj.id?{...p,[rule.field]:entry.date}:p))
    } else if(curVal!==entry.date){
      const ok = window.confirm(
        `"${entry.content}"(${entry.date})가 프로젝트 상세정보의 기존 ${rule.label}(${curVal})과 다릅니다.\n같은 정보라면 ${rule.label}을 ${entry.date}로 업데이트할까요?\n\n(취소하면 방금 입력한 주요일정은 그대로 남고, 프로젝트 ${rule.label}은 변경되지 않습니다)`
      )
      if(ok) setProjects(prev=>prev.map(p=>p.id===proj.id?{...p,[rule.field]:entry.date}:p))
    }
  }

  // 붙여넣기/수동 등록 직전 — 같은 날짜에 유사한 구분/내용이 이미 있으면 확인
  const confirmIfDuplicate = (entry) => {
    const hit = findSimilarScheduleEntry(logs, entry)
    if(!hit) return true
    return window.confirm(`같은 날짜(${entry.date})에 비슷한 항목이 이미 있습니다.\n기존: [${hit.category}] ${hit.content}\n새로 입력: [${entry.category}] ${entry.content}\n\n그래도 추가하시겠습니까?`)
  }

  const add = () => {
    if(!text.trim()) return
    const entry = {
      id:`SL${Date.now()}`, date, category:(cat||"기타").trim(),
      content: text.trim(), memo: memo.trim(),
      createdAt:now(), updatedAt:now(),
      createdBy: byName,
    }
    if(!confirmIfDuplicate(entry)) return
    save({scheduleLog:[...logs,entry].sort((a,b)=>a.date.localeCompare(b.date))})
    trySyncField(entry)
    setText(""); setMemo(""); setCat("")
  }

  const startEdit = e => { setEditId(e.id); setED({date:e.date, cat:e.category, text:e.content, memo:e.memo||""}) }
  const saveEdit  = () => {
    const entry = {date:editDraft.date, category:(editDraft.cat||"기타").trim(), content:editDraft.text, memo:editDraft.memo}
    save({scheduleLog:logs.map(e=>e.id===editId?{...e,
      date:entry.date, category:entry.category,
      content:entry.content, memo:entry.memo,
      updatedAt:now(), updatedBy:byName
    }:e).sort((a,b)=>a.date.localeCompare(b.date))})
    trySyncField(entry)
    setEditId(null)
  }
  const del = id => { if(window.confirm("이 일정 기록을 삭제하시겠습니까?")) save({scheduleLog:logs.filter(e=>e.id!==id)}) }

  // 프리셋(자주 쓰는 구분) CRUD — 목록을 강제하지 않고, 입력을 빠르게 하기 위한 참고용 칩일 뿐
  const addCat    = () => {
    const t=newCat.trim(); if(!t||presets.includes(t)) return
    save({schedCats:[...presets, t]}); setNewCat("")
  }
  const saveCat   = i => {
    const t=editCatVal.trim(); if(!t) return
    const next=[...presets]; next[i]=t
    save({schedCats:next}); setEditCatIdx(null)
  }
  const removeCat = i => {
    if(!window.confirm(`"${presets[i]}" 프리셋을 삭제하시겠습니까? (이미 등록된 일정 기록에는 영향 없습니다)`)) return
    save({schedCats:presets.filter((_,ri)=>ri!==i)})
  }
  const moveCat   = (i,d) => {
    const a=[...presets]; [a[i],a[i+d]]=[a[i+d],a[i]]; save({schedCats:a})
  }

  // 실제 쓰인 구분값 전부 (필터 칩 + 자동완성 후보)
  const usedCats = useMemo(()=>{
    const set = new Set(presets)
    logs.forEach(e=>e.category&&set.add(e.category))
    return [...set]
  },[logs, presets])

  const getColor  = c => {
    const base = { 계약:C.navyM, 심의:C.amber, 인허가:C.green, 착공:"#0E9C8C", 준공:C.green, 변경:C.red, 기타:C.gray }
    if(base[c]) return base[c]
    const hit = Object.keys(base).find(k=>c?.includes(k))
    return hit ? base[hit] : hashColor(c||"")
  }

  const filtered = useMemo(()=>{
    const f = logs.filter(e=>!filter||e.category===filter||e.content?.includes(filter)||e.memo?.includes(filter))
    const sorted = f.slice().sort((a,b)=>a.date.localeCompare(b.date))
    return sortAsc ? sorted : sorted.reverse()
  },[logs, filter, sortAsc])

  const runBulkParse = () => {
    const parsed = parseBulkSchedule(bulkText)
    const withDup = parsed.map(r=>({...r, dupWarning: !!findSimilarScheduleEntry(logs, r)}))
    setBulkPreview(withDup)
  }
  const updateBulkRow = (i, patch) => setBulkPreview(prev=>prev.map((r,ri)=>ri===i?{...r,...patch}:r))
  const removeBulkRow = i => setBulkPreview(prev=>prev.filter((_,ri)=>ri!==i))
  const commitBulk = () => {
    if(!bulkPreview || !bulkPreview.length) return
    const dupCount = bulkPreview.filter(r=>r.dupWarning).length
    if(dupCount>0 && !window.confirm(`중복 의심 항목이 ${dupCount}건 있습니다. 그래도 전체 ${bulkPreview.length}건을 추가하시겠습니까?\n(중복이 걱정되면 취소 후 목록에서 ✕로 해당 행을 먼저 제거하세요)`)) return
    const newEntries = bulkPreview.map((r,i)=>({
      id:`SL${Date.now()}_${i}`, date:r.date, category:(r.category||"기타").trim(),
      content:r.content||r.category, memo:r.memo||"",
      createdAt:now(), updatedAt:now(), createdBy:byName,
    }))
    save({scheduleLog:[...logs, ...newEntries].sort((a,b)=>a.date.localeCompare(b.date))})
    // 계약일/수주일 등 연동 필드는 규칙당 한 번만(처음 매칭되는 항목으로) 동기화 시도
    const doneRules = new Set()
    newEntries.forEach(entry=>{
      const rule = matchFieldSyncRule(entry.category) || matchFieldSyncRule(entry.content)
      if(rule && !doneRules.has(rule.field)){ doneRules.add(rule.field); trySyncField(entry) }
    })
    setBulkText(""); setBulkPreview(null); setShowBulk(false)
  }

  return (
    <div style={card()}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:16.5,fontWeight:700}}>📅 주요일정 기록</div>
        <div style={{display:"flex",gap:6}}>
          {canWrite&&<button onClick={()=>{setShowBulk(v=>!v);setShowCatMgr(false)}} style={{...btn(showBulk?C.navyM:C.navyL,showBulk?"#fff":C.navyM),padding:"5px 12px",fontSize:13.2}}>
            📋 일괄 붙여넣기
          </button>}
          {canWrite&&<button onClick={()=>{setShowCatMgr(v=>!v);setShowBulk(false)}} style={{...btn(C.grayL,C.gray),padding:"5px 12px",fontSize:13.2}}>
            ⭐ 자주 쓰는 구분
          </button>}
        </div>
      </div>
      <div style={{fontSize:13.2,color:C.gray,marginBottom:14}}>
        날짜별 주요 사안을 기록합니다. "구분"은 자유롭게 입력할 수 있으며(예: 변경승인(경미) 완료(1차)), 여러 줄을 한꺼번에 붙여넣으면 자동으로 항목화됩니다. 수정 시 수정자와 일시가 자동 기록됩니다.
      </div>

      {/* 일괄 붙여넣기 패널 */}
      {showBulk && (
        <div style={{background:C.navyL,borderRadius:12,padding:"14px 16px",marginBottom:14,border:`1px solid ${C.navyM}22`}}>
          <div style={{fontSize:15.4,fontWeight:700,color:C.navyM,marginBottom:8}}>📋 일괄 붙여넣기</div>
          <div style={{fontSize:12.5,color:C.gray,marginBottom:8,lineHeight:1.6}}>
            "▷ 설계계약 : 2021.12.20" 형식으로 여러 줄을 붙여넣으면 자동으로 구분·날짜를 인식합니다.<br/>
            날짜가 여러 개인 줄(예: "2024.11.08(접수) / 2025.01.08(취하)")은 각각 별도 항목으로 나뉩니다.
          </div>
          <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} rows={8}
            placeholder={"▷ 설계계약 : 2021.12.20\n▷ 건축심의접수 : 2022.02.09\n▷ (도시/건축/경관/교통) 통합심의 :\n  - 2024.11.08 (접수) / 2025.01.08 (취하)"}
            style={{...inp(),fontFamily:"inherit",marginBottom:8,resize:"vertical"}}/>
          <div style={{display:"flex",gap:7,marginBottom:bulkPreview?12:0}}>
            <button onClick={runBulkParse} style={btn(C.navyM)}>미리보기 파싱</button>
            {bulkPreview&&<button onClick={()=>{setBulkText("");setBulkPreview(null)}} style={btn(C.grayL,C.gray)}>초기화</button>}
          </div>

          {bulkPreview && (
            bulkPreview.length===0
              ? <div style={{padding:"14px",textAlign:"center",color:C.red,fontSize:13.2,background:"#fff",borderRadius:8}}>인식된 일정이 없습니다. 형식을 확인해주세요.</div>
              : <div>
                  <div style={{fontSize:13.2,fontWeight:700,color:C.navyM,marginBottom:6}}>인식된 항목 {bulkPreview.length}건 — 확인 후 추가하세요</div>
                  <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:320,overflowY:"auto",marginBottom:10}}>
                    {bulkPreview.map((r,i)=>(
                      <div key={i} style={{display:"flex",gap:5,alignItems:"center",background:r.dupWarning?"#FEF3C7":"#fff",borderRadius:8,padding:"6px 8px"}}>
                        {r.dupWarning&&<span title="같은 날짜에 비슷한 항목이 이미 있습니다" style={{fontSize:13}}>⚠️</span>}
                        <input type="date" value={r.date} onChange={e=>updateBulkRow(i,{date:e.target.value})} style={{...inp(132),padding:"5px 7px",fontSize:12.5}}/>
                        <input value={r.category} onChange={e=>updateBulkRow(i,{category:e.target.value,content:e.target.value})} placeholder="구분/내용" style={{...inp(),padding:"5px 7px",fontSize:12.5,flex:1}}/>
                        <input value={r.memo} onChange={e=>updateBulkRow(i,{memo:e.target.value})} placeholder="메모" style={{...inp(),padding:"5px 7px",fontSize:12.5,flex:1}}/>
                        <button onClick={()=>removeBulkRow(i)} style={{...btn(C.redL,C.red),padding:"3px 8px",fontSize:12}}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={commitBulk} style={btn(C.green)}>✓ 전체 {bulkPreview.length}건 추가</button>
                </div>
          )}
        </div>
      )}

      {/* 자주 쓰는 구분(프리셋) 관리 패널 — 목록 강제 아님, 빠른 입력용 칩 */}
      {showCatMgr && (
        <div style={{background:C.navyL,borderRadius:12,padding:"14px 16px",marginBottom:14,border:`1px solid ${C.navyM}22`}}>
          <div style={{fontSize:15.4,fontWeight:700,color:C.navyM,marginBottom:4}}>⭐ 자주 쓰는 구분 관리</div>
          <div style={{fontSize:12,color:C.gray,marginBottom:10}}>여기 등록된 값은 입력폼에서 빠르게 선택할 수 있는 참고용 칩일 뿐, 구분 입력을 제한하지 않습니다 — 언제든 다른 텍스트를 직접 입력할 수 있습니다.</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
            {presets.map((c,i)=>(
              <div key={i} style={{display:"flex",gap:6,alignItems:"center"}}>
                <div style={{display:"flex",flexDirection:"column",gap:2}}>
                  <button onClick={()=>i>0&&moveCat(i,-1)} style={{...btn(C.navyL,C.navyM),padding:"1px 6px",fontSize:11,opacity:i===0?.3:1}}>▲</button>
                  <button onClick={()=>i<presets.length-1&&moveCat(i,1)} style={{...btn(C.navyL,C.navyM),padding:"1px 6px",fontSize:11,opacity:i===presets.length-1?.3:1}}>▼</button>
                </div>
                <div style={{width:10,height:10,borderRadius:"50%",background:getColor(c),flexShrink:0}}/>
                {editCatIdx===i
                  ? <>
                      <input value={editCatVal} onChange={e=>setEditCatVal(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")saveCat(i);if(e.key==="Escape")setEditCatIdx(null)}}
                        style={{...inp(),flex:1,padding:"5px 9px",fontSize:14.3}} autoFocus/>
                      <button onClick={()=>saveCat(i)} style={{...btn(C.green),padding:"5px 10px",fontSize:13.2}}>저장</button>
                      <button onClick={()=>setEditCatIdx(null)} style={{...btn(C.grayL,C.gray),padding:"5px 10px",fontSize:13.2}}>취소</button>
                    </>
                  : <>
                      <span style={{flex:1,fontSize:15.4,fontWeight:600}}>{c}</span>
                      <button onClick={()=>{setEditCatIdx(i);setEditCatVal(c)}} style={{...btn(C.navyL,C.navyM),padding:"4px 9px",fontSize:13.2}}>수정</button>
                      <button onClick={()=>removeCat(i)} style={{...btn(C.redL,C.red),padding:"4px 9px",fontSize:13.2}}>삭제</button>
                    </>
                }
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:7}}>
            <input value={newCat} onChange={e=>setNewCat(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addCat()}
              placeholder="새 프리셋 추가 (Enter)" style={{...inp(),flex:1,padding:"7px 10px",fontSize:14.3}}/>
            <button onClick={addCat} style={{...btn(C.navyM),padding:"7px 14px"}}>+ 추가</button>
          </div>
        </div>
      )}

      {/* 입력 폼 (단건) */}
      {canWrite && (
        <div style={{background:"#F8FAFC",borderRadius:12,padding:"14px 16px",marginBottom:14,border:"1px solid #E5E7EB"}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-start",marginBottom:8}}>
            <div style={{flexShrink:0}}>
              <label style={lbl()}>날짜</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...inp(),width:148}}/>
            </div>
            <div style={{flexShrink:0}}>
              <label style={lbl()}>구분 (자유 입력)</label>
              <input list="schedCatOptions" value={cat} onChange={e=>setCat(e.target.value)}
                placeholder="예: 변경승인(경미) 완료(1차)" style={{...inp(),width:220}}/>
              <datalist id="schedCatOptions">
                {usedCats.map(c=><option key={c} value={c}/>)}
              </datalist>
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
          <div style={{fontSize:12,color:C.gray,marginTop:6}}>Ctrl+Enter로도 추가 가능 · 구분을 비워두면 "기타"로 저장됩니다</div>
        </div>
      )}

      {/* 필터 + 정렬 */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
        <button onClick={()=>setFilter("")} style={{...btn(filter?"#F3F4F6":""+C.navyM,filter?"#374151":"#fff"),padding:"5px 12px",fontSize:13.2,borderRadius:20}}>전체</button>
        {usedCats.map(c=>(
          <button key={c} onClick={()=>setFilter(f=>f===c?"":c)}
            style={{...btn(filter===c?getColor(c):C.grayL,filter===c?"#fff":C.gray),padding:"5px 12px",fontSize:13.2,borderRadius:20}}>
            {c}
          </button>
        ))}
        <button onClick={()=>setSortAsc(v=>!v)} style={{...btn(C.grayL,C.gray),padding:"5px 12px",fontSize:13.2,borderRadius:20,marginLeft:"auto"}}>
          {sortAsc ? "↑ 오래된순" : "↓ 최신순"}
        </button>
      </div>

      {/* 타임라인 */}
      {filtered.length===0
        ? <div style={{padding:"24px",textAlign:"center",color:C.gray,fontSize:14.3}}>등록된 일정이 없습니다.</div>
        : <div style={{position:"relative"}}>
            <div style={{position:"absolute",left:120,top:0,bottom:0,width:2,background:"#E5E7EB"}}/>
            {filtered.map(e=>(
              <div key={e.id} style={{display:"flex",gap:14,marginBottom:12,alignItems:"flex-start"}}>
                {/* 날짜 */}
                <div style={{width:112,flexShrink:0,textAlign:"right",paddingTop:4}}>
                  <div style={{fontSize:14.3,fontWeight:700,color:"#111827"}}>{e.date}</div>
                </div>
                {/* 도트 */}
                <div style={{width:12,height:12,borderRadius:"50%",background:getColor(e.category),flexShrink:0,marginTop:4,zIndex:1,border:"2px solid #fff",boxShadow:`0 0 0 2px ${getColor(e.category)}`}}/>
                {/* 카드 */}
                <div style={{flex:1,background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"11px 14px",boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
                  {editId===e.id
                    ? <div>
                        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
                          <input type="date" value={editDraft.date} onChange={ev=>setED(p=>({...p,date:ev.target.value}))} style={{...inp(),width:148}}/>
                          <input list="schedCatOptions" value={editDraft.cat} onChange={ev=>setED(p=>({...p,cat:ev.target.value}))} style={{...inp(),width:200}}/>
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
                          <button onClick={saveEdit} style={{...btn(C.green),padding:"5px 12px",fontSize:13.2}}>저장</button>
                          <button onClick={()=>setEditId(null)} style={{...btn(C.grayL,C.gray),padding:"5px 12px",fontSize:13.2}}>취소</button>
                        </div>
                      </div>
                    : <>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:e.memo?6:0,flexWrap:"wrap"}}>
                          <span style={{...badge(getColor(e.category)+"22",getColor(e.category)),fontSize:12}}>{e.category}</span>
                          <span style={{fontSize:15.4,fontWeight:700,color:"#111827",flex:1}}>{e.content}</span>
                          <div style={{display:"flex",gap:5,marginLeft:"auto"}}>
                            {canWrite&&<button onClick={()=>startEdit(e)} style={{...btn(C.navyL,C.navyM),padding:"3px 9px",fontSize:13.2}}>수정</button>}
                            {canWrite&&<button onClick={()=>del(e.id)} style={{...btn(C.redL,C.red),padding:"3px 9px",fontSize:13.2}}>삭제</button>}
                          </div>
                        </div>
                        {e.memo&&<div style={{fontSize:14.3,color:"#6B7280",background:"#F8FAFC",borderRadius:8,padding:"6px 10px",marginBottom:4}}>
                          📝 {e.memo}
                        </div>}
                        <div style={{fontSize:12,color:"#9CA3AF",marginTop:4}}>
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
    setDraft({...{startDate:"",endDate:"",currentNote:""},...stages[stageId]})
  }
  const saveSt = ()=>{
    // progress는 더 이상 수동 입력값이 아니라 시작일·종료일과 오늘 날짜로 자동 계산됨(draft에서 제거)
    const {progress:_ignored, ...rest} = draft
    save({stages:{...stages,[editStage]:{...rest,updatedAt:now()}}})
    setEditStage(null)
  }
  const overall = calcOverallProgress(stagesDef, stages)

  return (
    <div>
      {/* 전체 진행률 개요 */}
      <div style={{...card(),background:C.navyL,padding:"16px 20px",marginBottom:12}}>
        <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
          <div>
            <div style={{fontSize:12,color:C.navyM,fontWeight:600,marginBottom:2}}>용역비 (VAT 별도)</div>
            <div style={{fontSize:24.2,fontWeight:800,color:C.navy}}>{(totalServiceFee/1e8).toFixed(2)}억</div>
          </div>
          <div>
            <div style={{fontSize:12,color:C.green,fontWeight:600,marginBottom:2}}>누계 입금기성 (cashflowPlan 합산)</div>
            <div style={{fontSize:24.2,fontWeight:800,color:C.green}}>{totalActual.toFixed(2)}억</div>
          </div>
          <div>
            <div style={{fontSize:12,color:C.amber,fontWeight:600,marginBottom:2}}>기성률</div>
            <div style={{fontSize:24.2,fontWeight:800,color:C.amber}}>{achieveRate.toFixed(1)}%</div>
          </div>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:12,color:C.navy,fontWeight:600,marginBottom:4}}>전체 진행 바</div>
            <div style={{height:10,background:"rgba(12,68,124,.15)",borderRadius:5,overflow:"hidden"}}>
              <div style={{width:`${Math.min(achieveRate,100).toFixed(1)}%`,height:"100%",background:C.navyM,borderRadius:5,transition:"width .4s"}}/>
            </div>
          </div>
        </div>
        <div style={{fontSize:12,color:C.navyM,marginTop:8}}>※ 누계 입금기성은 "프로젝트 정보 → 연도별 월수금계획" 입금실적 합산값입니다.</div>

        {/* 설계단계 전체(100%) 기준 타임라인 + 오늘 위치 */}
        {overall.overallStart && (
          <div style={{marginTop:14}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.navy,fontWeight:600,marginBottom:4}}>
              <span>설계단계 전체 진행률 ({overall.overallStart} ~ {overall.overallEnd})</span>
              <span style={{fontWeight:800}}>오늘 {overall.pct}%</span>
            </div>
            <div style={{position:"relative",height:22,background:"#fff",borderRadius:6,overflow:"visible",display:"flex",border:`1px solid ${C.navyM}33`}}>
              {stagesDef.filter(s=>stages[s.id]?.startDate && stages[s.id]?.endDate).map(s=>{
                const d = daysBetween(stages[s.id].startDate, stages[s.id].endDate) || 0
                const totalDays = daysBetween(overall.overallStart, overall.overallEnd) || 1
                const w = Math.max(2, d/totalDays*100)
                return <div key={s.id} title={`${s.label} (${d}일)`} style={{width:`${w}%`,background:s.color,opacity:s.id===overall.currentStageId?1:.55,borderRight:"1px solid #fff"}}/>
              })}
              <div style={{position:"absolute",left:`${overall.pct}%`,top:-4,bottom:-4,width:2,background:C.red,transform:"translateX(-1px)"}}>
                <div style={{position:"absolute",top:-16,left:"50%",transform:"translateX(-50%)",fontSize:10.4,fontWeight:800,color:C.red,whiteSpace:"nowrap"}}>오늘</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 단계정의 관리 버튼 */}
      {canWrite && !editingDef && (
        <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
          <button onClick={startDefEdit} style={{...btn(C.navyL,C.navyM),padding:"6px 14px",fontSize:13.2}}>⚙ 설계단계 추가·수정·삭제</button>
          <span style={{fontSize:12,color:C.gray}}>{stagesDef.length}단계 · 클릭해서 단계명 변경, 추가, 삭제</span>
        </div>
      )}

      {/* 단계정의 편집 패널 */}
      {editingDef && defDraft && (
        <div style={{...card(),border:`1.5px solid ${C.navyM}`,marginBottom:14}}>
          <div style={{fontSize:15.4,fontWeight:700,marginBottom:12,color:C.navyM}}>⚙ 설계단계 구성 편집</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
            {defDraft.map((s,i)=>(
              <div key={s.id} style={{display:"flex",gap:8,alignItems:"center"}}>
                <div style={{display:"flex",flexDirection:"column",gap:2}}>
                  <button onClick={()=>moveStage(i,-1)} disabled={i===0} style={{...btn(C.navyL,C.navyM),padding:"2px 6px",fontSize:11,opacity:i===0?.4:1}}>▲</button>
                  <button onClick={()=>moveStage(i,1)} disabled={i===defDraft.length-1} style={{...btn(C.navyL,C.navyM),padding:"2px 6px",fontSize:11,opacity:i===defDraft.length-1?.4:1}}>▼</button>
                </div>
                <div style={{width:18,height:18,borderRadius:4,background:s.color,flexShrink:0,border:"2px solid rgba(0,0,0,.1)"}}/>
                <input value={s.label} onChange={e=>updateStageDef(i,"label",e.target.value)}
                  style={{...inp(140),fontWeight:600}} placeholder="단계명"/>
                <input type="color" value={s.color} onChange={e=>updateStageDef(i,"color",e.target.value)}
                  style={{width:36,height:32,padding:2,border:"1px solid #ccc",borderRadius:6,cursor:"pointer"}}/>
                <button onClick={()=>removeStage(i)} style={{...btn(C.redL,C.red),padding:"4px 10px",fontSize:13.2}}>삭제</button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={addStage} style={{...btn(C.green),padding:"6px 14px",fontSize:13.2}}>+ 단계 추가</button>
            <button onClick={saveDefEdit} style={{...btn(C.navyM),padding:"6px 14px",fontSize:13.2}}>✓ 저장</button>
            <button onClick={cancelDefEdit} style={{...btn(C.grayL,C.gray),padding:"6px 14px",fontSize:13.2}}>취소</button>
          </div>
        </div>
      )}

      {/* 단계별 카드 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:12}}>
        {stagesDef.map((stage,si)=>{
          const st = stages[stage.id] || {}
          const prog = calcStageProgress(st.startDate, st.endDate)
          const days = daysBetween(st.startDate, st.endDate)
          const isCurrent = overall.currentStageId===stage.id
          return (
            <div key={stage.id} style={{...card(),marginBottom:0,borderLeft:`4px solid ${stage.color}`,boxShadow:isCurrent?`0 0 0 2px ${stage.color}55`:undefined}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:15.4,fontWeight:700,color:stage.color}}>{si+1}. {stage.label}{isCurrent&&<span style={{marginLeft:6,fontSize:11,fontWeight:800,color:"#fff",background:stage.color,borderRadius:4,padding:"1px 7px"}}>진행중</span>}</span>
                {canWrite&&<button onClick={()=>startEdit(stage.id)} style={{...btn(C.grayL,C.gray),padding:"4px 10px",fontSize:12}}>편집</button>}
              </div>

              {editStage===stage.id
                ? <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div><label style={lbl()}>시작일</label><input type="date" value={draft.startDate||""} onChange={e=>setDraft(p=>({...p,startDate:e.target.value}))} style={inp()}/></div>
                      <div><label style={lbl()}>종료일</label><input type="date" value={draft.endDate||""} onChange={e=>setDraft(p=>({...p,endDate:e.target.value}))} style={inp()}/></div>
                    </div>
                    {draft.startDate&&draft.endDate&&<div style={{fontSize:12,color:C.gray}}>총 {daysBetween(draft.startDate,draft.endDate)}일 · 진행률은 오늘 날짜 기준으로 자동 계산됩니다</div>}
                    <div>
                      <label style={lbl()}>현재일정 메모</label>
                      <textarea value={draft.currentNote||""} onChange={e=>setDraft(p=>({...p,currentNote:e.target.value}))} rows={2} style={{...inp(),resize:"vertical"}} placeholder="예: 실시설계 도서 작성중"/>
                    </div>
                    <div style={{display:"flex",gap:7}}>
                      <button onClick={saveSt} style={{...btn(C.green),padding:"6px 14px",fontSize:13.2}}>저장</button>
                      <button onClick={()=>setEditStage(null)} style={{...btn(C.grayL,C.gray),padding:"6px 14px",fontSize:13.2}}>취소</button>
                    </div>
                  </div>
                : <>
                    <div style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.gray,marginBottom:3}}>
                        <span>{st.startDate&&st.endDate?`${st.startDate} ~ ${st.endDate}(${days}일)`:"미정"}</span>
                        <span style={{fontWeight:700,color:stage.color}}>{prog}%</span>
                      </div>
                      <div style={{height:8,background:"var(--color-border-tertiary,#eee)",borderRadius:4,overflow:"hidden"}}>
                        <div style={{width:`${prog}%`,height:"100%",background:stage.color,borderRadius:4,transition:"width .3s"}}/>
                      </div>
                    </div>
                    {st.currentNote&&<div style={{fontSize:13.2,color:"var(--color-text-primary)",background:"var(--color-background-secondary,#f8f8f6)",borderRadius:7,padding:"7px 10px",marginBottom:6}}>{st.currentNote}</div>}
                    {st.updatedAt&&<div style={{fontSize:11.6,color:C.gray}}>수정: {fDT(st.updatedAt)}</div>}
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
        <span style={{fontSize:14.3,fontWeight:700,color:C.navy}}>주차 선택:</span>
        <input type="week" value={selWeek} onChange={e=>setSelWeek(e.target.value)} style={inp(180)}/>
        <button onClick={()=>setSelWeek(getWeek())} style={{...btn(C.navyL,C.navyM),padding:"5px 12px",fontSize:13.2}}>이번 주</button>
        <button onClick={()=>setShowAll(v=>!v)} style={{...btn(C.grayL,C.gray),padding:"5px 12px",fontSize:13.2}}>{showAll?"현재 주차만":"전체 주차 보기"}</button>
      </div>

      {/* 현재 주차 AGENDA */}
      <div style={card()}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{fontSize:16.5,fontWeight:700}}>{selWeek} 주간 AGENDA</div>
          <span style={{...badge(C.navyL,C.navyM),fontSize:13.2}}>{items.length}건</span>
          <span style={{...badge(items.filter(i=>i.done).length===items.length&&items.length>0?C.greenL:C.amberL,items.filter(i=>i.done).length===items.length&&items.length>0?C.green:C.amber),fontSize:13.2}}>
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
          ? <div style={{padding:"20px",textAlign:"center",color:C.gray,fontSize:14.3}}>이번 주 AGENDA가 없습니다.{canWrite?" 위에서 추가해주세요.":""}</div>
          : <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {items.map((item,idx)=>(
                <div key={item.id} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 13px",borderRadius:9,background:item.done?"var(--color-background-secondary,#f0f0ee)":"var(--color-background-primary,#fff)",border:`0.5px solid ${item.done?C.green+"44":"var(--color-border-tertiary,#eee)"}`,opacity:item.done?.75:1}}>
                  <span style={{fontSize:15.4,fontWeight:700,color:C.navy,flexShrink:0,paddingTop:1}}>{idx+1}.</span>
                  {canWrite&&<input type="checkbox" checked={item.done} onChange={()=>toggleDone(item.id)} style={{marginTop:3,accentColor:C.green,cursor:"pointer",flexShrink:0}}/>}
                  {editAg?.itemId===item.id
                    ? <div style={{flex:1,display:"flex",flexDirection:"column",gap:7}}>
                        <textarea value={editAg.text} onChange={e=>setEditAg(p=>({...p,text:e.target.value}))}
                          onKeyDown={e=>{ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();saveEditItem()} }}
                          rows={3} style={{...inp(),resize:"vertical",whiteSpace:"pre-wrap",lineHeight:1.6}}/>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={saveEditItem} style={{...btn(C.green),padding:"4px 10px",fontSize:12}}>저장</button>
                          <button onClick={()=>setEditAg(null)} style={{...btn(C.grayL,C.gray),padding:"4px 10px",fontSize:12}}>취소</button>
                          <span style={{fontSize:11,color:C.gray,alignSelf:"center"}}>Ctrl+Enter로 저장</span>
                        </div>
                      </div>
                    : <div style={{flex:1}}>
                        <div style={{fontSize:14.8,fontWeight:500,textDecoration:item.done?"line-through":"none",color:item.done?C.gray:"var(--color-text-primary)",whiteSpace:"pre-wrap",lineHeight:1.7}}>{item.text}</div>
                        <div style={{fontSize:11.6,color:C.gray,marginTop:2}}>
                          등록: {fDT(item.createdAt)}{item.updatedAt!==item.createdAt?` · 수정: ${fDT(item.updatedAt)}`:""}
                        </div>
                      </div>
                  }
                  {canWrite&&editAg?.itemId!==item.id&&(
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      <button onClick={()=>setEditAg({agWeek:selWeek,itemId:item.id,text:item.text})} style={{...btn(C.navyL,C.navyM),padding:"3px 8px",fontSize:12}}>수정</button>
                      <button onClick={()=>delItem(item.id)} style={{...btn(C.redL,C.red),padding:"3px 8px",fontSize:12}}>삭제</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
        }
        {thisAg?.updatedAt&&<div style={{fontSize:11.6,color:C.gray,marginTop:8}}>최종 수정: {fDT(thisAg.updatedAt)}</div>}
      </div>

      {/* 전체 주차 이력 */}
      {showAll && agendas.length>0 && (
        <div style={card()}>
          <div style={{fontSize:15.4,fontWeight:700,marginBottom:12}}>📋 전체 주차 AGENDA 이력</div>
          {agendas.map(ag=>(
            <div key={ag.id} style={{marginBottom:16,borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",paddingBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <button onClick={()=>{setSelWeek(ag.week);setShowAll(false)}} style={{...btn(C.navyL,C.navyM),padding:"3px 10px",fontSize:13.2}}>{ag.week}</button>
                <span style={{fontSize:13.2,color:C.gray}}>안건 {ag.items.length}건 · 완료 {ag.items.filter(i=>i.done).length}건</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                {ag.items.map((item,idx)=>(
                  <div key={item.id} style={{display:"flex",gap:8,fontSize:14.3,color:item.done?C.gray:"var(--color-text-primary)",textDecoration:item.done?"line-through":"none"}}>
                    <span style={{color:C.navyM,fontWeight:700,flexShrink:0}}>{idx+1}.</span>
                    <span style={{whiteSpace:"pre-wrap",lineHeight:1.6}}>{item.text}</span>
                    {item.done&&<span style={{...badge(C.greenL,C.green),fontSize:11,flexShrink:0}}>완료</span>}
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

  const typeColor={발주처:C.navyM,"로컬사(건축사무소)":C.green,시공사:C.amber,감리사:"#0E9C8C",협력업체:C.red,기타:C.gray}

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
          <div style={{fontSize:15.4,fontWeight:700,marginBottom:12}}>{editId?"담당자 수정":"새 담당자 등록"}</div>
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
        ? <div style={{...card(),padding:"30px",textAlign:"center",color:C.gray,fontSize:14.3}}>등록된 담당자가 없습니다.{canWrite?" \"+ 담당자 추가\"로 등록하세요.":""}</div>
        : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:10}}>
            {filtered.map(c=>(
              <div key={c.id} style={{...card(),marginBottom:0,borderLeft:`4px solid ${typeColor[c.orgType]||C.gray}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div>
                    <span style={badge(typeColor[c.orgType]+"22",typeColor[c.orgType]||C.gray)}>{c.orgType}</span>
                    {c.org&&<div style={{fontSize:13.2,color:C.gray,marginTop:3}}>{c.org}</div>}
                  </div>
                  {canWrite&&<div style={{display:"flex",gap:4}}>
                    <button onClick={()=>openEdit(c)} style={{...btn(C.navyL,C.navyM),padding:"3px 8px",fontSize:12}}>수정</button>
                    <button onClick={()=>del(c.id)} style={{...btn(C.redL,C.red),padding:"3px 8px",fontSize:12}}>삭제</button>
                  </div>}
                </div>
                <div style={{fontSize:16.5,fontWeight:700,color:"var(--color-text-primary)",marginBottom:2}}>{c.name}{c.title&&<span style={{fontSize:13.2,fontWeight:400,color:C.gray,marginLeft:6}}>{c.title}</span>}</div>
                {c.phone&&<div style={{fontSize:14.3,color:C.navyM,fontWeight:600,marginBottom:1}}>📞 {c.phone}</div>}
                {c.email&&<div style={{fontSize:13.2,color:C.green}}>✉ {c.email}</div>}
                {c.note&&<div style={{fontSize:13.2,color:C.gray,marginTop:5,padding:"5px 8px",background:"var(--color-background-secondary,#f8f8f6)",borderRadius:6}}>{c.note}</div>}
                <div style={{fontSize:11.6,color:C.gray,marginTop:6}}>
                  등록: {fDT(c.createdAt)}{c.updatedAt!==c.createdAt?` · 수정: ${fDT(c.updatedAt)}`:""}
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}
