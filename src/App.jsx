
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Area, ReferenceLine, RadarChart, Radar,
  PolarGrid, PolarAngleAxis
} from "recharts"

// ── 색상 ─────────────────────────────────────────────────────
const C = {
  navy:"#0C447C", navyM:"#185FA5", navyL:"#E6F1FB",
  green:"#1D9E75", greenL:"#EAF3DE",
  amber:"#BA7517", amberL:"#FAEEDA",
  red:"#A32D2D",   redL:"#FCEBEB",
  gray:"#888780",  grayL:"#F1EFE8",
  teal:"#0F6E56",  tealL:"#E1F5EE",
}

// ── 포맷 ─────────────────────────────────────────────────────
const fE  = n => n != null ? `${(+n).toFixed(2)}억` : "-"
const fW  = n => n != null ? `${Math.round(+n).toLocaleString("ko-KR")}원` : "-"
const fP  = n => n != null ? `${(+n * 100).toFixed(1)}%` : "-"
const fPy = n => n != null ? `${Math.round(+n).toLocaleString()}원/평` : "-"

// ── 데이터 ────────────────────────────────────────────────────
const ALL_USERS = [
  { id:"U001", name:"강순일",  email:"ksi@sangjiseoul.com",  role:"admin",     dept:"경영진",      avatar:"강순", active:true,  read:true,  write:true,  canManageUsers:true  },
  { id:"U002", name:"박희태",  email:"bht@sangjiseoul.com",  role:"executive", dept:"설계1본부",   avatar:"박희", active:true,  read:true,  write:true,  canManageUsers:false },
  { id:"U003", name:"김동헌",  email:"kdh@sangjiseoul.com",  role:"executive", dept:"설계2본부",   avatar:"김동", active:true,  read:true,  write:true,  canManageUsers:false },
  { id:"U004", name:"천용화",  email:"cyw@sangjiseoul.com",  role:"executive", dept:"디자인본부",  avatar:"천용", active:true,  read:true,  write:false, canManageUsers:false },
  { id:"U005", name:"정진성",  email:"jjs@sangjiseoul.com",  role:"executive", dept:"주거디자인",  avatar:"정진", active:true,  read:true,  write:true,  canManageUsers:false },
  { id:"U006", name:"김한준",  email:"khj@sangjiseoul.com",  role:"executive", dept:"해외사업부",  avatar:"김한", active:true,  read:true,  write:false, canManageUsers:false },
  { id:"U007", name:"임슬기",  email:"lsk@sangjiseoul.com",  role:"viewer",    dept:"운영지원",    avatar:"임슬", active:true,  read:true,  write:false, canManageUsers:false },
  { id:"U008", name:"홍길동",  email:"hgd@gmail.com",        role:"viewer",    dept:"설계1본부",   avatar:"홍길", active:false, read:true,  write:false, canManageUsers:false },
]

const M26 = [
  {m:"1월", cash:2.21, note:0,    blue:0,     actual:true,  memo:"의정부동·평택고덕 등",         projects:["의정부동 100-1,2번지","평택고덕 A68BL"]},
  {m:"2월", cash:2.24, note:0,    blue:0,     actual:true,  memo:"에코델타15BL·보훈병원",        projects:["에코델타시티 15BL","중앙보훈병원"]},
  {m:"3월", cash:6.59, note:0,    blue:0,     actual:true,  memo:"서산시청사 2차선금·국립포항",  projects:["서산시 시청사","국립포항 지구해양전문과학관"]},
  {m:"4월", cash:10.11,note:1.73, blue:0,     actual:true,  memo:"우즈벡 입찰지원·서부의료원",  projects:["우즈베키스탄 제약클러스터","서부의료원"]},
  {m:"5월", cash:8.47, note:0,    blue:0,     actual:true,  memo:"에코앤로지스·라오스 감리",     projects:["에코앤로지스부산","라오스 대학병원"]},
  {m:"6월", cash:21.65,note:0,    blue:0,     actual:false, memo:"서부산행정복합 기대",           projects:["서부산행정복합타운","사직야구장임시구장"]},
  {m:"7월", cash:36.32,note:0,    blue:14.32, actual:false, memo:"민간위험 14.32억 포함",        projects:["에코델타시티 3BL","청량리주상복합"]},
  {m:"8월", cash:15.07,note:0,    blue:0,     actual:false, memo:"화성배양 사업승인",            projects:["화성 배양2지구 1BL"]},
  {m:"9월", cash:10.90,note:0,    blue:6.99,  actual:false, memo:"민간위험 6.99억 포함",         projects:["안산장상 A-8BL"]},
  {m:"10월",cash:7.54, note:0,    blue:0,     actual:false, memo:"",                             projects:["남양주왕숙2 A-4BL"]},
  {m:"11월",cash:10.25,note:0,    blue:0,     actual:false, memo:"",                             projects:["광주산정 S-9BL"]},
  {m:"12월",cash:27.27,note:0.86, blue:0,     actual:false, memo:"남양주왕숙2·청량리 이월",      projects:["청량리주상복합","남양주왕숙2 A-4BL"]},
]

const PROJECTS = [
  {id:"P01", type:"계약",  dept:"설계1",    name:"경상남도 서부의료원 설립 기본 및 실시설계",       fee:1.47,  prog:45, acc:2.47,  rev26:4.08,  pub:"공공", pyFloor:null, client:"경상남도",      contract:"2024-11-11", note:"실시설계 진행중"},
  {id:"P02", type:"계약",  dept:"설계2",    name:"화성 배양2지구 1BL 공동주택 신축공사",           fee:0.25,  prog:15, acc:1.07,  rev26:0.25,  pub:"민간", pyFloor:null, client:"민간시행사",    contract:"2024-07-09", note:"건축심의 완료"},
  {id:"P03", type:"계약",  dept:"주거",     name:"부산 에코델타시티 1BL 민참 기본설계",            fee:5.92,  prog:5,  acc:0.59,  rev26:5.92,  pub:"민간", pyFloor:9737, client:"부산도시공사",  contract:"2026-04-29", note:"착수 준비중"},
  {id:"P04", type:"확정",  dept:"디자인",   name:"사직야구장 임시구장 조성사업 (제안공모)",         fee:8.48,  prog:0,  acc:0,     rev26:2.54,  pub:"공공", pyFloor:null, client:"부산시",        contract:"2026-06",    note:"당선 5.29"},
  {id:"P05", type:"확정",  dept:"설계1",    name:"서부산행정복합타운 실시설계기술제안",             fee:19.15, prog:40, acc:1.97,  rev26:14.36, pub:"민간", pyFloor:null, client:"태영건설 컨소시엄",contract:"2026-06",  note:"합사 운영 중"},
  {id:"P06", type:"확정",  dept:"주거",     name:"청량리동 주상복합 건립사업",                     fee:23.78, prog:0,  acc:0,     rev26:4.76,  pub:"민간", pyFloor:null, client:"민간시행사",    contract:"2026-07",    note:"착수 대기"},
  {id:"P07", type:"확정",  dept:"주거",     name:"부산 에코델타시티 3BL 민참",                    fee:17.50, prog:0,  acc:0,     rev26:3.50,  pub:"민간", pyFloor:9737, client:"부산도시공사",  contract:"2026-07",    note:""},
  {id:"P08", type:"추진",  dept:"설계1",    name:"익산 융복합스마트팜 클러스터 조성사업",          fee:60.00, prog:0,  acc:0,     rev26:0,     pub:"민간", pyFloor:null, client:"민간시행사",    contract:"2026 하반기",note:"지방선거 이후"},
  {id:"P09", type:"추진",  dept:"디자인",   name:"부산시중구 신청사 설계공모",                     fee:20.00, prog:0,  acc:0,     rev26:0,     pub:"공공", pyFloor:null, client:"부산시 중구",   contract:"2026-11",    note:"8~9월 공모 예정"},
  {id:"P10", type:"추진",  dept:"설계2",    name:"청주 내수3지구 공동주택 개발사업 (영무건설)",    fee:47.00, prog:0,  acc:0,     rev26:0,     pub:"민간", pyFloor:null, client:"영무건설",      contract:"2026 상반기",note:"3BL 933세대"},
  {id:"P11", type:"기성",  dept:"설계1",    name:"서부산의료원 BTL 설계",                          fee:13.60, prog:45, acc:6.12,  rev26:2.42,  pub:"민간", pyFloor:null, client:"민간투자사업",  contract:"2024-04-19", note:""},
  {id:"P12", type:"기성",  dept:"설계1",    name:"쿠팡 부산FC 신축공사 설계",                     fee:32.96, prog:35, acc:11.54, rev26:2.01,  pub:"민간", pyFloor:null, client:"쿠팡",          contract:"2021-12-07", note:"현장관리"},
  {id:"P13", type:"기성",  dept:"설계2",    name:"안산장상지구 A-8BL 공동주택",                   fee:13.65, prog:50, acc:6.83,  rev26:5.71,  pub:"공공", pyFloor:24706,client:"LH",            contract:"2023-10-27", note:"실시설계 진행"},
  {id:"P14", type:"기성",  dept:"설계2",    name:"남양주왕숙2지구 A-4BL 공동주택",                fee:16.39, prog:49, acc:8.03,  rev26:4.81,  pub:"공공", pyFloor:null, client:"LH",            contract:"2021-11-11", note:"12월 완료 예정"},
  {id:"P15", type:"기성",  dept:"해외",     name:"우즈베키스탄 제약클러스터 건립사업 1차",         fee:32.76, prog:60, acc:19.66, rev26:7.97,  pub:"공공", pyFloor:null, client:"우즈베키스탄 제약청",contract:"2023-12-18",note:"감리 진행중"},
  {id:"P16", type:"기성",  dept:"해외",     name:"라오스 대학병원 건립사업",                       fee:8.60,  prog:60, acc:5.16,  rev26:1.20,  pub:"공공", pyFloor:null, client:"라오스 교육부", contract:"2021-11-11", note:"감리 진행중"},
]

const PNL_MONTHLY = [
  {m:"1월", rev:5.10, sal:3.48, ot:0.12, etc_lbr:0.68, sub_dir:2.40, sub_stl:0, exp:0.36, biz:0.14, fix:0.16, misc:0.30, shared:1.28},
  {m:"2월", rev:5.10, sal:3.48, ot:0.12, etc_lbr:0.68, sub_dir:2.40, sub_stl:0, exp:0.36, biz:0.14, fix:0.16, misc:0.30, shared:1.28},
  {m:"3월", rev:6.59, sal:3.48, ot:0.12, etc_lbr:0.68, sub_dir:5.80, sub_stl:0, exp:0.36, biz:0.14, fix:0.16, misc:0.30, shared:1.28},
  {m:"4월", rev:6.53, sal:3.48, ot:0.12, etc_lbr:0.68, sub_dir:8.10, sub_stl:0, exp:0.36, biz:0.14, fix:0.16, misc:0.30, shared:1.28},
  {m:"5월", rev:6.29, sal:3.48, ot:0.12, etc_lbr:0.68, sub_dir:8.01, sub_stl:0.99, exp:0.36, biz:0.14, fix:0.16, misc:0.30, shared:1.28},
]

const YEARS_DB = [
  {yr:"2023", 목표수주:223.11, 실행수주:154.79, 목표매출:163.08, 실행매출:139.65, 인원:97.92},
  {yr:"2024", 목표수주:201,    실행수주:79.19,  목표매출:165.87, 실행매출:92.01,  인원:86},
  {yr:"2025", 목표수주:170,    실행수주:95,     목표매출:150,    실행매출:120,    인원:70},
  {yr:"2026", 목표수주:170,    실행수주:96.72,  목표매출:145,    실행매출:29.61,  인원:61.75},
]

// ── 알람 데이터 ───────────────────────────────────────────────
const INIT_ALERTS = [
  { id:"A1", level:"critical", icon:"ti-alert-triangle",  title:"손익 위험",         msg:"5월 누계 손익 -27.76억. 지출이 매출의 194%.",           time:"5분 전",   tab:"pnl",      read:false },
  { id:"A2", level:"warning",  icon:"ti-flag",            title:"민간위험 프로젝트", msg:"7월 14.32억, 9월 6.99억 기성 달성 불확실.",             time:"1시간 전", tab:"cashflow", read:false },
  { id:"A3", level:"warning",  icon:"ti-trending-down",   title:"수주달성률 저조",   msg:"설계2본부 수주 달성률 6.3%. 목표 40억 대비 2.51억.",    time:"2시간 전", tab:"projects", read:false },
  { id:"A4", level:"info",     icon:"ti-check",           title:"사직야구장 확정",   msg:"사직야구장 임시구장 조성사업 당선 확정. 8.48억.",        time:"3시간 전", tab:"projects", read:false },
  { id:"A5", level:"info",     icon:"ti-cash",            title:"7월 기성 집중",     msg:"7월 36.32억 기성 예정. 연간 최대 수금 월.",             time:"1일 전",   tab:"cashflow", read:true  },
]

const TYPE_BADGE = {
  계약:{bg:C.navyL,  fg:C.navy},
  확정:{bg:C.greenL, fg:"#27500A"},
  추진:{bg:C.amberL, fg:"#633806"},
  기성:{bg:C.tealL,  fg:C.teal},
}
const ROLE_BADGE = {
  admin:    {bg:"#FCEBEB", fg:C.red,   label:"관리자"},
  executive:{bg:C.navyL,   fg:C.navy,  label:"임원"},
  viewer:   {bg:C.grayL,   fg:C.gray,  label:"열람자"},
}
const LEVEL_STYLE = {
  critical: {bg:C.redL,   fg:C.red,   border:C.red},
  warning:  {bg:C.amberL, fg:"#633806",border:C.amber},
  info:     {bg:C.navyL,  fg:C.navyM, border:C.navyM},
}

// ── 스타일 헬퍼 ───────────────────────────────────────────────
const S = {
  card: (extra={}) => ({
    background:"var(--color-background-primary,#fff)",
    border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",
    borderRadius:12, padding:"18px 20px", marginBottom:16, ...extra
  }),
  kpi: (accent=C.navyM) => ({
    background:"var(--color-background-primary,#fff)",
    border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",
    borderRadius:12, padding:"18px 20px", position:"relative", overflow:"hidden",
    borderLeft:`4px solid ${accent}`,
    cursor:"pointer",
    transition:"box-shadow .15s",
  }),
  grid: (cols, gap=14) => ({
    display:"grid",
    gridTemplateColumns:`repeat(${cols},1fr)`,
    gap, marginBottom:16
  }),
  th: (align="left") => ({
    padding:"11px 13px", textAlign:align, fontSize:13, fontWeight:500,
    color:"var(--color-text-secondary,#888)",
    borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",
    background:"var(--color-background-secondary,#f8f8f6)",
    whiteSpace:"nowrap",
  }),
  td: (align="right") => ({
    padding:"12px 13px", borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",
    textAlign:align, fontSize:14, verticalAlign:"middle",
  }),
  badge: (bg, fg) => ({
    display:"inline-flex", alignItems:"center", padding:"3px 10px",
    borderRadius:10, fontSize:11, fontWeight:500, background:bg, color:fg,
  }),
  btn: (bg=C.navyM, fg="#fff") => ({
    padding:"8px 16px", background:bg, color:fg, border:"none",
    borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer",
    display:"inline-flex", alignItems:"center", gap:5,
  }),
  inp: () => ({
    padding:"8px 10px", border:"1px solid var(--color-border-secondary,#ddd)",
    borderRadius:8, fontSize:13, width:"100%",
    background:"var(--color-background-primary,#fff)",
    color:"var(--color-text-primary,#333)", fontFamily:"inherit",
  }),
  lbl: () => ({ display:"block", fontSize:12, color:C.gray, fontWeight:500, marginBottom:4 }),
}

// ════════════════════════════════════════════════════════════
// 메인 앱
// ════════════════════════════════════════════════════════════
export default function App() {
  // ── 인증 상태 ──
  const [authState, setAuthState] = useState("login") // login | app
  const [currentUser, setCurrentUser] = useState(null)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginError, setLoginError] = useState("")

  // ── 앱 상태 ──
  const [tab, setTab]         = useState("overview")
  const [alerts, setAlerts]   = useState(INIT_ALERTS)
  const [showAlerts, setShowAlerts] = useState(false)
  const [drillTarget, setDrillTarget] = useState(null) // {type, data}
  const [users, setUsers]     = useState(ALL_USERS)
  const [showAuth, setShowAuth] = useState(false)
  const [years, setYears]     = useState(YEARS_DB)
  const [pnlData, setPnlData] = useState(PNL_MONTHLY)
  const [showAddYear, setShowAddYear] = useState(false)
  const [globalSearch, setGlobalSearch] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [showSearchDrop, setShowSearchDrop] = useState(false)
  const alertRef = useRef(null)
  const unread = alerts.filter(a => !a.read).length

  // 로그인
  const doLogin = () => {
    const u = users.find(u => u.email.toLowerCase() === loginEmail.toLowerCase().trim() && u.active)
    if (u) { setCurrentUser(u); setAuthState("app"); setLoginError("") }
    else setLoginError("등록된 이메일이 아니거나 비활성 계정입니다.")
  }
  const doLogout = () => { setCurrentUser(null); setAuthState("login"); setLoginEmail("") }

  // 알람 읽음 처리
  const readAlert = (id) => setAlerts(prev => prev.map(a => a.id === id ? {...a, read:true} : a))
  const readAll   = () => setAlerts(prev => prev.map(a => ({...a, read:true})))

  // 검색
  useEffect(() => {
    if (!globalSearch.trim()) { setSearchResults([]); return }
    const kw = globalSearch.toLowerCase()
    const res = []
    PROJECTS.filter(p => p.name.toLowerCase().includes(kw) || p.dept.toLowerCase().includes(kw) || p.client.toLowerCase().includes(kw))
      .slice(0,4).forEach(p => res.push({type:"프로젝트", icon:"ti-building", title:p.name, sub:`${p.dept} · ${p.type} · ${fE(p.fee)}`,
        action:()=>{ setDrillTarget({type:"project",data:p}); setTab("projects"); setShowSearchDrop(false); setGlobalSearch("") }}))
    M26.filter(m => m.memo.toLowerCase().includes(kw) || m.projects.some(n=>n.toLowerCase().includes(kw)))
      .slice(0,2).forEach(m => res.push({type:"기성수금", icon:"ti-cash", title:`${m.m} 기성수금`, sub:`${fE(m.cash+m.note)} (현금+어음)`,
        action:()=>{ setDrillTarget({type:"cashflow",data:m}); setTab("cashflow"); setShowSearchDrop(false); setGlobalSearch("") }}))
    const numQ = parseFloat(globalSearch.replace(/[^0-9.]/g,""))
    if (!isNaN(numQ) && numQ > 0)
      PROJECTS.filter(p=>Math.abs(p.fee-numQ)<0.5).slice(0,2).forEach(p => res.push({type:"금액", icon:"ti-coin", title:p.name, sub:`용역비 ${fE(p.fee)}`,
        action:()=>{ setDrillTarget({type:"project",data:p}); setTab("projects"); setShowSearchDrop(false); setGlobalSearch("") }}))
    setSearchResults(res)
  }, [globalSearch])

  // canWrite 체크
  const canWrite = currentUser?.write === true

  if (authState === "login") return <LoginScreen loginEmail={loginEmail} setLoginEmail={setLoginEmail} loginError={loginError} doLogin={doLogin} users={users} />

  const TABS = [
    {id:"overview",  label:"📊 경영개요"},
    {id:"cashflow",  label:"💧 기성수금"},
    {id:"projects",  label:"🏗 프로젝트"},
    {id:"pnl",       label:"📉 손익"},
    {id:"compare",   label:"📆 연도비교"},
    {id:"auth_mgmt", label:"🔐 권한관리"},
  ]

  return (
    <div style={{fontFamily:"var(--font-sans,'Apple SD Gothic Neo',sans-serif)", fontSize:13, color:"var(--color-text-primary,#222)", background:"var(--color-background-tertiary,#f5f5f3)", minHeight:"100vh"}}>

      {/* ── 헤더 ── */}
      <div style={{background:C.navy, padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <div style={{width:34, height:34, background:C.navyM, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16}}>📐</div>
          <div>
            <div style={{fontSize:15, fontWeight:500, color:"#fff"}}>상지서울건축사사무소 — 경영 대시보드</div>
            <div style={{fontSize:11, color:"#85B7EB"}}>기준 2026-06-09 · 5월 누계 · 억원(수주: VAT별도 / 매출·지출: VAT포함)</div>
          </div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          {/* 검색 */}
          <div style={{position:"relative"}}>
            <div style={{display:"flex", alignItems:"center", background:"rgba(255,255,255,.12)", borderRadius:8, padding:"6px 11px", gap:6, border:"1px solid rgba(255,255,255,.2)"}}>
              <i className="ti ti-search" style={{color:"#85B7EB", fontSize:13}} aria-hidden="true"/>
              <input value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} onFocus={()=>setShowSearchDrop(true)}
                placeholder="프로젝트·협력업체·금액 검색…" style={{background:"none",border:"none",color:"#fff",fontSize:12,width:170,outline:"none"}} aria-label="전체 검색"/>
              {globalSearch && <button onClick={()=>{setGlobalSearch("");setSearchResults([])}} style={{background:"none",border:"none",color:"#85B7EB",cursor:"pointer"}}>✕</button>}
            </div>
            {showSearchDrop && searchResults.length > 0 && (
              <div style={{position:"absolute", top:"100%", right:0, marginTop:4, background:"var(--color-background-primary,#fff)", border:"1px solid var(--color-border-secondary,#ddd)", borderRadius:10, boxShadow:"0 4px 24px rgba(0,0,0,.15)", zIndex:600, minWidth:310, maxHeight:340, overflowY:"auto"}}>
                {searchResults.map((r,i) => (
                  <div key={i} onClick={r.action} style={{padding:"10px 14px", cursor:"pointer", borderBottom:"0.5px solid var(--color-border-tertiary,#eee)", display:"flex", gap:10, alignItems:"flex-start"}}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary,#f5f5f3)"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <i className={`ti ${r.icon}`} style={{fontSize:16, color:C.navyM, flexShrink:0, marginTop:1}} aria-hidden="true"/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13, fontWeight:500}}>{r.title}</div>
                      <div style={{fontSize:11, color:"var(--color-text-secondary,#888)", marginTop:2}}>{r.sub}</div>
                    </div>
                    <span style={S.badge(C.navyL, C.navy)}>{r.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 알람 버튼 */}
          <div style={{position:"relative"}} ref={alertRef}>
            <button onClick={()=>setShowAlerts(o=>!o)} style={{...S.btn("rgba(255,255,255,.12)","#fff"), border:"1px solid rgba(255,255,255,.2)", position:"relative"}}>
              <i className="ti ti-bell" aria-label="알람" style={{fontSize:16}}/>
              {unread > 0 && <span style={{position:"absolute", top:-4, right:-4, width:18, height:18, background:C.red, borderRadius:"50%", fontSize:10, fontWeight:600, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center"}}>{unread}</span>}
            </button>
            {showAlerts && <AlertPanel alerts={alerts} readAlert={readAlert} readAll={readAll} setTab={setTab} setShowAlerts={setShowAlerts} />}
          </div>

          {/* 사용자 */}
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={{width:30, height:30, borderRadius:"50%", background:"#378ADD", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:500, color:"#fff"}}>{currentUser.avatar}</div>
            <div>
              <div style={{fontSize:12, color:"#fff", fontWeight:500}}>{currentUser.name}</div>
              <div style={{fontSize:10, color:"#85B7EB"}}>{ROLE_BADGE[currentUser.role]?.label}</div>
            </div>
            <button onClick={doLogout} style={{...S.btn("rgba(255,255,255,.1)","#85B7EB"), padding:"5px 10px", fontSize:11, border:"1px solid rgba(255,255,255,.15)"}}>로그아웃</button>
          </div>
        </div>
      </div>

      {/* ── 탭 바 ── */}
      <div style={{background:"var(--color-background-primary,#fff)", borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)", display:"flex", overflowX:"auto", padding:"0 16px"}}>
        {TABS.filter(t => t.id !== "auth_mgmt" || currentUser.role === "admin").map(t => (
          <button key={t.id} onClick={()=>{setTab(t.id); setDrillTarget(null)}} style={{
            padding:"10px 16px", border:"none", background:"none", fontSize:13, fontWeight:tab===t.id?500:400,
            cursor:"pointer", whiteSpace:"nowrap",
            color:tab===t.id?C.navyM:"var(--color-text-secondary,#888)",
            borderBottom:tab===t.id?`2px solid ${C.navyM}`:"2px solid transparent",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── 드릴다운이 열려있으면 그것 표시 ── */}
      {drillTarget ? (
        <div style={{padding:"16px 20px", maxWidth:1400, margin:"0 auto"}}>
          <button onClick={()=>setDrillTarget(null)} style={{...S.btn(C.grayL, C.navy), marginBottom:14}}>
            <i className="ti ti-arrow-left" aria-hidden="true"/> 목록으로
          </button>
          <DrillDown target={drillTarget} years={years} pnlData={pnlData} currentUser={currentUser} />
        </div>
      ) : (
        <div style={{padding:"16px 20px", maxWidth:1400, margin:"0 auto"}}>
          {tab==="overview"  && <OverviewTab   setDrillTarget={setDrillTarget} setTab={setTab} />}
          {tab==="cashflow"  && <CashflowTab   setDrillTarget={setDrillTarget} />}
          {tab==="projects"  && <ProjectsTab   setDrillTarget={setDrillTarget} canWrite={canWrite} />}
          {tab==="pnl"       && <PnlTab        pnlData={pnlData} setPnlData={setPnlData} canWrite={canWrite} setDrillTarget={setDrillTarget} />}
          {tab==="compare"   && <CompareTab    years={years} setYears={setYears} showAddYear={showAddYear} setShowAddYear={setShowAddYear} canWrite={canWrite} />}
          {tab==="auth_mgmt" && currentUser.role==="admin" && <AuthTab users={users} setUsers={setUsers} />}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 로그인 화면
// ════════════════════════════════════════════════════════════
function LoginScreen({loginEmail, setLoginEmail, loginError, doLogin, users}) {
  return (
    <div style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--color-background-tertiary,#f5f5f3)"}}>
      <div style={S.card({width:420, padding:"36px 40px"})}>
        <div style={{textAlign:"center", marginBottom:32}}>
          <div style={{width:56, height:56, background:C.navy, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, margin:"0 auto 16px"}}>📐</div>
          <div style={{fontSize:20, fontWeight:500}}>상지서울건축사사무소</div>
          <div style={{fontSize:13, color:C.gray, marginTop:4}}>경영 대시보드 로그인</div>
        </div>
        <div style={{background:C.navyL, borderRadius:10, padding:"12px 16px", fontSize:12, color:C.navyM, marginBottom:20, display:"flex", gap:8}}>
          <i className="ti ti-brand-google" style={{fontSize:16, flexShrink:0}} aria-hidden="true"/>
          <span>구글 계정 이메일을 입력하세요. 관리자가 등록한 계정만 접속 가능합니다.</span>
        </div>
        <label style={S.lbl()}>이메일 주소 (구글 계정)</label>
        <input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&doLogin()}
          placeholder="example@gmail.com" style={{...S.inp(), marginBottom:8}}/>
        {loginError && <div style={{fontSize:12, color:C.red, marginBottom:8}}>{loginError}</div>}
        <button onClick={doLogin} style={{...S.btn(C.navyM), width:"100%", justifyContent:"center", padding:"11px 16px", marginBottom:20}}>
          <i className="ti ti-login" aria-hidden="true"/> 로그인
        </button>
        <div style={{borderTop:"0.5px solid var(--color-border-tertiary,#eee)", paddingTop:16}}>
          <div style={{fontSize:12, color:C.gray, marginBottom:10}}>테스트 계정 (클릭해서 입력)</div>
          <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
            {users.filter(u=>u.active).map(u=>(
              <button key={u.id} onClick={()=>setLoginEmail(u.email)} style={{padding:"4px 10px", borderRadius:8, border:`1px solid var(--color-border-secondary,#ddd)`, background:"var(--color-background-secondary,#f5f5f3)", fontSize:11, cursor:"pointer", color:"var(--color-text-secondary,#666)"}}>
                <span style={S.badge(ROLE_BADGE[u.role].bg, ROLE_BADGE[u.role].fg)}>{ROLE_BADGE[u.role].label}</span> {u.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 알람 패널
// ════════════════════════════════════════════════════════════
function AlertPanel({alerts, readAlert, readAll, setTab, setShowAlerts}) {
  return (
    <div style={{position:"absolute", top:"100%", right:0, marginTop:6, width:340, background:"var(--color-background-primary,#fff)", border:"1px solid var(--color-border-secondary,#ddd)", borderRadius:12, boxShadow:"0 6px 28px rgba(0,0,0,.16)", zIndex:700, overflow:"hidden"}}>
      <div style={{padding:"12px 16px", borderBottom:"0.5px solid var(--color-border-tertiary,#eee)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <span style={{fontSize:14, fontWeight:500}}>알람 & 모니터링</span>
        <button onClick={readAll} style={{fontSize:11, color:C.navyM, background:"none", border:"none", cursor:"pointer"}}>전체 읽음</button>
      </div>
      {alerts.map(a => {
        const st = LEVEL_STYLE[a.level]
        return (
          <div key={a.id} onClick={()=>{readAlert(a.id); setTab(a.tab); setShowAlerts(false)}}
            style={{padding:"12px 16px", borderBottom:"0.5px solid var(--color-border-tertiary,#eee)", cursor:"pointer", background:a.read?"":"var(--color-background-secondary,#f8f8f6)", borderLeft:`3px solid ${a.read?"transparent":st.border}`}}
            onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary,#f5f5f3)"}
            onMouseLeave={e=>e.currentTarget.style.background=a.read?"":"var(--color-background-secondary,#f8f8f6)"}>
            <div style={{display:"flex", gap:8, alignItems:"flex-start"}}>
              <i className={`ti ${a.icon}`} style={{fontSize:16, color:st.fg, flexShrink:0, marginTop:1}} aria-hidden="true"/>
              <div style={{flex:1}}>
                <div style={{fontSize:13, fontWeight:a.read?400:500, display:"flex", justifyContent:"space-between"}}>
                  {a.title}
                  <span style={{fontSize:10, color:C.gray, fontWeight:400}}>{a.time}</span>
                </div>
                <div style={{fontSize:11, color:"var(--color-text-secondary,#888)", marginTop:3, lineHeight:1.5}}>{a.msg}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// AI 인사이트 패널 (트렌드: 단기·중기·장기 시나리오)
// ════════════════════════════════════════════════════════════
function AIInsightPanel({context, title}) {
  const [insight, setInsight] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [expanded, setExpanded] = useState(false)

  const fetchInsight = async () => {
    if (insight) { setExpanded(e=>!e); return }
    setLoading(true); setExpanded(true); setError(null)
    const systemPrompt = `당신은 건축설계사무소 전문 경영전략 분석가입니다. 제공된 경영 데이터를 분석하여 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.
{"summary":"2~3문장 현황 핵심 요약","confidence":85,"scenarios":{"단기(1~3개월)":{"signal":"🟡","action":"구체적 액션 1가지","target":"수치 목표"},"중기(3~12개월)":{"signal":"🟢","action":"구체적 액션 1가지","target":"수치 목표"},"장기(1~3년)":{"signal":"🔵","action":"방향성 1가지","target":"전략 목표"}},"risk":"주요 위험 1가지","opportunity":"핵심 기회 1가지","confidence_note":"신뢰도 설명"}`
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:800,
          system: systemPrompt,
          messages:[{role:"user", content:`${title} 분석:\n${context}`}]
        })
      })
      const d = await res.json()
      const raw = d.content?.find(c=>c.type==="text")?.text || ""
      const clean = raw.replace(/```json|```/g,"").trim()
      setInsight(JSON.parse(clean))
    } catch(e) {
      setError("잠시 후 다시 시도해 주세요.")
    }
    setLoading(false)
  }

  return (
    <div style={{marginTop:20, border:`1px solid ${C.navyM}`, borderRadius:12, overflow:"hidden"}}>
      <button onClick={fetchInsight} style={{width:"100%", padding:"13px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", background:expanded?C.navyL:"var(--color-background-secondary,#f8f8f6)", border:"none", cursor:"pointer", gap:8}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <i className="ti ti-brain" style={{fontSize:16, color:C.navyM}} aria-hidden="true"/>
          <span style={{fontSize:14, fontWeight:500, color:C.navyM}}>AI 시나리오 분석</span>
          <span style={S.badge(C.navyL, C.navyM)}>단기·중기·장기</span>
        </div>
        <i className={`ti ${expanded?"ti-chevron-up":"ti-chevron-down"}`} style={{color:C.navyM}} aria-hidden="true"/>
      </button>

      {expanded && (
        <div style={{padding:"16px 18px", background:"var(--color-background-primary,#fff)"}}>
          {loading && (
            <div style={{display:"flex", alignItems:"center", gap:10, padding:"16px 0", color:C.navyM}}>
              <div style={{width:16, height:16, border:`2px solid ${C.navyM}`, borderTop:"2px solid transparent", borderRadius:"50%", animation:"spin 1s linear infinite"}}/>
              <span style={{fontSize:13}}>AI가 경영 데이터를 분석 중입니다…</span>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {error && <div style={{fontSize:13, color:C.red, padding:"8px 0"}}>{error}</div>}
          {insight && (
            <div>
              <div style={{background:C.navyL, borderRadius:8, padding:"11px 14px", marginBottom:14}}>
                <div style={{fontSize:12, color:C.navyM, fontWeight:500, marginBottom:4}}>현황 요약</div>
                <div style={{fontSize:13, lineHeight:1.7, color:"var(--color-text-primary,#333)"}}>{insight.summary}</div>
                <div style={{fontSize:11, color:C.gray, marginTop:6}}>신뢰도 {insight.confidence}% — {insight.confidence_note}</div>
              </div>

              <div style={S.grid(3, 10)}>
                {Object.entries(insight.scenarios||{}).map(([period, sc]) => (
                  <div key={period} style={{background:"var(--color-background-secondary,#f8f8f6)", borderRadius:8, padding:"12px 14px"}}>
                    <div style={{fontSize:12, fontWeight:500, marginBottom:6, display:"flex", alignItems:"center", gap:5}}>
                      <span>{sc.signal}</span> <span style={{color:C.navyM}}>{period}</span>
                    </div>
                    <div style={{fontSize:12, color:"var(--color-text-primary,#333)", lineHeight:1.6, marginBottom:6}}>{sc.action}</div>
                    <div style={S.badge(C.greenL, "#27500A")}>{sc.target}</div>
                  </div>
                ))}
              </div>

              <div style={{display:"flex", gap:10, marginTop:12}}>
                <div style={{flex:1, background:C.redL, borderRadius:8, padding:"11px 14px"}}>
                  <div style={{fontSize:12, fontWeight:500, color:C.red, marginBottom:4}}>⚠ 위험 요인</div>
                  <div style={{fontSize:12, lineHeight:1.6, color:"var(--color-text-primary,#333)"}}>{insight.risk}</div>
                </div>
                <div style={{flex:1, background:C.greenL, borderRadius:8, padding:"11px 14px"}}>
                  <div style={{fontSize:12, fontWeight:500, color:C.green, marginBottom:4}}>✦ 핵심 기회</div>
                  <div style={{fontSize:12, lineHeight:1.6, color:"var(--color-text-primary,#333)"}}>{insight.opportunity}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 드릴다운 화면
// ════════════════════════════════════════════════════════════
function DrillDown({target, years, pnlData, currentUser}) {
  const {type, data} = target

  if (type === "project") {
    const p = data
    const tb = TYPE_BADGE[p.type] || {bg:C.grayL, fg:C.gray}
    const accRatio = p.fee > 0 ? ((p.acc/p.fee)*100).toFixed(0) : 0
    const barColor = p.prog>=70?C.green:p.prog>=30?C.navyM:C.gray
    const stageData = [
      {name:"기본설계", val:20}, {name:"실시설계", val:40},
      {name:"인허가", val:20}, {name:"감리", val:15}, {name:"준공후", val:5}
    ].map(s=>({...s, filled: Math.min(p.prog/100*100, s.val)}))
    const ctx = `프로젝트: ${p.name} / 부서: ${p.dept} / 발주처: ${p.client} / 용역비: ${fE(p.fee)} / 진행률: ${p.prog}% / 기성율: ${accRatio}% / 2026예상기성: ${fE(p.rev26)} / 발주유형: ${p.pub} / 계약일: ${p.contract} / 비고: ${p.note}`
    return (
      <div>
        <div style={S.card()}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10, marginBottom:16}}>
            <div>
              <span style={S.badge(tb.bg, tb.fg)}>{p.type}</span>
              <h3 style={{fontSize:20, fontWeight:500, marginTop:8}}>{p.name}</h3>
              <div style={{fontSize:14, color:C.gray, marginTop:4}}>{p.dept} · {p.client}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:32, fontWeight:500, color:C.navyM}}>{fE(p.fee)}</div>
              <div style={{fontSize:13, color:C.gray}}>용역비 (VAT별도)</div>
            </div>
          </div>
          <div style={S.grid(4, 12)}>
            {[["진행률", `${p.prog}%`, barColor], ["기성율", `${accRatio}%`, C.navyM], ["누계기성", fE(p.acc), C.amber], ["2026 예상기성", fE(p.rev26), C.green]].map(([l,v,c])=>(
              <div key={l} style={{background:"var(--color-background-secondary,#f8f8f6)", borderRadius:8, padding:"14px 16px"}}>
                <div style={{fontSize:12, color:C.gray, marginBottom:6}}>{l}</div>
                <div style={{fontSize:22, fontWeight:500, color:c}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:14}}>
            <div style={{fontSize:12, color:C.gray, marginBottom:6}}>진행률</div>
            <div style={{display:"flex", alignItems:"center", gap:10}}>
              <div style={{flex:1, height:12, background:"var(--color-background-secondary,#f0f0ee)", borderRadius:6, overflow:"hidden"}}>
                <div style={{width:`${p.prog}%`, height:12, background:barColor, borderRadius:6, transition:"width .6s"}}/>
              </div>
              <span style={{fontSize:16, fontWeight:500, color:barColor}}>{p.prog}%</span>
            </div>
          </div>
          <div style={{marginTop:16, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
            {[["발주 유형", p.pub], ["계약일 / 예정", p.contract], ["평당단가", p.pyFloor ? fPy(p.fee*1e8/p.pyFloor) : "N/A"], ["비고", p.note||"—"]].map(([k,v])=>(
              <div key={k} style={{display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#eee)", fontSize:13}}>
                <span style={{color:C.gray}}>{k}</span>
                <span style={{fontWeight:400}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <AIInsightPanel title={`${p.name} 프로젝트`} context={ctx} />
      </div>
    )
  }

  if (type === "cashflow") {
    const m = data
    const tot = m.cash + m.note
    const ctx = `월: ${m.m} / 현금: ${fE(m.cash)} / 어음: ${fE(m.note)} / 합계: ${fE(tot)} / 민간위험: ${fE(m.blue)} / 실적여부: ${m.actual?"실적":"예상"} / 주요내역: ${m.memo} / 관련프로젝트: ${(m.projects||[]).join(", ")}`
    return (
      <div>
        <div style={S.card()}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10, marginBottom:16}}>
            <div>
              <span style={S.badge(m.actual?C.navyL:C.grayL, m.actual?C.navy:C.gray)}>{m.actual?"실적":"예상"}</span>
              <h3 style={{fontSize:20, fontWeight:500, marginTop:8}}>{m.m} 기성수금 상세</h3>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:32, fontWeight:500, color:C.navyM}}>{fE(tot)}</div>
              <div style={{fontSize:13, color:C.gray}}>현금+어음 합계</div>
            </div>
          </div>
          <div style={S.grid(4, 12)}>
            {[["현금", fE(m.cash), C.navyM], ["어음", m.note>0?fE(m.note):"없음", m.note>0?C.amber:C.gray], ["민간위험", m.blue>0?fE(m.blue):"없음", m.blue>0?C.red:C.gray], ["합계", fE(tot), C.green]].map(([l,v,c])=>(
              <div key={l} style={{background:"var(--color-background-secondary,#f8f8f6)", borderRadius:8, padding:"14px 16px"}}>
                <div style={{fontSize:12, color:C.gray, marginBottom:6}}>{l}</div>
                <div style={{fontSize:22, fontWeight:500, color:c}}>{v}</div>
              </div>
            ))}
          </div>
          {m.blue > 0 && (
            <div style={{background:C.amberL, borderLeft:`3px solid ${C.amber}`, borderRadius:"0 8px 8px 0", padding:"11px 14px", marginTop:14, fontSize:13, color:"#633806"}}>
              <strong>민간위험 {fE(m.blue)}</strong> — 시행사 상황에 따라 기성 달성 불확실. 별도 모니터링 필요.
            </div>
          )}
          <div style={{marginTop:16}}>
            <div style={{fontSize:12, color:C.gray, marginBottom:8}}>관련 프로젝트</div>
            <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
              {(m.projects||[]).map(n=><span key={n} style={S.badge(C.navyL, C.navy)}>{n}</span>)}
            </div>
          </div>
          <div style={{marginTop:12, fontSize:13, color:"var(--color-text-secondary,#888)"}}>{m.memo}</div>
        </div>
        <AIInsightPanel title={`${m.m} 기성수금`} context={ctx} />
      </div>
    )
  }

  if (type === "pnl_month") {
    const r = data
    const total = r.sal+r.ot+r.etc_lbr+r.sub_dir+r.sub_stl+r.exp+r.biz+r.fix+r.misc+r.shared
    const pnl = r.rev - total
    const ctx = `월: ${r.m} / 매출: ${fE(r.rev)} / 지출합계: ${fE(total)} / 손익: ${fE(pnl)} / 인건비: ${fE(r.sal+r.ot+r.etc_lbr)} / 외주비: ${fE(r.sub_dir+r.sub_stl)} / 경비: ${fE(r.exp+r.biz+r.fix+r.misc)} / 공동비: ${fE(r.shared)}`
    const pieData = [
      {name:"인건비", value:+(r.sal+r.ot+r.etc_lbr).toFixed(2)},
      {name:"외주비", value:+(r.sub_dir+r.sub_stl).toFixed(2)},
      {name:"경비", value:+(r.exp+r.biz+r.fix+r.misc).toFixed(2)},
      {name:"공동비", value:+r.shared.toFixed(2)},
    ]
    return (
      <div>
        <div style={S.card()}>
          <h3 style={{fontSize:20, fontWeight:500, marginBottom:16}}>{r.m} 손익 상세</h3>
          <div style={S.grid(4, 12)}>
            {[["매출", fE(r.rev), C.green], ["지출 합계", fE(total), C.red], ["손익", fE(pnl), pnl>=0?C.green:C.red], ["인건비 비율", fP((r.sal+r.ot+r.etc_lbr)/r.rev), C.navyM]].map(([l,v,c])=>(
              <div key={l} style={{background:"var(--color-background-secondary,#f8f8f6)", borderRadius:8, padding:"14px 16px"}}>
                <div style={{fontSize:12, color:C.gray, marginBottom:6}}>{l}</div>
                <div style={{fontSize:22, fontWeight:500, color:c}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:16, height:240}}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name"
                  label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {["#185FA5","#BA7517","#1D9E75","#888780"].map((c,i)=><Cell key={i} fill={c}/>)}
                </Pie>
                <Tooltip formatter={v=>[`${v}억`]}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <AIInsightPanel title={`${r.m} 손익`} context={ctx} />
      </div>
    )
  }

  if (type === "overview_kpi") {
    const ctx = `2026년 5월 누계 경영 현황: 수주목표 170억 / 계약+확정 96.72억(56.9%) / 추진포함 384.5억(226%) / 매출목표 145억 / 누계매출 29.61억(20.4%) / 누계지출 57.37억 / 손익 -27.76억 / 예상기성 161.23억 / 민간위험 48.64억 / 인원 61.75명 / 인당수주 1.57억 / 인당매출 0.48억`
    return (
      <div>
        <div style={S.card()}>
          <h3 style={{fontSize:20, fontWeight:500, marginBottom:16}}>2026년 경영 전체 현황</h3>
          <div style={S.grid(4, 12)}>
            {[["수주 달성률","56.9%",C.navyM],["매출 달성률","20.4%",C.amber],["손익","-27.76억",C.red],["예상기성","161.23억",C.green]].map(([l,v,c])=>(
              <div key={l} style={{background:"var(--color-background-secondary,#f8f8f6)", borderRadius:8, padding:"18px 20px"}}>
                <div style={{fontSize:13, color:C.gray, marginBottom:8}}>{l}</div>
                <div style={{fontSize:30, fontWeight:500, color:c}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <AIInsightPanel title="전사 경영 현황 종합" context={ctx} />
      </div>
    )
  }

  return <div style={{padding:40, textAlign:"center", color:C.gray}}>드릴다운 데이터 없음</div>
}

// ════════════════════════════════════════════════════════════
// 경영개요 탭
// ════════════════════════════════════════════════════════════
function OverviewTab({setDrillTarget, setTab}) {
  const kpis = [
    {label:"계약 + 확정", val:"96.72억", sub:"달성률 56.9%", color:C.navyM, accent:C.navyM, prog:57, drill:{type:"overview_kpi",data:{}}},
    {label:"추진 포함",   val:"384.5억", sub:"목표의 226%",  color:"#3B6D11",accent:C.green, prog:100, drill:{type:"overview_kpi",data:{}}},
    {label:"누계 매출",   val:"29.61억", sub:"목표 145억 · 20.4%", color:C.amber, accent:C.amber, prog:20, drill:{type:"overview_kpi",data:{}}},
    {label:"누계 지출",   val:"57.37억", sub:"5월 누계",     color:C.red,   accent:C.red,   prog:100, drill:{type:"overview_kpi",data:{}}},
    {label:"손익",        val:"-27.76억",sub:"매출-지출",    color:C.red,   accent:"#791F1F",prog:0,  drill:{type:"overview_kpi",data:{}}},
    {label:"예상기성(연간)",val:"161.2억",sub:"현금+어음",   color:C.navyM, accent:C.navyM,  prog:100, drill:{type:"cashflow",data:M26[6]}},
  ]

  const barData = M26.map(d=>({name:d.m,현금:+d.cash.toFixed(2),어음:+d.note.toFixed(2)}))
  const progData = [
    {n:"설계1(해외)",t:20,a:20.62},{n:"설계2",t:40,a:2.51},
    {n:"디자인",t:60,a:28.04},{n:"주거디자인",t:50,a:45.56}
  ]

  return (
    <div>
      <div style={S.grid(6)}>
        {kpis.map(k => (
          <div key={k.label} style={S.kpi(k.accent)} onClick={()=>setDrillTarget(k.drill)}
            onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 16px rgba(24,95,165,.15)"}
            onMouseLeave={e=>e.currentTarget.style.boxShadow=""}>
            <div style={{fontSize:12, color:"var(--color-text-secondary,#888)", marginBottom:8}}>{k.label}</div>
            <div style={{fontSize:28, fontWeight:500, color:k.color, letterSpacing:-1}}>{k.val}</div>
            <div style={{fontSize:11, color:"var(--color-text-secondary,#888)", marginTop:6}}>{k.sub}</div>
            {k.prog > 0 && <div style={{marginTop:10, height:4, background:"var(--color-border-tertiary,#e8e8e4)", borderRadius:2, overflow:"hidden"}}><div style={{width:`${k.prog}%`,height:4,background:k.accent,borderRadius:2}}/></div>}
            <div style={{position:"absolute", top:10, right:12, fontSize:10, color:C.navyM}}><i className="ti ti-chevron-right" aria-hidden="true"/></div>
          </div>
        ))}
      </div>

      <div style={{background:C.amberL, borderLeft:`4px solid ${C.amber}`, borderRadius:"0 10px 10px 0", padding:"13px 18px", fontSize:13, color:"#633806", marginBottom:16, display:"flex", gap:10}}>
        <i className="ti ti-alert-triangle" style={{fontSize:18, flexShrink:0, marginTop:1}} aria-hidden="true"/>
        <span><strong>비상경영 체제.</strong> 5월 누계 지출(57.37억)이 매출(29.61억)의 194%. 7월 기성집중(36.32억)으로 하반기 회복 가능. 민간위험 48.64억 별도 모니터링 필요.</span>
      </div>

      <div style={S.grid(2, 14)}>
        <Card title="본부별 계약 달성률" note="목표 대비 계약+확정 · 클릭시 상세">
          {progData.map(d=>{
            const p=d.t>0?Math.min(d.a/d.t,1.5):0, c=p>=1?C.green:p>=.5?C.amber:C.navyM
            return <div key={d.n} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",cursor:"pointer"}}
              onClick={()=>setDrillTarget({type:"overview_kpi",data:{}})}
              onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary,#f5f5f3)"}
              onMouseLeave={e=>e.currentTarget.style.background=""}>
              <span style={{fontSize:13,color:"var(--color-text-secondary,#888)",width:100,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.n}</span>
              <div style={{flex:1,height:10,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:5,overflow:"hidden"}}><div style={{width:`${Math.min(p*100,100).toFixed(0)}%`,height:10,background:c,borderRadius:5}}/></div>
              <span style={{fontSize:14,fontWeight:500,color:c,minWidth:44,textAlign:"right"}}>{fE(d.a)}</span>
              <span style={{fontSize:12,color:c,minWidth:38,textAlign:"right"}}>{d.t>0?((d.a/d.t)*100).toFixed(0)+"%" : "-"}</span>
            </div>
          })}
        </Card>
        <Card title="2026년 월별 기성수금" note="VAT포함 억원 · 클릭시 월 상세">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{top:4,right:6,left:-12,bottom:0}}
              onClick={(e)=>{ if(e&&e.activePayload){ const m=M26.find(d=>d.m===e.activeLabel); if(m) setDrillTarget({type:"cashflow",data:m}) }}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
              <XAxis dataKey="name" tick={{fontSize:11}} tickFormatter={v=>v.replace("월","")} style={{cursor:"pointer"}}/>
              <YAxis tick={{fontSize:10}} tickFormatter={v=>v+"억"}/>
              <Tooltip formatter={(v,n)=>[`${v}억`,n]} cursor={{fill:"rgba(24,95,165,.06)"}}/>
              <Bar dataKey="현금" fill={C.navyM} stackId="s" radius={[0,0,2,2]} barSize={20}/>
              <Bar dataKey="어음" fill={C.amber} stackId="s" radius={[2,2,0,0]} barSize={20}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{fontSize:11,color:C.gray,marginTop:6}}>바 클릭 시 해당 월 상세 페이지 이동</div>
        </Card>
      </div>

      <AIInsightPanel title="전사 경영 현황 종합"
        context="2026년 5월 누계: 수주목표 170억/계약+확정 96.72억(56.9%)/추진포함 384.5억/매출 29.61억(20.4%)/지출 57.37억/손익 -27.76억/예상기성 161.23억/민간위험 48.64억/인원 61.75명" />
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 기성수금 탭
// ════════════════════════════════════════════════════════════
function CashflowTab({setDrillTarget}) {
  const [year, setYear] = useState("2026")
  const data = year==="2026" ? M26 : [
    {m:"1월",cash:3.01,note:0,blue:0,actual:false,memo:"화성배양 착공",projects:[]},
    {m:"2월",cash:0,note:0,blue:0,actual:false,memo:"-",projects:[]},
    {m:"3월",cash:23.55,note:0,blue:0,actual:false,memo:"수원남부경찰서·쿠팡부산FC",projects:[]},
    ...Array.from({length:9},(_,i)=>({m:`${i+4}월`,cash:0,note:0,blue:0,actual:false,memo:"-",projects:[]}))
  ]
  const tc=data.reduce((s,d)=>s+d.cash,0), tn=data.reduce((s,d)=>s+d.note,0)
  const tb=data.reduce((s,d)=>s+d.blue,0)

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <select value={year} onChange={e=>setYear(e.target.value)} style={{padding:"7px 11px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:13,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
          <option value="2026">2026년</option>
          <option value="2027">2027년</option>
        </select>
        <span style={{fontSize:12,color:C.gray}}>바 클릭 시 해당 월 상세 이동</span>
      </div>
      <div style={S.grid(5)}>
        {[["연간합계",`${(tc+tn).toFixed(2)}억`,"현금+어음",C.navyM],["현금",`${tc.toFixed(2)}억`,"어음제외",C.navyM],["어음",tn>0?`${tn.toFixed(2)}억`:"없음","별도관리",tn>0?C.amber:C.gray],["민간위험",tb>0?`${tb.toFixed(2)}억`:"없음","달성불확실",tb>0?C.red:C.gray]].map(([l,v,s,c])=>(
          <div key={l} style={S.kpi(c)} onClick={()=>{}}>
            <div style={{fontSize:12,color:C.gray,marginBottom:7}}>{l}</div>
            <div style={{fontSize:26,fontWeight:500,color:c}}>{v}</div>
            <div style={{fontSize:11,color:C.gray,marginTop:5}}>{s}</div>
          </div>
        ))}
      </div>
      {tb>0&&<div style={{background:C.amberL,borderLeft:`4px solid ${C.amber}`,borderRadius:"0 8px 8px 0",padding:"11px 16px",fontSize:13,color:"#633806",marginBottom:14,display:"flex",gap:8}}>
        <i className="ti ti-flag" aria-hidden="true" style={{flexShrink:0,marginTop:1}}/><span><strong>민간위험 {tb.toFixed(2)}억</strong> — 7월 14.32억, 9월 6.99억이 시행사 상황에 따라 불확실. 합계 포함, 별도 모니터링 필요.</span>
      </div>}
      <Card title="월별 기성수금" note="VAT포함 억원 · 바 클릭 시 상세">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.map(d=>({name:d.m,현금:+d.cash.toFixed(2),어음:+d.note.toFixed(2)}))}
            margin={{top:4,right:6,left:-10,bottom:0}}
            onClick={(e)=>{ if(e&&e.activePayload){ const m=data.find(d=>d.m===e.activeLabel); if(m) setDrillTarget({type:"cashflow",data:m}) }}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
            <XAxis dataKey="name" tick={{fontSize:12}} tickFormatter={v=>v.replace("월","")} style={{cursor:"pointer"}}/>
            <YAxis tick={{fontSize:11}} tickFormatter={v=>v+"억"}/>
            <Tooltip formatter={(v,n)=>[`${v}억`,n]} cursor={{fill:"rgba(24,95,165,.06)"}}/>
            <Bar dataKey="현금" fill={C.navyM} stackId="s" radius={[0,0,3,3]} barSize={24}/>
            <Bar dataKey="어음" fill={C.amber} stackId="s" radius={[3,3,0,0]} barSize={24}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="월별 상세">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["월","현금(억)","어음(억)","합계(억)","민간위험","상태","주요내역"].map((h,i)=><th key={h} style={S.th(i>=1&&i<=4?"right":"left")}>{h}</th>)}</tr></thead>
            <tbody>
              {data.map((d,i)=>{
                const tot=(d.cash+d.note).toFixed(2)
                return <tr key={i} style={{cursor:"pointer"}}
                  onClick={()=>setDrillTarget({type:"cashflow",data:d})}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary,#f5f5f3)"}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{...S.td("left"),fontWeight:d.actual?600:400}}>{d.m}{d.actual&&<span style={{...S.badge(C.navyL,C.navyM),marginLeft:5,fontSize:10}}>실적</span>}</td>
                  <td style={{...S.td("right"),fontSize:16}}>{d.cash.toFixed(2)}</td>
                  <td style={{...S.td("right"),color:d.note>0?C.amber:"var(--color-text-secondary)",fontSize:16}}>{d.note>0?d.note.toFixed(2):"-"}</td>
                  <td style={{...S.td("right"),fontWeight:500,fontSize:17,color:+tot>20?C.green:+tot>10?C.navyM:"inherit"}}>{tot}</td>
                  <td style={S.td("right")}>{d.blue>0?<span style={S.badge(C.amberL,"#633806")}>{d.blue.toFixed(2)}억</span>:"-"}</td>
                  <td style={S.td("left")}>{d.actual?<span style={S.badge(C.greenL,C.green)}>실적</span>:<span style={S.badge(C.grayL,C.gray)}>예상</span>}</td>
                  <td style={{...S.td("left"),fontSize:12,color:"var(--color-text-secondary,#888)"}}>{d.memo||"-"}</td>
                </tr>
              })}
              <tr style={{background:"var(--color-background-secondary,#f0f0ee)",fontWeight:600}}>
                <td style={{...S.td("left")}}>합계</td>
                <td style={{...S.td("right"),color:C.navyM,fontSize:17}}>{tc.toFixed(2)}</td>
                <td style={{...S.td("right"),color:tn>0?C.amber:"var(--color-text-secondary)",fontSize:17}}>{tn>0?tn.toFixed(2):"-"}</td>
                <td style={{...S.td("right"),color:C.green,fontSize:18}}>{(tc+tn).toFixed(2)}</td>
                <td style={S.td("right")}>{tb>0?<span style={S.badge(C.redL,C.red)}>{tb.toFixed(2)}억</span>:"-"}</td>
                <td colSpan={2}/>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <AIInsightPanel title={`${year}년 기성수금 현황`}
        context={`${year}년 연간 현금합계: ${tc.toFixed(2)}억, 어음합계: ${tn.toFixed(2)}억, 전체: ${(tc+tn).toFixed(2)}억, 민간위험: ${tb.toFixed(2)}억. 1월 2.21억 실적부터 12월 27.27억 예상까지. 7월 36.32억으로 연중 최고 기성 월.`} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 프로젝트 탭
// ════════════════════════════════════════════════════════════
function ProjectsTab({setDrillTarget, canWrite}) {
  const [dept, setDept] = useState("")
  const [type, setType] = useState("")
  const filtered = PROJECTS.filter(p=>(!dept||p.dept.includes(dept))&&(!type||p.type===type))
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {[["pj-d",setDept,[["","전체 본부"],["설계1","설계1본부"],["설계2","설계2본부"],["디자인","디자인본부"],["주거","주거디자인"],["해외","해외사업부"]]],
          ["pj-t",setType,[["","전체 구분"],["계약","계약"],["확정","확정"],["추진","추진"],["기성","기성"]]]
        ].map(([id,setter,opts])=>(
          <select key={id} onChange={e=>setter(e.target.value)} style={{padding:"7px 11px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:13,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
            {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <span style={{fontSize:12,color:C.gray}}>{filtered.length}건 · 클릭시 상세</span>
      </div>
      <Card title="프로젝트 현황" note="행 클릭 시 상세 페이지">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["구분","본부","프로젝트명","용역비","진행률","진행바","기성율","2026예상","평당단가","발주"].map((h,i)=><th key={h} style={S.th(i>2&&i<9?"right":i===2?"left":"center")}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((p,i)=>{
                const tb=TYPE_BADGE[p.type]||{bg:C.grayL,fg:C.gray}
                const bc=p.prog>=70?C.green:p.prog>=30?C.navyM:C.gray
                const acr=p.fee>0?(p.acc/p.fee*100).toFixed(0):0
                return <tr key={p.id} style={{cursor:"pointer",background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}
                  onClick={()=>setDrillTarget({type:"project",data:p})}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(24,95,165,.04)"}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}>
                  <td style={S.td("center")}><span style={S.badge(tb.bg,tb.fg)}>{p.type}</span></td>
                  <td style={{...S.td("center"),fontSize:12}}>{p.dept}</td>
                  <td style={{...S.td("left"),maxWidth:200,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={p.name}>{p.name}</td>
                  <td style={{...S.td("right"),fontSize:15}}>{fE(p.fee)}</td>
                  <td style={{...S.td("right"),fontWeight:500,fontSize:15,color:bc}}>{p.prog}%</td>
                  <td style={{...S.td("center"),minWidth:90}}>
                    <div style={{width:80,height:8,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:4,overflow:"hidden",display:"inline-block"}}>
                      <div style={{width:`${p.prog}%`,height:8,background:bc,borderRadius:4}}/>
                    </div>
                  </td>
                  <td style={{...S.td("right"),fontSize:14,color:+acr>=50?C.green:C.gray}}>{p.fee>0?acr+"%":"-"}</td>
                  <td style={{...S.td("right"),fontSize:15}}>{fE(p.rev26)}</td>
                  <td style={{...S.td("right"),fontSize:12,color:C.navyM}}>{p.pyFloor?fPy(p.fee*1e8/p.pyFloor):"-"}</td>
                  <td style={{...S.td("center"),fontSize:12}}>{p.pub}</td>
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
// 손익 탭
// ════════════════════════════════════════════════════════════
function PnlTab({pnlData, setPnlData, canWrite, setDrillTarget}) {
  const [editing, setEditing]   = useState(false)
  const [draft,   setDraft]     = useState(null)

  const calc = r => {
    const lbr = r.sal+r.ot+r.etc_lbr
    const sub = r.sub_dir+r.sub_stl
    const exp = r.exp+r.biz+r.fix+r.misc
    const total = lbr+sub+exp+r.shared
    return {lbr, sub, exp, total, pnl:r.rev-total}
  }

  const startEdit = () => { setDraft(pnlData.map(r=>({...r}))); setEditing(true) }
  const saveEdit  = () => { setPnlData(draft); setEditing(false); setDraft(null) }
  const cancelEdit= () => { setEditing(false); setDraft(null) }
  const upd = (idx,field,val) => setDraft(prev=>prev.map((r,i)=>i===idx?{...r,[field]:parseFloat(val)||0}:r))

  const work = editing ? draft : pnlData
  const cum = work.slice(0,5).reduce((a,r)=>{
    const c=calc(r)
    return {rev:a.rev+r.rev,lbr:a.lbr+c.lbr,sub:a.sub+c.sub,exp:a.exp+c.exp,shared:a.shared+r.shared,total:a.total+c.total,pnl:a.pnl+c.pnl}
  },{rev:0,lbr:0,sub:0,exp:0,shared:0,total:0,pnl:0})

  const FIELDS = [
    {k:"rev",l:"매출",grp:"매출",c:C.green},{k:"sal",l:"급여",grp:"인건비",c:C.navyM},{k:"ot",l:"야근보조",grp:"인건비",c:C.navyM},
    {k:"etc_lbr",l:"기타인건비",grp:"인건비",c:C.navyM},{k:"sub_dir",l:"직접외주비",grp:"외주비",c:C.amber},{k:"sub_stl",l:"외주정산금",grp:"외주비",c:C.amber},
    {k:"exp",l:"경비",grp:"경비",c:C.gray},{k:"biz",l:"업무추진비",grp:"경비",c:C.gray},{k:"fix",l:"집기여비",grp:"경비",c:C.gray},
    {k:"misc",l:"기타경비",grp:"경비",c:C.gray},{k:"shared",l:"공동비",grp:"공동비",c:C.gray},
  ]

  const lineData = work.map(r=>{const c=calc(r);return{name:r.m,매출:+r.rev.toFixed(2),지출:+c.total.toFixed(2),손익:+c.pnl.toFixed(2)}})

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        {canWrite ? (!editing
          ? <button onClick={startEdit} style={S.btn(C.navyM)}><i className="ti ti-edit" aria-hidden="true"/> 월별 수치 입력</button>
          : <><button onClick={saveEdit} style={S.btn(C.green)}><i className="ti ti-check" aria-hidden="true"/> 저장</button>
              <button onClick={cancelEdit} style={S.btn(C.gray)}>취소</button>
              <span style={{fontSize:12,color:C.amber}}>수정 중 — 저장을 눌러 확정하세요</span></>
        ) : <span style={{fontSize:12,color:C.gray,padding:"8px 12px",background:"var(--color-background-secondary,#f5f5f3)",borderRadius:8}}><i className="ti ti-lock" aria-hidden="true"/> 입력 권한 없음</span>}
      </div>

      <div style={S.grid(6)}>
        {[["매출",fE(cum.rev),C.green],["인건비",fE(cum.lbr),C.navyM],["외주비",fE(cum.sub),C.amber],["경비류",fE(cum.exp),C.gray],["지출합계",fE(cum.total),C.red],["손익",fE(cum.pnl),cum.pnl>=0?C.green:C.red]].map(([l,v,c])=>(
          <div key={l} style={S.kpi(c)}>
            <div style={{fontSize:12,color:C.gray,marginBottom:7}}>{l}</div>
            <div style={{fontSize:24,fontWeight:500,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      <Card title="월별 매출·지출 추이" note="바 클릭 시 해당 월 상세">
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={lineData} margin={{top:4,right:10,left:-10,bottom:0}}
            onClick={(e)=>{ if(e&&e.activePayload){ const r=work.find(d=>d.m===e.activeLabel); if(r) setDrillTarget({type:"pnl_month",data:r}) }}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
            <XAxis dataKey="name" tick={{fontSize:12}} tickFormatter={v=>v.replace("월","")} style={{cursor:"pointer"}}/>
            <YAxis tick={{fontSize:11}} tickFormatter={v=>v+"억"}/>
            <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억`,n]} cursor={{fill:"rgba(24,95,165,.06)"}}/>
            <Bar dataKey="매출" fill={C.green} opacity={0.8} radius={[3,3,0,0]} barSize={20}/>
            <Bar dataKey="지출" fill={C.red}   opacity={0.75} radius={[3,3,0,0]} barSize={20}/>
            <Line type="monotone" dataKey="손익" stroke={C.gray} strokeWidth={2} dot={{r:4}} strokeDasharray="5 3"/>
            <ReferenceLine y={0} stroke={C.red} strokeDasharray="4 2"/>
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card title={editing?"📝 월별 수치 입력 (억원)":"월별 손익 상세"} note="자동계산 행은 수정 불가">
        {editing && <div style={{background:C.navyL,borderRadius:8,padding:"9px 14px",marginBottom:12,fontSize:12,color:C.navyM}}>
          <i className="ti ti-info-circle" aria-hidden="true"/> 셀 클릭 후 억원 단위로 입력. 인건비소계·외주비소계·지출합계·손익은 자동 계산됩니다.
        </div>}
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              <th style={{...S.th("left"),minWidth:90}}>항목</th>
              {work.map(r=><th key={r.m} style={{...S.th("right"),background:r.m<="5월"?"var(--color-background-secondary,#f0f0ee)":"var(--color-background-tertiary,#f8f8f6)"}}>
                {r.m}{r.m<="5월"&&<span style={{...S.badge(C.navyL,C.navyM),marginLeft:3,fontSize:9}}>실</span>}
              </th>)}
              <th style={S.th("right")}>합계</th>
            </tr></thead>
            <tbody>
              {FIELDS.map(({k,l,c},fi)=>{
                const rowSum = work.reduce((s,r)=>s+(r[k]||0),0)
                return <tr key={k} style={{background:fi%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={{...S.td("left"),color:c,fontSize:13}}>{l}</td>
                  {work.map((r,ri)=>(
                    <td key={ri} style={S.td("right")}>
                      {editing ? <input type="number" step="0.01" value={(draft[ri][k]||0).toFixed(2)}
                        onChange={e=>upd(ri,k,e.target.value)}
                        style={{...S.inp(),width:64,fontSize:12,padding:"3px 6px",textAlign:"right"}}/>
                        : <span style={{color:r[k]>0?c:"var(--color-text-secondary,#aaa)",fontSize:13}}>{r[k]>0?(+r[k]).toFixed(2):"-"}</span>}
                    </td>
                  ))}
                  <td style={{...S.td("right"),fontWeight:500,color:c,fontSize:13}}>{rowSum.toFixed(2)}</td>
                </tr>
              })}
              {[{l:"인건비 소계",fn:r=>calc(r).lbr,c:C.navyM},{l:"외주비 소계",fn:r=>calc(r).sub,c:C.amber},{l:"지출 합계",fn:r=>calc(r).total,c:C.red,bg:"var(--color-background-secondary)"},{l:"손익",fn:r=>calc(r).pnl,c:null,pnl:true}].map(({l,fn,c,bg,pnl})=>{
                const vals=work.map(r=>fn(r)), sum=vals.reduce((s,v)=>s+v,0)
                return <tr key={l} style={{background:pnl?"#FCEBEB":(bg||"var(--color-background-secondary,#f5f5f3)"),fontWeight:500}}>
                  <td style={{...S.td("left"),fontSize:13,color:c||"var(--color-text-primary)"}}>{l}</td>
                  {vals.map((v,i)=><td key={i} style={{...S.td("right"),fontSize:14,color:pnl?(v>=0?C.green:C.red):(c||"inherit"),cursor:"pointer"}}
                    onClick={()=>setDrillTarget({type:"pnl_month",data:work[i]})}>{v.toFixed(2)}</td>)}
                  <td style={{...S.td("right"),fontWeight:700,fontSize:15,color:pnl?(sum>=0?C.green:C.red):(c||"inherit")}}>{sum.toFixed(2)}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <AIInsightPanel title="손익 현황 분석"
        context={`2026년 5월 누계: 매출 ${cum.rev.toFixed(2)}억/인건비 ${cum.lbr.toFixed(2)}억(${(cum.lbr/cum.rev*100).toFixed(1)}%)/외주비 ${cum.sub.toFixed(2)}억(${(cum.sub/cum.rev*100).toFixed(1)}%)/지출합계 ${cum.total.toFixed(2)}억/손익 ${cum.pnl.toFixed(2)}억`} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 연도비교 탭
// ════════════════════════════════════════════════════════════
function CompareTab({years, setYears, showAddYear, setShowAddYear, canWrite}) {
  const [newY, setNewY] = useState({yr:"",목표수주:0,실행수주:0,목표매출:0,실행매출:0,인원:0})
  const barData = years.map(d=>({name:d.yr,수주목표:d.목표수주,수주실행:d.실행수주,매출목표:d.목표매출,매출실행:d.실행매출}))
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
        {canWrite && <button onClick={()=>setShowAddYear(true)} style={S.btn(C.green)}><i className="ti ti-plus" aria-hidden="true"/> 연도 추가</button>}
        <span style={{fontSize:12,color:C.gray}}>데이터 추가 시 차트 자동 확장</span>
      </div>
      <Card title="연도별 수주·매출 현황" note="VAT별도(수주)·VAT포함(매출) 억원">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={barData} margin={{top:4,right:10,left:-10,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
            <XAxis dataKey="name" tick={{fontSize:13}}/>
            <YAxis tick={{fontSize:11}} tickFormatter={v=>v+"억"}/>
            <Tooltip formatter={(v,n)=>[`${v.toFixed(1)}억`,n]}/>
            <Bar dataKey="수주목표" fill="rgba(136,135,128,.22)" stroke={C.gray} strokeWidth={0.5} radius={[3,3,0,0]} barSize={16}/>
            <Bar dataKey="수주실행" fill={C.navyM} radius={[3,3,0,0]} barSize={16}/>
            <Bar dataKey="매출목표" fill="rgba(186,117,23,.2)" stroke={C.amber} strokeWidth={0.5} radius={[3,3,0,0]} barSize={16}/>
            <Bar dataKey="매출실행" fill={C.amber} radius={[3,3,0,0]} barSize={16}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="연도별 수치 비교">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["연도","수주목표","수주실행","달성률","매출목표","매출실행","달성률","인원","인당수주","인당매출"].map((h,i)=><th key={h} style={S.th(i>0?"right":"left")}>{h}</th>)}</tr></thead>
            <tbody>
              {years.map((d,i)=>{
                const cr=d.목표수주>0?((d.실행수주/d.목표수주)*100).toFixed(1):"-"
                const rr=d.목표매출>0?((d.실행매출/d.목표매출)*100).toFixed(1):"-"
                const badg=(v)=>({bg:+v>=80?C.greenL:+v>=50?C.amberL:C.redL,fg:+v>=80?"#27500A":+v>=50?"#633806":C.red})
                return <tr key={d.yr} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={{...S.td("left"),fontWeight:600,fontSize:14}}>{d.yr}{d.yr==="2026"&&<span style={{...S.badge(C.navyL,C.navyM),marginLeft:5,fontSize:10}}>5월누계</span>}</td>
                  <td style={{...S.td("right"),fontSize:14}}>{d.목표수주.toFixed(1)}</td>
                  <td style={{...S.td("right"),fontSize:14}}>{d.실행수주.toFixed(2)}</td>
                  <td style={{...S.td("right")}}>{cr!=="-"?<span style={S.badge(badg(cr).bg,badg(cr).fg)}>{cr}%</span>:"-"}</td>
                  <td style={{...S.td("right"),fontSize:14}}>{d.목표매출.toFixed(1)}</td>
                  <td style={{...S.td("right"),fontSize:14}}>{d.실행매출.toFixed(2)}</td>
                  <td style={{...S.td("right")}}>{rr!=="-"?<span style={S.badge(badg(rr).bg,badg(rr).fg)}>{rr}%</span>:"-"}</td>
                  <td style={{...S.td("right"),fontSize:14}}>{d.인원.toFixed(1)}</td>
                  <td style={{...S.td("right"),fontSize:14,fontWeight:500,color:C.navyM}}>{(d.실행수주/d.인원).toFixed(2)}억</td>
                  <td style={{...S.td("right"),fontSize:14,fontWeight:500,color:C.amber}}>{(d.실행매출/d.인원).toFixed(2)}억</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <AIInsightPanel title="3개년 경영 비교 분석"
        context={`${years.map(d=>`${d.yr}년: 수주목표 ${d.목표수주}억/실행 ${d.실행수주}억(${d.목표수주>0?((d.실행수주/d.목표수주)*100).toFixed(0):"N/A"}%)/매출 ${d.실행매출}억/인원 ${d.인원}명/인당수주 ${(d.실행수주/d.인원).toFixed(2)}억`).join(" | ")}`} />
      {showAddYear && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
          <div style={S.card({width:380,maxWidth:"95vw"})}>
            <div style={{fontSize:15,fontWeight:500,marginBottom:16}}>연도 데이터 추가</div>
            {[["yr","연도 (예: 2027)","text"],["목표수주","수주목표 (억원)","number"],["실행수주","수주실행 (억원)","number"],["목표매출","매출목표 (억원)","number"],["실행매출","매출실행 (억원)","number"],["인원","연평균 인원 (명)","number"]].map(([k,l,t])=>(
              <div key={k} style={{marginBottom:10}}>
                <label style={S.lbl()}>{l}</label>
                <input type={t} value={newY[k]} onChange={e=>setNewY(p=>({...p,[k]:t==="number"?parseFloat(e.target.value)||0:e.target.value}))} style={S.inp()}/>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <button onClick={()=>{if(newY.yr){setYears(p=>[...p,{...newY}]);setShowAddYear(false)}}} style={S.btn(C.navyM)}>추가</button>
              <button onClick={()=>setShowAddYear(false)} style={S.btn(C.gray)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 권한 관리 탭 (관리자 전용)
// ════════════════════════════════════════════════════════════
function AuthTab({users, setUsers}) {
  const [editId,  setEditId]  = useState(null)
  const [editForm,setEditForm]= useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({name:"",email:"",role:"viewer",dept:"",read:true,write:false,canManageUsers:false,active:true})

  const startEdit = (u) => { setEditId(u.id); setEditForm({...u}) }
  const saveEdit  = () => { setUsers(prev=>prev.map(u=>u.id===editId?{...editForm}:u)); setEditId(null); setEditForm(null) }
  const toggleActive = (id) => setUsers(prev=>prev.map(u=>u.id===id?{...u,active:!u.active}:u))
  const addUser = () => {
    if (!newUser.name || !newUser.email) return
    setUsers(prev=>[...prev, {...newUser, id:`U${Date.now()}`, avatar:newUser.name.slice(0,2)}])
    setShowAdd(false)
    setNewUser({name:"",email:"",role:"viewer",dept:"",read:true,write:false,canManageUsers:false,active:true})
  }

  const ROLE_OPTIONS = [
    {v:"admin",    l:"관리자",  desc:"전체 접근 + 권한 관리"},
    {v:"executive",l:"임원",    desc:"읽기 + 소속 본부 쓰기"},
    {v:"viewer",   l:"열람자",  desc:"읽기만 가능"},
  ]

  return (
    <div>
      <div style={{background:C.navyL,border:`0.5px solid ${C.navyM}`,borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",gap:10,alignItems:"flex-start"}}>
        <i className="ti ti-brand-google" style={{fontSize:18,color:C.navyM,flexShrink:0,marginTop:1}} aria-hidden="true"/>
        <div style={{fontSize:13,color:C.navyM,lineHeight:1.7}}>
          <strong>구글 계정 기반 접근 관리.</strong> 구글 계정 이메일로 등록 → 로그인 시 자동 인증. 역할별 기본 권한에 더해 개인별 읽기/쓰기를 별도 설정할 수 있습니다.
        </div>
      </div>

      {/* 역할별 권한 설명 */}
      <div style={S.grid(3, 10)}>
        {ROLE_OPTIONS.map(r=>{
          const rb = ROLE_BADGE[r.v]
          return (
            <div key={r.v} style={S.card({marginBottom:0, borderLeft:`4px solid ${rb.fg}`})}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={S.badge(rb.bg,rb.fg)}>{r.l}</span>
              </div>
              <div style={{fontSize:13,color:"var(--color-text-primary,#333)",fontWeight:500,marginBottom:4}}>{r.desc}</div>
              <div style={{fontSize:12,color:C.gray,lineHeight:1.6}}>
                {r.v==="admin" && "전체 데이터 입력·삭제·사용자 추가·권한 변경 가능"}
                {r.v==="executive" && "대시보드 전체 조회 + 손익 월별 수치 입력 가능"}
                {r.v==="viewer" && "대시보드 조회 전용. 데이터 입력·수정 불가"}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:15,fontWeight:500}}>등록 사용자 관리 <span style={{fontSize:13,color:C.gray,fontWeight:400}}>({users.length}명)</span></div>
        <button onClick={()=>setShowAdd(true)} style={S.btn(C.navyM)}>
          <i className="ti ti-user-plus" aria-hidden="true"/> 사용자 추가
        </button>
      </div>

      <Card title="">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>
              {["사용자","이메일","역할","소속","읽기","쓰기","권한관리","상태",""].map((h,i)=><th key={h} style={S.th(i===0?"left":"center")}>{h}</th>)}
            </tr></thead>
            <tbody>
              {users.map((u,i)=>(
                <tr key={u.id} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)",opacity:u.active?1:.5}}>
                  <td style={S.td("left")}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:C.navyM,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:500,color:"#fff",flexShrink:0}}>{u.avatar}</div>
                      <span style={{fontSize:14,fontWeight:500}}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{...S.td("center"),fontSize:12,color:C.gray}}>{u.email}</td>
                  <td style={S.td("center")}><span style={S.badge(ROLE_BADGE[u.role].bg,ROLE_BADGE[u.role].fg)}>{ROLE_BADGE[u.role].label}</span></td>
                  <td style={{...S.td("center"),fontSize:13}}>{u.dept}</td>
                  {editId===u.id ? (
                    <>
                      <td style={S.td("center")}><input type="checkbox" checked={editForm.read}  onChange={e=>setEditForm(f=>({...f,read:e.target.checked}))}/></td>
                      <td style={S.td("center")}><input type="checkbox" checked={editForm.write} onChange={e=>setEditForm(f=>({...f,write:e.target.checked}))}/></td>
                      <td style={S.td("center")}><input type="checkbox" checked={editForm.canManageUsers} onChange={e=>setEditForm(f=>({...f,canManageUsers:e.target.checked}))}/></td>
                      <td style={S.td("center")}>
                        <select value={editForm.role} onChange={e=>setEditForm(f=>({...f,role:e.target.value}))} style={{padding:"3px 6px",borderRadius:6,border:"1px solid var(--color-border-secondary,#ddd)",fontSize:12}}>
                          {ROLE_OPTIONS.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
                        </select>
                      </td>
                      <td style={S.td("center")}>
                        <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                          <button onClick={saveEdit} style={{...S.btn(C.green),padding:"5px 10px",fontSize:12}}>저장</button>
                          <button onClick={()=>{setEditId(null);setEditForm(null)}} style={{...S.btn(C.gray),padding:"5px 10px",fontSize:12}}>취소</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={S.td("center")}>{u.read  ? <span style={{color:C.green,fontSize:16}}>✓</span> : <span style={{color:C.gray}}>—</span>}</td>
                      <td style={S.td("center")}>{u.write ? <span style={{color:C.green,fontSize:16}}>✓</span> : <span style={{color:C.gray}}>—</span>}</td>
                      <td style={S.td("center")}>{u.canManageUsers ? <span style={{color:C.amber,fontSize:16}}>✓</span> : <span style={{color:C.gray}}>—</span>}</td>
                      <td style={S.td("center")}><span style={S.badge(u.active?C.greenL:C.redL,u.active?C.green:C.red)}>{u.active?"활성":"비활성"}</span></td>
                      <td style={S.td("center")}>
                        <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                          <button onClick={()=>startEdit(u)} style={{...S.btn(C.navyL),color:C.navy,padding:"5px 10px",fontSize:12}}>수정</button>
                          <button onClick={()=>toggleActive(u.id)} style={{...S.btn(u.active?C.redL:C.greenL),color:u.active?C.red:C.green,padding:"5px 10px",fontSize:12}}>{u.active?"비활성화":"활성화"}</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showAdd && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400}}>
          <div style={S.card({width:420,maxWidth:"95vw"})}>
            <div style={{fontSize:15,fontWeight:500,marginBottom:16}}>사용자 추가</div>
            {[["name","이름 *","text"],["email","이메일 (구글 계정) *","email"],["dept","소속 부서","text"]].map(([k,l,t])=>(
              <div key={k} style={{marginBottom:10}}>
                <label style={S.lbl()}>{l}</label>
                <input type={t} value={newUser[k]||""} onChange={e=>setNewUser(p=>({...p,[k]:e.target.value}))} style={S.inp()}/>
              </div>
            ))}
            <div style={{marginBottom:10}}>
              <label style={S.lbl()}>역할</label>
              <select value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))} style={{...S.inp()}}>
                {ROLE_OPTIONS.map(r=><option key={r.v} value={r.v}>{r.l} — {r.desc}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:20,marginBottom:14}}>
              {[["read","읽기 권한"],["write","쓰기 권한"],["canManageUsers","권한 관리"]].map(([k,l])=>(
                <label key={k} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}>
                  <input type="checkbox" checked={newUser[k]||false} onChange={e=>setNewUser(p=>({...p,[k]:e.target.checked}))}/> {l}
                </label>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={addUser} style={S.btn(C.navyM)}>추가</button>
              <button onClick={()=>setShowAdd(false)} style={S.btn(C.gray)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 공통 Card 컴포넌트 ────────────────────────────────────────
function Card({title, note, children}) {
  return (
    <div style={S.card()}>
      {title && <div style={{fontSize:15,fontWeight:500,marginBottom:13,display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
        <span>{title}</span>
        {note && <span style={{fontSize:11,color:"var(--color-text-tertiary,#aaa)",fontWeight:400}}>{note}</span>}
      </div>}
      {children}
    </div>
  )
}
