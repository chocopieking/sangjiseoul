import React, { useState, useMemo, useRef, useEffect } from "react"
import { INITIAL_STAFF_DB } from "./staffData.js"
import * as XLSX from "xlsx"

const STATUS_OPTIONS = ["재직","휴직","파견","퇴사","계약직"]
const STATUS_COLOR   = {재직:"#059669",휴직:"#D97706",파견:"#6366F1",퇴사:"#DC2626",계약직:"#0891B2"}
const STATUS_BG      = {재직:"#D1FAE5",휴직:"#FEF3C7",파견:"#EEF2FF",퇴사:"#FEE2E2",계약직:"#E0F7FA"}
const RANK_ORDER     = ["사장","부사장","전무","전무보","상무","상무보","이사","이사대우","부장","차장","과장","대리","주임","사원","연구원",""]
const DEPT_MAP = {
  "설계1본부":"설계1본부","설계1":"설계1본부",
  "설계2본부":"설계2본부","설계2":"설계2본부",
  "주거디자인본부":"주거디자인본부","주거":"주거디자인본부",
  "디자인본부":"디자인본부","디본":"디자인본부","디자인":"디자인본부",
  "운영지원본부":"운영지원본부","경영진":"경영진","전략기획본부":"전략기획본부",
  "감리단":"감리단","파트장":"파트장",
}
function normDept(d){ return DEPT_MAP[d?.trim()]||d?.trim()||"" }

function initStaff(){
  try{
    const saved=localStorage.getItem("sjs_staff_db")
    if(saved&&saved!=="{}") return JSON.parse(saved)
    const db={}
    INITIAL_STAFF_DB.forEach((u,i)=>{
      const id=`S${i+1000}`
      db[id]={
        ...u, id,
        dept: normDept(u.dept||""),
        status: u.status==="사용"||!u.status?"재직":(u.resignDate?"퇴사":"미사용"),
        photo:"", memo:[],
      }
    })
    localStorage.setItem("sjs_staff_db",JSON.stringify(db))
    return db
  }catch{return{}}
}

// 수정 시 히스토리 자동 기록 (부서이동/직급변경/이름변경 등)
function buildChangeLogs(prev, next, author){
  const logs=[]
  const date=new Date().toISOString().slice(0,10)
  const checks=[
    ["dept","부서이동","🏢"],["rank","직급변경","🎖"],["name","이름변경","📛"],
    ["status","상태변경","🔄"],["mobile","연락처변경","📱"],["email","이메일변경","📧"],
  ]
  checks.forEach(([k,label,icon])=>{
    if(prev[k]!==next[k]&&(prev[k]||next[k]))
      logs.push({id:`L${Date.now()}_${k}`,date,text:`${icon} ${label}: ${prev[k]||"없음"} → ${next[k]||"없음"}`,author,auto:true})
  })
  return logs
}

export function StaffMgmtPage({currentUser,deptStaff,setDeptStaff,DEPTS=[],DEPT_COLORS={},setTab}){
  const [staffDB, setStaffDBRaw] = useState(initStaff)
  const [filter,  setFilter]     = useState({dept:"전체",status:"재직",search:""})
  const [selId,   setSelId]      = useState(null)
  const [showAdd, setShowAdd]    = useState(false)
  const [draft,   setDraft]      = useState(null)
  const [newMemo, setNewMemo]    = useState("")
  const [memoType,setMemoType]   = useState("일반")
  const photoRef = useRef()

  const setStaffDB = v => {
    const next = typeof v==="function"?v(staffDB):v
    setStaffDBRaw(next)
    try{ localStorage.setItem("sjs_staff_db", JSON.stringify(next)) }catch{}
    // 재직자만 (퇴사/계약직 제외) 본부별 현황 연동
    if(setDeptStaff){
      const dm={}
      Object.values(next).filter(s=>s.status!=="퇴사"&&s.status!=="계약직").forEach(s=>{
        if(s.dept){ if(!dm[s.dept])dm[s.dept]={total:0}; dm[s.dept].total++ }
      })
      setDeptStaff(prev=>({...prev,...Object.fromEntries(
        Object.entries(dm).map(([d,v])=>[d,{...(prev[d]||{}),total:v.total,current:v.total}])
      )}))
    }
  }

  const staffList = useMemo(()=>Object.values(staffDB),[staffDB])
  const sel = staffDB[selId]

  // 필터링 + 정렬
  const filtered = useMemo(()=>staffList.filter(s=>{
    if(filter.dept!=="전체"&&s.dept!==filter.dept) return false
    if(filter.status!=="전체"&&s.status!==filter.status) return false
    if(filter.search.trim()){
      const q=filter.search.toLowerCase()
      if(!`${s.name||""}${s.dept||""}${s.rank||""}${s.email||""}`.toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a,b)=>{
    const ra=RANK_ORDER.indexOf(a.rank||""),rb=RANK_ORDER.indexOf(b.rank||"")
    if(ra!==rb) return (ra<0?99:ra)-(rb<0?99:rb)
    return (a.name||"").localeCompare(b.name||"","ko")
  }),[staffList,filter])

  // 본부별 통계 (재직자만)
  const deptStats = useMemo(()=>{
    const m={}
    staffList.filter(s=>s.status!=="퇴사"&&s.status!=="계약직").forEach(s=>{
      if(s.dept){ if(!m[s.dept])m[s.dept]=0; m[s.dept]++ }
    })
    return m
  },[staffList])

  const allDepts = [...new Set(staffList.map(s=>s.dept).filter(Boolean))].sort()

  // 사진 업로드
  const handlePhoto = e=>{
    const f=e.target.files?.[0]; if(!f) return
    const r=new FileReader()
    r.onload=ev=>{ if(selId) setStaffDB(prev=>({...prev,[selId]:{...prev[selId],photo:ev.target.result}})) }
    r.readAsDataURL(f)
  }

  // 메모 추가
  const addMemo = ()=>{
    if(!newMemo.trim()||!selId) return
    const entry={id:`M${Date.now()}`,date:new Date().toISOString().slice(0,10),text:newMemo.trim(),author:currentUser?.name||"",type:memoType}
    setStaffDB(prev=>({...prev,[selId]:{...prev[selId],memo:[...(prev[selId].memo||[]),entry]}}))
    setNewMemo("")
  }

  // 직원 저장 (변경 히스토리 자동 기록)
  const saveDraft = ()=>{
    if(!draft?.name?.trim()) return
    if(draft.id&&staffDB[draft.id]){
      const prev=staffDB[draft.id]
      const autoLogs=buildChangeLogs(prev,draft,currentUser?.name||"")
      const updatedMemo=[...(prev.memo||[]),...autoLogs]
      setStaffDB(p=>({...p,[draft.id]:{...draft,memo:updatedMemo}}))
      if(autoLogs.length>0) alert(`✅ 저장됨\n히스토리 자동 기록: ${autoLogs.map(l=>l.text).join(", ")}`)
    } else {
      const id=`S${Date.now()}`
      setStaffDB(p=>({...p,[id]:{...draft,id,memo:[{id:`M${Date.now()}`,date:new Date().toISOString().slice(0,10),text:"🆕 신규 등록",author:currentUser?.name||"",type:"시스템",auto:true}]}}))
      setSelId(id)
    }
    setDraft(null); setShowAdd(false)
  }

  // ── 엑셀 양식 다운로드
  const downloadTemplate = ()=>{
    const ws=XLSX.utils.aoa_to_sheet([
      ["※ 이 양식으로 직원 정보를 입력 후 업로드하세요. [시스템ID]열은 수정 금지."],
      [],
      ["이름","영문이름","본부","직급","이메일","핸드폰","성별","학위","학교","입사일(YYYY-MM-DD)","퇴사일(YYYY-MM-DD)","재직상태","[시스템ID]"],
      ["홍길동","Hong Gildong","설계1본부","과장","hong@example.com","010-1234-5678","남자","학사","서울대","2020-03-01","","재직",""],
    ])
    ws["!cols"]=[{wch:12},{wch:18},{wch:16},{wch:10},{wch:24},{wch:14},{wch:6},{wch:8},{wch:16},{wch:14},{wch:14},{wch:8},{wch:20}]
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"직원목록")
    XLSX.writeFile(wb,"상지서울_직원관리_양식.xlsx")
  }

  // ── 전체 데이터 다운로드
  const downloadAll = ()=>{
    const rows=[
      ["이름","영문이름","본부","직급","이메일","핸드폰","성별","학위","학교","입사일","퇴사일","재직상태","[시스템ID]"],
      ...staffList.map(s=>[s.name||"",s.nameEn||"",s.dept||"",s.rank||"",s.email||"",s.mobile||"",
        s.gender||"",s.degree||"",s.school||"",s.joinDate||"",s.resignDate||"",s.status||"재직",s.id])
    ]
    const ws=XLSX.utils.aoa_to_sheet(rows)
    ws["!cols"]=[{wch:12},{wch:18},{wch:16},{wch:10},{wch:24},{wch:14},{wch:6},{wch:8},{wch:16},{wch:14},{wch:14},{wch:8},{wch:20}]
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"직원목록")
    XLSX.writeFile(wb,`상지서울_직원데이터_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ── 엑셀 업로드
  const uploadExcel = e=>{
    const f=e.target.files?.[0]; if(!f) return
    const r=new FileReader()
    r.onload=ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:"binary"})
        const ws=wb.Sheets[wb.SheetNames[0]]
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""})
        const headers=rows[0].map(h=>String(h).trim())
        const ni=ns=>{ for(const n of ns){ const i=headers.findIndex(h=>h.includes(n)); if(i>=0)return i }; return -1 }
        const CI={
          name:ni(["이름"]),nameEn:ni(["영문"]),dept:ni(["본부","부서"]),rank:ni(["직급"]),
          email:ni(["이메일","메일"]),mobile:ni(["핸드폰","연락처","전화"]),gender:ni(["성별"]),
          degree:ni(["학위"]),school:ni(["학교"]),joinDate:ni(["입사일"]),resignDate:ni(["퇴사일"]),
          status:ni(["재직상태","상태"]),id:ni(["시스템ID","[시스템ID"])
        }
        let added=0,updated=0
        setStaffDB(prev=>{
          const next={...prev}
          rows.slice(1).forEach(r=>{
            const name=CI.name>=0?String(r[CI.name]).trim():""
            if(!name||name.startsWith("※")||name==="이름") return
            const existingId=CI.id>=0?String(r[CI.id]).trim():""
            const existing=existingId&&next[existingId]?next[existingId]:Object.values(next).find(s=>s.name===name)
            const newData={
              name, nameEn:r[CI.nameEn]||"", dept:normDept(r[CI.dept]||""),
              rank:r[CI.rank]||"", email:r[CI.email]||"", mobile:r[CI.mobile]||"",
              gender:r[CI.gender]||"남자", degree:r[CI.degree]||"",
              school:r[CI.school]||"", joinDate:r[CI.joinDate]||"",
              resignDate:r[CI.resignDate]||"", status:r[CI.status]||"재직",
            }
            if(existing){
              const autoLogs=buildChangeLogs(existing,{...existing,...newData},"엑셀업로드")
              next[existing.id]={...existing,...newData,memo:[...(existing.memo||[]),...autoLogs]}
              updated++
            } else {
              const id=`S${Date.now()}_${added}`
              next[id]={...newData,id,photo:"",memo:[{id:`M${Date.now()}`,date:new Date().toISOString().slice(0,10),text:"🆕 엑셀 업로드로 등록",author:"시스템",type:"시스템",auto:true}]}
              added++
            }
          })
          return next
        })
        alert(`✅ 완료: 신규 ${added}명 추가, 업데이트 ${updated}명`)
      }catch(err){alert("업로드 오류: "+err.message)}
    }
    r.readAsBinaryString(f); e.target.value=""
  }

  const startEdit = s=>{ setDraft({...s}); setShowAdd(true) }
  const startAdd  = ()=>{
    setDraft({id:null,name:"",nameEn:"",dept:DEPTS[0]||"",rank:"사원",gender:"남자",email:"",
              mobile:"",degree:"",school:"",joinDate:"",resignDate:"",status:"재직",photo:"",memo:[]})
    setShowAdd(true)
  }

  const INP={padding:"8px 12px",border:"1.5px solid #E5E7EB",borderRadius:8,fontSize:14,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"}
  const LBL={fontSize:12,fontWeight:700,color:"#6366F1",display:"block",marginBottom:4}

  const MEMO_TYPES=["일반","부서이동","직급변경","프로젝트","평가","기타"]
  const MEMO_COLOR={"일반":"#6366F1","부서이동":"#D97706","직급변경":"#059669","프로젝트":"#0891B2","평가":"#7C3AED","기타":"#6B7280","시스템":"#9CA3AF"}

  return (
    <div style={{fontFamily:"'Noto Sans KR',sans-serif"}}>
      {/* 헤더 */}
      <div style={{background:"linear-gradient(135deg,#312E81,#6366F1)",borderRadius:16,padding:"20px 24px",marginBottom:16,color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:22,fontWeight:900,marginBottom:4}}>👤 직원 관리 시스템</div>
          <div style={{fontSize:14,opacity:.8}}>전체 {staffList.length}명 · 재직 {staffList.filter(s=>s.status==="재직").length}명 · 퇴사 {staffList.filter(s=>s.status==="퇴사").length}명</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>setTab&&setTab("home")}
            style={{padding:"8px 16px",background:"rgba(255,255,255,.2)",color:"#fff",border:"2px solid rgba(255,255,255,.4)",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"}}>
            🏠 홈으로
          </button>
          <button onClick={downloadTemplate}
            style={{padding:"8px 16px",background:"#D1FAE5",color:"#065F46",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"}}>
            ⬇ 양식 다운로드
          </button>
          <button onClick={downloadAll}
            style={{padding:"8px 16px",background:"#EDE9FE",color:"#5B21B6",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"}}>
            ⬇ 전체 데이터
          </button>
          <label style={{padding:"8px 16px",background:"#FEF3C7",color:"#92400E",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>
            ⬆ 엑셀 업로드
            <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={uploadExcel}/>
          </label>
          <button onClick={startAdd}
            style={{padding:"8px 16px",background:"#fff",color:"#6366F1",border:"none",borderRadius:10,fontSize:13,fontWeight:800,cursor:"pointer"}}>
            + 직원 추가
          </button>
        </div>
      </div>

      {/* 본부별 현황 */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {Object.entries(deptStats).sort((a,b)=>b[1]-a[1]).map(([d,c])=>(
          <div key={d} onClick={()=>setFilter(p=>({...p,dept:d==="전체"?"전체":d,status:"재직"}))}
            style={{padding:"10px 16px",background:filter.dept===d?"#6366F1":"#fff",borderRadius:11,
              border:`2px solid ${DEPT_COLORS[d]||"#6366F1"}`,cursor:"pointer",display:"flex",gap:10,alignItems:"center",
              boxShadow:filter.dept===d?"0 4px 12px rgba(99,102,241,.3)":"0 1px 4px rgba(0,0,0,.06)"}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:DEPT_COLORS[d]||"#6366F1"}}/>
            <span style={{fontSize:14,fontWeight:700,color:filter.dept===d?"#fff":(DEPT_COLORS[d]||"#6366F1")}}>{d}</span>
            <span style={{fontSize:20,fontWeight:900,color:filter.dept===d?"#fff":"#111827"}}>{c}</span>
            <span style={{fontSize:12,color:filter.dept===d?"rgba(255,255,255,.8)":"#9CA3AF"}}>명</span>
          </div>
        ))}
        <div onClick={()=>setFilter(p=>({...p,dept:"전체",status:"재직"}))}
          style={{padding:"10px 16px",background:filter.dept==="전체"?"#6366F1":"#F3F4F6",borderRadius:11,cursor:"pointer",display:"flex",gap:10,alignItems:"center",border:"2px solid transparent"}}>
          <span style={{fontSize:14,fontWeight:700,color:filter.dept==="전체"?"#fff":"#6B7280"}}>전체</span>
          <span style={{fontSize:20,fontWeight:900,color:filter.dept==="전체"?"#fff":"#111827"}}>
            {staffList.filter(s=>s.status!=="퇴사"&&s.status!=="계약직").length}
          </span>
        </div>
      </div>

      <div style={{display:"flex",gap:14}}>
        {/* 왼쪽: 목록 */}
        <div style={{width:300,flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"12px"}}>
            <input value={filter.search} onChange={e=>setFilter(p=>({...p,search:e.target.value}))}
              placeholder="🔍 이름·직급·이메일 검색"
              style={{...INP,marginBottom:8}}/>
            <div style={{display:"flex",gap:6}}>
              <select value={filter.status} onChange={e=>setFilter(p=>({...p,status:e.target.value}))} style={{...INP,flex:1}}>
                <option value="전체">전체 상태</option>
                {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{fontSize:13,color:"#6B7280",marginTop:8,fontWeight:600}}>
              {filtered.length}명 표시
            </div>
          </div>

          <div style={{flex:1,overflowY:"auto",maxHeight:"calc(100vh - 380px)",display:"flex",flexDirection:"column",gap:4}}>
            {filtered.map(s=>(
              <div key={s.id} onClick={()=>{setSelId(s.id);setShowAdd(false)}}
                style={{background:selId===s.id?"#EEF2FF":"#fff",borderRadius:10,
                  border:`1.5px solid ${selId===s.id?"#6366F1":"#E5E7EB"}`,
                  padding:"10px 12px",cursor:"pointer",display:"flex",gap:10,alignItems:"center",
                  boxShadow:selId===s.id?"0 2px 8px rgba(99,102,241,.2)":"none",
                  transition:"all .15s"}}>
                <div style={{width:42,height:42,borderRadius:"50%",flexShrink:0,
                  background:s.photo?"transparent":"#E5E7EB",overflow:"hidden",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  border:"2px solid #E5E7EB"}}>
                  {s.photo?<img src={s.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    :<span style={{fontSize:18,color:"#9CA3AF"}}>👤</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:2}}>
                    <span style={{fontSize:15,fontWeight:800,color:"#111827"}}>{s.name}</span>
                    <span style={{fontSize:10,padding:"2px 6px",borderRadius:8,
                      background:STATUS_BG[s.status]||"#F3F4F6",color:STATUS_COLOR[s.status]||"#6B7280",fontWeight:700}}>
                      {s.status}
                    </span>
                  </div>
                  <div style={{fontSize:12,color:"#6B7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {s.dept} · {s.rank}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽: 상세 */}
        <div style={{flex:1,overflowY:"auto"}}>
          {/* 편집 폼 */}
          {showAdd&&draft&&(
            <div style={{background:"#fff",borderRadius:14,border:"2px solid #6366F1",padding:"22px"}}>
              <div style={{fontSize:17,fontWeight:800,color:"#312E81",marginBottom:16}}>
                {draft.id?"✏ 직원 정보 수정":"+ 신규 직원 등록"}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr",gap:10,marginBottom:10}}>
                {[["이름 *","name","text"],["영문이름","nameEn","text"],["이메일","email","email"]].map(([l,k,t])=>(
                  <div key={k}>
                    <label style={LBL}>{l}</label>
                    <input type={t} value={draft[k]||""} onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))} style={INP}/>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <label style={LBL}>본부</label>
                  <select value={draft.dept||""} onChange={e=>setDraft(p=>({...p,dept:e.target.value}))} style={INP}>
                    {["",...allDepts,...(DEPTS.filter(d=>!allDepts.includes(d)))].map(d=><option key={d} value={d}>{d||"미배정"}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>직급</label>
                  <select value={draft.rank||""} onChange={e=>setDraft(p=>({...p,rank:e.target.value}))} style={INP}>
                    {RANK_ORDER.map(r=><option key={r} value={r}>{r||"없음"}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>재직상태</label>
                  <select value={draft.status||"재직"} onChange={e=>setDraft(p=>({...p,status:e.target.value}))} style={INP}>
                    {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>핸드폰</label>
                  <input value={draft.mobile||""} onChange={e=>setDraft(p=>({...p,mobile:e.target.value}))} style={INP}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                {[["입사일","joinDate"],["퇴사일","resignDate"]].map(([l,k])=>(
                  <div key={k}>
                    <label style={LBL}>{l}</label>
                    <input value={draft[k]||""} onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))} placeholder="YYYY-MM-DD" style={INP}/>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button onClick={()=>{setShowAdd(false);setDraft(null)}}
                  style={{padding:"9px 18px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:9,fontSize:14,fontWeight:600,cursor:"pointer"}}>취소</button>
                <button onClick={saveDraft}
                  style={{padding:"9px 22px",background:"#6366F1",color:"#fff",border:"none",borderRadius:9,fontSize:14,fontWeight:800,cursor:"pointer"}}>💾 저장</button>
              </div>
            </div>
          )}

          {/* 직원 상세 */}
          {sel&&!showAdd&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* 프로필 카드 */}
              <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"22px",display:"flex",gap:20,alignItems:"flex-start"}}>
                <div style={{flexShrink:0,textAlign:"center"}}>
                  <div style={{width:100,height:100,borderRadius:16,background:"#E5E7EB",overflow:"hidden",
                    display:"flex",alignItems:"center",justifyContent:"center",border:"3px solid #E5E7EB",marginBottom:8}}>
                    {sel.photo?<img src={sel.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      :<span style={{fontSize:44}}>👤</span>}
                  </div>
                  <input type="file" ref={photoRef} accept="image/*" style={{display:"none"}} onChange={handlePhoto}/>
                  <button onClick={()=>photoRef.current?.click()}
                    style={{padding:"5px 12px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:7,fontSize:12,cursor:"pointer",fontWeight:700}}>
                    📷 사진
                  </button>
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:22,fontWeight:900,color:"#111827"}}>{sel.name}</span>
                    {sel.nameEn&&<span style={{fontSize:14,color:"#9CA3AF"}}>{sel.nameEn}</span>}
                    <span style={{fontSize:12,padding:"3px 10px",borderRadius:10,
                      background:STATUS_BG[sel.status]||"#F3F4F6",color:STATUS_COLOR[sel.status]||"#6B7280",fontWeight:800}}>
                      {sel.status}
                    </span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 20px",fontSize:14,color:"#374151",marginBottom:12}}>
                    {[["본부",sel.dept],["직급",sel.rank],["이메일",sel.email],["핸드폰",sel.mobile||"-"],
                      ["입사일",sel.joinDate||"-"],["퇴사일",sel.resignDate||"-"]].map(([l,v])=>(
                      <div key={l} style={{display:"flex",gap:8}}>
                        <span style={{color:"#9CA3AF",minWidth:44,flexShrink:0,fontWeight:600}}>{l}</span>
                        <span style={{fontWeight:v&&v!=="-"?700:400}}>{v||"-"}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>startEdit(sel)}
                      style={{padding:"7px 16px",background:"#6366F1",color:"#fff",border:"none",borderRadius:9,fontSize:13.5,fontWeight:700,cursor:"pointer"}}>
                      ✏ 정보 수정
                    </button>
                    <button onClick={()=>{if(window.confirm("삭제하시겠습니까?")){setStaffDB(p=>{const n={...p};delete n[sel.id];return n});setSelId(null)}}}
                      style={{padding:"7px 16px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:9,fontSize:13.5,fontWeight:700,cursor:"pointer"}}>
                      🗑 삭제
                    </button>
                  </div>
                </div>
              </div>

              {/* 히스토리 */}
              <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                <div style={{padding:"14px 18px",borderBottom:"1px solid #E5E7EB",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#111827"}}>📋 {sel.name} 히스토리 ({(sel.memo||[]).length}건)</div>
                </div>
                <div style={{padding:"12px 16px",background:"#F9FAFB",borderBottom:"1px solid #E5E7EB"}}>
                  <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                    {MEMO_TYPES.map(t=>(
                      <button key={t} onClick={()=>setMemoType(t)}
                        style={{padding:"4px 12px",border:`2px solid ${memoType===t?(MEMO_COLOR[t]||"#6366F1"):"#E5E7EB"}`,
                          borderRadius:8,fontSize:12.5,cursor:"pointer",fontWeight:memoType===t?700:400,
                          background:memoType===t?(MEMO_COLOR[t]||"#6366F1"):"#fff",
                          color:memoType===t?"#fff":"#6B7280"}}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <input value={newMemo} onChange={e=>setNewMemo(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&addMemo()}
                      placeholder={`[${memoType}] 내용 입력 (Enter)`}
                      style={{...INP,flex:1}}/>
                    <button onClick={addMemo}
                      style={{padding:"8px 18px",background:"#6366F1",color:"#fff",border:"none",borderRadius:9,fontSize:14,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                      + 기록
                    </button>
                  </div>
                </div>
                <div style={{maxHeight:400,overflowY:"auto"}}>
                  {(sel.memo||[]).length===0&&(
                    <div style={{padding:"40px",textAlign:"center",color:"#9CA3AF",fontSize:14}}>아직 기록이 없습니다.</div>
                  )}
                  {[...(sel.memo||[])].reverse().map((m,i)=>(
                    <div key={m.id||i} style={{padding:"12px 16px",borderBottom:"1px solid #F3F4F6",
                      display:"flex",gap:12,alignItems:"flex-start",background:m.auto?"#FAFAFA":"#fff"}}>
                      <div style={{width:3,background:MEMO_COLOR[m.type||"일반"]||"#6366F1",borderRadius:2,alignSelf:"stretch",flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                          <span style={{fontSize:11,padding:"1px 7px",borderRadius:8,
                            background:(MEMO_COLOR[m.type||"일반"]||"#6366F1")+"18",
                            color:MEMO_COLOR[m.type||"일반"]||"#6366F1",fontWeight:700}}>
                            {m.type||"일반"}
                          </span>
                          <span style={{fontSize:13,fontWeight:700,color:"#6366F1"}}>{m.date}</span>
                          {m.author&&<span style={{fontSize:12,color:"#9CA3AF"}}>by {m.author}</span>}
                          {m.auto&&<span style={{fontSize:10,background:"#EEF2FF",color:"#6366F1",padding:"1px 5px",borderRadius:5}}>자동기록</span>}
                        </div>
                        <div style={{fontSize:14,color:"#111827",lineHeight:1.65}}>{m.text}</div>
                      </div>
                      {!m.auto&&<button onClick={()=>setStaffDB(prev=>{
                          const real=[...(sel.memo||[])]
                          const realIdx=real.length-1-i
                          real.splice(realIdx,1)
                          return {...prev,[sel.id]:{...sel,memo:real}}
                        })}
                        style={{padding:"2px 8px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:5,fontSize:11,cursor:"pointer",flexShrink:0}}>
                        ✕
                      </button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!sel&&!showAdd&&(
            <div style={{padding:"60px",textAlign:"center",color:"#9CA3AF",background:"#fff",borderRadius:14,border:"1px solid #E5E7EB"}}>
              <div style={{fontSize:48,marginBottom:12}}>👤</div>
              <div style={{fontSize:16,fontWeight:700,color:"#374151",marginBottom:6}}>직원을 선택하면 상세정보가 표시됩니다</div>
              <div style={{fontSize:13}}>왼쪽 목록에서 이름을 클릭하세요</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
