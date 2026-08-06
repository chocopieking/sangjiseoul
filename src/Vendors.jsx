// ══════════════════════════════════════════════════════════════
// 협력업체 탭 — 업체정보 · 수행 프로젝트/지급내역 · 외주비 비교 · 실행초안
// ══════════════════════════════════════════════════════════════
import { useState, useMemo, useRef, useEffect } from "react"
import * as XLSX from "xlsx"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "./ReChartsFallback.jsx"
import { fW, fE, fPy, getAreaBasis, calcUP, VENDOR_EMPTY, BID_TYPES } from "./data.js"

const C = {
  navy:"#0C447C",navyM:"#0B6E63",navyL:"#E6F1FB",
  green:"#1D9E75",greenL:"#EAF3DE",
  amber:"#BA7517",amberL:"#FAEEDA",
  red:"#A32D2D",  redL:"#FCEBEB",
  gray:"#888780", grayL:"#F1EFE8",
}
const S = {
  card:(x={})=>({background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:14,padding:"19px 22px",marginBottom:16,...x}),
  th:(a="left")=>({padding:"10px 12px",textAlign:a,fontSize:19.5,fontWeight:600,color:"var(--color-text-secondary,#888)",background:"var(--color-background-secondary,#f8f8f6)",borderBottom:"1px solid var(--color-border-tertiary,#eee)",whiteSpace:"nowrap"}),
  td:(a="right")=>({padding:"9px 12px",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",textAlign:a,fontSize:20.2,verticalAlign:"middle"}),
  bdg:(bg,fg)=>({display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:10,fontSize:18,fontWeight:600,background:bg,color:fg}),
  inp:(w=120)=>({width:w,padding:"7px 9px",border:"1px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:19.5,fontFamily:"inherit",background:"#fff",color:"#222"}),
  btn:(bg=C.navyM,fg="#fff")=>({padding:"9px 16px",background:bg,color:fg,border:"none",borderRadius:10,fontSize:19.5,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}),
  lbl:()=>({display:"block",fontSize:16.5,color:C.gray,fontWeight:600,marginBottom:3}),
}
const cardTitle = {fontSize:24,fontWeight:700,marginBottom:4,letterSpacing:-.2}
const cardNote  = {fontSize:18,color:C.gray,marginBottom:12}
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

  // ── 외주비 엑셀 업로드 (프로젝트별_외주비.xlsx)
  const uploadPayments = (e) => {
    const file = e.target.files?.[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try{
        const wb = XLSX.read(ev.target.result, {type:"binary"})
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""})

        const toAmt = v => { try{const f=parseFloat(String(v).replace(/,/g,"")); return Number.isFinite(f)&&f>0?Math.round(f):0}catch{return 0} }
        const toDate = v => { const m=String(v).match(/(\d{4})-(\d{2})-(\d{2})/); return m?`${m[1]}-${m[2]}-${m[3]}`:""  }

        // 파싱: 프로젝트명(col0) → 공종/업체/금액(col4,5,6) → 3행씩 (조건/날짜/금액)
        const records = []
        let currentProj = ""
        for(let i=3; i<rows.length; i++){
          const r=rows[i]
          const c0=String(r[0]||"").trim()
          const c4=String(r[4]||"").trim()
          const c5=String(r[5]||"").trim()
          const c6=String(r[6]||"").trim()
          if(c0&&!c4&&!c5){ currentProj=c0; continue }
          if(c4&&c5&&toAmt(c6)>0&&currentProj){
            const payments=[]
            const condRow=rows[i]||[], dateRow=rows[i+1]||[], amtRow=rows[i+2]||[]
            for(let j=7;j<27;j++){
              const cond=String(condRow[j]||"").trim()
              const date=toDate(dateRow[j])
              const amt=toAmt(amtRow[j])
              if(cond||amt) payments.push({condition:cond,date,amount:amt})
            }
            records.push({project:currentProj, vendor:c5, type:c4, totalAmt:toAmt(c6), payments})
            i+=2
          }
        }

        if(records.length===0){ alert("파싱된 데이터가 없습니다.\n프로젝트별_외주비.xlsx 형식인지 확인하세요."); return }

        // vendorsDB에 paymentHistory 연결
        const normN = n => n.replace(/[\s\(\)\[\]㈜주식회사]/g,"").toLowerCase()
        setVendorsDB(prev=>{
          const next={...prev}
          records.forEach(pay=>{
            const pkey=normN(pay.vendor)
            const match=Object.values(next).find(v=>normN(v.name||"")===pkey||
              (pkey.length>=4&&normN(v.name||"").slice(0,4)===pkey.slice(0,4)))
            if(match){
              const exists=(next[match.id].paymentHistory||[]).some(
                h=>h.project===pay.project&&h.vendor===pay.vendor&&h.totalAmt===pay.totalAmt)
              if(!exists){
                next[match.id]={...next[match.id], paymentHistory:[...(next[match.id].paymentHistory||[]),pay]}
              }
            } else {
              // 매칭 안 되면 새 업체로 등록
              const id=`VP${Date.now()}_${Math.random().toString(36).slice(2,5)}`
              next[id]={id,name:pay.vendor,bizType:pay.type,bizNo:"",rep:"",repTel:"",repMail:"",tel:"",addr:"",projects:[],paymentHistory:[pay],memo:[]}
            }
          })
          return next
        })

        if(setVendorPayments) setVendorPayments(records)

        // 프로젝트별 요약
        const projSet = [...new Set(records.map(r=>r.project))]
        const totalAmt = records.reduce((s,r)=>s+r.totalAmt,0)
        alert(`✅ 외주비 업로드 완료!\n` +
          `프로젝트 ${projSet.length}개 / 외주 항목 ${records.length}건\n` +
          `총 금액: ${(totalAmt/1e8).toFixed(2)}억원\n\n` +
          `협력업체 DB의 외주비 이력에 자동 연결됩니다.`)
      }catch(err){ alert("외주비 업로드 오류: "+err.message) }
    }
    reader.readAsBinaryString(file)
    e.target.value=""
  }

  const NAV = [
    {id:"list",    label:"📇 업체목록"},
    {id:"ai",      label:"🤖 AI 통합분석"},
    {id:"compare", label:"📊 외주비 비교(유형별)"},
    {id:"draft",   label:"📝 실행초안 생성"},
  ]

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>{setView(n.id);if(n.id!=="list")setSelVendor(null)}} style={{
            padding:"11px 18px",border:"none",borderRadius:11,fontSize:21.8,fontWeight:700,cursor:"pointer",
            background:(view===n.id||(n.id==="list"&&view==="detail"))?C.navy:"var(--color-background-primary,#fff)",
            color:(view===n.id||(n.id==="list"&&view==="detail"))?"#fff":"var(--color-text-secondary,#888)",
            boxShadow:(view===n.id||(n.id==="list"&&view==="detail"))?"0 2px 10px rgba(12,68,124,.25)":"0 0 0 0.5px var(--color-border-tertiary,#e4e4e0)",
          }}>{n.label}</button>
        ))}
        {/* 업다운로드 버튼 */}
        <div style={{marginLeft:"auto",display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={downloadVendors}
            style={{...S.btn("var(--color-background-secondary,#f3f3f0)","var(--color-text-primary,#222)"),fontSize:18.8,padding:"7px 13px"}}>
            ⬇ 전체 다운로드
          </button>
          {canWrite&&<label style={{...S.btn(C.navyM),fontSize:18.8,padding:"7px 13px",cursor:"pointer"}}>
            ⬆ 협력업체 업로드
            <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={uploadVendors}/>
          </label>}
          {canWrite&&<label style={{...S.btn("var(--color-background-secondary,#f3f3f0)","#D97706"),fontSize:18.8,padding:"7px 13px",cursor:"pointer",border:"1.5px solid #D97706"}}>
            ⬆ 💰 외주비 업로드
            <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={uploadPayments}/>
          </label>}
        </div>
      </div>

      {view==="ai" && <VendorAIAnalysis projects={projects} vendorsDB={vendorsDB}/>}
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
  const [filters, setFilters] = useState({name:"",field:"",rep:"",tel:"",addr:""})
  const [sortBy,  setSortBy]  = useState("name")   // name | projects | payment
  const [page,    setPage]    = useState(1)
  const [showFilter, setShowFilter] = useState(false)
  const PER_PAGE = 50

  // vendorsDB 전체 + directory 병합
  const allVendors = useMemo(()=>{
    const map = {}
    // vendorsDB (업로드한 750건)
    Object.values(vendorsDB||{}).forEach(v=>{
      if(!v.name) return
      map[v.name] = {
        id: v.id, name: v.name,
        bizType: v.bizType||"", bizNo: v.bizNo||"",
        rep: v.rep||v.ceoName||"", tel: v.tel||v.repTel||v.ceoPhone||"",
        addr: v.addr||"", repMail: v.repMail||"",
        contact: v.contact||v.contactName||"", contactTel: v.contactTel||v.contactPhone||"",
        projects: v.projects||[],
        paymentHistory: v.paymentHistory||[],
        // directory에서 계산된 실행계획서 참여 정보
        dirEntry: null
      }
    })
    // directory (실행계획서 기반) 병합
    directory.forEach(d=>{
      if(map[d.name]) {
        map[d.name].dirEntry = d
        map[d.name].cats = d.cats
        map[d.name].total = d.total
        map[d.name].items = d.items
      } else {
        map[d.name] = {
          id: null, name: d.name, bizType:"", bizNo:"", rep:"", tel:"", addr:"",
          repMail:"", contact:"", contactTel:"",
          projects:[], paymentHistory:[],
          dirEntry:d, cats:d.cats, total:d.total, items:d.items
        }
      }
    })
    return Object.values(map)
  },[vendorsDB, directory])

  // 필터링
  const filtered = useMemo(()=>{
    const q = (s,v) => !s.trim() || String(v||"").toLowerCase().includes(s.toLowerCase())
    return allVendors.filter(v=>
      q(filters.name||search, v.name) &&
      q(filters.field, (v.bizType||"")+" "+(v.cats||[]).join(" ")) &&
      q(filters.rep, (v.rep||"")+" "+(v.contact||"")) &&
      q(filters.tel, (v.tel||"")+" "+(v.contactTel||"")) &&
      q(filters.addr, v.addr||"")
    ).sort((a,b)=>{
      if(sortBy==="projects") return (b.projects?.length||0)+(b.items?.length||0) - ((a.projects?.length||0)+(a.items?.length||0))
      if(sortBy==="payment") return (b.paymentHistory?.length||0) - (a.paymentHistory?.length||0)
      return (a.name||"").localeCompare(b.name||"","ko")
    })
  },[allVendors, filters, search, sortBy])

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const pageData   = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE)

  const setF = (k,v) => { setFilters(p=>({...p,[k]:v})); setPage(1) }

  return (
    <SCard title="📇 협력업체 목록" note="">
      {/* 검색 바 */}
      <div style={{marginBottom:10}}>
        <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
          <input value={search} onChange={e=>{setSearch(e.target.value);setF("name",e.target.value)}}
            placeholder="🔍 업체명 검색..."
            style={{...S.inp(220),textAlign:"left",padding:"9px 14px",fontSize:21,flex:1}}/>
          <button onClick={()=>setShowFilter(v=>!v)}
            style={{...S.btn(showFilter?C.navyM:C.navyL,showFilter?"#fff":C.navyM),padding:"8px 14px",fontSize:19.5}}>
            {showFilter?"▲ 간단검색":"▼ 상세검색"}
          </button>
          <div style={{fontSize:19.5,color:C.gray,fontWeight:600,whiteSpace:"nowrap"}}>
            전체 <b style={{color:C.navyM}}>{filtered.length}</b>개 / {allVendors.length}개
          </div>
        </div>

        {showFilter&&(
          <div style={{background:"#F8FAFC",borderRadius:12,border:"1px solid #E5E7EB",padding:"14px 16px",marginBottom:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
              {[["업체명","name","업체명 검색"],["주요분야/업무구분","field","예: 건축, 구조, 기계"],["대표자/담당자","rep","이름 검색"]].map(([l,k,ph])=>(
                <div key={k}>
                  <label style={{fontSize:17.2,fontWeight:700,color:C.navyM,display:"block",marginBottom:3}}>{l}</label>
                  <input value={filters[k]} onChange={e=>setF(k,e.target.value)} placeholder={ph}
                    style={{...S.inp("100%"),textAlign:"left",padding:"7px 10px",fontSize:19.5,width:"100%",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["전화번호","tel","010-xxxx"],["주소","addr","시/구 검색"]].map(([l,k,ph])=>(
                <div key={k}>
                  <label style={{fontSize:17.2,fontWeight:700,color:C.navyM,display:"block",marginBottom:3}}>{l}</label>
                  <input value={filters[k]} onChange={e=>setF(k,e.target.value)} placeholder={ph}
                    style={{...S.inp("100%"),textAlign:"left",padding:"7px 10px",fontSize:19.5,width:"100%",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>
            <button onClick={()=>{setFilters({name:"",field:"",rep:"",tel:"",addr:""});setSearch("");setPage(1)}}
              style={{marginTop:10,padding:"5px 14px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:7,fontSize:18.8,cursor:"pointer"}}>
              초기화
            </button>
          </div>
        )}

        {/* 정렬 */}
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:18.8,color:C.gray}}>정렬:</span>
          {[["name","업체명순"],["projects","프로젝트 많은순"],["payment","외주비 많은순"]].map(([v,l])=>(
            <button key={v} onClick={()=>setSortBy(v)}
              style={{padding:"4px 12px",border:`1.5px solid ${sortBy===v?C.navyM:"#E5E7EB"}`,borderRadius:7,
                fontSize:18,cursor:"pointer",background:sortBy===v?C.navyL:"#fff",color:sortBy===v?C.navyM:"#6B7280",fontWeight:sortBy===v?700:400}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:800}}>
          <thead><tr style={{background:"#F8FAFC"}}>
            {["업체명","업무구분/분야","대표자","전화번호","프로젝트","외주비","주소"].map((h,i)=>(
              <th key={h} style={S.th(i>=4?"right":"left")}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {pageData.length===0&&(
              <tr><td colSpan={7} style={{...S.td("center"),padding:"40px",color:C.gray,fontSize:21}}>
                검색 결과가 없습니다.
              </td></tr>
            )}
            {pageData.map((v,i)=>(
              <tr key={v.id||v.name} onClick={()=>onSelect(v.dirEntry||v)}
                style={{cursor:"pointer",background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(24,95,165,.06)"}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}>
                <td style={{...S.td("left"),fontWeight:700,color:C.navyM,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {v.name}
                </td>
                <td style={{...S.td("left"),fontSize:18.8,color:C.gray}}>
                  {v.bizType||((v.cats||[]).join(", "))||"-"}
                </td>
                <td style={{...S.td("left"),fontSize:18.8}}>
                  {v.rep||"-"}
                  {v.contact&&v.contact!==v.rep&&<span style={{fontSize:16.5,color:C.gray}}> / {v.contact}</span>}
                </td>
                <td style={{...S.td("left"),fontSize:18.8,color:C.gray}}>
                  {v.tel||v.contactTel||"-"}
                </td>
                <td style={S.td()}>
                  {(v.projects?.length||0)+(v.items?.length||0)}건
                </td>
                <td style={S.td()}>
                  {(v.paymentHistory?.length||0)>0
                    ? <span style={{color:"#059669",fontWeight:700}}>{v.paymentHistory.length}건</span>
                    : <span style={{color:C.gray}}>-</span>}
                </td>
                <td style={{...S.td("left"),fontSize:17.2,color:C.gray,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {v.addr||"-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages>1&&(
        <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:14,flexWrap:"wrap"}}>
          <button onClick={()=>setPage(1)} disabled={page===1}
            style={{padding:"5px 10px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:18,cursor:page===1?"not-allowed":"pointer",color:page===1?C.gray:C.navyM}}>«</button>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
            style={{padding:"5px 10px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:18,cursor:page===1?"not-allowed":"pointer",color:page===1?C.gray:C.navyM}}>‹</button>
          {Array.from({length:Math.min(7,totalPages)},(_, i)=>{
            const p = Math.max(1,Math.min(totalPages-6,page-3))+i
            return p<=totalPages?(
              <button key={p} onClick={()=>setPage(p)}
                style={{padding:"5px 12px",border:`1.5px solid ${page===p?C.navyM:"#E5E7EB"}`,borderRadius:7,fontSize:18.8,
                  cursor:"pointer",background:page===p?C.navyM:"#fff",color:page===p?"#fff":C.navyM,fontWeight:page===p?700:400}}>
                {p}
              </button>
            ):null
          })}
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
            style={{padding:"5px 10px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:18,cursor:page===totalPages?"not-allowed":"pointer",color:page===totalPages?C.gray:C.navyM}}>›</button>
          <button onClick={()=>setPage(totalPages)} disabled={page===totalPages}
            style={{padding:"5px 10px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:18,cursor:page===totalPages?"not-allowed":"pointer",color:page===totalPages?C.gray:C.navyM}}>»</button>
          <span style={{fontSize:18.8,color:C.gray,padding:"5px 0",alignSelf:"center"}}>
            {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE,filtered.length)} / {filtered.length}
          </span>
        </div>
      )}
    </SCard>
  )
}

// ════════════════════════════════════════════════════════════
// 2) 업체 상세 — 기본정보 / 수행 프로젝트 / 지급내역
// ════════════════════════════════════════════════════════════
function VendorDetail({entry,vendorsDB,setVendorsDB,vendorPayments,setVendorPayments,canWrite,currentUser,onBack}) {
  // vendorsDB에서 이름 또는 id로 매칭
  const info = useMemo(()=>{
    if(!vendorsDB) return VENDOR_EMPTY
    // id로 먼저 찾기
    if(entry.id && vendorsDB[entry.id]) return vendorsDB[entry.id]
    // 이름으로 찾기
    const byName = Object.values(vendorsDB).find(v=>v.name===entry.name)
    if(byName) return byName
    return VENDOR_EMPTY
  },[vendorsDB, entry])
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
      <button onClick={onBack} style={{...S.btn(C.grayL,"#555"),marginBottom:12,padding:"7px 14px",fontSize:18}}>← 목록으로</button>

      {/* 헤더 */}
      <SCard title={`🏢 ${entry.name}`} note={`참여 프로젝트 ${entry.items.length}건 · 누적 계약액 ${fE(entry.total/1e8)}`}
        actions={canWrite&&(!editing
          ?<button onClick={start} style={{...S.btn(C.navyL,C.navyM),padding:"6px 13px",fontSize:18}}>✏ 정보 수정</button>
          :<div style={{display:"flex",gap:8}}>
            <button onClick={save} style={{...S.btn(C.green),padding:"6px 13px",fontSize:18}}>저장</button>
            <button onClick={cancel} style={{...S.btn(C.grayL,C.gray),padding:"6px 13px",fontSize:18}}>취소</button>
          </div>)}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {FIELDS.map(([k,l])=>(
            <div key={k}>
              <label style={S.lbl()}>{l}</label>
              {editing
                ?<input value={draft[k]||""} onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))} style={{...S.inp(),width:"100%"}}/>
                :<div style={{fontSize:21,fontWeight:info[k]?600:400,color:info[k]?undefined:C.gray,padding:"7px 0"}}>{info[k]||"미입력"}</div>}
            </div>
          ))}
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl()}>비고</label>
            {editing
              ?<input value={draft.note||""} onChange={e=>setDraft(p=>({...p,note:e.target.value}))} style={{...S.inp(),width:"100%"}}/>
              :<div style={{fontSize:19.5,color:info.note?undefined:C.gray}}>{info.note||"-"}</div>}
          </div>
        </div>
      </SCard>

      {/* 서브탭 */}
      <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:"2px solid #E5E7EB"}}>
        {[["info","🏗 프로젝트·지급"],["plan","📅 지급계획 편집"],["docs","📎 문서보관"],["history","📅 사안기록"],["payments","💰 지급내역"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setSubTab(id)} style={{padding:"9px 18px",border:"none",background:"none",fontSize:20.2,fontWeight:700,cursor:"pointer",
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
                      <td style={S.td("left")}><div style={{fontWeight:600}}>{it.projName}</div><div style={{fontSize:16.5,color:"#9CA3AF"}}>{it.projId}</div></td>
                      <td style={S.td("left")}><span style={{...S.bdg(C.navyL,C.navyM),fontSize:16.5}}>{it.cat}</span></td>
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
      {subTab==="plan"&&(
        <SCard title="📅 지급 계획 편집" note="차수별 지급 조건·날짜·금액을 수정하거나 새 차수를 추가합니다">
          <VendorPaymentPlanEditor vendorsDB={vendorsDB} setVendorsDB={setVendorsDB} entry={entry} canWrite={canWrite}/>
        </SCard>
      )}
      {subTab==="docs"&&(
        <SCard title="📎 문서 보관" note="사업자등록증·통장사본·계약서 등 협력업체 관련 문서를 보관합니다">
          {canWrite&&(
            <DocUploadForm onAdd={addDoc} cats={DOC_CATS}/>
          )}
          {docs.length===0
            ?<div style={{padding:"30px",textAlign:"center",color:"#9CA3AF",fontSize:19.5}}>등록된 문서가 없습니다. 위에서 문서를 추가하세요.</div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10,marginTop:12}}>
              {docs.map(doc=>(
                <div key={doc.id} style={{background:"#F8FAFC",borderRadius:12,border:"1px solid #E5E7EB",padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:30}}>{doc.category==="사업자등록증"?"🏢":doc.category==="통장사본"?"💳":doc.category==="계약서"?"📄":"📎"}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:20.2,fontWeight:700,color:"#111827"}}>{doc.title}</div>
                      <div style={{fontSize:16.5,color:"#9CA3AF"}}>{doc.category} · {doc.date}</div>
                    </div>
                    {canWrite&&<button onClick={()=>removeDoc(doc.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:21}}>✕</button>}
                  </div>
                  {doc.memo&&<div style={{fontSize:18,color:"#6B7280",marginBottom:6}}>{doc.memo}</div>}
                  {doc.fileData
                    ?<a href={doc.fileData} download={doc.fileName} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 11px",background:"#EEF3FF",color:"#3B72F6",borderRadius:8,fontSize:18.8,fontWeight:700,textDecoration:"none"}}>⬇ 다운로드</a>
                    :<span style={{fontSize:18,color:"#9CA3AF"}}>파일 없음</span>}
                  <div style={{fontSize:15.8,color:"#9CA3AF",marginTop:5}}>{doc.createdBy} · {fmtDT(doc.createdAt)}</div>
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
            ?<div style={{padding:"24px",textAlign:"center",color:"#9CA3AF",fontSize:19.5}}>등록된 기록이 없습니다.</div>
            :<div style={{position:"relative",paddingLeft:8}}>
              <div style={{position:"absolute",left:120,top:0,bottom:0,width:2,background:"#E5E7EB"}}/>
              {[...history].reverse().map(h=>(
                <div key={h.id} style={{display:"flex",gap:14,marginBottom:10,alignItems:"flex-start"}}>
                  <div style={{width:112,flexShrink:0,textAlign:"right",paddingTop:3,fontSize:18.8,fontWeight:700,color:"#374151"}}>{h.date}</div>
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
                          <button onClick={saveHEdit} style={{...S.btn(C.green),padding:"5px 12px",fontSize:18}}>저장</button>
                          <button onClick={()=>setEditHId(null)} style={{...S.btn(C.grayL,C.gray),padding:"5px 12px",fontSize:18}}>취소</button>
                        </div>
                      </div>
                      :<>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontSize:17.2,padding:"2px 8px",borderRadius:10,background:(catColor[h.category]||"#9CA3AF")+"22",color:catColor[h.category]||"#9CA3AF",fontWeight:700}}>{h.category}</span>
                          <span style={{fontSize:21,fontWeight:700,color:"#111827",flex:1}}>{h.content}</span>
                          {canWrite&&<div style={{display:"flex",gap:4,marginLeft:"auto"}}>
                            <button onClick={()=>{setEditHId(h.id);setEHD({date:h.date,category:h.category,content:h.content,memo:h.memo||""})}} style={{...S.btn(C.navyL,C.navyM),padding:"3px 9px",fontSize:16.5}}>수정</button>
                            <button onClick={()=>removeHistory(h.id)} style={{...S.btn(C.redL,C.red),padding:"3px 9px",fontSize:16.5}}>삭제</button>
                          </div>}
                        </div>
                        {h.memo&&<div style={{fontSize:18.8,color:"#6B7280",background:"#F8FAFC",borderRadius:7,padding:"5px 9px",marginTop:4}}>📝 {h.memo}</div>}
                        <div style={{fontSize:15.8,color:"#9CA3AF",marginTop:4}}>
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
        <div>
          {/* vendorsDB의 paymentHistory (외주비 엑셀 기반) */}
          {(info.paymentHistory||[]).length > 0 && (
            <SCard title="💰 프로젝트별 외주비 지급 이력" note="프로젝트별_외주비.xlsx 기반">
              {(info.paymentHistory||[]).map((ph,pi)=>{
                const paidAmt   = (ph.payments||[]).reduce((s,p)=>s+(p.amount||0),0)
                const paidRate  = ph.totalAmt>0 ? (ph.paidSum/ph.totalAmt*100).toFixed(1) : 0
                return (
                  <details key={pi} style={{marginBottom:10,border:"1px solid #E5E7EB",borderRadius:10,overflow:"hidden"}}>
                    <summary style={{padding:"12px 16px",cursor:"pointer",background:"#F8FAFC",display:"flex",gap:10,alignItems:"center",justifyContent:"space-between",listStyle:"none"}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:17.2,padding:"2px 8px",borderRadius:7,background:"#E3F6F3",color:"#0E9C8C",fontWeight:700}}>{ph.type}</span>
                        <span style={{fontSize:21,fontWeight:700,color:"#111827"}}>{ph.project?.slice(0,35)}</span>
                      </div>
                      <div style={{display:"flex",gap:14,alignItems:"center",flexShrink:0}}>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:16.5,color:"#9CA3AF"}}>총 용역금액</div>
                          <div style={{fontSize:20.2,fontWeight:800,color:"#0B6E63"}}>{(ph.totalAmt/1e6).toFixed(1)}백만원</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:16.5,color:"#9CA3AF"}}>지급 합계</div>
                          <div style={{fontSize:20.2,fontWeight:800,color:"#059669"}}>{ph.paidSum>0?(ph.paidSum/1e6).toFixed(1)+"백만원":"-"}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:16.5,color:"#9CA3AF"}}>잔액</div>
                          <div style={{fontSize:20.2,fontWeight:800,color:ph.remain>0?"#DC2626":"#9CA3AF"}}>{ph.remain>0?(ph.remain/1e6).toFixed(1)+"백만원":"-"}</div>
                        </div>
                        {paidRate>0&&(
                          <div style={{width:44,height:44,position:"relative",flexShrink:0}}>
                            <svg viewBox="0 0 36 36" style={{transform:"rotate(-90deg)"}}>
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E5E7EB" strokeWidth="3"/>
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#059669" strokeWidth="3"
                                strokeDasharray={`${Math.min(paidRate,100)} 100`}/>
                            </svg>
                            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14.2,fontWeight:800,color:"#059669"}}>{paidRate}%</div>
                          </div>
                        )}
                        <span style={{fontSize:18,color:"#9CA3AF"}}>▼</span>
                      </div>
                    </summary>
                    {/* 차수별 지급 상세 */}
                    <div style={{padding:"12px 16px"}}>
                      {(ph.payments||[]).length===0 ? (
                        <div style={{color:"#9CA3AF",fontSize:19.5}}>차수별 지급 정보 없음</div>
                      ) : (
                        <table style={{width:"100%",borderCollapse:"collapse"}}>
                          <thead>
                            <tr style={{background:"#F8FAFC"}}>
                              <th style={{padding:"8px 12px",textAlign:"center",fontSize:18,fontWeight:700,color:"#6B7280",borderBottom:"1px solid #E5E7EB"}}>차수</th>
                              <th style={{padding:"8px 12px",textAlign:"left",fontSize:18,fontWeight:700,color:"#6B7280",borderBottom:"1px solid #E5E7EB"}}>지급 조건</th>
                              <th style={{padding:"8px 12px",textAlign:"center",fontSize:18,fontWeight:700,color:"#6B7280",borderBottom:"1px solid #E5E7EB"}}>지급일</th>
                              <th style={{padding:"8px 12px",textAlign:"right",fontSize:18,fontWeight:700,color:"#6B7280",borderBottom:"1px solid #E5E7EB"}}>금액(원)</th>
                              <th style={{padding:"8px 12px",textAlign:"right",fontSize:18,fontWeight:700,color:"#6B7280",borderBottom:"1px solid #E5E7EB"}}>비율</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(ph.payments||[]).map((p,pj)=>(
                              <tr key={pj} style={{background:pj%2===0?"#fff":"#F9FAFB"}}>
                                <td style={{padding:"8px 12px",textAlign:"center",fontSize:19.5,fontWeight:700,color:"#0E9C8C"}}>
                                  <span style={{background:"#E3F6F3",padding:"2px 8px",borderRadius:6}}>{p.round}차</span>
                                </td>
                                <td style={{padding:"8px 12px",fontSize:19.5,color:"#374151"}}>{p.condition||"-"}</td>
                                <td style={{padding:"8px 12px",textAlign:"center",fontSize:19.5,color:p.date?"#059669":"#9CA3AF",fontWeight:p.date?600:400}}>
                                  {p.date||"미정"}
                                </td>
                                <td style={{padding:"8px 12px",textAlign:"right",fontSize:20.2,fontWeight:700,color:p.amount>0?"#0B6E63":"#9CA3AF"}}>
                                  {p.amount>0?p.amount.toLocaleString():"-"}
                                </td>
                                <td style={{padding:"8px 12px",textAlign:"right",fontSize:18,color:"#9CA3AF"}}>
                                  {ph.totalAmt>0&&p.amount>0?(p.amount/ph.totalAmt*100).toFixed(1)+"%":"-"}
                                </td>
                              </tr>
                            ))}
                            {/* 합계 */}
                            <tr style={{background:"#E3F6F3",borderTop:"2px solid #0E9C8C"}}>
                              <td style={{padding:"9px 12px",textAlign:"center",fontSize:19.5,fontWeight:800,color:"#312E81"}} colSpan={3}>합계</td>
                              <td style={{padding:"9px 12px",textAlign:"right",fontSize:21,fontWeight:900,color:"#0B6E63"}}>
                                {ph.paidSum>0?ph.paidSum.toLocaleString():paidAmt>0?paidAmt.toLocaleString():"-"}
                              </td>
                              <td style={{padding:"9px 12px",textAlign:"right",fontSize:19.5,fontWeight:700,color:"#0B6E63"}}>
                                {ph.totalAmt>0?paidRate+"%":"-"}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                      {ph.note&&<div style={{marginTop:8,fontSize:18,color:"#9CA3AF"}}>비고: {ph.note}</div>}
                    </div>
                  </details>
                )
              })}
            </SCard>
          )}

          {/* 수동 지급 등록 */}
          <SCard title="📝 수동 지급 등록" note="직접 입력한 지급 내역">
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
              ?<div style={{padding:"20px",textAlign:"center",color:"#9CA3AF",fontSize:19.5}}>수동 등록된 지급 기록이 없습니다.</div>
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
                    <td style={S.td("center")}>{canWrite&&<button onClick={()=>setVendorPayments(prev=>(prev||[]).filter(x=>x.id!==p.id))} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:21}}>✕</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            }
          </SCard>
        </div>
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

  const S2={inp:{padding:"8px 11px",border:"1.5px solid #E5E7EB",borderRadius:9,fontSize:20.2,fontFamily:"inherit",outline:"none",boxSizing:"border-box",width:"100%"}}
  return(
    <div style={{background:"#EEF3FF",borderRadius:12,padding:"14px 16px",marginBottom:14,border:"1px solid #3B72F633"}}>
      <div style={{fontSize:20.2,fontWeight:700,color:"#3B72F6",marginBottom:10}}>📎 문서 추가</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={{fontSize:18,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>문서명 *</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 사업자등록증 2026" style={S2.inp}/></div>
        <div><label style={{fontSize:18,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>분류</label><select value={cat} onChange={e=>setCat(e.target.value)} style={S2.inp}>{cats.map(c=><option key={c}>{c}</option>)}</select></div>
        <div><label style={{fontSize:18,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>날짜</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={S2.inp}/></div>
        <div style={{gridColumn:"span 2"}}><label style={{fontSize:18,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>메모</label><input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="추가 메모" style={S2.inp}/></div>
        <div><label style={{fontSize:18,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>파일 첨부</label>
          <div onClick={()=>fileRef.current?.click()} style={{border:"1.5px dashed #3B72F6",borderRadius:9,padding:"8px 12px",cursor:"pointer",textAlign:"center",background:"#fff",fontSize:19.5}}>
            {file?<span style={{color:"#0EA86E",fontWeight:700}}>✓ {file.name} ({fmtSize(file.size)})</span>:<span style={{color:"#9CA3AF"}}>클릭하여 파일 선택</span>}
          </div>
          <input ref={fileRef} type="file" style={{display:"none"}} accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.hwp" onChange={pick}/>
        </div>
      </div>
      <button onClick={add} style={{padding:"9px 20px",background:"#3B72F6",color:"#fff",border:"none",borderRadius:10,fontSize:20.2,fontWeight:700,cursor:"pointer"}}>+ 문서 추가</button>
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
          {cat&&<span style={{fontSize:18,color:C.gray,marginLeft:10}}>면적기준: {basis==="1식"?"1식 (평당단가 비교 불가)":basis}</span>}
        </div>

        {byType.length===0
          ? <div style={{padding:"12px 14px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:19.5}}>해당 분야는 평당단가 비교가 가능한 데이터가 없습니다. (면적기준이 "1식"인 분야는 비교 대상에서 제외됩니다.)</div>
          : <>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byType.map(r=>({name:r.type,평균평당단가:Math.round(r.avg)}))} barCategoryGap="30%" margin={{top:24,right:10,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                <XAxis dataKey="name" tick={{fontSize:18,fontWeight:600}}/>
                <YAxis tick={{fontSize:15}} tickFormatter={v=>(v/10000).toFixed(0)+"만"}/>
                <Tooltip formatter={v=>v.toLocaleString()+"원/평"}/>
                <Bar dataKey="평균평당단가" fill={C.navyM} radius={[5,5,0,0]} barSize={64}>
                  <LabelList dataKey="평균평당단가" position="top" formatter={v=>(v/10000).toFixed(0)+"만"} style={{fontSize:18,fontWeight:700,fill:C.navyM}}/>
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

      {!proj ? <div style={{color:C.gray,fontSize:19.5}}>프로젝트를 선택하세요.</div> : basis==="1식"
        ? <div style={{padding:"12px 14px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:19.5}}>"{cat}" 분야는 면적기준이 1식이라 평당단가 기반 초안을 생성할 수 없습니다.</div>
        : comparable.length===0
        ? <div style={{padding:"12px 14px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:19.5}}>"{proj.bidType||"기타"}" 수주형태의 "{cat}" 분야 비교 사례가 없습니다. (다른 수주형태 데이터만 존재)</div>
        : <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
            <div style={S.card({marginBottom:0,padding:"12px 14px"})}>
              <div style={{fontSize:16.5,color:C.gray,marginBottom:5}}>비교 사례 수 ({proj.bidType||"기타"})</div>
              <div style={{fontSize:30,fontWeight:800}}>{comparable.length}건</div>
            </div>
            <div style={S.card({marginBottom:0,padding:"12px 14px"})}>
              <div style={{fontSize:16.5,color:C.gray,marginBottom:5}}>평당단가 중간값</div>
              <div style={{fontSize:30,fontWeight:800,color:C.navyM}}>{Math.round(med).toLocaleString()}원</div>
            </div>
            <div style={S.card({marginBottom:0,padding:"12px 14px"})}>
              <div style={{fontSize:16.5,color:C.gray,marginBottom:5}}>대상 프로젝트 면적</div>
              <div style={{fontSize:30,fontWeight:800}}>{py.toLocaleString(undefined,{maximumFractionDigits:0})}평</div>
              <div style={{fontSize:15,color:C.gray}}>{basis} 기준</div>
            </div>
            <div style={S.card({marginBottom:0,padding:"12px 14px",background:C.navyL})}>
              <div style={{fontSize:16.5,color:C.navyM,marginBottom:5}}>제안 계약금액</div>
              <div style={{fontSize:30,fontWeight:800,color:C.navyM}}>{suggested!=null?fW(suggested):"-"}</div>
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
            : <div style={{fontSize:18,color:C.gray}}>초안 생성은 입력 권한이 있는 계정에서 가능합니다.</div>}
          <div style={{fontSize:16.5,color:C.gray,marginTop:8}}>초안 생성 시 프로젝트 탭의 새 버전으로 추가되며, 업체명은 "(업체 선택 필요)"로 표시되어 직접 지정해야 합니다.</div>
        </>}
    </SCard>
  )
}

// ════════════════════════════════════════════════════════════
// 🤖 AI 통합 분석 — 협력업체·프로젝트 자연어 질의
// ════════════════════════════════════════════════════════════
function VendorAIAnalysis({projects=[], vendorsDB={}}) {
  const [query,    setQuery]    = useState("")
  const [history,  setHistory]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [examples] = useState([
    "LH(한국토지주택공사) 프로젝트의 구조 분야 협력업체를 비교 분석해줘",
    "LH 프로젝트의 평당 설계비를 비교 분석해줘",
    "가장 많이 참여한 협력업체 상위 10개를 알려줘",
    "공공 프로젝트에서 가장 많이 쓴 외주 공종은?",
    "주거디자인본부 프로젝트의 외주비 현황을 분석해줘",
  ])
  const chatEndRef = useRef(null)

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}) },[history])

  const buildContext = (q) => {
    const projList = Array.isArray(projects) ? projects : []
    const vendorList = Object.values(vendorsDB)

    // 프로젝트 요약 데이터 (AI에 전달할 컨텍스트)
    const projSummary = projList.map(p=>({
      name: p.name, code: p.code,
      depts: p.depts||[], client: p.client||p.clientName||"",
      type: p.orderType||p.type||"", usage: p.usage||"",
      scale: p.scale||"", totalFee: p.totalFee||p.serviceFee||0,
      contractDate: p.contractDate||"",
      // 실행계획서 최신 버전 협력업체
      vendors: (p.versions?.[p.versions?.length-1]?.vendors||[]).map(v=>({
        name:v.name, cat:v.cat, contract:v.contract||0, nego:v.nego2||v.nego1||v.contract||0
      }))
    })).slice(0, 200)  // 최대 200건

    // 협력업체 외주비 요약
    const vendorSummary = vendorList.slice(0,300).map(v=>({
      name: v.name, bizType: v.bizType||"",
      projectCount: (v.projects||[]).length,
      paymentTotal: (v.paymentHistory||[]).reduce((s,p)=>s+(p.totalAmt||0),0),
      paymentProjects: [...new Set((v.paymentHistory||[]).map(p=>p.project))].slice(0,5)
    }))

    return { projects: projSummary, vendors: vendorSummary }
  }

  const sendQuery = async (q) => {
    if(!q.trim()||loading) return
    setLoading(true)
    const userMsg = {role:"user", content:q, time:new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}
    setHistory(p=>[...p, userMsg])
    setQuery("")

    try {
      const ctx = buildContext(q)
      const systemPrompt = `당신은 상지서울건축사사무소의 통합경영시스템 AI 분석 어시스턴트입니다.
아래 데이터를 기반으로 사용자의 질문에 한국어로 분석하고 답변하세요.

## 시스템 데이터 요약
- 전체 프로젝트: ${ctx.projects.length}건
- 전체 협력업체: ${ctx.vendors.length}개

## 프로젝트 데이터 (최대 200건)
${JSON.stringify(ctx.projects, null, 0).slice(0,8000)}

## 협력업체 데이터 (최대 300개)
${JSON.stringify(ctx.vendors, null, 0).slice(0,6000)}

답변 규칙:
- 구체적인 수치와 업체명/프로젝트명을 포함해 분석하세요
- 데이터에 없는 내용은 "데이터 없음"으로 명확히 표시하세요
- 표나 목록으로 정리하면 더 좋습니다 (마크다운 사용)
- 비교 분석 시 장단점, 특이사항도 포함하세요`

      const res = await fetch("/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-6", max_tokens:2000,
          system: systemPrompt,
          messages:[{role:"user", content:q}]
        })
      })
      if(!res.ok) throw new Error(`서버 오류 (${res.status})`)
      const data = await res.json()
      const text = data.content?.[0]?.text || "응답을 받지 못했습니다."
      setHistory(p=>[...p, {role:"assistant", content:text, time:new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}])
    } catch(e) {
      setHistory(p=>[...p, {role:"assistant", content:`⚠ 오류: ${e.message}`, time:""}])
    }
    setLoading(false)
  }

  // 마크다운 간단 렌더링
  const renderMD = (text) => {
    const lines = text.split("\n")
    return lines.map((line,i)=>{
      if(line.startsWith("## ")) return <div key={i} style={{fontSize:24,fontWeight:800,color:C.navyM,margin:"10px 0 4px"}}>{line.slice(3)}</div>
      if(line.startsWith("# "))  return <div key={i} style={{fontSize:27,fontWeight:900,color:"#111827",margin:"12px 0 4px"}}>{line.slice(2)}</div>
      if(line.startsWith("**")||line.match(/^\*\*.*\*\*$/)) return <div key={i} style={{fontWeight:700,color:"#111827"}}>{line.replace(/\*\*/g,"")}</div>
      if(line.startsWith("- ")||line.startsWith("• ")) return <div key={i} style={{paddingLeft:16,margin:"2px 0",display:"flex",gap:6}}><span>•</span><span>{line.slice(2)}</span></div>
      if(line.match(/^\d+\. /)) return <div key={i} style={{paddingLeft:16,margin:"2px 0"}}>{line}</div>
      if(line.startsWith("|")&&line.includes("|")) {
        const cells=line.split("|").filter(Boolean)
        return <div key={i} style={{display:"flex",gap:0,borderBottom:"1px solid #E5E7EB"}}>
          {cells.map((c,ci)=><div key={ci} style={{flex:1,padding:"5px 8px",fontSize:19.5,borderRight:"1px solid #E5E7EB",fontWeight:cells[0].includes("---")?"normal":ci===0?700:400}}>{c.trim()==="-".repeat(c.trim().length)?null:c.trim()}</div>)}
        </div>
      }
      if(line==="---"||line.match(/^-{3,}$/)) return <hr key={i} style={{border:"none",borderTop:"1px solid #E5E7EB",margin:"8px 0"}}/>
      return <div key={i} style={{lineHeight:1.7,color:"#374151"}}>{line||<br/>}</div>
    })
  }

  return (
    <SCard title="🤖 AI 통합 분석" note="프로젝트·협력업체·외주비 데이터를 자연어로 질의하여 분석합니다">
      {/* 예시 질문 */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:19.5,fontWeight:700,color:C.gray,marginBottom:7}}>💡 예시 질문 (클릭하면 바로 질의)</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {examples.map((ex,i)=>(
            <button key={i} onClick={()=>sendQuery(ex)}
              style={{padding:"6px 12px",background:C.navyL,color:C.navyM,border:`1px solid ${C.navyM}40`,
                borderRadius:8,fontSize:18.8,cursor:"pointer",fontWeight:500,textAlign:"left",lineHeight:1.4}}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* 대화 영역 */}
      <div style={{background:"#F8FAFC",borderRadius:12,border:"1px solid #E5E7EB",minHeight:300,maxHeight:500,overflowY:"auto",padding:"14px 16px",marginBottom:12}}>
        {history.length===0&&(
          <div style={{textAlign:"center",padding:"60px 20px",color:C.gray}}>
            <div style={{fontSize:54,marginBottom:10}}>🤖</div>
            <div style={{fontSize:21,fontWeight:600,marginBottom:4}}>AI 분석 어시스턴트</div>
            <div style={{fontSize:18.8}}>위 예시를 클릭하거나 아래 입력창에 질문을 입력하세요</div>
          </div>
        )}
        {history.map((msg,i)=>(
          <div key={i} style={{marginBottom:14,display:"flex",flexDirection:"column",
            alignItems:msg.role==="user"?"flex-end":"flex-start"}}>
            <div style={{
              maxWidth:"85%",padding:"12px 16px",borderRadius:msg.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",
              background:msg.role==="user"?C.navyM:"#fff",
              color:msg.role==="user"?"#fff":"#111827",
              boxShadow:"0 1px 4px rgba(0,0,0,.08)",
              border:msg.role==="assistant"?"1px solid #E5E7EB":"none",
              fontSize:20.2,lineHeight:1.65
            }}>
              {msg.role==="assistant" ? renderMD(msg.content) : msg.content}
            </div>
            {msg.time&&<div style={{fontSize:16.5,color:C.gray,marginTop:3}}>{msg.time}</div>}
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",width:"fit-content"}}>
            <div style={{fontSize:27}}>🤖</div>
            <div style={{fontSize:19.5,color:C.gray}}>분석 중...</div>
            <div style={{display:"flex",gap:3}}>
              {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.navyM,animation:`pulse 1.2s ${i*0.4}s infinite`}}/>)}
            </div>
          </div>
        )}
        <div ref={chatEndRef}/>
      </div>

      {/* 입력창 */}
      <div style={{display:"flex",gap:8}}>
        <input value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendQuery(query)}
          placeholder="예: LH 프로젝트에서 구조 분야 협력업체 비교해줘 (Enter)"
          style={{flex:1,padding:"11px 16px",border:`1.5px solid ${C.navyM}`,borderRadius:10,fontSize:21,fontFamily:"inherit",outline:"none"}}
          disabled={loading}/>
        <button onClick={()=>sendQuery(query)} disabled={loading||!query.trim()}
          style={{...S.btn(loading?C.gray:C.navyM),padding:"11px 22px",fontSize:21,opacity:loading||!query.trim()?0.6:1}}>
          전송
        </button>
        {history.length>0&&<button onClick={()=>setHistory([])}
          style={{...S.btn(C.grayL,C.gray),padding:"11px 14px",fontSize:19.5}}>
          초기화
        </button>}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </SCard>
  )
}

// ════════════════════════════════════════════════════════════
// 💰 협력업체 향후 지급 계획 편집기
// ════════════════════════════════════════════════════════════
export function VendorPaymentPlanEditor({vendorsDB, setVendorsDB, entry, canWrite}) {
  const info = useMemo(()=>{
    if(!vendorsDB) return null
    if(entry?.id && vendorsDB[entry.id]) return vendorsDB[entry.id]
    return Object.values(vendorsDB).find(v=>v.name===entry?.name) || null
  },[vendorsDB, entry])

  const [selProjIdx, setSelProjIdx] = useState(0)
  const [editingIdx,  setEditingIdx]  = useState(null) // paymentHistory 인덱스
  const [draft,       setDraft]       = useState(null)
  const [newPay,      setNewPay]      = useState({round:"", condition:"", date:"", amount:"", note:""})
  const [showAdd,     setShowAdd]     = useState(false)

  if(!info) return <div style={{padding:24,color:"#9CA3AF",textAlign:"center"}}>협력업체 정보 없음</div>

  const history = info.paymentHistory || []
  const ph = history[selProjIdx]

  const savePaymentPlan = (phIdx, updatedPayments) => {
    setVendorsDB(prev=>{
      const next = {...prev}
      const vid  = Object.keys(next).find(k=>next[k].name===info.name || k===info.id)
      if(!vid) return prev
      const updHist = [...(next[vid].paymentHistory||[])]
      updHist[phIdx] = {...updHist[phIdx], payments: updatedPayments}
      next[vid] = {...next[vid], paymentHistory: updHist}
      return next
    })
  }

  const INP = {padding:"7px 10px",border:"1.5px solid #E5E7EB",borderRadius:7,fontSize:19.5,
               width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none"}

  return (
    <div>
      {/* 프로젝트 선택 */}
      {history.length > 1 && (
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {history.map((h,i)=>(
            <button key={i} onClick={()=>setSelProjIdx(i)}
              style={{padding:"6px 12px",border:`1.5px solid ${selProjIdx===i?"#0E9C8C":"#E5E7EB"}`,
                borderRadius:8,fontSize:18.8,cursor:"pointer",fontWeight:selProjIdx===i?700:400,
                background:selProjIdx===i?"#E3F6F3":"#fff",color:selProjIdx===i?"#0E9C8C":"#6B7280"}}>
              {h.project?.slice(0,20)} ({h.type})
            </button>
          ))}
        </div>
      )}

      {!ph && <div style={{padding:24,color:"#9CA3AF",textAlign:"center"}}>외주비 지급 이력이 없습니다.</div>}
      {ph && (
        <div>
          {/* 프로젝트·공종 요약 */}
          <div style={{background:"linear-gradient(135deg,#0C447C,#0B6E63)",borderRadius:12,padding:"14px 18px",marginBottom:14,color:"#fff",display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:17.2,opacity:.8,marginBottom:3}}>[{ph.type}] {ph.project?.slice(0,40)}</div>
              <div style={{display:"flex",gap:16}}>
                <div><div style={{fontSize:15,opacity:.7}}>총 용역금액</div><div style={{fontSize:22.5,fontWeight:800}}>{(ph.totalAmt/1e8).toFixed(2)}억</div></div>
                <div><div style={{fontSize:15,opacity:.7}}>지급 합계</div><div style={{fontSize:22.5,fontWeight:800,color:"#34D399"}}>{ph.paidSum>0?(ph.paidSum/1e8).toFixed(2)+"억":"-"}</div></div>
                <div><div style={{fontSize:15,opacity:.7}}>잔액</div><div style={{fontSize:22.5,fontWeight:800,color:ph.remain>0?"#FDE68A":"#9CA3AF"}}>{ph.remain>0?(ph.remain/1e8).toFixed(2)+"억":"-"}</div></div>
              </div>
            </div>
          </div>

          {/* 차수별 지급 계획 테이블 */}
          <table style={{width:"100%",borderCollapse:"collapse",marginBottom:12}}>
            <thead>
              <tr style={{background:"#F8FAFC"}}>
                {["차수","지급 조건/단계","지급 예정일","금액(원)","지급 여부","비고",""].map((h,i)=>(
                  <th key={h+i} style={{padding:"9px 12px",textAlign:i>=2?"center":"left",fontSize:18.8,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(ph.payments||[]).map((p,pi)=>{
                const isEdit = editingIdx===pi && draft
                const isPaid = !!p.date && p.date <= new Date().toISOString().slice(0,10)
                return (
                  <tr key={pi} style={{background:isPaid?"#F0FDF4":pi%2===0?"#fff":"#F9FAFB"}}>
                    <td style={{padding:"9px 12px",textAlign:"center",fontWeight:700,color:"#0E9C8C",fontSize:19.5}}>
                      <span style={{background:"#E3F6F3",padding:"2px 8px",borderRadius:6}}>{p.round}차</span>
                    </td>
                    <td style={{padding:"9px 12px",fontSize:19.5,color:"#374151",minWidth:120}}>
                      {isEdit
                        ? <input value={draft.condition} onChange={e=>setDraft(d=>({...d,condition:e.target.value}))} style={INP}/>
                        : p.condition||"-"}
                    </td>
                    <td style={{padding:"9px 12px",textAlign:"center",minWidth:130}}>
                      {isEdit
                        ? <input type="date" value={draft.date} onChange={e=>setDraft(d=>({...d,date:e.target.value}))} style={INP}/>
                        : <span style={{fontSize:19.5,fontWeight:p.date?700:400,color:p.date?"#059669":"#9CA3AF"}}>{p.date||"미정"}</span>}
                    </td>
                    <td style={{padding:"9px 12px",textAlign:"right",minWidth:120}}>
                      {isEdit
                        ? <input type="number" value={draft.amount} onChange={e=>setDraft(d=>({...d,amount:e.target.value}))} style={{...INP,textAlign:"right"}}/>
                        : <span style={{fontSize:20.2,fontWeight:700,color:p.amount>0?"#0B6E63":"#9CA3AF"}}>{p.amount>0?p.amount.toLocaleString():"-"}</span>}
                    </td>
                    <td style={{padding:"9px 12px",textAlign:"center"}}>
                      <span style={{fontSize:16.5,padding:"2px 8px",borderRadius:8,fontWeight:700,
                        background:isPaid?"#D1FAE5":"#FEF3C7",color:isPaid?"#059669":"#D97706"}}>
                        {isPaid?"✅ 지급완료":"⏳ 예정"}
                      </span>
                    </td>
                    <td style={{padding:"9px 12px",fontSize:18,color:"#9CA3AF",minWidth:100}}>
                      {isEdit
                        ? <input value={draft.note||""} onChange={e=>setDraft(d=>({...d,note:e.target.value}))} placeholder="비고" style={INP}/>
                        : p.note||""}
                    </td>
                    <td style={{padding:"6px 8px",textAlign:"center",whiteSpace:"nowrap"}}>
                      {canWrite && !isEdit && (
                        <button onClick={()=>{setEditingIdx(pi);setDraft({...p})}}
                          style={{padding:"4px 10px",background:"#E3F6F3",color:"#0E9C8C",border:"none",borderRadius:6,fontSize:17.2,cursor:"pointer",fontWeight:700}}>✏</button>
                      )}
                      {canWrite && isEdit && (
                        <div style={{display:"flex",gap:4}}>
                          <button onClick={()=>{
                            const updated=[...(ph.payments||[])]
                            updated[pi]={...p,...draft,amount:parseInt(draft.amount)||p.amount}
                            savePaymentPlan(selProjIdx,updated)
                            setEditingIdx(null); setDraft(null)
                          }} style={{padding:"4px 10px",background:"#D1FAE5",color:"#059669",border:"none",borderRadius:6,fontSize:17.2,cursor:"pointer",fontWeight:700}}>✓</button>
                          <button onClick={()=>{setEditingIdx(null);setDraft(null)}}
                            style={{padding:"4px 8px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:6,fontSize:17.2,cursor:"pointer"}}>✕</button>
                          <button onClick={()=>{
                            if(!window.confirm("이 차수를 삭제하시겠습니까?")) return
                            const updated=(ph.payments||[]).filter((_,i)=>i!==pi)
                            savePaymentPlan(selProjIdx,updated)
                            setEditingIdx(null); setDraft(null)
                          }} style={{padding:"4px 8px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:6,fontSize:17.2,cursor:"pointer"}}>🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {/* 합계 행 */}
              <tr style={{background:"#E3F6F3",borderTop:"2px solid #0E9C8C"}}>
                <td style={{padding:"9px 12px",fontWeight:800,color:"#312E81",textAlign:"center",fontSize:19.5}} colSpan={3}>합계</td>
                <td style={{padding:"9px 12px",textAlign:"right",fontWeight:900,color:"#0B6E63",fontSize:21}}>
                  {(ph.payments||[]).reduce((s,p)=>s+(p.amount||0),0).toLocaleString()}원
                </td>
                <td colSpan={3}/>
              </tr>
            </tbody>
          </table>

          {/* 새 차수 추가 */}
          {canWrite && (
            <div>
              {!showAdd
                ? <button onClick={()=>setShowAdd(true)}
                    style={{padding:"8px 18px",background:"#0E9C8C",color:"#fff",border:"none",borderRadius:9,fontSize:19.5,fontWeight:700,cursor:"pointer"}}>
                    + 새 차수 추가
                  </button>
                : <div style={{background:"#E3F6F3",borderRadius:12,border:"2px solid #0E9C8C",padding:"14px 16px"}}>
                    <div style={{fontSize:20.2,fontWeight:700,color:"#312E81",marginBottom:10}}>+ 지급 차수 추가</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 2fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
                      <div>
                        <label style={{fontSize:16.5,fontWeight:700,color:"#0E9C8C",display:"block",marginBottom:3}}>차수</label>
                        <input type="number" value={newPay.round} onChange={e=>setNewPay(p=>({...p,round:e.target.value}))}
                          placeholder={((ph.payments||[]).length+1)+"차"}
                          style={INP}/>
                      </div>
                      <div>
                        <label style={{fontSize:16.5,fontWeight:700,color:"#0E9C8C",display:"block",marginBottom:3}}>지급 조건/단계</label>
                        <input value={newPay.condition} onChange={e=>setNewPay(p=>({...p,condition:e.target.value}))}
                          placeholder="예: 실시설계 완료 후" style={INP}/>
                      </div>
                      <div>
                        <label style={{fontSize:16.5,fontWeight:700,color:"#0E9C8C",display:"block",marginBottom:3}}>지급 예정일</label>
                        <input type="date" value={newPay.date} onChange={e=>setNewPay(p=>({...p,date:e.target.value}))} style={INP}/>
                      </div>
                      <div>
                        <label style={{fontSize:16.5,fontWeight:700,color:"#0E9C8C",display:"block",marginBottom:3}}>금액(원)</label>
                        <input type="number" value={newPay.amount} onChange={e=>setNewPay(p=>({...p,amount:e.target.value}))}
                          placeholder="10000000" style={INP}/>
                      </div>
                      <div>
                        <label style={{fontSize:16.5,fontWeight:700,color:"#0E9C8C",display:"block",marginBottom:3}}>비고</label>
                        <input value={newPay.note} onChange={e=>setNewPay(p=>({...p,note:e.target.value}))} style={INP}/>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{
                        if(!newPay.condition&&!newPay.date&&!newPay.amount) return
                        const roundNum = parseInt(newPay.round)||((ph.payments||[]).length+1)
                        const newEntry = {round:roundNum,condition:newPay.condition,date:newPay.date,amount:parseInt(newPay.amount)||0,note:newPay.note}
                        const updated = [...(ph.payments||[]),newEntry].sort((a,b)=>a.round-b.round)
                        savePaymentPlan(selProjIdx,updated)
                        setNewPay({round:"",condition:"",date:"",amount:"",note:""})
                        setShowAdd(false)
                      }} style={{padding:"7px 18px",background:"#059669",color:"#fff",border:"none",borderRadius:9,fontSize:19.5,fontWeight:700,cursor:"pointer"}}>💾 추가</button>
                      <button onClick={()=>setShowAdd(false)}
                        style={{padding:"7px 14px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:9,fontSize:19.5,cursor:"pointer"}}>취소</button>
                    </div>
                  </div>
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
}
