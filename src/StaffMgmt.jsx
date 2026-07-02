import React, { useState, useMemo, useRef, useEffect } from "react"
import { INITIAL_STAFF_DB } from "./staffData.js"

// ── 상수 ──────────────────────────────────────────────────────
const STATUS_OPTIONS = ["재직","휴직","파견","퇴사","계약직"]
const STATUS_COLOR   = {재직:"#059669",휴직:"#D97706",파견:"#6366F1",퇴사:"#DC2626",계약직:"#0891B2"}
const STATUS_BG      = {재직:"#D1FAE5",휴직:"#FEF3C7",파견:"#EEF2FF",퇴사:"#FEE2E2",계약직:"#E0F7FA"}
const RANK_ORDER     = ["사장","전무","전무보","상무","상무보","이사","이사대우","부장","차장","과장","대리","주임","사원",""]

const DEPT_MAP = {
  "설계1본부":"설계1본부","설계1":"설계1본부",
  "설계2본부":"설계2본부","설계2":"설계2본부",
  "주거디자인본부":"주거디자인본부","주거":"주거디자인본부",
  "디자인본부":"디자인본부","디본":"디자인본부",
  "운영지원본부":"운영지원본부",
  "전략기획본부":"전략기획본부",
  "경영진":"경영진","감리단":"감리단","파트장":"파트장",
}

function normDept(d) { return DEPT_MAP[d?.trim()] || d?.trim() || "" }

// 초기 데이터 → 상태 변환
function initStaff() {
  try {
    const saved = localStorage.getItem("sjs_staff_db")
    if(saved) return JSON.parse(saved)
  } catch{}
  return INITIAL_STAFF_DB.map((u,i)=>({
    ...u,
    id: `S${i+1000}`,
    dept: normDept(u.dept || u.부서 || ""),
    status: u.status==="사용"||!u.status ? "재직"
            : (u.resignDate||u.퇴사일) ? "퇴사" : "미사용",
    photo: "",
    memo: [],  // [{date, text, author}]
  }))
}

export function StaffMgmtPage({currentUser, deptStaff, setDeptStaff, DEPTS=[], DEPT_COLORS={}}) {
  const [staff, setStaffRaw]   = useState(initStaff)
  const [filter, setFilter]    = useState({dept:"전체", status:"재직", search:""})
  const [selId,  setSelId]     = useState(null)
  const [showAdd, setShowAdd]  = useState(false)
  const [draft,  setDraft]     = useState(null)
  const [newMemo, setNewMemo]  = useState("")
  const photoRef = useRef()

  const setStaff = v => {
    const next = typeof v==="function"?v(staff):v
    setStaffRaw(next)
    try{ localStorage.setItem("sjs_staff_db", JSON.stringify(next)) }catch{}
    // deptStaff 업데이트 (본부별 현황 연동) - 재직자만
    if(setDeptStaff) {
      const deptMap = {}
      next.filter(s=>s.status!=="퇴사").forEach(s=>{
        const d = s.dept
        if(!d) return
        if(!deptMap[d]) deptMap[d]={total:0}
        deptMap[d].total++
      })
      setDeptStaff(prev=>({...prev, ...Object.fromEntries(
        Object.entries(deptMap).map(([d,v])=>[d,{...(prev[d]||{}), total:v.total, current:v.total}])
      )}))
    }
  }

  const sel = staff.find(s=>s.id===selId)

  // 필터링
  const filtered = useMemo(()=>staff.filter(s=>{
    if(filter.dept!=="전체" && s.dept!==filter.dept) return false
    if(filter.status!=="전체" && s.status!==filter.status) return false
    if(filter.search.trim()) {
      const q = filter.search.toLowerCase()
      if(!`${s.name}${s.dept}${s.rank}${s.email}`.toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a,b)=>{
    const ra = RANK_ORDER.indexOf(a.rank), rb = RANK_ORDER.indexOf(b.rank)
    if(ra!==rb) return (ra<0?99:ra)-(rb<0?99:rb)
    return a.name.localeCompare(b.name,'ko')
  }),[staff,filter])

  // 본부별 통계 (재직자만)
  const deptStats = useMemo(()=>{
    const m = {}
    staff.filter(s=>s.status!=="퇴사").forEach(s=>{
      if(s.dept) { if(!m[s.dept])m[s.dept]=0; m[s.dept]++ }
    })
    return m
  },[staff])

  const allDepts = [...new Set(staff.map(s=>s.dept).filter(Boolean))].sort()

  // 사진 업로드
  const handlePhoto = (e) => {
    const file = e.target.files?.[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      if(selId) setStaff(prev=>prev.map(s=>s.id===selId?{...s,photo:ev.target.result}:s))
    }
    reader.readAsDataURL(file)
  }

  // 메모 추가
  const addMemo = () => {
    if(!newMemo.trim()||!selId) return
    const entry = {date:new Date().toISOString().slice(0,10), text:newMemo.trim(), author:currentUser?.name||""}
    setStaff(prev=>prev.map(s=>s.id===selId?{...s,memo:[...(s.memo||[]),entry]}:s))
    setNewMemo("")
  }

  // 직원 저장
  const saveDraft = () => {
    if(!draft?.name?.trim()) return
    if(draft.id) {
      setStaff(prev=>prev.map(s=>s.id===draft.id?draft:s))
    } else {
      const newS = {...draft, id:`S${Date.now()}`, memo:[]}
      setStaff(prev=>[...prev, newS])
      setSelId(newS.id)
    }
    setDraft(null); setShowAdd(false)
  }

  const startEdit = (s) => { setDraft({...s}); setShowAdd(true) }
  const startAdd  = ()  => {
    setDraft({id:null,name:"",dept:DEPTS[0]||"",rank:"사원",gender:"남자",email:"",mobile:"",
              joinDate:"",resignDate:"",status:"재직",photo:"",memo:[]})
    setShowAdd(true)
  }

  const INP = {padding:"7px 10px",border:"1.5px solid #E5E7EB",borderRadius:7,fontSize:13,width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none"}

  return (
    <div style={{display:"flex",gap:16,height:"calc(100vh - 120px)",overflow:"hidden"}}>

      {/* 왼쪽: 목록 */}
      <div style={{width:320,flexShrink:0,display:"flex",flexDirection:"column",gap:10}}>
        {/* 필터 */}
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"12px 14px"}}>
          <input value={filter.search} onChange={e=>setFilter(p=>({...p,search:e.target.value}))}
            placeholder="🔍 이름·직급·이메일 검색"
            style={{...INP,marginBottom:8}}/>
          <div style={{display:"flex",gap:6}}>
            <select value={filter.dept} onChange={e=>setFilter(p=>({...p,dept:e.target.value}))} style={{...INP,flex:1}}>
              <option value="전체">전체 본부</option>
              {allDepts.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filter.status} onChange={e=>setFilter(p=>({...p,status:e.target.value}))} style={{...INP,flex:1}}>
              <option value="전체">전체</option>
              {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
            <span style={{fontSize:12,color:"#6B7280"}}>{filtered.length}명 표시</span>
            <button onClick={startAdd}
              style={{padding:"5px 12px",background:"#6366F1",color:"#fff",border:"none",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer"}}>
              + 직원 추가
            </button>
          </div>
        </div>

        {/* 직원 목록 */}
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
          {filtered.map(s=>(
            <div key={s.id} onClick={()=>{setSelId(s.id);setShowAdd(false)}}
              style={{background:selId===s.id?"#EEF2FF":"#fff",borderRadius:10,border:`1.5px solid ${selId===s.id?"#6366F1":"#E5E7EB"}`,
                padding:"10px 12px",cursor:"pointer",display:"flex",gap:10,alignItems:"center"}}>
              {/* 프로필 사진 */}
              <div style={{width:38,height:38,borderRadius:"50%",flexShrink:0,
                background:s.photo?"transparent":"#E5E7EB",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {s.photo ? <img src={s.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/> :
                  <span style={{fontSize:16,color:"#9CA3AF"}}>👤</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:2}}>
                  <span style={{fontSize:13.5,fontWeight:700,color:"#111827"}}>{s.name}</span>
                  <span style={{fontSize:10,padding:"1px 6px",borderRadius:8,
                    background:STATUS_BG[s.status]||"#F3F4F6",color:STATUS_COLOR[s.status]||"#6B7280",fontWeight:700}}>
                    {s.status}
                  </span>
                </div>
                <div style={{fontSize:11.5,color:"#6B7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {s.dept} · {s.rank}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 오른쪽: 상세 or 편집 폼 */}
      <div style={{flex:1,overflowY:"auto"}}>
        {/* 편집 폼 */}
        {showAdd && draft && (
          <div style={{background:"#fff",borderRadius:14,border:"2px solid #6366F1",padding:"20px 22px"}}>
            <div style={{fontSize:15,fontWeight:800,color:"#312E81",marginBottom:16}}>
              {draft.id?"✏ 직원 정보 수정":"+ 신규 직원 등록"}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
              {[["이름 *","name"],["영문이름","nameEn"],["이메일","email"]].map(([l,k])=>(
                <div key={k}>
                  <label style={{fontSize:11,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>{l}</label>
                  <input value={draft[k]||""} onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))} style={INP}/>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>본부</label>
                <select value={draft.dept||""} onChange={e=>setDraft(p=>({...p,dept:e.target.value}))} style={INP}>
                  {["",...allDepts,...(DEPTS.filter(d=>!allDepts.includes(d)))].map(d=><option key={d} value={d}>{d||"미배정"}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>직급</label>
                <select value={draft.rank||""} onChange={e=>setDraft(p=>({...p,rank:e.target.value}))} style={INP}>
                  {RANK_ORDER.map(r=><option key={r} value={r}>{r||"직급없음"}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>성별</label>
                <select value={draft.gender||"남자"} onChange={e=>setDraft(p=>({...p,gender:e.target.value}))} style={INP}>
                  <option value="남자">남자</option><option value="여자">여자</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>재직상태</label>
                <select value={draft.status||"재직"} onChange={e=>setDraft(p=>({...p,status:e.target.value}))} style={INP}>
                  {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
              {[["핸드폰","mobile"],["입사일","joinDate"],["퇴사일","resignDate"]].map(([l,k])=>(
                <div key={k}>
                  <label style={{fontSize:11,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>{l}</label>
                  <input value={draft[k]||""} onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))}
                    placeholder={k.includes("Date")?"YYYY-MM-DD":""} style={INP}/>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>{setShowAdd(false);setDraft(null)}}
                style={{padding:"7px 16px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"}}>취소</button>
              <button onClick={saveDraft}
                style={{padding:"7px 18px",background:"#6366F1",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>💾 저장</button>
            </div>
          </div>
        )}

        {/* 상세 정보 */}
        {sel && !showAdd && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* 프로필 카드 */}
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"20px 22px",display:"flex",gap:20,alignItems:"flex-start"}}>
              {/* 사진 */}
              <div style={{flexShrink:0}}>
                <div style={{width:100,height:100,borderRadius:14,background:"#E5E7EB",
                  overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",
                  border:"2px solid #E5E7EB",marginBottom:8}}>
                  {sel.photo ? <img src={sel.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/> :
                    <span style={{fontSize:40}}>👤</span>}
                </div>
                <input type="file" ref={photoRef} accept="image/*" style={{display:"none"}} onChange={handlePhoto}/>
                <button onClick={()=>photoRef.current?.click()}
                  style={{width:"100%",padding:"5px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:7,fontSize:11.5,cursor:"pointer",fontWeight:600}}>
                  📷 사진 변경
                </button>
              </div>
              {/* 기본 정보 */}
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:20,fontWeight:800,color:"#111827"}}>{sel.name}</span>
                  {sel.nameEn&&<span style={{fontSize:13,color:"#9CA3AF"}}>{sel.nameEn}</span>}
                  <span style={{fontSize:11,padding:"2px 9px",borderRadius:10,
                    background:STATUS_BG[sel.status]||"#F3F4F6",color:STATUS_COLOR[sel.status]||"#6B7280",fontWeight:700}}>
                    {sel.status}
                  </span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 20px",fontSize:13,color:"#374151"}}>
                  {[
                    ["본부",sel.dept],["직급",sel.rank],
                    ["이메일",sel.email],["핸드폰",sel.mobile||sel.핸드폰번호],
                    ["입사일",sel.joinDate||sel.입사일],
                    ["퇴사일",sel.resignDate||sel.퇴사일||"-"],
                  ].map(([l,v])=>(
                    <div key={l} style={{display:"flex",gap:6}}>
                      <span style={{color:"#9CA3AF",minWidth:40,flexShrink:0}}>{l}</span>
                      <span style={{fontWeight:v&&v!=="-"?600:400}}>{v||"-"}</span>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button onClick={()=>startEdit(sel)}
                    style={{padding:"6px 14px",background:"#6366F1",color:"#fff",border:"none",borderRadius:8,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
                    ✏ 정보 수정
                  </button>
                  <button onClick={()=>{if(window.confirm("삭제하시겠습니까?")) {setStaff(p=>p.filter(s=>s.id!==sel.id));setSelId(null)}}}
                    style={{padding:"6px 14px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:8,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
                    🗑 삭제
                  </button>
                </div>
              </div>
            </div>

            {/* 나무위키식 히스토리 */}
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
              <div style={{padding:"13px 18px",borderBottom:"1px solid #E5E7EB",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:14,fontWeight:800,color:"#111827"}}>📋 {sel.name} 히스토리 ({(sel.memo||[]).length}건)</div>
              </div>
              {/* 메모 입력 */}
              <div style={{padding:"12px 16px",background:"#F9FAFB",borderBottom:"1px solid #E5E7EB",display:"flex",gap:8}}>
                <input value={newMemo} onChange={e=>setNewMemo(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addMemo()}
                  placeholder="특이사항, 프로젝트, 이력 등 메모 입력 (Enter로 저장)"
                  style={{...INP,flex:1}}/>
                <button onClick={addMemo}
                  style={{padding:"7px 16px",background:"#6366F1",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                  + 추가
                </button>
              </div>
              {/* 히스토리 목록 (최신순) */}
              <div style={{maxHeight:400,overflowY:"auto"}}>
                {(sel.memo||[]).length===0 && (
                  <div style={{padding:"40px",textAlign:"center",color:"#9CA3AF",fontSize:13}}>
                    아직 기록된 히스토리가 없습니다.
                  </div>
                )}
                {[...(sel.memo||[])].reverse().map((m,i)=>(
                  <div key={i} style={{padding:"12px 16px",borderBottom:"1px solid #F3F4F6",display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:3,background:"#6366F1",borderRadius:2,alignSelf:"stretch",flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:700,color:"#6366F1"}}>{m.date}</span>
                        {m.author&&<span style={{fontSize:11,color:"#9CA3AF"}}>by {m.author}</span>}
                      </div>
                      <div style={{fontSize:13.5,color:"#111827",lineHeight:1.6}}>{m.text}</div>
                    </div>
                    <button onClick={()=>setStaff(prev=>prev.map(s=>s.id===sel.id?
                      {...s,memo:(s.memo||[]).filter((_,mi)=>(s.memo||[]).length-1-i!==mi)}:s))}
                      style={{padding:"2px 8px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:5,fontSize:11,cursor:"pointer",flexShrink:0}}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!sel && !showAdd && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* 본부별 통계 */}
            <div style={{background:"linear-gradient(135deg,#312E81,#6366F1)",borderRadius:14,padding:"18px 20px",color:"#fff"}}>
              <div style={{fontSize:16,fontWeight:800,marginBottom:12}}>👥 직원 관리 시스템</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                {[["전체",staff.length,"👤"],
                  ["재직",staff.filter(s=>s.status==="재직").length,"✅"],
                  ["휴직",staff.filter(s=>s.status==="휴직").length,"⏸"],
                  ["퇴사",staff.filter(s=>s.status==="퇴사").length,"📤"],
                ].map(([l,v,ic])=>(
                  <div key={l} style={{background:"rgba(255,255,255,.15)",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                    <div style={{fontSize:18,marginBottom:4}}>{ic}</div>
                    <div style={{fontSize:20,fontWeight:800}}>{v}</div>
                    <div style={{fontSize:11,opacity:.8}}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* 본부별 재직자 */}
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"16px 18px"}}>
              <div style={{fontSize:14,fontWeight:800,marginBottom:12,color:"#111827"}}>🏢 본부별 재직 인원 (퇴사 제외)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {Object.entries(deptStats).sort((a,b)=>b[1]-a[1]).map(([d,c])=>(
                  <div key={d} style={{padding:"8px 14px",background:"#EEF2FF",borderRadius:10,
                    border:`2px solid ${DEPT_COLORS[d]||"#6366F1"}`,cursor:"pointer",
                    display:"flex",gap:8,alignItems:"center"}}
                    onClick={()=>setFilter(p=>({...p,dept:d,status:"재직"}))}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:DEPT_COLORS[d]||"#6366F1"}}/>
                    <span style={{fontSize:13,fontWeight:700,color:DEPT_COLORS[d]||"#6366F1"}}>{d}</span>
                    <span style={{fontSize:15,fontWeight:900,color:"#111827"}}>{c}명</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:"20px",textAlign:"center",color:"#9CA3AF",fontSize:13}}>
              왼쪽 목록에서 직원을 클릭하면 상세정보와 히스토리를 볼 수 있습니다
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
