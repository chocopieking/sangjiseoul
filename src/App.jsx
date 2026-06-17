
import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import * as XLSX from "xlsx"
import {
  Document as DocxDocument, Packer, Paragraph as DocxParagraph, TextRun,
  Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell,
  AlignmentType as DocxAlign, BorderStyle, WidthType, ShadingType,
  VerticalAlign as DocxVAlign, Header as DocxHeader, Footer as DocxFooter,
  PageNumber
} from "docx"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Area, ReferenceLine, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, Legend, LabelList
} from "recharts"
import { ArchiveTab } from "./Archive.jsx"
import { OptimizeTab } from "./Optimize.jsx"
import { DataHubTab } from "./DataHub.jsx"
import { VendorsTab } from "./Vendors.jsx"
import { WeeklyReportTab } from "./WeeklyReport.jsx"
// AI 기능 — 추후 ANTHROPIC_API_KEY 설정 시 활성화 가능
// import { SmartSearch, AIAssistant, AIFloatButton, WeeklyBriefing } from "./AIAssistant.jsx"
import { ManualTab } from "./ManualTab.jsx"
import { DeptContext, useDepts } from "./DeptContext.jsx"
import {
  hashPw, ALL_USERS, MASTER_PW, ROLE_BADGE,
  fE, fW, fP, fPy, fPct, toPy, PY, getAreaBasis, calcUP, calcPnlTotals,
  MONTHS, COLORS,
  BIZ_2026, DEPT_STAFF_INIT, DEPT_BIZ, CF_2026, PNL_INIT, YEARS_DB_INIT,
  STAFF_TARGET_INIT, STAFF_MONTHLY_INIT,
  DEPARTMENTS_INIT, DEPT_COLOR_POOL, DEPT_BIZ_EMPTY, DEPT_STAFF_EMPTY,
  PROJECTS_INIT, ALERTS_INIT, normalizeProject, getDeptShares, BID_TYPES, CONTRACT_TYPES_DEFAULT, PROJ_TYPES_DEFAULT, BID_TYPES_DEFAULT
} from "./data.js"
import { isConfigured, dbGet, dbSet, dbGetAll, dbSetAll, subscribeChanges } from "./supabase.js"

// ── 색상 팔레트 ───────────────────────────────────────────────
const num = v => { const n=parseFloat(v); return Number.isFinite(n)?n:0 }
const C = {
  // 발주오라 스타일 — 선명한 블루 포인트, 화이트 배경, 클린 카드
  navy:"#1A3B6E",   navyM:"#3B72F6",  navyL:"#EEF3FF",   // 메인 블루
  green:"#0EA86E",  greenL:"#E6F9F2",                     // 성공/완료
  amber:"#F59E0B",  amberL:"#FEF3C7",                     // 경고
  red:"#EF4444",    redL:"#FEE2E2",                       // 오류
  gray:"#6B7280",   grayL:"#F3F4F6",                      // 중립
  border:"#E5E7EB", bg:"#F8FAFC",                         // 배경
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

// ── 차트 값 라벨 헬퍼 (모든 차트에 수치 기본 표기) ───────────────
const lbl = (color,dec=2,size=11,suffix="")=>({
  formatter:v=>(v>0?(+v).toFixed(dec)+suffix:""),
  style:{fontSize:size,fontWeight:700,fill:color},
})

// ── 스타일 헬퍼 ───────────────────────────────────────────────
const S = {
  card:(x={})=>({background:"#fff",border:"1px solid #E5E7EB",borderRadius:16,padding:"22px 26px",marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.05)",...x}),
  kpi:(accent="#3B72F6")=>({background:"#fff",border:"1px solid #E5E7EB",borderRadius:16,padding:"20px 22px",borderLeft:`4px solid ${accent}`,cursor:"pointer",transition:"all .2s",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}),
  grid:(c,g=14)=>({display:"grid",gridTemplateColumns:`repeat(${c},1fr)`,gap:g,marginBottom:g}),
  th:(a="left")=>({padding:"12px 16px",textAlign:a,fontSize:13,fontWeight:700,color:"#6B7280",background:"#F8FAFC",borderBottom:"1px solid #E5E7EB",whiteSpace:"nowrap",letterSpacing:"0.02em"}),
  td:(a="right")=>({padding:"13px 16px",borderBottom:"1px solid #F3F4F6",textAlign:a,fontSize:14.5,verticalAlign:"middle",color:"#111827"}),
  btn:(bg="#3B72F6",fg="#fff")=>({padding:"10px 18px",background:bg,color:fg,border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:7,transition:"opacity .15s",letterSpacing:"-0.01em"}),
  inp:(w)=>({padding:"10px 14px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:14.5,width:w||"100%",boxSizing:"border-box",background:"#fff",color:"#111827",fontFamily:"inherit",outline:"none",transition:"border-color .15s"}),
  lbl:()=>({display:"block",fontSize:13,color:"#6B7280",fontWeight:700,marginBottom:5,letterSpacing:"0.01em"}),
  bdg:(bg,fg)=>({display:"inline-flex",alignItems:"center",padding:"4px 12px",borderRadius:20,fontSize:12.5,fontWeight:700,background:bg,color:fg,letterSpacing:"0.01em"}),
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
      try{
        const map = pwMap
        if (!map["U000"]) {
          const mh = await hashPw(MASTER_PW)
          const dh = await hashPw("sangjiseoul2026!")
          const nm = {...map}
          ALL_USERS.forEach(u=>{ if(!nm[u.id]) nm[u.id]=u.id==="U000"?mh:dh })
          savePwMap(nm)
        }
      }catch(e){
        console.error("초기 비밀번호 설정 중 오류:", e)
      }finally{
        // 위에서 오류가 나더라도 화면이 "초기화 중…"에 멈춰있지 않도록 항상 완료 처리
        setInitDone(true)
      }
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
    setCurrentUser(u); setAuth("app"); setLoginId(""); setLoginPw(""); userEmail.current = u.email||u.name||"unknown"
  }
  const doLogout = ()=>{ setCurrentUser(null); setAuth("login"); setLoginId(""); setLoginPw("") }
  const saveUsers = (updated)=>{ const nm={}; updated.forEach(u=>{if(u._pwHash)nm[u.id]=u._pwHash}); savePwMap(nm) }
  const canWrite = currentUser?.write===true

  // ── 헬퍼 ──────────────────────────────────────────────────────
  const USE_DB = isConfigured()
  const userEmail = useRef("")
  const lsGet = (key, init) => { try{ const v=localStorage.getItem(key); return v?JSON.parse(v):init }catch{ return init } }
  const lsSet = (key, val)  => { try{ localStorage.setItem(key, JSON.stringify(val)) }catch{} }
  const mkPersist = (setter, key) => updater => setter(prev => {
    const next = typeof updater==="function" ? updater(prev) : updater
    lsSet(key, next)
    if (USE_DB) dbSet(key, next, userEmail.current).catch(()=>{})
    return next
  })

  // ── 앱 상태 (state 먼저 선언 → useEffect에서 setter 참조 가능) ──
  const [tab, setTab]             = useState("analysis")
  const [dbReady, setDbReady]     = useState(!USE_DB)
  const [dbStatus, setDbStatus]   = useState(USE_DB ? "connecting" : "local")

  const [projectsRaw, setProjectsRaw]   = useState(()=>lsGet("sjs_projects", PROJECTS_INIT).map(normalizeProject))
  const setProjects = mkPersist(setProjectsRaw, "sjs_projects")
  const projects = projectsRaw

  const [pnlDataRaw, setPnlDataRaw]     = useState(()=>lsGet("sjs_pnl", PNL_INIT))
  const setPnlData = mkPersist(setPnlDataRaw, "sjs_pnl")
  const pnlData = pnlDataRaw

  const [yearsRaw, setYearsRaw]         = useState(()=>lsGet("sjs_years", YEARS_DB_INIT))
  const setYears = mkPersist(setYearsRaw, "sjs_years")
  const years = yearsRaw

  const [cashflowRaw, setCashflowRaw]   = useState(()=>lsGet("sjs_cashflow", CF_2026))
  const setCashflow = mkPersist(setCashflowRaw, "sjs_cashflow")
  const cashflow = cashflowRaw

  // ── 데이터 버전 기록 (스냅샷) ───────────────────────────────
  const [versions, setVersions] = useState(()=>{ try{ return JSON.parse(localStorage.getItem("sjs_versions")||"[]") }catch{ return [] } })
  const persistVersions = list => { try{ localStorage.setItem("sjs_versions", JSON.stringify(list.slice(0,80))) }catch{} ; setVersions(list.slice(0,80)) }
  const saveVersion = useCallback((type,label,data,by)=>{
    const snap = {id:`${Date.now()}_${Math.random().toString(36).slice(2,7)}`, type, label, savedBy:by, savedAt:new Date().toISOString(), data:JSON.parse(JSON.stringify(data))}
    setVersions(prev=>{ const next=[snap,...prev].slice(0,80); try{localStorage.setItem("sjs_versions",JSON.stringify(next))}catch{} ; return next })
  },[])
  const restoreVersion = useCallback((snap,by)=>{
    if(snap.type==="staff"||snap.type==="all") {
      if(snap.data.deptStaff) setDeptStaff(snap.data.deptStaff)
      else if(!snap.data.staffTarget && !snap.data.staffMonthly) setDeptStaff(snap.data)
      if(snap.data.staffTarget)  setStaffTarget(snap.data.staffTarget)
      if(snap.data.staffMonthly) setStaffMonthly(snap.data.staffMonthly)
    }
    if(snap.type==="pnl"||snap.type==="all")   setPnlData(snap.data.pnlData??snap.data)
    if(snap.type==="cashflow"||snap.type==="all") setCashflow(snap.data.cashflow??snap.data)
    if(snap.type==="years"||snap.type==="all") setYears(snap.data.years??snap.data)
    saveVersion(snap.type,`복원: ${snap.label}`,snap.data,by)
  },[saveVersion])
  const deleteVersion = id => persistVersions(versions.filter(v=>v.id!==id))
  const [deptStaffRaw, setDeptStaffRaw]       = useState(()=>lsGet("sjs_dept_staff", DEPT_STAFF_INIT))
  const setDeptStaff = mkPersist(setDeptStaffRaw, "sjs_dept_staff")
  const deptStaff = deptStaffRaw

  const [staffTargetRaw, setStaffTargetRaw]   = useState(()=>lsGet("sjs_staff_target", STAFF_TARGET_INIT))
  const setStaffTarget = mkPersist(setStaffTargetRaw, "sjs_staff_target")
  const staffTarget = staffTargetRaw

  const [staffMonthlyRaw, setStaffMonthlyRaw] = useState(()=>lsGet("sjs_staff_monthly", STAFF_MONTHLY_INIT))
  const setStaffMonthly = mkPersist(setStaffMonthlyRaw, "sjs_staff_monthly")
  const staffMonthly = staffMonthlyRaw
  const [deptBiz, setDeptBizRaw] = useState(()=>{
    try{
      const s = JSON.parse(localStorage.getItem("sjs_dept_biz")||"null")
      return (s && typeof s==="object" && !Array.isArray(s)) ? {...DEPT_BIZ, ...s} : DEPT_BIZ
    }catch{ return DEPT_BIZ }
  })
  const setDeptBiz = updater => setDeptBizRaw(prev=>{
    const next = typeof updater==="function" ? updater(prev) : updater
    try{ localStorage.setItem("sjs_dept_biz", JSON.stringify(next)) }catch{}
    return next
  })

  // ── 본부(부서) 목록 — 추가/이름변경/삭제 가능 ─────────────────
  const [departments, setDepartments] = useState(()=>{
    try{ const s=JSON.parse(localStorage.getItem("sjs_departments")||"null"); return Array.isArray(s)&&s.length?s:DEPARTMENTS_INIT }catch{ return DEPARTMENTS_INIT }
  })
  const persistDepartments = list => { try{localStorage.setItem("sjs_departments",JSON.stringify(list))}catch{} ; setDepartments(list) }

  // ── 협력업체 정보(연락처) / 지급내역 ──────────────────────────
  const [vendorsDB, setVendorsDBRaw] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem("sjs_vendors")||"{}") }catch{ return {} }
  })
  const setVendorsDB = updater => setVendorsDBRaw(prev=>{
    const next = typeof updater==="function" ? updater(prev) : updater
    try{ localStorage.setItem("sjs_vendors", JSON.stringify(next)) }catch{}
    return next
  })
  const [vendorPayments, setVendorPaymentsRaw] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem("sjs_vendor_payments")||"[]") }catch{ return [] }
  })
  const setVendorPayments = updater => setVendorPaymentsRaw(prev=>{
    const next = typeof updater==="function" ? updater(prev) : updater
    try{ localStorage.setItem("sjs_vendor_payments", JSON.stringify(next)) }catch{}
    return next
  })

  // ── 수주 유형 목록 (추가/수정/삭제 가능) ────────────────────────
  const [contractTypes, setContractTypesRaw] = useState(()=>{
    try{ const s=JSON.parse(localStorage.getItem("sjs_contract_types")||"null"); return Array.isArray(s)&&s.length?s:CONTRACT_TYPES_DEFAULT }catch{ return CONTRACT_TYPES_DEFAULT }
  })
  const setContractTypes = list => {
    try{ localStorage.setItem("sjs_contract_types", JSON.stringify(list)) }catch{}
    setContractTypesRaw(list)
  }

  const [projTypesRaw, setProjTypesRaw] = useState(()=>lsGet("sjs_proj_types", PROJ_TYPES_DEFAULT))
  const setProjTypes = mkPersist(setProjTypesRaw, "sjs_proj_types")
  const projTypes = projTypesRaw

  const [bidTypesRaw, setBidTypesRaw] = useState(()=>lsGet("sjs_bid_types", BID_TYPES_DEFAULT))
  const setBidTypes = mkPersist(setBidTypesRaw, "sjs_bid_types")
  const bidTypes = bidTypesRaw

  // ── Supabase: 앱 시작 시 전체 로드 (state 선언 후에 위치해야 함) ──
  useEffect(() => {
    if (!USE_DB) return
    dbGetAll().then(all => {
      if (!all) { setDbStatus("error"); setDbReady(true); return }
      const g = (k, init) => {
        const v = all[k]
        if (v === undefined || v === null) return lsGet(k, init)
        // 빈 배열이면 초기값 사용 (DB에 빈값으로 시드된 경우)
        if (Array.isArray(v) && v.length === 0) return lsGet(k, init)
        if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return lsGet(k, init)
        return v
      }
      setProjectsRaw(g("sjs_projects", PROJECTS_INIT).map(normalizeProject))
      setPnlDataRaw(g("sjs_pnl", PNL_INIT))
      setYearsRaw(g("sjs_years", YEARS_DB_INIT))
      setCashflowRaw(g("sjs_cashflow", CF_2026))
      setDeptStaffRaw(g("sjs_dept_staff", DEPT_STAFF_INIT))
      setStaffTargetRaw(g("sjs_staff_target", STAFF_TARGET_INIT))
      setStaffMonthlyRaw(g("sjs_staff_monthly", STAFF_MONTHLY_INIT))
      setDepartments(g("sjs_departments", DEPARTMENTS_INIT))
      setDeptBizRaw(g("sjs_dept_biz", DEPT_BIZ))
      setVendorsDBRaw(g("sjs_vendors", {}))
      setVendorPaymentsRaw(g("sjs_vendor_payments", []))
      setContractTypesRaw(g("sjs_contract_types", CONTRACT_TYPES_DEFAULT))
      setProjTypesRaw(g("sjs_proj_types", PROJ_TYPES_DEFAULT))
      setBidTypesRaw(g("sjs_bid_types", BID_TYPES_DEFAULT))
      setDbStatus("ok"); setDbReady(true)
    }).catch(() => { setDbStatus("error"); setDbReady(true) })
  }, []) // eslint-disable-line

  // ── Supabase: 실시간 구독 ──────────────────────────────────
  useEffect(() => {
    if (!USE_DB) return
    const unsub = subscribeChanges((key, value) => {
      if      (key==="sjs_projects")         setProjectsRaw(value.map(normalizeProject))
      else if (key==="sjs_pnl")              setPnlDataRaw(value)
      else if (key==="sjs_years")            setYearsRaw(value)
      else if (key==="sjs_cashflow")         setCashflowRaw(value)
      else if (key==="sjs_dept_staff")       setDeptStaffRaw(value)
      else if (key==="sjs_staff_target")     setStaffTargetRaw(value)
      else if (key==="sjs_staff_monthly")    setStaffMonthlyRaw(value)
      else if (key==="sjs_departments")      setDepartments(value)
      else if (key==="sjs_dept_biz")         setDeptBizRaw(value)
      else if (key==="sjs_vendors")          setVendorsDBRaw(value)
      else if (key==="sjs_vendor_payments")  setVendorPaymentsRaw(value)
      else if (key==="sjs_contract_types")   setContractTypesRaw(value)
      else if (key==="sjs_proj_types")       setProjTypesRaw(value)
      else if (key==="sjs_bid_types")        setBidTypesRaw(value)
    })
    return unsub
  }, []) // eslint-disable-line

  const DEPTS       = useMemo(()=>departments.filter(d=>d.finance).map(d=>d.name),[departments])
  const STAFF_DEPTS = useMemo(()=>departments.map(d=>d.name),[departments])
  const DEPT_COLORS = useMemo(()=>Object.fromEntries(departments.map(d=>[d.name,d.color])),[departments])
  const omitKey = (obj,key)=>{ if(!obj||!(key in obj)) return obj||{}; const {[key]:_,...rest}=obj; return rest }
  const renameObjKey = (obj,oldK,newK)=>{ if(!obj||!(oldK in obj)) return obj||{}; const {[oldK]:val,...rest}=obj; return {...rest,[newK]:val} }

  const deptUsage = useCallback(name=>{
    const staff = num=>Number.isFinite(+num)?+num:0
    return {
      staff: staff(deptStaff?.[name]?.total),
      projects: projects.filter(p=>(p.depts||[]).includes(name)).length,
      users: ALL_USERS.filter(u=>u.dept===name).map(u=>u.name),
    }
  },[deptStaff,projects])

  const addDept = useCallback((name,color,finance)=>{
    name = (name||"").trim()
    if(!name) return {ok:false,msg:"본부명을 입력하세요."}
    if(STAFF_DEPTS.includes(name)) return {ok:false,msg:"이미 존재하는 본부명입니다."}
    persistDepartments([...departments,{name,color:color||DEPT_COLOR_POOL[departments.length%DEPT_COLOR_POOL.length],finance:!!finance}])
    setDeptStaff(prev=>({...prev,[name]:{...DEPT_STAFF_EMPTY}}))
    setStaffTarget(prev=>({...prev,[name]:Object.fromEntries((years||[]).map(y=>[y.yr,0]))}))
    setStaffMonthly(prev=>({...prev,[name]:Object.fromEntries((years||[]).map(y=>[y.yr,Array(12).fill(0)]))}))
    if(finance){
      setDeptBiz(prev=>({...prev,[name]:{...DEPT_BIZ_EMPTY}}))
      setPnlData(prev=>prev.map(r=>({...r,byDept:{...r.byDept,[name]:{rev:0,sal:0,sub:0}}})))
      setCashflow(prev=>prev.map(m=>({...m,byDept:{...m.byDept,[name]:0}})))
    }
    return {ok:true}
  },[departments,STAFF_DEPTS,years])

  const renameDept = useCallback((oldName,newName)=>{
    newName = (newName||"").trim()
    if(!newName) return {ok:false,msg:"본부명을 입력하세요."}
    if(oldName===newName) return {ok:true}
    if(STAFF_DEPTS.includes(newName)) return {ok:false,msg:"이미 존재하는 본부명입니다."}
    persistDepartments(departments.map(d=>d.name===oldName?{...d,name:newName}:d))
    setDeptStaff(prev=>renameObjKey(prev,oldName,newName))
    setStaffTarget(prev=>renameObjKey(prev,oldName,newName))
    setStaffMonthly(prev=>renameObjKey(prev,oldName,newName))
    setDeptBiz(prev=>renameObjKey(prev,oldName,newName))
    setPnlData(prev=>prev.map(r=>({...r,byDept:renameObjKey(r.byDept,oldName,newName)})))
    setCashflow(prev=>prev.map(m=>({...m,byDept:renameObjKey(m.byDept,oldName,newName)})))
    setProjects(prev=>prev.map(p=>({...p,depts:(p.depts||[]).map(d=>d===oldName?newName:d)})))
    return {ok:true}
  },[departments,STAFF_DEPTS])

  const deleteDept = useCallback(name=>{
    if(STAFF_DEPTS.length<=1) return {ok:false,msg:"최소 1개 본부는 필요합니다."}
    persistDepartments(departments.filter(d=>d.name!==name))
    setDeptStaff(prev=>omitKey(prev,name))
    setStaffTarget(prev=>omitKey(prev,name))
    setStaffMonthly(prev=>omitKey(prev,name))
    setDeptBiz(prev=>omitKey(prev,name))
    setPnlData(prev=>prev.map(r=>({...r,byDept:omitKey(r.byDept,name)})))
    setCashflow(prev=>prev.map(m=>({...m,byDept:omitKey(m.byDept,name)})))
    setProjects(prev=>prev.map(p=>({...p,depts:(p.depts||[]).filter(d=>d!==name)})))
    return {ok:true}
  },[departments,STAFF_DEPTS])

  const setDeptColor = (name,color)=>persistDepartments(departments.map(d=>d.name===name?{...d,color}:d))
  const setDeptFinance = (name,finance)=>{
    persistDepartments(departments.map(d=>d.name===name?{...d,finance}:d))
    if(finance){
      setDeptBiz(prev=>prev[name]?prev:{...prev,[name]:{...DEPT_BIZ_EMPTY}})
      setPnlData(prev=>prev.map(r=>r.byDept?.[name]?r:{...r,byDept:{...r.byDept,[name]:{rev:0,sal:0,sub:0}}}))
      setCashflow(prev=>prev.map(m=>m.byDept?.[name]!=null?m:{...m,byDept:{...m.byDept,[name]:0}}))
    }
  }
  // departments(영속)에는 있지만 deptBiz(영속)에는 없는 본부가 있을 수 있음
  // (예: 이전 버전에서 본부 추가/이름변경 후 deptBiz가 갱신되지 않은 채 저장된 경우).
  // 화면 렌더링이 깨지지 않도록 누락된 본부는 빈 값으로 채워 항상 안전한 객체를 제공한다.
  const safeDeptBiz = useMemo(()=>{
    const out = {...deptBiz}
    DEPTS.forEach(d=>{ if(!out[d]) out[d] = {...DEPT_BIZ_EMPTY} })
    return out
  },[deptBiz,DEPTS])

  const deptCtx = {departments,DEPTS,STAFF_DEPTS,DEPT_COLORS,DEPT_BIZ:safeDeptBiz,
    isAdmin:currentUser?.role==="admin",addDept,renameDept,deleteDept,setDeptColor,setDeptFinance,deptUsage,
    contractTypes, setContractTypes,
    projTypes, setProjTypes,
    bidTypes, setBidTypes,
  }

  // ── 프로젝트별 월수금계획(cashflowPlan) → 본부별/연도별 합산 ──
  // cashflowPlan: [{year,month(1-12),plan,actual}] (단위 억원), 지분율(deptShares)로 본부에 배분
  const projectCashflowByDept = useMemo(()=>{
    const out = {} // {year: {dept: [plan12], actualByDept:{dept:[actual12]}}}
    projects.forEach(p=>{
      const shares = getDeptShares(p)
      ;(p.cashflowPlan||[]).forEach(e=>{
        const y = String(e.year), mi = (e.month||1)-1
        if(mi<0||mi>11) return
        if(!out[y]) out[y] = {plan:{}, actual:{}}
        shares.forEach(s=>{
          if(!out[y].plan[s.dept])   out[y].plan[s.dept]   = Array(12).fill(0)
          if(!out[y].actual[s.dept]) out[y].actual[s.dept] = Array(12).fill(0)
          out[y].plan[s.dept][mi]   += (num(e.plan)||0)*(s.share/100)
          out[y].actual[s.dept][mi] += (num(e.actual)||0)*(s.share/100)
        })
      })
    })
    return out
  },[projects])

  // 2026년 cashflow.byDept를 프로젝트 합산값으로 보강(프로젝트 데이터 없으면 기존 수동입력 유지)
  const effectiveCashflow = useMemo(()=>{
    const planByDept = projectCashflowByDept["2026"]?.plan || {}
    return cashflow.map((m,i)=>{
      const byDept = {...m.byDept}
      DEPTS.forEach(d=>{ const v=planByDept[d]?.[i]||0; if(v>0) byDept[d]=+v.toFixed(2) })
      return {...m, byDept}
    })
  },[cashflow,projectCashflowByDept,DEPTS])

  const [alerts, setAlerts]       = useState(ALERTS_INIT)
  const [showAlerts, setShowAlerts] = useState(false)
  const [selProjId, setSelProjId] = useState(null)
  const [selVerIdx, setSelVerIdx] = useState(0)
  const [cmpIds, setCmpIds]       = useState([])
  const [showNewProj, setShowNewProj] = useState(false)
  // const [showAI, setShowAI] = useState(false)  // AI 기능 추후 활성화
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
          setProjects(prev=>[...prev,normalizeProject({id:`P${Date.now()}`,year:String(r1[5]?.[1]||""),code,name:pname,depts:String(r1[5]?.[4]||"").split(",").map(s=>s.trim()).filter(Boolean),pm:String(r1[5]?.[5]||""),director:String(r1[5]?.[6]||""),projType:String(r1[5]?.[3]||""),usage:"",scale:"",siteArea,buildArea:null,floorArea,units:parseInt(r1[7]?.[4])||0,client:String(r1[7]?.[0]||""),clientPm:String(r1[7]?.[1]||""),totalFee:parseInt(r1[9]?.[0])||0,shareRatio:(parseFloat(r1[9]?.[1])||100)/100,serviceFee:parseInt(r1[9]?.[2])||0,address:String(r1[7]?.[5]||""),contractDate:String(r1[11]?.[0]||""),orderDate:String(r1[11]?.[1]||""),note:"",type:"계약",prog:0,acc:0,rev26:0,versions:[newVer]})])
          setUploadMsg(`✓ 신규 프로젝트 등록: ${pname}`)
        }
      }catch(err){setUploadMsg("⚠ 오류: "+err.message)}
      e.target.value=""
    }
    reader.readAsArrayBuffer(file)
  },[projects])

  // 엑셀 양식 다운로드 (업로드 파서가 읽는 행 위치와 정확히 일치)
  const downloadTemplate = useCallback(()=>{
    const ws1 = XLSX.utils.aoa_to_sheet([
      ["■ 프로젝트정보 입력 양식 (상지서울건축사사무소)"],
      ["행 번호/형식을 변경하지 마세요. 파란 음영 행에만 값을 입력한 뒤 저장하세요."],
      ["프로젝트코드는 영문/숫자 조합, 담당본부는 정확한 본부명을 콤마(,)로 구분해 입력합니다."],
      [],
      ["프로젝트코드","연도","프로젝트명","유형","담당본부(콤마구분)","PM","담당임원"],
      ["E26999-SAMPLE","2026","○○현장 신축공사 실시설계 용역","공동주택","설계1본부","홍길동","홍길동 이사"],
      ["발주처","발주처담당자","","","세대수","주소"],
      ["○○공사","김담당","","",500,"서울특별시 ○○구 ○○로 123"],
      ["총용역비(원,VAT별도)","상지 지분율(%)","상지 용역비(원,VAT별도)","대지면적(㎡)","","연면적(㎡)"],
      [500000000,100,500000000,10000,"",30000],
      ["계약일(YYYY-MM-DD)","수주일(YYYY-MM-DD, 계약금10%수령일)"],
      ["2026-01-01","2026-01-15"],
    ])
    ws1["!cols"]=[{wch:18},{wch:18},{wch:30},{wch:14},{wch:20},{wch:12},{wch:14}]

    const ws2 = XLSX.utils.aoa_to_sheet([
      ["■ 협력업체 비용 입력 양식"],
      ["프로젝트코드는 시트1의 프로젝트코드와 정확히 일치해야 합니다. 5행부터 여러 업체를 추가할 수 있습니다."],
      [],
      ["프로젝트코드","공종","업체명","계약금액(원)","NEGO1(원)","NEGO2(원)"],
      ["E26999-SAMPLE","구조","○○구조엔지니어링",30000000,"",""],
      ["E26999-SAMPLE","기계설비","○○설비",25000000,"",""],
    ])
    ws2["!cols"]=[{wch:18},{wch:14},{wch:22},{wch:14},{wch:14},{wch:14}]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws1,"프로젝트정보")
    XLSX.utils.book_append_sheet(wb,ws2,"협력업체비용")
    XLSX.writeFile(wb,"상지서울_프로젝트입력양식.xlsx")
  },[])

  // ── 실행계획서 보고서 Word(.docx) 다운로드 ──────────────────
  const downloadReport = useCallback((proj)=>{
    const ver = proj.versions?.[proj.versions.length-1]
    const vendors = ver?.vendors || []
    const toPy = m => m>0 ? `${(m/3.3058).toFixed(1)}평` : "-"
    const fW2 = n => n>0 ? n.toLocaleString()+"원" : "-"
    const fP2 = (n,t) => t>0 ? (n/t*100).toFixed(2)+"%" : "-"
    const W2 = 9360
    const NAVY2="1E3F6E", NAVYL2="D6E4F0", GRAY2="F2F2F2", WHITE2="FFFFFF"
    const BD = {style:BorderStyle.SINGLE,size:6,color:"999999"}
    const BDS = {top:BD,bottom:BD,left:BD,right:BD}
    const mkCell = (text,opts={})=>new DocxTableCell({
      borders:BDS, verticalAlign:DocxVAlign.CENTER,
      margins:{top:80,bottom:80,left:120,right:120},
      shading:opts.shade?{fill:opts.shade,type:ShadingType.CLEAR}:undefined,
      width:opts.w?{size:opts.w,type:WidthType.DXA}:undefined,
      rowSpan:opts.rs, columnSpan:opts.cs,
      children:[new DocxParagraph({
        alignment:opts.align||DocxAlign.CENTER,
        children:[new TextRun({text:String(text??"-"),font:"맑은 고딕",size:opts.sz||18,bold:!!opts.bold,color:opts.color||"000000"})]
      })]
    })
    const hC=(t,o={})=>mkCell(t,{shade:NAVY2,color:WHITE2,bold:true,...o})
    const gC=(t,o={})=>mkCell(t,{shade:GRAY2,bold:true,...o})
    const sC=(t,o={})=>mkCell(t,{shade:NAVYL2,bold:true,...o})
    const p2=(t,o={})=>new DocxParagraph({
      spacing:{before:o.before||0,after:o.after||120},
      alignment:o.align||DocxAlign.LEFT,
      children:[new TextRun({text:String(t||""),font:"맑은 고딕",size:o.sz||19,bold:!!o.bold,color:o.color||"000000"})]
    })
    const g1 = vendors.filter(v=>v.cat&&["구조","토목","기계","전기","견적","조경","CG","건축외주","친환경","설계"].some(k=>v.cat.includes(k)))
    const g2 = vendors.filter(v=>!g1.includes(v))
    const g1t = g1.reduce((s,v)=>s+(v.nego2||v.nego1||v.contract||0),0)
    const g2t = g2.reduce((s,v)=>s+(v.nego2||v.nego1||v.contract||0),0)
    const tot = g1t+g2t
    const sf  = proj.serviceFee||0
    const round = ver?.round || proj.versions?.length || 1
    const children2 = [
      new DocxParagraph({alignment:DocxAlign.CENTER,spacing:{before:240,after:120},children:[new TextRun({text:"실 행 계 획 서 보 고",font:"맑은 고딕",size:36,bold:true,color:NAVY2})]}),
      new DocxParagraph({alignment:DocxAlign.CENTER,spacing:{before:0,after:360},children:[new TextRun({text:`(${round}차 변경)`,font:"맑은 고딕",size:21,color:"555555"})]}),
      p2("■ 기본정보",{bold:true,sz:21,color:NAVY2,before:120,after:60}),
      new DocxTable({width:{size:W2,type:WidthType.DXA},columnWidths:[2200,7160],rows:[
        new DocxTableRow({children:[gC("프로젝트명",{w:2200}),mkCell(proj.name,{w:7160,align:DocxAlign.LEFT})]}),
        new DocxTableRow({children:[gC("담당PM",{w:2200}),mkCell(proj.pm||"-",{w:7160})]}),
        new DocxTableRow({children:[gC("발주처",{w:2200}),mkCell(proj.client||"-",{w:7160,align:DocxAlign.LEFT})]}),
        new DocxTableRow({children:[gC("대지위치",{w:2200}),mkCell(proj.address||"-",{w:7160,align:DocxAlign.LEFT})]}),
      ]}),
      p2(""),
      p2("1. 과업내용",{bold:true,sz:21,color:NAVY2,before:200,after:60}),
      p2("(단위 : 원 / VAT별도)",{sz:16,color:"666666",align:DocxAlign.RIGHT}),
      new DocxTable({width:{size:W2,type:WidthType.DXA},columnWidths:[2200,5460,1700],rows:[
        new DocxTableRow({children:[hC("구 분",{w:2200}),hC("내 용",{w:5460}),hC("비고",{w:1700})]}),
        new DocxTableRow({children:[gC("용역금액",{w:2200}),mkCell(`₩${sf.toLocaleString()}원 (VAT별도)`,{w:5460,align:DocxAlign.LEFT}),mkCell("",{w:1700})]}),
        new DocxTableRow({children:[gC("실행금액",{w:2200}),mkCell(`₩${sf.toLocaleString()}원 (VAT별도)`,{w:5460,align:DocxAlign.LEFT}),mkCell("",{w:1700})]}),
        new DocxTableRow({children:[gC("대지면적",{w:2200}),mkCell(`${(proj.siteArea||0).toLocaleString()}㎡  (${toPy(proj.siteArea||0)})`,{w:5460}),mkCell("",{w:1700})]}),
        new DocxTableRow({children:[gC("연면적",{w:2200}),mkCell(`${(proj.floorArea||0).toLocaleString()}㎡  (${toPy(proj.floorArea||0)})`,{w:5460}),mkCell("",{w:1700})]}),
        new DocxTableRow({children:[gC("규모 및 용도",{w:2200}),mkCell(`${proj.scale||"-"} / ${proj.usage||"-"}`,{w:5460}),mkCell("",{w:1700})]}),
      ]}),
      p2(""),
      p2("2. 계약금 대비 협력업체 외주금액 및 비율",{bold:true,sz:21,color:NAVY2,before:200,after:60}),
      new DocxTable({width:{size:W2,type:WidthType.DXA},columnWidths:[2500,4260,1600,960],rows:[
        new DocxTableRow({children:[hC("구 분",{w:2500}),hC("금 액",{w:4260}),hC("비 율",{w:1600}),hC("비 고",{w:960})]}),
        new DocxTableRow({children:[gC(`외주비 (변경전)`,{w:2500}),mkCell(fW2(tot),{w:4260}),mkCell(fP2(tot,sf),{w:1600}),mkCell("",{w:960})]}),
        new DocxTableRow({children:[gC(`외주비 (${round}차변경)`,{w:2500}),mkCell(fW2(tot),{w:4260}),mkCell(fP2(tot,sf),{w:1600}),mkCell("",{w:960})]}),
      ]}),
      new DocxParagraph({children:[],pageBreakBefore:true}),
      p2("【첨부 1】 협력업체 선정 및 용역비 현황",{bold:true,sz:22,color:NAVY2,before:0,after:80}),
      p2("(단위 : 원 / VAT별도)",{sz:16,color:"666666",align:DocxAlign.RIGHT}),
      new DocxTable({width:{size:W2,type:WidthType.DXA},columnWidths:[480,1500,2580,1500,600,1600,600,500],rows:[
        new DocxTableRow({children:[hC("구분",{w:480}),hC("분야",{w:1500}),hC("업체명",{w:2580}),hC("변경전 금액",{w:1500}),hC("비율",{w:600}),hC(`${round}차변경 금액`,{w:1600}),hC("비율",{w:600}),hC("비고",{w:500})]}),
        ...g1.map((v,i)=>new DocxTableRow({children:[
          ...(i===0?[sC("외\n주\n비\n1",{w:480,rs:g1.length+1})]:[]),
          mkCell(v.cat,{w:1500}),mkCell(v.name,{w:2580,align:DocxAlign.LEFT}),
          mkCell(v.contract>0?v.contract.toLocaleString():"-",{w:1500}),mkCell(fP2(v.contract,sf),{w:600}),
          mkCell((v.nego2||v.nego1||v.contract||0).toLocaleString(),{w:1600}),mkCell(fP2(v.nego2||v.nego1||v.contract||0,sf),{w:600}),
          mkCell(v.nego2||v.nego1?v.nego2?"2차NEGO":"1차NEGO":"",{w:500}),
        ]})),
        new DocxTableRow({children:[gC("외주비 1 소계",{w:1500+2580,cs:2}),gC(fW2(g1t),{w:1500}),gC(fP2(g1t,sf),{w:600}),gC(fW2(g1t),{w:1600}),gC(fP2(g1t,sf),{w:600}),mkCell("",{w:500})]}),
        ...g2.map((v,i)=>new DocxTableRow({children:[
          ...(i===0?[sC("외\n주\n비\n2",{w:480,rs:g2.length+1})]:[]),
          mkCell(v.cat,{w:1500}),mkCell(v.name,{w:2580,align:DocxAlign.LEFT}),
          mkCell(v.contract>0?v.contract.toLocaleString():"-",{w:1500}),mkCell(fP2(v.contract,sf),{w:600}),
          mkCell((v.nego2||v.nego1||v.contract||0).toLocaleString(),{w:1600}),mkCell(fP2(v.nego2||v.nego1||v.contract||0,sf),{w:600}),
          mkCell(v.nego2||v.nego1?v.nego2?"2차NEGO":"1차NEGO":"",{w:500}),
        ]})),
        ...(g2.length>0?[new DocxTableRow({children:[gC("외주비 2 소계",{w:1500+2580,cs:2}),gC(fW2(g2t),{w:1500}),gC(fP2(g2t,sf),{w:600}),gC(fW2(g2t),{w:1600}),gC(fP2(g2t,sf),{w:600}),mkCell("",{w:500})]})]:[]),
        new DocxTableRow({children:[hC("외주비 합계",{w:480+1500+2580,cs:3}),hC(fW2(tot),{w:1500}),hC(fP2(tot,sf),{w:600}),hC(fW2(tot),{w:1600}),hC(fP2(tot,sf),{w:600}),hC("",{w:500})]}),
      ]}),
      p2(""),
      new DocxParagraph({alignment:DocxAlign.RIGHT,spacing:{before:360,after:0},children:[new TextRun({text:"(주)상지서울건축사사무소  대표이사",font:"맑은 고딕",size:19})]}),
    ]
    const doc2 = new DocxDocument({
      styles:{default:{document:{run:{font:"맑은 고딕",size:19}}}},
      sections:[{
        properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134}}},
        headers:{default:new DocxHeader({children:[new DocxParagraph({alignment:DocxAlign.RIGHT,border:{bottom:{style:BorderStyle.SINGLE,size:4,color:"BBBBBB",space:1}},spacing:{after:80},children:[new TextRun({text:"상지서울건축사사무소  실행계획서 보고",font:"맑은 고딕",size:15,color:"888888"})]})]}),},
        footers:{default:new DocxFooter({children:[new DocxParagraph({alignment:DocxAlign.CENTER,border:{top:{style:BorderStyle.SINGLE,size:4,color:"BBBBBB",space:1}},children:[new TextRun({text:"- ",font:"맑은 고딕",size:15,color:"888888"}),new TextRun({children:[PageNumber.CURRENT],font:"맑은 고딕",size:15,color:"888888"}),new TextRun({text:" -",font:"맑은 고딕",size:15,color:"888888"})]})]}),},
        children:children2,
      }]
    })
    Packer.toBlob(doc2).then(blob=>{
      const url=URL.createObjectURL(blob)
      const a=document.createElement("a"); a.href=url
      a.download=`실행계획서_보고서_${proj.code||proj.name}_${round}차.docx`
      a.click(); URL.revokeObjectURL(url)
    })
  },[])


  if (!initDone || !dbReady) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--color-background-tertiary,#f5f5f3)"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:40,height:40,border:`3px solid ${C.navyM}`,borderTop:"3px solid transparent",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 14px"}}/>
        <div style={{fontSize:14,fontWeight:600,color:C.navyM,marginBottom:4}}>
          {!initDone ? "시스템 초기화 중…" : dbStatus==="connecting" ? "데이터베이스 연결 중…" : "데이터 불러오는 중…"}
        </div>
        <div style={{fontSize:12,color:C.gray}}>
          {USE_DB ? "Supabase DB에서 데이터를 불러옵니다." : "localStorage에서 데이터를 불러옵니다."}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  if (auth==="login") return <LoginScreen {...{loginId,setLoginId,loginPw,setLoginPw,loginError,doLogin,pwVisible,setPwVisible}}/>

  const TABS = [
    {id:"analysis",  label:"📊 경영분석"},
    {id:"datahub",   label:"🗄️ 데이터관리"},
    {id:"cashflow",  label:"💧 월수금계획"},
    {id:"projects",  label:"🏗 프로젝트"},
    {id:"vendors",   label:"🤝 협력업체"},
    {id:"contract",  label:"📄 계약서"},
    {id:"history",   label:"📜 프로젝트 히스토리"},
    {id:"calendar",  label:"📅 일정 캘린더"},
    {id:"pnl",       label:"📉 손익분석"},
    {id:"optimize",  label:"⚙️ 경영최적화"},
    {id:"archive",   label:"📁 아카이브"},
    {id:"manual",    label:"📚 업무매뉴얼"},
    {id:"auth_mgmt", label:"🔐 권한관리"},
  ]

  return (
    <DeptContext.Provider value={deptCtx}>
    <div style={{fontFamily:"'Apple SD Gothic Neo','Pretendard','Noto Sans KR',sans-serif",fontSize:15,color:"#111827",background:"#F8FAFC",minHeight:"100vh"}}>

      {/* ── 사이드바 레이아웃 ── */}
      <div style={{display:"flex",minHeight:"100vh"}}>

      {/* ── 사이드바 ── */}
      <div style={{width:220,flexShrink:0,background:"#fff",borderRight:"1px solid #E5E7EB",display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:100}}>
        {/* 로고 */}
        <div onClick={()=>setTab("analysis")} style={{padding:"22px 20px 18px",cursor:"pointer",borderBottom:"1px solid #F3F4F6"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:38,height:38,background:"linear-gradient(135deg,#3B72F6,#1A3B6E)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📐</div>
            <div>
              <div style={{fontSize:13.5,fontWeight:800,color:"#111827",letterSpacing:"-0.03em",lineHeight:1.2}}>상지서울</div>
              <div style={{fontSize:11,color:"#6B7280",fontWeight:500,lineHeight:1.2}}>통합경영시스템</div>
            </div>
          </div>
        </div>

        {/* 퀵액션 버튼들 */}
        <div style={{padding:"14px 12px",borderBottom:"1px solid #F3F4F6"}}>
          <button onClick={()=>setShowNewProj(true)} style={{...S.btn(C.navyM),width:"100%",justifyContent:"center",padding:"10px",fontSize:13.5,borderRadius:10,marginBottom:6}}>
            <i className="ti ti-plus" aria-hidden="true"/> 프로젝트 개설
          </button>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
            <button onClick={()=>uploadRef.current?.click()} style={{...S.btn(C.grayL,"#374151"),padding:"7px 6px",fontSize:12,borderRadius:8,justifyContent:"center"}}>
              <i className="ti ti-upload" style={{fontSize:12}}/> 업로드
            </button>
            <button onClick={downloadTemplate} style={{...S.btn(C.grayL,"#374151"),padding:"7px 6px",fontSize:12,borderRadius:8,justifyContent:"center"}}>
              <i className="ti ti-file-download" style={{fontSize:12}}/> 양식
            </button>
          </div>
          <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleUpload}/>
          {uploadMsg&&<div style={{marginTop:6,fontSize:11.5,color:uploadMsg.startsWith("✓")?"#0EA86E":C.red,padding:"5px 8px",background:uploadMsg.startsWith("✓")?"#E6F9F2":"#FEE2E2",borderRadius:7}}>{uploadMsg}</div>}
        </div>

        {/* 네비게이션 */}
        <nav style={{flex:1,padding:"10px 10px",overflowY:"auto"}}>
          {TABS.filter(t=>t.id!=="auth_mgmt"||currentUser.role==="admin").map(t=>{
            const active = tab===t.id
            const isHot = t.id==="datahub"
            return (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                width:"100%",textAlign:"left",padding:"10px 14px",border:"none",borderRadius:10,
                marginBottom:2,cursor:"pointer",fontSize:14,fontWeight:active?700:500,
                background:active?"#EEF3FF":"transparent",
                color:active?C.navyM:isHot?C.amber:"#374151",
                display:"flex",alignItems:"center",gap:8,transition:"all .15s"
              }}>
                {t.label}
                {isHot&&!active&&<span style={{marginLeft:"auto",fontSize:10,background:C.amberL,color:C.amber,padding:"1px 6px",borderRadius:10,fontWeight:700}}>HOT</span>}
              </button>
            )
          })}
        </nav>

        {/* 하단 사용자 영역 */}
        <div style={{padding:"14px 12px",borderTop:"1px solid #F3F4F6"}}>
          {/* DB 상태 */}
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,padding:"6px 10px",background:"#F8FAFC",borderRadius:8,border:"1px solid #E5E7EB"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:dbStatus==="ok"?"#0EA86E":dbStatus==="error"?"#EF4444":"#F59E0B",flexShrink:0}}/>
            <span style={{fontSize:12,color:"#6B7280",fontWeight:600}}>
              {dbStatus==="ok"?"DB 연결됨":dbStatus==="error"?"DB 오류":dbStatus==="local"?"로컬 저장":"연결 중…"}
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#3B72F6,#1A3B6E)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",flexShrink:0}}>
              {currentUser.avatar}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,color:"#111827",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser.name}</div>
              <div style={{fontSize:11,color:"#6B7280"}}>{ROLE_BADGE[currentUser.role]?.label}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,marginTop:10}}>
            <button onClick={()=>setShowAlerts(o=>!o)} style={{...S.btn(C.grayL,"#374151"),flex:1,justifyContent:"center",padding:"7px",position:"relative",borderRadius:8}}>
              <i className="ti ti-bell" aria-label="알람" style={{fontSize:15}}/>
              {unread>0&&<span style={{position:"absolute",top:2,right:8,minWidth:16,height:16,background:C.red,borderRadius:8,fontSize:10,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{unread}</span>}
            </button>
            <button onClick={doLogout} style={{...S.btn(C.grayL,"#374151"),flex:1,justifyContent:"center",padding:"7px",borderRadius:8,fontSize:12}}>로그아웃</button>
          </div>
          {showAlerts&&<AlertPanel {...{alerts,readAlert,readAll,setTab,setShowAlerts}}/>}
        </div>
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <div style={{marginLeft:220,flex:1,minWidth:0}}>
        {/* 탑바 */}
        <div style={{background:"#fff",borderBottom:"1px solid #E5E7EB",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:90}}>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:"#111827",letterSpacing:"-0.03em"}}>
              {TABS.find(t=>t.id===tab)?.label || "대시보드"}
            </div>
            <div style={{fontSize:12,color:"#6B7280",marginTop:1}}>기준 2026-06-09 · 5월 누계 · 억원(수주:VAT별도 / 매출·지출:VAT포함)</div>
          </div>
        </div>

        {/* 바디 */}
        <div style={{padding:"20px 24px",maxWidth:1440}}>

        {tab==="analysis" && <AnalysisTab deptStaff={deptStaff} setDeptStaff={setDeptStaff} years={years} setYears={setYears} canWrite={canWrite} cashflow={effectiveCashflow}/>}
        {tab==="datahub" && <DataHubTab currentUser={currentUser} deptStaff={deptStaff} setDeptStaff={setDeptStaff} staffTarget={staffTarget} setStaffTarget={setStaffTarget} staffMonthly={staffMonthly} setStaffMonthly={setStaffMonthly} pnlData={pnlData} setPnlData={setPnlData} cashflow={cashflow} setCashflow={setCashflow} years={years} setYears={setYears} projects={projects} setProjects={setProjects} setTab={setTab} setSelProjId={setSelProjId} setSelVerIdx={setSelVerIdx} setShowNewProj={setShowNewProj} versions={versions} saveVersion={saveVersion} restoreVersion={restoreVersion} deleteVersion={deleteVersion} contractTypes={contractTypes} setContractTypes={setContractTypes} projTypes={projTypes} setProjTypes={setProjTypes} bidTypes={bidTypes} setBidTypes={setBidTypes} allData={null} restoreAllData={(entries)=>dbSetAll(entries, userEmail.current)} dbStatus={dbStatus}/>}
        {tab==="cashflow" && <CashflowTab cashflow={effectiveCashflow} setCashflow={setCashflow} currentUser={currentUser} projects={projects} projectCashflowByDept={projectCashflowByDept}/>}
        {tab==="projects" && <ProjectsTab projects={projects} setProjects={setProjects} selProjId={selProjId} setSelProjId={setSelProjId} selVerIdx={selVerIdx} setSelVerIdx={setSelVerIdx} cmpIds={cmpIds} setCmpIds={setCmpIds} showNewVer={showNewVer} setShowNewVer={setShowNewVer} canWrite={canWrite} contractTypes={contractTypes}/>}
        {tab==="vendors" && <VendorsTab projects={projects} setProjects={setProjects} vendorsDB={vendorsDB} setVendorsDB={setVendorsDB} vendorPayments={vendorPayments} setVendorPayments={setVendorPayments} canWrite={canWrite} currentUser={currentUser} setTab={setTab} setSelProjId={setSelProjId} setSelVerIdx={setSelVerIdx}/>}
        {tab==="pnl"      && <PnlTab pnlData={pnlData} setPnlData={setPnlData} canWrite={canWrite}/>}
        {tab==="optimize" && <OptimizeTab projects={projects} deptStaff={deptStaff} pnlData={pnlData}/>}
        {tab==="archive"   && <ArchiveTab currentUser={currentUser} projects={projects}/>}
        {tab==="contract"  && <ContractTab projects={projects} currentUser={currentUser}/>}
        {tab==="history"   && <ProjectHistoryPage projects={projects} currentUser={currentUser}/>}
        {tab==="calendar"  && <ProjectCalendarPage projects={projects}/>}
        {tab==="manual"    && <ManualTab currentUser={currentUser}/>}
        {tab==="auth_mgmt"&& currentUser.role==="admin" && <AuthTab users={users} saveUsers={saveUsers} currentUser={currentUser} hashPw={hashPw}/>}
        </div>
      </div>
      </div>

      {showNewProj&&<NewProjModal onClose={()=>setShowNewProj(false)} onSave={p=>{setProjects(prev=>[...prev,normalizeProject({...p,id:`P${Date.now()}`,versions:[]})]);setShowNewProj(false)}}/>}

      {/* AI 어시스턴트: ANTHROPIC_API_KEY 설정 후 AIAssistant.jsx 활성화 */}
    </div>
    </DeptContext.Provider>
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
          <input type="email" value={loginId} onChange={e=>setLoginId(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} placeholder="이메일 주소" style={S.inp()}/>
          <div style={{fontSize:11,color:C.gray,marginTop:5}}>접근 가능한 구글계정으로 로그인해주세요</div>
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
        <div style={{marginTop:16,fontSize:11,color:C.gray,textAlign:"center"}}>계정 문의는 관리자에게 요청하세요.</div>
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
function AnalysisTab({deptStaff,setDeptStaff,years,setYears,canWrite,cashflow}) {
  const {DEPTS,DEPT_COLORS,DEPT_BIZ} = useDepts()
  const [view, setView]     = useState("total")  // total | dept
  const [selDept, setSelDept] = useState(()=>DEPTS[0]||"")
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
              {l:"예상기성(연간)",v:fE(cashflow.reduce((s,d)=>s+d.cash+d.note,0)), s:"현금+어음", c:C.navyM, acc:C.navyM},
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
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={deptBarData} barGap={6} barCategoryGap="20%" margin={{top:22,right:6,left:-12,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                    <XAxis dataKey="name" tick={{fontSize:11}} tickLine={false}/>
                    <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
                    <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억`,n]}/>
                    <Bar dataKey="매출실행" name="매출" fill={C.green} opacity={.85} radius={[3,3,0,0]} barSize={32}>
                      <LabelList dataKey="매출실행" position="top" {...lbl(C.green)}/>
                    </Bar>
                    <Bar dataKey="지출" name="지출" fill={C.red} opacity={.75} radius={[3,3,0,0]} barSize={32}>
                      <LabelList dataKey="지출" position="top" {...lbl(C.red)}/>
                    </Bar>
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
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={DEPTS.map(d=>{
                  const db=DEPT_BIZ[d], st=deptStaff[d]||{total:1}
                  return {name:d.replace("본부","").slice(0,4), 인당수주:+((db.orderDone+db.orderConfirmed)/st.total).toFixed(2), 인당매출:+(db.revCum/st.total).toFixed(2)}
                })} barGap={6} barCategoryGap="20%" margin={{top:22,right:6,left:-12,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                  <XAxis dataKey="name" tick={{fontSize:11}} tickLine={false}/>
                  <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
                  <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억/인`,n]}/>
                  <Bar dataKey="인당수주" name="인당수주" fill={C.navyM} radius={[3,3,0,0]} barSize={32}>
                    <LabelList dataKey="인당수주" position="top" {...lbl(C.navyM)}/>
                  </Bar>
                  <Bar dataKey="인당매출" name="인당매출" fill={C.amber} radius={[3,3,0,0]} barSize={32}>
                    <LabelList dataKey="인당매출" position="top" {...lbl(C.amber)}/>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* 3개년 추이 */}
          {years.length>0 && <Card title="연도별 수주·매출 추이" note={`${years[0].yr}~${years[years.length-1].yr} · VAT별도(수주) / VAT포함(매출)`}>
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
              {canWrite&&<button onClick={()=>setShowAddYear(true)} style={{...S.btn(C.green),padding:"5px 11px",fontSize:11}}>+ 연도 추가</button>}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={yearLine} barGap={8} barCategoryGap="20%" margin={{top:26,right:10,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                <XAxis dataKey="name" tick={{fontSize:13,fontWeight:600}}/>
                <YAxis tick={{fontSize:11}} tickFormatter={v=>v+"억"}/>
                <Tooltip formatter={(v,n)=>[`${(+v).toFixed(2)}억`,n]}/>
                <Bar dataKey="수주" fill={C.navyM} opacity={.8} radius={[5,5,0,0]} barSize={62}>
                  <LabelList dataKey="수주" position="top" {...lbl(C.navyM,2,12)}/>
                </Bar>
                <Bar dataKey="매출" fill={C.amber} opacity={.75} radius={[5,5,0,0]} barSize={62}>
                  <LabelList dataKey="매출" position="top" {...lbl(C.amber,2,12)}/>
                </Bar>
                <Line type="monotone" dataKey="인원" yAxisId="right" stroke={C.gray} strokeDasharray="5 3" strokeWidth={1.5} dot={{r:3}}>
                  <LabelList dataKey="인원" position="top" {...lbl(C.gray,1,11,"명")}/>
                </Line>
                <YAxis yAxisId="right" orientation="right" tick={{fontSize:9}} tickFormatter={v=>v+"명"}/>
                <ReferenceLine yAxisId="right" y={0} stroke="none"/>
              </ComposedChart>
            </ResponsiveContainer>
          </Card>}

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
        const cfDept = cashflow.map(m=>({name:m.m, 기성:(m.byDept?.[selDept]||0)+( m.note||0)}))
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
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={cfDept} barCategoryGap="22%" margin={{top:22,right:6,left:-12,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                    <XAxis dataKey="name" tick={{fontSize:10}} tickFormatter={v=>v.replace("월","")}/>
                    <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
                    <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억`,n]}/>
                    <Bar dataKey="기성" fill={DEPT_COLORS[selDept]||C.navyM} radius={[4,4,0,0]} barSize={36}>
                      <LabelList dataKey="기성" position="top" {...lbl(DEPT_COLORS[selDept]||C.navyM,2,10)}/>
                    </Bar>
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

// 본부별 스택 + 합계를 함께 보여주는 툴팁
function StackTotalTooltip({active,payload,label}) {
  if(!active||!payload?.length) return null
  const total = payload.reduce((s,p)=>s+(Number(p.value)||0),0)
  return (
    <div style={{background:"var(--color-background-primary,#fff)",border:"1px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:10,padding:"11px 14px",fontSize:12.5,boxShadow:"0 4px 16px rgba(0,0,0,.12)",minWidth:150}}>
      <div style={{fontWeight:700,marginBottom:6,fontSize:13}}>{label}</div>
      {payload.slice().reverse().map(p=>(
        <div key={p.dataKey} style={{display:"flex",justifyContent:"space-between",gap:14,padding:"2px 0",color:p.color}}>
          <span>{p.name}</span><span style={{fontWeight:600}}>{(+p.value)>0?(+p.value).toFixed(2)+"억":"-"}</span>
        </div>
      ))}
      <div style={{display:"flex",justifyContent:"space-between",gap:14,marginTop:6,paddingTop:6,borderTop:"1px solid var(--color-border-tertiary,#eee)",fontWeight:800,fontSize:15,color:C.navy}}>
        <span>합계</span><span>{total.toFixed(2)}억</span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 월수금계획 탭
// ════════════════════════════════════════════════════════════
function CashflowTab({cashflow,setCashflow,currentUser,projects,projectCashflowByDept}) {
  const {DEPTS,DEPT_COLORS} = useDepts()
  const CF_2026 = cashflow
  const [view, setView] = useState("total")
  const [selDept, setSelDept] = useState(()=>DEPTS[0]||"")

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

      <ProjectCashflowSummaryCard projects={projects} projectCashflowByDept={projectCashflowByDept} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS}/>

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
              {DEPTS.map((d)=><span key={d} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:DEPT_COLORS[d]||C.navyM,flexShrink:0}}/>{d}</span>)}
              <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:C.amber}}/> 어음</span>
            </div>
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={CF_2026.map(m=>({name:m.m,...Object.fromEntries(DEPTS.map(d=>[d,+(m.byDept?.[d]||0).toFixed(2)])),어음:+m.note.toFixed(2),합계:+(m.cash+m.note).toFixed(2)}))} margin={{top:30,right:6,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                <XAxis dataKey="name" tick={{fontSize:11}} tickFormatter={v=>v.replace("월","")} tickLine={false}/>
                <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
                <Tooltip content={<StackTotalTooltip/>}/>
                {DEPTS.map((d,i)=><Bar key={d} dataKey={d} name={d} fill={DEPT_COLORS[d]||COLORS[i%COLORS.length]} stackId="s" barSize={22} radius={i===DEPTS.length-1?[3,3,0,0]:[0,0,0,0]}>
                  <LabelList dataKey={d} position="center" formatter={v=>v>=2?(+v).toFixed(1):""} style={{fontSize:9.5,fontWeight:700,fill:"#fff"}}/>
                </Bar>)}
                <Bar dataKey="어음" name="어음" fill={C.amber} stackId="s" barSize={22} radius={[3,3,0,0]}>
                  <LabelList dataKey="어음" position="center" formatter={v=>v>=2?(+v).toFixed(1):""} style={{fontSize:9.5,fontWeight:700,fill:"#fff"}}/>
                  <LabelList dataKey="합계" position="top" formatter={v=>`${(+v).toFixed(2)}억`} style={{fontSize:13,fontWeight:800,fill:C.navy}}/>
                </Bar>
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
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={deptCash} margin={{top:26,right:6,left:-10,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                  <XAxis dataKey="name" tick={{fontSize:13,fontWeight:600}} tickFormatter={v=>v.replace("월","")} tickLine={false}/>
                  <YAxis tick={{fontSize:11}} tickFormatter={v=>v+"억"}/>
                  <Tooltip formatter={(v,_)=>[`${v.toFixed(2)}억`,"기성수금"]}/>
                  <Bar dataKey="기성" fill={DEPT_COLORS[selDept]||C.navyM} radius={[5,5,0,0]} barSize={46}
                    label={{position:"top",fontSize:13,fontWeight:800,fill:DEPT_COLORS[selDept]||C.navyM,formatter:v=>v>0?v.toFixed(2):""}}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </>
        )
      })()}
    </div>
  )
}

// 전사 연도별 기성 현황 — 프로젝트별 월수금계획(cashflowPlan) 합산
function ProjectCashflowSummaryCard({projects,projectCashflowByDept,DEPTS,DEPT_COLORS}) {
  const years = useMemo(()=>Object.keys(projectCashflowByDept||{}).sort(),[projectCashflowByDept])
  if(years.length===0) return (
    <div style={{...S.card(),background:C.grayL,color:C.gray,fontSize:13}}>
      📅 연도별 기성 현황(프로젝트 합산) — 아직 입력된 프로젝트별 월수금계획이 없습니다. 프로젝트 상세 화면의 "연도별 월수금계획(기성)"에서 입력하면 본부별 합계와 함께 여기에 표시됩니다.
    </div>
  )
  let carry=0
  const rows = years.map(y=>{
    const planTotal = DEPTS.reduce((s,d)=>s+(projectCashflowByDept[y]?.plan?.[d]?.reduce((a,v)=>a+v,0)||0),0)
    const actualTotal = DEPTS.reduce((s,d)=>s+(projectCashflowByDept[y]?.actual?.[d]?.reduce((a,v)=>a+v,0)||0),0)
    const row={year:y,plan:planTotal,actual:actualTotal,carryIn:carry}
    carry += (planTotal-actualTotal)
    return row
  })
  const lastYear = years[years.length-1]
  return (
    <Card title="📅 연도별 기성 현황 (전사, 프로젝트 합산)" note="프로젝트별 월수금계획(cashflowPlan) × 본부 지분율로 산출 — 단위 억원">
      <div style={{overflowX:"auto",marginBottom:14}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:520}}>
          <thead><tr><th style={S.th()}>연도</th><th style={S.th("right")}>발생기성(계획)</th><th style={S.th("right")}>입금기성(실적)</th><th style={S.th("right")}>이월기성(전년까지 누적미수)</th></tr></thead>
          <tbody>{rows.map((r,i)=>(
            <tr key={r.year} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
              <td style={{...S.td("left"),fontWeight:700}}>{r.year}</td>
              <td style={S.td()}>{r.plan.toFixed(2)}</td>
              <td style={{...S.td(),color:C.green,fontWeight:700}}>{r.actual.toFixed(2)}</td>
              <td style={{...S.td(),color:r.carryIn>0?C.amber:"var(--color-text-secondary,#aaa)"}}>{r.carryIn>0?r.carryIn.toFixed(2):"-"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={cardNote2}>{lastYear}년 본부별 발생기성(계획)</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:520}}>
          <thead><tr>{DEPTS.map(d=><th key={d} style={S.th("right")}><span style={{display:"inline-block",width:9,height:9,borderRadius:2,background:DEPT_COLORS[d]||C.gray,marginRight:5,verticalAlign:"middle"}}/>{d}</th>)}<th style={S.th("right")}>합계</th></tr></thead>
          <tbody><tr>
            {DEPTS.map(d=>{
              const v=projectCashflowByDept[lastYear]?.plan?.[d]?.reduce((a,x)=>a+x,0)||0
              return <td key={d} style={{...S.td(),fontWeight:v>0?700:400,color:v>0?(DEPT_COLORS[d]||C.navyM):"var(--color-text-secondary,#aaa)"}}>{v>0?v.toFixed(2):"-"}</td>
            })}
            <td style={{...S.td(),fontWeight:800,color:C.navy}}>{DEPTS.reduce((s,d)=>s+(projectCashflowByDept[lastYear]?.plan?.[d]?.reduce((a,x)=>a+x,0)||0),0).toFixed(2)}</td>
          </tr></tbody>
        </table>
      </div>
    </Card>
  )
}
const cardNote2 = {fontSize:12.5,color:C.gray,marginBottom:8}

// ════════════════════════════════════════════════════════════
// 프로젝트 탭
// ════════════════════════════════════════════════════════════
function ProjectsTab({projects,setProjects,selProjId,setSelProjId,selVerIdx,setSelVerIdx,cmpIds,setCmpIds,showNewVer,setShowNewVer,canWrite,contractTypes}) {
  const [view, setView] = useState("list")  // list | detail | compare | bench
  const [deptFilter, setDeptFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [editVend, setEditVend]     = useState(false)
  const [vDraft, setVDraft]         = useState(null)
  const [editProj, setEditProj]     = useState(false)
  const [cfEditing, setCfEditing]   = useState(false)
  const [cfDraft, setCfDraft]       = useState(null)
  const [detailTab, setDetailTab]   = useState("info")   // info | weekly

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
                  {["구분","코드","프로젝트명","본부","PM","용역비(억)","지분%","연면적㎡","대지㎡","세대","진행%","계약일","수주일","다운"].map((h,i)=><th key={h+i} style={S.th(i>=5&&i<=12?"right":"left")}>{h}</th>)}
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
                      <td style={{...S.td("right"),fontWeight:500}}>{fE((p.serviceFee||0)/1e8)}</td>
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
                          XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
                            ["프로젝트코드",p.code,"","버전",ver.ver,"","회차",ver.round||""],
                            ["연면적(평)",pyF2,"","대지면적(평)",pyS2],
                            [""],
                            ["분야","업체명","원가견적","1차NEGO","2차NEGO","면적기준","평당단가","용역비대비"],
                            ...ver.vendors.map(v=>{const b2=getAreaBasis(v.cat),py=b2==="대지"?pyS2:b2==="연면적"?pyF2:0,up=py>0?Math.round(v.contract/py):"-";return[v.cat,v.name,v.contract,v.nego1||"-",v.nego2||"-",b2==="대지"?"대지면적":b2==="연면적"?"연면적":"1식",up,p.serviceFee>0?`${(v.contract/p.serviceFee*100).toFixed(2)}%`:"-"]}),
                            ["","합계",ver.vendors.reduce((s,v)=>s+v.contract,0)]
                          ]),"협력업체비용")
                          XLSX.writeFile(wb,`실행계획서_${p.code}_${ver.ver}.xlsx`)
                        }} style={{...S.btn(C.navyL,C.navyM),padding:"5px 11px",fontSize:12}}>↓ Excel</button>
                        <button onClick={()=>downloadReport({...p,versions:[ver]})} style={{...S.btn(C.amberL,C.amber),padding:"5px 11px",fontSize:12}}>↓ Word</button>
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
              {/* 서브탭 네비게이션 */}
              <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:`2px solid var(--color-border-tertiary,#eee)`,paddingBottom:0}}>
                {[["info","📐 프로젝트 정보"],["weekly","📋 주간보고"]].map(([id,label])=>(
                  <button key={id} onClick={()=>setDetailTab(id)} style={{padding:"9px 18px",border:"none",background:"none",fontSize:13.5,fontWeight:700,cursor:"pointer",color:detailTab===id?C.navyM:"var(--color-text-secondary,#888)",borderBottom:detailTab===id?`3px solid ${C.navyM}`:"3px solid transparent",marginBottom:-2,transition:"all .15s"}}>
                    {label}
                  </button>
                ))}
              </div>

              {detailTab==="weekly" && <WeeklyReportTab proj={selProj} setProjects={setProjects} canWrite={canWrite} currentUser={currentUser}/>}

              {detailTab==="info" && <>
              {/* 기본정보 카드 */}
              <Card title={`📐 ${selProj.name}`} note={selProj.code} actions={<div style={{display:"flex",gap:6}}>
                <button onClick={()=>downloadReport(selProj)} style={{...S.btn(C.navyL,C.navyM),padding:"5px 11px",fontSize:11}}><i className="ti ti-file-word" aria-hidden="true"/> 보고서 다운로드</button>
                {canWrite&&<button onClick={()=>setEditProj(true)} style={{...S.btn(C.navyL,C.navyM),padding:"5px 11px",fontSize:11}}><i className="ti ti-edit" aria-hidden="true"/> 정보 수정</button>}
              </div>}>
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
                  {[["연도",selProj.year],["주관본부·지분",getDeptShares(selProj).map(s=>`${s.dept} ${s.share}%`).join(" / ")],["담당PM",selProj.pm],["담당본부장",selProj.director],
                    ["프로젝트유형",selProj.projType],["수주유형",selProj.contractType||"-"],["용도",selProj.usage],["규모",selProj.scale],["발주처",selProj.client],
                    ["발주처담당자",selProj.clientPm||"-"],["발주구분",selProj.orderType||"민간"],["총설계비",fW(selProj.totalFee)],["상지지분(발주처대비)",(selProj.shareRatio*100).toFixed(0)+"%"],["세대수",selProj.units?selProj.units.toLocaleString()+"세대":"-"]
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

              <ProjectCashflowCard proj={selProj} setProjects={setProjects} canWrite={canWrite}/>

              {/* 버전 선택 */}
              <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"16px 20px",marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#111827"}}>📋 실행계획서 회차</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {canWrite&&<button onClick={()=>setShowNewVer(true)} style={{...S.btn(C.navyM),padding:"7px 14px",fontSize:13}}>+ 회차 추가</button>}
                    {canWrite&&<label style={{...S.btn(C.amberL,C.amber),padding:"7px 14px",fontSize:13,cursor:"pointer"}}>
                      <i className="ti ti-upload" aria-hidden="true"/> 엑셀 업로드
                      <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{
                        const file=e.target.files?.[0]; if(!file||!selProj) return
                  const reader=new FileReader()
                  reader.onload=ev=>{
                    try{
                      const wb=XLSX.read(ev.target.result,{type:"array"})
                      const wsName=wb.SheetNames.find(n=>n.includes("실행계획서")||n.includes("계획"))||wb.SheetNames[0]
                      const ws=wb.Sheets[wsName]
                      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null})
                      const toN=v=>{if(v==null)return 0;const n=parseFloat(String(v).replace(/[,원\s]/g,""));return Number.isFinite(n)?n:0}
                      const rLbl=r=>String(r?.[0]||"").trim()
                      const hasLbl=(r,lbl)=>rLbl(r).replace(/\s/g,"").includes(lbl.replace(/\s/g,""))
                      let projName="",dept="",pm="",client="",dateStr="",laborCost=0,directExp=0,subContract=0,indirect=null,profit=null
                      const vendors=[]
                      const totalRows=rows.length
                      rows.forEach((r,ri)=>{
                        const lbl=rLbl(r),lbl2=lbl.replace(/\s|\(.*\)/g,"")
                        if(hasLbl(r,"프로젝트명")) projName=String(r[1]||"").replace(/^\[.*?\]\s*/,"").trim()
                        if(hasLbl(r,"주관부서"))  dept=String(r[1]||"").trim()
                        if(hasLbl(r,"담당PM")||hasLbl(r,"담당P M")) pm=String(r[6]||r[2]||"").trim()
                        if(hasLbl(r,"발주처")&&!hasLbl(r,"담당")) client=String(r[1]||"").trim()
                        if(hasLbl(r,"작성일")){ const dt=String(r[6]||r[1]||"").replace(/작성일\s*:/,"").trim(); if(dt) dateStr=dt }
                        if(lbl2.includes("예상용역금액")||lbl2.includes("예상용역비")){ const v=parseFloat(String(r[1]||"").replace(/[,원\s(VAT별도)]/g,"")); if(Number.isFinite(v)&&v>0) {} }
                        if(lbl2==="직접인건비합계"){ let s=0;for(let c=2;c<r.length;c+=2)s+=toN(r[c]);if(s>0)laborCost=s }
                        if(lbl2==="직접경비합계"){  let s=0;for(let c=2;c<r.length;c+=2)s+=toN(r[c]);if(s>0)directExp=s }
                        if(lbl2.includes("외주용역비")&&lbl2.includes("합계")&&lbl2.includes("1+2")){ let s=0;for(let c=2;c<r.length;c+=2)s+=toN(r[c]);if(s>0)subContract=s }
                        if(ri>totalRows*0.65){
                          if(lbl2==="직접인건비"){ const v=toN(r[2]||r[1]);if(v>0)laborCost=v }
                          if(lbl2==="직접경비"){  const v=toN(r[2]||r[1]);if(v>0)directExp=v }
                          if(lbl2==="외주용역비"){ const v=toN(r[2]||r[1]);if(v>0)subContract=v }
                          if(lbl2.startsWith("간접비")){ const v=toN(r[2]||r[1]);if(v>0)indirect=v }
                          if(lbl2==="이윤"||lbl2==="이 윤"){ const v=toN(r[2]||r[1]);if(v>0)profit=v }
                        }
                      })
                      let inV=false
                      rows.forEach(r=>{
                        const lbl=rLbl(r).replace(/\s/g,"")
                        if(lbl.includes("부문")&&String(r[1]||"").replace(/\s/g,"").includes("업체")){inV=true;return}
                        if(inV){
                          if(lbl.includes("소계")||lbl.includes("합계")||lbl.includes("총괄")||lbl.includes("실행계획")){inV=false;return}
                          const cat=String(r[0]||"").trim(),name=String(r[1]||"").trim()
                          if(!cat||!name)return
                          let total=0;for(let c=2;c<r.length;c+=2)total+=toN(r[c])
                          if(total>0)vendors.push({cat,name,contract:total,nego1:0,nego2:0})
                        }
                      })
                      const nextR=(selProj.versions.reduce((mx,v)=>Math.max(mx,v.round||0),0)||0)+1
                      const fnM=file.name.match(/변경?(\d+)차|(\d+)차/)
                      const roundRead=fnM?parseInt(fnM[1]||fnM[2]):nextR
                      let verDate=new Date().toISOString().slice(0,10)
                      if(dateStr){const m=dateStr.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);if(m)verDate=`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`}
                      const newVer={ver:`${roundRead}차 실행계획서`,round:roundRead,date:verDate,reason:"엑셀 업로드",laborCost,directExp,subContract,indirect,profit,vendors}
                      // 프로젝트 기본정보도 함께 업데이트 (비어있는 필드만)
                      setProjects(prev=>prev.map(p=>{
                        if(p.id!==selProj.id) return p
                        const updated={...p,versions:[...p.versions,newVer]}
                        if(pm&&!p.pm)       updated.pm=pm
                        if(client&&!p.client) updated.client=client
                        if(dept&&!p.director) updated.director=dept
                        return updated
                      }))
                      setSelVerIdx(selProj.versions.length)
                      const parts=[]
                      if(laborCost)   parts.push(`인건비 ${(laborCost/1e8).toFixed(2)}억`)
                      if(directExp)   parts.push(`직접경비 ${(directExp/1e8).toFixed(2)}억`)
                      if(subContract) parts.push(`외주비 ${(subContract/1e8).toFixed(2)}억`)
                      if(vendors.length) parts.push(`협력업체 ${vendors.length}개`)
                      alert(`✓ 업로드 완료\n${parts.join(" · ")||"금액 없음 — 수동 입력 필요"}\n\n프로젝트명: ${projName||"(없음)"}\n담당PM: ${pm||"(없음)"}\n발주처: ${client||"(없음)"}\n협력업체: ${vendors.length}개`)
                    }catch(err){alert("파싱 오류: "+err.message)}
                    e.target.value=""
                  }
                  reader.readAsArrayBuffer(file)
                }}/>
              </label>}
                </div>
                </div>

                {/* 회차 카드 목록 */}
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {selProj.versions.length===0
                    ? <div style={{width:"100%",padding:"20px",textAlign:"center",color:"#6B7280",fontSize:14,background:"#F8FAFC",borderRadius:10}}>아직 등록된 실행계획서가 없습니다.</div>
                    : selProj.versions.map((v,i)=>{
                        const active = i===selVerIdx
                        const [editRound, setEditRound] = [null, ()=>{}]  // placeholder — real edit below
                        return (
                          <div key={i} onClick={()=>setSelVerIdx(i)} style={{
                            padding:"12px 16px",borderRadius:12,cursor:"pointer",minWidth:160,
                            border:`2px solid ${active?C.navyM:"#E5E7EB"}`,
                            background:active?"#EEF3FF":"#fff",
                            boxShadow:active?"0 2px 8px rgba(59,114,246,.15)":"0 1px 3px rgba(0,0,0,.04)",
                            transition:"all .15s",position:"relative"
                          }}>
                            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                              <span style={{fontSize:20,fontWeight:800,color:active?C.navyM:"#374151"}}>{v.round||i+1}차</span>
                              {canWrite&&<button onClick={e=>{e.stopPropagation();const nr=window.prompt(`"${v.ver}" 의 회차 번호를 수정하세요:`,v.round||i+1);if(nr!==null){const n=parseInt(nr)||v.round||i+1;setProjects(prev=>prev.map(p=>p.id===selProj.id?{...p,versions:p.versions.map((vv,vi)=>vi===i?{...vv,round:n,ver:`${n}차 실행계획서`}:vv)}:p))}}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#9CA3AF",padding:"2px 4px"}} title="회차 수정">✏</button>}
                            </div>
                            <div style={{fontSize:12,color:"#6B7280",fontWeight:500}}>{v.ver}</div>
                            <div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{v.date}</div>
                            {active&&<div style={{position:"absolute",top:8,right:10,width:8,height:8,borderRadius:"50%",background:C.navyM}}/>}
                          </div>
                        )
                      })
                  }
                </div>
              </div>

              {selVer && (
                <>
                  <div style={S.grid(2,12)}>
                    <Card title="비용 구성 요약" note={`${selVer.round?selVer.round+"차 · ":""}${selVer.ver}`}>
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
                                <td style={{...S.td("right"),fontWeight:row.bold?600:400}}>{row.v?+(row.v/1e8).toFixed(2):"0.00"}</td>
                                <td style={S.td("right")}>{selProj.serviceFee>0?((row.v||0)/selProj.serviceFee*100).toFixed(1)+"%":"-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      })()}
                    </Card>
                    <Card title="외주비 구성 (억원)">
                      <ResponsiveContainer width="100%" height={Math.max(200,selVer.vendors.filter(v=>v.contract>0).length*32)}>
                        <BarChart data={selVer.vendors.filter(v=>v.contract>0).map(v=>({name:v.cat.length>5?v.cat.slice(0,5)+"…":v.cat,금액:+(v.contract/1e6).toFixed(1)}))} layout="vertical" margin={{left:55,right:36}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                          <XAxis type="number" tick={{fontSize:9}} tickFormatter={v=>v+"M"}/>
                          <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={55}/>
                          <Tooltip formatter={v=>[v+"백만원","계약금"]}/>
                          <Bar dataKey="금액" fill={C.navyM} radius={[0,4,4,0]} barSize={20}>
                            <LabelList dataKey="금액" position="right" formatter={v=>v>0?`${v}M`:""} style={{fontSize:11,fontWeight:700,fill:C.navyM}}/>
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>

                  {/* ── 회차별 비교 분석 ── */}
                  <VersionCompareCard proj={selProj} selVerIdx={selVerIdx}/>

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
              {editProj&&<NewProjModal initial={selProj} onClose={()=>setEditProj(false)} onSave={f=>{setProjects(prev=>prev.map(p=>p.id===selProj.id?normalizeProject({...p,...f}):p));setEditProj(false)}}/>}
              </>}
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

// ── 회차별 실행계획서 비교 분석 ──────────────────────────────
function VersionCompareCard({proj,selVerIdx}) {
  const versions = useMemo(()=>{
    // round가 있으면 round 기준, 없으면 index 기준 정렬
    return [...proj.versions]
      .map((v,i)=>({...v,_origIdx:i}))
      .sort((a,b)=>(a.round||a._origIdx+1)-(b.round||b._origIdx+1))
  },[proj.versions])

  if(versions.length<2) return (
    <Card title="📊 회차별 비교 분석" note="실행계획서 2회차 이상부터 회차간 이윤 추이를 비교합니다.">
      <div style={{padding:"12px 14px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:13}}>
        회차가 2개 이상이면 회차간 금액 증감·이윤율 변화를 자동으로 비교합니다.<br/>
        위에서 "버전 추가" 또는 엑셀 업로드로 회차를 추가해주세요.
      </div>
    </Card>
  )

  const ITEMS = [
    {key:"laborCost", label:"직접인건비", color:C.navyM},
    {key:"directExp", label:"직접경비",   color:C.navyM},
    {key:"subContract",label:"외주용역비", color:C.amber},
    {key:"_direct",   label:"직접비 소계", color:C.navy, bold:true},
    {key:"_indirect", label:"간접비",     color:C.gray},
    {key:"_profit",   label:"이윤",       color:C.green, bold:true},
    {key:"_total",    label:"예상합계",   color:C.navy,  bold:true},
  ]

  const pnls = versions.map(v=>{
    const p=calcPnlTotals(v)
    return {laborCost:v.laborCost||0,directExp:v.directExp||0,subContract:v.subContract||0,_direct:p.direct,_indirect:p.indirect,_profit:p.profit,_total:p.total}
  })

  const svc = proj.serviceFee||0

  // 이윤율 추이 차트 데이터
  const chartData = versions.map((v,i)=>{
    const pnl=calcPnlTotals(v)
    const profitRate = svc>0 ? +(pnl.profit/svc*100).toFixed(1) : 0
    const subRate    = svc>0 ? +(pnl.direct/svc*100).toFixed(1) : 0
    return {
      name: v.round ? `${v.round}차` : `v${v._origIdx+1}`,
      이윤율: profitRate,
      직접비율: subRate,
      이윤: +(pnl.profit/1e8).toFixed(2),
      직접비: +(pnl.direct/1e8).toFixed(2),
    }
  })

  const firstPnl = pnls[0]
  const lastPnl  = pnls[pnls.length-1]

  // 전체 변화 요약 (1차 → 최신)
  const profitChange = lastPnl._profit - firstPnl._profit
  const profitPctChange = firstPnl._profit!==0 ? (profitChange/firstPnl._profit*100) : 0
  const isGood = profitChange >= 0

  return (
    <Card title="📊 회차별 실행계획서 비교 분석" note="회차 순서대로 각 항목의 금액 변화·이윤율 추이를 모니터링합니다.">
      {/* 요약 헤드라인 */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
        <div style={{background:isGood?C.greenL:C.redL,borderRadius:10,padding:"10px 16px",flex:1,minWidth:180}}>
          <div style={{fontSize:11,color:isGood?C.green:C.red,fontWeight:600,marginBottom:3}}>1차 → {versions.length}차 이윤 변화</div>
          <div style={{fontSize:20,fontWeight:800,color:isGood?C.green:C.red}}>
            {isGood?"+":""}{fE(profitChange)}
          </div>
          <div style={{fontSize:12,color:isGood?C.green:C.red}}>({isGood?"+":""}{profitPctChange.toFixed(1)}%)</div>
        </div>
        {versions.map((v,i)=>{
          const p=pnls[i]
          const rate=svc>0?+(p._profit/svc*100).toFixed(1):null
          return (
            <div key={i} style={{background:selVerIdx===v._origIdx?"var(--color-background-primary,#fff)":C.grayL,borderRadius:10,padding:"10px 16px",flex:1,minWidth:140,border:`1px solid ${selVerIdx===v._origIdx?C.navyM:"transparent"}`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.gray,marginBottom:3}}>{v.round?`${v.round}차`:v.ver}</div>
              <div style={{fontSize:13,fontWeight:700,color:C.navy}}>{fE(p._profit)}</div>
              <div style={{fontSize:11,color:rate!=null&&rate<5?C.red:C.green}}>{rate!=null?`이윤율 ${rate}%`:"-"}</div>
            </div>
          )
        })}
      </div>

      {/* 이윤율 추이 차트 */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,color:C.gray,fontWeight:600,marginBottom:6}}>이윤율 추이 (용역비 대비 %)</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{top:20,right:20,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
            <XAxis dataKey="name" tick={{fontSize:12,fontWeight:600}}/>
            <YAxis tick={{fontSize:10}} tickFormatter={v=>v+"%"} domain={[0,"auto"]}/>
            <Tooltip formatter={(v,n)=>[v+(n==="이윤율"||n==="직접비율"?"%":"억"),n]}/>
            <Bar dataKey="이윤율" fill={C.green} radius={[4,4,0,0]} barSize={40}>
              <LabelList dataKey="이윤율" position="top" formatter={v=>v+"%"} style={{fontSize:12,fontWeight:700,fill:C.green}}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 항목별 회차 비교표 */}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
          <thead>
            <tr>
              <th style={S.th()}>항목</th>
              {versions.map((v,i)=>(
                <th key={i} style={S.th("right")}>
                  {v.round?`${v.round}차`:v.ver}
                  <div style={{fontSize:9,color:C.gray,fontWeight:400}}>{v.date}</div>
                </th>
              ))}
              {versions.length>=2 && <>
                <th style={{...S.th("right"),color:C.amber}}>증감액<div style={{fontSize:9,fontWeight:400}}>(1차→최신)</div></th>
                <th style={{...S.th("right"),color:C.amber}}>증감율</th>
              </>}
              <th style={S.th("right")}>최신 비율<div style={{fontSize:9,fontWeight:400}}>(용역비 대비)</div></th>
            </tr>
          </thead>
          <tbody>
            {ITEMS.map(item=>{
              const vals = pnls.map(p=>p[item.key]||0)
              const diff = vals.length>=2 ? vals[vals.length-1]-vals[0] : null
              const diffPct = (diff!=null&&vals[0]!==0) ? (diff/vals[0]*100) : null
              const latestRate = svc>0 ? (vals[vals.length-1]/svc*100) : null
              // 각 회차간 증감 표시를 위한 delta 계산
              const deltas = vals.map((v,i)=>i===0?null:v-vals[i-1])
              return (
                <tr key={item.key} style={{
                  background:item.bold?"var(--color-background-secondary,#f5f5f3)":"var(--color-background-primary,#fff)",
                  borderTop:item.bold?`1px solid ${C.navyL}`:"none"
                }}>
                  <td style={{...S.td("left"),fontWeight:item.bold?700:400,color:item.color||"inherit"}}>{item.label}</td>
                  {vals.map((v,i)=>(
                    <td key={i} style={{...S.td("right"),fontWeight:item.bold?700:400}}>
                      <div style={{color:item.color||"inherit"}}>{fE(v)}</div>
                      {deltas[i]!=null&&deltas[i]!==0&&(
                        <div style={{fontSize:10,color:deltas[i]>0?C.red:C.green,fontWeight:600}}>
                          {deltas[i]>0?"+":""}{(deltas[i]/1e8).toFixed(2)}억
                        </div>
                      )}
                    </td>
                  ))}
                  {versions.length>=2 && <>
                    <td style={{...S.td("right"),fontWeight:700,color:diff==null?C.gray:diff>0?C.red:diff<0?C.green:C.gray}}>
                      {diff!=null?(diff>=0?"+":"")+fE(diff):"-"}
                    </td>
                    <td style={{...S.td("right"),fontWeight:700,color:diffPct==null?C.gray:diffPct>0?C.red:diffPct<0?C.green:C.gray}}>
                      {diffPct!=null?(diffPct>=0?"+":"")+diffPct.toFixed(1)+"%":"-"}
                    </td>
                  </>}
                  <td style={{...S.td("right"),color:latestRate!=null&&item.key==="_profit"?(latestRate<5?C.red:latestRate>12?C.green:C.amber):C.gray}}>
                    {latestRate!=null?latestRate.toFixed(1)+"%":"-"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 외주비 분야별 회차 비교 */}
      {versions.some(v=>(v.vendors||[]).length>0) && (
        <VendorVersionCompare versions={versions} proj={proj}/>
      )}
    </Card>
  )
}

// 협력업체(외주비) 분야별 회차 비교
function VendorVersionCompare({versions,proj}) {
  const allCats = useMemo(()=>[...new Set(versions.flatMap(v=>(v.vendors||[]).map(x=>x.cat)))].sort(),[versions])
  const svc = proj.serviceFee||0
  const pyF = (proj.floorArea||0)/3.3058
  const pyS = (proj.siteArea||0)/3.3058

  return (
    <div style={{marginTop:16}}>
      <div style={{fontSize:12,color:C.gray,fontWeight:600,marginBottom:8,borderTop:`1px solid ${C.navyL}`,paddingTop:10}}>외주비 분야별 회차 비교</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
          <thead>
            <tr>
              <th style={S.th()}>분야</th>
              {versions.map((v,i)=>(
                <th key={i} style={S.th("right")}>{v.round?`${v.round}차`:v.ver}<div style={{fontSize:9,color:C.gray,fontWeight:400}}>원가견적</div></th>
              ))}
              {versions.length>=2 && <th style={{...S.th("right"),color:C.amber}}>증감액</th>}
              <th style={S.th("right")}>평당단가(최신)</th>
            </tr>
          </thead>
          <tbody>
            {allCats.map((cat,ci)=>{
              const vals=versions.map(v=>{const vd=(v.vendors||[]).find(x=>x.cat===cat);return vd?(vd.nego2||vd.nego1||vd.contract||0):0})
              const diff=vals.length>=2?vals[vals.length-1]-vals[0]:null
              const basis=getAreaBasis(cat)
              const py=basis==="대지"?pyS:basis==="연면적"?pyF:0
              const latestAmt=vals[vals.length-1]
              const up=py>0&&latestAmt>0?Math.round(latestAmt/py):null
              return (
                <tr key={cat} style={{background:ci%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={{...S.td("left")}}><span style={{...S.bdg(C.navyL,C.navyM),fontSize:11}}>{cat}</span></td>
                  {vals.map((v,i)=>(
                    <td key={i} style={S.td("right")}>
                      {v>0?fW(v):<span style={{color:C.gray}}>-</span>}
                    </td>
                  ))}
                  {versions.length>=2&&<td style={{...S.td("right"),fontWeight:700,color:diff==null?C.gray:diff>0?C.red:diff<0?C.green:C.gray}}>
                    {diff!=null&&diff!==0?(diff>=0?"+":"")+fW(diff):"-"}
                  </td>}
                  <td style={{...S.td("right"),fontSize:12,color:C.navyM}}>
                    {up?fPy(up):"1식"}
                  </td>
                </tr>
              )
            })}
            {/* 합계 */}
            <tr style={{background:"var(--color-background-secondary,#f0f0ee)",fontWeight:700}}>
              <td style={{...S.td("left")}}>외주비 합계</td>
              {versions.map((v,i)=>{
                const total=(v.vendors||[]).reduce((s,x)=>s+(x.nego2||x.nego1||x.contract||0),0)
                return <td key={i} style={{...S.td("right"),color:C.amber}}>{fE(total)}</td>
              })}
              {versions.length>=2&&(()=>{
                const t0=(versions[0].vendors||[]).reduce((s,x)=>s+(x.nego2||x.nego1||x.contract||0),0)
                const tN=(versions[versions.length-1].vendors||[]).reduce((s,x)=>s+(x.nego2||x.nego1||x.contract||0),0)
                const d=tN-t0
                return <td style={{...S.td("right"),color:d>0?C.red:d<0?C.green:C.gray}}>{d!==0?(d>0?"+":"")+fW(d):"-"}</td>
              })()}
              <td/>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}


function ProjectCashflowCard({proj,setProjects,canWrite}) {
  const plan = proj.cashflowPlan||[]
  const [editing,setEditing]   = useState(false)
  const [draft,setDraft]       = useState(null)
  const [extraYears,setExtraYears] = useState([])

  const planYears = useMemo(()=>{
    const ys = new Set(plan.map(e=>String(e.year)))
    ys.add(String(proj.year||"2026"))
    return [...ys]
  },[plan,proj.year])

  const start = ()=>{ setDraft(plan.map(e=>({...e}))); setExtraYears([]); setEditing(true) }
  const cancel = ()=>{ setEditing(false); setDraft(null); setExtraYears([]) }
  const save = ()=>{
    setProjects(prev=>prev.map(p=>p.id===proj.id?{...p,cashflowPlan:(draft||[]).filter(e=>num(e.plan)||num(e.actual))}:p))
    setEditing(false); setDraft(null); setExtraYears([])
  }
  const addYear = ()=>{
    const all=[...new Set([...planYears,...extraYears])].map(Number)
    const ny=String(Math.max(...all)+1)
    setExtraYears(p=>[...p,ny])
  }
  const removeYear = y=>{
    setDraft(prev=>prev.filter(e=>String(e.year)!==String(y)))
    setExtraYears(prev=>prev.filter(x=>x!==y))
  }

  const work = editing ? (draft||[]) : plan
  const years = useMemo(()=>[...new Set([...planYears,...extraYears])].sort(),[planYears,extraYears])
  const getCell = (y,m,field)=>{ const e=work.find(x=>String(x.year)===String(y)&&x.month===m); return e?num(e[field]):0 }
  const setCell = (y,m,field,v)=>setDraft(prev=>{
    const idx=(prev||[]).findIndex(x=>String(x.year)===String(y)&&x.month===m)
    if(idx>=0){ const copy=[...prev]; copy[idx]={...copy[idx],[field]:num(v)}; return copy }
    return [...(prev||[]),{year:String(y),month:m,plan:0,actual:0,[field]:num(v)}]
  })

  // 연도별 발생/입금/이월/잔여 요약 (저장된 데이터 기준)
  const byYear = useMemo(()=>{
    const out={}
    plan.forEach(e=>{ const y=String(e.year); if(!out[y]) out[y]={planSum:0,actualSum:0}; out[y].planSum+=num(e.plan); out[y].actualSum+=num(e.actual) })
    return out
  },[plan])
  const sumYears = Object.keys(byYear).sort()
  const serviceFeeEok = (proj.serviceFee||0)/1e8
  let carry=0, cumActual=0
  const summaryRows = sumYears.map(y=>{
    const {planSum,actualSum}=byYear[y]
    const row = {year:y, planSum, actualSum, carryIn:carry}
    cumActual += actualSum
    row.remainOverall = serviceFeeEok - cumActual
    carry += (planSum-actualSum)
    return row
  })

  return (
    <Card title="📅 연도별 월수금계획 (기성)" note="단위: 억원 · 프로젝트 종료시점까지 연도 추가 가능"
      actions={canWrite&&(!editing
        ? <button onClick={start} style={{...S.btn(C.navyL,C.navyM),padding:"5px 11px",fontSize:11}}><i className="ti ti-edit" aria-hidden="true"/> 계획 입력</button>
        : <div style={{display:"flex",gap:6}}>
            <button onClick={addYear} style={{...S.btn(C.grayL,C.gray),padding:"5px 11px",fontSize:11}}>+ 연도 추가</button>
            <button onClick={save} style={{...S.btn(C.green),padding:"5px 11px",fontSize:11}}>저장</button>
            <button onClick={cancel} style={{...S.btn(C.grayL,C.gray),padding:"5px 11px",fontSize:11}}>취소</button>
          </div>)}>
      {years.length===0 && !editing && <div style={{padding:"12px 14px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:13}}>아직 입력된 월수금계획이 없습니다. {canWrite&&"\"계획 입력\"으로 월별 기성 계획을 등록하세요."}</div>}
      {years.map(y=>(
        <div key={y} style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
            <span style={{fontSize:13,fontWeight:700,color:C.navyM}}>{y}년</span>
            {editing&&<button onClick={()=>removeYear(y)} style={{background:"none",border:"none",cursor:"pointer",color:C.red,fontSize:11}}>이 연도 삭제</button>}
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}>
              <thead><tr>
                <th style={S.th()}>구분</th>
                {MONTHS.map((m,mi)=>{
                  const nowY=new Date().getFullYear(), nowM=new Date().getMonth()+1
                  const isPast=parseInt(y)<nowY||(parseInt(y)===nowY&&(mi+1)<nowM)
                  const isCur =parseInt(y)===nowY&&(mi+1)===nowM
                  return (
                    <th key={m} style={{...S.th("right"),
                      color:isCur?"#3B72F6":isPast?"#6B7280":"#111827",
                      background:isCur?"#EEF3FF":isPast?"#F9FAFB":"var(--color-background-secondary,#f8f8f6)",
                      position:"relative"
                    }}>
                      {m}
                      {isCur&&<div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:"#3B72F6"}}/>}
                    </th>
                  )
                })}
                <th style={S.th("right")}>합계</th>
              </tr></thead>
              <tbody>
                {[["plan","계획기성",C.navyM],["actual","입금(실적)",C.green]].map(([field,label,color])=>{
                  const vals=Array.from({length:12},(_,i)=>getCell(y,i+1,field))
                  const total=vals.reduce((s,v)=>s+v,0)
                  const nowY = new Date().getFullYear()
                  const nowM = new Date().getMonth()+1  // 1-indexed
                  return (
                    <tr key={field}>
                      <td style={{...S.td("left"),fontWeight:700,color}}>{label}</td>
                      {vals.map((v,mi)=>{
                        const monthNum = mi+1
                        const isPast   = parseInt(y)<nowY || (parseInt(y)===nowY && monthNum<nowM)
                        const isCurrent= parseInt(y)===nowY && monthNum===nowM
                        const isFuture = parseInt(y)>nowY || (parseInt(y)===nowY && monthNum>nowM)
                        // 계획기성: 현재월 포함 미래만 활성 / 과거는 비활성(회색)
                        // 입금실적: 과거+현재월 활성 / 미래는 비활성
                        const disabled = editing && (
                          (field==="plan"   && isPast)   ||  // 계획: 과거 비활성
                          (field==="actual" && isFuture)     // 실적: 미래 비활성
                        )
                        const bgColor = disabled
                          ? "#F3F4F6"
                          : field==="plan"&&!isPast?"#EEF3FF"
                          : field==="actual"&&!isFuture?"#E6F9F2"
                          : undefined
                        return (
                          <td key={mi} style={S.td()}>
                            {editing
                              ? <input
                                  type="number" step="0.01" value={v}
                                  onChange={e=>!disabled&&setCell(y,mi+1,field,e.target.value)}
                                  readOnly={disabled}
                                  title={disabled
                                    ? field==="plan"
                                      ? "계획기성은 현재월 이후에만 입력 가능합니다"
                                      : "입금실적은 현재월까지만 입력 가능합니다"
                                    : undefined}
                                  style={{...S.inp(58),background:bgColor,color:disabled?"#9CA3AF":"inherit",cursor:disabled?"not-allowed":"text"}}
                                />
                              : <span style={{color:v>0?color:"var(--color-text-secondary,#aaa)",fontWeight:v>0?700:400}}>{v>0?v.toFixed(2):"-"}</span>}
                          </td>
                        )
                      })}
                      <td style={{...S.td(),fontWeight:800,color}}>{total.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {summaryRows.length>0 && (
        <div style={{overflowX:"auto",marginTop:6}}>
          <div style={{fontSize:12.5,color:C.gray,marginBottom:8}}>연도별 기성 현황 (단위: 억원, 용역비 {fE(serviceFeeEok)} 기준)</div>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
            <thead><tr>
              <th style={S.th()}>연도</th>
              <th style={S.th("right")}>발생기성(계획)</th>
              <th style={S.th("right")}>입금기성(실적)</th>
              <th style={S.th("right")}>이월기성(전년까지 누적미수)</th>
              <th style={S.th("right")}>잔여기성(계약대비, 연말기준)</th>
            </tr></thead>
            <tbody>
              {summaryRows.map((r,i)=>(
                <tr key={r.year} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={{...S.td("left"),fontWeight:700}}>{r.year}</td>
                  <td style={S.td()}>{r.planSum.toFixed(2)}</td>
                  <td style={{...S.td(),color:C.green,fontWeight:700}}>{r.actualSum.toFixed(2)}</td>
                  <td style={{...S.td(),color:r.carryIn>0?C.amber:"var(--color-text-secondary,#aaa)"}}>{r.carryIn>0?r.carryIn.toFixed(2):"-"}</td>
                  <td style={{...S.td(),fontWeight:700,color:r.remainOverall>0?C.red:C.green}}>{r.remainOverall.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}


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
  const barData=tableData.map(row=>({name:row.cat.length>6?row.cat.slice(0,6)+"…":row.cat,...Object.fromEntries(selPs.map(p=>[p.id,+(row[p.id]/1e6).toFixed(1)]))}))
  return (
    <div>
      <div style={{display:"flex",gap:7,marginBottom:13,flexWrap:"wrap",alignItems:"center"}}>
        <select value="" onChange={e=>{const id=e.target.value;if(!id)return;setCmpIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])}}
          style={{padding:"6px 11px",border:`1px solid ${C.navyM}`,borderRadius:8,fontSize:12,background:C.navyL,color:C.navyM,minWidth:200}}>
          <option value="">+ 프로젝트 선택</option>
          {projects.filter(p=>!cmpIds.includes(p.id)).map(p=><option key={p.id} value={p.id}>{p.name.slice(0,30)}</option>)}
        </select>
        {cmpIds.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
          {projects.filter(p=>cmpIds.includes(p.id)).map((p,i)=>(
            <span key={p.id} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:7,background:COLORS[i%COLORS.length]+"22",border:`1px solid ${COLORS[i%COLORS.length]}`,fontSize:12,color:COLORS[i%COLORS.length],fontWeight:500}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:COLORS[i%COLORS.length],flexShrink:0}}/>
              {p.name.slice(0,16)}
              <button onClick={()=>setCmpIds(prev=>prev.filter(id=>id!==p.id))} style={{background:"none",border:"none",cursor:"pointer",color:COLORS[i%COLORS.length],fontSize:14,lineHeight:1,padding:"0 2px"}}>×</button>
            </span>
          ))}
          <button onClick={()=>setCmpIds([])} style={{...S.btn(C.grayL,C.gray),padding:"4px 9px",fontSize:11}}>전체 해제</button>
        </div>}
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
            <option value="">전체 분야</option>{allCats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={priceKey} onChange={e=>setPriceKey(e.target.value)} style={{padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
            <option value="contract">원가견적</option><option value="nego1">1차NEGO</option><option value="nego2">2차NEGO</option>
          </select>
        </div>
      </div>
      <Card title="분야별 협력업체 비용 비교" note="단위: 백만원">
        <ResponsiveContainer width="100%" height={Math.max(260,tableData.length*28*Math.max(1,selPs.length))}>
          <BarChart data={barData} layout="vertical" margin={{left:70,right:42,top:4,bottom:4}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
            <XAxis type="number" tick={{fontSize:9}} tickFormatter={v=>v+"M"}/>
            <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={70}/>
            <Tooltip formatter={(v,n)=>[`${v}백만원`,n]}/><Legend wrapperStyle={{fontSize:11}}/>
            {selPs.map((p,i)=><Bar key={p.id} dataKey={p.id} name={p.name.length>14?p.name.slice(0,14)+"…":p.name} fill={COLORS[i%COLORS.length]} radius={[0,3,3,0]} barSize={Math.max(10,18-selPs.length)}>
              <LabelList dataKey={p.id} position="right" formatter={v=>v>0?`${v}M`:""} style={{fontSize:9.5,fontWeight:700,fill:COLORS[i%COLORS.length]}}/>
            </Bar>)}
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="비교 상세표" note="분야별 [금액 / 평당단가 / 비율] 3개 한 세트로 비교 · 초록=최저 빨강=최고">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"var(--color-background-secondary,#f0f0ee)"}}>
                <th style={{...S.th("left"),rowSpan:2}} rowSpan={2}>분야</th>
                <th style={{...S.th("center"),rowSpan:2}} rowSpan={2}>면적기준</th>
                {selPs.map((p,pi)=>(
                  <th key={p.id} colSpan={3} style={{...S.th("center"),background:COLORS[pi%COLORS.length]+"22",color:COLORS[pi%COLORS.length],borderBottom:"0.5px solid "+COLORS[pi%COLORS.length]}}>
                    {p.name.slice(0,14)}
                  </th>
                ))}
                <th colSpan={2} style={S.th("center")}>최저 / 최고</th>
              </tr>
              <tr>
                {selPs.map((p,pi)=>[
                  <th key={p.id+"a"} style={{...S.th("right"),fontSize:10,background:COLORS[pi%COLORS.length]+"11"}}>금액(원)</th>,
                  <th key={p.id+"b"} style={{...S.th("right"),fontSize:10,background:COLORS[pi%COLORS.length]+"11"}}>평당단가</th>,
                  <th key={p.id+"c"} style={{...S.th("right"),fontSize:10,background:COLORS[pi%COLORS.length]+"11"}}>비율%</th>,
                ])}
                <th style={{...S.th("right"),fontSize:10}}>최저</th>
                <th style={{...S.th("right"),fontSize:10}}>최고↑차이</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row,i)=>{
                const vals=selPs.map(p=>row[p.id]).filter(v=>v>0)
                const min=vals.length?Math.min(...vals):0, max=vals.length?Math.max(...vals):0
                const basis=getAreaBasis(row.cat)
                return <tr key={row.cat} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={S.td("left")}><span style={S.bdg(C.navyL,C.navyM)}>{row.cat}</span></td>
                  <td style={S.td("center")}><span style={{...S.bdg(basis==="대지"?C.amberL:basis==="1식"?C.grayL:C.greenL,basis==="대지"?C.amber:basis==="1식"?C.gray:C.green),fontSize:9}}>{basis==="대지"?"대지면적":basis==="연면적"?"연면적":"1식"}</span></td>
                  {selPs.map((p,pi)=>{
                    const v=row[p.id]||0
                    const isMin=v===min&&selPs.length>1&&min>0, isMax=v===max&&selPs.length>1
                    const color=isMin?C.green:isMax?C.red:"inherit"
                    const pyF2=toPy(p.floorArea||0), pyS2=toPy(p.siteArea||0)
                    const py=basis==="대지"?pyS2:basis==="연면적"?pyF2:0
                    const up=py>0&&v>0?Math.round(v/py):null
                    const ratio=p.serviceFee>0&&v>0?(v/p.serviceFee*100).toFixed(1):null
                    return [
                      <td key={p.id+"a"} style={{...S.td("right"),color,fontWeight:isMin?600:400,background:COLORS[pi%COLORS.length]+"08"}}>{v?fW(v):"-"}</td>,
                      <td key={p.id+"b"} style={{...S.td("right"),color:up?C.navyM:C.gray,fontSize:11,background:COLORS[pi%COLORS.length]+"08"}}>{up?up.toLocaleString()+"원":"-"}</td>,
                      <td key={p.id+"c"} style={{...S.td("right"),color:C.gray,fontSize:11,background:COLORS[pi%COLORS.length]+"08"}}>{ratio?ratio+"%":"-"}</td>,
                    ]
                  })}
                  <td style={{...S.td("right"),color:C.green,fontWeight:600,fontSize:11}}>{min?fW(min):"-"}</td>
                  <td style={{...S.td("right"),color:C.red,fontSize:11}}>{max?fW(max):"-"}<br/>{min&&max>0&&<span style={{fontSize:10,color:C.gray}}>{((max-min)/min*100).toFixed(0)}%↑</span>}</td>
                </tr>
              })}
              <tr style={{background:"var(--color-background-secondary,#f0f0ee)",fontWeight:600}}>
                <td style={{...S.td("left")}} colSpan={2}>외주비 합계</td>
                {selPs.map((p,pi)=>{
                  const ver=p.versions[p.versions.length-1]
                  const tot=ver?.vendors.reduce((s,v)=>s+(v[priceKey]||v.contract||0),0)||0
                  return [
                    <td key={p.id+"a"} style={{...S.td("right"),color:C.navyM,background:COLORS[pi%COLORS.length]+"08"}}>{fW(tot)}</td>,
                    <td key={p.id+"b"} style={{...S.td("right"),background:COLORS[pi%COLORS.length]+"08"}}>-</td>,
                    <td key={p.id+"c"} style={{...S.td("right"),background:COLORS[pi%COLORS.length]+"08"}}>{p.serviceFee>0?(tot/p.serviceFee*100).toFixed(1)+"%":"-"}</td>,
                  ]
                })}
                <td colSpan={2}/>
              </tr>
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
        items.push({projId:p.id,up:vd.contract/py,up2:vd.nego2?(vd.nego2/py):null,basis:basis==="대지"?"대지면적":"연면적",vendor:vd.name})
      })
      return {cat,items}
    }).filter(r=>r.items.length>0)
  },[selPs,allCats,selCat])
  const barData=benchData.map(row=>({name:row.cat.length>5?row.cat.slice(0,5)+"…":row.cat,...Object.fromEntries(row.items.map(i=>[i.projId,+i.up.toFixed(0)]))}))
  return (
    <div>
      <div style={{background:C.navyL,borderLeft:`3px solid ${C.navyM}`,borderRadius:"0 8px 8px 0",padding:"9px 13px",fontSize:12,color:C.navyM,marginBottom:13,lineHeight:1.7}}>
        <strong>평당단가 산출 기준</strong> — 토목·조경·흙막이·지반조사·현황측량·부대토목 → <strong style={{color:C.amber}}>대지면적</strong> / 구조·기계·전기·소방·CG·건축외주 등 → <strong style={{color:C.green}}>연면적</strong> / 친환경·교통·BIM·인테리어·외부특화·경관 → <strong style={{color:C.gray}}>1식 제외</strong>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:13,flexWrap:"wrap",alignItems:"center"}}>
        <select value="" onChange={e=>{const id=e.target.value;if(!id)return;setCmpIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])}}
          style={{padding:"6px 11px",border:`1px solid ${C.navyM}`,borderRadius:8,fontSize:12,background:C.navyL,color:C.navyM,minWidth:200}}>
          <option value="">+ 프로젝트 선택</option>
          {projects.filter(p=>!cmpIds.includes(p.id)).map(p=><option key={p.id} value={p.id}>{p.name.slice(0,30)}</option>)}
        </select>
        {cmpIds.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {projects.filter(p=>cmpIds.includes(p.id)).map((p,i)=>(
            <span key={p.id} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 9px",borderRadius:7,background:COLORS[i%COLORS.length]+"22",border:`1px solid ${COLORS[i%COLORS.length]}`,fontSize:12,color:COLORS[i%COLORS.length],fontWeight:500}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:COLORS[i%COLORS.length],flexShrink:0}}/>
              {p.name.slice(0,14)}
              <button onClick={()=>setCmpIds(prev=>prev.filter(id=>id!==p.id))} style={{background:"none",border:"none",cursor:"pointer",color:COLORS[i%COLORS.length],fontSize:14,lineHeight:1}}>×</button>
            </span>
          ))}
        </div>}
        <select value={selCat} onChange={e=>setSelCat(e.target.value)} style={{padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
          <option value="">단가산출 가능 전체 분야</option>
          {allCats.filter(c=>UP_CATS.some(u=>c.includes(u)||u.includes(c))).map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <Card title="공종별 평당단가 비교 (원/평)" note="1식 항목 제외">
        <ResponsiveContainer width="100%" height={Math.max(240,benchData.length*28*Math.max(1,selPs.length))}>
          <BarChart data={barData} layout="vertical" margin={{left:60,right:50}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
            <XAxis type="number" tick={{fontSize:9}} tickFormatter={v=>v.toLocaleString()}/>
            <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={60}/>
            <Tooltip formatter={(v,n)=>[`${v.toLocaleString()}원/평`,n]}/><Legend wrapperStyle={{fontSize:11}}/>
            {selPs.map((p,i)=><Bar key={p.id} dataKey={p.id} name={p.name.length>14?p.name.slice(0,14)+"…":p.name} fill={COLORS[i%COLORS.length]} radius={[0,3,3,0]} barSize={Math.max(10,18-selPs.length)}>
              <LabelList dataKey={p.id} position="right" formatter={v=>v>0?v.toLocaleString():""} style={{fontSize:9.5,fontWeight:700,fill:COLORS[i%COLORS.length]}}/>
            </Bar>)}
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="공종별 평당단가 상세 (초록=최저 · 빨강=최고)">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>
              <th style={S.th("left")}>분야</th><th style={S.th("center")}>기준</th>
              {selPs.map(p=><th key={p.id} style={S.th("right")}>{p.name.length>10?p.name.slice(0,10)+"…":p.name}<br/><span style={{fontSize:9,fontWeight:400,color:C.gray}}>원/평 (업체)</span></th>)}
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
  const {DEPTS,DEPT_COLORS,DEPT_BIZ} = useDepts()
  const [view,setView]   = useState("total")
  const [selDept,setSelDept] = useState(()=>DEPTS[0]||"")
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
            <ResponsiveContainer width="100%" height={270}>
              <ComposedChart data={lineData} margin={{top:24,right:10,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                <XAxis dataKey="name" tick={{fontSize:11}} tickFormatter={v=>v.replace("월","")} tickLine={false}/>
                <YAxis tick={{fontSize:10}} tickFormatter={v=>v+"억"}/>
                <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억`,n]}/>
                <Bar dataKey="매출" fill={C.green} opacity={.8} radius={[4,4,0,0]} barSize={30}>
                  <LabelList dataKey="매출" position="top" {...lbl(C.green,2,10)}/>
                </Bar>
                <Bar dataKey="지출" fill={C.red} opacity={.7} radius={[4,4,0,0]} barSize={30}>
                  <LabelList dataKey="지출" position="top" {...lbl(C.red,2,10)}/>
                </Bar>
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
              <ResponsiveContainer width="100%" height={270}>
                <ComposedChart data={deptDataMonthly} margin={{top:24,right:10,left:-10,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                  <XAxis dataKey="name" tick={{fontSize:11}} tickFormatter={v=>v.replace("월","")} tickLine={false}/>
                  <YAxis tick={{fontSize:10}} tickFormatter={v=>v+"억"}/>
                  <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억`,n]}/>
                  <Bar dataKey="매출" fill={C.green} opacity={.8} radius={[4,4,0,0]} barSize={30}>
                    <LabelList dataKey="매출" position="top" {...lbl(C.green,2,10)}/>
                  </Bar>
                  <Bar dataKey="지출" fill={C.red} opacity={.7} radius={[4,4,0,0]} barSize={30}>
                    <LabelList dataKey="지출" position="top" {...lbl(C.red,2,10)}/>
                  </Bar>
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
                    {DEPTS.map((d,i)=>{const db=DEPT_BIZ[d]||DEPT_BIZ_EMPTY; return(
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
                    )})}
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

function NewProjModal({onClose,onSave,initial=null}) {
  const {STAFF_DEPTS, contractTypes, projTypes, bidTypes} = useDepts()
  const [f,setF]=useState(()=>{
    if(initial){
      const ds = getDeptShares(initial).map(s=>({...s}))
      return {...initial, shareRatio:(initial.shareRatio??1)*100, deptShares: ds.length?ds:[{dept:STAFF_DEPTS[0],share:100}], orderType: initial.orderType||"민간", contractType: initial.contractType||"민간"}
    }
    return {year:new Date().getFullYear()+"",code:"",name:"",deptShares:[{dept:STAFF_DEPTS[0],share:100}],pm:"",director:"",projType:"",contractType:"민간",usage:"",scale:"",siteArea:0,buildArea:0,floorArea:0,units:0,client:"",clientPm:"",totalFee:0,shareRatio:100,serviceFee:0,address:"",contractDate:"",orderDate:"",orderType:"민간",bidType:"민간수의",note:"",type:"확정",prog:0}
  })
  const u=(k,v)=>setF(p=>({...p,[k]:v}))
  const pyF=toPy(f.floorArea||0), pyS=toPy(f.siteArea||0)

  // 본부 지분율
  const updShare=(i,key,v)=>setF(p=>({...p,deptShares:p.deptShares.map((s,si)=>si===i?{...s,[key]:v}:s)}))
  const addShare=()=>setF(p=>{
    const used=p.deptShares.map(s=>s.dept)
    const next=STAFF_DEPTS.find(d=>!used.includes(d))||STAFF_DEPTS[0]
    return {...p,deptShares:[...p.deptShares,{dept:next,share:0}]}
  })
  const removeShare=i=>setF(p=>p.deptShares.length>1?{...p,deptShares:p.deptShares.filter((_,si)=>si!==i)}:p)
  const equalizeShares=()=>setF(p=>{
    const n=p.deptShares.length, base=+(100/n).toFixed(2)
    return {...p,deptShares:p.deptShares.map((s,i)=>({...s,share:i===n-1?+(100-base*(n-1)).toFixed(2):base}))}
  })
  const shareSum = +f.deptShares.reduce((s,x)=>s+num(x.share),0).toFixed(2)

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:300,padding:20,overflowY:"auto"}}>
      <div style={{...S.card(),width:"100%",maxWidth:660,marginTop:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:500}}>{initial?"프로젝트 정보 수정":"신규 프로젝트 등록"}</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.gray}}>✕</button>
        </div>
        {[
          {title:"기본정보",content:<div style={S.grid(4,9)}>
            <F label="연도" val={f.year} onChange={v=>u("year",v)}/>
            <F label="코드 *" val={f.code} onChange={v=>u("code",v)}/>
            <F label="건물 유형" val={f.projType} onChange={v=>u("projType",v)} type="select" opts={projTypes||[]}/>
            <F label="수주 유형" val={f.contractType||""} onChange={v=>u("contractType",v)} type="select" opts={contractTypes||[]}/>
            <div style={{gridColumn:"1/-1"}}><F label="프로젝트명 *" val={f.name} onChange={v=>u("name",v)}/></div>
          </div>},
          {title:"조직정보 · 본부별 지분율",content:<>
            <div style={{marginBottom:9}}>
              <label style={S.lbl()}>주관본부 · 지분율 (계약/매출 배분 비율, 합계 100%)</label>
              {f.deptShares.map((ds,i)=>(
                <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
                  <select value={ds.dept} onChange={e=>updShare(i,"dept",e.target.value)} style={{...S.inp(),flex:1,textAlign:"left"}}>
                    {STAFF_DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                  <input type="number" step="0.1" value={ds.share} onChange={e=>updShare(i,"share",parseFloat(e.target.value)||0)} style={{...S.inp(),width:80,flex:"0 0 80px"}}/>
                  <span style={{fontSize:12,color:C.gray,flexShrink:0}}>%</span>
                  {f.deptShares.length>1 && <button onClick={()=>removeShare(i)} style={{background:"none",border:"none",cursor:"pointer",color:C.red,fontSize:15,flexShrink:0}}>✕</button>}
                </div>
              ))}
              <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4,flexWrap:"wrap"}}>
                <button onClick={addShare} style={{...S.btn(C.navyL,C.navyM),padding:"4px 9px",fontSize:11}}>+ 본부 추가</button>
                <button onClick={equalizeShares} style={{...S.btn(C.grayL,C.gray),padding:"4px 9px",fontSize:11}}>균등분배</button>
                <span style={{fontSize:11,color: shareSum===100?C.green:C.red,fontWeight:600}}>합계 {shareSum}% {shareSum===100?"✓":"(100%이어야 함)"}</span>
              </div>
            </div>
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
            <div style={S.grid(3,9)}>
              <F label="계약일" val={f.contractDate} onChange={v=>u("contractDate",v)} type="date"/>
              <F label="수주일(계약금10%수령)" val={f.orderDate} onChange={v=>u("orderDate",v)} type="date"/>
              <F label="발주 구분" val={f.orderType} onChange={v=>u("orderType",v)} type="select" opts={["민간","공공"]}/>
            </div>
            <div style={S.grid(3,9)}>
              <F label="수주 형태 (외주비 비교 기준)" val={f.bidType} onChange={v=>u("bidType",v)} type="select" opts={bidTypes||BID_TYPES}/>
            </div>
            <F label="주소" val={f.address} onChange={v=>u("address",v)}/><F label="비고" val={f.note} onChange={v=>u("note",v)}/>
          </>},
        ].map(({title,content})=><div key={title} style={{marginBottom:16}}><div style={{fontSize:11,fontWeight:500,color:C.navyM,marginBottom:8,paddingBottom:3,borderBottom:`1px solid ${C.navyL}`}}>{title}</div>{content}</div>)}
        <div style={{display:"flex",gap:7,marginTop:14,alignItems:"center"}}>
          <button onClick={()=>onSave({...f,shareRatio:f.shareRatio/100,depts:f.deptShares.map(s=>s.dept)})} style={S.btn(C.navyM)}>{initial?"✓ 저장":"✓ 등록"}</button>
          <button onClick={onClose} style={S.btn(C.grayL,C.gray)}>취소</button>
          {shareSum!==100 && <span style={{fontSize:11.5,color:C.red}}>본부 지분율 합계가 100%가 아닙니다 ({shareSum}%)</span>}
        </div>
      </div>
    </div>
  )
}

function NewVerModal({proj,onClose,onSave}) {
  const last = proj.versions[proj.versions.length-1]
  const nextRound = (proj.versions.reduce((mx,v)=>Math.max(mx,v.round||0),0)||0)+1

  // 기본 필드
  const [round,setRound]   = useState(nextRound)
  const [ver,setVer]       = useState(`${nextRound}차 실행계획서`)
  const [date,setDate]     = useState(new Date().toISOString().slice(0,10))
  const [reason,setReason] = useState("")
  const [laborCost,setLaborCost] = useState(last?.laborCost||0)
  const [directExp,setDirectExp] = useState(last?.directExp||0)
  const [indirect,setIndirect]   = useState(last?.indirect||null)
  const [profit,setProfit]       = useState(last?.profit||null)

  // 협력업체 목록 (추가/수정/삭제 가능)
  const [vendors,setVendors] = useState((last?.vendors||[]).map(v=>({...v})))
  const [editVi,setEditVi]   = useState(null)  // 편집 중인 행 index
  const [newV,setNewV]       = useState({cat:"",name:"",contract:0,nego1:0,nego2:0})
  const [showAddV,setShowAddV] = useState(false)
  const [tab,setTab2] = useState("basic")  // basic | vendors

  const pnl = calcPnlTotals({laborCost,directExp,subContract:vendors.reduce((s,v)=>s+Math.max(v.nego2||0,v.nego1||0,v.contract||0),0),indirect,profit})
  const subTotal = vendors.reduce((s,v)=>s+Math.max(v.nego2||0,v.nego1||0,v.contract||0),0)

  const addVendor = () => {
    if(!newV.cat.trim()&&!newV.name.trim()) return
    setVendors(p=>[...p,{...newV,contract:Number(newV.contract)||0,nego1:Number(newV.nego1)||0,nego2:Number(newV.nego2)||0}])
    setNewV({cat:"",name:"",contract:0,nego1:0,nego2:0}); setShowAddV(false)
  }
  const updateV = (i,k,v) => setVendors(p=>p.map((x,xi)=>xi===i?{...x,[k]:typeof v==="string"&&k!=="cat"&&k!=="name"?Number(v)||0:v}:x))
  const removeV = i => setVendors(p=>p.filter((_,xi)=>xi!==i))
  const moveV   = (i,d) => setVendors(p=>{ const a=[...p]; [a[i],a[i+d]]=[a[i+d],a[i]]; return a })

  const save = () => onSave({ver,round,date,reason,laborCost,directExp,subContract:subTotal,indirect,profit,vendors})

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:400,padding:20,overflowY:"auto"}}>
      <div style={{...S.card(),width:"100%",maxWidth:820,marginTop:20}}>
        {/* 헤더 */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontSize:18,fontWeight:700,color:C.navy}}>📋 실행계획서 작성</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.gray}}>✕</button>
        </div>

        {/* 탭 */}
        <div style={{display:"flex",gap:4,marginBottom:18,borderBottom:`2px solid var(--color-border-tertiary,#eee)`}}>
          {[["basic","📌 기본정보·비용"],["vendors","🤝 협력업체 외주비"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setTab2(id)} style={{padding:"9px 20px",border:"none",background:"none",fontSize:14,fontWeight:700,cursor:"pointer",color:tab===id?C.navyM:"var(--color-text-secondary,#888)",borderBottom:tab===id?`3px solid ${C.navyM}`:"3px solid transparent",marginBottom:-2}}>
              {lbl}
            </button>
          ))}
          {/* 요약 뱃지 */}
          <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center",fontSize:13,color:C.navyM,fontWeight:600}}>
            <span style={{...S.bdg(C.navyL,C.navyM)}}>이윤 {fE(pnl.profit/1e8)}</span>
            <span style={{...S.bdg(C.greenL||"#EAF3DE",C.green)}}>합계 {fE(pnl.total/1e8)}</span>
          </div>
        </div>

        {/* 기본정보·비용 탭 */}
        {tab==="basic" && <>
          <div style={S.grid(4,12)}>
            <div><label style={S.lbl()}>회차</label><input type="number" value={round} onChange={e=>setRound(parseInt(e.target.value)||1)} style={S.inp()}/></div>
            <div style={{gridColumn:"span 2"}}><label style={S.lbl()}>버전명</label><input value={ver} onChange={e=>setVer(e.target.value)} style={S.inp()}/></div>
            <div><label style={S.lbl()}>작성일</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={S.inp()}/></div>
            <div style={{gridColumn:"span 4"}}><label style={S.lbl()}>변경사유</label><input value={reason} onChange={e=>setReason(e.target.value)} placeholder="예: 협력업체 재선정, 설계변경 등" style={S.inp()}/></div>
          </div>

          <div style={{fontSize:14,fontWeight:700,color:C.navyM,margin:"16px 0 10px",paddingBottom:4,borderBottom:`2px solid ${C.navyL}`}}>💰 비용 구성</div>
          <div style={S.grid(3,12)}>
            <div>
              <label style={S.lbl()}>직접인건비 (원)</label>
              <input type="number" value={laborCost} onChange={e=>setLaborCost(parseInt(e.target.value)||0)} style={S.inp()}/>
              <div style={{fontSize:12,color:C.navyM,marginTop:4}}>{fE(laborCost/1e8)}억</div>
            </div>
            <div>
              <label style={S.lbl()}>직접경비 (원)</label>
              <input type="number" value={directExp} onChange={e=>setDirectExp(parseInt(e.target.value)||0)} style={S.inp()}/>
              <div style={{fontSize:12,color:C.navyM,marginTop:4}}>{fE(directExp/1e8)}억</div>
            </div>
            <div>
              <label style={S.lbl()}>외주용역비 (자동합산)</label>
              <div style={{...S.inp(),background:"var(--color-background-secondary,#f5f5f3)",color:C.navyM,fontWeight:700,cursor:"default"}}>{subTotal.toLocaleString()}</div>
              <div style={{fontSize:12,color:C.navyM,marginTop:4}}>{fE(subTotal/1e8)}억 ({vendors.length}개 업체)</div>
            </div>
            <div>
              <label style={S.lbl()}>간접비 (0이면 자동: 인건비×110%)</label>
              <input type="number" value={indirect||""} onChange={e=>setIndirect(parseInt(e.target.value)||null)} placeholder="0이면 자동" style={S.inp()}/>
              <div style={{fontSize:12,color:C.gray,marginTop:4}}>자동: {fE(Math.round((laborCost||0)*1.1))}</div>
            </div>
            <div>
              <label style={S.lbl()}>이윤 (0이면 자동: 직접비×8.3%)</label>
              <input type="number" value={profit||""} onChange={e=>setProfit(parseInt(e.target.value)||null)} placeholder="0이면 자동" style={S.inp()}/>
              <div style={{fontSize:12,color:C.gray,marginTop:4}}>자동: {fE(Math.round(pnl.direct*0.083)/1e8)}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
              <div style={{background:C.navyL,borderRadius:10,padding:"12px 16px"}}>
                <div style={{fontSize:12,color:C.navyM,marginBottom:4}}>예상 합계</div>
                <div style={{fontSize:22,fontWeight:800,color:C.navy}}>{fE(pnl.total/1e8)}</div>
                <div style={{fontSize:12,color:C.gray,marginTop:2}}>
                  직접{fE(pnl.direct/1e8)} + 간접{fE(pnl.indirect/1e8)} + 이윤{fE(pnl.profit/1e8)}
                </div>
              </div>
            </div>
          </div>

          {proj.serviceFee>0 && (
            <div style={{marginTop:10,padding:"10px 14px",borderRadius:9,background:C.greenL||"#EAF3DE",fontSize:13}}>
              💡 용역비 대비 이윤율: <b style={{color:C.green,fontSize:15}}>{(pnl.profit/proj.serviceFee*100).toFixed(1)}%</b>
              <span style={{color:C.gray,marginLeft:8}}>(용역비 {fE(proj.serviceFee)})</span>
            </div>
          )}
        </>}

        {/* 협력업체 탭 */}
        {tab==="vendors" && <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:C.navyM}}>협력업체 목록 — 총 {fE(subTotal/1e8)}억 ({vendors.length}개)</div>
            <button onClick={()=>setShowAddV(v=>!v)} style={{...S.btn(C.green),padding:"7px 14px"}}>+ 협력업체 추가</button>
          </div>

          {/* 추가 폼 */}
          {showAddV && (
            <div style={{background:C.navyL,borderRadius:10,padding:"14px 16px",marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:700,color:C.navyM,marginBottom:10}}>새 협력업체 추가</div>
              <div style={S.grid(5,10)}>
                <div><label style={S.lbl()}>분야</label><input value={newV.cat} onChange={e=>setNewV(p=>({...p,cat:e.target.value}))} placeholder="예: 구조" style={S.inp()}/></div>
                <div style={{gridColumn:"span 2"}}><label style={S.lbl()}>업체명</label><input value={newV.name} onChange={e=>setNewV(p=>({...p,name:e.target.value}))} placeholder="업체명" style={S.inp()}/></div>
                <div><label style={S.lbl()}>원가견적(원)</label><input type="number" value={newV.contract||""} onChange={e=>setNewV(p=>({...p,contract:e.target.value}))} style={S.inp()}/></div>
                <div><label style={S.lbl()}>1차NEGO(원)</label><input type="number" value={newV.nego1||""} onChange={e=>setNewV(p=>({...p,nego1:e.target.value}))} style={S.inp()}/></div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={addVendor} style={S.btn(C.navyM)}>추가</button>
                <button onClick={()=>setShowAddV(false)} style={S.btn(C.grayL,C.gray)}>취소</button>
              </div>
            </div>
          )}

          {/* 협력업체 목록 테이블 */}
          {vendors.length===0
            ? <div style={{padding:"30px",textAlign:"center",color:C.gray,fontSize:14,background:"var(--color-background-secondary,#f8f8f6)",borderRadius:10}}>
                아직 협력업체가 없습니다. "+ 협력업체 추가"로 등록하세요.
              </div>
            : <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
                  <thead>
                    <tr>
                      {["순서","분야","업체명","원가견적(원)","1차NEGO","2차NEGO","적용금액",""].map((h,i)=>(
                        <th key={i} style={{...S.th(i<2?"left":"right"),fontSize:13}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v,i)=>{
                      const applied = v.nego2||v.nego1||v.contract||0
                      return editVi===i
                        ? <tr key={i} style={{background:C.navyL}}>
                            <td style={S.td()} colSpan={8}>
                              <div style={S.grid(6,8)}>
                                <div><label style={S.lbl()}>분야</label><input value={v.cat} onChange={e=>updateV(i,"cat",e.target.value)} style={S.inp()}/></div>
                                <div style={{gridColumn:"span 2"}}><label style={S.lbl()}>업체명</label><input value={v.name} onChange={e=>updateV(i,"name",e.target.value)} style={S.inp()}/></div>
                                <div><label style={S.lbl()}>원가견적</label><input type="number" value={v.contract||""} onChange={e=>updateV(i,"contract",e.target.value)} style={S.inp()}/></div>
                                <div><label style={S.lbl()}>1차NEGO</label><input type="number" value={v.nego1||""} onChange={e=>updateV(i,"nego1",e.target.value)} style={S.inp()}/></div>
                                <div><label style={S.lbl()}>2차NEGO</label><input type="number" value={v.nego2||""} onChange={e=>updateV(i,"nego2",e.target.value)} style={S.inp()}/></div>
                              </div>
                              <div style={{display:"flex",gap:8,marginTop:8}}>
                                <button onClick={()=>setEditVi(null)} style={S.btn(C.navyM)}>✓ 완료</button>
                                <button onClick={()=>removeV(i)} style={S.btn(C.redL,C.red)}>삭제</button>
                              </div>
                            </td>
                          </tr>
                        : <tr key={i} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                            <td style={S.td("center")}>
                              <div style={{display:"flex",gap:3}}>
                                <button onClick={()=>i>0&&moveV(i,-1)} style={{background:"none",border:"none",cursor:"pointer",color:C.gray,fontSize:13}}>▲</button>
                                <button onClick={()=>i<vendors.length-1&&moveV(i,1)} style={{background:"none",border:"none",cursor:"pointer",color:C.gray,fontSize:13}}>▼</button>
                              </div>
                            </td>
                            <td style={{...S.td("left"),fontWeight:600}}>{v.cat||"-"}</td>
                            <td style={{...S.td("left")}}>{v.name||"-"}</td>
                            <td style={S.td()}>{v.contract>0?v.contract.toLocaleString():"-"}</td>
                            <td style={{...S.td(),color:v.nego1>0?C.amber:"var(--color-text-secondary,#aaa)"}}>{v.nego1>0?v.nego1.toLocaleString():"-"}</td>
                            <td style={{...S.td(),color:v.nego2>0?C.red:"var(--color-text-secondary,#aaa)"}}>{v.nego2>0?v.nego2.toLocaleString():"-"}</td>
                            <td style={{...S.td(),fontWeight:800,color:C.navyM}}>{applied.toLocaleString()}</td>
                            <td style={S.td("center")}>
                              <button onClick={()=>setEditVi(i)} style={{...S.btn(C.navyL,C.navyM),padding:"4px 10px",fontSize:12}}>수정</button>
                            </td>
                          </tr>
                    })}
                    <tr style={{background:"var(--color-background-secondary,#f0f0ee)",fontWeight:800}}>
                      <td colSpan={6} style={{...S.td("left"),color:C.navyM}}>합계 ({vendors.length}개 업체)</td>
                      <td style={{...S.td(),color:C.navyM,fontSize:16}}>{subTotal.toLocaleString()}</td>
                      <td/>
                    </tr>
                  </tbody>
                </table>
              </div>
          }
          <div style={{marginTop:12,padding:"10px 14px",borderRadius:9,background:C.amberL||"#FAEEDA",fontSize:13,color:C.amber}}>
            💡 협력업체 탭에서 NEGO 금액을 입력하면 적용금액(2차NEGO→1차NEGO→원가견적 순)이 자동으로 외주용역비 합계에 반영됩니다.
          </div>
        </>}

        <div style={{display:"flex",gap:8,marginTop:20,paddingTop:16,borderTop:`1px solid var(--color-border-tertiary,#eee)`}}>
          <button onClick={save} style={{...S.btn(C.navyM),padding:"11px 24px",fontSize:15}}>✓ 저장</button>
          <button onClick={onClose} style={{...S.btn(C.grayL,C.gray),padding:"11px 24px",fontSize:15}}>취소</button>
          <div style={{marginLeft:"auto",fontSize:13,color:C.gray,alignSelf:"center"}}>
            회차 {round}차 · 직접{fE(pnl.direct/1e8)} · 간접{fE(pnl.indirect/1e8)} · 이윤{fE(pnl.profit/1e8)} · <b style={{color:C.navy}}>합계 {fE(pnl.total/1e8)}</b>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 공통 컴포넌트 ────────────────────────────────────────────
function Card({title,note,actions,children,style={}}) {
  return <div style={{...S.card(),...style}}>
    {title&&<div style={{fontSize:16,fontWeight:700,marginBottom:13,display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:6,flexWrap:"wrap"}}>
      <span>{title}</span>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {note&&<span style={{fontSize:13,color:"var(--color-text-tertiary,#aaa)",fontWeight:400}}>{note}</span>}
        {actions}
      </div>
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

// ── 업무매뉴얼 플레이스홀더 (추후 AI 연동 시 ManualTab으로 교체) ──
function ManualPlaceholder() {
  return (
    <div style={{padding:"40px",textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:16}}>📚</div>
      <div style={{fontSize:22,fontWeight:800,color:"#111827",marginBottom:8}}>업무매뉴얼</div>
      <div style={{fontSize:15,color:"#6B7280",lineHeight:1.8,maxWidth:520,margin:"0 auto"}}>
        업무 매뉴얼 PDF를 업로드하여 전직원이 언제 어디서나 열람할 수 있는 공간입니다.<br/>
        현재는 파일 보관 기능만 제공하며, <b>ANTHROPIC_API_KEY</b> 설정 시 AI 질의응답 기능이 활성화됩니다.
      </div>
      <div style={{marginTop:24,display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
        {["업무매뉴얼 v7.0","계약서 양식","실행계획서 가이드","외주비 정산 절차","결재 프로세스"].map((t,i)=>(
          <div key={i} style={{padding:"10px 18px",background:"#EEF3FF",color:"#3B72F6",borderRadius:20,fontSize:14,fontWeight:600}}>{t}</div>
        ))}
      </div>
    </div>
  )
}

// ── 설계용역 표준계약서 생성 탭 ────────────────────────────────
function ContractTab({projects, currentUser}) {
  const [selProjId, setSelProjId] = useState(projects[0]?.id||"")
  const proj = projects.find(p=>p.id===selProjId)

  // 계약서 변수 (프로젝트에서 자동 채우기 + 수동 수정 가능)
  const [form, setForm] = useState({
    contractDate:"",
    contractTitle:"",
    siteAddr:"",
    usage:"",
    structure:"철근콘크리트조",
    scale:"",
    siteArea:"",
    floorArea:"",
    totalFee:"",
    // 갑 (발주처)
    gabName:"",
    gabCeo:"",
    gabRegNo:"",
    gabAddr:"",
    gabTel:"",
    // 을 (상지서울)
    eulName:"(주)상지서울건축사사무소",
    eulCeo:"허 동 윤",
    eulRegNo:"602-81-08127",
    eulAddr:"서울특별시 강남구 자곡로 174-10 강남에이스타워 909호",
    eulTel:"02) 6011-1642",
    // 대금 지불 일정
    payments:[
      {stage:"용역계약 시",     ratio:20, note:"계약일로부터 7일 이내 현금"},
      {stage:"건축(통합)심의 접수 시",ratio:20, note:""},
      {stage:"건축허가 접수 시",ratio:30, note:""},
      {stage:"착공신고 접수 시",ratio:25, note:""},
      {stage:"사용승인 접수 시",ratio:5,  note:""},
    ]
  })
  const u = (k,v) => setForm(p=>({...p,[k]:v}))
  const [generating, setGenerating] = useState(false)

  // 프로젝트 선택 시 자동 채우기
  const autoFill = (p) => {
    if(!p) return
    setForm(prev=>({...prev,
      contractTitle: p.name||"",
      siteAddr: p.address||"",
      usage: p.usage||"",
      scale: p.scale||"",
      siteArea: p.siteArea?`${p.siteArea.toLocaleString()}m²`:prev.siteArea,
      floorArea: p.floorArea?`${p.floorArea.toLocaleString()}m²`:prev.floorArea,
      totalFee: p.serviceFee?p.serviceFee.toLocaleString():prev.totalFee,
      gabName: p.client||prev.gabName,
      contractDate: p.contractDate||prev.contractDate,
    }))
  }

  // 지불금액 자동계산
  const feeNum = parseInt((form.totalFee||"").replace(/[^0-9]/g,""))||0
  const payments = form.payments.map(p=>({...p, amount: Math.round(feeNum*p.ratio/100)}))
  const totalRatio = form.payments.reduce((s,p)=>s+p.ratio,0)

  // Word(.docx) 생성
  const generateContract = async () => {
    setGenerating(true)
    try {
      const {
        Document: D, Packer, Paragraph: P2, TextRun: TR,
        Table: T2, TableRow: TR2, TableCell: TC, AlignmentType: AT,
        BorderStyle: BS, WidthType: WT, ShadingType: ST, VerticalAlign: VA,
        Header: H2, Footer: F2, PageNumber: PN, UnderlineType
      } = await import("docx")

      const W2 = 9360
      const BD = {style:BS.SINGLE,size:6,color:"888888"}
      const BDS = {top:BD,bottom:BD,left:BD,right:BD}
      const c = (txt,opts={})=>new TC({
        borders:BDS, verticalAlign:VA.CENTER,
        margins:{top:80,bottom:80,left:120,right:120},
        shading:opts.shade?{fill:opts.shade,type:ST.CLEAR}:undefined,
        width:opts.w?{size:opts.w,type:WT.DXA}:undefined,
        rowSpan:opts.rs, columnSpan:opts.cs,
        children:[new P2({alignment:opts.align||AT.CENTER,children:[new TR({
          text:String(txt||""),font:"맑은 고딕",size:opts.sz||19,bold:!!opts.bold,color:opts.color||"000000"
        })]})]
      })
      const p = (txt,opts={})=>new P2({
        alignment:opts.align||AT.LEFT,
        spacing:{before:opts.before||0,after:opts.after||120},
        indent:opts.indent?{left:opts.indent}:undefined,
        children:[new TR({text:String(txt||""),font:"맑은 고딕",size:opts.sz||19,bold:!!opts.bold,color:opts.color||"000000",underline:opts.ul?{type:UnderlineType.SINGLE}:undefined})]
      })
      const ttl = (txt)=>p(txt,{align:AT.CENTER,sz:28,bold:true,before:240,after:120})
      const h1 = (txt)=>p(txt,{sz:21,bold:true,before:200,after:80,color:"1A3B6E"})
      const hr = ()=>new P2({border:{bottom:{style:BS.SINGLE,size:4,color:"CCCCCC",space:1}},children:[new TR({text:"",font:"맑은 고딕",size:8})]})
      const sp = (n=1)=>[...Array(n)].map(()=>p("",{before:0,after:60}))

      // 계약금액 한글 표기 (간단 버전)
      const feeWon = feeNum>0?feeNum.toLocaleString("ko-KR")+"원":"-"
      const todayStr = form.contractDate || new Date().toLocaleDateString("ko-KR").replace(/\./g,".").replace(/\s/g,"")

      const children = [
        // 표지
        p("건 축 물 의  설 계  표 준  계 약 서",{align:AT.CENTER,sz:22,color:"666666",before:120,after:60}),
        ...sp(1),
        ttl("설  계  용  역  계  약  서"),
        p(form.contractTitle,{align:AT.CENTER,sz:22,before:60,after:240}),
        ...sp(2),
        p(todayStr,{align:AT.CENTER,sz:20,before:0,after:60}),
        ...sp(1),
        p(form.gabName||"발주처",{align:AT.CENTER,sz:20,bold:true}),
        p(form.eulName,{align:AT.CENTER,sz:20,bold:true}),
        ...sp(3),

        // 계약 조건 표
        h1("■ 계약 조건"),
        new T2({width:{size:W2,type:WT.DXA},columnWidths:[2000,7360],rows:[
          new TR2({children:[c("1. 용역명",{w:2000,shade:"F3F4F6",bold:true,align:AT.LEFT}),c(form.contractTitle,{w:7360,align:AT.LEFT})]}),
          new TR2({children:[c("2. 대지위치",{w:2000,shade:"F3F4F6",bold:true,align:AT.LEFT}),c(form.siteAddr,{w:7360,align:AT.LEFT})]}),
          new TR2({children:[c("3. 설계내용",{w:2000,shade:"F3F4F6",bold:true,align:AT.LEFT,rs:5}),c(`① 대지면적 : ${form.siteArea}`,{w:7360,align:AT.LEFT})]}),
          new TR2({children:[c(`② 용도 : ${form.usage}`,{w:7360,align:AT.LEFT})]}),
          new TR2({children:[c(`③ 구조 : ${form.structure}`,{w:7360,align:AT.LEFT})]}),
          new TR2({children:[c(`④ 규모 : ${form.scale}`,{w:7360,align:AT.LEFT})]}),
          new TR2({children:[c(`⑤ 연면적 : ${form.floorArea}`,{w:7360,align:AT.LEFT})]}),
          new TR2({children:[c("4. 계약금액",{w:2000,shade:"F3F4F6",bold:true,align:AT.LEFT}),c(`일금 ${feeWon} (부가세 별도)`,{w:7360,align:AT.LEFT,bold:true})]}),
        ]}),
        ...sp(2),

        p('"갑" 과 "을"은 상호 신의와 성실을 원칙으로 이 계약서에 의하여 설계계약을 체결하고 각 1부씩 보관한다.',{sz:18,before:120,after:200}),

        // 당사자
        new T2({width:{size:W2,type:WT.DXA},columnWidths:[4500,360,4500],rows:[
          new TR2({children:[
            c('"갑" (발주처)',{w:4500,shade:"EEF3FF",bold:true,sz:20}),
            c("",{w:360}),
            c('"을" (수급인)',{w:4500,shade:"EEF3FF",bold:true,sz:20}),
          ]}),
          new TR2({children:[
            c(`상호/성명 : ${form.gabName} / 대표이사 ${form.gabCeo} (인)`,{w:4500,align:AT.LEFT}),
            c("",{w:360}),
            c(`상호/성명 : ${form.eulName} / 대표이사 ${form.eulCeo} (인)`,{w:4500,align:AT.LEFT}),
          ]}),
          new TR2({children:[
            c(`사업자등록번호 : ${form.gabRegNo}`,{w:4500,align:AT.LEFT}),
            c("",{w:360}),
            c(`사업자등록번호 : ${form.eulRegNo}`,{w:4500,align:AT.LEFT}),
          ]}),
          new TR2({children:[
            c(`주소 : ${form.gabAddr}`,{w:4500,align:AT.LEFT}),
            c("",{w:360}),
            c(`주소 : ${form.eulAddr}`,{w:4500,align:AT.LEFT}),
          ]}),
          new TR2({children:[
            c(`전화번호 : ${form.gabTel}`,{w:4500,align:AT.LEFT}),
            c("",{w:360}),
            c(`전화번호 : ${form.eulTel}`,{w:4500,align:AT.LEFT}),
          ]}),
        ]}),

        new P2({children:[],pageBreakBefore:true}),

        // 계약 일반 조건
        h1("계약 일반 조건"),
        hr(),
        p("제1조(총칙)  이 계약은 건축법 제9조의2 및 건축사 용역의 범위와 대가기준에 의하여 건축주(이하 \"갑\"이라 한다)가 건축사법 제23조 제1항의 규정에 의하여 업무신고한 건축사(이하 \"을\"이라 한다)에게 위탁한 설계업무의 수행에 필요한 상호간의 권리와 의무등을 정한다.",{sz:18,after:80}),
        p(`제2조(계약면적 및 용역기간)`,{sz:18,bold:true,after:40}),
        p(`① 계약면적("을"이 총괄하여 작성한 전체 설계면적) : ${form.floorArea}`,{sz:18,after:40,indent:400}),
        p(`② 대가기간 : 계약체결일로부터 사용승인완료시까지`,{sz:18,after:80,indent:400}),
        p("제3조(계약의 범위)",{sz:18,bold:true,after:40}),
        p("① 계약의 범위 등은 [별표1]의 \"계약 및 업무의 범위\"를 참고하여 결정한다.",{sz:18,after:40,indent:400}),
        p("② 준공도서 및 건축물관리대장 작성 등의 설계업무를 위해 필요한 세부 사항은 \"갑\"과 \"을\"이 협의하여 정한다.",{sz:18,after:80,indent:400}),
        p("제4조(대가의 산출 및 지불방법)",{sz:18,bold:true,after:40}),
        p("① 설계업무에 대한 대가의 산출기준 및 방법은 대가기준에 의한다.",{sz:18,after:40,indent:400}),
        p("② 대가를 분할하여 지불하는 경우에 그 지불시기 및 지불금액은 다음과 같이 이행함을 원칙으로 하되, \"갑\"과 \"을\"이 협의하여 추가·조정할 수 있다.",{sz:18,after:80,indent:400}),
        ...sp(1),

        // 지불 일정 표
        new T2({width:{size:W2,type:WT.DXA},columnWidths:[2800,1000,2400,3160],rows:[
          new TR2({children:[
            c("지  불  시  기",{w:2800,shade:"1A3B6E",bold:true,color:"FFFFFF"}),
            c("지불비율",{w:1000,shade:"1A3B6E",bold:true,color:"FFFFFF"}),
            c("지  불  금  액",{w:2400,shade:"1A3B6E",bold:true,color:"FFFFFF"}),
            c("비       고",{w:3160,shade:"1A3B6E",bold:true,color:"FFFFFF"}),
          ]}),
          ...payments.map((row,i)=>new TR2({children:[
            c(row.stage,{w:2800,align:AT.LEFT}),
            c(`${row.ratio}%`,{w:1000}),
            c(row.amount>0?`₩ ${row.amount.toLocaleString()}`:"-",{w:2400}),
            c(row.note,{w:3160,align:AT.LEFT,sz:17}),
          ]})),
          new TR2({children:[
            c("계",{w:2800,shade:"F3F4F6",bold:true}),
            c(`${totalRatio}%`,{w:1000,shade:"F3F4F6",bold:true}),
            c(`₩ ${feeNum.toLocaleString()}`,{w:2400,shade:"F3F4F6",bold:true}),
            c("부가가치세 별도",{w:3160,shade:"F3F4F6",sz:17}),
          ]}),
        ]}),
        ...sp(1),
        p("③ (지연손해금) \"갑\"이 본 조 제2항에서 정한 지급기일을 경과하여 대금을 지급하는 경우, 미지급 금액에 대하여 지급기일 다음 날부터 완제일까지 일 0.1%를 지연손해금으로 가산하여 지급하여야 한다.",{sz:18,after:40,indent:400}),
        p("④ (지급과 성과물 인도의 관계) 최종 잔금의 경우 \"갑\"이 \"을\"에게 입금을 완료한 후 1일 이내에 \"을\"은 최종 설계도서를 인도하는 것을 원칙으로 한다.",{sz:18,after:40,indent:400}),
        p("⑤ (업무 정지권) \"갑\"이 대금 지급을 14일 이상 지체할 경우, \"을\"은 서면 통보 후 즉시 용역 업무를 일시 정지할 수 있다.",{sz:18,after:80,indent:400}),
        p("제5조(대가의 조정)  설계업무의 수행기간이 1년을 초과하는 경우 노임단가 변경 시 \"갑\"과 \"을\"이 협의하여 대가를 조정할 수 있다. \"갑\"의 사유로 계약면적이 5% 이상 증감되는 경우 해당금액을 정산한다.",{sz:18,after:80}),
        p("제6조~제15조  — 계약 일반 조건 본문 참조 (건축물의 설계 표준 계약서 기준 적용)",{sz:18,color:"888888",after:80}),
        ...sp(2),
        new P2({alignment:AT.RIGHT,spacing:{before:240,after:60},children:[new TR({text:todayStr,font:"맑은 고딕",size:20})]}),
        new P2({alignment:AT.RIGHT,spacing:{before:0,after:180},children:[new TR({text:`"갑" ${form.gabName}  /  "을" ${form.eulName}`,font:"맑은 고딕",size:20})]}),
      ]

      const doc = new D({
        styles:{default:{document:{run:{font:"맑은 고딕",size:19}}}},
        sections:[{
          properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134}}},
          headers:{default:new H2({children:[new P2({alignment:AT.RIGHT,border:{bottom:{style:BS.SINGLE,size:4,color:"BBBBBB",space:1}},spacing:{after:80},children:[new TR({text:"설계용역 표준계약서  |  상지서울건축사사무소",font:"맑은 고딕",size:15,color:"888888"})]})]}),},
          footers:{default:new F2({children:[new P2({alignment:AT.CENTER,border:{top:{style:BS.SINGLE,size:4,color:"BBBBBB",space:1}},children:[new TR({text:"- ",font:"맑은 고딕",size:15,color:"888888"}),new TR({children:[PN.CURRENT],font:"맑은 고딕",size:15,color:"888888"}),new TR({text:" -",font:"맑은 고딕",size:15,color:"888888"})]})]}),},
          children
        }]
      })
      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `설계용역계약서_${form.contractTitle||"초안"}_${todayStr}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch(e) { alert("생성 오류: "+e.message) }
    setGenerating(false)
  }

  const lbl2 = (t)=>({display:"block",fontSize:13,fontWeight:700,color:"#6B7280",marginBottom:5})
  const inp2 = {padding:"10px 14px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:14,width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none"}
  const card2 = {background:"#fff",border:"1px solid #E5E7EB",borderRadius:16,padding:"22px 26px",marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      {/* 헤더 */}
      <div style={{...card2,background:"linear-gradient(135deg,#1A3B6E,#3B72F6)",color:"#fff"}}>
        <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>📄 설계용역 표준계약서 생성</div>
        <div style={{fontSize:14,opacity:.85}}>변경 항목만 수정하면 바로 사용 가능한 표준계약서를 Word(.docx)로 생성합니다.</div>
      </div>

      {/* 프로젝트 자동채우기 */}
      <div style={card2}>
        <div style={{fontSize:16,fontWeight:800,color:"#111827",marginBottom:12}}>⚡ 프로젝트 정보 자동 불러오기</div>
        <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
          <div style={{flex:1}}>
            <label style={lbl2()}>등록된 프로젝트에서 정보 가져오기</label>
            <select value={selProjId} onChange={e=>setSelProjId(e.target.value)} style={inp2}>
              <option value="">— 직접 입력 —</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={()=>autoFill(proj)} style={{...S.btn(),padding:"11px 20px",flexShrink:0}} disabled={!proj}>
            자동 채우기
          </button>
        </div>
      </div>

      {/* 계약 기본정보 */}
      <div style={card2}>
        <div style={{fontSize:16,fontWeight:800,color:"#111827",marginBottom:16}}>1. 계약 기본정보</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div><label style={lbl2()}>계약일자</label><input type="date" value={form.contractDate} onChange={e=>u("contractDate",e.target.value)} style={inp2}/></div>
          <div><label style={lbl2()}>계약금액 (원, VAT별도)</label><input value={form.totalFee} onChange={e=>u("totalFee",e.target.value)} placeholder="예: 2,378,000,000" style={inp2}/></div>
          <div style={{gridColumn:"span 2"}}><label style={lbl2()}>용역명 (계약 제목)</label><input value={form.contractTitle} onChange={e=>u("contractTitle",e.target.value)} placeholder="예: 청량리 주상복합 건설사업 용역" style={inp2}/></div>
          <div style={{gridColumn:"span 2"}}><label style={lbl2()}>대지위치</label><input value={form.siteAddr} onChange={e=>u("siteAddr",e.target.value)} style={inp2}/></div>
          <div><label style={lbl2()}>용도</label><input value={form.usage} onChange={e=>u("usage",e.target.value)} style={inp2}/></div>
          <div><label style={lbl2()}>구조</label><input value={form.structure} onChange={e=>u("structure",e.target.value)} style={inp2}/></div>
          <div><label style={lbl2()}>규모</label><input value={form.scale} onChange={e=>u("scale",e.target.value)} placeholder="지하 7층 / 지상 25층" style={inp2}/></div>
          <div><label style={lbl2()}>대지면적</label><input value={form.siteArea} onChange={e=>u("siteArea",e.target.value)} style={inp2}/></div>
          <div><label style={lbl2()}>연면적</label><input value={form.floorArea} onChange={e=>u("floorArea",e.target.value)} style={inp2}/></div>
        </div>
      </div>

      {/* 갑 정보 */}
      <div style={card2}>
        <div style={{fontSize:16,fontWeight:800,color:"#111827",marginBottom:16}}>2. "갑" (발주처) 정보</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div><label style={lbl2()}>상호/회사명</label><input value={form.gabName} onChange={e=>u("gabName",e.target.value)} style={inp2}/></div>
          <div><label style={lbl2()}>대표자 성명</label><input value={form.gabCeo} onChange={e=>u("gabCeo",e.target.value)} placeholder="홍 길 동" style={inp2}/></div>
          <div><label style={lbl2()}>사업자등록번호</label><input value={form.gabRegNo} onChange={e=>u("gabRegNo",e.target.value)} style={inp2}/></div>
          <div><label style={lbl2()}>전화번호</label><input value={form.gabTel} onChange={e=>u("gabTel",e.target.value)} style={inp2}/></div>
          <div style={{gridColumn:"span 2"}}><label style={lbl2()}>주소</label><input value={form.gabAddr} onChange={e=>u("gabAddr",e.target.value)} style={inp2}/></div>
        </div>
      </div>

      {/* 을 정보 */}
      <div style={card2}>
        <div style={{fontSize:16,fontWeight:800,color:"#111827",marginBottom:4}}>3. "을" (상지서울) 정보</div>
        <div style={{fontSize:13,color:"#6B7280",marginBottom:14}}>기본값이 입력되어 있습니다. 변경 시 수정하세요.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div><label style={lbl2()}>상호명</label><input value={form.eulName} onChange={e=>u("eulName",e.target.value)} style={inp2}/></div>
          <div><label style={lbl2()}>대표자 성명</label><input value={form.eulCeo} onChange={e=>u("eulCeo",e.target.value)} style={inp2}/></div>
          <div><label style={lbl2()}>사업자등록번호</label><input value={form.eulRegNo} onChange={e=>u("eulRegNo",e.target.value)} style={inp2}/></div>
          <div><label style={lbl2()}>전화번호</label><input value={form.eulTel} onChange={e=>u("eulTel",e.target.value)} style={inp2}/></div>
          <div style={{gridColumn:"span 2"}}><label style={lbl2()}>주소</label><input value={form.eulAddr} onChange={e=>u("eulAddr",e.target.value)} style={inp2}/></div>
        </div>
      </div>

      {/* 대금 지불 일정 */}
      <div style={card2}>
        <div style={{fontSize:16,fontWeight:800,color:"#111827",marginBottom:14}}>4. 대금 지불 일정</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#F8FAFC"}}>
              <th style={{padding:"11px 14px",textAlign:"left",fontSize:13,fontWeight:700,color:"#6B7280",border:"1px solid #E5E7EB"}}>지불 시기</th>
              <th style={{padding:"11px 14px",textAlign:"center",fontSize:13,fontWeight:700,color:"#6B7280",border:"1px solid #E5E7EB",width:90}}>비율(%)</th>
              <th style={{padding:"11px 14px",textAlign:"right",fontSize:13,fontWeight:700,color:"#6B7280",border:"1px solid #E5E7EB",width:160}}>금액 (자동계산)</th>
              <th style={{padding:"11px 14px",textAlign:"left",fontSize:13,fontWeight:700,color:"#6B7280",border:"1px solid #E5E7EB"}}>비고</th>
            </tr></thead>
            <tbody>
              {form.payments.map((row,i)=>(
                <tr key={i}>
                  <td style={{padding:"8px 12px",border:"1px solid #E5E7EB"}}>
                    <input value={row.stage} onChange={e=>setForm(p=>({...p,payments:p.payments.map((r,ri)=>ri===i?{...r,stage:e.target.value}:r)}))} style={{...inp2,padding:"6px 10px",fontSize:13.5}}/>
                  </td>
                  <td style={{padding:"8px 12px",border:"1px solid #E5E7EB"}}>
                    <input type="number" value={row.ratio} onChange={e=>setForm(p=>({...p,payments:p.payments.map((r,ri)=>ri===i?{...r,ratio:parseInt(e.target.value)||0}:r)}))} style={{...inp2,padding:"6px 10px",fontSize:13.5,textAlign:"center"}}/>
                  </td>
                  <td style={{padding:"8px 12px",border:"1px solid #E5E7EB",textAlign:"right",fontWeight:700,color:"#3B72F6",fontSize:14}}>
                    {payments[i].amount>0?`₩ ${payments[i].amount.toLocaleString()}`:"-"}
                  </td>
                  <td style={{padding:"8px 12px",border:"1px solid #E5E7EB"}}>
                    <input value={row.note} onChange={e=>setForm(p=>({...p,payments:p.payments.map((r,ri)=>ri===i?{...r,note:e.target.value}:r)}))} style={{...inp2,padding:"6px 10px",fontSize:13.5}}/>
                  </td>
                </tr>
              ))}
              <tr style={{background:"#EEF3FF",fontWeight:700}}>
                <td style={{padding:"11px 14px",border:"1px solid #E5E7EB",fontSize:14}}>합계</td>
                <td style={{padding:"11px 14px",border:"1px solid #E5E7EB",textAlign:"center",fontSize:14,color:totalRatio===100?"#0EA86E":"#EF4444"}}>{totalRatio}% {totalRatio!==100&&"⚠"}</td>
                <td style={{padding:"11px 14px",border:"1px solid #E5E7EB",textAlign:"right",fontSize:15,color:"#1A3B6E"}}>₩ {feeNum.toLocaleString()}</td>
                <td style={{padding:"11px 14px",border:"1px solid #E5E7EB",fontSize:13,color:"#6B7280"}}>부가가치세 별도</td>
              </tr>
            </tbody>
          </table>
        </div>
        {totalRatio!==100&&<div style={{marginTop:8,color:"#EF4444",fontSize:13,fontWeight:600}}>⚠ 비율 합계가 {totalRatio}%입니다. 100%가 되어야 합니다.</div>}
      </div>

      {/* 생성 버튼 */}
      <div style={{...card2,textAlign:"center"}}>
        <button onClick={generateContract} disabled={generating||totalRatio!==100||!form.contractTitle||!form.gabName}
          style={{...S.btn(),padding:"14px 40px",fontSize:16,borderRadius:12,opacity:(generating||totalRatio!==100||!form.contractTitle||!form.gabName)?.5:1}}>
          {generating?"생성 중...":"📄 계약서 Word(.docx) 생성"}
        </button>
        <div style={{fontSize:12.5,color:"#6B7280",marginTop:10}}>
          생성된 파일을 한글(HWP)에서 열어 HWP로 저장하거나, Word에서 바로 사용하세요.<br/>
          기안 첨부, 이메일 발송, 인트라넷 업로드 등에 활용 가능합니다.
        </div>
      </div>
    </div>
  )
}

// ── 프로젝트 히스토리 페이지 (나무위키식 타임라인) ───────────────
function ProjectHistoryPage({projects, currentUser}) {
  const [selId, setSelId] = useState(projects[0]?.id||"")
  const proj = projects.find(p=>p.id===selId)
  const wr   = proj?.weeklyReport || {}

  // 모든 이벤트를 날짜순으로 통합
  const events = useMemo(()=>{
    if(!proj) return []
    const evts = []
    // 주요일정 로그
    ;(wr.scheduleLog||[]).forEach(e=>evts.push({
      date:e.date, type:"schedule", cat:e.category,
      title:e.content, memo:e.memo,
      by:e.createdBy, updatedBy:e.updatedBy,
      createdAt:e.createdAt, updatedAt:e.updatedAt
    }))
    // 실행계획서 버전
    ;(proj.versions||[]).forEach(v=>evts.push({
      date:v.date, type:"version", cat:`${v.round||""}차 실행계획서`,
      title:`${v.ver} 작성 (${v.reason||"업로드"})`,
      memo:`직접비 ${fE((v.laborCost||0)/1e8)} · 외주비 ${fE((v.subContract||0)/1e8)}`,
      by:null, createdAt:v.date+"T00:00:00"
    }))
    // AGENDA
    ;(wr.agendas||[]).forEach(ag=>(ag.items||[]).forEach(item=>evts.push({
      date:ag.week, type:"agenda", cat:"AGENDA",
      title:item.text?.split("\n")[0]?.slice(0,60),
      memo:item.done?"✅ 완료":null,
      by:null, createdAt:item.createdAt, updatedAt:item.updatedAt, updatedBy:null
    })))
    return evts.filter(e=>e.date).sort((a,b)=>a.date.localeCompare(b.date))
  },[proj,wr])

  const typeColor = {schedule:C.navyM, version:"#534AB7", agenda:C.amber}
  const typeIcon  = {schedule:"📅", version:"📋", agenda:"📌"}

  if(!proj) return <div style={{padding:40,textAlign:"center",color:"#6B7280"}}>프로젝트를 선택하세요.</div>

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      {/* 프로젝트 선택 */}
      <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",padding:"16px 22px",marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{fontSize:16,fontWeight:800,color:"#111827"}}>📜 프로젝트 히스토리</div>
          <select value={selId} onChange={e=>setSelId(e.target.value)}
            style={{flex:1,maxWidth:400,padding:"9px 12px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:14,fontFamily:"inherit"}}>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span style={{fontSize:13,color:"#6B7280"}}>총 {events.length}건</span>
        </div>
      </div>

      {/* 프로젝트 기본정보 뱃지 */}
      {proj && (
        <div style={{background:"linear-gradient(135deg,#1A3B6E,#3B72F6)",borderRadius:16,padding:"18px 24px",marginBottom:16,color:"#fff"}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>{proj.name}</div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:13,opacity:.85}}>
            <span>📍 {proj.address||"-"}</span>
            <span>👤 PM: {proj.pm||"-"}</span>
            <span>🏢 {proj.depts?.join(", ")||"-"}</span>
            <span>💰 용역비: {fE((proj.serviceFee||0)/1e8)}억</span>
          </div>
        </div>
      )}

      {/* 타임라인 */}
      {events.length===0
        ? <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",padding:"48px",textAlign:"center",color:"#6B7280",fontSize:14}}>
            아직 기록된 이력이 없습니다.<br/>
            📋 주간보고 → 주요일정에서 날짜별 이벤트를 등록하면 여기에 표시됩니다.
          </div>
        : <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",padding:"24px 28px",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
            <div style={{position:"relative",paddingLeft:20}}>
              {/* 세로선 */}
              <div style={{position:"absolute",left:6,top:0,bottom:0,width:2,background:"#E5E7EB",borderRadius:1}}/>
              {events.map((e,i)=>(
                <div key={i} style={{display:"flex",gap:14,marginBottom:14,position:"relative"}}>
                  {/* 도트 */}
                  <div style={{position:"absolute",left:-16,top:4,width:10,height:10,borderRadius:"50%",background:typeColor[e.type]||"#6B7280",border:"2px solid #fff",boxShadow:`0 0 0 2px ${typeColor[e.type]||"#6B7280"}`}}/>
                  {/* 내용 */}
                  <div style={{flex:1,borderLeft:`3px solid ${typeColor[e.type]||"#E5E7EB"}22`,paddingLeft:14}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
                      <div style={{width:90,fontSize:12.5,fontWeight:700,color:"#6B7280",flexShrink:0,paddingTop:2}}>
                        ▷ {e.date}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:e.memo?4:0}}>
                          <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:(typeColor[e.type]||"#6B7280")+"22",color:typeColor[e.type]||"#6B7280",fontWeight:700,flexShrink:0}}>
                            {typeIcon[e.type]} {e.cat}
                          </span>
                          <span style={{fontSize:14,fontWeight:600,color:"#111827"}}>{e.title}</span>
                        </div>
                        {e.memo&&<div style={{fontSize:12.5,color:"#6B7280",marginLeft:2}}>└ {e.memo}</div>}
                        <div style={{fontSize:11,color:"#9CA3AF",marginTop:3}}>
                          {e.by&&`${e.by} · `}{e.createdAt?new Date(e.createdAt).toLocaleString("ko-KR",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}):""}
                          {e.updatedAt&&e.updatedAt!==e.createdAt&&` · 수정: ${e.updatedBy||""} ${new Date(e.updatedAt).toLocaleString("ko-KR",{month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
      }
    </div>
  )
}

// ── 프로젝트 일정 캘린더 (전체 프로젝트 통합) ───────────────────
function ProjectCalendarPage({projects}) {
  const [viewYear,  setViewYear]  = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())  // 0-indexed
  const [selDate,   setSelDate]   = useState(null)

  // 모든 프로젝트의 날짜 이벤트 수집
  const allEvents = useMemo(()=>{
    const evts = []
    projects.forEach(p=>{
      // 계약일
      if(p.contractDate) evts.push({date:p.contractDate, proj:p.name, type:"계약일", color:"#3B72F6"})
      // 주요일정
      ;(p.weeklyReport?.scheduleLog||[]).forEach(e=>{
        evts.push({date:e.date, proj:p.name, type:e.category, title:e.content, color:{
          계약:"#3B72F6",심의:"#F59E0B",인허가:"#0EA86E",착공:"#534AB7",준공:"#EF4444",변경:"#6B7280",기타:"#9CA3AF"
        }[e.category]||"#6B7280"})
      })
      // cashflowPlan의 기성 예정
      ;(p.cashflowPlan||[]).filter(e=>e.plan>0).forEach(e=>{
        const d=`${e.year}-${String(e.month).padStart(2,"0")}-01`
        evts.push({date:d, proj:p.name, type:"계획기성", title:`${e.plan}억 계획기성`, color:"#0EA86E"})
      })
    })
    return evts.filter(e=>e.date)
  },[projects])

  // 월별 날짜 계산
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()  // 0=일
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate()
  const today = new Date().toISOString().slice(0,10)

  const getDateStr = (d) => `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`
  const getEventsForDate = (d) => allEvents.filter(e=>e.date===getDateStr(d))

  const selEvents = selDate ? allEvents.filter(e=>e.date===selDate) : []

  return (
    <div>
      {/* 헤더 */}
      <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",padding:"16px 22px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
        <div style={{fontSize:18,fontWeight:800,color:"#111827"}}>📅 전체 프로젝트 일정</div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
          <button onClick={()=>{ if(viewMonth===0){setViewYear(y=>y-1);setViewMonth(11)}else setViewMonth(m=>m-1) }}
            style={{padding:"7px 12px",border:"1.5px solid #E5E7EB",borderRadius:9,background:"#fff",cursor:"pointer",fontSize:16}}>‹</button>
          <div style={{fontSize:16,fontWeight:700,color:"#111827",minWidth:120,textAlign:"center"}}>
            {viewYear}년 {viewMonth+1}월
          </div>
          <button onClick={()=>{ if(viewMonth===11){setViewYear(y=>y+1);setViewMonth(0)}else setViewMonth(m=>m+1) }}
            style={{padding:"7px 12px",border:"1.5px solid #E5E7EB",borderRadius:9,background:"#fff",cursor:"pointer",fontSize:16}}>›</button>
          <button onClick={()=>{setViewYear(new Date().getFullYear());setViewMonth(new Date().getMonth())}}
            style={{padding:"7px 14px",border:"1.5px solid #E5E7EB",borderRadius:9,background:"#EEF3FF",color:"#3B72F6",cursor:"pointer",fontSize:13,fontWeight:700}}>오늘</button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:selDate?"1fr 320px":"1fr",gap:14,alignItems:"start"}}>
        {/* 캘린더 */}
        <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
          {/* 요일 헤더 */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:"#F8FAFC",borderBottom:"1px solid #E5E7EB"}}>
            {["일","월","화","수","목","금","토"].map((d,i)=>(
              <div key={d} style={{padding:"11px 0",textAlign:"center",fontSize:13,fontWeight:700,color:i===0?"#EF4444":i===6?"#3B72F6":"#6B7280"}}>
                {d}
              </div>
            ))}
          </div>
          {/* 날짜 그리드 */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
            {/* 빈 칸 */}
            {Array(firstDay).fill(null).map((_,i)=>(
              <div key={`e${i}`} style={{minHeight:90,borderRight:"1px solid #F3F4F6",borderBottom:"1px solid #F3F4F6",background:"#FAFAFA"}}/>
            ))}
            {/* 날짜 */}
            {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
              const dateStr = getDateStr(d)
              const dayEvts = getEventsForDate(d)
              const isToday = dateStr===today
              const isSel   = dateStr===selDate
              const dayOfWeek = (firstDay+d-1)%7
              return (
                <div key={d} onClick={()=>setSelDate(s=>s===dateStr?null:dateStr)}
                  style={{minHeight:90,borderRight:"1px solid #F3F4F6",borderBottom:"1px solid #F3F4F6",padding:"6px 8px",cursor:"pointer",
                    background:isSel?"#EEF3FF":isToday?"#FEF9EE":"#fff",
                    transition:"background .1s"}}
                  onMouseEnter={e=>{if(!isSel&&!isToday)e.currentTarget.style.background="#F8FAFC"}}
                  onMouseLeave={e=>{if(!isSel&&!isToday)e.currentTarget.style.background="#fff"}}
                >
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:isToday?800:500,
                      color:isToday?"#3B72F6":dayOfWeek===0?"#EF4444":dayOfWeek===6?"#3B72F6":"#374151",
                      width:24,height:24,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",
                      background:isToday?"#3B72F6":"transparent",
                      color2:"#fff"
                    }}
                    style2={{color:isToday?"#fff":"inherit"}}>
                      {d}
                    </span>
                    {dayEvts.length>0&&<span style={{fontSize:10,background:"#3B72F6",color:"#fff",borderRadius:10,padding:"1px 6px",fontWeight:700}}>{dayEvts.length}</span>}
                  </div>
                  {dayEvts.slice(0,3).map((e,ei)=>(
                    <div key={ei} style={{fontSize:10.5,fontWeight:600,color:e.color||"#6B7280",background:(e.color||"#6B7280")+"18",borderRadius:4,padding:"2px 5px",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {e.title||e.type} · {e.proj?.slice(0,8)}
                    </div>
                  ))}
                  {dayEvts.length>3&&<div style={{fontSize:10,color:"#9CA3AF"}}>+{dayEvts.length-3}건</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* 선택일 상세 */}
        {selDate&&(
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",padding:"18px 20px",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
            <div style={{fontSize:15,fontWeight:800,color:"#111827",marginBottom:12}}>{selDate}</div>
            {selEvents.length===0
              ? <div style={{color:"#6B7280",fontSize:13}}>이 날짜에 등록된 일정이 없습니다.</div>
              : selEvents.map((e,i)=>(
                <div key={i} style={{padding:"10px 13px",borderRadius:10,border:`1.5px solid ${e.color||"#E5E7EB"}33`,marginBottom:8,background:(e.color||"#6B7280")+"0A"}}>
                  <div style={{fontSize:12,fontWeight:700,color:e.color||"#6B7280",marginBottom:3}}>{e.type}</div>
                  <div style={{fontSize:13.5,fontWeight:700,color:"#111827",marginBottom:2}}>{e.title||e.type}</div>
                  <div style={{fontSize:12,color:"#6B7280"}}>🏗 {e.proj}</div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
