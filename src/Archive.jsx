// ══════════════════════════════════════════════════════════════
// 📁 아카이브 — 문서 전용 (계약서·협약서·사업자등록증 등)
// 실제 파일은 Base64로 localStorage 저장 (소용량 문서 전용)
// Supabase Storage 연결 시 자동으로 클라우드 저장으로 전환
// ══════════════════════════════════════════════════════════════
import { useState, useMemo, useRef, useEffect } from "react"
import { useDepts } from "./DeptContext.jsx"

// ── 색상 ─────────────────────────────────────────────────────
const C = {
  navyM:"#0E9C8C", navyL:"#EEF3FF", navy:"#1A3B6E",
  green:"#0EA86E", greenL:"#E6F9F2",
  amber:"#F59E0B", amberL:"#FEF3C7",
  red:"#EF4444",   redL:"#FEE2E2",
  gray:"#6B7280",  grayL:"#F3F4F6",
}

// ── 문서 분류 (건축설계사무소 특화) ──────────────────────────
const DOC_CATS = {
  "계약서":     { icon:"📄", color:"#0E9C8C", desc:"설계용역계약서, 협약서" },
  "협약서":     { icon:"🤝", color:"#0EA86E", desc:"MOU, 협약서, 협력업체 계약서" },
  "보증서":     { icon:"🛡️", color:"#DC2626", desc:"계약이행보증서·손해배상공제증권" },
  "실적증명서": { icon:"🏆", color:"#059669", desc:"실적증명서" },
  "건축물대장": { icon:"🏢", color:"#0E7490", desc:"건축물대장" },
  "실행계획서": { icon:"📐", color:"#2563EB", desc:"프로젝트별 실행계획서" },
  "기성청구서": { icon:"🧾", color:"#0891B2", desc:"기성 청구·세금계산서" },
  "업체등록서류": { icon:"📇", color:"#9333EA", desc:"협력업체 사업자등록증·통장사본 등" },
  "사업자등록": { icon:"🏢", color:"#F59E0B", desc:"협력업체·발주처 사업자등록증" },
  "회의록":     { icon:"📝", color:"#534AB7", desc:"착수·진행·완료 회의록" },
  "보고서":     { icon:"📊", color:"#0F6E56", desc:"임원보고, 경영보고" },
  "견적서":     { icon:"💰", color:"#D85A30", desc:"외주 견적, 비교표" },
  "인허가":     { icon:"🏛", color:"#A32D2D", desc:"건축허가, 심의서류" },
  "기타":       { icon:"📂", color:"#6B7280", desc:"기타 문서(공문 등)" },
}

// ── 허용 파일 형식 (소용량 문서만) ───────────────────────────
const ALLOWED_TYPES = {
  "pdf":  { label:"PDF",  maxMB:20 },
  "docx": { label:"Word", maxMB:10 },
  "xlsx": { label:"Excel",maxMB:10 },
  "hwp":  { label:"HWP",  maxMB:10 },
  "jpg":  { label:"이미지",maxMB:5  },
  "jpeg": { label:"이미지",maxMB:5  },
  "png":  { label:"이미지",maxMB:5  },
}
const MAX_TOTAL_MB = 50  // localStorage 전체 한도

const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric"}) : "-"
const fmtDateTime = iso => iso ? new Date(iso).toLocaleString("ko-KR",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "-"
const fmtSize = bytes => bytes > 1024*1024 ? `${(bytes/1024/1024).toFixed(1)}MB` : `${Math.round(bytes/1024)}KB`

// localStorage 기반 문서 저장소
const STORE_KEY = "sjs_archive_docs"
const loadDocs = () => { try{ return JSON.parse(localStorage.getItem(STORE_KEY)||"[]") }catch{ return [] } }
const saveDocs = docs => { try{ localStorage.setItem(STORE_KEY, JSON.stringify(docs)) }catch(e){ alert("저장 용량 초과: "+e.message) } }

// ── 기존 "문서보관소"(sjs_docvault)에 등록돼 있던 문서를 한 번만 이 아카이브로 옮겨온다 ──
// 서류함/아카이브/문서보관소 3곳이 중복되어 있던 것을 하나로 통합하기 위한 1회성 이전 작업.
const VAULT_CAT_MAP = {"연간계약서":"계약서","협력업체계약서":"협약서","공문(수신)":"기타","공문(발신)":"기타","회의록":"회의록","기타":"기타"}
function migrateDocVaultOnce(projects) {
  const MIGRATED_FLAG = "sjs_docvault_migrated_v1"
  if(localStorage.getItem(MIGRATED_FLAG)) return
  let vaultDocs = []
  try{ vaultDocs = JSON.parse(localStorage.getItem("sjs_docvault")||"[]") }catch{}
  if(vaultDocs.length){
    const existing = loadDocs()
    const migrated = vaultDocs.map(d=>{
      const matchedProj = d.project ? (projects||[]).find(p=>p.name.includes(d.project)||d.project.includes(p.name)) : null
      return {
        id: `MIG_${d.id||Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        title: d.title || "(제목없음)",
        category: VAULT_CAT_MAP[d.category] || "기타",
        description: [d.category&&!VAULT_CAT_MAP[d.category]?`[${d.category}]`:"", d.summary||"", !matchedProj&&d.project?`(관련: ${d.project})`:""].filter(Boolean).join(" ").trim(),
        tags: (d.tags||"").split(",").map(t=>t.trim()).filter(Boolean),
        projectId: matchedProj?.id || "",
        dateDoc: d.date || "",
        createdAt: d.createdAt || new Date().toISOString(),
        createdBy: d.createdBy || "",
        fileSize: d.fileSize || 0,
        fileData: d.fileData || null,
        fileName: d.fileName || "",
      }
    })
    saveDocs([...migrated, ...existing])
  }
  localStorage.setItem(MIGRATED_FLAG, "1")
}

// ── 프로젝트에 구조화되어 저장된 서류(계약서 8종·실행계획서·협력업체계약서·기성청구서·업체등록서류)를
//    아카이브와 같은 모양으로 변환 — 읽기전용(수정·삭제 불가, 원본은 각자의 프로젝트/업체 화면에서 관리)
const CERT_DOC_LABELS = {contract:"계약서",perfBond:"계약이행보증서",liabilityCert:"손해배상공제증권",experienceCert:"실적증명서",buildingReg:"건축물대장",jvMou:"업무협약서",jvSettlement:"합사정산서",contractApproval:"계약체결보고서"}
const CERT_DOC_CAT   = {contract:"계약서",perfBond:"보증서",liabilityCert:"보증서",experienceCert:"실적증명서",buildingReg:"건축물대장",jvMou:"협약서",jvSettlement:"기타",contractApproval:"계약서"}
const VENDOR_DOC_LABELS = {vendorApp:"등록신청서",bizReg:"사업자등록증",techLicense:"기술자면허증",corpReg:"법인등기부등본",bankbook:"통장사본",newTech:"신기술보유현황",patent:"특허기술보유현황",taxInvoice2:"세금계산서",vendorContract2:"계약서",quote:"견적서",etc:"기타서류"}
function buildStructuredDocs(projects=[], vendorsDB={}) {
  const out = []
  projects.forEach(p=>{
    (p.certDocs||[]).forEach(g=>{
      (g.versions||[]).forEach((v,vi)=>{
        // 파일이 없어도(8MB 초과로 파일만 저장 안 됐거나, 정보만 입력된 경우) 목록에는 나오게 함 — 검색·확인은 가능해야 함
        out.push({id:`SD_cert_${p.id}_${g.key}_${vi}`, title:`${p.name} — ${CERT_DOC_LABELS[g.key]||g.key}`,
          category:CERT_DOC_CAT[g.key]||"기타", description:v.versionLabel||"", tags:[], projectId:p.id,
          dateDoc:v.endDate||v.startDate||"", createdAt:v.updatedAt||v.createdAt||v.uploadedAt||"", createdBy:"",
          fileSize:0, fileData:v.fileData||"", fileName:v.fileName||`${CERT_DOC_LABELS[g.key]||g.key}.pdf`, source:"structured"})
      })
    })
    ;(p.versions||[]).forEach((v,vi)=>{
      // 실행계획서는 엑셀 업로드만으로는 PDF가 첨부되지 않는 경우가 많음(별도 "PDF 첨부" 단계 필요) — 그래도 회차 자체는 목록에 노출
      out.push({id:`SD_exec_${p.id}_${vi}`, title:`${p.name} — 실행계획서 ${v.round||vi+1}차`,
        category:"실행계획서", description:v.ver||"", tags:[], projectId:p.id,
        dateDoc:v.date||"", createdAt:v.date||"", createdBy:"",
        fileSize:0, fileData:v.pdfData||"", fileName:v.pdfName||`실행계획서_${v.round||vi+1}차.pdf`, source:"structured"})
    })
    ;(p.vendorDocs||[]).forEach(g=>{
      (g.versions||[]).forEach((v,vi)=>{
        out.push({id:`SD_vdoc_${p.id}_${g.vendorName}_${vi}`, title:`${p.name} — ${g.vendorName} 계약서`,
          category:"협약서", description:v.versionLabel||"", tags:[], projectId:p.id,
          dateDoc:v.endDate||v.startDate||"", createdAt:v.updatedAt||v.createdAt||"", createdBy:"",
          fileSize:0, fileData:v.fileData||"", fileName:v.fileName||`${g.vendorName}_계약서.pdf`, source:"structured"})
      })
    })
    ;(p.billingSubmissions||[]).forEach((b,bi)=>{
      out.push({id:`SD_bill_${p.id}_${bi}`, title:`${p.name} — ${b.stage||"기성청구"}`,
        category:"기성청구서", description:"", tags:[], projectId:p.id,
        dateDoc:b.date||"", createdAt:b.date||"", createdBy:"",
        fileSize:0, fileData:b.fileData||"", fileName:b.fileName||`기성청구서.pdf`, source:"structured"})
    })
  })
  Object.entries(vendorsDB||{}).forEach(([name,info])=>{
    (info.certDocs||[]).forEach(g=>{
      (g.versions||[]).forEach((v,vi)=>{
        out.push({id:`SD_vreg_${name}_${g.key}_${vi}`, title:`${name} — ${VENDOR_DOC_LABELS[g.key]||g.key}`,
          category:"업체등록서류", description:v.versionLabel||"", tags:[], projectId:"",
          dateDoc:v.endDate||v.startDate||"", createdAt:v.updatedAt||v.createdAt||"", createdBy:"",
          fileSize:0, fileData:v.fileData||"", fileName:v.fileName||`${name}_${VENDOR_DOC_LABELS[g.key]||g.key}.pdf`, source:"structured"})
      })
    })
  })
  return out
}

export function ArchiveTab({ currentUser, projects, vendorsDB={} }) {
  const { STAFF_DEPTS } = useDepts()
  useEffect(()=>{ migrateDocVaultOnce(projects) },[]) // eslint-disable-line
  const [docs, setDocsRaw] = useState(loadDocs)
  const setDocs = d => { const next=typeof d==="function"?d(docs):d; saveDocs(next); setDocsRaw(next) }

  const [catFilter,   setCatFilter]   = useState("")
  const [projFilter,  setProjFilter]  = useState("")
  const [search,      setSearch]      = useState("")
  const [viewMode,    setViewMode]    = useState("grid")  // grid | list
  const [selDoc,      setSelDoc]      = useState(null)
  const [showUpload,  setShowUpload]  = useState(false)
  const [editDoc,     setEditDoc]     = useState(null)
  const [showStructured, setShowStructured] = useState(true) // 프로젝트 연동 서류 포함 여부

  const canWrite = currentUser?.role==="admin" || currentUser?.write===true

  // 프로젝트·업체에 구조화되어 저장된 서류(계약서 8종·실행계획서·협력업체계약서·기성청구서·업체등록서류)를
  // 수동 업로드 문서와 같은 목록에서 함께 검색·열람할 수 있도록 합침 (구조화 서류는 읽기전용)
  const structuredDocs = useMemo(()=>showStructured?buildStructuredDocs(projects, vendorsDB):[], [projects, vendorsDB, showStructured])
  const allDocs = useMemo(()=>[...docs, ...structuredDocs], [docs, structuredDocs])

  const filtered = useMemo(() => {
    let r = [...allDocs]
    if(catFilter)  r = r.filter(d => d.category===catFilter)
    if(projFilter) r = r.filter(d => d.projectId===projFilter)
    if(search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(d =>
        d.title?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.tags?.some(t=>t.toLowerCase().includes(q)) ||
        d.category?.toLowerCase().includes(q)
      )
    }
    return r.sort((a,b)=>new Date(b.dateDoc||b.createdAt||0)-new Date(a.dateDoc||a.createdAt||0))
  }, [allDocs, catFilter, projFilter, search])

  const stats = useMemo(() =>
    Object.fromEntries(Object.keys(DOC_CATS).map(k=>[k, allDocs.filter(d=>d.category===k).length]))
  , [allDocs])

  const totalSize = useMemo(() => docs.reduce((s,d)=>s+(d.fileSize||0),0), [docs])

  const deleteDoc = id => {
    if(!window.confirm("이 문서를 삭제하시겠습니까?\n파일도 함께 삭제됩니다.")) return
    setDocs(prev => prev.filter(d=>d.id!==id))
    if(selDoc?.id===id) setSelDoc(null)
  }

  return (
    <div>
      {/* 헤더 배너 */}
      <div style={{background:"linear-gradient(135deg,#1A3B6E 0%,#0E9C8C 100%)",borderRadius:16,padding:"22px 28px",marginBottom:20,color:"#fff"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:24.2,fontWeight:800,marginBottom:4}}>📁 아카이브 — 모든 서류 통합 검색</div>
            <div style={{fontSize:14.8,opacity:.8}}>수동 등록 문서(계약서·협약서·회의록 등)와 프로젝트·업체에 저장된 서류(계약서 8종·실행계획서·기성청구서·업체등록서류)를 한 곳에서 검색합니다</div>
            <div style={{fontSize:13.2,opacity:.6,marginTop:4}}>
              ⚠ 건축설계 도면·대용량 파일은 NAS에 보관 · 수동 등록 문서는 소용량 전용 (전체 {fmtSize(totalSize)} 사용 중)
            </div>
          </div>
          {canWrite && (
            <button onClick={()=>setShowUpload(true)}
              style={{padding:"11px 20px",background:"rgba(255,255,255,.2)",color:"#fff",border:"1.5px solid rgba(255,255,255,.4)",borderRadius:12,fontSize:15.4,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7}}>
              📎 문서 추가
            </button>
          )}
        </div>

        {/* 분류 버튼 */}
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:18}}>
          <button onClick={()=>setCatFilter("")}
            style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${catFilter?"rgba(255,255,255,.3)":"#fff"}`,background:catFilter?"rgba(255,255,255,.1)":"rgba(255,255,255,.25)",color:"#fff",fontSize:14.3,fontWeight:700,cursor:"pointer"}}>
            전체 ({allDocs.length})
          </button>
          {Object.entries(DOC_CATS).map(([k,v])=>(
            <button key={k} onClick={()=>setCatFilter(f=>f===k?"":k)}
              style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${catFilter===k?"#fff":"rgba(255,255,255,.3)"}`,background:catFilter===k?"rgba(255,255,255,.3)":"rgba(255,255,255,.1)",color:"#fff",fontSize:14.3,fontWeight:catFilter===k?700:400,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
              {v.icon} {k} {stats[k]>0&&<span style={{fontSize:12,background:"rgba(0,0,0,.2)",borderRadius:10,padding:"1px 6px"}}>{stats[k]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 검색·필터 툴바 */}
      <div style={{display:"flex",gap:9,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:220,position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16.5}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="제목·설명·태그·프로젝트 등 통합 검색"
            style={{width:"100%",padding:"10px 12px 10px 36px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:15.4,boxSizing:"border-box"}}/>
        </div>
        <select value={projFilter} onChange={e=>setProjFilter(e.target.value)}
          style={{padding:"10px 12px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:15.4,background:"#fff",maxWidth:220}}>
          <option value="">전체 프로젝트</option>
          {(projects||[]).map(p=><option key={p.id} value={p.id}>{p.name.slice(0,20)}</option>)}
          <option value="__none">공통 (프로젝트 무관)</option>
        </select>
        <label style={{display:"flex",alignItems:"center",gap:5,fontSize:13.2,color:"#374151",cursor:"pointer",whiteSpace:"nowrap"}}>
          <input type="checkbox" checked={showStructured} onChange={e=>setShowStructured(e.target.checked)}/>
          프로젝트·업체 서류 포함
        </label>
        <div style={{display:"flex",gap:2,border:"1.5px solid #E5E7EB",borderRadius:10,overflow:"hidden"}}>
          {[["grid","⊞"],["list","☰"]].map(([v,l])=>(
            <button key={v} onClick={()=>setViewMode(v)}
              style={{padding:"9px 14px",border:"none",background:viewMode===v?"#0E9C8C":"#fff",color:viewMode===v?"#fff":"#6B7280",cursor:"pointer",fontSize:16.5}}>
              {l}
            </button>
          ))}
        </div>
        <span style={{fontSize:14.3,color:"#6B7280",fontWeight:600}}>{filtered.length}건</span>
      </div>

      {/* 문서 없음 */}
      {filtered.length===0 && (
        <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",padding:"60px 20px",textAlign:"center"}}>
          <div style={{fontSize:52.8,marginBottom:12}}>📂</div>
          <div style={{fontSize:18.7,fontWeight:700,color:"#111827",marginBottom:6}}>등록된 문서가 없습니다</div>
          <div style={{fontSize:15.4,color:"#6B7280",marginBottom:20}}>계약서, 협약서, 회의록 등 중요 문서를 추가하세요</div>
          {canWrite&&<button onClick={()=>setShowUpload(true)} style={{padding:"11px 22px",background:"#0E9C8C",color:"#fff",border:"none",borderRadius:10,fontSize:15.4,fontWeight:700,cursor:"pointer"}}>📎 첫 문서 추가하기</button>}
        </div>
      )}

      {/* 그리드 뷰 */}
      {viewMode==="grid" && filtered.length>0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
          {filtered.map(doc=>(
            <DocCard key={doc.id} doc={doc} projects={projects}
              onView={()=>setSelDoc(doc)}
              onEdit={canWrite&&doc.source!=="structured"?()=>setEditDoc(doc):null}
              onDelete={canWrite&&doc.source!=="structured"?()=>deleteDoc(doc.id):null}/>
          ))}
        </div>
      )}

      {/* 리스트 뷰 */}
      {viewMode==="list" && filtered.length>0 && (
        <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#F8FAFC"}}>
                {["분류","제목","프로젝트","등록일","크기","등록자",""].map((h,i)=>(
                  <th key={i} style={{padding:"12px 16px",textAlign:i>1?"center":"left",fontSize:14.3,fontWeight:700,color:"#6B7280",borderBottom:"1px solid #E5E7EB",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc,i)=>{
                const cat = DOC_CATS[doc.category]||DOC_CATS["기타"]
                const proj = (projects||[]).find(p=>p.id===doc.projectId)
                return (
                  <tr key={doc.id} style={{background:i%2===0?"#fff":"#FAFAFA",cursor:"pointer"}}
                    onClick={()=>setSelDoc(doc)}
                    onMouseEnter={e=>e.currentTarget.style.background="#EEF3FF"}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#FAFAFA"}>
                    <td style={{padding:"12px 16px"}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,background:cat.color+"18",color:cat.color,fontSize:13.8,fontWeight:700}}>
                        {cat.icon} {doc.category}
                      </span>
                    </td>
                    <td style={{padding:"12px 16px"}}>
                      <div style={{fontSize:15.4,fontWeight:600,color:"#111827"}}>{doc.title} {doc.source==="structured"&&<span title="프로젝트/업체 화면에 저장된 서류 — 여기서는 열람만 가능" style={{fontSize:11,fontWeight:800,color:"#0E9C8C",background:"#E3F6F3",borderRadius:5,padding:"1px 6px",marginLeft:4}}>🔗 연동</span>}</div>
                      {doc.description&&<div style={{fontSize:13.2,color:"#6B7280",marginTop:2}}>{doc.description.slice(0,50)}</div>}
                    </td>
                    <td style={{padding:"12px 16px",textAlign:"center",fontSize:14.3,color:"#374151"}}>{proj?.name?.slice(0,14)||"-"}</td>
                    <td style={{padding:"12px 16px",textAlign:"center",fontSize:13.2,color:"#6B7280"}}>{doc.dateDoc||doc.createdAt?.slice(0,10)}</td>
                    <td style={{padding:"12px 16px",textAlign:"center",fontSize:13.2,color:"#6B7280"}}>{doc.fileSize?fmtSize(doc.fileSize):"-"}</td>
                    <td style={{padding:"12px 16px",textAlign:"center",fontSize:13.2,color:"#6B7280"}}>{doc.createdBy||"-"}</td>
                    <td style={{padding:"12px 16px",textAlign:"center"}}>
                      <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                        {canWrite&&doc.source!=="structured"&&<button onClick={e=>{e.stopPropagation();setEditDoc(doc)}} style={{padding:"4px 10px",background:"#EEF3FF",color:"#0E9C8C",border:"none",borderRadius:7,fontSize:13.2,fontWeight:600,cursor:"pointer"}}>수정</button>}
                        {canWrite&&doc.source!=="structured"&&<button onClick={e=>{e.stopPropagation();deleteDoc(doc.id)}} style={{padding:"4px 10px",background:"#FEE2E2",color:"#EF4444",border:"none",borderRadius:7,fontSize:13.2,fontWeight:600,cursor:"pointer"}}>삭제</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 모달들 */}
      {showUpload && <UploadModal projects={projects} currentUser={currentUser} onClose={()=>setShowUpload(false)}
        onSave={doc=>{setDocs(prev=>[doc,...prev]);setShowUpload(false)}}/>}
      {editDoc && <UploadModal projects={projects} currentUser={currentUser} initial={editDoc} onClose={()=>setEditDoc(null)}
        onSave={updated=>{setDocs(prev=>prev.map(d=>d.id===updated.id?updated:d));setEditDoc(null)}}/>}
      {selDoc && <ViewModal doc={selDoc} projects={projects} currentUser={currentUser}
        onClose={()=>setSelDoc(null)}
        onEdit={canWrite&&selDoc.source!=="structured"?()=>{setEditDoc(selDoc);setSelDoc(null)}:null}
        onDelete={canWrite&&selDoc.source!=="structured"?()=>{deleteDoc(selDoc.id)}:null}/>}
    </div>
  )
}

// ── 문서 카드 ─────────────────────────────────────────────────
function DocCard({ doc, projects, onView, onEdit, onDelete }) {
  const cat  = DOC_CATS[doc.category] || DOC_CATS["기타"]
  const proj = (projects||[]).find(p=>p.id===doc.projectId)
  const ext  = doc.fileName?.split(".").pop()?.toUpperCase()||""
  const EXT_COLORS = {PDF:"#EF4444",DOCX:"#0E9C8C",XLSX:"#0EA86E",HWP:"#F59E0B",JPG:"#534AB7",PNG:"#534AB7"}

  return (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.05)",transition:"all .15s",cursor:"pointer"}}
      onClick={onView}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(59,114,246,.15)";e.currentTarget.style.borderColor="#0E9C8C"}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.05)";e.currentTarget.style.borderColor="#E5E7EB"}}>

      {/* 미리보기 영역 */}
      <div style={{height:100,background:`linear-gradient(135deg,${cat.color}18,${cat.color}08)`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",borderBottom:"1px solid #E5E7EB"}}>
        {doc.fileData && doc.fileName?.match(/\.(jpg|jpeg|png)$/i)
          ? <img src={doc.fileData} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          : <span style={{fontSize:48.4}}>{cat.icon}</span>
        }
        {ext&&<span style={{position:"absolute",top:8,right:8,background:EXT_COLORS[ext]||"#6B7280",color:"#fff",borderRadius:6,padding:"2px 7px",fontSize:12,fontWeight:800}}>{ext}</span>}
      </div>

      {/* 정보 */}
      <div style={{padding:"12px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <span style={{fontSize:12.6,padding:"3px 9px",borderRadius:20,background:cat.color+"18",color:cat.color,fontWeight:700}}>{doc.category}</span>
          {proj&&<span style={{fontSize:12,color:"#6B7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.name.slice(0,12)}</span>}
        </div>
        <div style={{fontSize:15.4,fontWeight:700,color:"#111827",lineHeight:1.4,marginBottom:6,
          overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
          {doc.title} {doc.source==="structured"&&<span style={{fontSize:10.5,fontWeight:800,color:"#0E9C8C",background:"#E3F6F3",borderRadius:5,padding:"1px 5px",marginLeft:3}}>🔗</span>}
        </div>
        {doc.description&&<div style={{fontSize:13.2,color:"#6B7280",marginBottom:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.description}</div>}
        {!doc.fileData&&<div style={{fontSize:12,color:"#B45309",marginBottom:6}}>⚠ 원본파일 미보관 (정보만 등록됨)</div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:12.6,color:"#9CA3AF"}}>{doc.dateDoc||doc.createdAt?.slice(0,10)} · {doc.createdBy||""}</div>
          {doc.fileSize&&<span style={{fontSize:12,color:"#9CA3AF"}}>{fmtSize(doc.fileSize)}</span>}
        </div>
      </div>

      {/* 수정/삭제 */}
      {(onEdit||onDelete)&&(
        <div style={{padding:"8px 14px",borderTop:"1px solid #F3F4F6",display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
          {onEdit&&<button onClick={onEdit} style={{flex:1,padding:"6px",background:"#EEF3FF",color:"#0E9C8C",border:"none",borderRadius:8,fontSize:13.8,fontWeight:700,cursor:"pointer"}}>수정</button>}
          {onDelete&&<button onClick={onDelete} style={{flex:1,padding:"6px",background:"#FEE2E2",color:"#EF4444",border:"none",borderRadius:8,fontSize:13.8,fontWeight:700,cursor:"pointer"}}>삭제</button>}
        </div>
      )}
    </div>
  )
}

// ── 문서 열람 모달 ────────────────────────────────────────────
function ViewModal({ doc, projects, currentUser, onClose, onEdit, onDelete }) {
  const cat  = DOC_CATS[doc.category]||DOC_CATS["기타"]
  const proj = (projects||[]).find(p=>p.id===doc.projectId)
  const isImage = doc.fileName?.match(/\.(jpg|jpeg|png)$/i)
  const isPDF   = doc.fileName?.match(/\.pdf$/i)

  const download = () => {
    if(!doc.fileData) return
    const a = document.createElement("a")
    a.href = doc.fileData
    a.download = doc.fileName||doc.title
    a.click()
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:600,padding:20,overflowY:"auto"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:760,marginTop:20,boxShadow:"0 20px 60px rgba(0,0,0,.25)"}}>

        {/* 헤더 */}
        <div style={{background:`linear-gradient(135deg,${cat.color}18,${cat.color}08)`,padding:"20px 24px",borderBottom:"1px solid #E5E7EB",display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{width:52,height:52,borderRadius:14,background:cat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30.8,flexShrink:0}}>
            {cat.icon}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12.6,color:cat.color,fontWeight:700,marginBottom:3}}>{doc.category}</div>
            <div style={{fontSize:19.8,fontWeight:800,color:"#111827",lineHeight:1.3}}>{doc.title}</div>
            <div style={{fontSize:14.3,color:"#6B7280",marginTop:4}}>
              {proj&&`${proj.name} · `}{doc.dateDoc||doc.createdAt?.slice(0,10)} · {doc.createdBy||""}
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:24.2,color:"#9CA3AF",flexShrink:0}}>✕</button>
        </div>

        {/* 파일 뷰어 */}
        {!doc.fileData && (
          <div style={{padding:"16px 24px",borderBottom:"1px solid #E5E7EB"}}>
            <div style={{background:"#FEF3C7",borderRadius:10,padding:"14px 16px",fontSize:14.3,color:"#92400E"}}>
              ⚠ 원본파일이 저장되어 있지 않습니다 — 8MB를 초과하는 파일은 정보만 저장되고 파일 자체는 보관되지 않거나, {doc.source==="structured"?"실행계획서처럼 파일 첨부 없이 정보만 등록된 경우입니다.":"파일 없이 정보만 등록된 경우입니다."}
            </div>
          </div>
        )}
        {doc.fileData && (
          <div style={{padding:"16px 24px",borderBottom:"1px solid #E5E7EB"}}>
            {isImage && <img src={doc.fileData} alt={doc.title} style={{maxWidth:"100%",maxHeight:400,borderRadius:10,display:"block",margin:"0 auto"}}/>}
            {isPDF && (
              <div>
                <div style={{background:"#F8FAFC",borderRadius:10,padding:"12px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:30.8}}>📄</span>
                  <div>
                    <div style={{fontSize:15.4,fontWeight:700}}>{doc.fileName}</div>
                    <div style={{fontSize:13.2,color:"#6B7280"}}>{doc.fileSize?fmtSize(doc.fileSize):""} · PDF 파일</div>
                  </div>
                </div>
                <iframe src={doc.fileData} style={{width:"100%",height:480,border:"1px solid #E5E7EB",borderRadius:10}} title={doc.title}/>
              </div>
            )}
            {!isImage && !isPDF && (
              <div style={{background:"#F8FAFC",borderRadius:10,padding:"20px",textAlign:"center"}}>
                <div style={{fontSize:52.8,marginBottom:8}}>📎</div>
                <div style={{fontSize:15.4,fontWeight:700,color:"#111827"}}>{doc.fileName}</div>
                <div style={{fontSize:14.3,color:"#6B7280",marginTop:4}}>{doc.fileSize?fmtSize(doc.fileSize):""}</div>
                <button onClick={download} style={{marginTop:14,padding:"10px 20px",background:"#0E9C8C",color:"#fff",border:"none",borderRadius:10,fontSize:15.4,fontWeight:700,cursor:"pointer"}}>
                  ⬇ 다운로드
                </button>
              </div>
            )}
          </div>
        )}

        {/* 메타데이터 */}
        <div style={{padding:"16px 24px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[
              ["연결 프로젝트", proj?.name||"-"],
              ["문서 날짜", doc.dateDoc||"-"],
              ["등록자", doc.createdBy||"-"],
              ["등록일시", fmtDateTime(doc.createdAt)],
              doc.updatedAt&&["최종 수정", `${doc.updatedBy||""} · ${fmtDateTime(doc.updatedAt)}`],
              ["파일 크기", doc.fileSize?fmtSize(doc.fileSize):"-"],
            ].filter(Boolean).map(([k,v])=>(
              <div key={k} style={{padding:"10px 14px",background:"#F8FAFC",borderRadius:10}}>
                <div style={{fontSize:13.2,color:"#6B7280",fontWeight:700,marginBottom:3}}>{k}</div>
                <div style={{fontSize:14.8,color:"#111827",fontWeight:500}}>{v}</div>
              </div>
            ))}
          </div>

          {doc.description&&<div style={{padding:"12px 14px",background:"#F8FAFC",borderRadius:10,marginBottom:12}}>
            <div style={{fontSize:13.2,color:"#6B7280",fontWeight:700,marginBottom:4}}>설명</div>
            <div style={{fontSize:15.4,color:"#374151",lineHeight:1.7}}>{doc.description}</div>
          </div>}

          {doc.tags?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
            {doc.tags.map(t=><span key={t} style={{padding:"4px 12px",borderRadius:20,background:cat.color+"18",color:cat.color,fontSize:13.8,fontWeight:600}}>#{t}</span>)}
          </div>}

          <div style={{display:"flex",gap:8}}>
            {doc.fileData&&<button onClick={download} style={{padding:"10px 18px",background:"#0E9C8C",color:"#fff",border:"none",borderRadius:10,fontSize:15.4,fontWeight:700,cursor:"pointer"}}>⬇ 다운로드</button>}
            {onEdit&&<button onClick={onEdit} style={{padding:"10px 18px",background:"#EEF3FF",color:"#0E9C8C",border:"none",borderRadius:10,fontSize:15.4,fontWeight:700,cursor:"pointer"}}>✏ 수정</button>}
            {onDelete&&<button onClick={onDelete} style={{padding:"10px 18px",background:"#FEE2E2",color:"#EF4444",border:"none",borderRadius:10,fontSize:15.4,fontWeight:700,cursor:"pointer"}}>🗑 삭제</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 업로드/수정 모달 ──────────────────────────────────────────
function UploadModal({ projects, currentUser, initial, onClose, onSave }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    title:      initial?.title||"",
    category:   initial?.category||"계약서",
    projectId:  initial?.projectId||"",
    dateDoc:    initial?.dateDoc||new Date().toISOString().slice(0,10),
    description:initial?.description||"",
    tags:       initial?.tags?.join(", ")||"",
    version:    initial?.version||"1.0",
  })
  const [file,     setFile]     = useState(null)
  const [preview,  setPreview]  = useState(initial?.fileData||null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const fileRef = useRef(null)

  const u = (k,v) => setForm(p=>({...p,[k]:v}))

  const pickFile = async (e) => {
    const f = e.target.files?.[0]; if(!f) return
    const ext = f.name.split(".").pop().toLowerCase()
    const allowed = ALLOWED_TYPES[ext]
    if(!allowed) { setError(`지원하지 않는 형식입니다. (${Object.keys(ALLOWED_TYPES).join(", ")})`); return }
    if(f.size > allowed.maxMB*1024*1024) { setError(`파일 크기가 너무 큽니다. (최대 ${allowed.maxMB}MB)`); return }
    setError("")
    setFile(f)
    // Base64 변환
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const save = () => {
    if(!form.title.trim()) { setError("제목을 입력하세요."); return }
    setLoading(true)
    const doc = {
      ...(initial||{}),
      id:       initial?.id || `DOC${Date.now()}`,
      ...form,
      tags:     form.tags.split(",").map(t=>t.trim()).filter(Boolean),
      fileData: preview || initial?.fileData || null,
      fileName: file?.name || initial?.fileName || null,
      fileSize: file?.size || initial?.fileSize || null,
      createdAt:initial?.createdAt || new Date().toISOString(),
      createdBy:initial?.createdBy || currentUser?.name || "알 수 없음",
      updatedAt:isEdit ? new Date().toISOString() : undefined,
      updatedBy:isEdit ? currentUser?.name : undefined,
    }
    onSave(doc)
    setLoading(false)
  }

  const lbl = {display:"block",fontSize:14.3,fontWeight:700,color:"#6B7280",marginBottom:5}
  const inp = {width:"100%",padding:"10px 14px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:15.4,boxSizing:"border-box",fontFamily:"inherit",outline:"none"}

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:700,padding:20,overflowY:"auto"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:560,marginTop:20,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{padding:"20px 24px",borderBottom:"1px solid #E5E7EB",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:19.8,fontWeight:800,color:"#111827"}}>{isEdit?"문서 수정":"문서 추가"}</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:24.2,color:"#9CA3AF"}}>✕</button>
        </div>

        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
          {error&&<div style={{background:"#FEE2E2",color:"#EF4444",padding:"10px 14px",borderRadius:10,fontSize:14.3,fontWeight:600}}>{error}</div>}

          {/* 파일 드롭존 */}
          <div onClick={()=>fileRef.current?.click()}
            style={{border:`2px dashed ${file||preview?"#0EA86E":"#E5E7EB"}`,borderRadius:14,padding:"24px",textAlign:"center",cursor:"pointer",background:file||preview?"#E6F9F2":"#F8FAFC",transition:"all .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor="#0E9C8C"}
            onMouseLeave={e=>e.currentTarget.style.borderColor=file||preview?"#0EA86E":"#E5E7EB"}>
            {preview && form.category!=="사진"
              ? <div style={{fontSize:14.3,color:"#0EA86E",fontWeight:700}}>✅ {file?.name || initial?.fileName}</div>
              : preview && <img src={preview} alt="" style={{maxHeight:80,maxWidth:"100%",borderRadius:8,marginBottom:6}}/>
            }
            {!preview && <>
              <div style={{fontSize:30.8,marginBottom:6}}>📎</div>
              <div style={{fontSize:15.4,fontWeight:600,color:"#374151"}}>클릭하여 파일 선택</div>
              <div style={{fontSize:13.2,color:"#9CA3AF",marginTop:4}}>PDF, Word, Excel, HWP, 이미지 (최대 20MB)</div>
            </>}
            <input ref={fileRef} type="file" style={{display:"none"}}
              accept=".pdf,.docx,.doc,.xlsx,.xls,.hwp,.jpg,.jpeg,.png" onChange={pickFile}/>
          </div>

          {/* 기본 정보 */}
          <div>
            <label style={lbl}>제목 *</label>
            <input value={form.title} onChange={e=>u("title",e.target.value)} placeholder="예: 청량리 주상복합 설계용역 계약서" style={inp}/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={lbl}>분류</label>
              <select value={form.category} onChange={e=>u("category",e.target.value)} style={inp}>
                {Object.keys(DOC_CATS).map(k=><option key={k} value={k}>{DOC_CATS[k].icon} {k}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>문서 날짜</label>
              <input type="date" value={form.dateDoc} onChange={e=>u("dateDoc",e.target.value)} style={inp}/>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={lbl}>연결 프로젝트</label>
              <select value={form.projectId} onChange={e=>u("projectId",e.target.value)} style={inp}>
                <option value="">공통 (프로젝트 무관)</option>
                {(projects||[]).map(p=><option key={p.id} value={p.id}>{p.name.slice(0,20)}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>버전</label>
              <input value={form.version} onChange={e=>u("version",e.target.value)} placeholder="1.0" style={inp}/>
            </div>
          </div>

          <div>
            <label style={lbl}>설명</label>
            <textarea value={form.description} onChange={e=>u("description",e.target.value)} rows={2}
              placeholder="문서 내용 요약 (선택)" style={{...inp,resize:"vertical",lineHeight:1.6}}/>
          </div>

          <div>
            <label style={lbl}>태그 (쉼표로 구분)</label>
            <input value={form.tags} onChange={e=>u("tags",e.target.value)} placeholder="계약, 2026, 청량리" style={inp}/>
          </div>

          <div style={{display:"flex",gap:8,paddingTop:4}}>
            <button onClick={save} disabled={loading}
              style={{flex:1,padding:"12px",background:"#0E9C8C",color:"#fff",border:"none",borderRadius:12,fontSize:16.5,fontWeight:800,cursor:"pointer",opacity:loading?.6:1}}>
              {loading?"저장 중…":isEdit?"✓ 수정 저장":"✓ 문서 추가"}
            </button>
            <button onClick={onClose} style={{padding:"12px 20px",background:"#F3F4F6",color:"#374151",border:"none",borderRadius:12,fontSize:16.5,fontWeight:700,cursor:"pointer"}}>
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArchiveTab
