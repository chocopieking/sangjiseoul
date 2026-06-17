// ══════════════════════════════════════════════════════════════
// 📚 업무매뉴얼 — 위키/노션형 페이지 기반
// 카테고리 → 페이지 → 섹션 구조
// 전직원 검색·열람, 관리자 편집, 절차/양식 등록
// ══════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect } from "react"

const C = {
  navyM:"#3B72F6", navyL:"#EEF3FF", navy:"#1A3B6E",
  green:"#0EA86E", greenL:"#E6F9F2",
  amber:"#F59E0B", amberL:"#FEF3C7",
  red:"#EF4444",   redL:"#FEE2E2",
  gray:"#6B7280",  grayL:"#F3F4F6",
}

const now = () => new Date().toISOString()
const fmtDT = iso => iso ? new Date(iso).toLocaleString("ko-KR",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : ""

// ── 기본 매뉴얼 데이터 ────────────────────────────────────────
const DEFAULT_MANUAL = {
  categories: [
    { id:"C001", name:"🏗 설계 프로세스",   order:1 },
    { id:"C002", name:"💰 계약 및 수주",     order:2 },
    { id:"C003", name:"📊 실행계획서",        order:3 },
    { id:"C004", name:"🤝 협력업체 관리",     order:4 },
    { id:"C005", name:"📋 결재 및 보고",      order:5 },
    { id:"C006", name:"💧 수금 및 기성",      order:6 },
    { id:"C007", name:"📁 자료관리",          order:7 },
  ],
  pages: [
    {
      id:"P001", categoryId:"C001", title:"설계 단계별 업무 흐름",
      order:1, updatedAt: now(), updatedBy:"관리자",
      sections: [
        { id:"S001", type:"heading", content:"설계 단계 개요" },
        { id:"S002", type:"text", content:"상지서울의 설계 업무는 크게 기본설계 → 실시설계 → 인허가 → 현장관리 4단계로 진행됩니다." },
        { id:"S003", type:"steps", content:"1. 계약 체결 및 착수신고\n2. 기본설계 (기획·계획설계)\n3. 건축심의 접수 및 통과\n4. 실시설계 도서 작성\n5. 건축허가 접수\n6. 착공 지원\n7. 현장 감리 협력" },
        { id:"S004", type:"heading", content:"주요 산출물" },
        { id:"S005", type:"table", content:"단계|산출물|담당자\n기본설계|기획안, 기본설계도면|PM\n실시설계|실시설계도면 일체|PM+설계팀\n인허가|건축허가서류|PM\n현장관리|현장설계변경도면|PM" },
      ]
    },
    {
      id:"P002", categoryId:"C002", title:"계약 체결 프로세스",
      order:1, updatedAt: now(), updatedBy:"관리자",
      sections: [
        { id:"S010", type:"heading", content:"계약 체결 절차" },
        { id:"S011", type:"steps", content:"1. 제안서 제출 및 수주 확정\n2. 계약서 초안 작성 (표준계약서 기반)\n3. 내부 결재 (본부장 → 상무 → 대표)\n4. 발주처 계약서 검토 및 협의\n5. 계약서 서명 및 날인\n6. 계약금(10%) 수령 확인\n7. ERP 수주 등록 및 실행계획서 착수" },
        { id:"S012", type:"warning", content:"⚠ 계약서 서명 전 법무검토가 필요한 경우: 총 설계비 5억 이상, 해외 프로젝트, 특수 조건 포함 시" },
        { id:"S013", type:"heading", content:"계약 관련 서류" },
        { id:"S014", type:"text", content:"계약 시 필요 서류: 사업자등록증 사본, 건축사 자격증 사본, 직인, 건설업 면허 사본" },
      ]
    },
    {
      id:"P003", categoryId:"C003", title:"실행계획서 작성 가이드",
      order:1, updatedAt: now(), updatedBy:"관리자",
      sections: [
        { id:"S020", type:"heading", content:"실행계획서 작성 목적" },
        { id:"S021", type:"text", content:"실행계획서는 프로젝트별 비용 구조(인건비·외주비·간접비·이윤)를 사전에 계획하여 경영 목표 이윤율을 달성하기 위한 도구입니다." },
        { id:"S022", type:"heading", content:"작성 절차" },
        { id:"S023", type:"steps", content:"1. 시스템 접속 → 프로젝트 탭 → 해당 프로젝트 선택\n2. '+ 회차 추가' 또는 '실행계획서 업로드' 클릭\n3. 직접인건비, 직접경비 입력\n4. 협력업체 외주비 탭에서 분야별 업체·금액 입력\n5. 이윤율 확인 (목표: 용역비의 8% 이상)\n6. 저장 후 보고서 다운로드 → 결재 상신" },
        { id:"S024", type:"warning", content:"⚠ 이윤율이 5% 미만인 경우 본부장 보고 후 진행" },
        { id:"S025", type:"heading", content:"변경 실행계획서" },
        { id:"S026", type:"text", content:"설계 변경, 협력업체 교체, 계약 변경 시 변경 회차를 새로 등록합니다. 회차별 비교 분석으로 이윤 변동 추이를 확인할 수 있습니다." },
      ]
    },
    {
      id:"P004", categoryId:"C006", title:"수금 관리 절차",
      order:1, updatedAt: now(), updatedBy:"관리자",
      sections: [
        { id:"S030", type:"heading", content:"수금 입력 위치" },
        { id:"S031", type:"text", content:"수금 정보는 두 곳에서 입력합니다. ① 프로젝트별 상세 정보: 프로젝트 탭 → 프로젝트 선택 → '연도별 월수금계획(기성)' 카드. ② 전사 월별 수금: 월수금계획 탭 → 본부별 직접 입력." },
        { id:"S032", type:"steps", content:"1. 기성 청구서 발행 확인\n2. 발주처 입금 확인 (은행 계좌 확인)\n3. 시스템 접속 → 해당 프로젝트 선택\n4. 연도별 월수금계획 → 해당 월 '입금(실적)' 입력\n5. 잔여기성 자동 계산 확인" },
        { id:"S033", type:"warning", content:"⚠ 입금실적은 실제 입금된 날짜 기준 월에 입력 (청구일 기준 아님)" },
      ]
    },
  ]
}

const STORE_KEY = "sjs_manual_data"
const load = () => { try{ const d=localStorage.getItem(STORE_KEY); return d?JSON.parse(d):null }catch{ return null } }
const save = data => { try{ localStorage.setItem(STORE_KEY,JSON.stringify(data)) }catch{} }

const SECTION_TYPES = [
  {type:"heading", label:"📌 소제목", desc:"섹션 제목"},
  {type:"text",    label:"📝 본문",   desc:"일반 텍스트"},
  {type:"steps",   label:"🔢 절차",   desc:"번호 매긴 단계 (줄바꿈으로 구분)"},
  {type:"warning", label:"⚠ 주의",   desc:"노란색 주의사항 박스"},
  {type:"table",   label:"📊 표",     desc:"| 구분자 CSV (첫 줄=헤더)"},
  {type:"link",    label:"🔗 링크",   desc:"양식·외부 링크"},
]

export function ManualTab({ currentUser }) {
  const [data, setDataRaw] = useState(()=>load()||DEFAULT_MANUAL)
  const setData = d => { const next=typeof d==="function"?d(data):d; save(next); setDataRaw(next) }

  const [selCat,    setSelCat]    = useState(data.categories[0]?.id||"")
  const [selPage,   setSelPage]   = useState(null)
  const [editMode,  setEditMode]  = useState(false)
  const [search,    setSearch]    = useState("")
  const [showCatMgr,setShowCatMgr]=useState(false)

  const canEdit = currentUser?.role==="admin" || currentUser?.write===true

  // 검색 결과
  const searchResults = useMemo(()=>{
    if(!search.trim()) return []
    const q = search.toLowerCase()
    const results = []
    data.pages.forEach(page=>{
      const cat = data.categories.find(c=>c.id===page.categoryId)
      const matches = []
      if(page.title.toLowerCase().includes(q)) matches.push({type:"title",text:page.title})
      page.sections.forEach(s=>{
        if(s.content?.toLowerCase().includes(q)) {
          const idx = s.content.toLowerCase().indexOf(q)
          const excerpt = s.content.slice(Math.max(0,idx-30),idx+80)
          matches.push({type:s.type,text:"..."+excerpt+"..."})
        }
      })
      if(matches.length) results.push({page, cat, matches})
    })
    return results
  },[search,data])

  const catPages = useMemo(()=>
    data.pages.filter(p=>p.categoryId===selCat).sort((a,b)=>a.order-b.order)
  ,[data.pages, selCat])

  const currentPage = selPage ? data.pages.find(p=>p.id===selPage) : catPages[0]

  // 페이지 저장
  const savePage = (updatedPage) => {
    setData(prev=>({
      ...prev,
      pages: prev.pages.map(p=>p.id===updatedPage.id
        ? {...updatedPage, updatedAt:now(), updatedBy:currentUser?.name||"관리자"}
        : p
      )
    }))
    setEditMode(false)
  }

  // 새 페이지 추가
  const addPage = () => {
    const id = `P${Date.now()}`
    const newPage = {id, categoryId:selCat, title:"새 페이지", order:catPages.length+1,
      updatedAt:now(), updatedBy:currentUser?.name, sections:[
        {id:`S${Date.now()}`,type:"heading",content:"제목"},
        {id:`S${Date.now()+1}`,type:"text",content:"내용을 입력하세요."},
      ]}
    setData(prev=>({...prev, pages:[...prev.pages, newPage]}))
    setSelPage(id)
    setEditMode(true)
  }

  const deletePage = id => {
    if(!window.confirm("이 페이지를 삭제하시겠습니까?")) return
    setData(prev=>({...prev, pages:prev.pages.filter(p=>p.id!==id)}))
    setSelPage(null)
  }

  return (
    <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:0,minHeight:"calc(100vh - 140px)"}}>

      {/* ── 왼쪽 사이드바 ── */}
      <div style={{background:"#fff",borderRight:"1px solid #E5E7EB",display:"flex",flexDirection:"column",borderRadius:"14px 0 0 14px",overflow:"hidden"}}>

        {/* 검색 */}
        <div style={{padding:"14px 12px",borderBottom:"1px solid #F3F4F6"}}>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="검색..." style={{width:"100%",padding:"8px 10px 8px 32px",border:"1.5px solid #E5E7EB",borderRadius:9,fontSize:13,boxSizing:"border-box",fontFamily:"inherit"}}/>
          </div>
        </div>

        {/* 카테고리 목록 */}
        {!search.trim() && (
          <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
            {data.categories.sort((a,b)=>a.order-b.order).map(cat=>(
              <div key={cat.id}>
                <button onClick={()=>{setSelCat(cat.id);setSelPage(null);setSearch("")}}
                  style={{width:"100%",textAlign:"left",padding:"9px 12px",border:"none",borderRadius:10,marginBottom:2,cursor:"pointer",fontSize:13.5,fontWeight:700,
                    background:selCat===cat.id?"#EEF3FF":"transparent",color:selCat===cat.id?C.navyM:"#374151",transition:"all .12s"}}
                  onMouseEnter={e=>{if(selCat!==cat.id)e.currentTarget.style.background="#F8FAFC"}}
                  onMouseLeave={e=>{if(selCat!==cat.id)e.currentTarget.style.background="transparent"}}>
                  {cat.name}
                </button>
                {selCat===cat.id&&catPages.map(page=>(
                  <button key={page.id} onClick={()=>setSelPage(page.id)}
                    style={{width:"100%",textAlign:"left",padding:"7px 12px 7px 24px",border:"none",borderRadius:8,marginBottom:1,cursor:"pointer",fontSize:13,
                      background:currentPage?.id===page.id?"#EEF3FF":"transparent",color:currentPage?.id===page.id?C.navyM:"#6B7280",fontWeight:currentPage?.id===page.id?700:400}}
                    onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                    onMouseLeave={e=>e.currentTarget.style.background=currentPage?.id===page.id?"#EEF3FF":"transparent"}>
                    └ {page.title}
                  </button>
                ))}
                {selCat===cat.id&&canEdit&&(
                  <button onClick={addPage}
                    style={{width:"100%",textAlign:"left",padding:"6px 12px 6px 24px",border:"none",borderRadius:8,marginBottom:4,cursor:"pointer",fontSize:12.5,color:"#9CA3AF",background:"transparent"}}
                    onMouseEnter={e=>e.currentTarget.style.color=C.navyM}
                    onMouseLeave={e=>e.currentTarget.style.color="#9CA3AF"}>
                    + 페이지 추가
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 검색 결과 목록 */}
        {search.trim()&&(
          <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
            {searchResults.length===0
              ? <div style={{padding:"20px 12px",textAlign:"center",color:"#6B7280",fontSize:13}}>검색 결과 없음</div>
              : searchResults.map(r=>(
                <button key={r.page.id} onClick={()=>{setSelCat(r.page.categoryId);setSelPage(r.page.id);setSearch("")}}
                  style={{width:"100%",textAlign:"left",padding:"9px 12px",border:"none",borderRadius:10,marginBottom:4,cursor:"pointer",background:"#F8FAFC",color:"#111827"}}>
                  <div style={{fontSize:12,color:C.navyM,fontWeight:700,marginBottom:2}}>{r.cat?.name}</div>
                  <div style={{fontSize:13.5,fontWeight:700,marginBottom:4}}>{r.page.title}</div>
                  {r.matches.slice(0,2).map((m,i)=>(
                    <div key={i} style={{fontSize:11.5,color:"#6B7280",marginTop:2,lineHeight:1.5}}>{m.text.slice(0,80)}</div>
                  ))}
                </button>
              ))
            }
          </div>
        )}
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <div style={{background:"#fff",borderRadius:"0 14px 14px 0",border:"1px solid #E5E7EB",borderLeft:"none",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {!currentPage
          ? <div style={{padding:"60px 40px",textAlign:"center",color:"#6B7280"}}>
              <div style={{fontSize:48,marginBottom:12}}>📚</div>
              <div style={{fontSize:18,fontWeight:700,marginBottom:6}}>업무매뉴얼</div>
              <div style={{fontSize:14}}>왼쪽에서 카테고리와 페이지를 선택하세요.</div>
            </div>
          : editMode
            ? <PageEditor page={currentPage} onSave={savePage} onCancel={()=>setEditMode(false)} currentUser={currentUser}/>
            : <PageViewer page={currentPage} canEdit={canEdit}
                onEdit={()=>setEditMode(true)}
                onDelete={canEdit?()=>deletePage(currentPage.id):null}/>
        }
      </div>
    </div>
  )
}

// ── 페이지 뷰어 ──────────────────────────────────────────────
function PageViewer({ page, canEdit, onEdit, onDelete }) {
  return (
    <div style={{flex:1,overflowY:"auto"}}>
      {/* 헤더 */}
      <div style={{padding:"22px 32px",borderBottom:"1px solid #F3F4F6",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:0,lineHeight:1.3}}>{page.title}</h1>
          {page.updatedAt&&<div style={{fontSize:12,color:"#9CA3AF",marginTop:6}}>
            최종 수정: {page.updatedBy} · {fmtDT(page.updatedAt)}
          </div>}
        </div>
        {canEdit&&(
          <div style={{display:"flex",gap:7,flexShrink:0}}>
            <button onClick={onEdit} style={{padding:"9px 16px",background:"#EEF3FF",color:C.navyM,border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>✏ 편집</button>
            {onDelete&&<button onClick={onDelete} style={{padding:"9px 16px",background:"#FEE2E2",color:"#EF4444",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>삭제</button>}
          </div>
        )}
      </div>

      {/* 섹션 렌더링 */}
      <div style={{padding:"24px 32px",maxWidth:800}}>
        {page.sections.map(sec=><SectionRenderer key={sec.id} section={sec}/>)}
      </div>
    </div>
  )
}

function SectionRenderer({ section }) {
  switch(section.type) {
    case "heading":
      return <h2 style={{fontSize:18,fontWeight:800,color:"#1A3B6E",margin:"28px 0 10px",paddingBottom:6,borderBottom:"2px solid #EEF3FF"}}>{section.content}</h2>
    case "text":
      return <p style={{fontSize:15,lineHeight:1.85,color:"#374151",margin:"0 0 14px",whiteSpace:"pre-wrap"}}>{section.content}</p>
    case "steps": {
      const lines = section.content.split("\n").filter(l=>l.trim())
      return (
        <div style={{margin:"0 0 18px"}}>
          {lines.map((line,i)=>(
            <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
              <div style={{width:28,height:28,borderRadius:8,background:"#3B72F6",color:"#fff",fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {i+1}
              </div>
              <div style={{fontSize:15,lineHeight:1.6,color:"#374151",paddingTop:3,flex:1}}>
                {line.replace(/^\d+\.\s*/,"")}
              </div>
            </div>
          ))}
        </div>
      )
    }
    case "warning":
      return <div style={{background:"#FEF3C7",border:"1px solid #F59E0B",borderRadius:12,padding:"14px 18px",margin:"0 0 16px",fontSize:14.5,color:"#92400E",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{section.content}</div>
    case "table": {
      const rows = section.content.split("\n").map(r=>r.split("|"))
      if(!rows.length) return null
      return (
        <div style={{overflowX:"auto",margin:"0 0 18px"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
            <thead>
              <tr>{rows[0].map((h,i)=><th key={i} style={{padding:"10px 14px",background:"#F8FAFC",borderBottom:"2px solid #E5E7EB",textAlign:"left",fontWeight:700,color:"#374151",whiteSpace:"nowrap"}}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row,i)=>(
                <tr key={i} style={{borderBottom:"1px solid #F3F4F6"}}>
                  {row.map((cell,j)=><td key={j} style={{padding:"10px 14px",color:"#374151",lineHeight:1.6}}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case "link":
      return (
        <div style={{margin:"0 0 14px"}}>
          {section.content.split("\n").map((line,i)=>{
            const [label,url] = line.split("|")
            return url
              ? <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  style={{display:"inline-flex",alignItems:"center",gap:7,padding:"9px 16px",background:"#EEF3FF",color:"#3B72F6",borderRadius:10,fontSize:14,fontWeight:700,textDecoration:"none",marginRight:8,marginBottom:6}}>
                  🔗 {label}
                </a>
              : <div key={i} style={{fontSize:14,color:"#374151",marginBottom:4}}>{line}</div>
          })}
        </div>
      )
    default:
      return null
  }
}

// ── 페이지 에디터 ─────────────────────────────────────────────
function PageEditor({ page, onSave, onCancel, currentUser }) {
  const [title,    setTitle]    = useState(page.title)
  const [sections, setSections] = useState(page.sections.map(s=>({...s})))

  const addSection = type => {
    const defaults = {heading:"새 소제목",text:"내용을 입력하세요.",steps:"1. 첫 번째 단계\n2. 두 번째 단계",warning:"⚠ 주의사항을 입력하세요.",table:"항목|설명|비고\n내용1|설명1|비고1",link:"링크 제목|https://"}
    setSections(prev=>[...prev,{id:`S${Date.now()}`,type,content:defaults[type]||""}])
  }
  const updateSec = (id,k,v) => setSections(prev=>prev.map(s=>s.id===id?{...s,[k]:v}:s))
  const deleteSec = id => setSections(prev=>prev.filter(s=>s.id!==id))
  const moveSec   = (i,d) => setSections(prev=>{const a=[...prev];[a[i],a[i+d]]=[a[i+d],a[i]];return a})

  const inp = {width:"100%",padding:"9px 12px",border:"1.5px solid #E5E7EB",borderRadius:8,fontSize:14,boxSizing:"border-box",fontFamily:"inherit",outline:"none"}

  return (
    <div style={{flex:1,overflowY:"auto"}}>
      {/* 편집 헤더 */}
      <div style={{padding:"18px 24px",borderBottom:"1px solid #E5E7EB",background:"#FEF9EE",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:13,fontWeight:700,color:"#F59E0B"}}>✏ 편집 모드</span>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="페이지 제목"
          style={{...inp,fontSize:18,fontWeight:800,flex:1,minWidth:200,border:"none",background:"transparent",padding:"4px 0"}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>onSave({...page,title,sections})}
            style={{padding:"9px 20px",background:"#3B72F6",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>✓ 저장</button>
          <button onClick={onCancel}
            style={{padding:"9px 16px",background:"#F3F4F6",color:"#374151",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>취소</button>
        </div>
      </div>

      <div style={{padding:"20px 24px",maxWidth:800}}>
        {/* 섹션 목록 */}
        {sections.map((sec,i)=>(
          <div key={sec.id} style={{marginBottom:12,border:"1.5px solid #E5E7EB",borderRadius:12,overflow:"hidden",background:"#fff"}}>
            <div style={{display:"flex",alignItems:"center",gap:7,padding:"8px 12px",background:"#F8FAFC",borderBottom:"1px solid #E5E7EB"}}>
              <div style={{display:"flex",flexDirection:"column",gap:1}}>
                <button onClick={()=>i>0&&moveSec(i,-1)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:11,padding:"0 4px",lineHeight:1}} disabled={i===0}>▲</button>
                <button onClick={()=>i<sections.length-1&&moveSec(i,1)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:11,padding:"0 4px",lineHeight:1}} disabled={i===sections.length-1}>▼</button>
              </div>
              <span style={{fontSize:12.5,fontWeight:700,color:"#6B7280",flex:1}}>
                {SECTION_TYPES.find(t=>t.type===sec.type)?.label||sec.type}
              </span>
              <select value={sec.type} onChange={e=>updateSec(sec.id,"type",e.target.value)}
                style={{padding:"4px 8px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:12,background:"#fff"}}>
                {SECTION_TYPES.map(t=><option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
              <button onClick={()=>deleteSec(sec.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:16,padding:"0 4px"}}>✕</button>
            </div>
            <div style={{padding:"10px 12px"}}>
              <textarea value={sec.content} onChange={e=>updateSec(sec.id,"content",e.target.value)}
                rows={sec.type==="table"?5:sec.type==="steps"?5:3}
                style={{...inp,resize:"vertical",lineHeight:1.7,minHeight:60}}/>
              <div style={{fontSize:11.5,color:"#9CA3AF",marginTop:4}}>
                {SECTION_TYPES.find(t=>t.type===sec.type)?.desc}
                {sec.type==="table"&&" — 예: 항목|설명|비고 (각 행을 줄바꿈으로 구분)"}
                {sec.type==="steps"&&" — 각 단계를 줄바꿈으로 구분"}
                {sec.type==="link"&&" — 형식: 링크제목|https://... (줄바꿈으로 여러 개 추가)"}
              </div>
            </div>
          </div>
        ))}

        {/* 섹션 추가 버튼 */}
        <div style={{background:"#F8FAFC",borderRadius:12,padding:"14px 16px",border:"1.5px dashed #E5E7EB"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#6B7280",marginBottom:8}}>+ 섹션 추가</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {SECTION_TYPES.map(t=>(
              <button key={t.type} onClick={()=>addSection(t.type)}
                style={{padding:"7px 13px",background:"#fff",color:"#374151",border:"1.5px solid #E5E7EB",borderRadius:9,fontSize:13,fontWeight:600,cursor:"pointer"}}
                onMouseEnter={e=>{e.currentTarget.style.background="#EEF3FF";e.currentTarget.style.color=C.navyM;e.currentTarget.style.borderColor=C.navyM}}
                onMouseLeave={e=>{e.currentTarget.style.background="#fff";e.currentTarget.style.color="#374151";e.currentTarget.style.borderColor="#E5E7EB"}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManualTab
