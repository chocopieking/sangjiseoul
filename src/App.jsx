
import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import * as XLSX from "xlsx"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Area, ReferenceLine, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, Legend
} from "recharts"
import {
  hashPw, ALL_USERS, MASTER_PW, ROLE_BADGE,
  fE, fW, fP, fPy, fPct, toPy, PY, getAreaBasis, calcUP, calcPnlTotals,
  MONTHS, DEPTS, DEPT_COLORS, COLORS,
  BIZ_2026, DEPT_STAFF_INIT, DEPT_BIZ, CF_2026, PNL_INIT, YEARS_DB_INIT,
  PROJECTS_INIT, ALERTS_INIT
} from "./data.js"

// ── 색상 팔레트 ───────────────────────────────────────────────
const C = {
  navy:"#0C447C",navyM:"#185FA5",navyL:"#E6F1FB",
  green:"#1D9E75",greenL:"#EAF3DE",
  amber:"#BA7517",amberL:"#FAEEDA",
  red:"#A32D2D",  redL:"#FCEBEB",
  gray:"#888780", grayL:"#F1EFE8",
}
const LEVEL_STYLE = {
  critical:{bg:C.redL,  fg:C.red,  border:C.red},
  warning: {bg:C.amberL,fg:"#633806",border:C.amber},
  info:    {bg:C.navyL, fg:C.navyM,border:C.navyM},
}
const TYPE_BADGE = {
  계약:{bg:C.navyL, fg:C.navy},  확정:{bg:C.greenL,fg:"#27500A"},
  추진:{bg:C.amberL,fg:"#633806"},기성:{bg:"#E1F5EE",fg:"#085041"},
}

// ── 스타일 헬퍼 ───────────────────────────────────────────────
const S = {
  card:(x={})=>({background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:12,padding:"15px 17px",marginBottom:13,...x}),
  kpi:(accent=C.navyM)=>({background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:12,padding:"14px 16px",borderLeft:`4px solid ${accent}`,cursor:"pointer",transition:"box-shadow .15s"}),
  grid:(c,g=12)=>({display:"grid",gridTemplateColumns:`repeat(${c},1fr)`,gap:g,marginBottom:g}),
  th:(a="left")=>({padding:"8px 10px",textAlign:a,fontSize:11,fontWeight:500,color:"var(--color-text-secondary,#888)",background:"var(--color-background-secondary,#f8f8f6)",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",whiteSpace:"nowrap"}),
  td:(a="right")=>({padding:"8px 10px",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",textAlign:a,fontSize:13,verticalAlign:"middle"}),
  btn:(bg=C.navyM,fg="#fff")=>({padding:"7px 13px",background:bg,color:fg,border:"none",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}),
  inp:()=>({padding:"7px 9px",border:"1px solid var(--color-border-secondary,#ddd)",borderRadius:7,fontSize:12,width:"100%",background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)",fontFamily:"inherit"}),
  lbl:()=>({display:"block",fontSize:11,color:C.gray,fontWeight:500,marginBottom:3}),
  bdg:(bg,fg)=>({display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:500,background:bg,color:fg}),
}

// ════════════════════════════════════════════════════════════
// 메인 앱
// ════════════════════════════════════════════════════════════
export default function App() {
  // ── 인증 ──
  const [auth, setAuth]       = useState("login")
  const [currentUser, setCurrentUser] = useState(null)
  const [loginId, setLoginId] = useState("")
  const [loginPw, setLoginPw] = useState("")
  const [loginError, setLoginError] = useState("")
  const [pwVisible, setPwVisible]   = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [lockUntil, setLockUntil]   = useState(null)
  const [pwMap, setPwMap]     = useState(()=>{ try{ return JSON.parse(localStorage.getItem("sjs_pw")||"{}") }catch{ return {} }})
  const [initDone, setInitDone] = useState(false)
  const users = useMemo(()=>ALL_USERS.map(u=>({...u,_pwHash:pwMap[u.id]||""})),[pwMap])
  const savePwMap = m => { localStorage.setItem("sjs_pw",JSON.stringify(m)); setPwMap(m) }

  useEffect(()=>{
    const init = async ()=>{
      const map = pwMap
      if (!map["U000"]) {
        const mh = await hashPw(MASTER_PW)
        const dh = await hashPw("sangjiseoul2026!")
        const nm = {...map}
        ALL_USERS.forEach(u=>{ if(!nm[u.id]) nm[u.id]=u.id==="U000"?mh:dh })
        savePwMap(nm)
      }
      setInitDone(true)
    }
    init()
  },[])

  const doLogin = async ()=>{
    if (lockUntil&&Date.now()<lockUntil) { setLoginError(`${Math.ceil((lockUntil-Date.now())/1000)}초 후 다시 시도하세요.`); return }
    if (!loginId.trim()||!loginPw) { setLoginError("이메일과 비밀번호를 입력하세요."); return }
    if (!initDone) { setLoginError("시스템 초기화 중입니다."); return }
    const u = users.find(u=>u.loginId.toLowerCase()===loginId.trim().toLowerCase()&&u.active)
    if (!u) { setLoginError("등록되지 않은 계정입니다."); return }
    if (!u._pwHash) { setLoginError("계정 초기화 중입니다. 잠시 후 재시도하세요."); return }
    const ih = await hashPw(loginPw)
    if (ih !== u._pwHash) {
      const n = loginAttempts+1; setLoginAttempts(n)
      if (n>=5) { setLockUntil(Date.now()+5*60*1000); setLoginError("5회 오류. 5분 잠금."); setLoginAttempts(0) }
      else setLoginError(`비밀번호 오류 (${n}/5회)`)
      return
    }
    setLoginAttempts(0); setLockUntil(null); setLoginError("")
    setCurrentUser(u); setAuth("app"); setLoginId(""); setLoginPw("")
  }
  const doLogout = ()=>{ setCurrentUser(null); setAuth("login"); setLoginId(""); setLoginPw("") }
  const saveUsers = (updated)=>{ const nm={}; updated.forEach(u=>{if(u._pwHash)nm[u.id]=u._pwHash}); savePwMap(nm) }
  const canWrite = currentUser?.write===true

  // ── 앱 상태 ──
  const [tab, setTab]             = useState("analysis")
  const [projects, setProjects]   = useState(PROJECTS_INIT)
  const [pnlData, setPnlData]     = useState(PNL_INIT)
  const [years, setYears]         = useState(YEARS_DB_INIT)
  const [deptStaff, setDeptStaff] = useState(DEPT_STAFF_INIT)
  const [alerts, setAlerts]       = useState(ALERTS_INIT)
  const [showAlerts, setShowAlerts] = useState(false)
  const [selProjId, setSelProjId] = useState(null)
  const [selVerIdx, setSelVerIdx] = useState(0)
  const [cmpIds, setCmpIds]       = useState([])
  const [showNewProj, setShowNewProj] = useState(false)
  const [showNewVer, setShowNewVer]   = useState(false)
  const [uploadMsg, setUploadMsg]     = useState("")
  const uploadRef = useRef(null)
  const unread = alerts.filter(a=>!a.read).length

  // 알람
  const readAlert = id => setAlerts(p=>p.map(a=>a.id===id?{...a,read:true}:a))
  const readAll   = ()  => setAlerts(p=>p.map(a=>({...a,read:true})))

  // 엑셀 업로드
  const handleUpload = useCallback(e=>{
    const file = e.target.files?.[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev=>{
      try {
        const wb = XLSX.read(ev.target.result,{type:"array"})
        const ws1=wb.Sheets["프로젝트정보"], ws2=wb.Sheets["협력업체비용"]
        if(!ws1||!ws2){setUploadMsg("⚠ '프로젝트정보'와 '협력업체비용' 시트가 필요합니다.");return}
        const r1=XLSX.utils.sheet_to_json(ws1,{header:1,defval:""}), r2=XLSX.utils.sheet_to_json(ws2,{header:1,defval:""})
        const code=String(r1[5]?.[0]||"").trim(), pname=String(r1[5]?.[2]||"").trim()
        if(!code||!pname){setUploadMsg("⚠ 프로젝트코드와 프로젝트명은 필수입니다.");return}
        const vendors=[]
        for(let i=4;i<r2.length;i++){
          const row=r2[i]; if(!row[0]||String(row[0]).trim()!==code) continue
          const cat=String(row[1]||"").trim(), name=String(row[2]||"").trim(), contract=parseInt(row[3])||0
          if(cat&&contract) vendors.push({cat,name,contract,nego1:parseInt(row[4])||0,nego2:parseInt(row[5])||0})
        }
        const newVer={ver:`업로드_${new Date().toISOString().slice(0,10)}`,date:new Date().toISOString().slice(0,10),reason:"엑셀 업로드",laborCost:0,directExp:0,subContract:vendors.reduce((s,v)=>s+v.contract,0),indirect:null,profit:null,vendors}
        const exist=projects.find(p=>p.code===code)
        if(exist){
          setProjects(prev=>prev.map(p=>p.id===exist.id?{...p,versions:[...p.versions,newVer]}:p))
          setUploadMsg(`✓ ${exist.name} — 버전 추가 완료 (협력업체 ${vendors.length}개)`)
        } else {
          const siteArea=parseFloat(r1[9]?.[3])||0, floorArea=parseFloat(r1[9]?.[5])||0
          setProjects(prev=>[...prev,{id:`P${Date.now()}`,year:String(r1[5]?.[1]||""),code,name:pname,depts:String(r1[5]?.[4]||"").split(",").map(s=>s.trim()).filter(Boolean),pm:String(r1[5]?.[5]||""),director:String(r1[5]?.[6]||""),projType:String(r1[5]?.[3]||""),usage:"",scale:"",siteArea,buildArea:null,floorArea,units:parseInt(r1[7]?.[4])||0,client:String(r1[7]?.[0]||""),clientPm:String(r1[7]?.[1]||""),totalFee:parseInt(r1[9]?.[0])||0,shareRatio:(parseFloat(r1[9]?.[1])||100)/100,serviceFee:parseInt(r1[9]?.[2])||0,address:String(r1[7]?.[5]||""),contractDate:String(r1[11]?.[0]||""),orderDate:String(r1[11]?.[1]||""),note:"",type:"계약",prog:0,acc:0,rev26:0,versions:[newVer]}])
          setUploadMsg(`✓ 신규 프로젝트 등록: ${pname}`)
        }
      }catch(err){setUploadMsg("⚠ 오류: "+err.message)}
      e.target.value=""
    }
    reader.readAsArrayBuffer(file)
  },[projects])

  if (!initDone) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--color-background-tertiary,#f5f5f3)"}}><div style={{textAlign:"center"}}><div style={{width:36,height:36,border:`3px solid ${C.navyM}`,borderTop:"3px solid transparent",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 12px"}}/><div style={{fontSize:13,color:C.gray}}>초기화 중…</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div></div>

  if (auth==="login") return <LoginScreen {...{loginId,setLoginId,loginPw,setLoginPw,loginError,doLogin,pwVisible,setPwVisible}}/>

  const TABS = [
    {id:"analysis",  label:"📊 경영분석"},
    {id:"cashflow",  label:"💧 월수금계획"},
    {id:"projects",  label:"🏗 프로젝트"},
    {id:"pnl",       label:"📉 손익분석"},
    {id:"auth_mgmt", label:"🔐 권한관리"},
  ]

  return (
    <div style={{fontFamily:"var(--font-sans,'Apple SD Gothic Neo',sans-serif)",fontSize:13,color:"var(--color-text-primary,#222)",background:"var(--color-background-tertiary,#f5f5f3)",minHeight:"100vh"}}>

      {/* 헤더 */}
      <div style={{background:C.navy,padding:"11px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,background:C.navyM,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📐</div>
          <div>
            <div style={{fontSize:15,fontWeight:500,color:"#fff"}}>상지서울건축사사무소 — 통합경영시스템</div>
            <div style={{fontSize:11,color:"#85B7EB"}}>기준 2026-06-09 · 5월 누계 · 억원(수주:VAT별도 / 매출·지출:VAT포함)</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={()=>setShowNewProj(true)} style={S.btn(C.green)}><i className="ti ti-plus" aria-hidden="true"/> 프로젝트</button>
          <button onClick={()=>uploadRef.current?.click()} style={S.btn(C.amberL,C.amber)}><i className="ti ti-upload" aria-hidden="true"/> 엑셀</button>
          <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleUpload}/>
          {uploadMsg&&<span style={{fontSize:10,color:uploadMsg.startsWith("✓")?C.green:C.red,background:"rgba(255,255,255,.1)",padding:"3px 7px",borderRadius:6}}>{uploadMsg}</span>}
          {/* 알람 */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowAlerts(o=>!o)} style={{...S.btn("rgba(255,255,255,.12)","#fff"),border:"1px solid rgba(255,255,255,.2)",position:"relative"}}>
              <i className="ti ti-bell" aria-label="알람" style={{fontSize:15}}/>
              {unread>0&&<span style={{position:"absolute",top:-4,right:-4,width:16,height:16,background:C.red,borderRadius:"50%",fontSize:9,fontWeight:600,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</span>}
            </button>
            {showAlerts&&<AlertPanel {...{alerts,readAlert,readAll,setTab,setShowAlerts}}/>}
          </div>
          {/* 사용자 */}
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"#378ADD",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:500,color:"#fff"}}>{currentUser.avatar}</div>
            <div><div style={{fontSize:11,color:"#fff",fontWeight:500}}>{currentUser.name}</div><div style={{fontSize:10,color:"#85B7EB"}}>{ROLE_BADGE[currentUser.role]?.label}</div></div>
            <button onClick={doLogout} style={{...S.btn("rgba(255,255,255,.1)","#85B7EB"),padding:"4px 9px",fontSize:10,border:"1px solid rgba(255,255,255,.15)"}}>로그아웃</button>
          </div>
        </div>
      </div>

      {/* 탭 바 */}
      <div style={{background:"var(--color-background-primary,#fff)",borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)",display:"flex",overflowX:"auto",padding:"0 15px"}}>
        {TABS.filter(t=>t.id!=="auth_mgmt"||currentUser.role==="admin").map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 15px",border:"none",background:"none",fontSize:13,fontWeight:tab===t.id?500:400,cursor:"pointer",whiteSpace:"nowrap",color:tab===t.id?C.navyM:"var(--color-text-secondary,#888)",borderBottom:tab===t.id?`2px solid ${C.navyM}`:"2px solid transparent"}}>{t.label}</button>
        ))}
      </div>

      {/* 바디 */}
      <div style={{padding:"15px 18px",maxWidth:1440,margin:"0 auto"}}>
        {tab==="analysis" && <AnalysisTab deptStaff={deptStaff} setDeptStaff={setDeptStaff} years={years} setYears={setYears} canWrite={canWrite}/>}
        {tab==="cashflow" && <CashflowTab/>}
        {tab==="projects" && <ProjectsTab projects={projects} setProjects={setProjects} selProjId={selProjId} setSelProjId={setSelProjId} selVerIdx={selVerIdx} setSelVerIdx={setSelVerIdx} cmpIds={cmpIds} setCmpIds={setCmpIds} showNewVer={showNewVer} setShowNewVer={setShowNewVer} canWrite={canWrite}/>}
        {tab==="pnl"      && <PnlTab pnlData={pnlData} setPnlData={setPnlData} canWrite={canWrite}/>}
        {tab==="auth_mgmt"&& currentUser.role==="admin" && <AuthTab users={users} saveUsers={saveUsers} currentUser={currentUser} hashPw={hashPw}/>}
      </div>

      {showNewProj&&<NewProjModal onClose={()=>setShowNewProj(false)} onSave={p=>{setProjects(prev=>[...prev,{...p,id:`P${Date.now()}`,versions:[]}]);setShowNewProj(false)}}/>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 로그인
// ════════════════════════════════════════════════════════════
function LoginScreen({loginId,setLoginId,loginPw,setLoginPw,loginError,doLogin,pwVisible,setPwVisible}) {
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--color-background-tertiary,#f5f5f3)"}}>
      <div style={S.card({width:400,padding:"32px 36px"})}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:52,height:52,background:C.navy,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 14px"}}>📐</div>
          <div style={{fontSize:18,fontWeight:500}}>상지서울 통합경영시스템</div>
          <div style={{fontSize:12,color:C.gray,marginTop:3}}>이메일과 비밀번호로 로그인하세요</div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={S.lbl()}>이메일</label>
          <input type="email" value={loginId} onChange={e=>setLoginId(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} placeholder="예: sogum25@gmail.com" style={S.inp()}/>
        </div>
        <div style={{marginBottom:10}}>
          <label style={S.lbl()}>비밀번호</label>
          <div style={{position:"relative"}}>
            <input type={pwVisible?"text":"password"} value={loginPw} onChange={e=>setLoginPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} placeholder="비밀번호" style={{...S.inp(),paddingRight:36}}/>
            <button onClick={()=>setPwVisible(v=>!v)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.gray,fontSize:14}} aria-label={pwVisible?"숨기기":"보기"}><i className={`ti ${pwVisible?"ti-eye-off":"ti-eye"}`} aria-hidden="true"/></button>
          </div>
        </div>
        {loginError&&<div style={{background:C.redL,border:`0.5px solid ${C.red}`,borderRadius:7,padding:"8px 11px",fontSize:12,color:C.red,marginBottom:10}}>{loginError}</div>}
        <button onClick={doLogin} style={{...S.btn(C.navyM),width:"100%",justifyContent:"center",padding:"10px 16px",fontSize:13,marginTop:4}}>로그인</button>
        <div style={{marginTop:16,fontSize:11,color:C.gray,textAlign:"center"}}>계정 문의: sogum25@gmail.com</div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 알람 패널
// ════════════════════════════════════════════════════════════
function AlertPanel({alerts,readAlert,readAll,setTab,setShowAlerts}) {
  return (
    <div style={{position:"absolute",top:"100%",right:0,marginTop:5,width:330,background:"var(--color-background-primary,#fff)",border:"1px solid var(--color-border-secondary,#ddd)",borderRadius:11,boxShadow:"0 5px 24px rgba(0,0,0,.15)",zIndex:700,overflow:"hidden"}}>
      <div style={{padding:"10px 14px",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:13,fontWeight:500}}>알람</span>
        <button onClick={readAll} style={{fontSize:11,color:C.navyM,background:"none",border:"none",cursor:"pointer"}}>전체 읽음</button>
      </div>
      {alerts.map(a=>{
        const st=LEVEL_STYLE[a.level]
        return <div key={a.id} onClick={()=>{readAlert(a.id);setTab(a.tab);setShowAlerts(false)}}
          style={{padding:"10px 14px",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",cursor:"pointer",background:a.read?"":"var(--color-background-secondary,#f8f8f6)",borderLeft:`3px solid ${a.read?"transparent":st.border}`}}
          onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary)"}
          onMouseLeave={e=>e.currentTarget.style.background=a.read?"":"var(--color-background-secondary,#f8f8f6)"}>
          <div style={{display:"flex",gap:7,alignItems:"flex-start"}}>
            <i className={`ti ${a.icon}`} style={{fontSize:14,color:st.fg,flexShrink:0,marginTop:1}} aria-hidden="true"/>
            <div>
              <div style={{fontSize:12,fontWeight:a.read?400:500,display:"flex",justifyContent:"space-between"}}>{a.title}<span style={{fontSize:10,color:C.gray,fontWeight:400,marginLeft:8}}>{a.time}</span></div>
              <div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginTop:2,lineHeight:1.5}}>{a.msg}</div>
            </div>
          </div>
        </div>
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 경영분석 탭 — 본부별 + 통합 인터랙티브
// ════════════════════════════════════════════════════════════
function AnalysisTab({deptStaff,setDeptStaff,years,setYears,canWrite}) {
  const [view, setView]     = useState("total")  // total | dept
  const [selDept, setSelDept] = useState("설계1본부")
  const [editStaff, setEditStaff] = useState(false)
  const [staffDraft, setStaffDraft] = useState(null)
  const [showAddYear, setShowAddYear] = useState(false)
  const [newYearForm, setNewYearForm] = useState({yr:"",목표수주:0,실행수주:0,목표매출:0,실행매출:0,인원:0})

  const b = BIZ_2026
  const totalStaff = Object.values(deptStaff).reduce((s,d)=>s+d.total,0)

  // 전체 본부 레이더 데이터
  const radarData = DEPTS.map(d=>{
    const db = DEPT_BIZ[d]
    const st = deptStaff[d]||{total:1}
    return {
      dept: d.replace("본부","").replace("디자인","디자인"),
      수주달성: db.orderTarget>0 ? Math.min(+(((db.orderDone+db.orderConfirmed)/db.orderTarget)*100).toFixed(0),150) : 0,
      인당수주: st.total>0 ? +((db.orderDone+db.orderConfirmed)/st.total).toFixed(1) : 0,
      매출달성: db.revTarget>0 ? Math.min(+(db.revCum/db.revTarget*100).toFixed(0),150) : 0,
      손익점수: Math.max(0, 100+Math.round(db.pnl5m*5)),
    }
  })

  // 본부별 바 데이터
  const deptBarData = DEPTS.map((d,i)=>{
    const db=DEPT_BIZ[d], st=deptStaff[d]||{total:1}
    return {
      name: d.replace("본부","").slice(0,4),
      수주목표: db.orderTarget,
      수주실행: +(db.orderDone+db.orderConfirmed).toFixed(2),
      매출목표: db.revTarget,
      매출실행: +db.revCum.toFixed(2),
      지출: +db.cost5m.toFixed(2),
      손익: +db.pnl5m.toFixed(2),
      인당수주: +((db.orderDone+db.orderConfirmed)/(st.total||1)).toFixed(2),
    }
  })

  const yearLine = years.map(y=>({name:y.yr, 수주:y.실행수주, 매출:y.실행매출, 인원:y.인원}))

  return (
    <div>
      {/* 뷰 전환 */}
      <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:2,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:8,padding:3}}>
          {[["total","통합"],["dept","본부별"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",border:"none",borderRadius:6,fontSize:12,fontWeight:view===v?500:400,cursor:"pointer",background:view===v?"var(--color-background-primary,#fff)":"none",color:view===v?C.navyM:"var(--color-text-secondary,#888)",boxShadow:view===v?"0 0 0 0.5px var(--color-border-tertiary)":"none"}}>{l}</button>
          ))}
        </div>
        {view==="dept" && (
          <select value={selDept} onChange={e=>setSelDept(e.target.value)} style={{padding:"6px 10px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
            {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {canWrite && (
          !editStaff
            ? <button onClick={()=>{setStaffDraft(JSON.parse(JSON.stringify(deptStaff)));setEditStaff(true)}} style={{...S.btn(C.navyL,C.navyM),padding:"6px 12px",fontSize:11}}><i className="ti ti-users" aria-hidden="true"/> 인원 수정</button>
            : <><button onClick={()=>{setDeptStaff(staffDraft);setEditStaff(false);setStaffDraft(null)}} style={{...S.btn(C.green),padding:"6px 12px",fontSize:11}}>저장</button>
                <button onClick={()=>{setEditStaff(false);setStaffDraft(null)}} style={{...S.btn(C.grayL,C.gray),padding:"6px 12px",fontSize:11}}>취소</button></>
        )}
      </div>

      {view==="total" && (
        <>
          {/* KPI 카드 8개 */}
          <div style={S.grid(4)}>
            {[
              {l:"수주 목표",    v:fE(b.orderTarget),    s:"VAT별도",             c:C.navyM, acc:C.navyM},
              {l:"계약 + 확정",  v:fE(b.orderDone+b.orderConfirmed), s:`${((b.orderDone+b.orderConfirmed)/b.orderTarget*100).toFixed(1)}%`, c:C.green, acc:C.green, bar:(b.orderDone+b.orderConfirmed)/b.orderTarget},
              {l:"추진 포함",    v:fE(b.orderDone+b.orderConfirmed+b.orderPush), s:"226%", c:"#3B6D11", acc:C.green},
              {l:"매출 목표",    v:fE(b.revenueTarget),  s:"VAT포함",             c:C.amber, acc:C.amber},
              {l:"누계 매출",    v:fE(b.revenueCum),     s:`${(b.revenueCum/b.revenueTarget*100).toFixed(1)}%`, c:C.amber, acc:C.amber, bar:b.revenueCum/b.revenueTarget},
              {l:"누계 지출",    v:fE(b.costCum),        s:"5월 누계",            c:C.red, acc:C.red},
              {l:"누계 손익",    v:fE(b.pnlCum),         s:"매출-지출",           c:C.red, acc:"#791F1F"},
              {l:"예상기성(연간)",v:fE(CF_2026.reduce((s,d)=>s+d.cash+d.note,0)), s:"현금+어음", c:C.navyM, acc:C.navyM},
            ].map(k=>(
              <div key={k.l} style={{...S.kpi(k.acc)}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 14px rgba(24,95,165,.13)"}
                onMouseLeave={e=>e.currentTarget.style.boxShadow=""}>
                <div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginBottom:7}}>{k.l}</div>
                <div style={{fontSize:26,fontWeight:500,color:k.c,letterSpacing:-.5}}>{k.v}</div>
                <div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginTop:5}}>{k.s}</div>
                {k.bar!=null&&<div style={{marginTop:9,height:4,background:"var(--color-border-tertiary,#e8e8e4)",borderRadius:2,overflow:"hidden"}}><div style={{width:`${Math.min(k.bar*100,100).toFixed(0)}%`,height:4,background:k.acc,borderRadius:2}}/></div>}
              </div>
            ))}
          </div>

          {/* 비상경영 배너 */}
          <div style={{background:C.amberL,borderLeft:`4px solid ${C.amber}`,borderRadius:"0 10px 10px 0",padding:"11px 16px",fontSize:13,color:"#633806",marginBottom:14,display:"flex",gap:10,lineHeight:1.6}}>
            <i className="ti ti-alert-triangle" style={{fontSize:17,flexShrink:0,marginTop:1}} aria-hidden="true"/>
            <span><strong>비상경영 체제.</strong> 5월 누계 지출(57.37억)이 매출(29.61억)의 194%. 7월 기성집중(36.32억)으로 하반기 회복 가능. 민간위험 48.64억 별도 모니터링 필요.</span>
          </div>

          {/* 본부별 수주·매출·지출 비교 (핵심 차트) */}
          <Card title="본부별 수주·매출·지출 통합 현황" note="VAT별도(수주) / VAT포함(매출·지출) · 5월 누계">
            <div style={S.grid(2,12)}>
              <div>
                <div style={{fontSize:12,color:C.gray,fontWeight:500,marginBottom:8}}>수주 달성 (목표 대비)</div>
                {DEPTS.map((d,i)=>{
                  const db=DEPT_BIZ[d]
                  const done=db.orderDone+db.orderConfirmed
                  const pct=db.orderTarget>0?Math.min(done/db.orderTarget,1.5):0
                  const c=pct>=1?C.green:pct>=.5?C.navyM:C.amber
                  return <div key={d} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)"}}>
                    <span style={{fontSize:12,color:"var(--color-text-secondary)",width:80,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.replace("본부","")}</span>
                    <div style={{flex:1,height:9,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:5,overflow:"hidden"}}><div style={{width:`${Math.min(pct*100,100).toFixed(0)}%`,height:9,background:c,borderRadius:5}}/></div>
                    <span style={{fontSize:12,fontWeight:500,color:c,minWidth:40,textAlign:"right"}}>{fE(done)}</span>
                    <span style={{fontSize:11,color:c,minWidth:34,textAlign:"right"}}>{db.orderTarget>0?((done/db.orderTarget)*100).toFixed(0)+"%":"-"}</span>
                  </div>
                })}
              </div>
              <div>
                <div style={{fontSize:12,color:C.gray,fontWeight:500,marginBottom:8}}>매출·지출·손익 (5월 누계, 억원)</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={deptBarData} margin={{top:4,right:6,left:-12,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                    <XAxis dataKey="name" tick={{fontSize:11}} tickLine={false}/>
                    <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
                    <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억`,n]}/>
                    <Bar dataKey="매출실행" name="매출" fill={C.green} opacity={.85} radius={[3,3,0,0]} barSize={14}/>
                    <Bar dataKey="지출" name="지출" fill={C.red} opacity={.75} radius={[3,3,0,0]} barSize={14}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          {/* 본부별 인원·인당 생산성 */}
          <div style={S.grid(2,12)}>
            <Card title="본부별 인원 구성" note={editStaff?"수정 중":"클릭 → 인원 수정"} style={{marginBottom:0}}>
              {(editStaff?staffDraft:deptStaff) && Object.entries(editStaff?staffDraft:deptStaff).filter(([k])=>DEPTS.includes(k)).map(([dept,st])=>(
                <div key={dept} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)"}}>
                  <span style={{fontSize:12,color:"var(--color-text-secondary)",width:80,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dept.replace("본부","")}</span>
                  {editStaff
                    ? <input type="number" step="0.5" value={staffDraft[dept].total} onChange={e=>setStaffDraft(prev=>({...prev,[dept]:{...prev[dept],total:parseFloat(e.target.value)||0}}))}
                        style={{...S.inp(),width:60,padding:"3px 6px",textAlign:"right"}}/>
                    : <div style={{flex:1,height:8,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:4,overflow:"hidden"}}><div style={{width:`${(st.total/20*100).toFixed(0)}%`,height:8,background:DEPT_COLORS[dept]||C.navyM,borderRadius:4}}/></div>}
                  <span style={{fontSize:13,fontWeight:500,minWidth:36,textAlign:"right"}}>{st.total}명</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",fontSize:12,fontWeight:600}}>
                <span>전사 합계</span>
                <span style={{color:C.navyM}}>{Object.values(editStaff?staffDraft:deptStaff).filter((_,i)=>i<4).reduce((s,d)=>s+d.total,0).toFixed(1)}명 (+경영지원 {(editStaff?staffDraft:deptStaff)["경영지원"]?.total||0}명)</span>
              </div>
            </Card>

            <Card title="본부별 인당 수주·매출" note="억원/인 · 5월 누계 기준" style={{marginBottom:0}}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={DEPTS.map(d=>{
                  const db=DEPT_BIZ[d], st=deptStaff[d]||{total:1}
                  return {name:d.replace("본부","").slice(0,4), 인당수주:+((db.orderDone+db.orderConfirmed)/st.total).toFixed(2), 인당매출:+(db.revCum/st.total).toFixed(2)}
                })} margin={{top:4,right:6,left:-12,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                  <XAxis dataKey="name" tick={{fontSize:11}} tickLine={false}/>
                  <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
                  <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억/인`,n]}/>
                  <Bar dataKey="인당수주" name="인당수주" fill={C.navyM} radius={[3,3,0,0]} barSize={16}/>
                  <Bar dataKey="인당매출" name="인당매출" fill={C.amber} radius={[3,3,0,0]} barSize={16}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* 3개년 추이 */}
          <Card title="연도별 수주·매출 추이" note={`${years[0].yr}~${years[years.length-1].yr} · VAT별도(수주) / VAT포함(매출)`}>
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
              {canWrite&&<button onClick={()=>setShowAddYear(true)} style={{...S.btn(C.green),padding:"5px 11px",fontSize:11}}>+ 연도 추가</button>}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={yearLine} margin={{top:4,right:10,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                <XAxis dataKey="name" tick={{fontSize:12}}/>
                <YAxis tick={{fontSize:10}} tickFormatter={v=>v+"억"}/>
                <Tooltip formatter={(v,n)=>[`${(+v).toFixed(2)}억`,n]}/>
                <Bar dataKey="수주" fill={C.navyM} opacity={.8} radius={[3,3,0,0]} barSize={20}/>
                <Bar dataKey="매출" fill={C.amber} opacity={.75} radius={[3,3,0,0]} barSize={20}/>
                <Line type="monotone" dataKey="인원" yAxisId="right" stroke={C.gray} strokeDasharray="5 3" strokeWidth={1.5} dot={{r:3}}/>
                <YAxis yAxisId="right" orientation="right" tick={{fontSize:9}} tickFormatter={v=>v+"명"}/>
                <ReferenceLine yAxisId="right" y={0} stroke="none"/>
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          {/* 본부별 손익 요약 테이블 */}
          <Card title="본부별 수주·매출·지출·손익 종합 (5월 누계)">
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  {["본부","수주 목표","계약+확정","수주 달성률","인원","인당수주","매출 목표","기성수금","지출","손익"].map((h,i)=>(
                    <th key={h} style={S.th(i>0?"right":"left")}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {DEPTS.map((d,i)=>{
                    const db=DEPT_BIZ[d], st=deptStaff[d]||{total:1}
                    const done=db.orderDone+db.orderConfirmed
                    const cr=db.orderTarget>0?((done/db.orderTarget)*100).toFixed(1):"-"
                    const bc=parseFloat(cr)>=100?"#27500A":parseFloat(cr)>=50?C.navyM:"#633806"
                    const bg=parseFloat(cr)>=100?C.greenL:parseFloat(cr)>=50?C.navyL:C.amberL
                    return <tr key={d} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                      <td style={{...S.td("left"),fontWeight:500,color:DEPT_COLORS[d]||C.navyM}}>{d}</td>
                      <td style={S.td("right")}>{db.orderTarget.toFixed(1)}</td>
                      <td style={{...S.td("right"),fontWeight:500}}>{done.toFixed(2)}</td>
                      <td style={S.td("right")}>{cr!=="-"?<span style={S.bdg(bg,bc)}>{cr}%</span>:"-"}</td>
                      <td style={S.td("right")}>{st.total.toFixed(1)}</td>
                      <td style={{...S.td("right"),color:C.navyM,fontWeight:500}}>{(done/st.total).toFixed(2)}억</td>
                      <td style={S.td("right")}>{db.revTarget>0?db.revTarget.toFixed(1):"-"}</td>
                      <td style={{...S.td("right"),color:C.amber}}>{db.revCum.toFixed(2)}</td>
                      <td style={{...S.td("right"),color:C.red}}>{db.cost5m.toFixed(2)}</td>
                      <td style={{...S.td("right"),fontWeight:500,color:db.pnl5m>=0?C.green:C.red}}>{db.pnl5m.toFixed(2)}</td>
                    </tr>
                  })}
                  <tr style={{background:"var(--color-background-secondary,#f0f0ee)",fontWeight:600}}>
                    <td style={S.td("left")}>전사 합계</td>
                    <td style={S.td("right")}>170.0</td>
                    <td style={{...S.td("right"),color:C.green}}>{(BIZ_2026.orderDone+BIZ_2026.orderConfirmed).toFixed(2)}</td>
                    <td style={S.td("right")}><span style={S.bdg(C.amberL,"#633806")}>{((BIZ_2026.orderDone+BIZ_2026.orderConfirmed)/170*100).toFixed(1)}%</span></td>
                    <td style={S.td("right")}>{Object.values(deptStaff).filter((_,i)=>i<4).reduce((s,d)=>s+d.total,0).toFixed(1)}</td>
                    <td style={{...S.td("right"),color:C.navyM,fontWeight:600}}>{((BIZ_2026.orderDone+BIZ_2026.orderConfirmed)/Object.values(deptStaff).filter((_,i)=>i<4).reduce((s,d)=>s+d.total,1)).toFixed(2)}억</td>
                    <td style={S.td("right")}>145.0</td>
                    <td style={{...S.td("right"),color:C.amber}}>29.61</td>
                    <td style={{...S.td("right"),color:C.red}}>57.37</td>
                    <td style={{...S.td("right"),color:C.red,fontWeight:600}}>-27.76</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {view==="dept" && (() => {
        const db=DEPT_BIZ[selDept], st=deptStaff[selDept]||{total:1}
        const done=db.orderDone+db.orderConfirmed
        const cfDept = CF_2026.map(m=>({name:m.m, 기성:(m.byDept?.[selDept]||0)+( m.note||0)}))
        return (
          <>
            <div style={S.grid(5)}>
              {[
                {l:"수주 목표",v:fE(db.orderTarget),c:C.navyM,acc:C.navyM},
                {l:"계약+확정",v:fE(done),s:`${db.orderTarget>0?((done/db.orderTarget)*100).toFixed(1):"-"}%`,c:C.green,acc:C.green,bar:db.orderTarget>0?done/db.orderTarget:0},
                {l:"인원",v:`${st.total}명`,s:"연평균",c:C.navyM,acc:C.navyM},
                {l:"인당수주",v:`${(done/st.total).toFixed(2)}억`,c:C.navyM,acc:C.navyM},
                {l:"손익(5월)",v:fE(db.pnl5m),s:"매출-지출",c:db.pnl5m>=0?C.green:C.red,acc:db.pnl5m>=0?C.green:C.red},
              ].map(k=>(
                <div key={k.l} style={S.kpi(k.acc)}>
                  <div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginBottom:6}}>{k.l}</div>
                  <div style={{fontSize:22,fontWeight:500,color:k.c}}>{k.v}</div>
                  {k.s&&<div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginTop:4}}>{k.s}</div>}
                  {k.bar!=null&&<div style={{marginTop:8,height:4,background:"var(--color-border-tertiary,#e8e8e4)",borderRadius:2,overflow:"hidden"}}><div style={{width:`${Math.min(k.bar*100,100).toFixed(0)}%`,height:4,background:k.acc,borderRadius:2}}/></div>}
                </div>
              ))}
            </div>
            <div style={S.grid(2,12)}>
              <Card title={`${selDept} 월별 기성수금`} note="VAT포함 억원" style={{marginBottom:0}}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={cfDept} margin={{top:4,right:6,left:-12,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                    <XAxis dataKey="name" tick={{fontSize:10}} tickFormatter={v=>v.replace("월","")}/>
                    <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
                    <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억`,n]}/>
                    <Bar dataKey="기성" fill={DEPT_COLORS[selDept]||C.navyM} radius={[3,3,0,0]} barSize={20}/>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title={`${selDept} 매출·지출·손익`} note="5월 누계 · 억원" style={{marginBottom:0}}>
                <div style={{display:"flex",flexDirection:"column",gap:8,paddingTop:8}}>
                  {[["매출(5월)",db.revCum,C.green],["지출(5월)",db.cost5m,C.red],["손익(5월)",db.pnl5m,db.pnl5m>=0?C.green:C.red]].map(([l,v,c])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"var(--color-background-secondary,#f8f8f6)",borderRadius:8}}>
                      <span style={{fontSize:13,color:"var(--color-text-secondary,#888)"}}>{l}</span>
                      <span style={{fontSize:22,fontWeight:500,color:c}}>{fE(v)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )
      })()}

      {/* 연도 추가 모달 */}
      {showAddYear&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
          <div style={S.card({width:380,maxWidth:"95vw"})}>
            <div style={{fontSize:14,fontWeight:500,marginBottom:14}}>연도 데이터 추가</div>
            {[["yr","연도","text"],["목표수주","수주목표(억)","number"],["실행수주","수주실행(억)","number"],["목표매출","매출목표(억)","number"],["실행매출","매출실행(억)","number"],["인원","연평균인원","number"]].map(([k,l,t])=>(
              <div key={k} style={{marginBottom:9}}>
                <label style={S.lbl()}>{l}</label>
                <input type={t} value={newYearForm[k]} onChange={e=>setNewYearForm(p=>({...p,[k]:t==="number"?parseFloat(e.target.value)||0:e.target.value}))} style={S.inp()}/>
              </div>
            ))}
            <div style={{display:"flex",gap:7,marginTop:12}}>
              <button onClick={()=>{if(newYearForm.yr){setYears(p=>[...p,{...newYearForm}]);setShowAddYear(false)}}} style={S.btn(C.navyM)}>추가</button>
              <button onClick={()=>setShowAddYear(false)} style={S.btn(C.grayL,C.gray)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 월수금계획 탭
// ════════════════════════════════════════════════════════════
function CashflowTab() {
  const [view, setView] = useState("total")
  const [selDept, setSelDept] = useState("설계1본부")

  const totalCash=CF_2026.reduce((s,d)=>s+d.cash,0)
  const totalNote=CF_2026.reduce((s,d)=>s+d.note,0)
  const totalBlue=CF_2026.reduce((s,d)=>s+d.blue,0)
  const q=[[0,1,2],[3,4,5],[6,7,8],[9,10,11]].map(idx=>idx.reduce((s,i)=>s+(CF_2026[i].cash+CF_2026[i].note),0))

  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:2,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:8,padding:3}}>
          {[["total","전체합산"],["dept","본부별"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"6px 13px",border:"none",borderRadius:6,fontSize:12,fontWeight:view===v?500:400,cursor:"pointer",background:view===v?"var(--color-background-primary,#fff)":"none",color:view===v?C.navyM:"var(--color-text-secondary,#888)",boxShadow:view===v?"0 0 0 0.5px var(--color-border-tertiary)":"none"}}>{l}</button>
          ))}
        </div>
        {view==="dept"&&<select value={selDept} onChange={e=>setSelDept(e.target.value)} style={{padding:"6px 10px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
          {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
        </select>}
      </div>

      {view==="total" && (
        <>
          <div style={S.grid(6)}>
            {[["연간합계",`${(totalCash+totalNote).toFixed(2)}억`,"현금+어음",C.navyM],["현금",`${totalCash.toFixed(2)}억`,"어음제외",C.navyM],["어음",totalNote>0?`${totalNote.toFixed(2)}억`:"없음","별도관리",totalNote>0?C.amber:C.gray],["민간위험",`${totalBlue.toFixed(2)}억`,"파란셀",C.red],["상반기",`${(q[0]+q[1]).toFixed(2)}억`,"1~6월",""],["하반기",`${(q[2]+q[3]).toFixed(2)}억`,"7~12월",""]].map(([l,v,s,c])=>(
              <div key={l} style={S.kpi(c||C.navyM)}>
                <div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginBottom:6}}>{l}</div>
                <div style={{fontSize:20,fontWeight:500,color:c||"var(--color-text-primary)"}}>{v}</div>
                <div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginTop:4}}>{s}</div>
              </div>
            ))}
          </div>
          {totalBlue>0&&<div style={{background:C.amberL,borderLeft:`3px solid ${C.amber}`,borderRadius:"0 8px 8px 0",padding:"9px 13px",fontSize:12,color:"#633806",marginBottom:12,display:"flex",gap:8}}>
            <i className="ti ti-flag" aria-hidden="true" style={{flexShrink:0,marginTop:1}}/>
            <span><strong>민간위험 {totalBlue.toFixed(2)}억</strong> — 7월 14.32억(동해용정·청량리), 9월 6.99억(안산장상)이 시행사 상황에 따라 달성 불확실합니다. 합계에 포함, 별도 모니터링 필요.</span>
          </div>}
          <Card title="월별 기성수금 — 전체 합산 + 본부별 구성" note="VAT포함 억원 · 스택=본부별">
            <div style={{display:"flex",gap:10,marginBottom:8,flexWrap:"wrap",fontSize:11,color:"var(--color-text-secondary,#888)"}}>
              {DEPTS.map((d,i)=><span key={d} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:COLORS[i],flexShrink:0}}/>{d}</span>)}
              <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:C.amber}}/> 어음</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={CF_2026.map(m=>({name:m.m,...Object.fromEntries(DEPTS.map(d=>[d,+(m.byDept?.[d]||0).toFixed(2)])),어음:+m.note.toFixed(2)}))} margin={{top:4,right:6,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                <XAxis dataKey="name" tick={{fontSize:11}} tickFormatter={v=>v.replace("월","")} tickLine={false}/>
                <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
                <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억`,n]}/>
                {DEPTS.map((d,i)=><Bar key={d} dataKey={d} fill={COLORS[i]} stackId="s" barSize={22} radius={i===DEPTS.length-1?[3,3,0,0]:[0,0,0,0]}/>)}
                <Bar dataKey="어음" fill={C.amber} stackId="s" barSize={22} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="월별 상세 내역">
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  <th style={S.th("left")}>월</th>
                  <th style={S.th("right")}>현금(억)</th>
                  <th style={S.th("right")}>어음(억)</th>
                  <th style={S.th("right")}>합계(억)</th>
                  <th style={S.th("right")}>민간위험</th>
                  {DEPTS.map(d=><th key={d} style={S.th("right")}>{d.replace("본부","").slice(0,4)}</th>)}
                  <th style={S.th("center")}>상태</th>
                </tr></thead>
                <tbody>
                  {CF_2026.map((d,i)=>{
                    const tot=d.cash+d.note
                    return <tr key={i} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                      <td style={{...S.td("left"),fontWeight:d.actual?600:400}}>{d.m}{d.actual&&<span style={{...S.bdg(C.navyL,C.navyM),marginLeft:5,fontSize:9}}>실적</span>}</td>
                      <td style={{...S.td("right"),fontSize:14}}>{d.cash.toFixed(2)}</td>
                      <td style={{...S.td("right"),color:d.note>0?C.amber:"var(--color-text-secondary,#aaa)"}}>{d.note>0?d.note.toFixed(2):"-"}</td>
                      <td style={{...S.td("right"),fontWeight:500,fontSize:15,color:tot>20?C.green:tot>10?C.navyM:"inherit"}}>{tot.toFixed(2)}</td>
                      <td style={S.td("right")}>{d.blue>0?<span style={S.bdg(C.amberL,"#633806")}>{d.blue.toFixed(2)}억</span>:"-"}</td>
                      {DEPTS.map(dept=><td key={dept} style={{...S.td("right"),fontSize:12,color:(d.byDept?.[dept]||0)>0?DEPT_COLORS[dept]:C.gray}}>{(d.byDept?.[dept]||0)>0?(d.byDept[dept]).toFixed(2):"-"}</td>)}
                      <td style={S.td("center")}><span style={S.bdg(d.actual?C.greenL:C.grayL,d.actual?C.green:C.gray)}>{d.actual?"실적":"예상"}</span></td>
                    </tr>
                  })}
                  <tr style={{background:"var(--color-background-secondary,#f0f0ee)",fontWeight:600}}>
                    <td style={S.td("left")}>합계</td>
                    <td style={{...S.td("right"),color:C.navyM}}>{totalCash.toFixed(2)}</td>
                    <td style={{...S.td("right"),color:totalNote>0?C.amber:"var(--color-text-secondary)"}}>{totalNote>0?totalNote.toFixed(2):"-"}</td>
                    <td style={{...S.td("right"),color:C.green,fontSize:16}}>{(totalCash+totalNote).toFixed(2)}</td>
                    <td style={S.td("right")}>{totalBlue>0?<span style={S.bdg(C.redL,C.red)}>{totalBlue.toFixed(2)}억</span>:"-"}</td>
                    {DEPTS.map(d=><td key={d} style={{...S.td("right"),color:DEPT_COLORS[d]}}>{CF_2026.reduce((s,m)=>s+(m.byDept?.[d]||0),0).toFixed(2)}</td>)}
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {view==="dept" && (()=>{
        const deptCash=CF_2026.map(m=>({name:m.m,기성:+(m.byDept?.[selDept]||0).toFixed(2)}))
        const deptTotal=CF_2026.reduce((s,m)=>s+(m.byDept?.[selDept]||0),0)
        const deptActual=CF_2026.slice(0,5).reduce((s,m)=>s+(m.byDept?.[selDept]||0),0)
        return (
          <>
            <div style={S.grid(4)}>
              {[["연간 예상",fE(deptTotal),"현금+어음",C.navyM],["5월 누계",fE(deptActual),"실적",C.green],["연간 최대월",CF_2026.reduce((max,m)=>(m.byDept?.[selDept]||0)>max.v?{m:m.m,v:(m.byDept?.[selDept]||0)}:max,{m:"-",v:0}).m,"",""],["비율(전체대비)",`${(deptTotal/(totalCash+totalNote)*100).toFixed(1)}%`,"기여도",C.amber]].map(([l,v,s,c])=>(
                <div key={l} style={S.kpi(c||C.navyM)}><div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginBottom:6}}>{l}</div><div style={{fontSize:20,fontWeight:500,color:c||"var(--color-text-primary)"}}>{v}</div>{s&&<div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginTop:4}}>{s}</div>}</div>
              ))}
            </div>
            <Card title={`${selDept} 월별 기성수금`} note="VAT포함 억원">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={deptCash} margin={{top:4,right:6,left:-10,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                  <XAxis dataKey="name" tick={{fontSize:11}} tickFormatter={v=>v.replace("월","")} tickLine={false}/>
                  <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
                  <Tooltip formatter={(v,_)=>[`${v.toFixed(2)}억`,"기성수금"]}/>
                  <Bar dataKey="기성" fill={DEPT_COLORS[selDept]||C.navyM} radius={[3,3,0,0]} barSize={24}
                    label={{position:"top",fontSize:10,formatter:v=>v>0?v.toFixed(2):""}}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </>
        )
      })()}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 프로젝트 탭
// ════════════════════════════════════════════════════════════
function ProjectsTab({projects,setProjects,selProjId,setSelProjId,selVerIdx,setSelVerIdx,cmpIds,setCmpIds,showNewVer,setShowNewVer,canWrite}) {
  const [view, setView] = useState("list")  // list | detail | compare | bench
  const [deptFilter, setDeptFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [editVend, setEditVend]     = useState(false)
  const [vDraft, setVDraft]         = useState(null)

  const selProj = projects.find(p=>p.id===selProjId)
  const selVer  = selProj?.versions?.[selVerIdx]
  const allCats = useMemo(()=>[...new Set(projects.flatMap(p=>p.versions.flatMap(v=>v.vendors.map(vd=>vd.cat))))].sort(),[projects])

  const filtered = projects.filter(p=>(!deptFilter||p.depts.some(d=>d.includes(deptFilter)))&&(!typeFilter||p.type===typeFilter))

  const pyF = selProj ? toPy(selProj.floorArea||0) : 0
  const pyS = selProj ? toPy(selProj.siteArea||0)  : 0

  const saveVend = ()=>{
    setProjects(prev=>prev.map(p=>p.id===selProj.id?{...p,versions:p.versions.map((v,i)=>i===selVerIdx?{...v,vendors:vDraft}:v)}:p))
    setEditVend(false); setVDraft(null)
  }
  const upd=(i,k,v)=>setVDraft(prev=>prev.map((r,ri)=>ri===i?{...r,[k]:["contract","nego1","nego2"].includes(k)?parseInt(v)||0:v}:r))

  return (
    <div>
      {/* 서브 탭 */}
      <div style={{display:"flex",gap:2,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:8,padding:3,marginBottom:14,width:"fit-content",flexWrap:"wrap"}}>
        {[["list","📋 목록"],["detail","📐 실행계획서"],["compare","🔍 비교"],["bench","📊 평당단가"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{padding:"7px 14px",border:"none",borderRadius:6,fontSize:12,fontWeight:view===v?500:400,cursor:"pointer",background:view===v?"var(--color-background-primary,#fff)":"none",color:view===v?C.navyM:"var(--color-text-secondary,#888)",boxShadow:view===v?"0 0 0 0.5px var(--color-border-tertiary)":"none"}}>{l}</button>
        ))}
      </div>

      {/* ── 목록 ── */}
      {view==="list" && (
        <>
          <div style={{display:"flex",gap:7,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            {[["deptFilter",setDeptFilter,[["","전체 본부"],["설계1","설계1본부"],["설계2","설계2본부"],["디자인","디자인본부"],["주거","주거디자인"],["해외","해외사업부"]]],
              ["typeFilter",setTypeFilter,[["","전체 구분"],["계약","계약"],["확정","확정"],["추진","추진"],["기성","기성"]]]
            ].map(([id,setter,opts])=>(
              <select key={id} onChange={e=>setter(e.target.value)} style={{padding:"6px 9px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
                {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            ))}
            <span style={{fontSize:11,color:C.gray}}>{filtered.length}건</span>
          </div>
          <Card title="프로젝트 목록" note="행 클릭 → 실행계획서 상세">
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  <th style={S.th("center")}>비교</th>
                  {["구분","코드","프로젝트명","본부","PM","용역비","지분%","연면적㎡","대지㎡","세대","진행%","계약일","수주일","다운"].map((h,i)=><th key={h+i} style={S.th(i>=5&&i<=12?"right":"left")}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filtered.map((p,i)=>{
                    const tb=TYPE_BADGE[p.type]||{bg:C.grayL,fg:C.gray}
                    const bc=p.prog>=70?C.green:p.prog>=30?C.navyM:C.gray
                    return <tr key={p.id} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)",cursor:"pointer"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(24,95,165,.04)"}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}
                      onClick={()=>{setSelProjId(p.id);setSelVerIdx(p.versions.length-1);setView("detail")}}>
                      <td style={S.td("center")} onClick={e=>e.stopPropagation()}><input type="checkbox" checked={cmpIds.includes(p.id)} onChange={e=>setCmpIds(prev=>e.target.checked?[...prev,p.id]:prev.filter(id=>id!==p.id))}/></td>
                      <td style={S.td("left")}><span style={S.bdg(tb.bg,tb.fg)}>{p.type}</span></td>
                      <td style={{...S.td("left"),fontFamily:"monospace",fontSize:11,color:C.navyM}}>{p.code}</td>
                      <td style={{...S.td("left"),maxWidth:190,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={p.name}>{p.name}</td>
                      <td style={{...S.td("left"),fontSize:11}}>{p.depts.join(", ")}</td>
                      <td style={{...S.td("left"),fontSize:11}}>{p.pm}</td>
                      <td style={{...S.td("right"),fontWeight:500}}>{fE(p.serviceFee)}</td>
                      <td style={{...S.td("right"),fontSize:11}}>{(p.shareRatio*100).toFixed(0)}%</td>
                      <td style={{...S.td("right"),fontSize:11}}>{p.floorArea?.toLocaleString()}</td>
                      <td style={{...S.td("right"),fontSize:11}}>{p.siteArea?.toLocaleString()}</td>
                      <td style={{...S.td("right"),fontSize:11}}>{p.units||"-"}</td>
                      <td style={S.td("right")}><div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"flex-end"}}><div style={{width:44,height:6,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:3,overflow:"hidden"}}><div style={{width:`${p.prog}%`,height:6,background:bc,borderRadius:3}}/></div><span style={{fontSize:11,fontWeight:500,color:bc}}>{p.prog}%</span></div></td>
                      <td style={{...S.td("right"),fontSize:11}}>{p.contractDate||"-"}</td>
                      <td style={{...S.td("right"),fontSize:11,color:p.orderDate?C.green:C.gray,fontWeight:p.orderDate?500:400}}>{p.orderDate||"미수주"}</td>
                      <td style={S.td("center")} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>{
                          const ver=p.versions[p.versions.length-1]; if(!ver) return
                          const wb=XLSX.utils.book_new()
                          const pyF2=toPy(p.floorArea||0), pyS2=toPy(p.siteArea||0)
                          const pnl=calcPnlTotals(ver)
                          XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["프로젝트코드",p.code,"","작성일",ver.date],["프로젝트명",p.name],["주관본부",p.depts.join(", "),"","PM",p.pm],["발주처",p.client],["계약일",p.contractDate,"","수주일",p.orderDate||"미수주"],["총설계비",p.totalFee,"","상지지분",(p.shareRatio*100).toFixed(0)+"%"],["용역비",p.serviceFee],["대지면적",`${(p.siteArea||0).toLocaleString()}㎡(${pyS2}평)`,"","연면적",`${(p.floorArea||0).toLocaleString()}㎡(${pyF2}평)`],["세대수",p.units||"-"],[""],["직접인건비",ver.laborCost],["직접경비",ver.directExp],["외주용역비",ver.subContract],["간접비",pnl.indirect],["이윤",pnl.profit],["합계",pnl.total]]),"기본정보")
                          XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["프로젝트코드",p.code,"","버전",ver.ver],["연면적(평)",pyF2,"","대지면적(평)",pyS2],[""],["분야","업체명","원가견적","1차NEGO","2차NEGO","면적기준","평당단가","용역비대비"],...ver.vendors.map(v=>{const b2=getAreaBasis(v.cat),py=b2==="대지"?pyS2:b2==="연면적"?pyF2:0,up=py>0?Math.round(v.contract/py):"-";return[v.cat,v.name,v.contract,v.nego1||"-",v.nego2||"-",b2==="대지"?"대지면적":b2==="연면적"?"연면적":"1식",up,p.serviceFee>0?`${(v.contract/p.serviceFee*100).toFixed(2)}%`:"-"]}),["","합계",ver.vendors.reduce((s,v)=>s+v.contract,0)]]),"협력업체비용")
                          XLSX.writeFile(wb,`실행계획서_${p.code}_${ver.ver}.xlsx`)
                        }} style={{...S.btn(C.navyL,C.navyM),padding:"3px 8px",fontSize:10}}>↓xlsx</button>
                      </td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          {cmpIds.length>=2&&<div style={{background:C.greenL,border:`1px solid ${C.green}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:13,color:"#27500A"}}><strong>{cmpIds.length}개 프로젝트</strong> 선택됨</span>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setView("compare")} style={S.btn(C.green)}>비용 비교</button>
              <button onClick={()=>setView("bench")} style={S.btn(C.navyM)}>평당단가</button>
            </div>
          </div>}
        </>
      )}

      {/* ── 실행계획서 상세 ── */}
      {view==="detail" && (
        <div>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:11,color:C.gray}}>프로젝트:</span>
            <select value={selProjId||""} onChange={e=>{setSelProjId(e.target.value);setSelVerIdx(projects.find(p=>p.id===e.target.value)?.versions.length-1||0)}} style={{padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
              <option value="">프로젝트 선택</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.code} — {p.name.slice(0,22)}</option>)}
            </select>
          </div>

          {selProj ? (
            <>
              {/* 기본정보 카드 */}
              <Card title={`📐 ${selProj.name}`} note={selProj.code}>
                {/* 계약·수주 배너 */}
                <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                  {[
                    {l:"계약일",v:selProj.contractDate||"미계약",bg:"var(--color-background-secondary,#f8f8f6)",c:"var(--color-text-primary)"},
                    {l:"수주일 (계약금 10% 수령)",v:selProj.orderDate||"미수주",bg:selProj.orderDate?C.greenL:"var(--color-background-secondary,#f8f8f6)",c:selProj.orderDate?C.green:"var(--color-text-secondary)"},
                    {l:"용역비 (VAT별도)",v:fW(selProj.serviceFee),bg:C.navyL,c:C.navyM},
                  ].map(k=>(
                    <div key={k.l} style={{flex:1,minWidth:160,background:k.bg,borderRadius:8,padding:"10px 13px"}}>
                      <div style={{fontSize:10,color:C.gray,fontWeight:500,marginBottom:3}}>{k.l}</div>
                      <div style={{fontSize:16,fontWeight:500,color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                <div style={S.grid(4,9)}>
                  {[["연도",selProj.year],["주관본부",selProj.depts.join(", ")],["담당PM",selProj.pm],["담당본부장",selProj.director],
                    ["프로젝트유형",selProj.projType],["용도",selProj.usage],["규모",selProj.scale],["발주처",selProj.client],
                    ["발주처담당자",selProj.clientPm||"-"],["총설계비",fW(selProj.totalFee)],["상지지분",(selProj.shareRatio*100).toFixed(0)+"%"],["세대수",selProj.units?selProj.units.toLocaleString()+"세대":"-"]
                  ].map(([k,v])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",fontSize:12}}>
                      <span style={{color:C.gray,fontWeight:500,flexShrink:0,marginRight:6}}>{k}</span>
                      <span style={{textAlign:"right"}}>{v||"-"}</span>
                    </div>
                  ))}
                </div>
                {/* 면적 */}
                <div style={{marginTop:12}}>
                  <div style={{fontSize:11,color:C.navyM,fontWeight:500,marginBottom:8}}>면적 정보 (평당단가 산출 기준)</div>
                  <div style={S.grid(4,9)}>
                    <div style={{background:C.amberL,borderRadius:8,padding:"9px 11px"}}>
                      <div style={{fontSize:10,color:C.amber,fontWeight:500,marginBottom:2}}>대지면적</div>
                      <div style={{fontSize:14,fontWeight:500}}>{(selProj.siteArea||0).toLocaleString()}㎡</div>
                      <div style={{fontSize:12,color:C.amber,marginTop:1,fontWeight:500}}>{pyS.toLocaleString()}평</div>
                      <div style={{fontSize:9,color:C.gray,marginTop:1}}>토목·조경 기준</div>
                    </div>
                    <div style={{background:C.greenL,borderRadius:8,padding:"9px 11px"}}>
                      <div style={{fontSize:10,color:C.green,fontWeight:500,marginBottom:2}}>연면적</div>
                      <div style={{fontSize:14,fontWeight:500}}>{(selProj.floorArea||0).toLocaleString()}㎡</div>
                      <div style={{fontSize:12,color:C.green,marginTop:1,fontWeight:500}}>{pyF.toLocaleString()}평</div>
                      <div style={{fontSize:9,color:C.gray,marginTop:1}}>구조·기계·전기 기준</div>
                    </div>
                    <div style={{background:"var(--color-background-secondary,#f8f8f6)",borderRadius:8,padding:"9px 11px"}}>
                      <div style={{fontSize:10,color:C.gray,fontWeight:500,marginBottom:2}}>건축면적</div>
                      <div style={{fontSize:14,fontWeight:500}}>{selProj.buildArea?selProj.buildArea.toLocaleString()+"㎡":"미입력"}</div>
                    </div>
                    <div style={{background:C.navyL,borderRadius:8,padding:"9px 11px"}}>
                      <div style={{fontSize:10,color:C.navyM,fontWeight:500,marginBottom:2}}>연면적 기준 평당단가</div>
                      <div style={{fontSize:14,fontWeight:500,color:C.navyM}}>{pyF>0?fPy(selProj.serviceFee/pyF):"N/A"}</div>
                      <div style={{fontSize:9,color:C.gray,marginTop:1}}>용역비 기준</div>
                    </div>
                  </div>
                </div>
                {selProj.address&&<div style={{marginTop:8,fontSize:12,color:C.gray}}>📍 {selProj.address}</div>}
                {selProj.note&&<div style={{marginTop:3,fontSize:12,color:C.gray}}>📝 {selProj.note}</div>}
              </Card>

              {/* 버전 선택 */}
              <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:11,color:C.gray}}>버전:</span>
                {selProj.versions.map((v,i)=>(
                  <button key={i} onClick={()=>setSelVerIdx(i)} style={{...S.btn(i===selVerIdx?C.navyM:C.navyL,i===selVerIdx?"#fff":C.navy),padding:"5px 11px",fontSize:11}}>
                    {v.ver} <span style={{fontSize:9,opacity:.7}}>({v.date})</span>
                  </button>
                ))}
                {canWrite&&<button onClick={()=>setShowNewVer(true)} style={{...S.btn(C.green),padding:"5px 11px",fontSize:11}}>+ 버전 추가</button>}
              </div>

              {selVer && (
                <>
                  <div style={S.grid(2,12)}>
                    <Card title="비용 구성 요약" note={selVer.ver}>
                      {(()=>{
                        const pnl=calcPnlTotals(selVer)
                        return <table style={{width:"100%",borderCollapse:"collapse"}}>
                          <thead><tr>{["항목","금액(원)","억원","비율"].map((h,i)=><th key={h} style={S.th(i>0?"right":"left")}>{h}</th>)}</tr></thead>
                          <tbody>
                            {[{l:"직접인건비",v:selVer.laborCost,c:C.navyM},{l:"직접경비",v:selVer.directExp,c:C.navyM},{l:"외주용역비",v:selVer.subContract,c:C.amber},
                              {l:"직접비 소계",v:pnl.direct,bold:true,bg:"var(--color-background-secondary)"},{l:"간접비",v:pnl.indirect,c:C.gray},{l:"이윤",v:pnl.profit,c:C.gray},
                              {l:"예상용역금액 합계",v:pnl.total,bold:true,bg:"var(--color-background-secondary)"}
                            ].map((row,i)=>(
                              <tr key={i} style={{background:row.bg||""}}>
                                <td style={{...S.td("left"),fontWeight:row.bold?600:400,color:row.c||"inherit"}}>{row.l}</td>
                                <td style={{...S.td("right"),fontWeight:row.bold?600:400}}>{fW(row.v)}</td>
                                <td style={{...S.td("right"),fontWeight:row.bold?600:400}}>{fE(row.v)}</td>
                                <td style={S.td("right")}>{selProj.serviceFee>0?((row.v||0)/selProj.serviceFee*100).toFixed(1)+"%":"-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      })()}
                    </Card>
                    <Card title="외주비 구성 (억원)">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={selVer.vendors.filter(v=>v.contract>0).map(v=>({name:v.cat.length>5?v.cat.slice(0,5)+"…":v.cat,금액:+(v.contract/1e6).toFixed(1)}))} layout="vertical" margin={{left:55,right:20}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                          <XAxis type="number" tick={{fontSize:9}} tickFormatter={v=>v+"M"}/>
                          <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={55}/>
                          <Tooltip formatter={v=>[v+"백만원","계약금"]}/>
                          <Bar dataKey="금액" fill={C.navyM} radius={[0,3,3,0]} barSize={12}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>

                  {/* 협력업체 상세 */}
                  <Card title="협력업체 상세" note="토목·조경·지반·흙막이·현황측량·부대토목 → 대지면적 기준 | 친환경·교통·BIM·인테리어·외부특화·경관 → 1식">
                    <div style={{display:"flex",gap:5,marginBottom:9,flexWrap:"wrap"}}>
                      {canWrite&&(!editVend
                        ?<button onClick={()=>{setVDraft(selVer.vendors.map(v=>({...v})));setEditVend(true)}} style={S.btn(C.navyM)}>✏ 수정</button>
                        :<><button onClick={saveVend} style={S.btn(C.green)}>✓ 저장</button>
                          <button onClick={()=>setVDraft(prev=>[...prev,{cat:"",name:"",contract:0,nego1:0,nego2:0}])} style={S.btn(C.navyL,C.navyM)}>+ 행</button>
                          <button onClick={()=>{setEditVend(false);setVDraft(null)}} style={S.btn(C.grayL,C.gray)}>취소</button></>
                      )}
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse"}}>
                        <thead><tr>
                          {["분야","업체명","원가견적(원)","1차NEGO","2차NEGO","면적기준","평당단가(원가)","평당단가(2차)","비율%"].map((h,i)=>(
                            <th key={h} style={S.th(i>=2?"right":"left")}>{h}</th>
                          ))}
                          {editVend&&<th style={S.th("center")}>삭제</th>}
                        </tr></thead>
                        <tbody>
                          {(editVend?vDraft:selVer.vendors).map((v,i)=>{
                            const basis=getAreaBasis(v.cat)
                            const py=basis==="대지"?pyS:basis==="연면적"?pyF:0
                            const up1=py>0?v.contract/py:null, up2=py>0&&v.nego2?v.nego2/py:null
                            const bLabel=basis==="대지"?"대지면적":basis==="연면적"?"연면적":"1식"
                            const bColor=basis==="대지"?C.amber:basis==="연면적"?C.green:C.gray
                            return <tr key={i} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                              <td style={S.td("left")}>{editVend?<input value={v.cat} onChange={e=>upd(i,"cat",e.target.value)} style={{...S.inp(),width:90,padding:"3px 5px"}}/>:<span style={S.bdg(C.navyL,C.navyM)}>{v.cat}</span>}</td>
                              <td style={S.td("left")}>{editVend?<input value={v.name} onChange={e=>upd(i,"name",e.target.value)} style={{...S.inp(),width:150,padding:"3px 5px"}}/>:v.name}</td>
                              <td style={S.td("right")}>{editVend?<input type="number" value={v.contract} onChange={e=>upd(i,"contract",e.target.value)} style={{...S.inp(),width:110,padding:"3px 5px",textAlign:"right"}}/>:fW(v.contract)}</td>
                              <td style={{...S.td("right"),color:C.gray}}>{editVend?<input type="number" value={v.nego1||0} onChange={e=>upd(i,"nego1",e.target.value)} style={{...S.inp(),width:90,padding:"3px 5px",textAlign:"right"}}/>:v.nego1?fW(v.nego1):"-"}</td>
                              <td style={{...S.td("right"),color:C.green,fontWeight:v.nego2?500:400}}>{editVend?<input type="number" value={v.nego2||0} onChange={e=>upd(i,"nego2",e.target.value)} style={{...S.inp(),width:90,padding:"3px 5px",textAlign:"right"}}/>:v.nego2?fW(v.nego2):"-"}</td>
                              <td style={S.td("center")}><span style={S.bdg(basis==="대지"?C.amberL:basis==="1식"?C.grayL:C.greenL,bColor)}>{bLabel}</span></td>
                              <td style={{...S.td("right"),color:C.navyM,fontWeight:500}}>{up1?fPy(up1):"1식"}</td>
                              <td style={{...S.td("right"),color:C.green,fontWeight:up2?500:400}}>{up2?fPy(up2):"-"}</td>
                              <td style={S.td("right")}>{selProj.serviceFee>0?(v.contract/selProj.serviceFee*100).toFixed(2)+"%":"-"}</td>
                              {editVend&&<td style={S.td("center")}><button onClick={()=>setVDraft(prev=>prev.filter((_,ri)=>ri!==i))} style={{...S.btn(C.redL,C.red),padding:"2px 6px",fontSize:11}}>✕</button></td>}
                            </tr>
                          })}
                          <tr style={{background:"var(--color-background-secondary,#f5f5f3)",fontWeight:600}}>
                            <td style={{...S.td("left"),fontSize:13}} colSpan={2}>합계</td>
                            <td style={{...S.td("right"),color:C.navyM}}>{fW((editVend?vDraft:selVer.vendors).reduce((s,v)=>s+v.contract,0))}</td>
                            <td style={{...S.td("right"),color:C.gray}}>{fW((editVend?vDraft:selVer.vendors).reduce((s,v)=>s+(v.nego1||0),0))}</td>
                            <td style={{...S.td("right"),color:C.green}}>{fW((editVend?vDraft:selVer.vendors).reduce((s,v)=>s+(v.nego2||0),0))}</td>
                            <td colSpan={3}/><td style={{...S.td("right"),color:C.navyM}}>{selProj.serviceFee>0?((editVend?vDraft:selVer.vendors).reduce((s,v)=>s+v.contract,0)/selProj.serviceFee*100).toFixed(1)+"%":"-"}</td>
                            {editVend&&<td/>}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              )}
              {showNewVer&&<NewVerModal proj={selProj} onClose={()=>setShowNewVer(false)} onSave={v=>{setProjects(prev=>prev.map(p=>p.id===selProj.id?{...p,versions:[...p.versions,v]}:p));setSelVerIdx(selProj.versions.length);setShowNewVer(false)}}/>}
            </>
          ) : <div style={{padding:40,textAlign:"center",color:C.gray}}>위에서 프로젝트를 선택하거나 목록에서 행을 클릭하세요.</div>}
        </div>
      )}

      {/* ── 비교분석 ── */}
      {view==="compare" && (
        <CompareProjects projects={projects} cmpIds={cmpIds} setCmpIds={setCmpIds} allCats={allCats}/>
      )}

      {/* ── 평당단가 ── */}
      {view==="bench" && (
        <BenchProjects projects={projects} cmpIds={cmpIds} setCmpIds={setCmpIds} allCats={allCats}/>
      )}
    </div>
  )
}

// ── 비교분석 컴포넌트 ────────────────────────────────────────
function CompareProjects({projects,cmpIds,setCmpIds,allCats}) {
  const [priceKey,setPriceKey]=useState("contract")
  const [catFilter,setCatFilter]=useState("")
  const selPs=cmpIds.length>0?projects.filter(p=>cmpIds.includes(p.id)):projects.slice(0,3)
  const tableData=useMemo(()=>{
    const cats=catFilter?[catFilter]:allCats
    return cats.map(cat=>{
      const row={cat}
      selPs.forEach(p=>{const ver=p.versions[p.versions.length-1];const vd=ver?.vendors.find(v=>v.cat===cat);row[p.id]=(vd?vd[priceKey]||vd.contract||0:0)})
      return row
    }).filter(row=>selPs.some(p=>row[p.id]>0))
  },[selPs,allCats,catFilter,priceKey])
  const barData=tableData.map(row=>({name:row.cat.length>6?row.cat.slice(0,6)+"…":row.cat,...Object.fromEntries(selPs.map(p=>[p.code.slice(0,10),+(row[p.id]/1e6).toFixed(1)]))}))
  return (
    <div>
      <div style={{display:"flex",gap:7,marginBottom:13,flexWrap:"wrap",alignItems:"center"}}>
        {projects.map(p=><button key={p.id} onClick={()=>setCmpIds(prev=>prev.includes(p.id)?prev.filter(id=>id!==p.id):[...prev,p.id])}
          style={{...S.btn(cmpIds.includes(p.id)||cmpIds.length===0?C.navyM:C.navyL,cmpIds.includes(p.id)||cmpIds.length===0?"#fff":C.navy),padding:"5px 11px",fontSize:11}}>{p.code.slice(0,12)}</button>)}
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
          <option value="">전체 분야</option>{allCats.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={priceKey} onChange={e=>setPriceKey(e.target.value)} style={{padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
          <option value="contract">원가견적</option><option value="nego1">1차NEGO</option><option value="nego2">2차NEGO</option>
        </select>
      </div>
      <Card title="분야별 협력업체 비용 비교" note="단위: 백만원">
        <ResponsiveContainer width="100%" height={Math.max(260,tableData.length*28)}>
          <BarChart data={barData} layout="vertical" margin={{left:70,right:20,top:4,bottom:4}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
            <XAxis type="number" tick={{fontSize:9}} tickFormatter={v=>v+"M"}/>
            <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={70}/>
            <Tooltip formatter={(v,n)=>[`${v}백만원`,n]}/><Legend wrapperStyle={{fontSize:11}}/>
            {selPs.map((p,i)=><Bar key={p.id} dataKey={p.code.slice(0,10)} fill={COLORS[i%COLORS.length]} radius={[0,3,3,0]} barSize={11}/>)}
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="비교 상세표" note="초록=최저 빨강=최고">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><th style={S.th("left")}>분야</th>{selPs.map(p=><th key={p.id} style={S.th("right")}>{p.code.slice(0,12)}</th>)}<th style={S.th("right")}>최저</th><th style={S.th("right")}>최고</th><th style={S.th("right")}>차이율</th></tr></thead>
            <tbody>
              {tableData.map((row,i)=>{
                const vals=selPs.map(p=>row[p.id]).filter(v=>v>0)
                const min=vals.length?Math.min(...vals):0, max=vals.length?Math.max(...vals):0
                return <tr key={row.cat} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={S.td("left")}><span style={S.bdg(C.navyL,C.navyM)}>{row.cat}</span></td>
                  {selPs.map(p=><td key={p.id} style={{...S.td("right"),color:row[p.id]===min&&selPs.length>1&&min>0?C.green:row[p.id]===max&&selPs.length>1?C.red:"inherit",fontWeight:row[p.id]===min&&selPs.length>1&&min>0?600:400}}>{row[p.id]?fW(row[p.id]):"-"}</td>)}
                  <td style={{...S.td("right"),color:C.green,fontWeight:600}}>{min?fW(min):"-"}</td>
                  <td style={{...S.td("right"),color:C.red}}>{max?fW(max):"-"}</td>
                  <td style={S.td("right")}>{min&&max>0?((max-min)/min*100).toFixed(0)+"%":"-"}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── 평당단가 비교 ────────────────────────────────────────────
function BenchProjects({projects,cmpIds,setCmpIds,allCats}) {
  const [selCat,setSelCat]=useState("")
  const UP_CATS=["구조","토목","조경","기계","전기통신소방","전기통신","기계소방","CG","견적","건축외주","부대토목","흙막이","흙막이·지반","지반조사","현황측량","소방"]
  const selPs=cmpIds.length>0?projects.filter(p=>cmpIds.includes(p.id)):projects
  const benchData=useMemo(()=>{
    const cats=selCat?[selCat]:allCats.filter(c=>UP_CATS.some(u=>c.includes(u)||u.includes(c)))
    return cats.map(cat=>{
      const items=[]
      selPs.forEach(p=>{
        const ver=p.versions[p.versions.length-1];const vd=ver?.vendors.find(v=>v.cat===cat)
        if(!vd||!vd.contract) return
        const basis=getAreaBasis(cat);if(basis==="1식") return
        const py=basis==="대지"?toPy(p.siteArea||0):toPy(p.floorArea||0)
        if(py<=0) return
        items.push({projId:p.id,code:p.code.slice(0,12),up:vd.contract/py,up2:vd.nego2?(vd.nego2/py):null,basis:basis==="대지"?"대지면적":"연면적",vendor:vd.name})
      })
      return {cat,items}
    }).filter(r=>r.items.length>0)
  },[selPs,allCats,selCat])
  const barData=benchData.map(row=>({name:row.cat.length>5?row.cat.slice(0,5)+"…":row.cat,...Object.fromEntries(row.items.map(i=>[i.code,+i.up.toFixed(0)]))}))
  return (
    <div>
      <div style={{background:C.navyL,borderLeft:`3px solid ${C.navyM}`,borderRadius:"0 8px 8px 0",padding:"9px 13px",fontSize:12,color:C.navyM,marginBottom:13,lineHeight:1.7}}>
        <strong>평당단가 산출 기준</strong> — 토목·조경·흙막이·지반조사·현황측량·부대토목 → <strong style={{color:C.amber}}>대지면적</strong> / 구조·기계·전기·소방·CG·건축외주 등 → <strong style={{color:C.green}}>연면적</strong> / 친환경·교통·BIM·인테리어·외부특화·경관 → <strong style={{color:C.gray}}>1식 제외</strong>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:13,flexWrap:"wrap",alignItems:"center"}}>
        {projects.map(p=><button key={p.id} onClick={()=>setCmpIds(prev=>prev.includes(p.id)?prev.filter(id=>id!==p.id):[...prev,p.id])}
          style={{...S.btn(cmpIds.includes(p.id)||cmpIds.length===0?C.navyM:C.navyL,cmpIds.includes(p.id)||cmpIds.length===0?"#fff":C.navy),padding:"5px 11px",fontSize:11}}>{p.code.slice(0,12)}</button>)}
        <select value={selCat} onChange={e=>setSelCat(e.target.value)} style={{padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
          <option value="">단가산출 가능 전체 분야</option>
          {allCats.filter(c=>UP_CATS.some(u=>c.includes(u)||u.includes(c))).map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <Card title="공종별 평당단가 비교 (원/평)" note="1식 항목 제외">
        <ResponsiveContainer width="100%" height={Math.max(240,benchData.length*28)}>
          <BarChart data={barData} layout="vertical" margin={{left:60,right:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
            <XAxis type="number" tick={{fontSize:9}} tickFormatter={v=>v.toLocaleString()}/>
            <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={60}/>
            <Tooltip formatter={(v,n)=>[`${v.toLocaleString()}원/평`,n]}/><Legend wrapperStyle={{fontSize:11}}/>
            {selPs.map((p,i)=><Bar key={p.id} dataKey={p.code.slice(0,12)} fill={COLORS[i%COLORS.length]} radius={[0,3,3,0]} barSize={12}/>)}
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="공종별 평당단가 상세 (초록=최저 · 빨강=최고)">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>
              <th style={S.th("left")}>분야</th><th style={S.th("center")}>기준</th>
              {selPs.map(p=><th key={p.id} style={S.th("right")}>{p.code.slice(0,12)}<br/><span style={{fontSize:9,fontWeight:400,color:C.gray}}>원/평 (업체)</span></th>)}
              <th style={S.th("right")}>최저</th><th style={S.th("right")}>최고</th><th style={S.th("right")}>차이</th>
            </tr></thead>
            <tbody>
              {benchData.map((row,i)=>{
                const ups=row.items.map(it=>it.up),min=Math.min(...ups),max=Math.max(...ups)
                const basis=row.items[0]?.basis
                return <tr key={row.cat} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={S.td("left")}><span style={S.bdg(C.navyL,C.navyM)}>{row.cat}</span></td>
                  <td style={S.td("center")}><span style={S.bdg(basis==="대지면적"?C.amberL:C.greenL,basis==="대지면적"?C.amber:C.green)}>{basis}</span></td>
                  {selPs.map(p=>{const it=row.items.find(it=>it.projId===p.id);return(
                    <td key={p.id} style={{...S.td("right"),color:it?.up===min&&selPs.length>1?C.green:it?.up===max&&selPs.length>1?C.red:"inherit",fontWeight:it?.up===min&&selPs.length>1?600:400}}>
                      {it?<>{it.up.toLocaleString()+"원"}<br/><span style={{fontSize:10,color:C.gray}}>{it.vendor?.slice(0,8)}</span></>:"-"}
                    </td>
                  )})}
                  <td style={{...S.td("right"),color:C.green,fontWeight:600}}>{min.toLocaleString()}원</td>
                  <td style={{...S.td("right"),color:C.red}}>{max.toLocaleString()}원</td>
                  <td style={S.td("right")}>{min>0?((max-min)/min*100).toFixed(0)+"%":"-"}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 손익분석 탭
// ════════════════════════════════════════════════════════════
function PnlTab({pnlData,setPnlData,canWrite}) {
  const [view,setView]   = useState("total")
  const [selDept,setSelDept] = useState("설계1본부")
  const [editing,setEditing] = useState(false)
  const [draft,setDraft] = useState(null)

  const calc = r => {
    const lbr=r.sal+r.ot+r.etc_lbr, sub=r.sub_dir+r.sub_stl
    const exp=r.exp+r.biz+r.fix+r.misc, total=lbr+sub+exp+r.shared
    return {lbr,sub,exp,total,pnl:r.rev-total}
  }

  const work = editing?draft:pnlData
  const cum5 = work.slice(0,5).reduce((a,r)=>{
    const c=calc(r)
    return {rev:a.rev+r.rev,lbr:a.lbr+c.lbr,sub:a.sub+c.sub,exp:a.exp+c.exp,shared:a.shared+r.shared,total:a.total+c.total,pnl:a.pnl+c.pnl}
  },{rev:0,lbr:0,sub:0,exp:0,shared:0,total:0,pnl:0})

  const FIELDS=[
    {k:"rev",l:"매출",c:C.green},{k:"sal",l:"급여",c:C.navyM},{k:"ot",l:"야근보조",c:C.navyM},
    {k:"etc_lbr",l:"기타인건비",c:C.navyM},{k:"sub_dir",l:"직접외주비",c:C.amber},{k:"sub_stl",l:"외주정산금",c:C.amber},
    {k:"exp",l:"경비",c:C.gray},{k:"biz",l:"업무추진비",c:C.gray},{k:"fix",l:"집기여비",c:C.gray},
    {k:"misc",l:"기타경비",c:C.gray},{k:"shared",l:"공동비",c:C.gray},
  ]
  const upd=(i,k,v)=>setDraft(prev=>prev.map((r,ri)=>ri===i?{...r,[k]:parseFloat(v)||0}:r))

  const lineData=work.map(r=>{const c=calc(r);return{name:r.m,매출:+r.rev.toFixed(2),지출:+c.total.toFixed(2),손익:+c.pnl.toFixed(2)}})

  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:13,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:2,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:8,padding:3}}>
          {[["total","전체"],["dept","본부별"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"6px 13px",border:"none",borderRadius:6,fontSize:12,fontWeight:view===v?500:400,cursor:"pointer",background:view===v?"var(--color-background-primary,#fff)":"none",color:view===v?C.navyM:"var(--color-text-secondary,#888)",boxShadow:view===v?"0 0 0 0.5px var(--color-border-tertiary)":"none"}}>{l}</button>
          ))}
        </div>
        {view==="dept"&&<select value={selDept} onChange={e=>setSelDept(e.target.value)} style={{padding:"6px 10px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
          {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
        </select>}
        {canWrite&&(!editing
          ?<button onClick={()=>{setDraft(pnlData.map(r=>({...r})));setEditing(true)}} style={{...S.btn(C.navyM),padding:"6px 12px",fontSize:11}}><i className="ti ti-edit" aria-hidden="true"/> 월별 수치 입력</button>
          :<><button onClick={()=>{setPnlData(draft);setEditing(false);setDraft(null)}} style={{...S.btn(C.green),padding:"6px 12px",fontSize:11}}>저장</button>
            <button onClick={()=>{setEditing(false);setDraft(null)}} style={{...S.btn(C.grayL,C.gray),padding:"6px 12px",fontSize:11}}>취소</button>
            <span style={{fontSize:11,color:C.amber}}>수정 중</span></>
        )}
      </div>

      {/* 누계 KPI */}
      <div style={S.grid(7)}>
        {[["매출",fE(cum5.rev),C.green],["인건비",fE(cum5.lbr),C.navyM],["외주비",fE(cum5.sub),C.amber],["경비류",fE(cum5.exp),C.gray],["공동비",fE(cum5.shared),C.gray],["지출합계",fE(cum5.total),C.red],["손익",fE(cum5.pnl),cum5.pnl>=0?C.green:C.red]].map(([l,v,c])=>(
          <div key={l} style={S.kpi(c)}><div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginBottom:6}}>{l}</div><div style={{fontSize:19,fontWeight:500,color:c}}>{v}</div></div>
        ))}
      </div>

      {view==="total" && (
        <>
          <Card title="월별 매출·지출 추이" note="바 클릭 시 해당 월 상세">
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={lineData} margin={{top:4,right:10,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                <XAxis dataKey="name" tick={{fontSize:11}} tickFormatter={v=>v.replace("월","")} tickLine={false}/>
                <YAxis tick={{fontSize:10}} tickFormatter={v=>v+"억"}/>
                <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억`,n]}/>
                <Bar dataKey="매출" fill={C.green} opacity={.8} radius={[3,3,0,0]} barSize={18}/>
                <Bar dataKey="지출" fill={C.red} opacity={.7} radius={[3,3,0,0]} barSize={18}/>
                <Line type="monotone" dataKey="손익" stroke={C.gray} strokeWidth={2} dot={{r:3}} strokeDasharray="5 3"/>
                <ReferenceLine y={0} stroke={C.red} strokeDasharray="4 2"/>
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          <Card title={editing?"📝 월별 수치 입력 (억원)":"월별 손익 상세"} note="입력값 변경 후 저장">
            {editing&&<div style={{background:C.navyL,borderRadius:7,padding:"8px 12px",marginBottom:10,fontSize:11,color:C.navyM}}>셀 클릭 후 억원 단위 입력. 인건비소계·외주비소계·지출합계·손익은 자동계산됩니다.</div>}
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr>
                  <th style={{...S.th("left"),minWidth:80}}>항목</th>
                  {work.map(r=><th key={r.m} style={{...S.th("right"),background:r.m<="5월"?"var(--color-background-secondary,#f0f0ee)":"var(--color-background-tertiary,#f8f8f6)"}}>{r.m}{r.m<="5월"&&<span style={{...S.bdg(C.navyL,C.navyM),marginLeft:2,fontSize:8}}>실</span>}</th>)}
                  <th style={S.th("right")}>합계</th>
                </tr></thead>
                <tbody>
                  {FIELDS.map(({k,l,c},fi)=>{
                    const rowSum=work.reduce((s,r)=>s+(r[k]||0),0)
                    return <tr key={k} style={{background:fi%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                      <td style={{...S.td("left"),color:c,fontSize:12}}>{l}</td>
                      {work.map((r,ri)=>(
                        <td key={ri} style={S.td("right")}>
                          {editing?<input type="number" step="0.01" value={((draft||pnlData)[ri][k]||0).toFixed(2)} onChange={e=>upd(ri,k,e.target.value)} style={{...S.inp(),width:56,fontSize:11,padding:"3px 5px",textAlign:"right"}}/>
                            :<span style={{color:r[k]>0?c:"var(--color-text-secondary,#aaa)",fontSize:12}}>{r[k]>0?(+r[k]).toFixed(2):"-"}</span>}
                        </td>
                      ))}
                      <td style={{...S.td("right"),fontWeight:500,color:c,fontSize:12}}>{rowSum.toFixed(2)}</td>
                    </tr>
                  })}
                  {[{l:"인건비 소계",fn:r=>calc(r).lbr,c:C.navyM},{l:"외주비 소계",fn:r=>calc(r).sub,c:C.amber},{l:"지출 합계",fn:r=>calc(r).total,c:C.red,bg:"var(--color-background-secondary)"},{l:"손익",fn:r=>calc(r).pnl,pnl:true}].map(({l,fn,c,bg,pnl})=>{
                    const vals=work.map(r=>fn(r)),sum=vals.reduce((s,v)=>s+v,0)
                    return <tr key={l} style={{background:pnl?"#FCEBEB":(bg||"var(--color-background-secondary,#f5f5f3)"),fontWeight:500}}>
                      <td style={{...S.td("left"),fontSize:12,color:c||"var(--color-text-primary)"}}>{l}</td>
                      {vals.map((v,i)=><td key={i} style={{...S.td("right"),fontSize:13,color:pnl?(v>=0?C.green:C.red):(c||"inherit")}}>{v.toFixed(2)}</td>)}
                      <td style={{...S.td("right"),fontWeight:700,fontSize:14,color:pnl?(sum>=0?C.green:C.red):(c||"inherit")}}>{sum.toFixed(2)}</td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {view==="dept" && (()=>{
        const deptDataMonthly=work.map(r=>{
          const bd=r.byDept?.[selDept]||{rev:0,sal:0,sub:0}
          const deptRev=bd.rev, deptSal=bd.sal||0, deptSub=bd.sub||0
          const deptCost=deptSal+deptSub+(r.shared*((DEPT_BIZ[selDept]?.cost5m||1)/57.37))
          return {name:r.m, 매출:+deptRev.toFixed(2), 지출:+deptCost.toFixed(2), 손익:+(deptRev-deptCost).toFixed(2)}
        })
        const deptCum5=deptDataMonthly.slice(0,5).reduce((a,r)=>({rev:a.rev+r.매출,cost:a.cost+r.지출,pnl:a.pnl+r.손익}),{rev:0,cost:0,pnl:0})
        const db=DEPT_BIZ[selDept]
        return (
          <>
            <div style={S.grid(4)}>
              {[["매출(5월)",fE(db.revCum),C.green],["지출(5월)",fE(db.cost5m),C.red],["손익(5월)",fE(db.pnl5m),db.pnl5m>=0?C.green:C.red],["인건비비율",fE(cum5.lbr/4)+"(추정)",C.navyM]].map(([l,v,c])=>(
                <div key={l} style={S.kpi(c)}><div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginBottom:6}}>{l}</div><div style={{fontSize:20,fontWeight:500,color:c}}>{v}</div></div>
              ))}
            </div>
            <Card title={`${selDept} 월별 손익 추이`} note="본부별 배분 추정치 · 실제 입력 시 손익 탭에서 직접 입력 가능">
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={deptDataMonthly} margin={{top:4,right:10,left:-10,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                  <XAxis dataKey="name" tick={{fontSize:11}} tickFormatter={v=>v.replace("월","")} tickLine={false}/>
                  <YAxis tick={{fontSize:10}} tickFormatter={v=>v+"억"}/>
                  <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억`,n]}/>
                  <Bar dataKey="매출" fill={C.green} opacity={.8} radius={[3,3,0,0]} barSize={18}/>
                  <Bar dataKey="지출" fill={C.red} opacity={.7} radius={[3,3,0,0]} barSize={18}/>
                  <Line type="monotone" dataKey="손익" stroke={C.gray} strokeWidth={2} dot={{r:3}} strokeDasharray="5 3"/>
                  <ReferenceLine y={0} stroke={C.red} strokeDasharray="4 2"/>
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
            <Card title="전사 손익 vs 본부별 손익 비교" note="5월 누계 · 억원">
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["구분","매출","인건비","외주비","경비","공동비","지출합계","손익"].map((h,i)=><th key={h} style={S.th(i>0?"right":"left")}>{h}</th>)}</tr></thead>
                  <tbody>
                    <tr style={{background:C.navyL}}><td style={{...S.td("left"),color:C.navy,fontWeight:600}}>전사 합계</td><td style={{...S.td("right"),color:C.green}}>29.61</td><td style={S.td("right")}>17.40</td><td style={S.td("right")}>24.31</td><td style={S.td("right")}>4.82</td><td style={S.td("right")}>6.38</td><td style={{...S.td("right"),color:C.red}}>57.37</td><td style={{...S.td("right"),color:C.red,fontWeight:600}}>-27.76</td></tr>
                    {Object.entries(DEPT_BIZ).map(([d,db],i)=>(
                      <tr key={d} style={{background:i%2===0?"var(--color-background-primary)":"var(--color-background-secondary)",fontWeight:d===selDept?600:400}}>
                        <td style={{...S.td("left"),color:d===selDept?DEPT_COLORS[d]:undefined}}>{d}{d===selDept&&<span style={{...S.bdg(C.navyL,C.navyM),marginLeft:5,fontSize:9}}>현재</span>}</td>
                        <td style={{...S.td("right"),color:C.green}}>{db.revCum.toFixed(2)}</td>
                        <td style={S.td("right")}>{(cum5.lbr/4).toFixed(2)}(추정)</td>
                        <td style={S.td("right")}>{(cum5.sub/4).toFixed(2)}(추정)</td>
                        <td style={S.td("right")}>{(cum5.exp/4).toFixed(2)}(추정)</td>
                        <td style={S.td("right")}>-</td>
                        <td style={{...S.td("right"),color:C.red}}>{db.cost5m.toFixed(2)}</td>
                        <td style={{...S.td("right"),fontWeight:500,color:db.pnl5m>=0?C.green:C.red}}>{db.pnl5m.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )
      })()}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 권한관리 탭
// ════════════════════════════════════════════════════════════
function AuthTab({users,saveUsers,currentUser,hashPw}) {
  const [editId,setEditId]=useState(null)
  const [editForm,setEditForm]=useState(null)
  const [showAdd,setShowAdd]=useState(false)
  const [newUser,setNewUser]=useState({name:"",loginId:"",role:"viewer",dept:"",read:true,write:false,canManageUsers:false,active:true,_newPw:""})
  const [pwResetId,setPwResetId]=useState(null)
  const [newPwVal,setNewPwVal]=useState("")
  const [pwMsg,setPwMsg]=useState("")
  const [showMyPw,setShowMyPw]=useState(false)
  const [myOldPw,setMyOldPw]=useState("")
  const [myNewPw,setMyNewPw]=useState("")
  const [myNewPw2,setMyNewPw2]=useState("")
  const [myPwMsg,setMyPwMsg]=useState("")

  const startEdit=u=>{ setEditId(u.id); setEditForm({...u}) }
  const saveEdit =()=>{ saveUsers(users.map(u=>u.id===editId?{...u,...editForm,_pwHash:u._pwHash}:u)); setEditId(null); setEditForm(null) }
  const toggleActive=id=>saveUsers(users.map(u=>u.id===id?{...u,active:!u.active}:u))
  const resetPw=async id=>{
    if(!newPwVal.trim()||newPwVal.length<6){setPwMsg("6자 이상 입력하세요");return}
    const h=await hashPw(newPwVal)
    saveUsers(users.map(u=>u.id===id?{...u,_pwHash:h}:u))
    setPwResetId(null);setNewPwVal("");setPwMsg("변경 완료")
  }
  const changeMyPw=async()=>{
    if(!myOldPw||!myNewPw){setMyPwMsg("모두 입력하세요");return}
    if(myNewPw!==myNewPw2){setMyPwMsg("새 비밀번호 불일치");return}
    if(myNewPw.length<6){setMyPwMsg("6자 이상 필요");return}
    const me=users.find(u=>u.id===currentUser.id)
    if(await hashPw(myOldPw)!==me._pwHash){setMyPwMsg("현재 비밀번호 오류");return}
    const nh=await hashPw(myNewPw);saveUsers(users.map(u=>u.id===currentUser.id?{...u,_pwHash:nh}:u))
    setMyOldPw(""); setMyNewPw(""); setMyNewPw2(""); setMyPwMsg("변경 완료")
  }
  const addUser=async()=>{
    if(!newUser.name||!newUser.loginId||!newUser._newPw){return}
    const h=await hashPw(newUser._newPw)
    const {_newPw,...rest}=newUser
    saveUsers([...users,{...rest,id:`U${Date.now()}`,avatar:newUser.name.slice(0,2),_pwHash:h}])
    setShowAdd(false);setNewUser({name:"",loginId:"",role:"viewer",dept:"",read:true,write:false,canManageUsers:false,active:true,_newPw:""})
  }
  const ROLES=[{v:"admin",l:"관리자"},{v:"executive",l:"임원"},{v:"viewer",l:"열람자"}]
  return (
    <div>
      <div style={{background:C.navyL,border:`0.5px solid ${C.navyM}`,borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",gap:9,alignItems:"flex-start"}}>
        <i className="ti ti-lock" style={{fontSize:16,color:C.navyM,flexShrink:0,marginTop:1}} aria-hidden="true"/>
        <div style={{fontSize:12,color:C.navyM,lineHeight:1.7}}><strong>이메일 + 비밀번호 기반 인증.</strong> 관리자가 등록한 이메일로만 로그인 가능합니다. 비밀번호는 SHA-256으로 암호화하여 브라우저에 저장됩니다.</div>
      </div>
      <div style={S.grid(3,10)}>
        {ROLES.map(r=>{const rb=ROLE_BADGE[r.v];return(
          <div key={r.v} style={{...S.card({marginBottom:0}),borderLeft:`4px solid ${rb.fg}`}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}><span style={S.bdg(rb.bg,rb.fg)}>{rb.label}</span></div>
            <div style={{fontSize:12,color:"var(--color-text-secondary,#555)",lineHeight:1.6}}>
              {r.v==="admin"&&"전체 입력·삭제·사용자 관리"}
              {r.v==="executive"&&"대시보드 조회+손익 입력 가능"}
              {r.v==="viewer"&&"조회 전용 (입력 불가)"}
            </div>
          </div>
        )})}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11,marginTop:4}}>
        <div style={{fontSize:14,fontWeight:500}}>사용자 관리 ({users.length}명)</div>
        <button onClick={()=>setShowAdd(true)} style={S.btn(C.navyM)}><i className="ti ti-user-plus" aria-hidden="true"/> 추가</button>
      </div>
      <Card>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["사용자","이메일","역할","소속","읽기","쓰기","권한관리","상태",""].map((h,i)=><th key={h+i} style={S.th(i===0?"left":"center")}>{h}</th>)}</tr></thead>
            <tbody>
              {users.map((u,i)=>(
                <tr key={u.id} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)",opacity:u.active?1:.5}}>
                  <td style={S.td("left")}><div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:26,height:26,borderRadius:"50%",background:C.navyM,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:500,color:"#fff",flexShrink:0}}>{u.avatar}</div><span style={{fontSize:13,fontWeight:500}}>{u.name}</span></div></td>
                  <td style={{...S.td("center"),fontSize:11,color:C.gray}}>{u.loginId}</td>
                  <td style={S.td("center")}><span style={S.bdg(ROLE_BADGE[u.role].bg,ROLE_BADGE[u.role].fg)}>{ROLE_BADGE[u.role].label}</span></td>
                  <td style={{...S.td("center"),fontSize:12}}>{u.dept}</td>
                  {editId===u.id?(<>
                    <td style={S.td("center")}><input type="checkbox" checked={editForm.read} onChange={e=>setEditForm(f=>({...f,read:e.target.checked}))}/></td>
                    <td style={S.td("center")}><input type="checkbox" checked={editForm.write} onChange={e=>setEditForm(f=>({...f,write:e.target.checked}))}/></td>
                    <td style={S.td("center")}><input type="checkbox" checked={editForm.canManageUsers} onChange={e=>setEditForm(f=>({...f,canManageUsers:e.target.checked}))}/></td>
                    <td style={S.td("center")}><select value={editForm.role} onChange={e=>setEditForm(f=>({...f,role:e.target.value}))} style={{padding:"3px 5px",borderRadius:6,border:"1px solid var(--color-border-secondary,#ddd)",fontSize:11}}>{ROLES.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}</select></td>
                    <td style={S.td("center")}><div style={{display:"flex",gap:4,justifyContent:"center"}}><button onClick={saveEdit} style={{...S.btn(C.green),padding:"4px 9px",fontSize:11}}>저장</button><button onClick={()=>{setEditId(null);setEditForm(null)}} style={{...S.btn(C.grayL,C.gray),padding:"4px 9px",fontSize:11}}>취소</button></div></td>
                  </>):(<>
                    <td style={S.td("center")}>{u.read?<span style={{color:C.green,fontSize:15}}>✓</span>:<span style={{color:C.gray}}>—</span>}</td>
                    <td style={S.td("center")}>{u.write?<span style={{color:C.green,fontSize:15}}>✓</span>:<span style={{color:C.gray}}>—</span>}</td>
                    <td style={S.td("center")}>{u.canManageUsers?<span style={{color:C.amber,fontSize:15}}>✓</span>:<span style={{color:C.gray}}>—</span>}</td>
                    <td style={S.td("center")}><span style={S.bdg(u.active?C.greenL:C.redL,u.active?C.green:C.red)}>{u.active?"활성":"비활성"}</span></td>
                    <td style={S.td("center")}>
                      <div style={{display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap"}}>
                        <button onClick={()=>startEdit(u)} style={{...S.btn(C.navyL,C.navyM),padding:"4px 8px",fontSize:11}}>수정</button>
                        {u.id!==currentUser.id&&<button onClick={()=>{setPwResetId(u.id);setNewPwVal("");setPwMsg("")}} style={{...S.btn(C.amberL,C.amber),padding:"4px 8px",fontSize:11}}>비번</button>}
                        <button onClick={()=>toggleActive(u.id)} style={{...S.btn(u.active?C.redL:C.greenL,u.active?C.red:C.green),padding:"4px 8px",fontSize:11}}>{u.active?"비활":"활성"}</button>
                      </div>
                      {pwResetId===u.id&&<div style={{marginTop:7,background:C.amberL,borderRadius:7,padding:"8px 10px",minWidth:200}}>
                        <div style={{fontSize:11,color:C.amber,marginBottom:5,fontWeight:500}}>비밀번호 초기화</div>
                        <input type="password" value={newPwVal} onChange={e=>setNewPwVal(e.target.value)} placeholder="새 비밀번호(6자이상)" style={{...S.inp(),fontSize:11,marginBottom:5}}/>
                        <div style={{display:"flex",gap:4}}><button onClick={()=>resetPw(u.id)} style={{...S.btn(C.amber),padding:"4px 8px",fontSize:11}}>저장</button><button onClick={()=>setPwResetId(null)} style={{...S.btn(C.gray),padding:"4px 8px",fontSize:11}}>취소</button></div>
                        {pwMsg&&<div style={{fontSize:11,color:C.red,marginTop:3}}>{pwMsg}</div>}
                      </div>}
                    </td>
                  </>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="내 비밀번호 변경">
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <span style={{fontSize:13}}>계정: <strong>{currentUser.loginId}</strong></span>
          <button onClick={()=>setShowMyPw(v=>!v)} style={{...S.btn(C.navyL,C.navyM),padding:"5px 11px",fontSize:11}}>{showMyPw?"닫기":"비밀번호 변경"}</button>
        </div>
        {showMyPw&&<div style={S.grid(3,9)}>
          {[["현재 비밀번호",myOldPw,setMyOldPw],["새 비밀번호",myNewPw,setMyNewPw],["새 비밀번호 확인",myNewPw2,setMyNewPw2]].map(([l,v,setter])=>(
            <div key={l}><label style={S.lbl()}>{l}</label><input type="password" value={v} onChange={e=>setter(e.target.value)} style={S.inp()}/></div>
          ))}
          <div style={{gridColumn:"1/-1",display:"flex",gap:7,alignItems:"center",marginTop:4}}>
            <button onClick={changeMyPw} style={S.btn(C.navyM)}>저장</button>
            {myPwMsg&&<span style={{fontSize:12,color:myPwMsg.startsWith("✓")?C.green:C.red}}>{myPwMsg}</span>}
          </div>
        </div>}
      </Card>
      {showAdd&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:20}}>
        <div style={S.card({width:420,maxWidth:"95vw"})}>
          <div style={{fontSize:14,fontWeight:500,marginBottom:14}}>사용자 추가</div>
          {[["name","이름"],["loginId","이메일(로그인 아이디)"],["dept","소속 부서"]].map(([k,l])=>(
            <div key={k} style={{marginBottom:9}}><label style={S.lbl()}>{l}</label><input type="text" value={newUser[k]||""} onChange={e=>setNewUser(p=>({...p,[k]:e.target.value}))} style={S.inp()}/></div>
          ))}
          <div style={{marginBottom:9}}><label style={S.lbl()}>역할</label><select value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))} style={S.inp()}>{ROLES.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}</select></div>
          <div style={{marginBottom:9}}><label style={S.lbl()}>초기 비밀번호(6자이상)</label><input type="password" value={newUser._newPw||""} onChange={e=>setNewUser(p=>({...p,_newPw:e.target.value}))} style={S.inp()}/></div>
          <div style={{display:"flex",gap:14,marginBottom:13}}>
            {[["read","읽기"],["write","쓰기"],["canManageUsers","권한관리"]].map(([k,l])=>(
              <label key={k} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={newUser[k]||false} onChange={e=>setNewUser(p=>({...p,[k]:e.target.checked}))}/>{l}</label>
            ))}
          </div>
          <div style={{display:"flex",gap:7}}><button onClick={addUser} style={S.btn(C.navyM)}>추가</button><button onClick={()=>setShowAdd(false)} style={S.btn(C.grayL,C.gray)}>취소</button></div>
        </div>
      </div>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 공통 모달: 프로젝트 등록
// ════════════════════════════════════════════════════════════
const PROJ_TYPES = ["공동주택","주상복합","업무시설","공공청사","의료시설","교육시설","물류창고","제약공장","기타"]
const DEPT_LIST  = ["설계1본부","설계2본부","디자인본부","주거디자인본부","해외사업부","경영지원"]

function NewProjModal({onClose,onSave}) {
  const [f,setF]=useState({year:new Date().getFullYear()+"",code:"",name:"",depts:[""],pm:"",director:"",projType:"",usage:"",scale:"",siteArea:0,buildArea:0,floorArea:0,units:0,client:"",clientPm:"",totalFee:0,shareRatio:100,serviceFee:0,address:"",contractDate:"",orderDate:"",note:"",type:"확정",prog:0})
  const u=(k,v)=>setF(p=>({...p,[k]:v}))
  const pyF=toPy(f.floorArea||0), pyS=toPy(f.siteArea||0)
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:300,padding:20,overflowY:"auto"}}>
      <div style={{...S.card(),width:"100%",maxWidth:660,marginTop:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:500}}>신규 프로젝트 등록</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.gray}}>✕</button>
        </div>
        {[
          {title:"기본정보",content:<div style={S.grid(3,9)}>
            {[["연도","year","text"],["코드 *","code","text"],["유형","projType","select"]].map(([l,k,t])=><F key={k} label={l} val={f[k]} onChange={v=>u(k,v)} type={t} opts={t==="select"?PROJ_TYPES:[]}/>)}
            <div style={{gridColumn:"1/-1"}}><F label="프로젝트명 *" val={f.name} onChange={v=>u("name",v)}/></div>
          </div>},
          {title:"조직정보",content:<>
            <div style={{marginBottom:9}}><label style={S.lbl()}>주관본부 (복수선택)</label><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{DEPT_LIST.map(d=><label key={d} style={{display:"flex",alignItems:"center",gap:3,fontSize:12,cursor:"pointer",padding:"3px 8px",borderRadius:6,border:`1px solid ${f.depts.includes(d)?C.navyM:"var(--color-border-secondary)"}`,background:f.depts.includes(d)?C.navyL:"transparent"}}><input type="checkbox" checked={f.depts.includes(d)} onChange={e=>u("depts",e.target.checked?[...f.depts,d]:f.depts.filter(x=>x!==d))}/>{d}</label>)}</div></div>
            <div style={S.grid(2,9)}><F label="담당PM" val={f.pm} onChange={v=>u("pm",v)}/><F label="담당본부장" val={f.director} onChange={v=>u("director",v)}/><F label="발주처" val={f.client} onChange={v=>u("client",v)}/><F label="발주처담당자" val={f.clientPm} onChange={v=>u("clientPm",v)}/></div>
          </>},
          {title:"면적정보",content:<div style={S.grid(3,9)}>
            <div><F label="대지면적(㎡)" val={f.siteArea} onChange={v=>u("siteArea",parseFloat(v)||0)} type="number"/>{f.siteArea>0&&<div style={{fontSize:10,color:C.amber,marginTop:2}}>= {pyS.toLocaleString()}평 ← 토목·조경 기준</div>}</div>
            <F label="건축면적(㎡)" val={f.buildArea} onChange={v=>u("buildArea",parseFloat(v)||0)} type="number"/>
            <div><F label="연면적(㎡)" val={f.floorArea} onChange={v=>u("floorArea",parseFloat(v)||0)} type="number"/>{f.floorArea>0&&<div style={{fontSize:10,color:C.green,marginTop:2}}>= {pyF.toLocaleString()}평 ← 구조·기계 기준</div>}</div>
            <F label="규모" val={f.scale} onChange={v=>u("scale",v)} ph="예: 지하2층/지상25층"/>
            <F label="용도" val={f.usage} onChange={v=>u("usage",v)} ph="예: 공동주택(분양)"/>
            {(f.projType==="공동주택"||f.projType==="주상복합")&&<F label="세대수" val={f.units} onChange={v=>u("units",parseInt(v)||0)} type="number"/>}
          </div>},
          {title:"비용정보",content:<div style={S.grid(3,9)}>
            <F label="총설계비(원,VAT별도)" val={f.totalFee} onChange={v=>u("totalFee",parseInt(v)||0)} type="number"/>
            <div><F label="상지지분(%)" val={f.shareRatio} onChange={v=>u("shareRatio",parseFloat(v)||0)} type="number"/><button onClick={()=>u("serviceFee",Math.round(f.totalFee*f.shareRatio/100))} style={{...S.btn(C.navyL,C.navyM),marginTop:4,padding:"4px 9px",fontSize:10}}>용역비 계산</button></div>
            <div><F label="용역비(원,VAT별도)" val={f.serviceFee} onChange={v=>u("serviceFee",parseInt(v)||0)} type="number"/>{pyF>0&&f.serviceFee>0&&<div style={{fontSize:10,color:C.navyM,marginTop:2}}>평당: {fPy(f.serviceFee/pyF)}</div>}</div>
          </div>},
          {title:"계약·수주정보",content:<>
            <div style={{background:C.navyL,borderRadius:7,padding:"7px 11px",fontSize:11,color:C.navyM,marginBottom:9}}>★ 수주일 = 계약금 10% 수령일 (회사 내규)</div>
            <div style={S.grid(2,9)}><F label="계약일" val={f.contractDate} onChange={v=>u("contractDate",v)} type="date"/><F label="수주일(계약금10%수령)" val={f.orderDate} onChange={v=>u("orderDate",v)} type="date"/></div>
            <F label="주소" val={f.address} onChange={v=>u("address",v)}/><F label="비고" val={f.note} onChange={v=>u("note",v)}/>
          </>},
        ].map(({title,content})=><div key={title} style={{marginBottom:16}}><div style={{fontSize:11,fontWeight:500,color:C.navyM,marginBottom:8,paddingBottom:3,borderBottom:`1px solid ${C.navyL}`}}>{title}</div>{content}</div>)}
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>onSave({...f,shareRatio:f.shareRatio/100,acc:0,rev26:0,versions:[]})} style={S.btn(C.navyM)}>✓ 등록</button>
          <button onClick={onClose} style={S.btn(C.grayL,C.gray)}>취소</button>
        </div>
      </div>
    </div>
  )
}

function NewVerModal({proj,onClose,onSave}) {
  const last=proj.versions[proj.versions.length-1]
  const [f,setF]=useState({ver:`v${proj.versions.length+1}.0 ${proj.versions.length}차변경`,date:new Date().toISOString().slice(0,10),reason:"",laborCost:last?.laborCost||0,directExp:last?.directExp||0,subContract:last?.subContract||0,indirect:null,profit:null,vendors:(last?.vendors||[]).map(v=>({...v}))})
  const u=(k,v)=>setF(p=>({...p,[k]:v}))
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:20}}>
      <div style={S.card({width:"100%",maxWidth:480})}>
        <div style={{fontSize:14,fontWeight:500,marginBottom:14}}>버전 추가</div>
        <div style={S.grid(2,9)}>
          <F label="버전명" val={f.ver} onChange={v=>u("ver",v)}/><F label="작성일" val={f.date} onChange={v=>u("date",v)} type="date"/>
          <F label="변경사유" val={f.reason} onChange={v=>u("reason",v)}/><div style={{fontSize:11,color:C.gray,padding:"8px 0",lineHeight:1.7}}>간접비·이윤은 0이면 자동계산</div>
          <F label="직접인건비(원)" val={f.laborCost} onChange={v=>u("laborCost",parseInt(v)||0)} type="number"/>
          <F label="직접경비(원)" val={f.directExp} onChange={v=>u("directExp",parseInt(v)||0)} type="number"/>
          <F label="외주용역비(원)" val={f.subContract} onChange={v=>u("subContract",parseInt(v)||0)} type="number"/>
        </div>
        <div style={{background:C.navyL,borderRadius:7,padding:"7px 11px",fontSize:11,color:C.navyM,marginBottom:12}}>직접비 합계: {fE((f.laborCost||0)+(f.directExp||0)+(f.subContract||0))}</div>
        <div style={{display:"flex",gap:7}}><button onClick={()=>onSave(f)} style={S.btn(C.navyM)}>저장</button><button onClick={onClose} style={S.btn(C.grayL,C.gray)}>취소</button></div>
      </div>
    </div>
  )
}

// ── 공통 컴포넌트 ────────────────────────────────────────────
function Card({title,note,children,style={}}) {
  return <div style={{...S.card(),...style}}>
    {title&&<div style={{fontSize:14,fontWeight:500,marginBottom:11,display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:6,flexWrap:"wrap"}}>
      <span>{title}</span>{note&&<span style={{fontSize:11,color:"var(--color-text-tertiary,#aaa)",fontWeight:400}}>{note}</span>}
    </div>}
    {children}
  </div>
}
function F({label,val,onChange,type="text",ph="",opts=[]}) {
  return <div>
    <label style={S.lbl()}>{label}</label>
    {type==="select"
      ?<select value={val} onChange={e=>onChange(e.target.value)} style={S.inp()}><option value="">선택</option>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select>
      :<input type={type} value={val} onChange={e=>onChange(e.target.value)} placeholder={ph} style={S.inp()}/>}
  </div>
}
