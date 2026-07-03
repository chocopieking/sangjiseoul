// ══════════════════════════════════════════════════════════════
// 협력업체 탭 — 업체정보 · 수행 프로젝트/지급내역 · 외주비 비교 · 실행초안
// ══════════════════════════════════════════════════════════════
import { useState, useMemo, useRef } from "react"
import * as XLSX from "xlsx"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "./ReChartsFallback.jsx"
import { fW, fE, fPy, getAreaBasis, calcUP, VENDOR_EMPTY, BID_TYPES } from "./data.js"

const C = {
  navy:"#0C447C",navyM:"#185FA5",navyL:"#E6F1FB",
  green:"#1D9E75",greenL:"#EAF3DE",
  amber:"#BA7517",amberL:"#FAEEDA",
  red:"#A32D2D",  redL:"#FCEBEB",
  gray:"#888780", grayL:"#F1EFE8",
}
const S = {
  card:(x={})=>({background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:14,padding:"19px 22px",marginBottom:16,...x}),
  th:(a="left")=>({padding:"10px 12px",textAlign:a,fontSize:13,fontWeight:600,color:"var(--color-text-secondary,#888)",background:"var(--color-background-secondary,#f8f8f6)",borderBottom:"1px solid var(--color-border-tertiary,#eee)",whiteSpace:"nowrap"}),
  td:(a="right")=>({padding:"9px 12px",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",textAlign:a,fontSize:13.5,verticalAlign:"middle"}),
  bdg:(bg,fg)=>({display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:10,fontSize:12,fontWeight:600,background:bg,color:fg}),
  inp:(w=120)=>({width:w,padding:"7px 9px",border:"1px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:13,fontFamily:"inherit",background:"#fff",color:"#222"}),
  btn:(bg=C.navyM,fg="#fff")=>({padding:"9px 16px",background:bg,color:fg,border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}),
  lbl:()=>({display:"block",fontSize:11,color:C.gray,fontWeight:600,marginBottom:3}),
}
const cardTitle = {fontSize:16,fontWeight:700,marginBottom:4,letterSpacing:-.2}
const cardNote  = {fontSize:12,color:C.gray,marginBottom:12}
const num = v => { const n=parseFloat(v); return Number.isFinite(n)?n:0 }
const median = arr => { if(!arr.length) return null; const s=[...arr].sort((a,b)=>a-b); const mid=Math.floor(s.length/2); return s.length%2 ? s[mid] : (s[mid-1]+s[mid])/2 }

function SCard({title,note,actions,children}) {
  return <div style={S.card()}>
    {title && <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:4}}>
      <div><div style={cardTitle}>{title}</div>{note&&<div style={cardNote}>{note}</div>}</div>
      {actions}
    </div>}
    {children}
  </div>
}

// 모든 프로젝트의 최신버전 협력업체 항목을 업체명 기준으로 집계
function buildDirectory(projects){
  const map = {}
  projects.forEach(p=>{
    const ver = p.versions?.[p.versions.length-1]
    if(!ver) return
    ;(ver.vendors||[]).forEach(vd=>{
      if(!vd.name) return
      if(!map[vd.name]) map[vd.name] = {name:vd.name, cats:new Set(), items:[], total:0}
      map[vd.name].cats.add(vd.cat)
      const amt = vd.nego2||vd.nego1||vd.contract||0
      map[vd.name].items.push({proj:p, projId:p.id, projName:p.name, projCode:p.code, cat:vd.cat, contract:vd.contract, nego1:vd.nego1, nego2:vd.nego2, amt, bidType:p.bidType||"기타", ver:ver.ver})
      map[vd.name].total += amt
    })
  })
  return Object.values(map).map(v=>({...v,cats:[...v.cats]})).sort((a,b)=>b.total-a.total)
}

export function VendorsTab({projects,setProjects,vendorsDB,setVendorsDB,vendorPayments,setVendorPayments,canWrite,currentUser,setTab,setSelProjId,setSelVerIdx}) {
  const directory = useMemo(()=>buildDirectory(projects),[projects])
  const [view,setView]   = useState("list")
  const [selVendor,setSelVendor] = useState(null)
  const [search,setSearch] = useState("")

  // 엑셀 다운로드
  const downloadVendors = () => {
    const rows = [
      ["협력업체명","사업자번호","업무구분","대표자","전화번호","이메일","주소","참여프로젝트수","외주비지급이력수"],
      ...Object.values(vendorsDB).map(v=>[
        v.name||"", v.bizNo||"", v.bizType||"",
        v.rep||"", v.tel||"", v.repMail||"", v.addr||"",
        (v.projects||[]).length,
        (v.paymentHistory||[]).length
      ])
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws["!cols"] = [{wch:30},{wch:14},{wch:12},{wch:12},{wch:14},{wch:24},{wch:40},{wch:12},{wch:12}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "협력업체")
    XLSX.writeFile(wb, `상지서울_협력업체_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // 엑셀 업로드
  const uploadVendors = (e) => {
    const file = e.target.files?.[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try{
        const wb = XLSX.read(ev.target.result, {type:"binary"})
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""})
        const headers = rows[0].map(h=>String(h).trim())
        const ni = (names) => { for(const n of names){ const i=headers.findIndex(h=>h.includes(n)); if(i>=0)return i }; return -1 }
        const CI = { name:ni(["협력업체명","업체명","회사명"]), bizNo:ni(["사업자번호"]), bizType:ni(["업무구분","구분"]),
                     rep:ni(["대표자"]), tel:ni(["전화번호","연락처"]), mail:ni(["이메일","메일"]), addr:ni(["주소"]) }
        let added=0, updated=0
        setVendorsDB(prev=>{
          const next = {...prev}
          rows.slice(1).forEach(r=>{
            const name = CI.name>=0?String(r[CI.name]).trim():""
            if(!name) return
            const existing = Object.values(next).find(v=>v.name===name)
            if(existing) {
              next[existing.id] = {...existing, bizNo:r[CI.bizNo]||existing.bizNo, bizType:r[CI.bizType]||existing.bizType,
                rep:r[CI.rep]||existing.rep, tel:r[CI.tel]||existing.tel, addr:r[CI.addr]||existing.addr}
              updated++
            } else {
              const id = `V${Date.now()}_${added}`
              next[id] = {id, name, bizNo:r[CI.bizNo]||"", bizType:r[CI.bizType]||"", rep:r[CI.rep]||"",
                tel:r[CI.tel]||"", repMail:r[CI.mail]||"", addr:r[CI.addr]||"", projects:[], paymentHistory:[], memo:[]}
              added++
            }
          })
          return next
        })
        alert(`✅ 완료: 신규 ${added}건 추가, 업데이트 ${updated}건`)
      }catch(e){ alert("업로드 오류: "+e.message) }
    }
    reader.readAsBinaryString(file)
    e.target.value=""
  }

  const NAV = [
    {id:"list",    label:"📇 업체목록"},
    {id:"compare", label:"📊 외주비 비교(유형별)"},
    {id:"draft",   label:"📝 실행초안 생성"},
  ]

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>{setView(n.id);if(n.id!=="list")setSelVendor(null)}} style={{
            padding:"11px 18px",border:"none",borderRadius:11,fontSize:14.5,fontWeight:700,cursor:"pointer",
            background:(view===n.id||(n.id==="list"&&view==="detail"))?C.navy:"var(--color-background-primary,#fff)",
            color:(view===n.id||(n.id==="list"&&view==="detail"))?"#fff":"var(--color-text-secondary,#888)",
            boxShadow:(view===n.id||(n.id==="list"&&view==="detail"))?"0 2px 10px rgba(12,68,124,.25)":"0 0 0 0.5px var(--color-border-tertiary,#e4e4e0)",
          }}>{n.label}</button>
        ))}
        {/* 업다운로드 버튼 */}
        <div style={{marginLeft:"auto",display:"flex",gap:6}}>
          <button onClick={downloadVendors}
            style={{...S.btn("var(--color-background-secondary,#f3f3f0)","var(--color-text-primary,#222)"),fontSize:12.5,padding:"7px 13px"}}>
            ⬇ 전체 다운로드
          </button>
          {canWrite&&<label style={{...S.btn(C.navyM),fontSize:12.5,padding:"7px 13px",cursor:"pointer"}}>
            ⬆ 엑셀 업로드
            <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={uploadVendors}/>
          </label>}
        </div>
      </div>

      {view==="list" && (
        <VendorList directory={directory} search={search} setSearch={setSearch} vendorsDB={vendorsDB}
          onSelect={v=>{setSelVendor(v);setView("detail")}}/>
      )}
      {view==="detail" && selVendor && (
        <VendorDetail entry={directory.find(d=>d.name===selVendor.name)||selVendor}
          vendorsDB={vendorsDB} setVendorsDB={setVendorsDB}
          vendorPayments={vendorPayments} setVendorPayments={setVendorPayments}
          canWrite={canWrite} currentUser={currentUser}
          onBack={()=>{setView("list");setSelVendor(null)}}/>
      )}
      {view==="compare" && <VendorCompare directory={directory}/>}
      {view==="draft" && <VendorDraft projects={projects} setProjects={setProjects} directory={directory}
        canWrite={canWrite} setTab={setTab} setSelProjId={setSelProjId} setSelVerIdx={setSelVerIdx}/>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 1) 업체 목록
// ════════════════════════════════════════════════════════════
function VendorList({directory,search,setSearch,vendorsDB,onSelect}) {
  const rows = directory.filter(d=>!search.trim()||d.name.includes(search.trim()))
  return (
    <SCard title="📇 협력업체 목록" note="최근 버전 기준 참여 프로젝트·계약액을 집계합니다. 업체를 클릭하면 상세정보·지급내역을 확인/입력할 수 있습니다.">
      <div style={{marginBottom:12}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="업체명 검색" style={{...S.inp(260)}}/>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}>
          <thead><tr>
            <th style={S.th()}>업체명</th><th style={S.th()}>주요분야</th>
            <th style={S.th("right")}>참여 프로젝트</th><th style={S.th("right")}>누적 계약액(억)</th>
            <th style={S.th()}>대표자</th><th style={S.th()}>담당자</th>
          </tr></thead>
          <tbody>
            {rows.length===0 && <tr><td colSpan={6} style={{...S.td("left"),color:C.gray}}>등록된 협력업체가 없습니다. 프로젝트 실행계획서의 협력업체 비용 항목에 업체명을 입력하면 여기에 표시됩니다.</td></tr>}
            {rows.map((d,i)=>{
              const info = vendorsDB?.[d.name]||VENDOR_EMPTY
              return (
                <tr key={d.name} onClick={()=>onSelect(d)} style={{cursor:"pointer",background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(24,95,165,.05)"}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}>
                  <td style={{...S.td("left"),fontWeight:700,color:C.navyM}}>{d.name}</td>
                  <td style={S.td("left")}>{d.cats.join(", ")}</td>
                  <td style={S.td()}>{d.items.length}건</td>
                  <td style={{...S.td(),fontWeight:700}}>{fE(d.total/1e8)}</td>
                  <td style={{...S.td("left"),fontSize:12,color:C.gray}}>{info.ceoName||"-"}{info.ceoPhone?` · ${info.ceoPhone}`:""}</td>
                  <td style={{...S.td("left"),fontSize:12,color:C.gray}}>{info.contactName||"-"}{info.contactPhone?` · ${info.contactPhone}`:""}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </SCard>
  )
}

// ════════════════════════════════════════════════════════════
// 2) 업체 상세 — 기본정보 / 수행 프로젝트 / 지급내역
// ════════════════════════════════════════════════════════════
function VendorDetail({entry,vendorsDB,setVendorsDB,vendorPayments,setVendorPayments,canWrite,currentUser,onBack}) {
  const info = vendorsDB?.[entry.name]||VENDOR_EMPTY
  const [editing,setEditing] = useState(false)
  const [draft,setDraft]     = useState({...VENDOR_EMPTY,...info})
  const [subTab,setSubTab]   = useState("info")  // info | docs | history | payments

  const start  = ()=>{ setDraft({...VENDOR_EMPTY,...info}); setEditing(true) }
  const save   = ()=>{ setVendorsDB(prev=>({...prev,[entry.name]:draft})); setEditing(false) }
  const cancel = ()=>{ setEditing(false); setDraft({...VENDOR_EMPTY,...info}) }

  const myPayments = (vendorPayments||[]).filter(p=>p.vendor===entry.name)

  // ── 문서 관리 ─────────────────────────────────────────────
  const docs = info.docs || []
  const DOC_CATS = ["사업자등록증","통장사본","계약서","견적서","기타서류"]
  const addDoc = (docObj) => {
    setVendorsDB(prev=>({...prev,[entry.name]:{...info,docs:[...docs,docObj]}}))
  }
  const removeDoc = (id) => {
    setVendorsDB(prev=>({...prev,[entry.name]:{...info,docs:docs.filter(d=>d.id!==id)}}))
  }

  // ── 히스토리 (날짜별 사안 기록) ──────────────────────────
  const history = info.history || []
  const HIST_CATS = ["계약","변경계약","대금지급","서류수취","미팅","기타"]
  const [hDate,setHDate] = useState(new Date().toISOString().slice(0,10))
  const [hCat, setHCat]  = useState("기타")
  const [hText,setHText] = useState("")
  const [hMemo,setHMemo] = useState("")
  const [editHId,setEditHId] = useState(null)
  const [editHDraft,setEHD] = useState({})

  const addHistory = () => {
    if(!hText.trim()) return
    const h = {id:`H${Date.now()}`,date:hDate,category:hCat,content:hText.trim(),memo:hMemo.trim(),
      createdAt:new Date().toISOString(),createdBy:currentUser?.name||""}
    setVendorsDB(prev=>({...prev,[entry.name]:{...(vendorsDB?.[entry.name]||VENDOR_EMPTY),history:[...history,h].sort((a,b)=>a.date.localeCompare(b.date))}}))
    setHText(""); setHMemo("")
  }
  const saveHEdit = () => {
    const updated = history.map(h=>h.id===editHId?{...h,...editHDraft,updatedAt:new Date().toISOString(),updatedBy:currentUser?.name}:h)
    setVendorsDB(prev=>({...prev,[entry.name]:{...(vendorsDB?.[entry.name]||VENDOR_EMPTY),history:updated}}))
    setEditHId(null)
  }
  const removeHistory = id => {
    if(!window.confirm("이 기록을 삭제하시겠습니까?")) return
    setVendorsDB(prev=>({...prev,[entry.name]:{...(vendorsDB?.[entry.name]||VENDOR_EMPTY),history:history.filter(h=>h.id!==id)}}))
  }

  // 지급 추가
  const [pProj,setPProj] = useState(entry.items[0]?.projId||"")
  const [pCat,setPCat]   = useState("")
  const [pAmt,setPAmt]   = useState(0)
  const [pDate,setPDate] = useState(new Date().toISOString().slice(0,10))
  const [pNote,setPNote] = useState("")
  const addPayment = ()=>{
    if(!pProj||!pAmt) return
    const projName = entry.items.find(it=>it.projId===pProj)?.projName||""
    setVendorPayments(prev=>[...(prev||[]),{id:`PAY${Date.now()}`,vendor:entry.name,projectId:pProj,projName,cat:pCat,amount:num(pAmt),date:pDate,note:pNote,by:currentUser?.name}])
    setPAmt(0); setPNote("")
  }

  const FIELDS=[["ceoName","대표자명"],["ceoPhone","대표자 연락처"],["ceoEmail","대표자 이메일"],["contactName","담당자명"],["contactPhone","담당자 연락처"],["contactEmail","담당자 이메일"]]
  const catColor={계약:"#3B72F6",변경계약:"#F59E0B",대금지급:"#0EA86E",서류수취:"#534AB7",미팅:"#9CA3AF",기타:"#6B7280"}
  const fmtDT = iso => iso?new Date(iso).toLocaleString("ko-KR",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):""

  return (
    <div>
      <button onClick={onBack} style={{...S.btn(C.grayL,"#555"),marginBottom:12,padding:"7px 14px",fontSize:12}}>← 목록으로</button>

      {/* 헤더 */}
      <SCard title={`🏢 ${entry.name}`} note={`참여 프로젝트 ${entry.items.length}건 · 누적 계약액 ${fE(entry.total/1e8)}`}
        actions={canWrite&&(!editing
          ?<button onClick={start} style={{...S.btn(C.navyL,C.navyM),padding:"6px 13px",fontSize:12}}>✏ 정보 수정</button>
          :<div style={{display:"flex",gap:8}}>
            <button onClick={save} style={{...S.btn(C.green),padding:"6px 13px",fontSize:12}}>저장</button>
            <button onClick={cancel} style={{...S.btn(C.grayL,C.gray),padding:"6px 13px",fontSize:12}}>취소</button>
          </div>)}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {FIELDS.map(([k,l])=>(
            <div key={k}>
              <label style={S.lbl()}>{l}</label>
              {editing
                ?<input value={draft[k]||""} onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))} style={{...S.inp(),width:"100%"}}/>
                :<div style={{fontSize:14,fontWeight:info[k]?600:400,color:info[k]?undefined:C.gray,padding:"7px 0"}}>{info[k]||"미입력"}</div>}
            </div>
          ))}
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl()}>비고</label>
            {editing
              ?<input value={draft.note||""} onChange={e=>setDraft(p=>({...p,note:e.target.value}))} style={{...S.inp(),width:"100%"}}/>
              :<div style={{fontSize:13,color:info.note?undefined:C.gray}}>{info.note||"-"}</div>}
          </div>
        </div>
      </SCard>

      {/* 서브탭 */}
      <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:"2px solid #E5E7EB"}}>
        {[["info","🏗 프로젝트·지급"],["docs","📎 문서보관"],["history","📅 사안기록"],["payments","💰 지급내역"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setSubTab(id)} style={{padding:"9px 18px",border:"none",background:"none",fontSize:13.5,fontWeight:700,cursor:"pointer",
            color:subTab===id?C.navyM:"#6B7280",borderBottom:subTab===id?`3px solid ${C.navyM}`:"3px solid transparent",marginBottom:-2}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── 프로젝트·지급 탭 ── */}
      {subTab==="info"&&(
        <SCard title="🏗 수행 프로젝트">
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={S.th()}>프로젝트</th><th style={S.th()}>분야</th>
                <th style={S.th("right")}>계약액(원)</th><th style={S.th("right")}>적용금액</th>
                <th style={S.th("right")}>지급액</th><th style={S.th("right")}>잔여</th>
              </tr></thead>
              <tbody>
                {entry.items.map((it,i)=>{
                  const paid = (vendorPayments||[]).filter(p=>p.vendor===entry.name&&p.projectId===it.projId).reduce((s,p)=>s+num(p.amount),0)
                  const applied = it.nego2||it.nego1||it.contract||0
                  return (
                    <tr key={i} style={{background:i%2===0?"#fff":"#FAFAFA"}}>
                      <td style={S.td("left")}><div style={{fontWeight:600}}>{it.projName}</div><div style={{fontSize:11,color:"#9CA3AF"}}>{it.projId}</div></td>
                      <td style={S.td("left")}><span style={{...S.bdg(C.navyL,C.navyM),fontSize:11}}>{it.cat}</span></td>
                      <td style={S.td()}>{it.contract>0?it.contract.toLocaleString():"-"}</td>
                      <td style={{...S.td(),fontWeight:700,color:C.navyM}}>{applied>0?applied.toLocaleString():"-"}</td>
                      <td style={{...S.td(),color:"#0EA86E",fontWeight:600}}>{paid>0?paid.toLocaleString():"-"}</td>
                      <td style={{...S.td(),color:applied-paid>0?"#EF4444":"#0EA86E",fontWeight:700}}>{applied>0?(applied-paid).toLocaleString():"-"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SCard>
      )}

      {/* ── 문서 보관 탭 ── */}
      {subTab==="docs"&&(
        <SCard title="📎 문서 보관" note="사업자등록증·통장사본·계약서 등 협력업체 관련 문서를 보관합니다">
          {canWrite&&(
            <DocUploadForm onAdd={addDoc} cats={DOC_CATS}/>
          )}
          {docs.length===0
            ?<div style={{padding:"30px",textAlign:"center",color:"#9CA3AF",fontSize:13}}>등록된 문서가 없습니다. 위에서 문서를 추가하세요.</div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10,marginTop:12}}>
              {docs.map(doc=>(
                <div key={doc.id} style={{background:"#F8FAFC",borderRadius:12,border:"1px solid #E5E7EB",padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:20}}>{doc.category==="사업자등록증"?"🏢":doc.category==="통장사본"?"💳":doc.category==="계약서"?"📄":"📎"}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13.5,fontWeight:700,color:"#111827"}}>{doc.title}</div>
                      <div style={{fontSize:11,color:"#9CA3AF"}}>{doc.category} · {doc.date}</div>
                    </div>
                    {canWrite&&<button onClick={()=>removeDoc(doc.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:14}}>✕</button>}
                  </div>
                  {doc.memo&&<div style={{fontSize:12,color:"#6B7280",marginBottom:6}}>{doc.memo}</div>}
                  {doc.fileData
                    ?<a href={doc.fileData} download={doc.fileName} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 11px",background:"#EEF3FF",color:"#3B72F6",borderRadius:8,fontSize:12.5,fontWeight:700,textDecoration:"none"}}>⬇ 다운로드</a>
                    :<span style={{fontSize:12,color:"#9CA3AF"}}>파일 없음</span>}
                  <div style={{fontSize:10.5,color:"#9CA3AF",marginTop:5}}>{doc.createdBy} · {fmtDT(doc.createdAt)}</div>
                </div>
              ))}
            </div>
          }
        </SCard>
      )}

      {/* ── 사안 기록 탭 ── */}
      {subTab==="history"&&(
        <SCard title="📅 사안별 날짜 기록" note="계약·변경·대금지급 등 주요 사안을 날짜별로 기록합니다">
          {canWrite&&(
            <div style={{background:"#F8FAFC",borderRadius:12,padding:"14px 16px",marginBottom:14,border:"1px solid #E5E7EB",display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
              <div><label style={S.lbl()}>날짜</label><input type="date" value={hDate} onChange={e=>setHDate(e.target.value)} style={{...S.inp(140)}}/></div>
              <div><label style={S.lbl()}>구분</label><select value={hCat} onChange={e=>setHCat(e.target.value)} style={{...S.inp(110)}}>{HIST_CATS.map(c=><option key={c}>{c}</option>)}</select></div>
              <div style={{flex:1,minWidth:200}}><label style={S.lbl()}>내용 *</label><input value={hText} onChange={e=>setHText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addHistory()} placeholder="예: 2차 계약 변경 체결" style={{...S.inp(),width:"100%"}}/></div>
              <div style={{flex:1,minWidth:160}}><label style={S.lbl()}>메모</label><input value={hMemo} onChange={e=>setHMemo(e.target.value)} placeholder="추가 메모" style={{...S.inp(),width:"100%"}}/></div>
              <button onClick={addHistory} style={{...S.btn(C.navyM),padding:"9px 16px"}}>+ 추가</button>
            </div>
          )}
          {/* 타임라인 */}
          {history.length===0
            ?<div style={{padding:"24px",textAlign:"center",color:"#9CA3AF",fontSize:13}}>등록된 기록이 없습니다.</div>
            :<div style={{position:"relative",paddingLeft:8}}>
              <div style={{position:"absolute",left:120,top:0,bottom:0,width:2,background:"#E5E7EB"}}/>
              {[...history].reverse().map(h=>(
                <div key={h.id} style={{display:"flex",gap:14,marginBottom:10,alignItems:"flex-start"}}>
                  <div style={{width:112,flexShrink:0,textAlign:"right",paddingTop:3,fontSize:12.5,fontWeight:700,color:"#374151"}}>{h.date}</div>
                  <div style={{width:10,height:10,borderRadius:"50%",background:catColor[h.category]||"#9CA3AF",flexShrink:0,marginTop:5,zIndex:1,border:"2px solid #fff",boxShadow:`0 0 0 2px ${catColor[h.category]||"#9CA3AF"}`}}/>
                  <div style={{flex:1,background:"#fff",borderRadius:10,border:"1px solid #E5E7EB",padding:"10px 14px"}}>
                    {editHId===h.id
                      ?<div style={{display:"flex",flexDirection:"column",gap:7}}>
                        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                          <input type="date" value={editHDraft.date} onChange={e=>setEHD(p=>({...p,date:e.target.value}))} style={S.inp(140)}/>
                          <select value={editHDraft.category} onChange={e=>setEHD(p=>({...p,category:e.target.value}))} style={S.inp(110)}>{HIST_CATS.map(c=><option key={c}>{c}</option>)}</select>
                        </div>
                        <input value={editHDraft.content} onChange={e=>setEHD(p=>({...p,content:e.target.value}))} style={{...S.inp(),width:"100%"}}/>
                        <input value={editHDraft.memo||""} onChange={e=>setEHD(p=>({...p,memo:e.target.value}))} placeholder="메모" style={{...S.inp(),width:"100%"}}/>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={saveHEdit} style={{...S.btn(C.green),padding:"5px 12px",fontSize:12}}>저장</button>
                          <button onClick={()=>setEditHId(null)} style={{...S.btn(C.grayL,C.gray),padding:"5px 12px",fontSize:12}}>취소</button>
                        </div>
                      </div>
                      :<>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontSize:11.5,padding:"2px 8px",borderRadius:10,background:(catColor[h.category]||"#9CA3AF")+"22",color:catColor[h.category]||"#9CA3AF",fontWeight:700}}>{h.category}</span>
                          <span style={{fontSize:14,fontWeight:700,color:"#111827",flex:1}}>{h.content}</span>
                          {canWrite&&<div style={{display:"flex",gap:4,marginLeft:"auto"}}>
                            <button onClick={()=>{setEditHId(h.id);setEHD({date:h.date,category:h.category,content:h.content,memo:h.memo||""})}} style={{...S.btn(C.navyL,C.navyM),padding:"3px 9px",fontSize:11}}>수정</button>
                            <button onClick={()=>removeHistory(h.id)} style={{...S.btn(C.redL,C.red),padding:"3px 9px",fontSize:11}}>삭제</button>
                          </div>}
                        </div>
                        {h.memo&&<div style={{fontSize:12.5,color:"#6B7280",background:"#F8FAFC",borderRadius:7,padding:"5px 9px",marginTop:4}}>📝 {h.memo}</div>}
                        <div style={{fontSize:10.5,color:"#9CA3AF",marginTop:4}}>
                          {h.createdBy&&`${h.createdBy} · `}{fmtDT(h.createdAt)}
                          {h.updatedAt&&` · 수정: ${h.updatedBy||""} ${fmtDT(h.updatedAt)}`}
                        </div>
                      </>}
                  </div>
                </div>
              ))}
            </div>
          }
        </SCard>
      )}

      {/* ── 지급내역 탭 ── */}
      {subTab==="payments"&&(
        <SCard title="💰 지급내역">
          {canWrite&&entry.items.length>0&&(
            <div style={{background:"#F8FAFC",borderRadius:10,padding:"12px 14px",marginBottom:12,border:"1px solid #E5E7EB",display:"flex",gap:7,flexWrap:"wrap",alignItems:"flex-end"}}>
              <div><label style={S.lbl()}>프로젝트</label><select value={pProj} onChange={e=>setPProj(e.target.value)} style={S.inp(160)}>{entry.items.map(it=><option key={it.projId} value={it.projId}>{it.projName?.slice(0,14)}</option>)}</select></div>
              <div><label style={S.lbl()}>공종</label><input value={pCat} onChange={e=>setPCat(e.target.value)} style={S.inp(90)} placeholder="구조"/></div>
              <div><label style={S.lbl()}>금액(원)</label><input type="number" value={pAmt} onChange={e=>setPAmt(e.target.value)} style={S.inp(130)}/></div>
              <div><label style={S.lbl()}>지급일</label><input type="date" value={pDate} onChange={e=>setPDate(e.target.value)} style={S.inp(140)}/></div>
              <div style={{flex:1}}><label style={S.lbl()}>메모</label><input value={pNote} onChange={e=>setPNote(e.target.value)} style={{...S.inp(),width:"100%"}} placeholder="세금계산서 수취 등"/></div>
              <button onClick={addPayment} style={{...S.btn(C.green),padding:"9px 14px"}}>+ 지급 등록</button>
            </div>
          )}
          {myPayments.length===0
            ?<div style={{padding:"24px",textAlign:"center",color:"#9CA3AF",fontSize:13}}>지급 기록이 없습니다.</div>
            :<table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={S.th()}>날짜</th><th style={S.th()}>프로젝트</th><th style={S.th()}>공종</th>
                <th style={S.th("right")}>금액(원)</th><th style={S.th()}>메모</th><th style={S.th()}>등록자</th><th style={S.th()}></th>
              </tr></thead>
              <tbody>{myPayments.map((p,i)=>(
                <tr key={p.id} style={{background:i%2===0?"#fff":"#FAFAFA"}}>
                  <td style={S.td("left")}>{p.date}</td>
                  <td style={S.td("left")}>{p.projName?.slice(0,14)||"-"}</td>
                  <td style={S.td("left")}>{p.cat||"-"}</td>
                  <td style={{...S.td(),fontWeight:700,color:"#0EA86E"}}>{num(p.amount).toLocaleString()}</td>
                  <td style={S.td("left")}>{p.note||"-"}</td>
                  <td style={S.td("left")}>{p.by||"-"}</td>
                  <td style={S.td("center")}>{canWrite&&<button onClick={()=>setVendorPayments(prev=>(prev||[]).filter(x=>x.id!==p.id))} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:14}}>✕</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          }
        </SCard>
      )}
    </div>
  )
}

// ── 문서 업로드 폼 ───────────────────────────────────────────
function DocUploadForm({onAdd,cats}) {
  const [title,setTitle] = useState("")
  const [cat,  setCat  ] = useState(cats[0]||"기타")
  const [date, setDate ] = useState(new Date().toISOString().slice(0,10))
  const [memo, setMemo ] = useState("")
  const [file, setFile ] = useState(null)
  const [preview,setPreview] = useState(null)
  const fileRef = useRef(null)
  const fmtSize = b => b>1024*1024?`${(b/1024/1024).toFixed(1)}MB`:`${Math.round(b/1024)}KB`

  const pick = async(e) => {
    const f=e.target.files?.[0]; if(!f) return
    if(f.size>15*1024*1024){alert("15MB 이하 파일만 가능합니다.");return}
    setFile(f)
    const reader=new FileReader()
    reader.onload=ev=>setPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const add = () => {
    if(!title.trim()) { alert("문서명을 입력하세요."); return }
    onAdd({id:`D${Date.now()}`,title:title.trim(),category:cat,date,memo:memo.trim(),
      fileData:preview,fileName:file?.name||null,fileSize:file?.size||null,
      createdAt:new Date().toISOString(),createdBy:""})
    setTitle("");setMemo("");setFile(null);setPreview(null)
    if(fileRef.current)fileRef.current.value=""
  }

  const S2={inp:{padding:"8px 11px",border:"1.5px solid #E5E7EB",borderRadius:9,fontSize:13.5,fontFamily:"inherit",outline:"none",boxSizing:"border-box",width:"100%"}}
  return(
    <div style={{background:"#EEF3FF",borderRadius:12,padding:"14px 16px",marginBottom:14,border:"1px solid #3B72F633"}}>
      <div style={{fontSize:13.5,fontWeight:700,color:"#3B72F6",marginBottom:10}}>📎 문서 추가</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>문서명 *</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 사업자등록증 2026" style={S2.inp}/></div>
        <div><label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>분류</label><select value={cat} onChange={e=>setCat(e.target.value)} style={S2.inp}>{cats.map(c=><option key={c}>{c}</option>)}</select></div>
        <div><label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>날짜</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={S2.inp}/></div>
        <div style={{gridColumn:"span 2"}}><label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>메모</label><input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="추가 메모" style={S2.inp}/></div>
        <div><label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>파일 첨부</label>
          <div onClick={()=>fileRef.current?.click()} style={{border:"1.5px dashed #3B72F6",borderRadius:9,padding:"8px 12px",cursor:"pointer",textAlign:"center",background:"#fff",fontSize:13}}>
            {file?<span style={{color:"#0EA86E",fontWeight:700}}>✓ {file.name} ({fmtSize(file.size)})</span>:<span style={{color:"#9CA3AF"}}>클릭하여 파일 선택</span>}
          </div>
          <input ref={fileRef} type="file" style={{display:"none"}} accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.hwp" onChange={pick}/>
        </div>
      </div>
      <button onClick={add} style={{padding:"9px 20px",background:"#3B72F6",color:"#fff",border:"none",borderRadius:10,fontSize:13.5,fontWeight:700,cursor:"pointer"}}>+ 문서 추가</button>
    </div>
  )
}


function VendorCompare({directory}) {
  const allCats = useMemo(()=>[...new Set(directory.flatMap(d=>d.cats))].sort(),[directory])
  const [cat,setCat] = useState(allCats[0]||"")

  const rows = useMemo(()=>{
    if(!cat) return []
    const items=[]
    directory.forEach(d=>d.items.forEach(it=>{
      if(it.cat!==cat) return
      const amt = it.nego2||it.nego1||it.contract||0
      const up = calcUP(amt, it.cat, it.proj)
      if(up==null) return
      items.push({vendor:d.name, projName:it.projName, bidType:it.bidType, up, amt})
    }))
    return items
  },[directory,cat])

  const byType = useMemo(()=>{
    const out={}
    rows.forEach(r=>{
      if(!out[r.bidType]) out[r.bidType]={ups:[],count:0}
      out[r.bidType].ups.push(r.up); out[r.bidType].count++
    })
    return BID_TYPES.map(t=>{
      const ups=out[t]?.ups||[]
      return {type:t, count:ups.length, avg: ups.length?ups.reduce((s,v)=>s+v,0)/ups.length:0,
        min: ups.length?Math.min(...ups):0, max: ups.length?Math.max(...ups):0}
    }).filter(r=>r.count>0)
  },[rows])

  const basis = cat?getAreaBasis(cat):"-"

  return (
    <div>
      <SCard title="📊 수주형태별 외주비(평당단가) 비교" note="동일 분야의 협력업체 계약 평당단가를 민간수의/제안공모/경쟁설계 등 수주형태별로 비교합니다.">
        <div style={{marginBottom:12}}>
          <label style={S.lbl()}>분야 선택</label>
          <select value={cat} onChange={e=>setCat(e.target.value)} style={{...S.inp(220)}}>
            {allCats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          {cat&&<span style={{fontSize:12,color:C.gray,marginLeft:10}}>면적기준: {basis==="1식"?"1식 (평당단가 비교 불가)":basis}</span>}
        </div>

        {byType.length===0
          ? <div style={{padding:"12px 14px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:13}}>해당 분야는 평당단가 비교가 가능한 데이터가 없습니다. (면적기준이 "1식"인 분야는 비교 대상에서 제외됩니다.)</div>
          : <>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byType.map(r=>({name:r.type,평균평당단가:Math.round(r.avg)}))} barCategoryGap="30%" margin={{top:24,right:10,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                <XAxis dataKey="name" tick={{fontSize:12,fontWeight:600}}/>
                <YAxis tick={{fontSize:10}} tickFormatter={v=>(v/10000).toFixed(0)+"만"}/>
                <Tooltip formatter={v=>v.toLocaleString()+"원/평"}/>
                <Bar dataKey="평균평당단가" fill={C.navyM} radius={[5,5,0,0]} barSize={64}>
                  <LabelList dataKey="평균평당단가" position="top" formatter={v=>(v/10000).toFixed(0)+"만"} style={{fontSize:12,fontWeight:700,fill:C.navyM}}/>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{overflowX:"auto",marginTop:8}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
                <thead><tr><th style={S.th()}>수주형태</th><th style={S.th("right")}>사례수</th><th style={S.th("right")}>평균(원/평)</th><th style={S.th("right")}>최소(원/평)</th><th style={S.th("right")}>최대(원/평)</th></tr></thead>
                <tbody>{byType.map(r=>(
                  <tr key={r.type}>
                    <td style={{...S.td("left"),fontWeight:700}}>{r.type}</td>
                    <td style={S.td()}>{r.count}건</td>
                    <td style={{...S.td(),fontWeight:700,color:C.navyM}}>{Math.round(r.avg).toLocaleString()}</td>
                    <td style={S.td()}>{Math.round(r.min).toLocaleString()}</td>
                    <td style={S.td()}>{Math.round(r.max).toLocaleString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>}
      </SCard>

      {rows.length>0 && (
        <SCard title="상세 사례" note="평당단가가 낮은 순으로 정렬됩니다.">
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
              <thead><tr><th style={S.th()}>업체명</th><th style={S.th()}>프로젝트</th><th style={S.th()}>수주형태</th><th style={S.th("right")}>평당단가(원)</th></tr></thead>
              <tbody>{rows.slice().sort((a,b)=>a.up-b.up).map((r,i)=>(
                <tr key={i} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={{...S.td("left"),fontWeight:600}}>{r.vendor}</td>
                  <td style={S.td("left")}>{r.projName}</td>
                  <td style={S.td("left")}><span style={S.bdg(C.navyL,C.navyM)}>{r.bidType}</span></td>
                  <td style={{...S.td(),fontWeight:700}}>{Math.round(r.up).toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </SCard>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 4) 실행초안 생성 — 동일 수주형태 사례의 평당단가 기준
// ════════════════════════════════════════════════════════════
function VendorDraft({projects,setProjects,directory,canWrite,setTab,setSelProjId,setSelVerIdx}) {
  const [projId,setProjId] = useState(projects[0]?.id||"")
  const proj = projects.find(p=>p.id===projId)
  const allCats = useMemo(()=>[...new Set(directory.flatMap(d=>d.cats))].sort(),[directory])
  const [cat,setCat] = useState(allCats[0]||"")

  const basis = cat?getAreaBasis(cat):"-"
  const py = proj ? (basis==="대지" ? (proj.siteArea||0)/3.3058 : basis==="연면적" ? (proj.floorArea||0)/3.3058 : 0) : 0

  const comparable = useMemo(()=>{
    if(!proj||!cat) return []
    const items=[]
    directory.forEach(d=>d.items.forEach(it=>{
      if(it.cat!==cat||it.projId===proj.id||it.bidType!==(proj.bidType||"기타")) return
      const amt = it.nego2||it.nego1||it.contract||0
      const up = calcUP(amt, it.cat, it.proj)
      if(up==null) return
      items.push({vendor:d.name, projName:it.projName, up})
    }))
    return items
  },[directory,proj,cat])

  const ups = comparable.map(c=>c.up)
  const med = median(ups)
  const suggested = (med!=null && py>0) ? Math.round(med*py) : null

  const last = proj?.versions?.[proj.versions.length-1]
  const existing = last?.vendors?.find(v=>v.cat===cat)

  const applyDraft = ()=>{
    if(!proj||suggested==null) return
    const newVendors = [...(last?.vendors||[]).filter(v=>v.cat!==cat), {cat, name:"(업체 선택 필요)", contract:suggested, nego1:null, nego2:null}]
    const newVer = {
      ver:`v${proj.versions.length+1}.0 외주비초안`,
      date:new Date().toISOString().slice(0,10),
      reason:`외주비 비교 기반 실행초안 — ${cat} (동일 수주형태 "${proj.bidType||"기타"}" ${comparable.length}건 평당단가 중간값 ${Math.round(med).toLocaleString()}원/평 기준)`,
      laborCost:last?.laborCost||0, directExp:last?.directExp||0, subContract:last?.subContract||0, indirect:null, profit:null,
      vendors:newVendors,
    }
    setProjects(prev=>prev.map(p=>p.id===proj.id?{...p,versions:[...p.versions,newVer]}:p))
    setSelProjId?.(proj.id); setSelVerIdx?.(proj.versions.length); setTab?.("projects")
  }

  return (
    <SCard title="📝 외주비 실행초안 생성" note="대상 프로젝트와 동일한 수주형태(민간수의/제안공모/경쟁설계 등)의 다른 프로젝트 사례에서 평당단가 중간값을 산출해 제안 계약금액을 만듭니다.">
      <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:16}}>
        <div>
          <label style={S.lbl()}>대상 프로젝트</label>
          <select value={projId} onChange={e=>setProjId(e.target.value)} style={{...S.inp(280)}}>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name.slice(0,28)} ({p.bidType||"기타"})</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl()}>분야</label>
          <select value={cat} onChange={e=>setCat(e.target.value)} style={{...S.inp(180)}}>
            {allCats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {!proj ? <div style={{color:C.gray,fontSize:13}}>프로젝트를 선택하세요.</div> : basis==="1식"
        ? <div style={{padding:"12px 14px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:13}}>"{cat}" 분야는 면적기준이 1식이라 평당단가 기반 초안을 생성할 수 없습니다.</div>
        : comparable.length===0
        ? <div style={{padding:"12px 14px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:13}}>"{proj.bidType||"기타"}" 수주형태의 "{cat}" 분야 비교 사례가 없습니다. (다른 수주형태 데이터만 존재)</div>
        : <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
            <div style={S.card({marginBottom:0,padding:"12px 14px"})}>
              <div style={{fontSize:11,color:C.gray,marginBottom:5}}>비교 사례 수 ({proj.bidType||"기타"})</div>
              <div style={{fontSize:20,fontWeight:800}}>{comparable.length}건</div>
            </div>
            <div style={S.card({marginBottom:0,padding:"12px 14px"})}>
              <div style={{fontSize:11,color:C.gray,marginBottom:5}}>평당단가 중간값</div>
              <div style={{fontSize:20,fontWeight:800,color:C.navyM}}>{Math.round(med).toLocaleString()}원</div>
            </div>
            <div style={S.card({marginBottom:0,padding:"12px 14px"})}>
              <div style={{fontSize:11,color:C.gray,marginBottom:5}}>대상 프로젝트 면적</div>
              <div style={{fontSize:20,fontWeight:800}}>{py.toLocaleString(undefined,{maximumFractionDigits:0})}평</div>
              <div style={{fontSize:10,color:C.gray}}>{basis} 기준</div>
            </div>
            <div style={S.card({marginBottom:0,padding:"12px 14px",background:C.navyL})}>
              <div style={{fontSize:11,color:C.navyM,marginBottom:5}}>제안 계약금액</div>
              <div style={{fontSize:20,fontWeight:800,color:C.navyM}}>{suggested!=null?fW(suggested):"-"}</div>
            </div>
          </div>

          {existing && (
            <div style={{...S.bdg(C.amberL,"#633806"),marginBottom:12,display:"block",padding:"8px 12px"}}>
              현재 최신버전에 "{cat}" 항목이 이미 있습니다 (업체: {existing.name||"-"}, 계약액 {(existing.contract||0).toLocaleString()}원). 초안 생성 시 새 버전에서 이 항목이 제안금액으로 대체됩니다.
            </div>
          )}

          <div style={{overflowX:"auto",marginBottom:14}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:520}}>
              <thead><tr><th style={S.th()}>업체명</th><th style={S.th()}>프로젝트</th><th style={S.th("right")}>평당단가(원)</th></tr></thead>
              <tbody>{comparable.slice().sort((a,b)=>a.up-b.up).map((c,i)=>(
                <tr key={i}><td style={S.td("left")}>{c.vendor}</td><td style={S.td("left")}>{c.projName}</td><td style={{...S.td(),fontWeight:600}}>{Math.round(c.up).toLocaleString()}</td></tr>
              ))}</tbody>
            </table>
          </div>

          {canWrite
            ? <button onClick={applyDraft} style={S.btn(C.navyM)}><i className="ti ti-file-plus" aria-hidden="true"/> 이 제안금액으로 신규버전 초안 생성</button>
            : <div style={{fontSize:12,color:C.gray}}>초안 생성은 입력 권한이 있는 계정에서 가능합니다.</div>}
          <div style={{fontSize:11,color:C.gray,marginTop:8}}>초안 생성 시 프로젝트 탭의 새 버전으로 추가되며, 업체명은 "(업체 선택 필요)"로 표시되어 직접 지정해야 합니다.</div>
        </>}
    </SCard>
  )
}
