// ══════════════════════════════════════════════════════════════
// 협력업체 탭 — 업체정보 · 수행 프로젝트/지급내역 · 외주비 비교 · 실행초안
// ══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts"
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
  const [view,setView]   = useState("list")   // list | detail | compare | draft
  const [selVendor,setSelVendor] = useState(null)
  const [search,setSearch] = useState("")

  const NAV = [
    {id:"list",    label:"📇 업체목록"},
    {id:"compare", label:"📊 외주비 비교(유형별)"},
    {id:"draft",   label:"📝 실행초안 생성"},
  ]

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>{setView(n.id);if(n.id!=="list")setSelVendor(null)}} style={{
            padding:"11px 18px",border:"none",borderRadius:11,fontSize:14.5,fontWeight:700,cursor:"pointer",
            background:(view===n.id||(n.id==="list"&&view==="detail"))?C.navy:"var(--color-background-primary,#fff)",
            color:(view===n.id||(n.id==="list"&&view==="detail"))?"#fff":"var(--color-text-secondary,#888)",
            boxShadow:(view===n.id||(n.id==="list"&&view==="detail"))?"0 2px 10px rgba(12,68,124,.25)":"0 0 0 0.5px var(--color-border-tertiary,#e4e4e0)",
          }}>{n.label}</button>
        ))}
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
  const [draft,setDraft]     = useState(info)
  const start = ()=>{ setDraft({...VENDOR_EMPTY,...info}); setEditing(true) }
  const save  = ()=>{ setVendorsDB(prev=>({...prev,[entry.name]:draft})); setEditing(false) }
  const cancel = ()=>{ setEditing(false); setDraft(info) }

  const myPayments = (vendorPayments||[]).filter(p=>p.vendor===entry.name)
  const paidByProj = {}
  myPayments.forEach(p=>{ paidByProj[p.projId]=(paidByProj[p.projId]||0)+num(p.amount) })

  // 지급 추가 폼
  const [pProj,setPProj]   = useState(entry.items[0]?.projId||"")
  const [pCat,setPCat]     = useState(entry.items[0]?.cat||"")
  const [pAmt,setPAmt]     = useState(0)
  const [pDate,setPDate]   = useState(new Date().toISOString().slice(0,10))
  const [pNote,setPNote]   = useState("")
  const projItems = entry.items.filter(it=>it.projId===pProj)
  const catOpts = [...new Set(entry.items.filter(it=>it.projId===pProj).map(it=>it.cat))]

  const addPayment = ()=>{
    if(!pProj||!pAmt) return
    const projName = entry.items.find(it=>it.projId===pProj)?.projName||""
    setVendorPayments(prev=>[...(prev||[]),{id:`PAY${Date.now()}`,vendor:entry.name,projectId:pProj,projName,cat:pCat,amount:num(pAmt),date:pDate,note:pNote,by:currentUser?.name}])
    setPAmt(0); setPNote("")
  }
  const removePayment = id => setVendorPayments(prev=>(prev||[]).filter(p=>p.id!==id))

  const FIELDS = [["ceoName","대표자명"],["ceoPhone","대표자 연락처"],["ceoEmail","대표자 이메일"],["contactName","담당자명"],["contactPhone","담당자 연락처"],["contactEmail","담당자 이메일"]]

  return (
    <div>
      <button onClick={onBack} style={{...S.btn(C.grayL,"#555"),marginBottom:12,padding:"7px 14px",fontSize:12}}>← 목록으로</button>

      <SCard title={`🏢 ${entry.name}`} note={`참여 프로젝트 ${entry.items.length}건 · 누적 계약액 ${fE(entry.total/1e8)}`}
        actions={canWrite&&(!editing
          ? <button onClick={start} style={{...S.btn(C.navyL,C.navyM),padding:"6px 13px",fontSize:12}}><i className="ti ti-edit" aria-hidden="true"/> 정보 수정</button>
          : <div style={{display:"flex",gap:8}}>
              <button onClick={save} style={{...S.btn(C.green),padding:"6px 13px",fontSize:12}}>저장</button>
              <button onClick={cancel} style={{...S.btn(C.grayL,C.gray),padding:"6px 13px",fontSize:12}}>취소</button>
            </div>)}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {FIELDS.map(([k,l])=>(
            <div key={k}>
              <label style={S.lbl()}>{l}</label>
              {editing
                ? <input value={draft[k]||""} onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))} style={{...S.inp(),width:"100%"}}/>
                : <div style={{fontSize:14,fontWeight:info[k]?600:400,color:info[k]?undefined:C.gray,padding:"7px 0"}}>{info[k]||"미입력"}</div>}
            </div>
          ))}
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl()}>비고</label>
            {editing
              ? <input value={draft.note||""} onChange={e=>setDraft(p=>({...p,note:e.target.value}))} style={{...S.inp(),width:"100%"}}/>
              : <div style={{fontSize:13,color:info.note?undefined:C.gray}}>{info.note||"-"}</div>}
          </div>
        </div>
      </SCard>

      <SCard title="🏗 수행 프로젝트" note="최신 버전 기준 계약액 · 지급내역과의 차액(잔여)">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}>
            <thead><tr>
              <th style={S.th()}>프로젝트</th><th style={S.th()}>분야</th><th style={S.th()}>수주형태</th>
              <th style={S.th("right")}>계약액(원)</th><th style={S.th("right")}>1차/2차 NEGO</th>
              <th style={S.th("right")}>지급액 합계</th><th style={S.th("right")}>잔여</th>
            </tr></thead>
            <tbody>
              {entry.items.map((it,i)=>{
                const final = it.nego2||it.nego1||it.contract||0
                const paid = paidByProj[it.projId]||0
                const remain = final-paid
                return (
                  <tr key={i} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                    <td style={{...S.td("left"),fontWeight:600}}>{it.projName}<div style={{fontSize:10,color:C.gray}}>{it.projCode} · {it.ver}</div></td>
                    <td style={S.td("left")}>{it.cat}</td>
                    <td style={S.td("left")}><span style={S.bdg(C.navyL,C.navyM)}>{it.bidType}</span></td>
                    <td style={S.td()}>{(it.contract||0).toLocaleString()}</td>
                    <td style={{...S.td(),fontSize:12,color:C.gray}}>{it.nego1?it.nego1.toLocaleString():"-"} / {it.nego2?it.nego2.toLocaleString():"-"}</td>
                    <td style={{...S.td(),color:C.green,fontWeight:700}}>{paid.toLocaleString()}</td>
                    <td style={{...S.td(),fontWeight:700,color:remain>0?C.amber:C.green}}>{remain.toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SCard>

      <SCard title="💵 계약단위별 지급내역" note="프로젝트·분야(계약단위) 기준으로 지급 금액과 날짜를 기록합니다.">
        {canWrite && (
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end",marginBottom:14,padding:"12px 14px",background:C.grayL,borderRadius:10}}>
            <div>
              <label style={S.lbl()}>프로젝트</label>
              <select value={pProj} onChange={e=>{setPProj(e.target.value);setPCat("")}} style={{...S.inp(220)}}>
                {[...new Set(entry.items.map(it=>it.projId))].map(pid=>{
                  const it=entry.items.find(x=>x.projId===pid)
                  return <option key={pid} value={pid}>{it.projName}</option>
                })}
              </select>
            </div>
            <div>
              <label style={S.lbl()}>계약단위(분야)</label>
              <select value={pCat} onChange={e=>setPCat(e.target.value)} style={{...S.inp(140)}}>
                <option value="">선택</option>
                {catOpts.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl()}>지급금액(원)</label>
              <input type="number" value={pAmt} onChange={e=>setPAmt(e.target.value)} style={{...S.inp(150)}}/>
            </div>
            <div>
              <label style={S.lbl()}>지급일</label>
              <input type="date" value={pDate} onChange={e=>setPDate(e.target.value)} style={{...S.inp(140)}}/>
            </div>
            <div style={{flex:1,minWidth:160}}>
              <label style={S.lbl()}>비고</label>
              <input value={pNote} onChange={e=>setPNote(e.target.value)} placeholder="예: 1차 기성, 계약금 등" style={{...S.inp(),width:"100%"}}/>
            </div>
            <button onClick={addPayment} style={S.btn(C.green)}><i className="ti ti-plus" aria-hidden="true"/> 지급 추가</button>
          </div>
        )}
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:680}}>
            <thead><tr>
              <th style={S.th()}>프로젝트</th><th style={S.th()}>계약단위</th><th style={S.th("right")}>금액(원)</th>
              <th style={S.th()}>지급일</th><th style={S.th()}>비고</th>{canWrite&&<th style={S.th("center")}>관리</th>}
            </tr></thead>
            <tbody>
              {myPayments.length===0 && <tr><td colSpan={canWrite?6:5} style={{...S.td("left"),color:C.gray}}>등록된 지급내역이 없습니다.</td></tr>}
              {myPayments.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(p=>(
                <tr key={p.id}>
                  <td style={S.td("left")}>{p.projName}</td>
                  <td style={S.td("left")}>{p.cat||"-"}</td>
                  <td style={{...S.td(),fontWeight:700,color:C.green}}>{num(p.amount).toLocaleString()}</td>
                  <td style={S.td()}>{p.date}</td>
                  <td style={{...S.td("left"),fontSize:12,color:C.gray}}>{p.note||"-"}</td>
                  {canWrite&&<td style={S.td("center")}><button onClick={()=>removePayment(p.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.red,fontSize:12}}>삭제</button></td>}
                </tr>
              ))}
              {myPayments.length>0 && (
                <tr style={{background:"var(--color-background-secondary,#f0f0ee)",fontWeight:700}}>
                  <td style={S.td("left")} colSpan={2}>지급 합계</td>
                  <td style={{...S.td(),color:C.green}}>{myPayments.reduce((s,p)=>s+num(p.amount),0).toLocaleString()}</td>
                  <td colSpan={canWrite?3:2}/>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SCard>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 3) 외주비 비교 — 프로젝트 유형(수주형태)별
// ════════════════════════════════════════════════════════════
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
