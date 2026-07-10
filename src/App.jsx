
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react"
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
} from "./ReChartsFallback.jsx"
import { ArchiveTab } from "./Archive.jsx"
import { OptimizeTab } from "./Optimize.jsx"
import { DataHubTab } from "./DataHub.jsx"
import { VendorsTab } from "./Vendors.jsx"
import { WeeklyReportTab } from "./WeeklyReport.jsx"
// AI 기능 — 추후 ANTHROPIC_API_KEY 설정 시 활성화 가능
// import { SmartSearch, AIAssistant, AIFloatButton, WeeklyBriefing } from "./AIAssistant.jsx"
import { ManualTab } from "./ManualTab.jsx"
import { DeptContext, useDepts } from "./DeptContext.jsx"
import { StaffMgmtPage } from "./StaffMgmt.jsx"
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
  // 클로브AI 스타일 — 보라/인디고 포인트, 밝은 배경, 소프트 카드
  navy:   "#312E81",  navyM:  "#6366F1",  navyL:  "#EEF2FF",  // 메인 인디고
  green:  "#059669",  greenL: "#D1FAE5",                        // 성공/완료 (에메랄드)
  amber:  "#D97706",  amberL: "#FEF3C7",                        // 경고
  red:    "#DC2626",  redL:   "#FEE2E2",                        // 오류
  gray:   "#6B7280",  grayL:  "#F3F4F6",                        // 중립
  border: "#E5E7EB",  bg:     "#F8FAFC",                        // 배경
  teal:   "#0D9488",  tealL:  "#CCFBF1",                        // 청록 (보조)
  purple: "#7C3AED",  purpleL:"#EDE9FE",                        // 보라 (강조)
}
const LEVEL_STYLE = {
  critical:{bg:C.redL,  fg:C.red,    border:C.red},
  warning: {bg:C.amberL,fg:"#92400E", border:C.amber},
  info:    {bg:C.navyL, fg:C.navyM,  border:C.navyM},
}
const TYPE_BADGE = {
  계약:{bg:C.tealL,   fg:"#134E4A"}, 확정:{bg:C.greenL, fg:"#065F46"},
  추진:{bg:C.amberL,  fg:"#92400E"}, 기성:{bg:C.navyL,  fg:C.navy},
}

// ── 차트 값 라벨 헬퍼 (모든 차트에 수치 기본 표기) ───────────────
const lbl = (color,dec=2,size=11,suffix="")=>({
  formatter:v=>(v>0?(+v).toFixed(dec)+suffix:""),
  style:{fontSize:size,fontWeight:700,fill:color},
})

// ── 스타일 헬퍼 ───────────────────────────────────────────────
const S = {
  card:(x={})=>({background:"#fff",border:"1px solid #E5E7EB",borderRadius:16,padding:"22px 26px",marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.05)",...x}),
  kpi:(accent="#6366F1")=>({background:"#fff",border:"1px solid #E5E7EB",borderRadius:16,padding:"20px 22px",borderLeft:`4px solid ${accent}`,cursor:"pointer",transition:"all .2s",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}),
  grid:(c,g=14)=>({display:"grid",gridTemplateColumns:`repeat(${c},1fr)`,gap:g,marginBottom:g}),
  th:(a="left")=>({padding:"12px 16px",textAlign:a,fontSize:13,fontWeight:700,color:"#6B7280",background:"#F8FAFC",borderBottom:"1px solid #E5E7EB",whiteSpace:"nowrap",letterSpacing:"0.02em"}),
  td:(a="right")=>({padding:"13px 16px",borderBottom:"1px solid #F3F4F6",textAlign:a,fontSize:14.5,verticalAlign:"middle",color:"#111827"}),
  btn:(bg="#6366F1",fg="#fff")=>({padding:"10px 18px",background:bg,color:fg,border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:7,transition:"opacity .15s",letterSpacing:"-0.01em"}),
  inp:(w)=>({padding:"10px 14px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:14.5,width:w||"100%",boxSizing:"border-box",background:"#fff",color:"#111827",fontFamily:"inherit",outline:"none",transition:"border-color .15s"}),
  lbl:()=>({display:"block",fontSize:13,color:"#6B7280",fontWeight:700,marginBottom:5,letterSpacing:"0.01em"}),
  bdg:(bg,fg)=>({display:"inline-flex",alignItems:"center",padding:"4px 12px",borderRadius:20,fontSize:12.5,fontWeight:700,background:bg,color:fg,letterSpacing:"0.01em"}),
}
// 전역 TH 헬퍼 — 테이블 헤더 스타일 (여러 컴포넌트에서 공통 사용)
const TH = (align="right", color="#6B7280", bg="#F8FAFC") => ({
  padding:"9px 11px", textAlign:align, fontSize:11.5, fontWeight:700,
  color, borderBottom:"2px solid #E5E7EB", whiteSpace:"nowrap", background:bg
})
// 전역 TD 헬퍼 — 테이블 셀 스타일
const TD = (color="#374151", bold=false, bg="transparent") => ({
  padding:"9px 11px", textAlign:"right", fontSize:12.5,
  fontWeight:bold?700:400, color, background:bg,
  borderBottom:"1px solid #F3F4F6", verticalAlign:"middle"
})
// 전역 포맷 함수들
const fA  = v => { const n=Number(v)||0; return n>0?`${(n/1e8).toFixed(2)}억`:n<0?`(${(-n/1e8).toFixed(2)}억)`:"-" }
const fB  = v => typeof v==="number"?`${v.toFixed(2)}억`:"-"
const fC  = n => n>0?`${(n/1e8).toFixed(2)}`:n<0?`(${(-n/1e8).toFixed(2)})`:"-"
const fCa = n => n>0?`${(n/1e8).toFixed(2)}억`:"-"
const fW2 = v => v>=1e8?`${(v/1e8).toFixed(2)}억`:v>0?`${Math.round(v).toLocaleString()}원`:"-"
const fP2 = (n,t) => t>0?(n/t*100).toFixed(2)+"%":"-"
// 전역 INP 함수 — 인라인 input 스타일
const INP = (err) => ({padding:"8px 10px",border:`1.5px solid ${err?"#EF4444":"#E5E7EB"}`,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"})

// ════════════════════════════════════════════════════════════
// 메인 앱
// ════════════════════════════════════════════════════════════
export default function App() {
  // ── 인증 — localStorage로 세션 유지 ──
  const [auth, setAuth] = useState(()=>{
    try{ return localStorage.getItem("sjs_auth")||"login" }catch{ return "login" }
  })
  const [currentUser, setCurrentUser] = useState(()=>{
    try{
      const saved = localStorage.getItem("sjs_current_user")
      return saved ? JSON.parse(saved) : null
    }catch{ return null }
  })
  const [loginId, setLoginId] = useState("")
  const [loginPw, setLoginPw] = useState("")
  const [loginError, setLoginError] = useState("")
  const [pwVisible, setPwVisible]   = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [lockUntil, setLockUntil]   = useState(null)
  const [pwMap, setPwMap] = useState(()=>{ try{ return JSON.parse(localStorage.getItem("sjs_pw")||"{}") }catch{ return {} }})
  const [initDone, setInitDone] = useState(false)
  const users = useMemo(()=>ALL_USERS.map(u=>({...u,_pwHash:pwMap[u.id]||""})),[pwMap])
  const savePwMap = m => { localStorage.setItem("sjs_pw",JSON.stringify(m)); setPwMap(m) }

  // 세션 저장 헬퍼
  const persistSession = (user) => {
    if(user) {
      // 비밀번호 해시 등 민감 정보 제외하고 저장
      const {_pwHash, ...safeUser} = user
      localStorage.setItem("sjs_auth", "app")
      localStorage.setItem("sjs_current_user", JSON.stringify(safeUser))
    } else {
      localStorage.removeItem("sjs_auth")
      localStorage.removeItem("sjs_current_user")
    }
  }

  // 저장된 세션의 사용자 정보를 최신 users 목록과 동기화
  useEffect(()=>{
    if(currentUser && users.length > 0) {
      const freshUser = users.find(u=>u.id===currentUser.id)
      if(!freshUser || !freshUser.active) {
        // 사용자가 비활성화됐으면 로그아웃
        setCurrentUser(null); setAuth("login")
        localStorage.removeItem("sjs_auth")
        localStorage.removeItem("sjs_current_user")
      } else if(freshUser && JSON.stringify(freshUser) !== JSON.stringify(currentUser)) {
        // 권한 등이 변경됐으면 최신 정보로 업데이트
        const {_pwHash, ...safeUser} = freshUser
        setCurrentUser(safeUser)
        localStorage.setItem("sjs_current_user", JSON.stringify(safeUser))
      }
    }
  },[users])

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
    persistSession(u)
  }
  const doLogout = ()=>{ setCurrentUser(null); setAuth("login"); setLoginId(""); setLoginPw(""); persistSession(null) }
  const saveUsers = (updated)=>{ const nm={}; updated.forEach(u=>{if(u._pwHash)nm[u.id]=u._pwHash}); savePwMap(nm) }
  // ── 권한 헬퍼 ────────────────────────────────────────────
  const getTabPerm = (tabId) => {
    // admin은 항상 rw
    if(currentUser?.role==="admin") return "rw"
    const perms = currentUser?.tabPerms || {}
    // 탭별 설정이 명시적으로 있으면 그것 사용
    if(perms[tabId]) return perms[tabId]
    // 기본값: 경영분석(analysis)만 기본 r, 나머지 hidden
    if(tabId==="analysis") return "r"
    if(currentUser?.role==="executive") return "r"
    return "hidden"
  }
  const canReadTab  = (tabId) => getTabPerm(tabId) !== "hidden"
  const canWriteTab = (tabId) => getTabPerm(tabId) === "rw"
  const canWrite = currentUser?.role==="admin" || currentUser?.write===true

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
  // ── 모바일 반응형 ──────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(()=>window.innerWidth<768)
  const [sideOpen, setSideOpen] = useState(()=>window.innerWidth>=768)
  useEffect(()=>{
    const fn=()=>{ const m=window.innerWidth<768; setIsMobile(m); if(m) setSideOpen(false) }
    window.addEventListener('resize',fn)
    return ()=>window.removeEventListener('resize',fn)
  },[])
  const [tab, setTab]             = useState("home")
  const [dbReady, setDbReady]     = useState(!USE_DB)
  const [dbStatus, setDbStatus]   = useState(USE_DB ? "connecting" : "local")

  const [projectsRaw, setProjectsRaw]   = useState(()=>{
    const saved = lsGet("sjs_projects", null)
    if(saved && saved.length > 0) return saved.map(normalizeProject)
    // 초기: PROJECTS_INIT + projectsInitData.json 병합
    try{
      const initList = require("./projectsInitData.json")
      const baseProjs = PROJECTS_INIT.map(normalizeProject)
      const baseNames = new Set(baseProjs.map(p=>(p.name||"").slice(0,12)))
      const extra = initList
        .filter(p=>p.name && !baseNames.has((p.name||"").slice(0,12)))
        .map((p,i)=>normalizeProject({
          id: `PI${Date.now()}_${i}`,
          code: p.pjNo||"",
          name: p.name||"",
          depts: [p.dept].filter(Boolean),
          pm: p.pm||"",
          type: (p.status||"")==="완료"?"계약":"확정",
          orderType: (p.type||"").includes("공공")?"공공":"민간",
          usage: p.usage||"",
          scale: p.scale||"",
          totalFee: p.feeTotal||0,
          serviceFee: p.feeTotal||0,
          contractYear: p.pjNo?parseInt(p.pjNo.slice(0,4))||2024:2024,
          contractDate: p.contractDate||"",
          memo:[],
        }))
      const merged = [...baseProjs, ...extra]
      try{ localStorage.setItem("sjs_projects", JSON.stringify(merged)) }catch{}
      return merged
    }catch{
      return PROJECTS_INIT.map(normalizeProject)
    }
  })
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

  // ── 프로젝트 기준일 잔금 데이터 (2026-01-01 시점) ───────────────
  // {projId: {baseDate, serviceFee, prevReceived, balance, memo, updatedAt}}
  const [projBaseline, setProjBaselineRaw] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem("sjs_proj_baseline")||"{}") }catch{return{}}
  })
  const setProjBaseline = v => {
    const next = typeof v==="function"?v(projBaseline):v
    try{localStorage.setItem("sjs_proj_baseline",JSON.stringify(next))}catch{}
    setProjBaselineRaw(next)
  }

  const [yearTargets, setYearTargetsRaw] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem("sjs_year_targets")||"null") || {
      [new Date().getFullYear()]: {salesTarget:145, contractTarget:170}
    } }catch{ return {[new Date().getFullYear()]:{salesTarget:145,contractTarget:170}} }
  })
  const setYearTargets = v => {
    const next = typeof v==="function"?v(yearTargets):v
    try{localStorage.setItem("sjs_year_targets",JSON.stringify(next))}catch{}
    setYearTargetsRaw(next)
  }

  // ── 건별 기성 내역 (새 방식) ────────────────────────────────
  const [cashItems, setCashItemsRaw] = useState(()=>lsGet("sjs_cash_items", []))
  const setCashItems = (v) => {
    const next = typeof v==="function" ? v(cashItems) : v
    try{ localStorage.setItem("sjs_cash_items", JSON.stringify(next)) }catch{}
    if(USE_DB) dbSet("sjs_cash_items", next).catch(()=>{})
    setCashItemsRaw(next)
  }

  // ── 건별 매출(세금계산서) 내역 ──────────────────────────────
  const [saleItems, setSaleItemsRaw] = useState(()=>lsGet("sjs_sale_items", []))
  const setSaleItems = (v) => {
    const next = typeof v==="function" ? v(saleItems) : v
    try{ localStorage.setItem("sjs_sale_items", JSON.stringify(next)) }catch{}
    if(USE_DB) dbSet("sjs_sale_items", next).catch(()=>{})
    setSaleItemsRaw(next)
  }

  // ── 계약현황 아이템 (월수금/프로젝트와 완전 독립) ──────────────
  const [contractItemsRaw, setContractItemsRaw] = useState(()=>lsGet("sjs_contract_items", []))
  const contractItems = contractItemsRaw
  const setContractItems = (v) => {
    const next = typeof v==="function" ? v(contractItemsRaw) : v
    try{ localStorage.setItem("sjs_contract_items", JSON.stringify(next)) }catch{}
    if(USE_DB) dbSet("sjs_contract_items", next).catch(()=>{})
    setContractItemsRaw(next)
  }

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
    try{
      const saved = localStorage.getItem("sjs_vendors")
      if(saved && saved !== "{}") return JSON.parse(saved)
      // 초기 데이터 로드
      const initData = require("./vendorsInitData.json")
      // JSON 형태를 기존 vendorsDB 구조로 변환
      const db = {}
      Object.entries(initData).forEach(([name, v])=>{
        if(!name || name==="미정업체") return
        const id = `V${Object.keys(db).length+1000}`
        db[id] = {
          id, name, bizType:v.bizType||"", bizNo:v.bizNo||"",
          rep:v.rep||"", repTel:v.repTel||"", repMail:v.repMail||"",
          tel:v.tel||"", addr:v.addr||"",
          projects: v.projects||[], memo:[]
        }
      })
      localStorage.setItem("sjs_vendors", JSON.stringify(db))
      return db
    }catch{ return {} }
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
      // cashItems/saleItems: DB 빈값이면 localStorage 복구
      const cashFromDB = g("sjs_cash_items", null)
      const saleFromDB = g("sjs_sale_items", null)
      const contractFromDB = g("sjs_contract_items", null)
      setCashItemsRaw(cashFromDB && cashFromDB.length>0 ? cashFromDB : lsGet("sjs_cash_items", []))
      setSaleItemsRaw(saleFromDB && saleFromDB.length>0 ? saleFromDB : lsGet("sjs_sale_items", []))
      setContractItemsRaw(contractFromDB && contractFromDB.length>0 ? contractFromDB : lsGet("sjs_contract_items", []))
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
      else if (key==="sjs_cash_items") {
        // 빈 배열이 오면 기존 데이터 보호 (실수 초기화 방지)
        if(Array.isArray(value) && value.length === 0) return
        setCashItemsRaw(value)
      }
      else if (key==="sjs_contract_items") {
        if(Array.isArray(value) && value.length === 0) return
        setContractItemsRaw(value)
      }
      else if (key==="sjs_sale_items") {
        if(Array.isArray(value) && value.length === 0) return
        setSaleItemsRaw(value)
      }
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
  const [schedules, setSchedulesRaw] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem("sjs_schedules")||"[]") }catch{ return [] }
  })
  const setSchedules = v => {
    const next = typeof v==="function"?v(schedules):v
    try{ localStorage.setItem("sjs_schedules",JSON.stringify(next)) }catch{}
    setSchedulesRaw(next)
  }
  const [notifPerm, setNotifPerm] = useState("default") // default | granted | denied

  // 알림 엔진 — 5분마다 임박 일정 체크
  useEffect(()=>{
    if(!("Notification" in window)) return
    setNotifPerm(Notification.permission)
    const check = () => {
      if(Notification.permission!=="granted") return
      const now = new Date()
      ;(schedules||[]).forEach(evt=>{
        if(!evt.date||!evt.alarm||evt.alarm==="0") return
        const evtDate = new Date(`${evt.date}T${evt.time||"00:00"}`)
        const diffMin = (evtDate-now)/(1000*60)
        const alarmMin = parseInt(evt.alarm)||30
        // 알람 시간 ±2분 범위
        if(diffMin>0&&diffMin<=alarmMin+2&&diffMin>=alarmMin-2) {
          new Notification(`📅 ${evt.title}`, {
            body: `${diffMin<=1?"지금!":diffMin+"분 후"} | ${evt.date} ${evt.time||""}`,
            icon: "/icon-192.png", tag: evt.id
          })
        }
      })
    }
    check()
    const timer = setInterval(check, 5*60*1000)
    return ()=>clearInterval(timer)
  },[schedules])
  const [showAlerts, setShowAlerts] = useState(false)
  const [selProjId, setSelProjId] = useState(null)
  const [selVerIdx, setSelVerIdx] = useState(0)
  const [cmpIds, setCmpIds]       = useState([])
  const [detailTab, setDetailTab] = useState("info")  // 프로젝트 상세 서브탭
  const [showNewProj, setShowNewProj] = useState(false)
  // const [showAI, setShowAI] = useState(false)  // AI 기능 추후 활성화
  const [showNewVer, setShowNewVer]   = useState(false)
  const [uploadMsg, setUploadMsg]     = useState("")
  const uploadRef = useRef(null)
  const unread = alerts.filter(a=>!a.read).length
  // 7일 이내 임박 일정
  const upcomingCount = (schedules||[]).filter(e=>{
    if(!e.date) return false
    const d = new Date(e.date); const now = new Date()
    const diff = (d-now)/(1000*60*60*24)
    return diff>=0&&diff<=7
  }).length
  const totalBadge = unread + upcomingCount

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

  // 엑셀 양식 다운로드 — 시스템 전체 항목 포함 완전판
  const downloadTemplate = useCallback(()=>{
    const hdr = {font:{bold:true,color:{argb:"FFFFFFFF"}},fill:{type:"pattern",pattern:"solid",fgColor:{argb:"FF1A3B6E"}},alignment:{horizontal:"center",wrapText:true},border:{bottom:{style:"thin"}}}
    const sub = {fill:{type:"pattern",pattern:"solid",fgColor:{argb:"FFEEF3FF"}},font:{bold:true},border:{bottom:{style:"thin"}}}
    const ex  = {fill:{type:"pattern",pattern:"solid",fgColor:{argb:"FFF0FDF4"}}}
    const note= {fill:{type:"pattern",pattern:"solid",fgColor:{argb:"FFFEF9EE"}}}

    // ── 시트1: 프로젝트 기본정보 ─────────────────────────────
    const ws1 = XLSX.utils.aoa_to_sheet([
      ["■ 상지서울 통합경영시스템 — 프로젝트 개설 양식 v2"],
      ["※ 파란색 행(3행~)에만 데이터 입력. 열 순서·제목 변경 금지. 한 행 = 프로젝트 1건"],
      [],
      // 헤더
      ["프로젝트코드","연도","프로젝트명","건물유형","수주유형","수주형태",
       "담당본부","PM","담당본부장","발주처","발주처담당자","발주구분",
       "총설계비(원,VAT별도)","상지지분율(%)","상지용역비(원,VAT별도)",
       "대지면적(㎡)","연면적(㎡)","세대수","규모","용도",
       "계약일(YYYY-MM-DD)","수주일(YYYY-MM-DD)",
       "대지위치(주소)","비고","진행상태"],
      // 예시행
      ["E26001-PPH","2026","○○현장 공동주택 설계용역","공동주택","민간","민간수의",
       "설계1본부","홍길동","홍길동 이사","○○건설(주)","김담당 차장","민간",
       1200000000,100,1200000000,
       12500,45000,450,"지하2층/지상25층","공동주택",
       "2026-01-15","2026-01-20",
       "서울특별시 강남구 ○○로 123","초안","진행중"],
      ["E26002-OFC","2026","○○업무시설 리모델링 설계","업무시설","공공","경쟁설계",
       "설계2본부,설계1본부","이설계","이부장 이사","○○공사","박담당 과장","공공",
       850000000,70,595000000,
       5200,28000,0,"지하1층/지상15층","업무시설",
       "2026-02-01","2026-02-10",
       "경기도 성남시 ○○구 ○○로 456","","진행중"],
    ])
    ws1["!cols"]=[{wch:18},{wch:7},{wch:30},{wch:12},{wch:12},{wch:12},
                  {wch:18},{wch:10},{wch:14},{wch:18},{wch:14},{wch:10},
                  {wch:16},{wch:10},{wch:16},
                  {wch:12},{wch:12},{wch:8},{wch:16},{wch:12},
                  {wch:16},{wch:16},{wch:30},{wch:20},{wch:10}]

    // ── 시트2: 협력업체 외주비 ────────────────────────────────
    const ws2 = XLSX.utils.aoa_to_sheet([
      ["■ 협력업체 외주비 입력 (프로젝트코드는 시트1과 정확히 일치)"],
      ["※ 한 프로젝트에 여러 협력업체는 같은 코드로 여러 행 입력"],
      [],
      ["프로젝트코드","공종(분야)","협력업체명","원가견적(원)","1차NEGO(원)","2차NEGO(원)","메모"],
      ["E26001-PPH","구조","(주)○○구조엔지니어링",72000000,"","",""],
      ["E26001-PPH","토목","(주)○○기술단",55000000,50000000,"","2차협의중"],
      ["E26001-PPH","조경","○○조경(주)",38000000,"","",""],
      ["E26001-PPH","기계설비","(주)○○엔지니어링",42000000,"","",""],
      ["E26001-PPH","전기통신","○○전기(주)",35000000,"","",""],
      ["E26002-OFC","구조","(주)○○구조",48000000,45000000,"",""],
    ])
    ws2["!cols"]=[{wch:18},{wch:14},{wch:22},{wch:14},{wch:14},{wch:14},{wch:20}]

    // ── 시트3: 월수금계획 ────────────────────────────────────
    const ws3 = XLSX.utils.aoa_to_sheet([
      ["■ 월수금계획 입력 (프로젝트코드는 시트1과 정확히 일치)"],
      ["※ 계획기성: 해당 월에 받을 예정 금액(억원), 입금실적: 실제 받은 금액(억원)"],
      [],
      ["프로젝트코드","연도","구분","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],
      ["E26001-PPH","2026","계획기성(억원)","","","1.2","","","1.5","","","2.0","","","1.3"],
      ["E26001-PPH","2026","입금실적(억원)","","","1.2","","","","","","","","",""],
      ["E26002-OFC","2026","계획기성(억원)","","0.8","","","0.8","","","0.8","","","",""],
    ])
    ws3["!cols"]=[{wch:18},{wch:7},{wch:14},...Array(12).fill({wch:8})]

    // ── 시트4: 실행계획서 비용 ───────────────────────────────
    const ws4 = XLSX.utils.aoa_to_sheet([
      ["■ 실행계획서 비용 입력"],
      ["※ 외주용역비는 시트2의 협력업체 금액 합계와 일치 권장"],
      [],
      ["프로젝트코드","회차","작성일(YYYY-MM-DD)","변경사유","직접인건비(원)","직접경비(원)","외주용역비(원)","간접비(원,0=자동)","이윤(원,0=자동)"],
      ["E26001-PPH",1,"2026-01-20","최초 작성",237000000,45000000,242000000,0,0],
      ["E26001-PPH",2,"2026-03-15","협력업체 변경",237000000,45000000,285000000,0,0],
    ])
    ws4["!cols"]=[{wch:18},{wch:7},{wch:16},{wch:20},{wch:14},{wch:14},{wch:14},{wch:16},{wch:16}]

    // ── 시트5: 주요일정 ──────────────────────────────────────
    const ws5 = XLSX.utils.aoa_to_sheet([
      ["■ 프로젝트 주요일정 입력"],
      [],
      ["프로젝트코드","날짜(YYYY-MM-DD)","구분","주요내용","메모"],
      ["E26001-PPH","2026-01-20","계약","설계용역 계약 체결","계약금 10% 입금 확인"],
      ["E26001-PPH","2026-03-10","심의","건축위원회 심의 접수","서류 일체 제출"],
      ["E26001-PPH","2026-05-15","인허가","건축허가 신청","예상 허가기간 60일"],
    ])
    ws5["!cols"]=[{wch:18},{wch:16},{wch:12},{wch:35},{wch:30}]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws1,"①프로젝트기본정보")
    XLSX.utils.book_append_sheet(wb,ws2,"②협력업체외주비")
    XLSX.utils.book_append_sheet(wb,ws3,"③월수금계획")
    XLSX.utils.book_append_sheet(wb,ws4,"④실행계획서비용")
    XLSX.utils.book_append_sheet(wb,ws5,"⑤주요일정")
    XLSX.writeFile(wb,"상지서울_프로젝트개설양식_v2.xlsx")
  },[])

  // ── 실행계획서 보고서 Word(.docx) 다운로드 ──────────────────
  const downloadReport = useCallback((proj)=>{
    const ver = proj.versions?.[proj.versions.length-1]
    const vendors = ver?.vendors || []
    const toPy = m => m>0 ? `${(m/3.3058).toFixed(1)}평` : "-"
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


  // ── 메뉴 그룹·순서 — Hook이므로 반드시 조건부 return 이전에 위치 ──
  const TAB_DEFAULTS = [
    {id:"home",      label:"🏠 홈",           group:"경영"},
    {id:"analysis",  label:"📊 경영분석",    group:"경영"},
    {id:"notice",    label:"📢 공지사항",      group:"경영"},
    {id:"stats",     label:"📈 사용 통계",     group:"경영"},
    {id:"gamify",    label:"🎮 포인트·랭킹",   group:"경영"},
    {id:"deptdash",  label:"🏢 본부별 현황",  group:"경영"},
    {id:"projects",  label:"🏗 프로젝트",     group:"프로젝트"},
    {id:"history",   label:"📜 히스토리",     group:"프로젝트"},
    {id:"calendar",  label:"📅 일정 캘린더",  group:"프로젝트"},
    {id:"vendors",   label:"🤝 협력업체",     group:"관리"},
    {id:"contract",  label:"📄 계약서",       group:"관리"},
    {id:"archive",   label:"📁 아카이브",     group:"관리"},
    {id:"docvault",  label:"📂 문서보관소",    group:"관리"},
    {id:"staffmgmt", label:"👤 직원관리",        group:"관리"},
    {id:"pnl",       label:"📉 손익분석",     group:"분석"},
    {id:"optimize",  label:"⚙️ 경영최적화",  group:"분석"},
    {id:"datahub",   label:"🗄️ 데이터관리",  group:"설정"},
    {id:"manual",    label:"📚 업무매뉴얼",   group:"설정"},
    {id:"auth_mgmt", label:"🔐 권한관리",     group:"설정"},
  ]
  const [tabOrder,  setTabOrderRaw]  = useState(()=>{
    try{
      const s=JSON.parse(localStorage.getItem("sjs_tab_order")||"null")
      if(Array.isArray(s)&&s.length>0){
        // TAB_DEFAULTS에 있는데 저장된 목록에 없는 탭 자동 추가 (버전 업그레이드 대응)
        const TAB_IDS_DEFAULT = ["home","analysis","notice","stats","gamify","deptdash","projects","history","calendar","vendors","contract","archive","docvault","staffmgmt","pnl","optimize","datahub","manual","auth_mgmt"]
        const savedIds = new Set(s.map(t=>t.id))
        const merged = [...s]
        const DEFAULT_MAP = {
          home:{id:"home",label:"🏠 홈",group:"경영"},
          analysis:{id:"analysis",label:"📊 경영분석",group:"경영"},
          notice:{id:"notice",label:"📢 공지사항",group:"경영"},
          stats:{id:"stats",label:"📈 사용 통계",group:"경영"},
          gamify:{id:"gamify",label:"🎮 포인트·랭킹",group:"경영"},
          deptdash:{id:"deptdash",label:"🏢 본부별 현황",group:"경영"},
          projects:{id:"projects",label:"🏗 프로젝트",group:"프로젝트"},
          history:{id:"history",label:"📜 히스토리",group:"프로젝트"},
          calendar:{id:"calendar",label:"📅 일정 캘린더",group:"프로젝트"},
          vendors:{id:"vendors",label:"🤝 협력업체",group:"관리"},
          contract:{id:"contract",label:"📄 계약서",group:"관리"},
          archive:{id:"archive",label:"📁 아카이브",group:"관리"},
          docvault:{id:"docvault",label:"📂 문서보관소",group:"관리"},
          staffmgmt:{id:"staffmgmt",label:"👤 직원관리",group:"관리"},
          pnl:{id:"pnl",label:"📉 손익분석",group:"분석"},
          optimize:{id:"optimize",label:"⚙️ 경영최적화",group:"분석"},
          datahub:{id:"datahub",label:"🗄️ 데이터관리",group:"설정"},
          manual:{id:"manual",label:"📚 업무매뉴얼",group:"설정"},
          auth_mgmt:{id:"auth_mgmt",label:"🔐 권한관리",group:"설정"},
        }
        TAB_IDS_DEFAULT.forEach(id=>{ if(!savedIds.has(id)&&DEFAULT_MAP[id]) merged.push(DEFAULT_MAP[id]) })
        return merged
      }
    }catch{}
    return TAB_DEFAULTS
  })
  const [tabGroups, setTabGroupsRaw] = useState(()=>{ try{ const s=JSON.parse(localStorage.getItem("sjs_tab_groups")||"null"); return Array.isArray(s)&&s.length>0?s:["경영","프로젝트","관리","분석","설정"] }catch{ return ["경영","프로젝트","관리","분석","설정"] } })
  const [showMenuEdit, setShowMenuEdit] = useState(false)
  const setTabOrder  = v=>{ const n=typeof v==="function"?v(tabOrder):v; try{localStorage.setItem("sjs_tab_order",JSON.stringify(n))}catch{}; setTabOrderRaw(n) }
  const setTabGroups = v=>{ const n=typeof v==="function"?v(tabGroups):v; try{localStorage.setItem("sjs_tab_groups",JSON.stringify(n))}catch{}; setTabGroupsRaw(n) }

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


  const TABS = tabOrder

  return (
    <ToastProvider>
    <DeptContext.Provider value={deptCtx}>
    <div style={{fontFamily:"'Apple SD Gothic Neo','Pretendard','Noto Sans KR',sans-serif",fontSize:15,color:"#111827",background:"#F8FAFC",minHeight:"100vh"}}>

      {/* ── 사이드바 레이아웃 ── */}
      <div style={{display:"flex",minHeight:"100vh"}}>

      {/* ── 모바일 오버레이 배경 ── */}
      {isMobile&&sideOpen&&<div onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:99}}/>}

      {/* ── 사이드바 ── */}
      <div style={{width:220,flexShrink:0,background:"#fff",borderRight:"1px solid #E5E7EB",display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:100,
        transform:(!isMobile||sideOpen)?"translateX(0)":"translateX(-220px)",
        transition:"transform .25s cubic-bezier(.4,0,.2,1)"}}>
        {/* 로고 */}
        <div onClick={()=>setTabAndClose("analysis")} style={{padding:"22px 20px 18px",cursor:"pointer",borderBottom:"1px solid #F3F4F6"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:38,height:38,background:"linear-gradient(135deg,#6366F1,#312E81)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📐</div>
            <div>
              <div style={{fontSize:13.5,fontWeight:800,color:"#111827",letterSpacing:"-0.03em",lineHeight:1.2}}>상지서울</div>
              <div style={{fontSize:11,color:"#6B7280",fontWeight:500,lineHeight:1.2}}>통합경영시스템</div>
            </div>
          </div>
        </div>

        {/* 퀵액션 — 프로젝트 관련 3개 버튼 묶음 */}
        <div style={{padding:"12px 10px",borderBottom:"1px solid #F3F4F6"}}>
          <div style={{background:"#EEF2FF",borderRadius:12,padding:"8px",border:"1px solid #6366F122"}}>
            <div style={{fontSize:10.5,fontWeight:800,color:"#6366F1",letterSpacing:".06em",marginBottom:7,paddingLeft:2}}>프로젝트</div>
            <button onClick={()=>setShowNewProj(true)}
              style={{width:"100%",padding:"9px 10px",background:"#6366F1",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:5,boxShadow:"0 2px 8px rgba(99,102,241,.3)"}}>
              <i className="ti ti-plus" style={{fontSize:13}}/> 프로젝트 개설
            </button>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
              <button onClick={()=>uploadRef.current?.click()}
                style={{padding:"7px 4px",background:"#fff",color:"#374151",border:"1px solid #E5E7EB",borderRadius:8,fontSize:11.5,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                <i className="ti ti-upload" style={{fontSize:11}}/> 업로드
              </button>
              <button onClick={downloadTemplate}
                style={{padding:"7px 4px",background:"#fff",color:"#374151",border:"1px solid #E5E7EB",borderRadius:8,fontSize:11.5,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                <i className="ti ti-file-download" style={{fontSize:11}}/> 양식 다운로드
              </button>
            </div>
          </div>
          <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleUpload}/>
          {uploadMsg&&<div style={{marginTop:6,fontSize:11,color:uploadMsg.startsWith("✓")?"#059669":C.red,padding:"4px 8px",background:uploadMsg.startsWith("✓")?"#D1FAE5":"#FEE2E2",borderRadius:7}}>{uploadMsg}</div>}
        </div>

        {/* 네비게이션 — 그룹별 */}
        <nav style={{flex:1,padding:"8px 8px",overflowY:"auto"}}>
          {/* 메뉴 편집 버튼 */}
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:4}}>
            <button onClick={()=>setShowMenuEdit(v=>!v)}
              style={{padding:"3px 8px",background:"none",border:"1px solid #E5E7EB",borderRadius:6,fontSize:11,color:"#9CA3AF",cursor:"pointer",display:"flex",alignItems:"center",gap:3}}
              title="메뉴 순서·그룹 편집">
              ⚙ 메뉴편집
            </button>
          </div>

          {/* 메뉴 편집 패널 */}
          {showMenuEdit && (
            <div style={{background:"#FEF9EE",borderRadius:10,padding:"10px",marginBottom:8,border:"1px solid #D9770633"}}>
              <div style={{fontSize:11.5,fontWeight:800,color:"#D97706",marginBottom:8}}>⚙ 메뉴 순서 편집</div>
              <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:300,overflowY:"auto"}}>
                {tabOrder.filter(t=>t.id!=="auth_mgmt"||currentUser.role==="admin").map((t,i,arr)=>(
                  <div key={t.id} style={{display:"flex",gap:4,alignItems:"center",background:"#fff",borderRadius:7,padding:"4px 6px",border:"1px solid #E5E7EB"}}>
                    <div style={{display:"flex",flexDirection:"column",gap:1}}>
                      <button onClick={()=>{if(i>0){const a=[...tabOrder];[a[i-1],a[i]]=[a[i],a[i-1]];setTabOrder(a)}}} disabled={i===0}
                        style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:9,lineHeight:1,opacity:i===0?.3:1}}>▲</button>
                      <button onClick={()=>{if(i<arr.length-1){const a=[...tabOrder];[a[i],a[i+1]]=[a[i+1],a[i]];setTabOrder(a)}}} disabled={i===arr.length-1}
                        style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:9,lineHeight:1,opacity:i===arr.length-1?.3:1}}>▼</button>
                    </div>
                    <span style={{flex:1,fontSize:11.5,color:"#374151",fontWeight:500}}>{t.label}</span>
                    <select value={t.group||""} onChange={e=>{const a=[...tabOrder];a[i]={...a[i],group:e.target.value};setTabOrder(a)}}
                      style={{padding:"2px 4px",border:"1px solid #E5E7EB",borderRadius:5,fontSize:10,background:"#F8FAFC"}}>
                      {tabGroups.map(g=><option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button onClick={()=>setTabOrder(TAB_DEFAULTS)} style={{marginTop:6,width:"100%",padding:"5px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:7,fontSize:11,cursor:"pointer"}}>
                기본값 복원
              </button>
            </div>
          )}

          {/* 그룹별 메뉴 렌더링 */}
          {tabGroups.map(grp=>{
            const grpTabs = tabOrder.filter(t=>{
            if((t.group||"기타")!==grp) return false
            if(t.id==="auth_mgmt" && currentUser.role!=="admin") return false
            // hidden 권한이면 메뉴에서 숨김 (admin은 항상 표시)
            if(currentUser.role!=="admin" && currentUser?.tabPerms?.[t.id]==="hidden") return false
            return true
          })
            if(!grpTabs.length) return null
            return (
              <div key={grp} style={{marginBottom:6}}>
                <div style={{fontSize:10.5,fontWeight:800,color:"#9CA3AF",letterSpacing:".08em",padding:"4px 12px 2px",textTransform:"uppercase"}}>{grp}</div>
                {grpTabs.map(t=>{
                  const active=tab===t.id
                  return (
                    <button key={t.id} onClick={()=>setTabAndClose(t.id)} style={{
                      width:"100%",textAlign:"left",padding:"9px 12px",border:"none",borderRadius:9,
                      marginBottom:1,cursor:"pointer",fontSize:13.5,fontWeight:active?700:500,
                      background:active?"#EEF2FF":"transparent",color:active?"#6366F1":"#374151",
                      display:"flex",alignItems:"center",gap:7,transition:"all .12s"
                    }}
                    onMouseEnter={e=>{if(!active)e.currentTarget.style.background="#F8FAFC"}}
                    onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent"}}>
                      {t.label}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* 하단 사용자 영역 */}
        <div style={{padding:"14px 12px",borderTop:"1px solid #F3F4F6"}}>
          {/* DB 상태 */}
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,padding:"6px 10px",background:"#F8FAFC",borderRadius:8,border:"1px solid #E5E7EB"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:dbStatus==="ok"?"#059669":dbStatus==="error"?"#DC2626":"#D97706",flexShrink:0}}/>
            <span style={{fontSize:12,color:"#6B7280",fontWeight:600}}>
              {dbStatus==="ok"?"DB 연결됨":dbStatus==="error"?"DB 오류":dbStatus==="local"?"로컬 저장":"연결 중…"}
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#6366F1,#312E81)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",flexShrink:0}}>
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
              {totalBadge>0&&<span style={{position:"absolute",top:2,right:8,minWidth:16,height:16,background:C.red,borderRadius:8,fontSize:10,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{totalBadge}</span>}
            </button>
            <button onClick={doLogout} style={{...S.btn(C.grayL,"#374151"),flex:1,justifyContent:"center",padding:"7px",borderRadius:8,fontSize:12}}>로그아웃</button>
          </div>
          {showAlerts&&<AlertPanel {...{alerts,readAlert,readAll,setTab,setShowAlerts}}/>}
        </div>
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <div style={{marginLeft:isMobile?0:220,flex:1,minWidth:0,transition:"margin .25s"}}>
        {/* 탑바 */}
        <div style={{background:"#fff",borderBottom:"1px solid #E5E7EB",padding:isMobile?"11px 14px":"14px 24px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:90}}>
          {/* 모바일 햄버거 */}
          {isMobile&&<button onClick={()=>setSideOpen(v=>!v)}
            style={{padding:"6px",background:"none",border:"none",cursor:"pointer",color:"#374151",flexShrink:0,fontSize:22,lineHeight:1,display:"flex",alignItems:"center"}}>
            ☰
          </button>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:isMobile?16:20,fontWeight:800,color:"#111827",letterSpacing:"-0.03em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {TABS.find(t=>t.id===tab)?.label || "대시보드"}
            </div>
            {!isMobile&&<div style={{fontSize:12,color:"#6B7280",marginTop:1}}>기준 2026-06-09 · 5월 누계 · 억원(수주:VAT별도 / 매출·지출:VAT포함)</div>}
          </div>
        </div>

        {/* 바디 */}
        <div style={{padding:isMobile?"12px 10px":"20px 24px",maxWidth:1440}}>

        {tab==="notice"    && (canReadTab("notice") ? <NoticeBoardTab currentUser={currentUser} canWrite={canWrite&&canWriteTab("notice")}/> : <NoPermScreen tabId="notice"/>)}
        {tab==="stats"     && (canReadTab("stats")  ? <StatsTab projects={projects}/> : <NoPermScreen tabId="stats"/>)}
        {tab==="gamify"    && (canReadTab("gamify") ? <GamifyTab projects={projects} currentUser={currentUser}/> : <NoPermScreen tabId="gamify"/>)}
        {tab==="deptdash"  && <DeptDashTab projects={projects} vendorPayments={vendorPayments} years={years}/>}
        {tab==="home" && <MobileHub setTab={setTab} tabOrder={tabOrder} currentUser={currentUser} projects={projects} cashItems={cashItems}/>}
        {tab==="analysis"  && (canReadTab("analysis") ? <AnalysisHub deptStaff={deptStaff} setDeptStaff={setDeptStaff} years={years} setYears={setYears} canWrite={canWrite} isAdmin={currentUser?.role==="admin"} cashflow={effectiveCashflow} cashItems={cashItems} setCashItems={setCashItems} saleItems={saleItems} setSaleItems={setSaleItems} contractItems={contractItems} setContractItems={setContractItems} projects={projects} setProjects={setProjects} setTab={setTab} setSelProjId={setSelProjId} setDetailTab={setDetailTab} selProjId={selProjId} selVerIdx={selVerIdx} setSelVerIdx={setSelVerIdx} currentUser={currentUser} yearTargets={yearTargets} setYearTargets={setYearTargets} deptBiz={deptBiz} staffMonthly={staffMonthly} staffTarget={staffTarget} deptStaff={deptStaff}/> : <NoPermScreen tabId="analysis"/>)}
        {tab==="datahub" && canReadTab("datahub") && <DataHubTab currentUser={currentUser} deptStaff={deptStaff} setDeptStaff={setDeptStaff} staffTarget={staffTarget} setStaffTarget={setStaffTarget} staffMonthly={staffMonthly} setStaffMonthly={setStaffMonthly} pnlData={pnlData} setPnlData={setPnlData} cashflow={cashflow} setCashflow={setCashflow} years={years} setYears={setYears} projects={projects} setProjects={setProjects} setTab={setTab} setSelProjId={setSelProjId} setSelVerIdx={setSelVerIdx} setShowNewProj={setShowNewProj} versions={versions} saveVersion={saveVersion} restoreVersion={restoreVersion} deleteVersion={deleteVersion} contractTypes={contractTypes} setContractTypes={setContractTypes} projTypes={projTypes} setProjTypes={setProjTypes} bidTypes={bidTypes} setBidTypes={setBidTypes} allData={null} restoreAllData={(entries)=>dbSetAll(entries, userEmail.current)} dbStatus={dbStatus} vendorsDB={vendorsDB} setVendorsDB={setVendorsDB} vendorPayments={vendorPayments} setVendorPayments={setVendorPayments} cashItems={cashItems} setCashItems={setCashItems} saleItems={saleItems} setSaleItems={setSaleItems} contractItems={contractItems} setContractItems={setContractItems}/>}
        {tab==="cashflow" && canReadTab("cashflow") && <CashflowTab cashflow={effectiveCashflow} setCashflow={setCashflow} currentUser={currentUser} projects={projects} setProjects={setProjects} projectCashflowByDept={projectCashflowByDept} cashItems={cashItems} setCashItems={setCashItems} saleItems={saleItems} setSaleItems={setSaleItems} setTab={setTab} setSelProjId={setSelProjId} setDetailTab={setDetailTab} yearTargets={yearTargets} setYearTargets={setYearTargets} deptBiz={deptBiz} deptStaff={deptStaff} staffMonthly={staffMonthly} staffTarget={staffTarget} contractItems={contractItems} setContractItems={setContractItems}/>}
        {tab==="projects" && canReadTab("projects") && <ProjectsTab projects={projects} setProjects={setProjects} selProjId={selProjId} setSelProjId={setSelProjId} selVerIdx={selVerIdx} setSelVerIdx={setSelVerIdx} cmpIds={cmpIds} setCmpIds={setCmpIds} showNewVer={showNewVer} setShowNewVer={setShowNewVer} canWrite={canWrite&&canWriteTab("projects")} contractTypes={contractTypes} currentUser={currentUser} setDetailTab={setDetailTab} detailTab={detailTab} cashItems={cashItems} setCashItems={setCashItems} vendorsDB={vendorsDB} projBaseline={projBaseline} setProjBaseline={setProjBaseline}/>}
        {tab==="vendors" && canReadTab("vendors") && <VendorsTab projects={projects} setProjects={setProjects} vendorsDB={vendorsDB} setVendorsDB={setVendorsDB} vendorPayments={vendorPayments} setVendorPayments={setVendorPayments} canWrite={canWrite&&canWriteTab("vendors")} currentUser={currentUser} setTab={setTab} setSelProjId={setSelProjId} setSelVerIdx={setSelVerIdx}/>}
        {tab==="pnl"      && canReadTab("pnl")      && <PnlTab pnlData={pnlData} setPnlData={setPnlData} canWrite={canWrite&&canWriteTab("pnl")}/>}
        {tab==="optimize" && <OptimizeTab projects={projects} deptStaff={deptStaff} pnlData={pnlData}/>}
        {tab==="archive"   && <ArchiveTab currentUser={currentUser} projects={projects}/>}
        {tab==="docvault"  && <DocVaultPage currentUser={currentUser} projects={projects}/>}
        {tab==="staffmgmt" && <StaffMgmtPage currentUser={currentUser} deptStaff={deptStaff} setDeptStaff={setDeptStaff} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS} setTab={setTab}/>}
        {tab==="contract"  && <ContractTab projects={projects} currentUser={currentUser}/>}
        {tab==="history"   && <ProjectHistoryPage projects={projects} currentUser={currentUser} cashItems={cashItems}/>}
        {tab==="calendar"  && <SmartSchedulePage projects={projects} cashItems={cashItems} contractItems={contractItems} currentUser={currentUser} schedules={schedules} setSchedules={setSchedules}/>}
        {tab==="manual"    && <ManualTab currentUser={currentUser}/>}
        {tab==="auth_mgmt"&& currentUser.role==="admin" && <AuthTab users={users} saveUsers={saveUsers} currentUser={currentUser} hashPw={hashPw}/>}
        </div>
      </div>
      </div>

      {showNewProj&&<NewProjModal onClose={()=>setShowNewProj(false)} onSave={p=>{setProjects(prev=>[...prev,normalizeProject({...p,id:`P${Date.now()}`,versions:[]})]);setShowNewProj(false)}}/>}

      {/* AI 어시스턴트: ANTHROPIC_API_KEY 설정 후 AIAssistant.jsx 활성화 */}
    </div>
    </DeptContext.Provider>
    </ToastProvider>
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
function AnalysisTab({deptStaff,setDeptStaff,years,setYears,canWrite,cashflow,cashItems=[],saleItems=[],projects=[]}) {
  const {DEPTS,DEPT_COLORS,DEPT_BIZ} = useDepts()
  const [aView,       setAView]       = useState("dashboard")
  const [view,        setView]         = useState("total")
  const [selDept,     setSelDept]      = useState(()=>DEPTS[0]||"")
  const [editStaff,   setEditStaff]    = useState(false)
  const [staffDraft,  setStaffDraft]   = useState({})
  const [showAddYear, setShowAddYear]  = useState(false)
  const [newYearForm, setNewYearForm]  = useState({yr:"",목표수주:0,실행수주:0,목표매출:0,실행매출:0,인원:0})

  const CF_2026 = cashflow
  const totalCash = CF_2026.reduce((s,d)=>s+(d.cash||0),0)
  const totalNote = CF_2026.reduce((s,d)=>s+(d.note||0),0)
  const totalBlue = CF_2026.reduce((s,d)=>s+(d.blue||0),0)
  const q = [[0,1,2],[3,4,5],[6,7,8],[9,10,11]].map(idx=>idx.reduce((s,i)=>s+(CF_2026[i]?.cash||0)+(CF_2026[i]?.note||0),0))
  const yearLine = years.map(y=>({name:y.yr, 수주:y.실행수주, 매출:y.실행매출, 인원:y.인원}))

  const noticePreview = (() => { try{ return JSON.parse(localStorage.getItem("sjs_notices")||"[]").slice(0,5) }catch{ return [] } })()

  return (
    <div>
      {/* 상단 탭 */}
      <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"2px solid #E5E7EB",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {[["dashboard","📊 경영 대시보드"],["total","📈 통합 분석"],["dept","🏢 본부별 분석"],["forecast","🔭 연말 손익 예상"]].map(([v,l])=>(
          <button key={v} onClick={()=>{setAView(v);if(v!=="dashboard"&&v!=="forecast")setView(v)}}
            style={{padding:"10px 18px",border:"none",
              background:v==="forecast"&&aView!==v?"#FEF9C3":"none",
              fontSize:14,fontWeight:aView===v?800:500,cursor:"pointer",
              color:aView===v?"#6366F1":v==="forecast"?"#D97706":"#6B7280",
              borderBottom:aView===v?"3px solid #6366F1":"3px solid transparent",
              marginBottom:-2,whiteSpace:"nowrap",flexShrink:0}}>
            {l}
          </button>
        ))}
      </div>

      {/* 공지 미리보기 */}
      {noticePreview.length>0&&(
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"12px 18px",marginBottom:14,boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
          <div style={{fontSize:13,fontWeight:800,color:"#DC2626",marginBottom:8}}>📢 최신 공지</div>
          {noticePreview.map(n=>(
            <div key={n.id} style={{display:"flex",gap:8,alignItems:"center",padding:"5px 0",borderBottom:"1px solid #F3F4F6"}}>
              {n.important&&<span style={{fontSize:11,fontWeight:700,color:"#DC2626",flexShrink:0}}>●</span>}
              <span style={{flex:1,fontSize:13.5,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</span>
              <span style={{fontSize:11,color:"#9CA3AF",flexShrink:0}}>{n.createdAt?.slice(0,10)}</span>
              <span style={{fontSize:11,color:"#9CA3AF",flexShrink:0}}>👁{n.views||0}</span>
            </div>
          ))}
        </div>
      )}

      {aView==="forecast" && <YearEndForecast cashItems={cashItems} saleItems={saleItems} contractItems={contractItems} deptBiz={deptBiz} years={years} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS}/>}

      {/* 경영 대시보드 */}
      {aView==="dashboard" && <AnalysisDashboard projects={projects} cashItems={cashItems} saleItems={saleItems} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS} DEPT_BIZ={DEPT_BIZ} deptStaff={deptStaff} years={years} contractItems={contractItems} yearTargets={yearTargets}/>}

      {/* 기존 통합/본부별 분석 */}
      {aView!=="dashboard" && aView!=="forecast" && (
        <div>
          <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:2,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:8,padding:3}}>
              {[["total","통합"],["dept","본부별"]].map(([v,l])=>(
                <button key={v} onClick={()=>{setView(v);setAView(v)}} style={{padding:"6px 14px",border:"none",borderRadius:6,fontSize:12,fontWeight:view===v?500:400,cursor:"pointer",background:view===v?"var(--color-background-primary,#fff)":"none",color:view===v?C.navyM:"var(--color-text-secondary,#888)",boxShadow:view===v?"0 0 0 0.5px var(--color-border-tertiary)":"none"}}>{l}</button>
              ))}
            </div>
            {view==="dept" && (
              <select value={selDept} onChange={e=>setSelDept(e.target.value)} style={{padding:"6px 10px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
                {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            )}
            {canWrite && (
              !editStaff
                ? <button onClick={()=>{setStaffDraft({...deptStaff});setEditStaff(true)}} style={{...S.btn(C.navyL,C.navyM),padding:"6px 13px",fontSize:12,marginLeft:"auto"}}>인원 수정</button>
                : <div style={{display:"flex",gap:7,marginLeft:"auto"}}>
                    <button onClick={()=>{setDeptStaff(staffDraft);setEditStaff(false)}} style={{...S.btn(C.green),padding:"6px 13px",fontSize:12}}>저장</button>
                    <button onClick={()=>setEditStaff(false)} style={{...S.btn(C.grayL,C.gray),padding:"6px 13px",fontSize:12}}>취소</button>
                  </div>
            )}
            <button onClick={()=>setShowAddYear(v=>!v)} style={{...S.btn(C.navyL,C.navyM),padding:"6px 13px",fontSize:12}}>
              {showAddYear?"닫기":"+ 연도 추가"}
            </button>
          </div>

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

          {view==="total" && (
            <>
              <div style={S.grid(6)}>
                {[["연간합계",`${(totalCash+totalNote).toFixed(2)}억`,"현금+어음",C.navyM],["현금",`${totalCash.toFixed(2)}억`,"어음제외",C.navyM],["어음",totalNote>0?`${totalNote.toFixed(2)}억`:"없음","별도관리",totalNote>0?C.amber:C.gray],["민간위험",`${totalBlue.toFixed(2)}억`,"파란셀",C.red],["상반기",`${(q[0]+q[1]).toFixed(2)}억`,"1~6월",""],["하반기",`${(q[2]+q[3]).toFixed(2)}억`,"7~12월",""]].map(([l,v,s,cc])=>(
                  <div key={l} style={S.kpi(cc||C.navyM)}>
                    <div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginBottom:6}}>{l}</div>
                    <div style={{fontSize:20,fontWeight:500,color:cc||"var(--color-text-primary)"}}>{v}</div>
                    <div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginTop:4}}>{s}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {view==="dept" && (()=>{
            const deptTotal=cashflow.reduce((s,m)=>s+(m.byDept?.[selDept]||0),0)
            return (
              <div style={S.grid(4)}>
                {[["연간 예상",fE(deptTotal),"현금+어음",C.navyM],["비율(전체대비)",`${(deptTotal/(totalCash+totalNote)*100).toFixed(1)}%`,"기여도",C.amber]].map(([l,v,s,c])=>(
                  <div key={l} style={S.kpi(c||C.navyM)}><div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginBottom:6}}>{l}</div><div style={{fontSize:20,fontWeight:500,color:c||"var(--color-text-primary)"}}>{v}</div>{s&&<div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginTop:4}}>{s}</div>}</div>
                ))}
              </div>
            )
          })()}
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
// ════════════════════════════════════════════════════════════
// 💧 월수금계획 탭 v3 — 계약현황·매출현황 통합
// ════════════════════════════════════════════════════════════
function CashflowTab({cashflow,setCashflow,currentUser,projects,setProjects,projectCashflowByDept,cashItems=[],setCashItems,saleItems=[],setSaleItems,setTab,setSelProjId,yearTargets={},setYearTargets,deptBiz={},deptStaff={},staffMonthly={},staffTarget={},initTab,setDetailTab,hideTabNav=false,contractItems=[],setContractItems}) {
  const {DEPTS,DEPT_COLORS} = useDepts()
  const NOW   = new Date()
  const YEAR  = NOW.getFullYear()
  const MONTH = NOW.getMonth()+1
  const YR    = String(YEAR)

  const [mainTab,   setMainTab]   = useState(initTab||"cash")
  const [cashView,  setCashView]  = useState("overview")
  const [selDetail, setSelDetail] = useState(null)
  const [editTargets, setEditTargets] = useState(false)
  const [targetDraft, setTargetDraft] = useState({})

  const isAdmin = currentUser?.role==="admin"
  const toast   = useToast()

  const targets   = yearTargets[YEAR] || {salesTarget:145, contractTarget:170}
  const tSales    = targets.salesTarget    || 145
  const tContract = targets.contractTarget || 170

  // ── 인원 헬퍼 ─────────────────────────────────────────────
  const num = v => Number.isFinite(+v) ? +v : 0
  const lastFilled = arr => { let i=arr.length-1; while(i>=0&&!arr[i])i--; return i }

  // 본부별 인원 3종: 목표인원, 연평균, 현재인원
  const getStaffInfo = (dept) => {
    const target  = num(staffTarget?.[dept]?.[YR]) || num(deptBiz[dept]?.orderTarget ? 0 : 0) || 0
    const monthly = staffMonthly?.[dept]?.[YR] || Array(12).fill(0)
    const filled  = monthly.filter(v=>num(v)>0)
    const avgStaff= filled.length>0 ? Math.round(filled.reduce((s,v)=>s+num(v),0)/filled.length*10)/10 : (deptStaff[dept]?.total||0)
    const li      = lastFilled(monthly)
    const current = li>=0 ? num(monthly[li]) : (deptStaff[dept]?.total||0)
    return {target, avg:avgStaff, current, monthly}
  }

  // ── 헬퍼 ─────────────────────────────────────────────────
  const fixDate = s => {
    if(!s) return ""
    const n=parseInt(String(s))
    if(!isNaN(n)&&n>40000&&n<60000){const d=new Date((n-25569)*86400*1000);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`}
    return String(s).trim()
  }
  const fAmt = n => n===0?"-":n>=1e8?`${(n/1e8).toFixed(2)}억`:n>=1e4?`${(n/1e4).toFixed(1)}만`:`${n.toLocaleString()}원`
  const fAok = n => n>=1e8?`${(n/1e8).toFixed(2)}억`:n>=1e4?`${(n/1e4).toFixed(0)}만`:`${n.toLocaleString()}원`
  const getYM = item => { const d=fixDate(item.paidDate||item.expectedDate); return d?d.slice(0,7):"미정" }
  const pct = (a,b) => b>0?Math.round(a/b*100):0

  // ── 월수금 집계 ───────────────────────────────────────────
  const cashByDept = useMemo(()=> DEPTS.map(dept=>{
    const all   = cashItems.filter(i=>i.dept===dept)
    const paid  = all.filter(i=>i.paidDate).reduce((s,i)=>s+(i.amount||0),0)
    // 기성+확정: 입금완료일 없고 입금예상일 있는 것 중 미정/추진 제외
    const conf  = all.filter(i=>!i.paidDate&&i.expectedDate&&i.itemType!=="미정"&&i.itemType!=="추진").reduce((s,i)=>s+(i.amount||0),0)
    // 미정(불확실): 구분이 미정 또는 추진인 항목
    const push  = all.filter(i=>i.itemType==="미정"||i.itemType==="추진").reduce((s,i)=>s+(i.amount||0),0)
    const si    = getStaffInfo(dept)
    const cur   = si.current || 1  // 현재인원 (인당 계산 기준)
    return {dept, paid, conf, total:paid+conf, push, all, color:DEPT_COLORS[dept]||"#6366F1",
      staffTarget: si.target,   // 목표인원
      staffAvg:    si.avg,      // 연평균인원 (DataHub 기준)
      staffCurrent:si.current,  // 현재인원
      perCapitaPaid: paid/cur,         // 현재인원 기준 인당(현누계)
      perCapitaConf: (paid+conf)/cur,  // 현재인원 기준 인당(기성+확정)
    }
  }),[cashItems,DEPTS,DEPT_COLORS,staffMonthly,staffTarget,deptStaff])

  const totalPaid = cashByDept.reduce((s,d)=>s+d.paid,0)
  const totalConf = cashByDept.reduce((s,d)=>s+d.conf,0)
  const totalPush = cashByDept.reduce((s,d)=>s+d.push,0)
  const totalCash = totalPaid+totalConf  // 기성+확정 합계

  // 월별 집계
  const monthlyData = useMemo(()=>Array.from({length:12},(_,mi)=>{
    const ym=`${YR}-${String(mi+1).padStart(2,"0")}`
    const mItems=cashItems.filter(i=>getYM(i)===ym)
    const paid   =mItems.filter(i=>i.paidDate).reduce((s,i)=>s+(i.amount||0),0)
    const exp    =mItems.filter(i=>!i.paidDate&&i.expectedDate&&i.itemType!=="미정"&&i.itemType!=="추진").reduce((s,i)=>s+(i.amount||0),0)
    const mijeong=mItems.filter(i=>i.itemType==="미정"||i.itemType==="추진").reduce((s,i)=>s+(i.amount||0),0)
    const byDept={}
    DEPTS.forEach(d=>{ byDept[d]=mItems.filter(i=>i.dept===d&&(i.paidDate||i.expectedDate)).reduce((s,i)=>s+(i.amount||0),0) })
    return {month:mi+1,label:`${mi+1}월`,paid,exp,mijeong,total:paid+exp,byDept,isPast:(mi+1)<MONTH,isCurrent:(mi+1)===MONTH,items:mItems}
  }),[cashItems,YR,MONTH,DEPTS])

  // ── 계약현황 집계 ─────────────────────────────────────────
  // 수주 판단: 민간은 해당 프로젝트의 월수금에서 10% 이상 입금완료 항목이 있을 때
  const isWon = (proj) => {
    // type이 명시적으로 계약이면 즉시 true
    if(proj.type==="계약"||proj.type==="계약(수주)") return true
    if(proj.orderType==="공공") return !!proj.contractDate
    // 민간: cashItems에서 이 프로젝트의 입금완료 금액이 용역비의 10% 이상
    const projCash = cashItems.filter(i=>i.paidDate&&(i.projectName===proj.name||(i.projectName&&proj.name&&i.projectName.includes(proj.name.slice(0,6)))))
    const paidAmt  = projCash.reduce((s,i)=>s+(i.amount||0),0)
    return proj.serviceFee>0 && paidAmt >= proj.serviceFee*0.1
  }

  // ── 당해연도 신규 판별 ────────────────────────────────────
  const isNewThisYear = (proj) => {
    if(proj.contractYear && String(proj.contractYear)===YR) return true
    if(!proj.contractYear && proj.contractDate && proj.contractDate.startsWith(YR)) return true
    return false
  }

  const contractByDept = useMemo(()=> DEPTS.map(dept=>{
    const myProjs = projects.filter(p=>(p.depts||[]).includes(dept)||(p.deptShares||[]).some(s=>s.dept===dept))
    const share = p => { const s=(p.deptShares||[]).find(s=>s.dept===dept); return s?s.share/100:1/(p.depts?.length||1) }
    const db = deptBiz[dept]||{}

    // ★ 당해연도 신규만 집계
    const myNew  = myProjs.filter(isNewThisYear)
    const won    = myNew.filter(p=>isWon(p)&&p.type!=="추진")
    const wonAmt = won.reduce((s,p)=>s+(p.serviceFee||0)*share(p),0)
    const conf   = myNew.filter(p=>p.type==="확정"&&!isWon(p))
    const confAmt= conf.reduce((s,p)=>s+(p.serviceFee||0)*share(p),0)
    const push   = myNew.filter(p=>p.type==="추진")
    const pushAmt= push.reduce((s,p)=>s+(p.serviceFee||0)*share(p),0)
    const amend  = myNew.filter(p=>p.isAmendment)
    const amendAmt= amend.reduce((s,p)=>s+(p.amendAmount||p.serviceFee||0)*share(p),0)
    const target = db.orderTarget||0

    // 인원 3종
    const si = getStaffInfo(dept)
    const cur = si.current||1

    return {dept,target,won:wonAmt,conf:confAmt,push:pushAmt,amend:amendAmt,
      total:wonAmt+confAmt,totalWithPush:wonAmt+confAmt+pushAmt,
      rate:target>0?pct(wonAmt+confAmt,target*1e8):null,
      wonProjs:won,confProjs:conf,pushProjs:push,amendProjs:amend,
      color:DEPT_COLORS[dept]||"#6366F1",
      staffTarget:si.target, staffAvg:si.avg, staffCurrent:si.current,
      perCapita:(wonAmt+confAmt)/cur,
    }
  }),[projects,DEPTS,deptBiz,cashItems,DEPT_COLORS,staffMonthly,staffTarget,YR])

  const totContractTarget = contractByDept.reduce((s,d)=>s+d.target,0)
  const totWon    = contractByDept.reduce((s,d)=>s+d.won,0)
  const totConf   = contractByDept.reduce((s,d)=>s+d.conf,0)
  const totPush   = contractByDept.reduce((s,d)=>s+d.push,0)
  const totConAll = totWon+totConf

  const maxBar = Math.max(...cashByDept.map(d=>d.total+d.push), totalCash, 1)

  // ── 상세 드릴다운 ─────────────────────────────────────────
  if(selDetail) {
    const goBack = () => setSelDetail(null)
    const {type, dept, items:detailItems} = selDetail
    const MONTHS_LABEL = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"]

    // 프로젝트별 그룹핑
    const projGroups = {}
    detailItems.forEach(item=>{
      const key = item.projectName||"기타"
      if(!projGroups[key]) projGroups[key]=[]
      projGroups[key].push(item)
    })

    // 각 프로젝트별로 월별 금액 집계
    const projRows = Object.entries(projGroups).map(([projName, items])=>{
      const totalFee = items.reduce((s,i)=>s+(i.amount||0),0)
      const prevPaid = items.filter(i=>i.paidDate&&fixDate(i.paidDate)<`${YR}-01`).reduce((s,i)=>s+(i.amount||0),0)
      const monthly  = Array.from({length:12},(_,mi)=>{
        const m=String(mi+1).padStart(2,"0")
        const ym=`${YR}-${m}`
        const paid = items.filter(i=>i.paidDate&&fixDate(i.paidDate).slice(0,7)===ym).reduce((s,i)=>s+(i.amount||0),0)
        const exp  = items.filter(i=>!i.paidDate&&i.expectedDate&&i.itemType!=="미정"&&i.itemType!=="추진"&&fixDate(i.expectedDate).slice(0,7)===ym).reduce((s,i)=>s+(i.amount||0),0)
        return {paid,exp,total:paid+exp}
      })
      const cumToNow = monthly.slice(0,MONTH).reduce((s,m)=>s+m.paid,0)
      const confTotal= items.filter(i=>i.paidDate||i.expectedDate).reduce((s,i)=>s+(i.amount||0),0)
      const yearTotal= monthly.reduce((s,m)=>s+m.total,0)
      const carryOver= totalFee - yearTotal - prevPaid
      return {projName,totalFee,prevPaid,monthly,cumToNow,confTotal,yearTotal,carryOver,items}
    })

    // 구분별 색상
    const secColor = {
      "현누계":  {bg:"#D1FAE5", text:"#059669", border:"#059669"},
      "기성+확정":{bg:"#EEF2FF", text:"#6366F1", border:"#6366F1"},
      "추진":    {bg:"#FEF3CD", text:"#D97706", border:"#D97706"},
      "계약(수주)":{bg:"#D1FAE5",text:"#059669",border:"#059669"},
      "확정":    {bg:"#EEF2FF", text:"#6366F1", border:"#6366F1"},
    }
    const sc = secColor[type] || {bg:"#F8FAFC",text:"#374151",border:"#E5E7EB"}

    const totalByMonth = Array.from({length:12},(_,mi)=>({
      paid:  projRows.reduce((s,r)=>s+r.monthly[mi].paid,0),
      exp:   projRows.reduce((s,r)=>s+r.monthly[mi].exp,0),
      total: projRows.reduce((s,r)=>s+r.monthly[mi].total,0),
    }))
    const grandTotal   = projRows.reduce((s,r)=>s+r.yearTotal,0)
    const grandConf    = projRows.reduce((s,r)=>s+r.confTotal,0)
    const grandCarry   = projRows.reduce((s,r)=>s+r.carryOver,0)
    const grandCumToNow= projRows.reduce((s,r)=>s+r.cumToNow,0)

    
    return (
      <div>
        <button onClick={goBack} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:sc.bg,color:sc.text,border:`1px solid ${sc.border}`,borderRadius:9,fontSize:13.5,fontWeight:700,cursor:"pointer",marginBottom:16}}>
          ← 돌아가기
        </button>
        <div style={{background:"#fff",borderRadius:14,border:`2px solid ${sc.border}`,padding:"18px 20px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:4}}>
            <div style={{fontSize:18,fontWeight:800,color:sc.text}}>{dept} — {type}</div>
            <div style={{display:"flex",gap:12,fontSize:13,color:"#6B7280"}}>
              <span>총 {detailItems.length}건</span>
              <span style={{fontWeight:700,color:sc.text}}>{fCa(grandTotal)} ({YEAR}년)</span>
              <span>이월예상 {fCa(grandCarry)}</span>
            </div>
          </div>
          <div style={{fontSize:12,color:"#9CA3AF",marginBottom:10}}>단위: 억원 · 빨간 테두리 = 현재월 기준</div>
          {/* 발주구분별 소계 */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:6}}>
            {["공공","민간","해외"].map(ot=>{
              const g=detailItems.filter(i=>i.orderType===ot);const a=g.reduce((s,i)=>s+(i.amount||0),0)
              if(!a) return null
              return <div key={ot} style={{background:"#F8FAFC",border:"1px solid #E5E7EB",borderRadius:10,padding:"6px 12px"}}>
                <span style={{fontSize:11,color:"#6B7280"}}>{ot} {g.length}건 </span>
                <span style={{fontSize:13,fontWeight:800,color:ot==="공공"?"#6366F1":ot==="민간"?"#059669":"#D97706"}}>{fCa(a)}</span>
              </div>
            })}
          </div>
        </div>

        {/* 민간 발주처(건설사)별 분류 */}
        {(()=>{
          const byClient={}
          detailItems.filter(i=>i.orderType==="민간").forEach(i=>{
            const key=i.stage||"미분류"
            if(!byClient[key])byClient[key]={items:[],amt:0}
            byClient[key].items.push(i);byClient[key].amt+=(i.amount||0)
          })
          const list=Object.entries(byClient).sort((a,b)=>b[1].amt-a[1].amt)
          if(list.length<=1)return null
          return (
            <div style={{background:"#F0FDF4",borderRadius:14,border:"1px solid #059669",padding:"14px 18px",marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:800,color:"#065F46",marginBottom:10}}>🏗 민간 발주처(건설사)별 분류</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {list.map(([name,grp])=>(
                  <div key={name} style={{background:"#fff",border:"1px solid #D1FAE5",borderRadius:10,padding:"8px 14px"}}>
                    <div style={{fontSize:11.5,color:"#065F46",fontWeight:600,marginBottom:3}} title={name}>{name.length>14?name.slice(0,14)+"…":name}</div>
                    <div style={{fontSize:14,fontWeight:800,color:"#059669"}}>{fCa(grp.amt)}</div>
                    <div style={{fontSize:11,color:"#6B7280"}}>{grp.items.length}건</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* 가로형 캘린더 테이블 (첨부 이미지 형식) */}
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:16}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:1100}}>
              <thead>
                <tr style={{background:"#F8FAFC"}}>
                  <th style={{padding:"10px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB",borderRight:"1px solid #E5E7EB",minWidth:160,position:"sticky",left:0,background:"#F8FAFC",zIndex:2}}>프로젝트명</th>
                  <th style={{padding:"10px 10px",textAlign:"right",fontSize:12,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB",borderRight:"1px solid #E5E7EB",minWidth:70}}>설계비</th>
                  <th style={{padding:"10px 10px",textAlign:"right",fontSize:12,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB",borderRight:"2px solid #E5E7EB",minWidth:70}}>기수령액</th>
                  {MONTHS_LABEL.map((m,mi)=>(
                    <th key={m} style={{padding:"10px 8px",textAlign:"right",fontSize:12,fontWeight:700,
                      color:mi+1===MONTH?"#DC2626":"#6B7280",
                      borderBottom:"2px solid #E5E7EB",
                      borderRight:mi+1===MONTH?"2px solid #DC2626":"1px solid #E5E7EB",
                      borderLeft:mi+1===MONTH?"2px solid #DC2626":"none",
                      minWidth:60,background:mi+1===MONTH?"#FFF8F8":"#F8FAFC"}}>{m}</th>
                  ))}
                  <th style={{padding:"10px 10px",textAlign:"right",fontSize:12,fontWeight:700,color:"#059669",borderBottom:"2px solid #E5E7EB",borderLeft:"2px solid #E5E7EB",borderRight:"1px solid #E5E7EB",minWidth:70,background:"#D1FAE5"}}>{MONTH}월누계</th>
                  <th style={{padding:"10px 10px",textAlign:"right",fontSize:12,fontWeight:700,color:"#6366F1",borderBottom:"2px solid #E5E7EB",borderRight:"1px solid #E5E7EB",minWidth:70,background:"#EEF2FF"}}>확정합계</th>
                  <th style={{padding:"10px 10px",textAlign:"right",fontSize:12,fontWeight:700,color:"#312E81",borderBottom:"2px solid #E5E7EB",borderRight:"1px solid #E5E7EB",minWidth:70,background:"#DBEAFE"}}>{YEAR}년합계</th>
                  <th style={{padding:"10px 10px",textAlign:"right",fontSize:12,fontWeight:700,color:"#374151",borderBottom:"2px solid #E5E7EB",minWidth:70}}>이월예상액</th>
                </tr>
              </thead>
              <tbody>
                {projRows.map((row,ri)=>{
                  const hasMultiYear = row.carryOver>0
                  return (
                    <tr key={row.projName} style={{background:ri%2===0?"#fff":"#FAFAFA",borderBottom:"1px solid #E5E7EB"}}>
                      <td style={{padding:"9px 12px",fontSize:13,fontWeight:600,color:"#6366F1",borderRight:"1px solid #E5E7EB",position:"sticky",left:0,background:ri%2===0?"#fff":"#FAFAFA",zIndex:1,minWidth:180,maxWidth:300,cursor:"pointer",textDecoration:"underline",whiteSpace:"normal",wordBreak:"keep-all",lineHeight:1.4}}
                        onClick={()=>{
                          const norm=s=>(s||"").replace(/[\s\-_·.\(\)【】\[\]]/g,"").toLowerCase()
                          const an=norm(row.projName)
                          const found=(projects||[]).find(p=>{const bn=norm(p.name);return an===bn||an.includes(bn.slice(0,Math.min(bn.length,8)))||bn.includes(an.slice(0,Math.min(an.length,8)))})
                          if(found&&setTab&&setSelProjId){setSelProjId(found.id);setDetailTab&&setDetailTab("info");setTab("projects")}
                        }}
                        title={row.projName}>{row.projName}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:12.5,fontWeight:600,color:"#374151",borderRight:"1px solid #E5E7EB"}}>{row.totalFee>0?fC(row.totalFee):"-"}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:12.5,color:"#6B7280",borderRight:"2px solid #E5E7EB"}}>{row.prevPaid>0?fC(row.prevPaid):"-"}</td>
                      {row.monthly.map((m,mi)=>(
                        <td key={mi} style={{padding:"9px 8px",textAlign:"right",fontSize:12.5,fontWeight:m.total>0?700:400,
                          color:m.paid>0?"#059669":m.exp>0?"#6366F1":"#D1D5DB",
                          borderRight:mi+1===MONTH?"2px solid #DC2626":"1px solid #E5E7EB",
                          borderLeft:mi+1===MONTH?"2px solid #DC2626":"none",
                          background:mi+1===MONTH?"#FFF8F8":m.paid>0?"#ECFDF5":m.exp>0?"#EEF2FF":"transparent"}}>
                          {m.paid>0?fC(m.paid):m.exp>0?<span style={{color:"#6366F1"}}>{fC(m.exp)}</span>:"-"}
                        </td>
                      ))}
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:13,fontWeight:700,color:"#059669",borderLeft:"2px solid #E5E7EB",background:"#D1FAE5"}}>{row.cumToNow>0?fC(row.cumToNow):"-"}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:13,fontWeight:700,color:"#6366F1",background:"#EEF2FF"}}>{row.confTotal>0?fC(row.confTotal):"-"}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:13,fontWeight:800,color:"#312E81",background:"#DBEAFE"}}>{row.yearTotal>0?fC(row.yearTotal):"-"}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:13,fontWeight:hasMultiYear?700:400,color:hasMultiYear?"#374151":"#D1D5DB"}}>{row.carryOver>0?fC(row.carryOver):"-"}</td>
                    </tr>
                  )
                })}
                {/* 합계 행 */}
                <tr style={{background:"#EEF2FF",fontWeight:700,borderTop:"2px solid #E5E7EB"}}>
                  <td style={{padding:"10px 12px",fontSize:13.5,fontWeight:800,color:"#312E81",borderRight:"1px solid #E5E7EB",position:"sticky",left:0,background:"#EEF2FF",zIndex:1}}>합계</td>
                  <td style={{padding:"10px 10px",textAlign:"right",fontSize:13,color:"#312E81",borderRight:"1px solid #E5E7EB"}}>{fC(projRows.reduce((s,r)=>s+r.totalFee,0))}</td>
                  <td style={{padding:"10px 10px",textAlign:"right",fontSize:13,color:"#6B7280",borderRight:"2px solid #E5E7EB"}}>{fC(projRows.reduce((s,r)=>s+r.prevPaid,0))}</td>
                  {totalByMonth.map((m,mi)=>(
                    <td key={mi} style={{padding:"10px 8px",textAlign:"right",fontSize:13,fontWeight:800,
                      color:m.paid>0?"#059669":m.exp>0?"#6366F1":"#D1D5DB",
                      borderRight:mi+1===MONTH?"2px solid #DC2626":"1px solid #E5E7EB",
                      borderLeft:mi+1===MONTH?"2px solid #DC2626":"none",
                      background:mi+1===MONTH?"#FFF5F5":"transparent"}}>
                      {m.paid>0?fC(m.paid):m.exp>0?fC(m.exp):"-"}
                    </td>
                  ))}
                  <td style={{padding:"10px 10px",textAlign:"right",fontSize:14,fontWeight:800,color:"#059669",borderLeft:"2px solid #E5E7EB",background:"#D1FAE5"}}>{fC(grandCumToNow)}</td>
                  <td style={{padding:"10px 10px",textAlign:"right",fontSize:14,fontWeight:800,color:"#6366F1",background:"#DBEAFE"}}>{fC(grandConf)}</td>
                  <td style={{padding:"10px 10px",textAlign:"right",fontSize:15,fontWeight:800,color:"#312E81",background:"#BFDBFE"}}>{fC(grandTotal)}</td>
                  <td style={{padding:"10px 10px",textAlign:"right",fontSize:14,fontWeight:700,color:"#374151"}}>{grandCarry>0?fC(grandCarry):"-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 색상 범례 */}
        <div style={{display:"flex",gap:16,fontSize:12,color:"#6B7280",padding:"8px 4px"}}>
          <span><span style={{display:"inline-block",width:12,height:12,background:"#D1FAE5",border:"1px solid #059669",borderRadius:2,marginRight:5}}/>입금 완료</span>
          <span><span style={{display:"inline-block",width:12,height:12,background:"#EEF2FF",border:"1px solid #6366F1",borderRadius:2,marginRight:5}}/>입금 예정</span>
          <span><span style={{display:"inline-block",width:12,height:12,background:"#FFF8F8",border:"2px solid #DC2626",borderRadius:2,marginRight:5}}/>현재월</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── 상단 탭 (hideTabNav일 때 숨김) ── */}
      {!hideTabNav&&<div style={{display:"flex",gap:0,borderBottom:"2px solid #E5E7EB",marginBottom:4,flexWrap:"wrap"}}>
        {[["cash","💧 월수금계획"],["contract","📝 계약현황"],["expense","💸 지출현황"]].map(([v,l])=>(
          <button key={v} onClick={()=>{setMainTab(v);setCashView("overview")}}
            style={{padding:"11px 20px",border:"none",background:"none",fontSize:14.5,fontWeight:mainTab===v?800:500,cursor:"pointer",
              color:mainTab===v?(v==="cash"?"#6366F1":v==="contract"?"#059669":"#DC2626"):"#6B7280",
              borderBottom:mainTab===v?`3px solid ${v==="cash"?"#6366F1":v==="contract"?"#059669":"#DC2626"}`:"3px solid transparent",marginBottom:-2}}>
            {l}
          </button>
        ))}
      </div>}

      {/* ── 액션 버튼 (항상 표시) ── */}
      <div style={{display:"flex",gap:8,paddingBottom:10,alignItems:"center",flexWrap:"wrap",marginBottom:hideTabNav?12:0,borderBottom:hideTabNav?"2px solid #E5E7EB":"none"}}>
        {/* 목표 설정 - 관리자만 */}
        {currentUser?.role==="admin" && (!editTargets
          ?<button onClick={()=>{setEditTargets(true);setTargetDraft({...targets})}}
              style={{padding:"6px 12px",background:"#F3F4F6",color:"#6B7280",border:"1px solid #E5E7EB",borderRadius:9,fontSize:12,fontWeight:600,cursor:"pointer"}}>
              ⚙ {YEAR}년 목표 설정
            </button>
          :<div style={{display:"flex",gap:6,alignItems:"center",background:"#FEF3CD",padding:"6px 12px",borderRadius:9,border:"1px solid #D9770644"}}>
              <label style={{fontSize:12,color:"#374151"}}>매출목표</label>
              <input type="number" value={targetDraft.salesTarget||""} onChange={e=>setTargetDraft(p=>({...p,salesTarget:parseFloat(e.target.value)||0}))}
                style={{width:70,padding:"4px 7px",border:"1px solid #E5E7EB",borderRadius:6,fontSize:12}}/>
              <label style={{fontSize:12,color:"#374151"}}>계약목표</label>
              <input type="number" value={targetDraft.contractTarget||""} onChange={e=>setTargetDraft(p=>({...p,contractTarget:parseFloat(e.target.value)||0}))}
                style={{width:70,padding:"4px 7px",border:"1px solid #E5E7EB",borderRadius:6,fontSize:12}}/>
              <span style={{fontSize:11,color:"#9CA3AF"}}>억원</span>
              <button onClick={()=>{setYearTargets(p=>({...p,[YEAR]:targetDraft}));setEditTargets(false)}}
                style={{padding:"4px 10px",background:"#D97706",color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}}>저장</button>
              <button onClick={()=>setEditTargets(false)} style={{padding:"4px 8px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:6,fontSize:12,cursor:"pointer"}}>취소</button>
            </div>
        )}
        {/* 월수금계획 탭 전용 버튼 */}
        {(!mainTab||mainTab==="cash")&&<>
          <button onClick={()=>downloadCashTemplate("cash")}
            style={{padding:"7px 14px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:9,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
            ⬇ 빈 양식
          </button>
          {currentUser?.role==="admin"&&<button onClick={()=>downloadCashDataExcel(cashItems,"월수금계획")}
            style={{padding:"7px 14px",background:"#EDE9FE",color:"#7C3AED",border:"none",borderRadius:9,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
            ⬇ 전체 데이터
          </button>}
          {currentUser?.role==="admin"&&<label style={{padding:"7px 14px",background:"#D1FAE5",color:"#059669",border:"none",borderRadius:9,fontSize:12.5,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}>
            ⬆ 엑셀 업로드
            <input type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={e=>uploadCashExcel(e,"cash",cashItems,setCashItems,saleItems,setSaleItems,DEPTS,currentUser)}/>
          </label>}
        </>}
        {/* 지출현황 탭 전용 버튼 */}
        {mainTab==="expense"&&<>
          <button onClick={()=>downloadCashTemplate("expense")}
            style={{padding:"7px 14px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:9,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
            ⬇ 빈 양식
          </button>
          {currentUser?.role==="admin"&&<button onClick={()=>downloadCashDataExcel(cashItems.filter(i=>i.itemType==="지출"||i.dept),"지출현황")}
            style={{padding:"7px 14px",background:"#EDE9FE",color:"#7C3AED",border:"none",borderRadius:9,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
            ⬇ 전체 데이터
          </button>}
          {currentUser?.role==="admin"&&<label style={{padding:"7px 14px",background:"#D1FAE5",color:"#059669",border:"none",borderRadius:9,fontSize:12.5,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}>
            ⬆ 엑셀 업로드
            <input type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={e=>uploadCashExcel(e,"expense",cashItems,setCashItems,saleItems,setSaleItems,DEPTS,currentUser)}/>
          </label>}
        </>}
        {/* 계약현황 탭: CashflowTab 버튼 없음 - ContractStatusPage에서 자체 처리 */}
      </div>

      {/* ══ 월수금계획 탭 ══ */}
      {mainTab==="cash"&&(
        <div>
          {/* 타이틀 KPI — 현누계 메인 표시 */}
          <div style={{background:"linear-gradient(135deg,#065F46,#059669)",borderRadius:16,padding:"22px 28px",marginBottom:20,color:"#fff"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16}}>
              <div>
                <div style={{fontSize:13,opacity:.75,marginBottom:4}}>💧 {YEAR}년 현누계 (입금 완료)</div>
                <div style={{fontSize:38,fontWeight:900,marginBottom:8,letterSpacing:"-0.03em"}}>{fAmt(totalPaid)}</div>
                <div style={{display:"flex",gap:8,fontSize:12.5,flexWrap:"wrap"}}>
                  <span style={{background:"rgba(255,255,255,.2)",padding:"4px 12px",borderRadius:20}}>기성+확정 {fAmt(totalCash)}</span>
                  <span style={{background:"rgba(255,255,255,.1)",padding:"4px 12px",borderRadius:20}}>미정 {fAmt(totalPush)}</span>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,opacity:.75,marginBottom:4}}>{YEAR}년 매출 목표</div>
                <div style={{fontSize:28,fontWeight:800,marginBottom:8}}>{tSales}억</div>
                <div style={{background:"rgba(255,255,255,.15)",borderRadius:12,padding:"12px 16px",minWidth:210}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                    <span>현누계 달성률</span>
                    <span style={{fontWeight:900,fontSize:16,color:"#34D399"}}>{pct(totalPaid,tSales*1e8)}%</span>
                  </div>
                  <div style={{height:10,background:"rgba(255,255,255,.2)",borderRadius:5,overflow:"hidden",marginBottom:6}}>
                    <div style={{height:"100%",background:"#34D399",borderRadius:5,width:`${Math.min(pct(totalPaid,tSales*1e8),100)}%`,transition:"width .5s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,opacity:.8}}>
                    <span>기성+확정 {pct(totalCash,tSales*1e8)}%</span>
                    <span>잔여 {fAmt(Math.max(tSales*1e8-totalPaid,0))}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 본부별 수금현황 표 */}
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:20}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #E5E7EB",fontSize:16,fontWeight:800,color:"#111827"}}>{YEAR}년 본부별 수금 현황 (단위: 억원)</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#EEF2FF"}}>
                    {["구분","매출목표","현누계(입금완료)","인당(현누계)","기성+확정","인당(기성+확정)","미정(불확실)","합계(현누계+기성)","합계(미정포함)"].map((h,i)=>(
                      <th key={i} style={{padding:"10px 12px",textAlign:i===0?"left":"right",fontSize:11.5,fontWeight:700,
                        color:i===2?"#059669":i===3?"#059669":i===4?"#6366F1":i===5?"#6366F1":i===6?"#D97706":i>=7?"#312E81":i===1?"#DC2626":"#6B7280",
                        borderBottom:"2px solid #E5E7EB",
                        background:i>=7?"#D1FAE5":i===3||i===5?"#ECFDF5":i===1?"#FFF0F0":"#EEF2FF",
                        whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashByDept.map((d,i)=>(
                    <tr key={d.dept} style={{background:i%2===0?"#fff":"#FAFAFA",borderBottom:"1px solid #E5E7EB"}}>
                      <td style={{padding:"10px 12px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:d.color}}/>
                          <span style={{fontSize:14,fontWeight:700,color:"#111827"}}>{d.dept}</span>
                        </div>
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"right",fontSize:13,fontWeight:700,color:"#DC2626"}}>
                        {(()=>{ const db=(deptBiz||{})[d.dept]||{}; const t=db.revTarget||0; return t>0?fAmt(t*1e8):"-" })()}
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"right",fontSize:13.5,fontWeight:700,color:"#059669",cursor:"pointer",textDecoration:"underline"}}
                        onClick={()=>setSelDetail({type:"현누계",dept:d.dept,items:d.all.filter(i=>i.paidDate)})}>
                        {d.paid>0?fAmt(d.paid):"-"}
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"right",fontSize:12.5,fontWeight:600,color:"#059669",background:"#ECFDF5"}}>
                        {d.perCapitaPaid>=1e8?`${(d.perCapitaPaid/1e8).toFixed(2)}억`:d.perCapitaPaid>=1e4?`${(d.perCapitaPaid/1e4).toFixed(0)}만`:"-"}
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"right",fontSize:13.5,fontWeight:600,color:"#6366F1",cursor:"pointer",textDecoration:"underline"}}
                        onClick={()=>setSelDetail({type:"기성+확정",dept:d.dept,items:d.all.filter(i=>i.paidDate||i.expectedDate)})}>
                        {d.total>0?fAmt(d.total):"-"}
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"right",fontSize:12.5,fontWeight:600,color:"#6366F1",background:"#ECFDF5"}}>
                        {d.perCapitaConf>=1e8?`${(d.perCapitaConf/1e8).toFixed(2)}억`:d.perCapitaConf>=1e4?`${(d.perCapitaConf/1e4).toFixed(0)}만`:"-"}
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"right",fontSize:13,color:"#D97706",cursor:"pointer",textDecoration:"underline"}}
                        onClick={()=>setSelDetail({type:"미정(불확실)",dept:d.dept,items:d.all.filter(i=>i.itemType==="미정"||i.itemType==="추진")})}>
                        {d.push>0?fAmt(d.push):"-"}
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"right",fontSize:14,fontWeight:800,color:"#312E81",background:"#ECFDF5"}}>{fAmt(d.paid+d.conf)}</td>
                      <td style={{padding:"10px 12px",textAlign:"right",fontSize:14,fontWeight:800,color:"#312E81",background:"#ECFDF5"}}>{fAmt(d.paid+d.conf+d.push)}</td>
                    </tr>
                  ))}
                  {/* 합계 행 */}
                  {(()=>{
                    const totalTarget  = cashByDept.reduce((s,d)=>s+d.staffTarget,0)
                    const totalAvg     = cashByDept.reduce((s,d)=>s+d.staffAvg,0)
                    const totalCurrent = cashByDept.reduce((s,d)=>s+d.staffCurrent,0)||1
                    const grandPaid    = totalPaid
                    const grandConf    = totalPaid+totalConf
                    const totRevTarget = DEPTS.reduce((s,d)=>{ const db=(deptBiz||{})[d]||{}; return s+(db.revTarget||0)*1e8 }, 0)
                    return (
                      <tr style={{background:"#D1FAE5",fontWeight:700,borderTop:"2px solid #E5E7EB"}}>
                        <td style={{padding:"11px 12px",fontSize:14,fontWeight:800,color:"#312E81"}}>합계</td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontSize:13,fontWeight:700,color:"#DC2626"}}>{totRevTarget>0?fAmt(totRevTarget):"-"}</td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontSize:14,fontWeight:800,color:"#059669"}}>{fAmt(grandPaid)}</td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontSize:13,fontWeight:700,color:"#059669",background:"#A7F3D0"}}>
                          {grandPaid/totalCurrent>=1e8?`${(grandPaid/totalCurrent/1e8).toFixed(2)}억`:grandPaid/totalCurrent>=1e4?`${(grandPaid/totalCurrent/1e4).toFixed(0)}만`:"-"}
                        </td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontSize:14,fontWeight:800,color:"#6366F1"}}>{fAmt(totalCash)}</td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontSize:13,fontWeight:700,color:"#6366F1",background:"#A7F3D0"}}>
                          {grandConf/totalCurrent>=1e8?`${(grandConf/totalCurrent/1e8).toFixed(2)}억`:grandConf/totalCurrent>=1e4?`${(grandConf/totalCurrent/1e4).toFixed(0)}만`:"-"}
                        </td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontSize:14,fontWeight:700,color:"#D97706"}}>{fAmt(totalPush)}</td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontSize:15,fontWeight:800,color:"#312E81",background:"#A7F3D0"}}>{fAmt(totalPaid+totalConf)}</td>
                        <td style={{padding:"11px 12px",textAlign:"right",fontSize:15,fontWeight:800,color:"#312E81",background:"#A7F3D0"}}>{fAmt(totalPaid+totalConf+totalPush)}</td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* 본부별 세로 바차트 + 파이차트 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:14,marginBottom:20}}>
            {/* 세로 바차트 */}
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"20px 24px"}}>
              <div style={{fontSize:15,fontWeight:800,color:"#111827",marginBottom:16}}>본부별 수금 현황</div>
              <div style={{display:"flex",gap:10,alignItems:"flex-end",minHeight:220,borderBottom:"2px solid #E5E7EB",paddingBottom:4,overflow:"visible"}}>
                {cashByDept.filter(d=>d.total+d.push>0).map((d,i)=>{
                  const maxD=Math.max(...cashByDept.map(x=>x.total+x.push),1)
                  const pH=Math.round((d.paid/maxD)*150)
                  const cH=Math.round((d.conf/maxD)*150)
                  const puH=Math.round((d.push/maxD)*150)
                  return (
                    <div key={d.dept} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:0,cursor:"pointer"}}
                      onClick={()=>setSelDetail({type:"기성+확정",dept:d.dept,items:d.all})}>
                      <div style={{fontSize:11,fontWeight:800,color:"#312E81",textAlign:"center",marginBottom:3}}>
                        {(d.total+d.push)>=1e8?`${((d.total+d.push)/1e8).toFixed(1)}억`:"-"}
                      </div>
                      <div style={{width:"70%",display:"flex",flexDirection:"column",alignItems:"stretch",borderRadius:"4px 4px 0 0",overflow:"hidden"}}>
                        {puH>0&&<div style={{height:puH,background:"#D9770688"}}/>}
                        {cH>0&&<div style={{height:cH,background:"#6366F1"}}/>}
                        {pH>0&&<div style={{height:pH,background:"#059669"}}/>}
                        {pH===0&&cH===0&&puH===0&&<div style={{height:4,background:"#E5E7EB"}}/>}
                      </div>
                      <div style={{fontSize:10.5,color:"#6B7280",marginTop:5,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>
                        {d.dept.replace("본부","").replace("디자인","디자").slice(0,4)}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{display:"flex",gap:12,marginTop:10,fontSize:11.5,color:"#6B7280"}}>
                <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#059669",borderRadius:2,display:"inline-block"}}/> 현누계</span>
                <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#6366F1",borderRadius:2,display:"inline-block"}}/> 기성+확정</span>
                <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#D9770688",borderRadius:2,display:"inline-block"}}/> 추진</span>
              </div>
            </div>

            {/* 파이차트 */}
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"20px 24px"}}>
              <div style={{fontSize:15,fontWeight:800,color:"#111827",marginBottom:12}}>본부별 비중</div>
              <SimplePieChart data={cashByDept.filter(d=>d.total>0).map(d=>({name:d.dept.replace("본부","").slice(0,4),value:+(d.total/1e8).toFixed(2),color:d.color}))} total={+(totalCash/1e8).toFixed(2)}/>
            </div>
          </div>

          {/* 월별 연간 바 차트 */}
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"20px 24px",marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <div style={{fontSize:16,fontWeight:800,color:"#111827"}}>{YEAR}년 월별 수금 현황 (단위: 억원)</div>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:4,background:"#F3F4F6",borderRadius:8,padding:3}}>
                  {[["overview","📊 연간"],["list","📋 목록"],["monthly","📅 월별"],["dept","🏢 본부별"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setCashView(v)}
                      style={{padding:"5px 12px",border:"none",borderRadius:6,fontSize:12.5,fontWeight:cashView===v?700:400,cursor:"pointer",
                        background:cashView===v?"#6366F1":"none",color:cashView===v?"#fff":"#6B7280"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* 기성내역 입력 버튼 - 차트와 분리 */}
            {cashView==="overview"&&(
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
                <button onClick={()=>setCashView("list")}
                  style={{padding:"6px 14px",background:"#6366F1",color:"#fff",border:"none",borderRadius:9,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
                  ✏ 기성내역 입력/추가
                </button>
              </div>
            )}

            {cashView==="overview"&&(
              <div>
                {/* 막대 차트 — 본부별 스택 + 롤오버 툴팁 */}
                <div style={{position:"relative"}}>
                  <div style={{display:"flex",gap:4,alignItems:"flex-end",height:160,borderBottom:"2px solid #E5E7EB",marginBottom:8,paddingBottom:4,marginTop:28}}>
                    {/* marginTop:28 → 바 위 금액 라벨 공간 확보 */}
                    {monthlyData.map((d,i)=>{
                      const maxM=Math.max(...monthlyData.map(x=>x.total),1)
                      const totalH=maxM>0?Math.round((d.total/maxM)*130):0
                      return (
                        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:0,position:"relative",cursor:d.total>0?"pointer":"default"}}
                          onClick={()=>d.total>0&&setSelDetail({type:`${d.label} 전체`,dept:"전체",items:d.items})}>
                          {d.total>0&&<div style={{fontSize:11,fontWeight:800,color:"#312E81",textAlign:"center",whiteSpace:"nowrap",position:"absolute",top:0,transform:"translateY(-18px)"}}>
                            {d.total>=1e8?(d.total/1e8).toFixed(1)+"억":Math.round(d.total/1e4)+"만"}
                          </div>}
                          <div style={{width:"85%",display:"flex",flexDirection:"column",borderRadius:"4px 4px 0 0",overflow:"hidden",transition:"opacity .15s"}}
                            onMouseEnter={e=>{
                              e.currentTarget.style.opacity=".8"
                              // 툴팁 표시
                              const tip=document.getElementById(`tip-${i}`)
                              if(tip) tip.style.display="block"
                            }}
                            onMouseLeave={e=>{
                              e.currentTarget.style.opacity="1"
                              const tip=document.getElementById(`tip-${i}`)
                              if(tip) tip.style.display="none"
                            }}>
                            {/* 본부별 스택 */}
                            {DEPTS.map(dep=>{
                              const depAmt=d.byDept[dep]||0
                              const depH=maxM>0?Math.round((depAmt/maxM)*130):0
                              return depH>0?<div key={dep} style={{height:depH,background:DEPT_COLORS[dep]||"#6366F1"}}/>:null
                            }).filter(Boolean).reverse()}
                            {d.total===0&&<div style={{height:3,background:"#E5E7EB",borderRadius:2}}/>}
                          </div>
                          {/* 툴팁 */}
                          {d.total>0&&<div id={`tip-${i}`} style={{display:"none",position:"absolute",bottom:"100%",left:"50%",transform:"translateX(-50%)",background:"rgba(17,24,39,.95)",color:"#fff",borderRadius:10,padding:"10px 14px",fontSize:12,whiteSpace:"nowrap",zIndex:100,boxShadow:"0 4px 16px rgba(0,0,0,.3)",minWidth:180,marginBottom:8}}>
                            <div style={{fontWeight:800,fontSize:13,marginBottom:6,borderBottom:"1px solid rgba(255,255,255,.2)",paddingBottom:5}}>{d.label} 합계 {d.total>=1e8?(d.total/1e8).toFixed(2)+"억":fAmt(d.total)}</div>
                            {DEPTS.map(dep=>{
                              const depAmt=d.byDept[dep]||0
                              return depAmt>0?<div key={dep} style={{display:"flex",justifyContent:"space-between",gap:16,marginBottom:3}}>
                                <span style={{display:"flex",alignItems:"center",gap:5}}>
                                  <span style={{width:8,height:8,borderRadius:"50%",background:DEPT_COLORS[dep]||"#6366F1",display:"inline-block"}}/>
                                  {dep}
                                </span>
                                <span style={{fontWeight:700}}>{depAmt>=1e8?(depAmt/1e8).toFixed(2)+"억":fAmt(depAmt)}</span>
                              </div>:null
                            })}
                            <div style={{marginTop:5,paddingTop:5,borderTop:"1px solid rgba(255,255,255,.2)",display:"flex",justifyContent:"space-between",fontSize:11.5}}>
                              <span style={{color:"#34D399"}}>✅ 완료 {d.paid>=1e8?(d.paid/1e8).toFixed(2)+"억":fAmt(d.paid)}</span>
                              <span style={{color:"#FDE68A"}}>📅 예정 {d.exp>=1e8?(d.exp/1e8).toFixed(2)+"억":fAmt(d.exp)}</span>
                            </div>
                          </div>}
                          <div style={{fontSize:10.5,color:d.isCurrent?"#6366F1":"#9CA3AF",marginTop:4,fontWeight:d.isCurrent?700:400}}>{d.label}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {/* 본부 색상 범례 */}
                <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap",fontSize:11.5,color:"#6B7280"}}>
                  {DEPTS.map(d=><span key={d} style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{width:10,height:10,borderRadius:2,background:DEPT_COLORS[d]||"#6B7280",display:"inline-block"}}/>
                    {d.replace("본부","")}
                  </span>)}
                </div>
                {/* 월별 상세 테이블 — 가로형 (행=항목/본부, 열=월) */}
                <div style={{overflowX:"auto",marginTop:12}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
                    <thead>
                      <tr style={{background:"#F8FAFC"}}>
                        <th style={{padding:"9px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB",position:"sticky",left:0,background:"#F8FAFC",zIndex:2,minWidth:110,borderRight:"2px solid #E5E7EB"}}>구분</th>
                        {monthlyData.map((md,mi)=>(
                          <th key={mi} style={{padding:"8px 6px",textAlign:"right",fontSize:11.5,fontWeight:700,
                            color:md.isCurrent?"#DC2626":"#6B7280",
                            borderBottom:"2px solid #E5E7EB",
                            borderRight:md.isCurrent?"2px solid #DC2626":"1px solid #F3F4F6",
                            borderLeft:md.isCurrent?"2px solid #DC2626":"none",
                            background:md.isCurrent?"#FEF2F2":"#F8FAFC",
                            minWidth:70,whiteSpace:"nowrap"}}>
                            {md.label}{md.isCurrent&&<span style={{fontSize:9,display:"block",color:"#DC2626"}}>◀이번달</span>}
                          </th>
                        ))}
                        <th style={{padding:"9px 10px",textAlign:"right",fontSize:12,fontWeight:700,color:"#312E81",borderBottom:"2px solid #E5E7EB",borderLeft:"2px solid #E5E7EB",minWidth:80,background:"#EEF2FF"}}>연간합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 가로형: 행=본부, 열=1월~12월 */}
                      {/* 전체 합계 행 */}
                      {[
                        {label:"✅ 현누계",  color:"#059669",  bg:"#D1FAE5", key:"paid"},
                        {label:"📅 기성+확정", color:"#6366F1", bg:"#EEF2FF", key:"exp"},
                        {label:"❓ 미정(불확실)", color:"#D97706", bg:"#FEF3C7", key:"mijeong"},
                        ...DEPTS.map(d=>({label:d, color:DEPT_COLORS[d]||"#6B7280", bg:"transparent", key:`dept_${d}`})),
                      ].map((row,ri)=>(
                        <tr key={row.key} style={{background:ri===0?"#D1FAE5":ri===1?"#EEF2FF":ri===2?"#FEF3C7":ri%2===0?"#fff":"#FAFAFA",borderBottom:"1px solid #E5E7EB"}}>
                          <td style={{padding:"9px 12px",fontSize:13,fontWeight:700,color:row.color,whiteSpace:"nowrap",position:"sticky",left:0,background:ri===0?"#D1FAE5":ri===1?"#EEF2FF":ri===2?"#FEF3C7":ri%2===0?"#fff":"#FAFAFA",zIndex:1,borderRight:"2px solid #E5E7EB"}}>
                            {row.label.length>6?<span title={row.label}>{row.label.replace("본부","")}</span>:row.label}
                          </td>
                          {monthlyData.map((md,mi)=>{
                            let val = 0
                            if(row.key==="paid")    val = md.paid
                            else if(row.key==="exp") val = md.exp
                            else if(row.key==="mijeong") val = md.mijeong||0
                            else val = md.byDept[row.key.replace("dept_","")]||0
                            return (
                              <td key={mi} style={{padding:"8px 8px",textAlign:"right",fontSize:12,
                                fontWeight:val>0?700:400,
                                color:val>0?row.color:"#D1D5DB",
                                background:md.isCurrent?"#FEF2F2":"transparent",
                                borderRight:md.isCurrent?"2px solid #DC2626":"1px solid #F3F4F6",
                                borderLeft:md.isCurrent?"2px solid #DC2626":"none",
                              }}>
                                {val>0?fAmt(val):"-"}
                              </td>
                            )
                          })}
                          <td style={{padding:"8px 12px",textAlign:"right",fontSize:13,fontWeight:800,
                            color:row.color,borderLeft:"2px solid #E5E7EB",
                            background:ri===0?"#A7F3D0":ri===1?"#C7D2FE":ri===2?"#FDE68A":"transparent"}}>
                            {fAmt(monthlyData.reduce((s,md)=>{
                              if(row.key==="paid") return s+md.paid
                              if(row.key==="exp")  return s+md.exp
                              if(row.key==="mijeong") return s+(md.mijeong||0)
                              return s+(md.byDept[row.key.replace("dept_","")]||0)
                            },0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 목록/월별/본부별 */}
          {(cashView==="list"||cashView==="monthly"||cashView==="dept")&&(
            <CashItemsView cashItems={cashItems} setCashItems={setCashItems} projects={projects} setProjects={setProjects}
              DEPTS={DEPTS} currentUser={currentUser} itemTotal={totalPaid+totalConf} itemPaid={totalPaid} itemExp={totalConf}
              viewMode={cashView} setTab={setTab} setSelProjId={setSelProjId}/>
          )}
        </div>
      )}

      {/* ══ 계약현황 탭 ══ */}
      {mainTab==="contract"&&(
        <ContractStatusPage
          contractItems={contractItems}
          setContractItems={setContractItems}
          DEPTS={DEPTS}
          DEPT_COLORS={DEPT_COLORS}
          currentUser={currentUser}
          yearTargets={yearTargets}
          setYearTargets={setYearTargets}
          deptBiz={deptBiz}
          YEAR={YEAR}
          YR={YR}
          setSelProjId={setSelProjId}
          setTab={setTab}
          setDetailTab={setDetailTab}
          isAdmin={currentUser?.role==="admin"}
        />
      )}

      {/* ══ 지출현황 탭 ══ */}
      {mainTab==="expense"&&(
        <div>
          <div style={{background:"linear-gradient(135deg,#7C3AED,#6366F1)",borderRadius:16,padding:"22px 28px",marginBottom:20,color:"#fff"}}>
            <div style={{fontSize:13,opacity:.75,marginBottom:4}}>{YEAR}년 기성 지급 현황</div>
            <div style={{fontSize:34,fontWeight:800,marginBottom:8}}>{fAmt(totalPaid)}</div>
            <div style={{display:"flex",gap:10,fontSize:13}}>
              <span style={{background:"rgba(255,255,255,.2)",padding:"4px 12px",borderRadius:20}}>입금 완료 {fAmt(totalPaid)}</span>
              <span style={{background:"rgba(255,255,255,.15)",padding:"4px 12px",borderRadius:20}}>입금 예정 {fAmt(totalConf)}</span>
            </div>
          </div>

          {/* 본부별 지출 표 — 인당 포함 */}
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:20}}>
            <div style={{padding:"14px 20px",borderBottom:"1px solid #E5E7EB",fontSize:15,fontWeight:800,color:"#111827"}}>본부별 기성 지급 현황 (단위: 억원)</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#FEE2E2"}}>
                    {["본부","건수","인원","입금 완료","인당(완료)","입금 예정","합계","비율"].map((h,i)=>(
                      <th key={i} style={{padding:"10px 14px",textAlign:i===0?"left":"right",fontSize:12.5,fontWeight:700,
                        color:i===3?"#059669":i===4?"#059669":i===5?"#D97706":"#6B7280",
                        borderBottom:"2px solid #E5E7EB",
                        background:i===4?"#D1FAE5":"#FEE2E2"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashByDept.map((d,i)=>{
                    const pctD = totalPaid+totalConf>0?Math.round(d.total/(totalPaid+totalConf)*100):0
                    const staff2= (deptStaff[d.dept]?.total)||1
                    const perCap= d.paid/staff2
                    return (
                      <tr key={d.dept} style={{background:i%2===0?"#fff":"#FAFAFA",borderBottom:"1px solid #F3F4F6"}}>
                        <td style={{padding:"11px 14px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:10,height:10,borderRadius:"50%",background:d.color}}/>
                            <span style={{fontSize:14,fontWeight:700,color:"#111827"}}>{d.dept}</span>
                          </div>
                        </td>
                        <td style={{padding:"11px 14px",textAlign:"right",fontSize:13,color:"#6B7280"}}>{d.all.length}건</td>
                        <td style={{padding:"11px 14px",textAlign:"right",fontSize:13,color:"#6B7280",fontWeight:600}}>{staff2}명</td>
                        <td style={{padding:"11px 14px",textAlign:"right",fontSize:13.5,fontWeight:700,color:"#059669"}}>{d.paid>0?fAmt(d.paid):"-"}</td>
                        <td style={{padding:"11px 14px",textAlign:"right",fontSize:12.5,fontWeight:600,color:"#059669",background:"#D1FAE5"}}>
                          {perCap>=1e8?`${(perCap/1e8).toFixed(2)}억`:perCap>=1e4?`${(perCap/1e4).toFixed(0)}만`:"-"}
                        </td>
                        <td style={{padding:"11px 14px",textAlign:"right",fontSize:13,color:"#D97706"}}>{d.conf>0?fAmt(d.conf):"-"}</td>
                        <td style={{padding:"11px 14px",textAlign:"right",fontSize:14,fontWeight:800,color:"#312E81"}}>{d.total>0?fAmt(d.total):"-"}</td>
                        <td style={{padding:"11px 14px",textAlign:"right"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end"}}>
                            <div style={{width:60,height:8,background:"#E5E7EB",borderRadius:4,overflow:"hidden"}}>
                              <div style={{height:"100%",background:d.color,borderRadius:4,width:`${pctD}%`}}/>
                            </div>
                            <span style={{fontSize:12,fontWeight:600,color:"#374151"}}>{pctD}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{background:"#FEE2E2",fontWeight:700,borderTop:"2px solid #E5E7EB"}}>
                    <td style={{padding:"11px 14px",fontSize:14,color:"#312E81"}}>합계</td>
                    <td style={{padding:"11px 14px",textAlign:"right",fontSize:13}}>{cashItems.length}건</td>
                    <td style={{padding:"11px 14px",textAlign:"right",fontSize:13,fontWeight:800}}>
                      {Object.values(deptStaff).reduce((s,d)=>s+(d.total||0),0)}명
                    </td>
                    <td style={{padding:"11px 14px",textAlign:"right",fontSize:14,fontWeight:800,color:"#059669"}}>{fAmt(totalPaid)}</td>
                    <td style={{padding:"11px 14px",textAlign:"right",fontSize:13,fontWeight:800,color:"#059669",background:"#D1FAE5"}}>
                      {(()=>{const ts=Object.values(deptStaff).reduce((s,d)=>s+(d.total||0),1);const v=totalPaid/ts;return v>=1e8?`${(v/1e8).toFixed(2)}억`:v>=1e4?`${(v/1e4).toFixed(0)}만`:"-"})()}
                    </td>
                    <td style={{padding:"11px 14px",textAlign:"right",fontSize:14,fontWeight:800,color:"#D97706"}}>{fAmt(totalConf)}</td>
                    <td style={{padding:"11px 14px",textAlign:"right",fontSize:15,fontWeight:800,color:"#312E81"}}>{fAmt(totalPaid+totalConf)}</td>
                    <td style={{padding:"11px 14px",textAlign:"right",fontSize:13,color:"#374151"}}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <CashItemsView cashItems={cashItems} setCashItems={setCashItems} projects={projects} setProjects={setProjects}
            DEPTS={DEPTS} currentUser={currentUser} itemTotal={totalPaid} itemPaid={totalPaid} itemExp={totalConf}
            viewMode="list" setTab={setTab} setSelProjId={setSelProjId}/>
        </div>
      )}
    </div>
  )
}

// 계약 엑셀 양식 다운로드
function downloadContractTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["■ 상지서울건축사사무소 — 계약현황 입력 양식"],
    ["※ 4행부터 데이터 입력. 구분: 계약/확정/추진"],
    ["※ 복수본부: '본부명:지분%,본부명:지분%' 형식으로 입력"],
    ["※ 금액은 억원 단위로 입력 (예: 17.55)"],
    [],
    ["본부(복수시 '본부명:지분%')","발주구분","구분","프로젝트명","공모형식","총설계비예상(억)","상지지분예상(%)","용역비예상(억)","사업자공모비율(%)","수행예상시점","계약예상시점","컨소시엄","내용","[시스템ID]"],
    ["설계1본부:60%,디자인본부:40%","민간","추진","서부산 행정복합타운 건립공사 실시설계 기술제안","기술제안",50.13,35,17.55,40,"2026년 1월","2026년 12월","토문건축,상지건축,이림건축","9/12 공고",""],
    ["설계1본부","공공","계약","경상남도 서부의료원 설립 설계용역","수의계약",14.7,100,1.47,100,"2026년 2월","2026년 1월","","",""],
  ])
  ws["!cols"] = [{wch:30},{wch:9},{wch:7},{wch:38},{wch:12},{wch:14},{wch:13},{wch:13},{wch:13},{wch:13},{wch:13},{wch:22},{wch:20},{wch:18}]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "계약현황")
  XLSX.writeFile(wb, "상지서울_계약현황_입력양식.xlsx")
}

// 계약현황 엑셀 업로드 → contractItems로 변환
function uploadContractExcel(e, contractItems, setContractItems, currentUser, toast) {
  const file = e.target.files?.[0]; if(!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    try {
      const wb   = XLSX.read(ev.target.result, {type:"binary"})
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""})

      let headerRow=2, dataStart=3
      for(let i=0;i<6;i++){
        if(rows[i].some(c=>String(c).includes("프로젝트명"))){headerRow=i;dataStart=i+1;break}
      }
      const headers = rows[headerRow].map(h=>String(h).trim())
      const ciExact = (name) => headers.findIndex(h=>h===name)
      const ci = (names)=>{
        for(const n of names){ const i=ciExact(n); if(i>=0) return i }
        for(const n of names){ const i=headers.findIndex(h=>h.includes(n)); if(i>=0)return i }
        return -1
      }
      const CI = {
        dept:       ci(["본부"]),
        orderType:  ci(["발주구분"]),
        itemType:   ci(["구분"]),
        name:       ci(["프로젝트명"]),
        bidType:    ci(["공모형식"]),
        totalFee:   ci(["총설계비예상","총설계비"]),
        shareRatio: ci(["상지지분예상","상지지분"]),
        svcFee:     ci(["용역비예상","용역비"]),
        bizCompPct: ci(["사업자공모비율","사업자공모"]),
        execTime:   ci(["수행예상시점","수행시점","수행예상"]),
        contractTime:ci(["계약예상시점","계약시점","계약예상"]),
        consortium: ci(["컨소시엄"]),
        note:       ci(["내용","메모","비고"]),
        id:         ci(["시스템ID","[시스템ID"]),
      }
      if(CI.itemType === CI.orderType) {
        const altIdx = headers.findIndex((h,idx)=>idx!==CI.orderType && h.trim()==="구분")
        if(altIdx>=0) CI.itemType = altIdx
      }

      const typeMap = {"계약":"계약","계약(수주)":"계약","수주":"계약","확정":"확정","추진":"추진","미정":"추진"}
      const get = (r,k)=>CI[k]>=0?r[CI[k]]:""
      const toAmt = v => Math.round((parseFloat(String(v||"0").replace(/[^0-9.\-]/g,""))||0)*1e8)

      const newItems = []
      rows.slice(dataStart).forEach(r=>{
        const pname = String(get(r,"name")||"").trim()
        if(!pname||pname.startsWith("※")||pname.includes("프로젝트명")) return

        const deptRaw    = String(get(r,"dept")||"").trim()
        const typeRaw     = String(get(r,"itemType")||"").trim()
        const totalFeeExpect   = toAmt(get(r,"totalFee"))
        const shareRatioExpect = parseFloat(String(get(r,"shareRatio")||"100").replace(/[^0-9.]/g,""))||100
        const serviceFeeExpect = toAmt(get(r,"svcFee"))
        const bizCompPct       = parseFloat(String(get(r,"bizCompPct")||"100").replace(/[^0-9.]/g,""))||100
        const bizCompFee       = Math.round(serviceFeeExpect * bizCompPct / 100)
        const existingId  = String(get(r,"id")||"").trim()
        const id = existingId&&existingId!=="[시스템ID-수정금지]"&&existingId!=="[시스템ID]" ? existingId : `C${Date.now()}_${Math.random().toString(36).slice(2,6)}`

        let depts = [], deptShares = []
        if(deptRaw.includes(":")) {
          deptRaw.split(",").forEach(seg=>{
            const [dept, pct] = seg.trim().split(":")
            if(dept) { depts.push(dept.trim()); deptShares.push({dept:dept.trim(), share:parseFloat(pct||"100")||100}) }
          })
        } else {
          depts = deptRaw ? [deptRaw] : []
          deptShares = deptRaw ? [{dept:deptRaw, share:100}] : []
        }

        newItems.push({
          id, name: pname, depts, deptShares,
          orderType: String(get(r,"orderType")||"민간").trim(),
          type: typeMap[typeRaw]||"추진",
          bidType: String(get(r,"bidType")||"").trim(),
          totalFeeExpect, shareRatioExpect, serviceFeeExpect,
          amount: serviceFeeExpect,  // 하위호환
          bizCompPct, bizCompFee,
          execTime: String(get(r,"execTime")||"").trim(),
          contractTime: String(get(r,"contractTime")||"").trim(),
          consortium: String(get(r,"consortium")||"").trim(),
          note: String(get(r,"note")||"").trim(),
          contractYear: new Date().getFullYear(),
          updatedAt: new Date().toISOString(), updatedBy: currentUser?.name||"",
        })
      })

      if(newItems.length===0){toast&&toast("데이터가 없습니다.","error");return}

      // 업로드 전 현재 계약현황 자동 백업
      const backupKey = `sjs_backup_contract_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}`
      try{
        if(contractItems.length>0){
          localStorage.setItem(backupKey, JSON.stringify(contractItems))
          console.log(`💾 계약현황 백업: ${backupKey} (${contractItems.length}건)`)
        }
      }catch(e){ console.warn("백업 저장 실패:", e) }

      let added=0, updated=0, dupNames=[]
      setContractItems(prev=>{
        let next = [...prev]
        newItems.forEach(np=>{
          const byId = next.find(p=>p.id===np.id&&np.id)
          if(byId) { next = next.map(p=>p.id===np.id?{...p,...np}:p); updated++; return }
          const byNameType = next.find(p=>p.name.trim()===np.name.trim()&&p.type===np.type)
          if(byNameType) { next = next.map(p=>p.id===byNameType.id?{...p,...np,id:byNameType.id}:p); updated++; return }
          const byName = next.find(p=>p.name.trim()===np.name.trim())
          if(byName) dupNames.push(`${np.name} (기존:${byName.type} → 신규:${np.type})`)
          next.push(np); added++
        })
        return next
      })

      let msg = `✅ 완료: 신규 ${added}건 추가, 업데이트 ${updated}건`
      if(dupNames.length>0) msg += `\n⚠ 동일 프로젝트명(다른 구분) ${dupNames.length}건 별도 추가됨`
      toast&&toast(msg,"success")
      if(dupNames.length>0) alert(`⚠ 같은 이름 다른 구분 항목:\n${dupNames.slice(0,5).join("\n")}\n\n각각 별도 프로젝트로 등록됐습니다.`)
    } catch(err){ toast&&toast("업로드 오류: "+err.message,"error") }
    e.target.value=""
  }
  reader.readAsBinaryString(file)
}

function ProjectCashflowSummaryCard({projects,projectCashflowByDept,DEPTS,DEPT_COLORS}) {
  const allYears = useMemo(()=>Object.keys(projectCashflowByDept||{}).sort(),[projectCashflowByDept])
  const rows = useMemo(()=>{
    let carry=0
    return allYears.map(y=>{
      const planTotal = DEPTS.reduce((s,d)=>s+(projectCashflowByDept[y]?.plan?.[d]?.reduce((a,v)=>a+v,0)||0),0)
      const actualTotal = DEPTS.reduce((s,d)=>s+(projectCashflowByDept[y]?.actual?.[d]?.reduce((a,v)=>a+v,0)||0),0)
      const row={year:y,plan:planTotal,actual:actualTotal,carryIn:carry}
      carry += (planTotal-actualTotal)
      return row
    })
  },[allYears,projectCashflowByDept,DEPTS])
  const lastYear = allYears[allYears.length-1]

  return allYears.length===0 ? (
    <div style={{...S.card(),background:C.grayL,color:C.gray,fontSize:13}}>
      📅 연도별 기성 현황(프로젝트 합산) — 아직 입력된 프로젝트별 월수금계획이 없습니다.
    </div>
  ) : (
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
function ProjectsTab({projects,setProjects,selProjId,setSelProjId,selVerIdx,setSelVerIdx,cmpIds,setCmpIds,showNewVer,setShowNewVer,canWrite,contractTypes,currentUser,setDetailTab:_extSetDetailTab,detailTab:_extDetailTab,cashItems=[],setCashItems,vendorsDB={},projBaseline={},setProjBaseline}) {
  const [view, setView] = useState("list")
  const [deptFilter,     setDeptFilter]     = useState("")
  const [typeFilter,     setTypeFilter]     = useState("")
  const [searchQuery,    setSearchQuery]    = useState("")
  const [pmFilter,       setPmFilter]       = useState("")
  const [dateFromFilter, setDateFromFilter] = useState("")
  const [dateToFilter,   setDateToFilter]   = useState("")
  const [areaMinFilter,  setAreaMinFilter]  = useState("")
  const [showAdvFilter,  setShowAdvFilter]  = useState(false)
  const [projPage,       setProjPage]       = useState(1)
  const PROJ_PER_PAGE = 30
  const [editVend, setEditVend]     = useState(false)
  const [vDraft, setVDraft]         = useState(null)
  const [editProj, setEditProj]     = useState(false)
  const [cfEditing, setCfEditing]   = useState(false)
  const [cfDraft, setCfDraft]       = useState(null)
  const [detailTab, setDetailTab]   = useState("info")
  const NOW  = new Date()
  const YEAR = NOW.getFullYear()
  const YR   = String(YEAR)

  useEffect(()=>{ if(selProjId) setDetailTab("info") }, [selProjId])

  const selProj = projects.find(p=>p.id===selProjId)
  const selVer  = selProj?.versions?.[selVerIdx]
  const allCats = useMemo(()=>[...new Set(projects.flatMap(p=>p.versions.flatMap(v=>v.vendors.map(vd=>vd.cat))))].sort(),[projects])

  // 상세 필터링
  const filtered = useMemo(()=>{
    const q = searchQuery.toLowerCase().trim()
    return projects.filter(p=>{
      if(deptFilter && !p.depts?.some(d=>d.includes(deptFilter))) return false
      if(typeFilter && p.type!==typeFilter) return false
      if(pmFilter && !(p.pm||"").toLowerCase().includes(pmFilter.toLowerCase())) return false
      if(dateFromFilter && (p.contractDate||"") < dateFromFilter) return false
      if(dateToFilter   && (p.contractDate||"") > dateToFilter)   return false
      if(areaMinFilter) {
        const minM2 = parseFloat(areaMinFilter)*3.3
        if((p.floorArea||0) < minM2) return false
      }
      if(q && !`${p.name||""} ${p.code||""} ${p.pm||""} ${(p.depts||[]).join(" ")} ${p.clientName||p.client||""}`.toLowerCase().includes(q)) return false
      return true
    })
  },[projects,deptFilter,typeFilter,searchQuery,pmFilter,dateFromFilter,dateToFilter,areaMinFilter])

  const totalProjPages = Math.ceil(filtered.length / PROJ_PER_PAGE)
  const pagedProjects  = filtered.slice((projPage-1)*PROJ_PER_PAGE, projPage*PROJ_PER_PAGE)

  const resetFilters = () => {
    setDeptFilter(""); setTypeFilter(""); setSearchQuery(""); setPmFilter("")
    setDateFromFilter(""); setDateToFilter(""); setAreaMinFilter(""); setProjPage(1)
  }

  const pyF = selProj ? toPy(selProj.floorArea||0) : 0
  const pyS = selProj ? toPy(selProj.siteArea||0)  : 0

  const saveVend = ()=>{
    setProjects(prev=>prev.map(p=>p.id===selProj.id?{...p,versions:p.versions.map((v,i)=>i===selVerIdx?{...v,vendors:vDraft}:v)}:p))
    setEditVend(false); setVDraft(null)
  }
  const upd=(i,k,v)=>setVDraft(prev=>prev.map((r,ri)=>ri===i?{...r,[k]:["contract","nego1","nego2"].includes(k)?parseInt(v)||0:v}:r))

  return (
    <div>
      {/* 서브 탭 + 엑셀 업다운로드 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",gap:2,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:8,padding:3,width:"fit-content",flexWrap:"wrap"}}>
        {[["list","📋 목록"],["detail","📐 실행계획서"],["compare","🔍 비교"],["bench","📊 평당단가"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{padding:"7px 14px",border:"none",borderRadius:6,fontSize:12,fontWeight:view===v?500:400,cursor:"pointer",background:view===v?"var(--color-background-primary,#fff)":"none",color:view===v?C.navyM:"var(--color-text-secondary,#888)",boxShadow:view===v?"0 0 0 0.5px var(--color-border-tertiary)":"none"}}>{l}</button>
        ))}
      </div>
      {/* 엑셀 업다운로드 */}
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <button onClick={()=>{
          try{
            const rows = [["코드","프로젝트명","본부","PM","유형","용도","규모","계약일","상태"],
              ...projects.map(p=>[p.code||p.id,p.name,p.depts?.join(","),p.pm,p.type,p.usage,p.scale,p.contractDate,p.status||"진행"])]
            const ws=XLSX.utils.aoa_to_sheet(rows); ws["!cols"]=[{wch:14},{wch:50},{wch:16},{wch:10},{wch:10},{wch:20},{wch:18},{wch:12},{wch:8}]
            const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"프로젝트")
            XLSX.writeFile(wb,`상지서울_프로젝트_${new Date().toISOString().slice(0,10)}.xlsx`)
          }catch(e){alert(e.message)}
        }} style={{padding:"6px 12px",background:"#EDE9FE",color:"#7C3AED",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
          ⬇ 전체 다운로드
        </button>
        {canWrite&&<label style={{padding:"6px 12px",background:"#D1FAE5",color:"#059669",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>
          ⬆ 엑셀 업로드
          <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{
            const file=e.target.files?.[0]; if(!file) return
            const reader=new FileReader()
            reader.onload=ev=>{
              const wb=XLSX.read(ev.target.result,{type:"binary"})
              const ws=wb.Sheets[wb.SheetNames[0]]
              const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""})
              const headers=rows[0].map(h=>String(h).trim())
              const ni=(ns)=>{for(const n of ns){const i=headers.findIndex(h=>h.includes(n));if(i>=0)return i};return -1}
              const CI={code:ni(["코드","PJ","번호"]),name:ni(["프로젝트명","명칭"]),dept:ni(["본부","부서"]),pm:ni(["PM","담당자"]),type:ni(["유형","구분"]),usage:ni(["용도"]),scale:ni(["규모"]),contractDate:ni(["계약일"])}
              let added=0,updated=0
              setProjects(prev=>{
                let next=[...prev]
                rows.slice(1).forEach(r=>{
                  const name=CI.name>=0?String(r[CI.name]).trim():""
                  if(!name)return
                  const existing=next.find(p=>p.name.trim()===name)
                  if(existing){
                    next=next.map(p=>p.name.trim()===name?{...p,type:r[CI.type]||p.type,pm:r[CI.pm]||p.pm}:p);updated++
                  }else{
                    next.push(normalizeProject({id:`PI${Date.now()}_${added}`,code:r[CI.code]||"",name,depts:[r[CI.dept]].filter(Boolean),pm:r[CI.pm]||"",type:r[CI.type]||"확정",usage:r[CI.usage]||"",scale:r[CI.scale]||"",contractDate:r[CI.contractDate]||"",contractYear:new Date().getFullYear(),versions:[],weeklyReport:{},memo:[]}));added++
                  }
                })
                return next
              })
              alert(`✅ 완료: 신규 ${added}건 추가, 업데이트 ${updated}건`)
            }
            reader.readAsBinaryString(file); e.target.value=""
          }}/>
        </label>}
      </div>
      </div>

      {/* ── 목록 ── */}
      {view==="list" && (
        <>
          {/* 검색 바 */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"12px 14px",marginBottom:12}}>
            <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
              <input value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setProjPage(1)}}
                placeholder="🔍 프로젝트명·코드·PM·발주처 검색"
                style={{flex:1,padding:"8px 14px",border:"1.5px solid #6366F1",borderRadius:9,fontSize:13.5,fontFamily:"inherit",outline:"none"}}/>
              <select value={deptFilter} onChange={e=>{setDeptFilter(e.target.value);setProjPage(1)}}
                style={{padding:"8px 10px",border:"1px solid #E5E7EB",borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}>
                {[["","전체 본부"],["설계1","설계1본부"],["설계2","설계2본부"],["디자인","디자인본부"],["주거","주거디자인"],["해외","해외사업부"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
              <select value={typeFilter} onChange={e=>{setTypeFilter(e.target.value);setProjPage(1)}}
                style={{padding:"8px 10px",border:"1px solid #E5E7EB",borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}>
                {[["","전체 구분"],["계약","계약"],["확정","확정"],["추진","추진"],["기성","기성"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
              <button onClick={()=>setShowAdvFilter(v=>!v)}
                style={{padding:"8px 14px",background:showAdvFilter?"#6366F1":"#F3F4F6",color:showAdvFilter?"#fff":"#6B7280",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                {showAdvFilter?"▲ 간단":"▼ 상세검색"}
              </button>
              {(searchQuery||deptFilter||typeFilter||pmFilter||dateFromFilter||dateToFilter||areaMinFilter)&&(
                <button onClick={resetFilters}
                  style={{padding:"8px 12px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:8,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
                  ✕ 초기화
                </button>
              )}
              <span style={{fontSize:13,color:"#6B7280",fontWeight:600,whiteSpace:"nowrap"}}>
                <b style={{color:"#6366F1"}}>{filtered.length}</b>건 / {projects.length}건
              </span>
            </div>
            {showAdvFilter&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,paddingTop:8,borderTop:"1px solid #F3F4F6"}}>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>PM / 본부장</label>
                  <input value={pmFilter} onChange={e=>{setPmFilter(e.target.value);setProjPage(1)}}
                    placeholder="이름 검색" style={{width:"100%",padding:"7px 10px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>계약일 (시작)</label>
                  <input type="date" value={dateFromFilter} onChange={e=>{setDateFromFilter(e.target.value);setProjPage(1)}}
                    style={{width:"100%",padding:"7px 10px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>계약일 (종료)</label>
                  <input type="date" value={dateToFilter} onChange={e=>{setDateToFilter(e.target.value);setProjPage(1)}}
                    style={{width:"100%",padding:"7px 10px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>연면적 최소(평)</label>
                  <input type="number" value={areaMinFilter} onChange={e=>{setAreaMinFilter(e.target.value);setProjPage(1)}}
                    placeholder="예: 500" style={{width:"100%",padding:"7px 10px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                </div>
              </div>
            )}
          </div>

          <Card title="프로젝트 목록" note={`행 클릭 → 실행계획서 상세 · ${PROJ_PER_PAGE}건씩 표시`}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  <th style={S.th("center")}>비교</th>
                  <th style={S.th("center")}>연번</th>
                  {["구분","코드","프로젝트명","본부","PM","용역비(억)","평당단가","지분%","연면적㎡","진행%","계약일","다운"].map((h,i)=><th key={h+i} style={S.th(i>=5&&i<=10?"right":"left")}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {pagedProjects.map((p,i)=>{
                    const globalIdx = (projPage-1)*PROJ_PER_PAGE + i
                    const tb=TYPE_BADGE[p.type]||{bg:C.grayL,fg:C.gray}
                    const bc=p.prog>=70?C.green:p.prog>=30?C.navyM:C.gray
                    return <tr key={p.id} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)",cursor:"pointer"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(24,95,165,.04)"}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}
                      onClick={()=>{setSelProjId(p.id);setSelVerIdx(p.versions.length-1);setView("detail")}}>
                      <td style={S.td("center")} onClick={e=>e.stopPropagation()}><input type="checkbox" checked={cmpIds.includes(p.id)} onChange={e=>setCmpIds(prev=>e.target.checked?[...prev,p.id]:prev.filter(id=>id!==p.id))}/></td>
                      <td style={{...S.td("center"),fontSize:12,color:"#9CA3AF",fontWeight:600}}>{globalIdx+1}</td>
                      <td style={S.td("left")}><span style={S.bdg(tb.bg,tb.fg)}>{p.type}</span></td>
                      <td style={{...S.td("left"),fontFamily:"monospace",fontSize:11,color:C.navyM}}>{p.code}</td>
                      <td style={{...S.td("left"),maxWidth:190,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={p.name}>{p.name}</td>
                      <td style={{...S.td("left"),fontSize:11}}>{p.depts.join(", ")}</td>
                      <td style={{...S.td("left"),fontSize:11}}>{p.pm}</td>
                      <td style={{...S.td("right"),fontWeight:500}}>{fE((p.serviceFee||0)/1e8)}</td>
                      <td style={{...S.td("right"),fontSize:12,color:"#6366F1",fontWeight:600}}>{p.floorArea>0&&p.serviceFee>0?`${Math.round(p.serviceFee/toPy(p.floorArea)).toLocaleString()}원`:"-"}</td>
                      <td style={{...S.td("right"),fontSize:11}}>{(p.shareRatio*100).toFixed(0)}%</td>
                      <td style={{...S.td("right"),fontSize:11}}>{p.floorArea?.toLocaleString()}</td>
                      <td style={S.td("right")}><div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"flex-end"}}><div style={{width:44,height:6,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:3,overflow:"hidden"}}><div style={{width:`${p.prog}%`,height:6,background:bc,borderRadius:3}}/></div><span style={{fontSize:11,fontWeight:500,color:bc}}>{p.prog}%</span></div></td>
                      <td style={{...S.td("right"),fontSize:11}}>{p.contractDate||"-"}</td>
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
            {/* 페이지네이션 */}
            {totalProjPages>1&&(
              <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:6,marginTop:14,flexWrap:"wrap"}}>
                <button onClick={()=>setProjPage(1)} disabled={projPage===1}
                  style={{padding:"5px 10px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:12.5,cursor:projPage===1?"not-allowed":"pointer",color:projPage===1?C.gray:C.navyM,background:"#fff"}}>«</button>
                <button onClick={()=>setProjPage(p=>Math.max(1,p-1))} disabled={projPage===1}
                  style={{padding:"5px 10px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:12.5,cursor:projPage===1?"not-allowed":"pointer",color:projPage===1?C.gray:C.navyM,background:"#fff"}}>‹</button>
                {Array.from({length:Math.min(7,totalProjPages)},(_,i)=>{
                  const p=Math.max(1,Math.min(totalProjPages-6,projPage-3))+i
                  return p<=totalProjPages?(
                    <button key={p} onClick={()=>setProjPage(p)}
                      style={{padding:"5px 12px",border:`1.5px solid ${projPage===p?C.navyM:"#E5E7EB"}`,borderRadius:7,fontSize:13,
                        cursor:"pointer",background:projPage===p?C.navyM:"#fff",color:projPage===p?"#fff":C.navyM,fontWeight:projPage===p?700:400}}>
                      {p}
                    </button>
                  ):null
                })}
                <button onClick={()=>setProjPage(p=>Math.min(totalProjPages,p+1))} disabled={projPage===totalProjPages}
                  style={{padding:"5px 10px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:12.5,cursor:projPage===totalProjPages?"not-allowed":"pointer",color:projPage===totalProjPages?C.gray:C.navyM,background:"#fff"}}>›</button>
                <button onClick={()=>setProjPage(totalProjPages)} disabled={projPage===totalProjPages}
                  style={{padding:"5px 10px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:12.5,cursor:projPage===totalProjPages?"not-allowed":"pointer",color:projPage===totalProjPages?C.gray:C.navyM,background:"#fff"}}>»</button>
                <span style={{fontSize:12.5,color:C.gray,padding:"5px 0"}}>
                  {(projPage-1)*PROJ_PER_PAGE+1}–{Math.min(projPage*PROJ_PER_PAGE,filtered.length)} / {filtered.length}건
                </span>
              </div>
            )}
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
                {[["info","📐 프로젝트 정보"],["weekly","📋 주간보고"],["cashflow","💧 월수금"],["contract","📝 계약"],["expense","💸 지출"],["memo","📋 히스토리"]].map(([id,label])=>(
                  <button key={id} onClick={()=>setDetailTab(id)} style={{padding:"9px 18px",border:"none",background:"none",fontSize:13.5,fontWeight:700,cursor:"pointer",color:detailTab===id?C.navyM:"var(--color-text-secondary,#888)",borderBottom:detailTab===id?`3px solid ${C.navyM}`:"3px solid transparent",marginBottom:-2,transition:"all .15s"}}>
                    {label}
                  </button>
                ))}
              </div>

              {detailTab==="weekly" && (selProj?.id ? <WeeklyReportTab proj={selProj} setProjects={setProjects} canWrite={canWrite} currentUser={currentUser}/> : <ProjTabError/>)}
              {detailTab==="cashflow" && (selProj?.id ? <ProjectCashflowDetail proj={selProj} cashItems={cashItems} setCashItems={setCashItems} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS} MONTH={MONTH} YEAR={YEAR} YR={YR} projBaseline={projBaseline} setProjBaseline={setProjBaseline}/> : <ProjTabError/>)}
              {detailTab==="contract" && (selProj?.id ? <ProjectContractDetailFull proj={selProj} setProjects={setProjects} canWrite={canWrite} projects={projects}/> : <ProjTabError/>)}
              {detailTab==="expense"  && (selProj?.id ? <ProjectExpenseDetail  proj={selProj} cashItems={cashItems} setCashItems={setCashItems} YEAR={YEAR} YR={YR}/> : <ProjTabError/>)}
              {detailTab==="memo" && selProj?.id && <ProjectMemoTab proj={selProj} setProjects={setProjects} currentUser={currentUser}/>}

              {detailTab==="info" && <>
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
                            background:active?"#EEF2FF":"#fff",
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

                  {/* 협력업체 비용 + 실행계획서 작성 워크플로우 */}
                  <PlanWorkflow
                    proj={selProj} selVer={selVer} selVerIdx={selVerIdx}
                    pyF={pyF} pyS={pyS}
                    editVend={editVend} setEditVend={setEditVend}
                    vDraft={vDraft} setVDraft={setVDraft}
                    saveVend={saveVend} upd={upd}
                    projects={projects} vendorsDB={vendorsDB}
                    canWrite={canWrite}
                  />
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
  // fE는 이미 억 단위 값을 받는 함수이므로, 원 단위 값은 /1e8 후 전달
  const fMoney = n => n != null ? fE((+n/1e8).toFixed(2)*1) : "-"

  const versions = useMemo(()=>{
    // round가 있으면 round 기준, 없으면 index 기준 정렬
    return [...proj.versions]
      .map((v,i)=>({...v,_origIdx:i}))
      .sort((a,b)=>(a.round||a._origIdx+1)-(b.round||b._origIdx+1))
  },[proj.versions])

  const tooFew = versions.length < 2

  const ITEMS = [
    {key:"laborCost", label:"직접인건비", color:C.navyM},
    {key:"directExp", label:"직접경비",   color:C.navyM},
    {key:"subContract",label:"외주용역비", color:C.amber},
    {key:"_direct",   label:"직접비 소계", color:C.navy, bold:true},
    {key:"_indirect", label:"간접비",     color:C.gray},
    {key:"_profit",   label:"이윤",       color:C.green, bold:true},
    {key:"_total",    label:"예상합계",   color:C.navy,  bold:true},
  ]

  // 회차 부족 시: Hook 규칙 준수를 위해 ternary 사용
  const tooFewMsg = tooFew ? (
    <Card title="📊 회차별 비교 분석" note="실행계획서 2회차 이상부터 회차간 이윤 추이를 비교합니다.">
      <div style={{padding:"12px 14px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:13}}>
        회차가 2개 이상이면 회차간 금액 증감·이윤율 변화를 자동으로 비교합니다.<br/>
        위에서 "+ 회차 추가" 또는 실행계획서 업로드로 회차를 추가해주세요.
      </div>
    </Card>
  ) : null

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
  const isGood = tooFew ? true : profitChange >= 0

  return tooFewMsg ?? (
    <Card title="📊 회차별 실행계획서 비교 분석" note="회차 순서대로 각 항목의 금액 변화·이윤율 추이를 모니터링합니다.">
      {/* 요약 헤드라인 */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
        <div style={{background:isGood?C.greenL:C.redL,borderRadius:10,padding:"10px 16px",flex:1,minWidth:180}}>
          <div style={{fontSize:11,color:isGood?C.green:C.red,fontWeight:600,marginBottom:3}}>1차 → {versions.length}차 이윤 변화</div>
          <div style={{fontSize:20,fontWeight:800,color:isGood?C.green:C.red}}>
            {isGood?"+":""}{fMoney(profitChange)}
          </div>
          <div style={{fontSize:12,color:isGood?C.green:C.red}}>({isGood?"+":""}{profitPctChange.toFixed(1)}%)</div>
        </div>
        {versions.map((v,i)=>{
          const p=pnls[i]
          const rate=svc>0?+(p._profit/svc*100).toFixed(1):null
          return (
            <div key={i} style={{background:selVerIdx===v._origIdx?"var(--color-background-primary,#fff)":C.grayL,borderRadius:10,padding:"10px 16px",flex:1,minWidth:140,border:`1px solid ${selVerIdx===v._origIdx?C.navyM:"transparent"}`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.gray,marginBottom:3}}>{v.round?`${v.round}차`:v.ver}</div>
              <div style={{fontSize:13,fontWeight:700,color:C.navy}}>{fMoney(p._profit)}</div>
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
                      <div style={{color:item.color||"inherit"}}>{fMoney(v)}</div>
                      {deltas[i]!=null&&deltas[i]!==0&&(
                        <div style={{fontSize:10,color:deltas[i]>0?C.red:C.green,fontWeight:600}}>
                          {deltas[i]>0?"+":""}{(deltas[i]/1e8).toFixed(2)}억
                        </div>
                      )}
                    </td>
                  ))}
                  {versions.length>=2 && <>
                    <td style={{...S.td("right"),fontWeight:700,color:diff==null?C.gray:diff>0?C.red:diff<0?C.green:C.gray}}>
                      {diff!=null?(diff>=0?"+":"")+fMoney(diff):"-"}
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
  const NOW_C=new Date(); const MONTH=NOW_C.getMonth()+1; const YEAR=NOW_C.getFullYear(); const YR=String(YEAR)
  const MONTHS=Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0"))

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
                      color:isCur?"#6366F1":isPast?"#6B7280":"#111827",
                      background:isCur?"#EEF2FF":isPast?"#F9FAFB":"var(--color-background-secondary,#f8f8f6)",
                      position:"relative"
                    }}>
                      {m}
                      {isCur&&<div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:"#6366F1"}}/>}
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
                          : field==="plan"&&!isPast?"#EEF2FF"
                          : field==="actual"&&!isFuture?"#D1FAE5"
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
        const ver=p.versions[p.versions.length-1]; const vd=ver?.vendors.find(v=>v.cat===cat)
        if(!vd||!vd.contract) return
        const basis=getAreaBasis(cat); if(basis==="1식") return
        const areaM2 = basis==="대지" ? (p.siteArea||0) : (p.floorArea||0)
        const py = toPy(areaM2)
        if(py<=0) return
        items.push({
          projId:p.id, projName:p.name,
          areaM2, py,
          basis: basis==="대지"?"대지면적":"연면적",
          vendor: vd.name,
          contract: vd.contract,
          nego2: vd.nego2||null,
          up:  vd.contract/py,
          up2: vd.nego2 ? vd.nego2/py : null,
          totalFee: p.serviceFee||p.totalFee||0,
        })
      })
      return {cat,items}
    }).filter(r=>r.items.length>0)
  },[selPs,allCats,selCat])
  const barData=benchData.map(row=>({name:row.cat.length>5?row.cat.slice(0,5)+"…":row.cat,...Object.fromEntries(row.items.map(i=>[i.projId,+i.up.toFixed(0)]))}))
  const fAmt = v => v>=1e8?`${(v/1e8).toFixed(2)}억`:v>=1e4?`${Math.round(v/1e4)}만`:`${v.toLocaleString()}`
  const fPy  = v => `${Math.round(v).toLocaleString()}평`
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
      <Card title="공종별 상세 (연면적 · 공종금액 · 평당단가)">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
            <thead>
              <tr style={{background:"#F8FAFC"}}>
                <th style={S.th("left")} rowSpan={2}>분야</th>
                <th style={S.th("center")} rowSpan={2}>기준</th>
                {selPs.map(p=>(
                  <th key={p.id} style={{...S.th("center"),borderLeft:"2px solid #E5E7EB"}} colSpan={4}>
                    <div style={{fontSize:11,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  </th>
                ))}
                <th style={{...S.th("right"),fontSize:10}} rowSpan={2}>최저<br/>평단</th>
                <th style={{...S.th("right"),fontSize:10}} rowSpan={2}>최고<br/>평단</th>
                <th style={{...S.th("right"),fontSize:10}} rowSpan={2}>차이</th>
              </tr>
              <tr style={{background:"#EEF2FF"}}>
                {selPs.map(p=>(
                  <React.Fragment key={p.id}>
                    <th style={{...S.th("right"),fontSize:10,color:"#6B7280",borderLeft:"2px solid #E5E7EB"}}>연면적㎡</th>
                    <th style={{...S.th("right"),fontSize:10,color:"#6B7280"}}>평수</th>
                    <th style={{...S.th("right"),fontSize:10,color:"#059669"}}>공종금액</th>
                    <th style={{...S.th("right"),fontSize:10,color:"#6366F1",fontWeight:800}}>평당단가</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {benchData.map((row,i)=>{
                const ups=row.items.map(it=>it.up).filter(v=>v>0)
                const min=ups.length?Math.min(...ups):0, max=ups.length?Math.max(...ups):0
                const basis=row.items[0]?.basis
                return (
                  <tr key={row.cat} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                    <td style={S.td("left")}><span style={S.bdg(C.navyL,C.navyM)}>{row.cat}</span></td>
                    <td style={S.td("center")}><span style={S.bdg(basis==="대지면적"?C.amberL:C.greenL,basis==="대지면적"?C.amber:C.green)}>{basis}</span></td>
                    {selPs.map(p=>{
                      const it=row.items.find(it=>it.projId===p.id)
                      const isMin=it&&it.up===min&&selPs.length>1, isMax=it&&it.up===max&&selPs.length>1
                      return (
                        <React.Fragment key={p.id}>
                          <td style={{...S.td("right"),fontSize:12,color:"#9CA3AF",borderLeft:"2px solid #E5E7EB"}}>{it?it.areaM2.toLocaleString():"-"}</td>
                          <td style={{...S.td("right"),fontSize:12,color:"#9CA3AF"}}>{it?fPy(it.py):"-"}</td>
                          <td style={{...S.td("right"),fontSize:12.5,color:"#059669",fontWeight:600}}>
                            {it?<>{fAmt(it.contract)}{it.nego2&&<div style={{fontSize:10,color:"#D97706"}}>↓{fAmt(it.nego2)}</div>}</>:"-"}
                          </td>
                          <td style={{...S.td("right"),fontWeight:isMin||isMax?700:500,color:isMin?"#059669":isMax?"#DC2626":"inherit",background:isMin?"#D1FAE5":isMax?"#FEE2E2":"transparent"}}>
                            {it?<>
                              <div style={{fontSize:13.5}}>{Math.round(it.up).toLocaleString()}<span style={{fontSize:10,fontWeight:400}}>원/평</span></div>
                              {it.up2&&<div style={{fontSize:10,color:"#D97706"}}>→{Math.round(it.up2).toLocaleString()}원/평</div>}
                              {it.vendor&&<div style={{fontSize:10,color:"#9CA3AF"}}>{it.vendor.slice(0,8)}</div>}
                            </>:"-"}
                          </td>
                        </React.Fragment>
                      )
                    })}
                    <td style={{...S.td("right"),color:"#059669",fontWeight:700,fontSize:12}}>{min>0?Math.round(min).toLocaleString()+"원":"-"}</td>
                    <td style={{...S.td("right"),color:"#DC2626",fontWeight:700,fontSize:12}}>{max>0?Math.round(max).toLocaleString()+"원":"-"}</td>
                    <td style={S.td("right")}>{min>0?((max-min)/min*100).toFixed(0)+"%":"-"}</td>
                  </tr>
                )
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
    saveUsers([...users,{...rest,id:`U${Date.now()}`,avatar:newUser.name.slice(0,2),_pwHash:h,tabPerms:{}}])
    setShowAdd(false);setNewUser({name:"",loginId:"",role:"viewer",dept:"",read:true,write:false,canManageUsers:false,active:true,_newPw:""})
  }
  const ROLES=[{v:"admin",l:"관리자"},{v:"executive",l:"임원"},{v:"viewer",l:"열람자"}]
  const [permUserId, setPermUserId] = useState(null)

  // 탭별 권한 설정
  const TAB_PERM_LIST = [
    {id:"analysis",   label:"📊 경영분석"},
    {id:"deptdash",   label:"🏢 본부별 현황"},
    {id:"projects",   label:"🏗 프로젝트"},
    {id:"history",    label:"📜 히스토리"},
    {id:"calendar",   label:"📅 캘린더"},
    {id:"vendors",    label:"🤝 협력업체"},
    {id:"contract",   label:"📄 계약서"},
    {id:"archive",    label:"📁 아카이브"},
    {id:"pnl",        label:"📉 손익분석"},
    {id:"optimize",   label:"⚙️ 경영최적화"},
    {id:"datahub",    label:"🗄️ 데이터관리"},
    {id:"manual",     label:"📚 업무매뉴얼"},
    {id:"notice",     label:"📢 공지사항"},
    {id:"stats",      label:"📈 사용 통계"},
    {id:"gamify",     label:"🎮 포인트·랭킹"},
  ]
  const PERM_OPTS = [{v:"rw",l:"읽기+쓰기",c:"#059669"},{v:"r",l:"읽기전용",c:"#6366F1"},{v:"hidden",l:"숨김",c:"#DC2626"}]
  const setTabPerm = (uid, tabId, perm) => {
    saveUsers(users.map(u=>u.id===uid?{...u,tabPerms:{...(u.tabPerms||{}),[tabId]:perm}}:u))
  }
  const applyRoleDefaults = (uid, role) => {
    const defaultPerms = {}
    if(role==="viewer"){
      // 열람자: 손익·데이터관리는 숨김, 나머지 읽기
      TAB_PERM_LIST.forEach(t=>{
        if(["pnl","optimize","datahub"].includes(t.id)) defaultPerms[t.id]="hidden"
        else defaultPerms[t.id]="r"
      })
    } else if(role==="executive"){
      // 임원: 데이터관리 숨김, 나머지 읽기+쓰기
      TAB_PERM_LIST.forEach(t=>{
        if(["datahub"].includes(t.id)) defaultPerms[t.id]="hidden"
        else defaultPerms[t.id]="rw"
      })
    } else {
      // admin: 모든 권한
      TAB_PERM_LIST.forEach(t=>{ defaultPerms[t.id]="rw" })
    }
    saveUsers(users.map(u=>u.id===uid?{...u,tabPerms:defaultPerms}:u))
  }
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
                        <button onClick={()=>setPermUserId(permUserId===u.id?null:u.id)} style={{...S.btn(permUserId===u.id?"#4F46E5":"#F3F4F6",permUserId===u.id?"#fff":"#374151"),padding:"4px 8px",fontSize:11}}>탭권한</button>
                        {u.id!==currentUser.id&&<button onClick={()=>{setPwResetId(u.id);setNewPwVal("");setPwMsg("")}} style={{...S.btn(C.amberL,C.amber),padding:"4px 8px",fontSize:11}}>비번</button>}
                        <button onClick={()=>toggleActive(u.id)} style={{...S.btn(u.active?C.redL:C.greenL,u.active?C.red:C.green),padding:"4px 8px",fontSize:11}}>{u.active?"비활":"활성"}</button>
                      </div>
                      {/* 탭별 권한 설정 패널 */}
                      {permUserId===u.id&&(
                        <div style={{marginTop:8,background:"#F8F0FF",borderRadius:10,padding:"12px 14px",border:"1px solid #4F46E522",minWidth:320}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                            <div style={{fontSize:12.5,fontWeight:700,color:"#4F46E5"}}>🔐 탭별 접근 권한 — {u.name}</div>
                            <div style={{display:"flex",gap:5}}>
                              {["viewer","executive","admin"].map(role=>(
                                <button key={role} onClick={()=>applyRoleDefaults(u.id,role)}
                                  style={{padding:"3px 8px",background:"#EDE9FE",color:"#4F46E5",border:"none",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                  {role==="admin"?"관리자기본":role==="executive"?"임원기본":"열람자기본"}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                            {TAB_PERM_LIST.map(t=>{
                              const cur = (u.tabPerms||{})[t.id] || (u.write?"rw":"r")
                              return (
                                <div key={t.id} style={{display:"flex",alignItems:"center",gap:6,background:"#fff",borderRadius:8,padding:"6px 10px"}}>
                                  <span style={{flex:1,fontSize:12.5,color:"#374151"}}>{t.label}</span>
                                  <div style={{display:"flex",gap:3}}>
                                    {PERM_OPTS.map(opt=>(
                                      <button key={opt.v} onClick={()=>setTabPerm(u.id,t.id,opt.v)}
                                        style={{padding:"3px 7px",border:`1.5px solid ${cur===opt.v?opt.c:"#E5E7EB"}`,borderRadius:6,
                                          background:cur===opt.v?opt.c+"18":"#fff",color:cur===opt.v?opt.c:"#9CA3AF",
                                          fontSize:11,fontWeight:cur===opt.v?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>
                                        {opt.l}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <div style={{marginTop:8,fontSize:11,color:"#9CA3AF"}}>
                            🟢 읽기+쓰기: 조회·수정 가능 &nbsp;|&nbsp; 🔵 읽기전용: 조회만 가능 &nbsp;|&nbsp; 🔴 숨김: 메뉴에서 완전 숨김
                          </div>
                        </div>
                      )}
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
    return {year:new Date().getFullYear()+"",code:"",name:"",deptShares:[{dept:STAFF_DEPTS[0],share:100}],pm:"",director:"",projType:"",contractType:"민간",usage:"",scale:"",siteArea:0,buildArea:0,floorArea:0,units:0,client:"",clientPm:"",clientTel:"",clientEmail:"",staffMembers:[],totalFee:0,shareRatio:100,serviceFee:0,address:"",contractDate:"",orderDate:"",orderType:"민간",bidType:"민간수의",note:"",type:"확정",contractYear:new Date().getFullYear(),isAmendment:false,parentProjName:"",prog:0,
      jvType:"단독이행",   // 단독이행 | 공동이행 | 분담이행
      jvMembers:[],        // [{name,ratio,amount,role}]
    }
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
            <div style={S.grid(3,9)}>
              <F label="발주처담당자 연락처" val={f.clientTel||""} onChange={v=>u("clientTel",v)} ph="010-0000-0000"/>
              <F label="발주처담당자 이메일" val={f.clientEmail||""} onChange={v=>u("clientEmail",v)} ph="example@co.kr"/>
              <F label="세대수" val={f.units||0} onChange={v=>u("units",parseInt(v)||0)} type="number"/>
            </div>
            {/* 계약연도 + 설계변경 */}
            <div style={{background:"#EEF2FF",borderRadius:10,padding:"14px 16px",marginTop:8}}>
              <div style={{fontSize:13,fontWeight:800,color:"#312E81",marginBottom:10}}>📅 계약연도 설정 (당해연도 신규 계약 구분용)</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <div>
                  <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>
                    계약 체결 연도 *
                    <span style={{fontSize:11,color:"#6B7280",fontWeight:400,marginLeft:6}}>실제 계약이 체결된 연도</span>
                  </label>
                  <input type="number" min={2000} max={2100} value={f.contractYear||new Date().getFullYear()} onChange={e=>u("contractYear",parseInt(e.target.value)||new Date().getFullYear())}
                    style={{padding:"8px 12px",border:"1.5px solid #C7D2FE",borderRadius:9,fontSize:14,width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none",background:"#fff",fontWeight:700,color:"#312E81"}}/>
                  <div style={{fontSize:11,color:"#6B7280",marginTop:4}}>예: 2024년에 계약된 프로젝트 → 2024 입력</div>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>설계변경/증액 여부</label>
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    {[["false","일반 계약"],["true","설계변경·증액"]].map(([val,label])=>(
                      <button key={val} type="button"
                        onClick={()=>u("isAmendment",val==="true")}
                        style={{padding:"8px 14px",border:`2px solid ${String(f.isAmendment||false)===val?"#D97706":"#E5E7EB"}`,borderRadius:9,fontSize:13,fontWeight:600,cursor:"pointer",
                          background:String(f.isAmendment||false)===val?"#FEF3C7":"#fff",
                          color:String(f.isAmendment||false)===val?"#92400E":"#6B7280",flex:1}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>
                    원계약 프로젝트명
                    <span style={{fontSize:11,color:"#6B7280",fontWeight:400,marginLeft:6}}>설계변경일 경우</span>
                  </label>
                  <input list="parent-proj-list" value={f.parentProjName||""} onChange={e=>u("parentProjName",e.target.value)}
                    placeholder="원계약 프로젝트명 검색..."
                    style={{padding:"8px 12px",border:"1.5px solid #E5E7EB",borderRadius:9,fontSize:13,width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none",background:"#fff"}}/>
                  <datalist id="parent-proj-list">
                    {(f._allProjects||[]).map(p=><option key={p} value={p}/>)}
                  </datalist>
                </div>
              </div>
              {/* 설계변경 상세 - 증액금액/사유 */}
              {f.isAmendment&&(
                <div style={{marginTop:12,background:"#FEF3C7",borderRadius:9,padding:"12px 14px",border:"1px solid #D97706"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#92400E",marginBottom:10}}>⚙ 설계변경·증액 상세</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>
                        증액 금액 — 원(₩)
                        <span style={{fontSize:11,color:"#6B7280",fontWeight:400,marginLeft:6}}>증액분만 입력</span>
                      </label>
                      <input type="number" value={f.amendAmount||""} onChange={e=>u("amendAmount",parseInt(e.target.value)||0)}
                        placeholder="예: 204000000"
                        style={{padding:"8px 10px",border:"1.5px solid #D97706",borderRadius:8,fontSize:13,width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none",background:"#fff"}}/>
                      {(f.amendAmount||0)>0&&<div style={{fontSize:12,color:"#D97706",marginTop:3,fontWeight:700}}>= {((f.amendAmount||0)/1e8).toFixed(2)}억</div>}
                    </div>
                    <div>
                      <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>증액 사유</label>
                      <input value={f.amendReason||""} onChange={e=>u("amendReason",e.target.value)}
                        placeholder="예: 설계변경, 물가상승, 공사비 증가"
                        style={{padding:"8px 10px",border:"1.5px solid #E5E7EB",borderRadius:8,fontSize:13,width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none",background:"#fff"}}/>
                    </div>
                  </div>
                </div>
              )}
            <div style={{marginTop:8}}>
              <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:8,display:"flex",justifyContent:"space-between"}}>
                실무담당자
                <button type="button" onClick={()=>u("staffMembers",[...(f.staffMembers||[]),{name:"",title:"",tel:"",email:""}])}
                  style={{padding:"3px 10px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 추가</button>
              </div>
              {(f.staffMembers||[]).map((m,mi)=>(
                <div key={mi} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",gap:8,marginBottom:8,alignItems:"end"}}>
                  <F label="이름" val={m.name} onChange={v=>{const s=[...(f.staffMembers||[])];s[mi]={...m,name:v};u("staffMembers",s)}}/>
                  <F label="직위" val={m.title} onChange={v=>{const s=[...(f.staffMembers||[])];s[mi]={...m,title:v};u("staffMembers",s)}} ph="과장/대리 등"/>
                  <F label="연락처" val={m.tel} onChange={v=>{const s=[...(f.staffMembers||[])];s[mi]={...m,tel:v};u("staffMembers",s)}} ph="010-0000-0000"/>
                  <F label="이메일" val={m.email} onChange={v=>{const s=[...(f.staffMembers||[])];s[mi]={...m,email:v};u("staffMembers",s)}} ph="example@co.kr"/>
                  <button type="button" onClick={()=>u("staffMembers",(f.staffMembers||[]).filter((_,i2)=>i2!==mi))}
                    style={{padding:"8px 10px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:6,cursor:"pointer",marginBottom:0}}>✕</button>
                </div>
              ))}
            </div>
            </div>
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
          {title:"공동이행체 / 분담이행체",content:<>
            <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
              <label style={S.lbl()}>수급 형태</label>
              {["단독이행","공동이행","분담이행"].map(t=>(
                <button key={t} onClick={()=>u("jvType",t)}
                  style={{padding:"6px 14px",border:`1.5px solid ${f.jvType===t?"#6366F1":"#E5E7EB"}`,borderRadius:20,background:f.jvType===t?"#EEF2FF":"#fff",color:f.jvType===t?"#6366F1":"#374151",fontSize:13,fontWeight:f.jvType===t?700:500,cursor:"pointer"}}>
                  {t}
                </button>
              ))}
            </div>
            {f.jvType!=="단독이행"&&<>
              <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#6B7280"}}>{f.jvType} 구성원 (상지서울 포함)</span>
                  <button onClick={()=>u("jvMembers",[...(f.jvMembers||[]),{name:"",ratio:0,amount:0,role:"구성원"}])}
                    style={{padding:"4px 10px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 업체 추가</button>
                </div>
                {(f.jvMembers||[]).map((m,i)=>(
                  <div key={i} style={{display:"flex",gap:7,alignItems:"center",marginBottom:6,background:"#F8FAFC",borderRadius:9,padding:"8px 10px",border:"1px solid #E5E7EB"}}>
                    <div style={{flex:2}}><label style={{...S.lbl(),marginBottom:2}}>업체명</label>
                      <input value={m.name} onChange={e=>{const a=[...f.jvMembers];a[i]={...a[i],name:e.target.value};u("jvMembers",a)}} placeholder="(주)○○건축사사무소" style={{...S.inp(),padding:"6px 9px",fontSize:13}}/>
                    </div>
                    <div style={{flex:1}}><label style={{...S.lbl(),marginBottom:2}}>지분율(%)</label>
                      <input type="number" value={m.ratio} onChange={e=>{const a=[...f.jvMembers];a[i]={...a[i],ratio:parseFloat(e.target.value)||0,amount:Math.round((f.totalFee||0)*(parseFloat(e.target.value)||0)/100)};u("jvMembers",a)}} style={{...S.inp(),padding:"6px 9px",fontSize:13}}/>
                    </div>
                    <div style={{flex:1}}><label style={{...S.lbl(),marginBottom:2}}>금액(원)</label>
                      <div style={{padding:"6px 9px",border:"1.5px solid #E5E7EB",borderRadius:9,fontSize:13,background:"#EEF2FF",color:"#6366F1",fontWeight:700}}>{m.amount>0?m.amount.toLocaleString():"-"}</div>
                    </div>
                    <div style={{flex:1}}><label style={{...S.lbl(),marginBottom:2}}>역할</label>
                      <select value={m.role} onChange={e=>{const a=[...f.jvMembers];a[i]={...a[i],role:e.target.value};u("jvMembers",a)}} style={{...S.inp(),padding:"6px 9px",fontSize:13}}>
                        {["주간사","구성원","간사사"].map(r=><option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <button onClick={()=>u("jvMembers",f.jvMembers.filter((_,ri)=>ri!==i))} style={{background:"none",border:"none",cursor:"pointer",color:"#DC2626",fontSize:16,flexShrink:0,alignSelf:"flex-end",paddingBottom:4}}>✕</button>
                  </div>
                ))}
                {(f.jvMembers||[]).length>0&&(
                  <div style={{display:"flex",gap:12,padding:"8px 12px",background:"#EEF2FF",borderRadius:9,fontSize:13}}>
                    <span style={{fontWeight:700,color:"#312E81"}}>총 지분율: {(f.jvMembers||[]).reduce((s,m)=>s+m.ratio,0).toFixed(1)}%</span>
                    <span style={{color:"#6B7280"}}>총 금액: ₩{(f.jvMembers||[]).reduce((s,m)=>s+m.amount,0).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </>}
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
          <div key={i} style={{padding:"10px 18px",background:"#EEF2FF",color:"#6366F1",borderRadius:20,fontSize:14,fontWeight:600}}>{t}</div>
        ))}
      </div>
    </div>
  )
}

// ── 설계용역 표준계약서 생성 탭 ────────────────────────────────
function ContractTab({projects, currentUser}) {
  const [selProjId, setSelProjId] = useState(projects[0]?.id||"")
  const proj = projects.find(p=>p.id===selProjId)
  const noProj = !proj
  const [contractView, setContractView] = useState("form") // "form" | "checklist"
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
  const [showAIFill, setShowAIFill] = useState(false)

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

  // 🤖 AI 분석 결과를 계약서 폼에 적용
  const applyAIResult = (parsed) => {
    setForm(prev=>({
      ...prev,
      contractTitle: parsed.name || prev.contractTitle,
      siteAddr:      parsed.siteAddr || prev.siteAddr,
      usage:         parsed.usage || prev.usage,
      scale:         parsed.scale || prev.scale,
      totalFee:      parsed.totalFee ? String(parsed.totalFee) : prev.totalFee,
      contractDate:  parsed.contractDate || prev.contractDate,
      gabName:       parsed.client || prev.gabName,
      gabCeo:        parsed.clientCeo || prev.gabCeo,
      gabRegNo:      parsed.clientRegNo || prev.gabRegNo,
      gabAddr:       parsed.clientAddr || prev.gabAddr,
      gabTel:        parsed.clientTel || prev.gabTel,
    }))
    setShowAIFill(false)
  }

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      {/* 헤더 */}
      <div style={{...card2,background:"linear-gradient(135deg,#312E81,#6366F1)",color:"#fff"}}>
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

      {/* 🤖 AI 계약서 분석으로 자동 채우기 */}
      <div style={{...card2,background:"linear-gradient(135deg,#EEF2FF,#F5F3FF)",border:"1.5px solid #C7D2FE"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:"#312E81",marginBottom:4}}>🤖 기존 계약서로 AI 자동 채우기</div>
            <div style={{fontSize:13,color:"#6366F1"}}>보유하고 있는 계약서(PDF/이미지)를 업로드하면 AI가 분석하여 위 항목들을 자동으로 채워줍니다.</div>
          </div>
          <button onClick={()=>setShowAIFill(true)}
            style={{padding:"10px 20px",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",color:"#fff",border:"none",borderRadius:10,fontSize:13.5,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(99,102,241,.3)"}}>
            🤖 계약서 AI 분석
          </button>
          <button onClick={()=>setContractView(v=>v==="checklist"?"form":"checklist")}
            style={{padding:"10px 20px",background:contractView==="checklist"?"#DC2626":"linear-gradient(135deg,#DC2626,#EF4444)",color:"#fff",border:"none",borderRadius:10,fontSize:13.5,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(220,38,38,.3)"}}>
            {contractView==="checklist"?"✏ 계약서 작성":"✅ 체크리스트 검토"}
          </button>
        </div>
      </div>

      {/* ── 체크리스트 뷰 ── */}
      {contractView==="checklist" && <ContractChecklist form={form} currentUser={currentUser}/>}

      {/* ── 계약서 작성 뷰 ── */}
      <div style={{display:contractView!=="checklist"?"block":"none"}}>
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
                  <td style={{padding:"8px 12px",border:"1px solid #E5E7EB",textAlign:"right",fontWeight:700,color:"#6366F1",fontSize:14}}>
                    {payments[i].amount>0?`₩ ${payments[i].amount.toLocaleString()}`:"-"}
                  </td>
                  <td style={{padding:"8px 12px",border:"1px solid #E5E7EB"}}>
                    <input value={row.note} onChange={e=>setForm(p=>({...p,payments:p.payments.map((r,ri)=>ri===i?{...r,note:e.target.value}:r)}))} style={{...inp2,padding:"6px 10px",fontSize:13.5}}/>
                  </td>
                </tr>
              ))}
              <tr style={{background:"#EEF2FF",fontWeight:700}}>
                <td style={{padding:"11px 14px",border:"1px solid #E5E7EB",fontSize:14}}>합계</td>
                <td style={{padding:"11px 14px",border:"1px solid #E5E7EB",textAlign:"center",fontSize:14,color:totalRatio===100?"#059669":"#DC2626"}}>{totalRatio}% {totalRatio!==100&&"⚠"}</td>
                <td style={{padding:"11px 14px",border:"1px solid #E5E7EB",textAlign:"right",fontSize:15,color:"#312E81"}}>₩ {feeNum.toLocaleString()}</td>
                <td style={{padding:"11px 14px",border:"1px solid #E5E7EB",fontSize:13,color:"#6B7280"}}>부가가치세 별도</td>
              </tr>
            </tbody>
          </table>
        </div>
        {totalRatio!==100&&<div style={{marginTop:8,color:"#DC2626",fontSize:13,fontWeight:600}}>⚠ 비율 합계가 {totalRatio}%입니다. 100%가 되어야 합니다.</div>}
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

      {/* 🤖 AI 계약서 분석 모달 */}
      {showAIFill && (
        <ContractFormAIFill
          currentUser={currentUser}
          onApply={applyAIResult}
          onClose={()=>setShowAIFill(false)}
        />
      )}
    </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ✅ 계약서 체크리스트 검토 시스템
// ══════════════════════════════════════════════════════════════
const CONTRACT_CHECKLIST = [
  {
    category:"📋 기본 계약 정보",
    items:[
      {id:"c1", text:"계약 당사자(갑/을) 명칭, 대표자, 사업자번호, 주소가 모두 기재되어 있는가?", required:true},
      {id:"c2", text:"계약일자가 명시되어 있는가?", required:true},
      {id:"c3", text:"용역 범위(설계 단계: 계획/기본/실시설계 등)가 명확히 정의되어 있는가?", required:true},
      {id:"c4", text:"대지위치, 용도, 규모(층수), 연면적이 기재되어 있는가?", required:true},
    ]
  },
  {
    category:"💰 계약 금액 및 대가 기준",
    items:[
      {id:"c5", text:"계약금액(VAT 별도 표기)이 명확히 기재되어 있는가?", required:true},
      {id:"c6", text:"건축사 용역의 범위와 대가기준(국토부 고시)을 준수하는가?", required:true},
      {id:"c7", text:"단계별 대가 지급 비율과 시기가 명시되어 있는가?", required:true},
      {id:"c8", text:"VAT(부가가치세) 포함 여부가 명시되어 있는가?", required:true},
      {id:"c9", text:"계약금액 변경 조건(설계변경 등)이 규정되어 있는가?", required:false},
    ]
  },
  {
    category:"📅 납기 및 업무 범위",
    items:[
      {id:"c10", text:"각 설계 단계별 납품 기한이 명시되어 있는가?", required:true},
      {id:"c11", text:"납품 도서 목록(도면 종류, 수량)이 첨부 또는 기재되어 있는가?", required:false},
      {id:"c12", text:"설계 변경 시 추가 용역비 청구 조항이 있는가?", required:true},
      {id:"c13", text:"공동도급(JV) 시 지분율과 분담 업무가 명시되어 있는가?", required:false},
    ]
  },
  {
    category:"⚖️ 권리·의무 및 법적 사항",
    items:[
      {id:"c14", text:"저작권(설계도서) 귀속 조항이 명시되어 있는가?", required:true},
      {id:"c15", text:"허가 불허 또는 설계 변경 요구 시 책임 한계가 규정되어 있는가?", required:true},
      {id:"c16", text:"계약 해제·해지 조건 및 절차가 규정되어 있는가?", required:true},
      {id:"c17", text:"건축사 법적 책임(하자담보) 범위가 명시되어 있는가?", required:false},
      {id:"c18", text:"분쟁 해결 방법(재판 관할, 조정 등)이 규정되어 있는가?", required:false},
    ]
  },
  {
    category:"🏗️ 건축사 표준계약서 필수 조항",
    items:[
      {id:"c19", text:"건축법 제9조의2 및 건축사법 제19조의3 근거 조항이 포함되어 있는가?", required:true},
      {id:"c20", text:"건축사 업무 신고 확인서(또는 건축사 자격 명시) 조항이 있는가?", required:true},
      {id:"c21", text:"공공 발주: 계약예규·국가계약법 준수 여부가 확인되었는가?", required:false},
      {id:"c22", text:"민간 발주: 갑의 자금 조달 능력 확인 조항 또는 선급금 규정이 있는가?", required:false},
    ]
  },
  {
    category:"📎 첨부 서류",
    items:[
      {id:"c23", text:"설계업무 범위 명세서(업무 내용)가 첨부되어 있는가?", required:false},
      {id:"c24", text:"인감증명서 첨부 및 서명 날인이 완료되었는가?", required:true},
      {id:"c25", text:"건축사 업무 신고 확인서가 첨부되어 있는가?", required:true},
    ]
  },
]

function ContractChecklist({form, currentUser}) {
  const [checks, setChecks] = useState(()=>{
    const saved = localStorage.getItem("sjs_contract_checklist")
    return saved ? JSON.parse(saved) : {}
  })
  const [notes, setNotes] = useState({})
  const [uploadedText, setUploadedText] = useState("") // 계약서 텍스트
  const [aiReview, setAiReview] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [activeFile, setActiveFile] = useState(null)

  const allItems = CONTRACT_CHECKLIST.flatMap(c=>c.items)
  const required = allItems.filter(i=>i.required)
  const checkedRequired = required.filter(i=>checks[i.id]==="ok")
  const uncheckedRequired = required.filter(i=>!checks[i.id]||checks[i.id]==="no")
  const totalChecked = allItems.filter(i=>checks[i.id]==="ok").length
  const completionRate = Math.round(totalChecked/allItems.length*100)
  const requiredRate   = Math.round(checkedRequired.length/required.length*100)

  const toggle = (id, val) => {
    const next = {...checks, [id]: checks[id]===val ? undefined : val}
    setChecks(next)
    localStorage.setItem("sjs_contract_checklist", JSON.stringify(next))
  }

  // AI 계약서 검토
  const runAIReview = async () => {
    setAiLoading(true)
    const unchecked = uncheckedRequired.map(i=>i.text).join("\n")
    const formSummary = form ? `
용역명: ${form.contractTitle||"미입력"}
발주처: ${form.gabName||"미입력"}
계약금액: ${form.totalFee||"미입력"}
대지위치: ${form.siteAddr||"미입력"}
` : ""

    const prompt = `당신은 건축설계 계약 전문가입니다.
아래 계약서 정보와 미체크 항목을 검토하고, 위험 요소와 개선 사항을 분석해주세요.

## 현재 계약서 정보
${formSummary}

## 미체크(미확인) 필수 항목
${unchecked||"없음 (모든 필수항목 확인됨)"}

## 업로드된 계약서 내용 (일부)
${uploadedText ? uploadedText.slice(0,2000) : "업로드 없음"}

분석 요청:
1. 누락된 필수 조항의 위험도 평가 (상/중/하)
2. 계약서에서 발견된 불리한 조항
3. 추가 권고 사항
4. 종합 의견

한국어로 간결하게 답변해주세요.`

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1500,
          messages:[{role:"user",content:prompt}]})
      })
      const data = await res.json()
      setAiReview(data.content?.[0]?.text||"응답 없음")
    } catch(e) { setAiReview("AI 검토 오류: "+e.message) }
    setAiLoading(false)
  }

  // 계약서 파일 업로드
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]; if(!file) return
    setActiveFile(file.name)
    const reader = new FileReader()
    reader.onload = ev => setUploadedText(ev.target.result?.slice(0,5000)||"")
    reader.readAsText(file, "utf-8")
  }

  const INP2 = {padding:"6px 10px",border:"1.5px solid #E5E7EB",borderRadius:7,fontSize:12.5,width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none",background:"#fff"}

  return (
    <div>
      {/* 진행률 헤더 */}
      <div style={{background:"linear-gradient(135deg,#DC2626,#EF4444)",borderRadius:14,padding:"18px 20px",marginBottom:16,color:"#fff",display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:900,marginBottom:4}}>✅ 계약서 체크리스트 검토</div>
          <div style={{fontSize:12.5,opacity:.8}}>표준계약서 기준 · 필수 {required.length}항목 · 전체 {allItems.length}항목</div>
        </div>
        <div style={{display:"flex",gap:14}}>
          {[["필수 완료",`${checkedRequired.length}/${required.length}`,`${requiredRate}%`,"#FDE68A"],
            ["전체 달성",`${totalChecked}/${allItems.length}`,`${completionRate}%`,"#A7F3D0"]].map(([l,v,r,c])=>(
            <div key={l} style={{textAlign:"center",background:"rgba(255,255,255,.15)",borderRadius:10,padding:"10px 16px"}}>
              <div style={{fontSize:10.5,opacity:.8}}>{l}</div>
              <div style={{fontSize:18,fontWeight:900,color:c}}>{r}</div>
              <div style={{fontSize:11,opacity:.7}}>{v}</div>
            </div>
          ))}
        </div>
        {/* 전체 진행바 */}
        <div style={{width:"100%",background:"rgba(255,255,255,.2)",borderRadius:4,height:6}}>
          <div style={{width:`${requiredRate}%`,height:"100%",background:"#FDE68A",borderRadius:4,transition:"width .5s"}}/>
        </div>
      </div>

      {/* 계약서 업로드 + AI 검토 */}
      <div style={{background:"#EEF2FF",borderRadius:12,border:"2px solid #6366F1",padding:"14px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{fontSize:13.5,fontWeight:700,color:"#312E81",flex:1}}>
          📄 계약서 파일 업로드 후 AI 자동 검토
          {activeFile&&<span style={{fontSize:12,fontWeight:400,color:"#6366F1",marginLeft:8}}>({activeFile})</span>}
        </div>
        <label style={{padding:"7px 14px",background:"#6366F1",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}>
          📎 파일 선택
          <input type="file" accept=".txt,.pdf,.docx,.hwp" style={{display:"none"}} onChange={handleFileUpload}/>
        </label>
        <button onClick={runAIReview} disabled={aiLoading}
          style={{padding:"7px 18px",background:aiLoading?"#9CA3AF":"#DC2626",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>
          {aiLoading?"⏳ 검토 중...":"🤖 AI 검토 실행"}
        </button>
        <button onClick={()=>{setChecks({});localStorage.removeItem("sjs_contract_checklist")}}
          style={{padding:"7px 12px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:9,fontSize:12,cursor:"pointer"}}>
          🔄 초기화
        </button>
      </div>

      {/* AI 검토 결과 */}
      {aiReview&&(
        <div style={{background:"#fff",borderRadius:12,border:"2px solid #6366F1",padding:"16px 18px",marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:800,color:"#312E81",marginBottom:10}}>🤖 AI 계약서 검토 결과</div>
          <div style={{fontSize:13.5,lineHeight:1.8,color:"#374151",whiteSpace:"pre-wrap"}}>{aiReview}</div>
        </div>
      )}

      {/* 체크리스트 카테고리별 */}
      {CONTRACT_CHECKLIST.map(cat=>(
        <div key={cat.category} style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",marginBottom:12,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",background:"#F8FAFC",borderBottom:"1px solid #E5E7EB",fontSize:14,fontWeight:800,color:"#111827",display:"flex",justifyContent:"space-between"}}>
            <span>{cat.category}</span>
            <span style={{fontSize:12,fontWeight:600,color:"#6B7280"}}>
              {cat.items.filter(i=>checks[i.id]==="ok").length}/{cat.items.length} 확인
            </span>
          </div>
          <div>
            {cat.items.map((item,ii)=>{
              const status = checks[item.id]
              return (
                <div key={item.id} style={{padding:"12px 16px",borderBottom:ii<cat.items.length-1?"1px solid #F3F4F6":"none",
                  background:status==="ok"?"#F0FDF4":status==="no"?"#FEF2F2":status==="na"?"#F9FAFB":"#fff"}}>
                  <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    {/* 상태 버튼 */}
                    <div style={{display:"flex",gap:4,flexShrink:0,marginTop:1}}>
                      {[["ok","✅","#059669","#D1FAE5"],["no","❌","#DC2626","#FEE2E2"],["na","➖","#9CA3AF","#F3F4F6"]].map(([v,icon,fg,bg])=>(
                        <button key={v} onClick={()=>toggle(item.id,v)}
                          style={{width:28,height:28,border:`2px solid ${status===v?fg:"#E5E7EB"}`,borderRadius:7,background:status===v?bg:"#fff",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                          {icon}
                        </button>
                      ))}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13.5,color:"#111827",lineHeight:1.6,marginBottom:status?4:0}}>
                        {item.required&&<span style={{fontSize:10,background:"#FEE2E2",color:"#DC2626",padding:"1px 5px",borderRadius:5,fontWeight:700,marginRight:5}}>필수</span>}
                        {item.text}
                      </div>
                      {/* 비고 입력 */}
                      {status&&status!=="na"&&(
                        <input value={notes[item.id]||""} onChange={e=>setNotes(n=>({...n,[item.id]:e.target.value}))}
                          placeholder={status==="ok"?"확인 내용 메모...":"미비 사항 메모..."}
                          style={{...INP2,marginTop:4}}/>
                      )}
                    </div>
                    <div style={{flexShrink:0,fontSize:11.5,fontWeight:700,
                      color:status==="ok"?"#059669":status==="no"?"#DC2626":status==="na"?"#9CA3AF":"#D1D5DB"}}>
                      {status==="ok"?"확인":status==="no"?"미비":status==="na"?"해당없음":"미확인"}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* 최종 의견 요약 */}
      {uncheckedRequired.length>0&&(
        <div style={{background:"#FEF2F2",borderRadius:12,border:"2px solid #DC2626",padding:"14px 16px",marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:800,color:"#DC2626",marginBottom:8}}>⚠️ 미확인 필수 항목 ({uncheckedRequired.length}건)</div>
          {uncheckedRequired.map(i=>(
            <div key={i.id} style={{fontSize:13,color:"#374151",padding:"4px 0",borderBottom:"1px solid #FEE2E2",display:"flex",gap:8}}>
              <span style={{color:"#DC2626"}}>•</span>{i.text}
            </div>
          ))}
        </div>
      )}
      {requiredRate===100&&(
        <div style={{background:"#F0FDF4",borderRadius:12,border:"2px solid #059669",padding:"14px 16px",textAlign:"center"}}>
          <div style={{fontSize:16,fontWeight:900,color:"#059669"}}>✅ 모든 필수 항목 확인 완료!</div>
          <div style={{fontSize:13,color:"#6B7280",marginTop:4}}>계약서 검토가 완료되었습니다. AI 검토를 추가로 실행하면 더 상세한 분석을 받을 수 있습니다.</div>
        </div>
      )}
    </div>
  )
}
function ContractFormAIFill({currentUser, onApply, onClose}) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState("idle") // idle | analyzing | done | error
  const [parsed, setParsed] = useState(null)
  const [errorMsg, setErrorMsg] = useState("")

  const handleFile = (f) => {
    if(!f) return
    setFile(f); setParsed(null); setStatus("idle"); setErrorMsg("")
    if(f.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target.result)
      reader.readAsDataURL(f)
    } else setPreview(null)
  }

  const fileToBase64 = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(",")[1])
    reader.onerror = reject
    reader.readAsDataURL(f)
  })

  const analyze = async () => {
    if(!file) return
    setStatus("analyzing"); setErrorMsg("")
    try {
      const base64 = await fileToBase64(file)
      const mediaType = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg")
      const isPdf = mediaType === "application/pdf"
      const contentBlock = isPdf
        ? { type:"document", source:{ type:"base64", media_type:"application/pdf", data: base64 } }
        : { type:"image", source:{ type:"base64", media_type: mediaType, data: base64 } }

      const systemPrompt = `당신은 건축설계 계약서 분석 전문 AI입니다.
업로드된 계약서 문서에서 아래 항목을 정확히 추출하여 JSON으로만 응답하세요.
설명, 마크다운 코드블록 없이 순수 JSON 객체만 출력하세요.

{
  "name": "공사명/프로젝트명",
  "siteAddr": "대지 위치/주소",
  "usage": "건축물 용도",
  "scale": "규모 (예: 지하2층/지상15층)",
  "totalFee": "계약금액/용역비 총액 (숫자만, 원 단위)",
  "contractDate": "계약일자 (YYYY-MM-DD)",
  "client": "발주처(갑) 상호명",
  "clientCeo": "발주처 대표자명",
  "clientRegNo": "발주처 사업자등록번호",
  "clientAddr": "발주처 주소",
  "clientTel": "발주처 연락처"
}
금액은 쉼표·단위 없이 숫자만(원 단위)으로 변환하세요. 명시되지 않은 항목은 빈 문자열로 두세요.`

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{
            role: "user",
            content: [contentBlock, { type:"text", text:"이 계약서에서 정보를 추출하여 JSON으로만 응답하세요." }]
          }]
        })
      })
      if(!res.ok) throw new Error(`서버 응답 오류 (${res.status})`)
      const json = await res.json()
      const text = json.content?.[0]?.text || ""
      const cleaned = text.replace(/```json|```/g, "").trim()
      setParsed(JSON.parse(cleaned))
      setStatus("done")
    } catch(e) {
      setStatus("error")
      setErrorMsg(e.message?.includes("Failed to fetch")
        ? "서버 연결 오류입니다. Vercel에 ANTHROPIC_API_KEY가 설정되어 있는지 확인하세요."
        : `분석 오류: ${e.message}`)
    }
  }


  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
      onClick={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div style={{background:"#fff",borderRadius:18,maxWidth:560,width:"100%",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",borderRadius:"18px 18px 0 0",padding:"18px 22px",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,fontWeight:800}}>🤖 계약서 AI 분석</div>
            <div style={{fontSize:12,opacity:.85,marginTop:2}}>업로드하면 계약서 작성 폼에 자동으로 채워줍니다</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",width:28,height:28,borderRadius:"50%",cursor:"pointer",fontSize:15}}>✕</button>
        </div>

        <div style={{padding:22}}>
          {status==="idle" && !parsed && (
            <div>
              <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                border:"2px dashed #C7D2FE",borderRadius:12,padding:"32px 16px",cursor:"pointer",background:file?"#EEF2FF":"#FAFAFA"}}>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" style={{display:"none"}} onChange={e=>handleFile(e.target.files?.[0])}/>
                <span style={{fontSize:34,marginBottom:8}}>{file?"📄":"📤"}</span>
                {file ? (
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:13.5,fontWeight:700,color:"#312E81"}}>{file.name}</div>
                    <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>클릭하여 다른 파일 선택</div>
                  </div>
                ) : (
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:13.5,fontWeight:700,color:"#374151"}}>계약서 파일을 선택하세요</div>
                    <div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>PDF, JPG, PNG 지원</div>
                  </div>
                )}
              </label>
              {preview && <div style={{marginTop:12,borderRadius:8,overflow:"hidden",border:"1px solid #E5E7EB",maxHeight:220}}>
                <img src={preview} alt="미리보기" style={{width:"100%",display:"block",objectFit:"contain"}}/>
              </div>}
              <button onClick={analyze} disabled={!file}
                style={{width:"100%",marginTop:14,padding:"11px",background:file?"linear-gradient(135deg,#6366F1,#8B5CF6)":"#E5E7EB",
                  color:file?"#fff":"#9CA3AF",border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:file?"pointer":"not-allowed"}}>
                ✨ AI로 분석하기
              </button>
            </div>
          )}

          {status==="analyzing" && (
            <div style={{textAlign:"center",padding:"40px 20px"}}>
              <div style={{fontSize:34,marginBottom:14}}>🔍</div>
              <div style={{fontSize:14,fontWeight:700,color:"#374151"}}>AI가 계약서를 분석하는 중...</div>
            </div>
          )}

          {status==="error" && (
            <div style={{background:"#FEE2E2",borderRadius:10,padding:"16px 18px",color:"#991B1B"}}>
              <div style={{fontWeight:700,marginBottom:6}}>⚠ 분석 실패</div>
              <div style={{fontSize:12.5}}>{errorMsg}</div>
              <button onClick={()=>{setStatus("idle");setErrorMsg("")}}
                style={{marginTop:10,padding:"6px 14px",background:"#fff",color:"#991B1B",border:"1px solid #FCA5A5",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                다시 시도
              </button>
            </div>
          )}

          {status==="done" && parsed && (
            <div>
              <div style={{background:"#D1FAE5",borderRadius:9,padding:"9px 13px",marginBottom:14,fontSize:12.5,color:"#065F46",fontWeight:600}}>
                ✅ 분석 완료! 아래 내용을 확인 후 폼에 적용하세요.
              </div>
              <div style={{background:"#F9FAFB",borderRadius:10,border:"1px solid #E5E7EB",padding:"14px 16px",fontSize:13,lineHeight:1.9}}>
                <div><strong>공사명:</strong> {parsed.name||"-"}</div>
                <div><strong>대지위치:</strong> {parsed.siteAddr||"-"}</div>
                <div><strong>용도/규모:</strong> {parsed.usage||"-"} / {parsed.scale||"-"}</div>
                <div><strong>계약금액:</strong> {fA(parsed.totalFee)}</div>
                <div><strong>계약일자:</strong> {parsed.contractDate||"-"}</div>
                <div><strong>발주처:</strong> {parsed.client||"-"} ({parsed.clientCeo||"-"})</div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:16}}>
                <button onClick={()=>{setStatus("idle");setParsed(null)}}
                  style={{padding:"9px 16px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:9,fontSize:12.5,fontWeight:600,cursor:"pointer"}}>
                  다시 분석
                </button>
                <button onClick={()=>onApply(parsed)}
                  style={{flex:1,padding:"9px",background:"linear-gradient(135deg,#059669,#10B981)",color:"#fff",border:"none",borderRadius:9,fontSize:13.5,fontWeight:800,cursor:"pointer"}}>
                  📥 계약서 폼에 적용
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 프로젝트 히스토리 페이지 (나무위키 스타일) ─────────────────────────
function ProjectHistoryPage({projects, currentUser, cashItems=[]}) {
  const [selId,   setSelId]   = useState(projects[0]?.id||"")
  const [viewMode,setViewMode]= useState("category") // "category" | "date"
  const [showAll, setShowAll] = useState(false)      // 전체 프로젝트 통합 보기
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({date:"", category:"일정", title:"", memo:""})

  const CATEGORIES = ["일정","계약","월수금","주간보고","실행계획서","설계변경","공문","기타"]
  const CAT_ICON = {"일정":"📅","계약":"📝","월수금":"💧","주간보고":"📋","실행계획서":"📊","설계변경":"⚙️","공문":"📨","기타":"📌"}
  const CAT_COLOR = {"일정":"#6366F1","계약":"#059669","월수금":"#0891B2","주간보고":"#7C3AED","실행계획서":"#D97706","설계변경":"#D97706","공문":"#374151","기타":"#9CA3AF"}

  const proj = projects.find(p=>p.id===selId)
  const wr   = proj?.weeklyReport || {}

  // 저장된 수동 히스토리 (localStorage per project)
  const LS_KEY = `sjs_history_${selId}`
  const [manualEvts, setManualEvts] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem(LS_KEY)||"[]") }catch{ return [] }
  })
  useEffect(()=>{
    try{ const d=JSON.parse(localStorage.getItem(`sjs_history_${selId}`)||"[]"); setManualEvts(d) }catch{}
  },[selId])

  const saveManual = (list) => {
    setManualEvts(list)
    try{ localStorage.setItem(`sjs_history_${selId}`, JSON.stringify(list)) }catch{}
  }

  const addHistory = () => {
    if(!addForm.date||!addForm.title.trim()) return
    const newEvt = {...addForm, id:`H${Date.now()}`, createdAt:new Date().toISOString(), createdBy:currentUser?.name||""}
    saveManual([...manualEvts, newEvt])
    setAddForm({date:"", category:"일정", title:"", memo:""})
    setShowAdd(false)
  }

  const delHistory = (id) => {
    if(window.confirm("삭제하시겠습니까?")) saveManual(manualEvts.filter(e=>e.id!==id))
  }

  // 자동 수집 이벤트
  const autoEvts = useMemo(()=>{
    if(!proj) return []
    const evts = []
    // 주요 일정 로그
    ;(wr.scheduleLog||[]).forEach(e=>evts.push({date:e.date,category:"일정",title:e.content,memo:e.memo,auto:true}))
    // 실행계획서 버전
    ;(proj.versions||[]).forEach(v=>evts.push({date:v.date,category:"실행계획서",title:`${v.ver} — ${v.reason||"작성"}`,memo:`직접비 ${fE((v.laborCost||0)/1e8)} · 외주비 ${fE((v.subContract||0)/1e8)}`,auto:true}))
    // AGENDA
    ;(wr.agendas||[]).forEach(ag=>(ag.items||[]).forEach(item=>evts.push({date:ag.week,category:"주간보고",title:item.text?.split("\n")[0]?.slice(0,60)||"",memo:item.done?"✅ 완료":null,auto:true})))
    // 월수금 입금내역
    const projCash = cashItems.filter(i=>{
      const nm = (s=>(s||"").replace(/[\s\-_·.\(\)【】\[\]]/g,"").toLowerCase())
      const pn = nm(proj.name); const ci = nm(i.projectName)
      return pn&&ci&&(pn===ci||pn.includes(ci.slice(0,Math.min(ci.length,8)))||ci.includes(pn.slice(0,Math.min(pn.length,8))))
    })
    projCash.forEach(i=>{
      if(i.paidDate) evts.push({date:i.paidDate,category:"월수금",title:`기성 입금 — ${i.stage||""}`,memo:`${i.amount>=1e8?(i.amount/1e8).toFixed(2)+"억":Math.round(i.amount/1e4)+"만원"}`,auto:true})
      else if(i.expectedDate) evts.push({date:i.expectedDate,category:"월수금",title:`기성 예정 — ${i.stage||""}`,memo:`${i.amount>=1e8?(i.amount/1e8).toFixed(2)+"억":Math.round(i.amount/1e4)+"만원"}`,auto:true})
    })
    return evts.filter(e=>e.date)
  },[proj,wr,cashItems])

  // 전체 이벤트
  const allEvts = useMemo(()=>[...autoEvts,...manualEvts]
    .filter(e=>e.date)
    .sort((a,b)=>b.date.localeCompare(a.date)) // 최신순
  ,[autoEvts,manualEvts])

  // 카테고리별 그룹
  const byCategory = useMemo(()=>{
    const map = {}
    allEvts.forEach(e=>{
      const c=e.category||"기타"
      if(!map[c]) map[c]=[]
      map[c].push(e)
    })
    return map
  },[allEvts])


  if(!proj) return <div style={{padding:60,textAlign:"center",color:"#9CA3AF"}}>프로젝트를 선택하세요.</div>

  return (
    <div style={{maxWidth:960,margin:"0 auto"}}>
      {/* 헤더 */}
      <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"16px 20px",marginBottom:14,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{fontSize:17,fontWeight:800,color:"#111827"}}>📜 프로젝트 히스토리</div>
        <select value={selId} onChange={e=>setSelId(e.target.value)}
          disabled={showAll}
          style={{flex:1,maxWidth:380,padding:"8px 12px",border:"1.5px solid #E5E7EB",borderRadius:9,fontSize:14,fontFamily:"inherit",outline:"none",
            opacity:showAll?0.4:1,cursor:showAll?"not-allowed":"pointer"}}>
          {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{display:"flex",gap:4,background:"#F3F4F6",borderRadius:8,padding:3,marginLeft:"auto"}}>
          {[["category","📂 카테고리별"],["date","📅 날짜순"]].map(([v,l])=>(
            <button key={v} onClick={()=>{setViewMode(v);setShowAll(false)}}
              style={{padding:"6px 14px",border:"none",borderRadius:6,fontSize:13,fontWeight:viewMode===v&&!showAll?700:400,cursor:"pointer",
                background:viewMode===v&&!showAll?"#6366F1":"none",color:viewMode===v&&!showAll?"#fff":"#6B7280"}}>
              {l}
            </button>
          ))}
          <button onClick={()=>setShowAll(v=>!v)}
            style={{padding:"6px 14px",border:"none",borderRadius:6,fontSize:13,fontWeight:showAll?700:400,cursor:"pointer",
              background:showAll?"#D97706":"none",color:showAll?"#fff":"#6B7280"}}>
            🌐 전체 프로젝트
          </button>
        </div>
        {!showAll&&(
        <button onClick={()=>setShowAdd(v=>!v)}
          style={{padding:"8px 16px",background:"#6366F1",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>
          {showAdd?"✕ 취소":"+ 히스토리 추가"}
        </button>
        )}
      </div>

      {/* 프로젝트 정보 배너 - 전체 보기 시 숨김 */}
      {!showAll&&(
      <div style={{background:"linear-gradient(135deg,#312E81,#6366F1)",borderRadius:14,padding:"14px 20px",marginBottom:14,color:"#fff",display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
        <div>
          <div style={{fontSize:14,fontWeight:800,marginBottom:4}}>{proj.name}</div>
          <div style={{fontSize:12,opacity:.8}}>{(proj.depts||[]).join(", ")} · {proj.type||"-"} · {proj.contractDate||proj.contractExpect||"일정 미정"}</div>
        </div>
        <div style={{display:"flex",gap:14,marginLeft:"auto",flexWrap:"wrap"}}>
          {[["총 이벤트",allEvts.length+"건"],["수동 추가",manualEvts.length+"건"],["자동 수집",autoEvts.length+"건"]].map(([k,v])=>(
            <div key={k} style={{textAlign:"center"}}>
              <div style={{fontSize:11,opacity:.7}}>{k}</div>
              <div style={{fontSize:16,fontWeight:800}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* 전체 프로젝트 보기 안내 배너 */}
      {showAll&&(
      <div style={{background:"linear-gradient(135deg,#92400E,#D97706)",borderRadius:14,padding:"14px 20px",marginBottom:14,color:"#fff",display:"flex",gap:16,alignItems:"center"}}>
        <span style={{fontSize:24}}>🌐</span>
        <div>
          <div style={{fontSize:15,fontWeight:800,marginBottom:3}}>전체 프로젝트 통합 히스토리</div>
          <div style={{fontSize:12,opacity:.85}}>모든 프로젝트의 이벤트를 날짜순으로 통합하여 표시합니다.</div>
        </div>
      </div>
      )}
      {showAdd&&(
        <div style={{background:"#EEF2FF",borderRadius:14,border:"2px solid #6366F1",padding:"18px 20px",marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:800,color:"#312E81",marginBottom:14}}>✏ 히스토리 항목 추가</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>날짜 *</label>
              <input type="date" value={addForm.date} onChange={e=>setAddForm(p=>({...p,date:e.target.value}))} style={INP()}/>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>카테고리</label>
              <select value={addForm.category} onChange={e=>setAddForm(p=>({...p,category:e.target.value}))} style={INP()}>
                {CATEGORIES.map(c=><option key={c} value={c}>{CAT_ICON[c]} {c}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>제목 *</label>
              <input value={addForm.title} onChange={e=>setAddForm(p=>({...p,title:e.target.value}))} placeholder="히스토리 내용" style={INP()}/>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>메모</label>
            <input value={addForm.memo} onChange={e=>setAddForm(p=>({...p,memo:e.target.value}))} placeholder="상세 내용 (선택)" style={INP()}/>
          </div>
          <button onClick={addHistory}
            style={{padding:"9px 22px",background:"#6366F1",color:"#fff",border:"none",borderRadius:9,fontSize:14,fontWeight:700,cursor:"pointer"}}>
            💾 저장
          </button>
        </div>
      )}

      {/* ── 전체 프로젝트 통합 보기 ── */}
      {showAll&&(()=>{
        // 모든 프로젝트의 자동 이벤트 + 수동 이벤트 수집
        const allProjEvts = []
        projects.forEach(p=>{
          const pwr = p.weeklyReport||{}
          // 수동 히스토리
          try{
            const manual = JSON.parse(localStorage.getItem(`sjs_history_${p.id}`)||"[]")
            manual.forEach(e=>allProjEvts.push({...e, projName:p.name, projId:p.id, projType:p.type}))
          }catch{}
          // 자동: 실행계획서
          ;(p.versions||[]).forEach(v=>allProjEvts.push({date:v.date,category:"실행계획서",title:v.ver,memo:`${v.reason||"작성"}`,projName:p.name,projId:p.id,projType:p.type,auto:true}))
          // 자동: 일정 로그
          ;(pwr.scheduleLog||[]).forEach(e=>allProjEvts.push({date:e.date,category:"일정",title:e.content,memo:e.memo,projName:p.name,projId:p.id,projType:p.type,auto:true}))
          // 자동: 월수금
          const pCash = cashItems.filter(i=>{
            const nm=s=>(s||"").replace(/[\s\-_·.\(\)【】\[\]]/g,"").toLowerCase()
            const pn=nm(p.name);const ci=nm(i.projectName)
            return pn&&ci&&(pn===ci||pn.includes(ci.slice(0,8))||ci.includes(pn.slice(0,8)))
          })
          pCash.forEach(i=>{
            const d=i.paidDate||i.expectedDate
            if(d) allProjEvts.push({date:d,category:"월수금",title:`${i.stage||"기성"} ${i.paidDate?"입금":"예정"}`,
              memo:`${i.amount>=1e8?(i.amount/1e8).toFixed(2)+"억":Math.round(i.amount/1e4)+"만원"}`,
              projName:p.name,projId:p.id,projType:p.type,auto:true})
          })
        })
        const sorted = allProjEvts.filter(e=>e.date).sort((a,b)=>b.date.localeCompare(a.date))

        // 연도별 그룹
        const byYear = {}
        sorted.forEach(e=>{const yr=(e.date||"").slice(0,4)||"미정";if(!byYear[yr])byYear[yr]=[];byYear[yr].push(e)})
        const CAT_COLOR2 = {"일정":"#6366F1","계약":"#059669","월수금":"#0891B2","주간보고":"#7C3AED","실행계획서":"#D97706","설계변경":"#D97706","공문":"#374151","기타":"#9CA3AF"}
        const CAT_ICON2  = {"일정":"📅","계약":"📝","월수금":"💧","주간보고":"📋","실행계획서":"📊","설계변경":"⚙️","공문":"📨","기타":"📌"}

        return (
          <div>
            <div style={{background:"#FEF3C7",borderRadius:12,padding:"10px 16px",marginBottom:12,border:"1px solid #D97706",fontSize:13,color:"#92400E",fontWeight:600}}>
              🌐 전체 프로젝트 통합 히스토리 — {sorted.length}건 · 최신순
            </div>
            {Object.entries(byYear).sort((a,b)=>b[0].localeCompare(a[0])).map(([yr,evts])=>(
              <div key={yr} style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:12}}>
                <div style={{padding:"10px 20px",background:"#F8FAFC",borderBottom:"1px solid #E5E7EB",fontSize:15,fontWeight:800,color:"#312E81"}}>
                  {yr}년 ({evts.length}건)
                </div>
                {evts.map((e,i)=>{
                  const cc=CAT_COLOR2[e.category||"기타"]||"#9CA3AF"
                  return (
                    <div key={e.id||i} style={{padding:"10px 20px",borderBottom:"1px solid #F3F4F6",display:"flex",gap:10,alignItems:"flex-start"}}>
                      <div style={{minWidth:80,fontSize:12,color:"#6B7280",fontWeight:600,flexShrink:0,paddingTop:2}}>{e.date}</div>
                      <div style={{width:3,background:cc,borderRadius:2,alignSelf:"stretch",flexShrink:0,minHeight:20}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:2}}>
                          <span style={{fontSize:11,fontWeight:700,padding:"1px 7px",borderRadius:10,background:cc+"18",color:cc,flexShrink:0}}>{CAT_ICON2[e.category||"기타"]} {e.category||"기타"}</span>
                          <span style={{fontSize:11,background:"#F3F4F6",color:"#374151",padding:"1px 7px",borderRadius:10,fontWeight:600,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{e.projName}</span>
                          <span style={{fontSize:13,fontWeight:600,color:"#111827"}}>{e.title}</span>
                        </div>
                        {e.memo&&<div style={{fontSize:12,color:"#6B7280"}}>{e.memo}</div>}
                      </div>
                      {e.auto&&<span style={{fontSize:10,background:"#EEF2FF",color:"#6366F1",padding:"2px 6px",borderRadius:8,fontWeight:600,flexShrink:0}}>자동</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })()}

      {/* 내용 없음 */}
      {!showAll&&allEvts.length===0&&(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"48px",textAlign:"center",color:"#9CA3AF"}}>
          <div style={{fontSize:32,marginBottom:8}}>📜</div>
          <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>히스토리가 없습니다</div>
          <div style={{fontSize:13}}>+ 히스토리 추가 버튼으로 기록을 시작하세요.</div>
        </div>
      )}

      {/* ── 카테고리별 보기 ── */}
      {!showAll&&viewMode==="category"&&allEvts.length>0&&(
        <div>
          {/* 목차 (나무위키 스타일) */}
          <div style={{background:"#FAFAFA",borderRadius:12,border:"1px solid #E5E7EB",padding:"14px 18px",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:800,color:"#374151",marginBottom:10}}>📋 목차</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"4px 24px"}}>
              {Object.keys(byCategory).map((cat,i)=>(
                <a key={cat} href={`#hist-cat-${cat}`}
                  style={{fontSize:13,color:"#6366F1",textDecoration:"none",fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:11,color:"#9CA3AF"}}>{i+1}.</span>
                  {CAT_ICON[cat]||"📌"} {cat} ({byCategory[cat].length}건)
                </a>
              ))}
            </div>
          </div>

          {/* 카테고리별 섹션 */}
          {Object.entries(byCategory).map(([cat,evts],ci)=>(
            <div key={cat} id={`hist-cat-${cat}`} style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:12}}>
              {/* 카테고리 헤더 */}
              <div style={{padding:"12px 20px",borderBottom:"1px solid #E5E7EB",display:"flex",alignItems:"center",gap:10,background:`${CAT_COLOR[cat]||"#6B7280"}0D`}}>
                <span style={{fontSize:20}}>{CAT_ICON[cat]||"📌"}</span>
                <div style={{fontSize:15,fontWeight:800,color:CAT_COLOR[cat]||"#374151"}}>{cat}</div>
                <div style={{fontSize:13,color:"#6B7280",fontWeight:600}}>{evts.length}건</div>
                <div style={{fontSize:11,color:"#9CA3AF",marginLeft:"auto"}}>{ci+1}.</div>
              </div>
              {/* 이벤트 목록 */}
              <div>
                {evts.map((e,i)=>(
                  <div key={e.id||i} style={{padding:"12px 20px",borderBottom:i<evts.length-1?"1px solid #F3F4F6":"none",display:"flex",gap:14,alignItems:"flex-start"}}>
                    <div style={{minWidth:90,fontSize:12,color:"#6B7280",fontWeight:600,paddingTop:2,flexShrink:0}}>{e.date}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13.5,fontWeight:600,color:"#111827",marginBottom:e.memo?4:0}}>{e.title}</div>
                      {e.memo&&<div style={{fontSize:12,color:"#6B7280",lineHeight:1.5}}>{e.memo}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                      {e.auto&&<span style={{fontSize:10,background:"#EEF2FF",color:"#6366F1",padding:"2px 7px",borderRadius:10,fontWeight:600}}>자동</span>}
                      {e.createdBy&&<span style={{fontSize:11,color:"#9CA3AF"}}>{e.createdBy}</span>}
                      {!e.auto&&<button onClick={()=>delHistory(e.id)}
                        style={{padding:"2px 8px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:6,fontSize:11,cursor:"pointer"}}>삭제</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 날짜순 보기 ── */}
      {!showAll&&viewMode==="date"&&allEvts.length>0&&(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid #E5E7EB",fontSize:14,fontWeight:700,color:"#374151"}}>
            전체 {allEvts.length}건 — 최신순
          </div>
          {/* 연도별 그룹 */}
          {(()=>{
            const byYear = {}
            allEvts.forEach(e=>{
              const yr = (e.date||"").slice(0,4)||"미정"
              if(!byYear[yr]) byYear[yr]=[]
              byYear[yr].push(e)
            })
            return Object.entries(byYear).sort((a,b)=>b[0].localeCompare(a[0])).map(([yr,evts])=>(
              <div key={yr}>
                <div style={{padding:"10px 20px",background:"#F8FAFC",borderBottom:"1px solid #E5E7EB",fontSize:14,fontWeight:800,color:"#312E81"}}>
                  {yr}년 ({evts.length}건)
                </div>
                {evts.map((e,i)=>{
                  const cc = CAT_COLOR[e.category||"기타"]||"#9CA3AF"
                  return (
                    <div key={e.id||i} style={{padding:"11px 20px",borderBottom:"1px solid #F3F4F6",display:"flex",gap:12,alignItems:"flex-start"}}>
                      <div style={{minWidth:80,fontSize:12,color:"#6B7280",fontWeight:600,paddingTop:3,flexShrink:0}}>{e.date}</div>
                      <div style={{width:3,minHeight:40,background:cc,borderRadius:2,flexShrink:0,alignSelf:"stretch"}}/>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                          <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10,background:cc+"18",color:cc}}>
                            {CAT_ICON[e.category||"기타"]||"📌"} {e.category||"기타"}
                          </span>
                          <span style={{fontSize:13.5,fontWeight:600,color:"#111827"}}>{e.title}</span>
                        </div>
                        {e.memo&&<div style={{fontSize:12,color:"#6B7280",marginLeft:0,lineHeight:1.5}}>{e.memo}</div>}
                      </div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                        {e.auto&&<span style={{fontSize:10,background:"#EEF2FF",color:"#6366F1",padding:"2px 7px",borderRadius:10,fontWeight:600}}>자동</span>}
                        {e.createdBy&&<span style={{fontSize:11,color:"#9CA3AF"}}>{e.createdBy}</span>}
                        {!e.auto&&<button onClick={()=>delHistory(e.id)}
                          style={{padding:"2px 8px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:6,fontSize:11,cursor:"pointer"}}>삭제</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          })()}
        </div>
      )}
    </div>
  )
}

// ── 경영분석 탭 상단에 공지 5개 미리보기 삽입 (AnalysisNoticeBar) ──
export function AnalysisNoticeBar() {
  const notices = loadNotices().slice(0,5)
  if(!notices.length) return null
  return (
    <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"12px 18px",marginBottom:14,boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
      <div style={{fontSize:13,fontWeight:800,color:"#DC2626",marginBottom:8}}>📢 최신 공지</div>
      {notices.map(n=>(
        <div key={n.id} style={{display:"flex",gap:8,alignItems:"center",padding:"5px 0",borderBottom:"1px solid #F3F4F6"}}>
          {n.important&&<span style={{fontSize:11,fontWeight:700,color:"#DC2626",flexShrink:0}}>●</span>}
          <span style={{flex:1,fontSize:13.5,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</span>
          <span style={{fontSize:11,color:"#9CA3AF",flexShrink:0}}>{n.createdAt?.slice(0,10)}</span>
          <span style={{fontSize:11,color:"#9CA3AF",flexShrink:0}}>👁{n.views||0}</span>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 📈 사용 통계 시각화
// ══════════════════════════════════════════════════════════════
const STAT_KEY = "sjs_usage_stats"
export function trackUsage(tabId, action="view") {
  try {
    const stats = JSON.parse(localStorage.getItem(STAT_KEY)||"{}")
    const key = `${tabId}:${action}`
    const today = new Date().toISOString().slice(0,10)
    if(!stats[key]) stats[key]={total:0,daily:{}}
    stats[key].total = (stats[key].total||0)+1
    stats[key].daily[today] = (stats[key].daily[today]||0)+1
    localStorage.setItem(STAT_KEY, JSON.stringify(stats))
  } catch{}
}

function StatsTab({projects}) {
  const [stats] = useState(()=>{ try{ return JSON.parse(localStorage.getItem(STAT_KEY)||"{}") }catch{return{}} })

  // 탭별 조회수 집계
  const tabStats = useMemo(()=>{
    const TAB_LABELS = {analysis:"경영분석",deptdash:"본부별현황",projects:"프로젝트",vendors:"협력업체",cashflow:"월수금",contract:"계약서",history:"히스토리",calendar:"캘린더",archive:"아카이브",manual:"업무매뉴얼",datahub:"데이터관리",notice:"공지사항",pnl:"손익분석",stats:"통계",gamify:"게이미피케이션"}
    return Object.entries(TAB_LABELS).map(([id,label])=>{
      const v = stats[`${id}:view`]?.total||0
      const e = stats[`${id}:edit`]?.total||0
      return {id,label,view:v,edit:e,total:v+e}
    }).sort((a,b)=>b.total-a.total)
  },[stats])

  const maxTotal = Math.max(...tabStats.map(t=>t.total),1)

  // 최근 7일 일별 접속
  const last7 = useMemo(()=>{
    const days = Array.from({length:7},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-6+i)
      return d.toISOString().slice(0,10)
    })
    return days.map(date=>{
      let cnt=0
      Object.values(stats).forEach(s=>{ cnt+=(s.daily?.[date]||0) })
      return {date:date.slice(5),cnt}
    })
  },[stats])

  const maxDay = Math.max(...last7.map(d=>d.cnt),1)

  return (
    <div style={{maxWidth:960,margin:"0 auto"}}>
      <div style={{background:"linear-gradient(135deg,#312E81,#6366F1)",borderRadius:16,padding:"20px 26px",marginBottom:16,color:"#fff"}}>
        <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>📈 시스템 사용 통계</div>
        <div style={{fontSize:13,opacity:.8}}>메뉴별 조회·수정 횟수 · 일별 접속 추이 · 시스템 개선 기초 데이터</div>
      </div>

      {/* 최근 7일 접속 */}
      <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"20px 24px",marginBottom:14}}>
        <div style={{fontSize:16,fontWeight:800,color:"#111827",marginBottom:16}}>📅 최근 7일 사용량</div>
        <div style={{display:"flex",gap:8,alignItems:"flex-end",height:100}}>
          {last7.map(d=>(
            <div key={d.date} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:11,fontWeight:700,color:"#6366F1"}}>{d.cnt||""}</div>
              <div style={{width:"100%",background:d.cnt>0?"#6366F1":"#E5E7EB",borderRadius:"4px 4px 0 0",height:`${Math.max((d.cnt/maxDay)*80,d.cnt>0?4:2)}px`,transition:"height .3s"}}/>
              <div style={{fontSize:11,color:"#6B7280"}}>{d.date}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 메뉴별 사용 통계 */}
      <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"20px 24px",marginBottom:14}}>
        <div style={{fontSize:16,fontWeight:800,color:"#111827",marginBottom:16}}>🏆 메뉴별 사용 순위</div>
        {tabStats.map((t,i)=>(
          <div key={t.id} style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
            <div style={{width:22,fontSize:13,fontWeight:800,color:i<3?["#D97706","#9CA3AF","#D85A30"][i]:"#9CA3AF",textAlign:"center"}}>{i+1}</div>
            <div style={{width:90,fontSize:13.5,fontWeight:600,color:"#374151",flexShrink:0}}>{t.label}</div>
            <div style={{flex:1,height:20,background:"#F3F4F6",borderRadius:10,overflow:"hidden",position:"relative"}}>
              <div style={{position:"absolute",left:0,top:0,bottom:0,background:"#6366F1",borderRadius:10,width:`${(t.view/maxTotal)*100}%`,opacity:.7}}/>
              <div style={{position:"absolute",left:`${(t.view/maxTotal)*100}%`,top:0,bottom:0,background:"#059669",borderRadius:10,width:`${(t.edit/maxTotal)*100}%`,opacity:.8}}/>
            </div>
            <div style={{fontSize:12,color:"#6B7280",width:80,textAlign:"right",flexShrink:0}}>
              조회 <b style={{color:"#6366F1"}}>{t.view}</b> · 수정 <b style={{color:"#059669"}}>{t.edit}</b>
            </div>
          </div>
        ))}
        <div style={{display:"flex",gap:12,marginTop:8,fontSize:12,color:"#6B7280"}}>
          <span>■ <span style={{color:"#6366F1"}}>파란색</span> = 조회수</span>
          <span>■ <span style={{color:"#059669"}}>초록색</span> = 수정수</span>
        </div>
      </div>

      {/* 프로젝트 통계 */}
      <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"20px 24px"}}>
        <div style={{fontSize:16,fontWeight:800,color:"#111827",marginBottom:14}}>🏗 프로젝트 현황 요약</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {[
            ["전체 프로젝트",projects.length+"건","#6366F1"],
            ["진행중",projects.filter(p=>p.type==="계약"||p.type==="확정").length+"건","#059669"],
            ["등록 협력업체",new Set(projects.flatMap(p=>(p.versions[p.versions.length-1]?.vendors||[]).map(v=>v.name))).size+"개","#D97706"],
            ["총 용역비합",`${(projects.reduce((s,p)=>s+(p.serviceFee||0),0)/1e8).toFixed(1)}억`,"#4F46E5"],
          ].map(([label,val,color])=>(
            <div key={label} style={{background:color+"12",borderRadius:12,padding:"16px",border:`1px solid ${color}33`,textAlign:"center"}}>
              <div style={{fontSize:24,fontWeight:800,color,marginBottom:4}}>{val}</div>
              <div style={{fontSize:13,color:"#6B7280"}}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 🎮 게이미피케이션 — 직원별 포인트·랭킹
// ══════════════════════════════════════════════════════════════
const GAMIFY_KEY = "sjs_gamify"
const loadGamify = ()=>{ try{ return JSON.parse(localStorage.getItem(GAMIFY_KEY)||"{}") }catch{return{}} }

// 포인트 규칙
const POINT_RULES = [
  {action:"project_created",   label:"프로젝트 개설",       pts:50,  icon:"🏗"},
  {action:"version_uploaded",  label:"실행계획서 등록",      pts:30,  icon:"📋"},
  {action:"schedule_added",    label:"주요일정 기록",        pts:10,  icon:"📅"},
  {action:"doc_archived",      label:"문서 아카이브",        pts:20,  icon:"📁"},
  {action:"vendor_doc_added",  label:"협력업체 문서 등록",   pts:15,  icon:"🤝"},
  {action:"cashflow_updated",  label:"수금실적 입력",        pts:10,  icon:"💧"},
  {action:"manual_edited",     label:"업무매뉴얼 편집",      pts:25,  icon:"📚"},
  {action:"notice_posted",     label:"공지사항 등록",        pts:20,  icon:"📢"},
]

export function addGamifyPoint(userName, action) {
  try {
    const rule = POINT_RULES.find(r=>r.action===action)
    if(!rule||!userName) return
    const data = loadGamify()
    if(!data[userName]) data[userName]={name:userName,total:0,history:[],badge:""}
    data[userName].total = (data[userName].total||0)+rule.pts
    data[userName].history = [{action,pts:rule.pts,label:rule.label,at:new Date().toISOString()},...(data[userName].history||[])].slice(0,50)
    // 뱃지 부여
    const t=data[userName].total
    data[userName].badge = t>=1000?"🏆 마스터":t>=500?"🥇 골드":t>=200?"🥈 실버":t>=50?"🥉 브론즈":"🌱 신입"
    localStorage.setItem(GAMIFY_KEY, JSON.stringify(data))
  } catch{}
}

function GamifyTab({projects, currentUser}) {
  const [data]    = useState(loadGamify)
  const [selUser, setSelUser] = useState(null)

  const ranking = useMemo(()=>
    Object.values(data).sort((a,b)=>(b.total||0)-(a.total||0))
  ,[data])

  const me = data[currentUser?.name]

  return (
    <div style={{maxWidth:960,margin:"0 auto"}}>
      {/* 헤더 */}
      <div style={{background:"linear-gradient(135deg,#4F46E5,#6366F1)",borderRadius:16,padding:"22px 28px",marginBottom:16,color:"#fff"}}>
        <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>🎮 포인트 & 랭킹</div>
        <div style={{fontSize:13.5,opacity:.85}}>기록할수록, 협업할수록 포인트 상승 · 아카이빙 우수 직원 시각화</div>
        {me&&(
          <div style={{marginTop:14,display:"flex",alignItems:"center",gap:16,background:"rgba(255,255,255,.15)",borderRadius:12,padding:"12px 18px"}}>
            <div style={{fontSize:36}}>{me.badge?.split(" ")[0]||"🌱"}</div>
            <div>
              <div style={{fontSize:16,fontWeight:800}}>{currentUser.name} — {me.badge}</div>
              <div style={{fontSize:14,opacity:.85}}>총 {me.total||0} 포인트</div>
            </div>
          </div>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:14}}>
        {/* 랭킹 */}
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
          <div style={{padding:"16px 20px",borderBottom:"1px solid #F3F4F6",fontSize:16,fontWeight:800}}>🏆 전체 랭킹</div>
          {ranking.length===0
            ?<div style={{padding:"40px",textAlign:"center",color:"#6B7280",fontSize:14}}>
                <div style={{fontSize:40,marginBottom:10}}>🌱</div>
                아직 포인트 기록이 없습니다.<br/>
                문서 등록·실행계획서 업로드 등 활동하면 포인트가 쌓입니다!
              </div>
            :ranking.map((u,i)=>(
              <div key={u.name} onClick={()=>setSelUser(selUser===u.name?null:u.name)}
                style={{display:"flex",alignItems:"center",gap:12,padding:"13px 20px",borderBottom:"1px solid #F3F4F6",cursor:"pointer",background:selUser===u.name?"#EEF2FF":"#fff",transition:"background .12s"}}
                onMouseEnter={e=>{if(selUser!==u.name)e.currentTarget.style.background="#F8FAFC"}}
                onMouseLeave={e=>{if(selUser!==u.name)e.currentTarget.style.background="#fff"}}>
                <div style={{width:32,fontSize:18,fontWeight:800,color:i===0?"#D97706":i===1?"#9CA3AF":i===2?"#D85A30":"#6B7280",textAlign:"center"}}>{i+1}</div>
                <div style={{width:36,height:36,borderRadius:"50%",background:`hsl(${i*47},60%,55%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",flexShrink:0}}>
                  {u.name?.charAt(0)||"?"}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14.5,fontWeight:700,color:"#111827"}}>{u.name} {u.badge}</div>
                  <div style={{fontSize:12,color:"#6B7280",marginTop:2}}>최근: {u.history?.[0]?.label||"-"}</div>
                </div>
                {/* 포인트 바 */}
                <div style={{width:120}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                    <span style={{fontWeight:700,color:"#4F46E5"}}>{u.total||0}pt</span>
                  </div>
                  <div style={{height:6,background:"#F3F4F6",borderRadius:3}}>
                    <div style={{height:"100%",background:"linear-gradient(90deg,#4F46E5,#6366F1)",borderRadius:3,width:`${Math.min((u.total||0)/10,100)}%`}}/>
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {/* 우측: 규칙 + 선택 유저 이력 */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* 포인트 규칙 */}
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"16px 18px"}}>
            <div style={{fontSize:14,fontWeight:800,color:"#111827",marginBottom:12}}>🎯 포인트 획득 방법</div>
            {POINT_RULES.map(r=>(
              <div key={r.action} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                <span style={{fontSize:16,flexShrink:0}}>{r.icon}</span>
                <span style={{flex:1,fontSize:13,color:"#374151"}}>{r.label}</span>
                <span style={{fontSize:13,fontWeight:800,color:"#4F46E5"}}>+{r.pts}pt</span>
              </div>
            ))}
          </div>

          {/* 선택 유저 이력 */}
          {selUser&&data[selUser]&&(
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"16px 18px"}}>
              <div style={{fontSize:14,fontWeight:800,marginBottom:10}}>{selUser} 활동 이력</div>
              {(data[selUser].history||[]).slice(0,10).map((h,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center",fontSize:12.5,marginBottom:6,color:"#374151"}}>
                  <span style={{color:"#9CA3AF",flexShrink:0}}>{h.at?.slice(5,10)}</span>
                  <span style={{flex:1}}>{h.label}</span>
                  <span style={{fontWeight:700,color:"#4F46E5"}}>+{h.pts}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 🏢 본부별 현황 대시보드
// ══════════════════════════════════════════════════════════════
function DeptDashTab({projects, vendorPayments, years}) {
  const {DEPTS, DEPT_COLORS} = useDepts()
  const [selYear, setSelYear] = useState(String(new Date().getFullYear()))

  const yearOpts = useMemo(()=>{
    const ys = new Set(projects.map(p=>p.year||String(new Date().getFullYear())))
    return [...ys].sort().reverse()
  },[projects])

  // 본부별 집계
  const deptStats = useMemo(()=>{
    return DEPTS.map(dept=>{
      // 이 본부가 참여한 프로젝트
      const myProjects = projects.filter(p=>
        (p.depts||[]).includes(dept) || (p.deptShares||[]).some(s=>s.dept===dept)
      )
      // 지분율 반영 계약금액 (수주)
      const contract = myProjects.reduce((s,p)=>{
        const share = (p.deptShares||[]).find(s=>s.dept===dept)?.share||
                      ((p.depts||[]).includes(dept)?100/(p.depts.length||1):0)
        return s + (p.serviceFee||0)*(share/100)
      },0)
      // 지분율 반영 수금 실적
      const cashActual = myProjects.reduce((s,p)=>{
        const share = (p.deptShares||[]).find(s=>s.dept===dept)?.share||
                      ((p.depts||[]).includes(dept)?100/(p.depts.length||1):0)
        const actual = (p.cashflowPlan||[])
          .filter(e=>String(e.year)===selYear)
          .reduce((a,e)=>a+(e.actual||0),0)
        return s + actual*(share/100)
      },0)
      // 지분율 반영 기성 계획
      const cashPlan = myProjects.reduce((s,p)=>{
        const share = (p.deptShares||[]).find(s=>s.dept===dept)?.share||
                      ((p.depts||[]).includes(dept)?100/(p.depts.length||1):0)
        const plan = (p.cashflowPlan||[])
          .filter(e=>String(e.year)===selYear)
          .reduce((a,e)=>a+(e.plan||0),0)
        return s + plan*(share/100)
      },0)
      // 외주비 지출
      const expense = (vendorPayments||[])
        .filter(p2=>myProjects.some(p=>p.id===p2.projectId))
        .reduce((s,p2)=>s+(p2.amount||0),0)

      return {
        dept,
        color: DEPT_COLORS[dept]||"#6366F1",
        projectCount: myProjects.length,
        contract,       // 수주 (억)
        cashPlan,       // 계획기성 (억)
        cashActual,     // 입금실적 (억)
        expense,        // 외주비 지출 (원)
        achieveRate: cashPlan>0 ? Math.round(cashActual/cashPlan*100) : null,
        projects: myProjects,
      }
    }).filter(d=>d.projectCount>0)
  },[DEPTS,DEPT_COLORS,projects,vendorPayments,selYear])

  const totalContract = deptStats.reduce((s,d)=>s+d.contract,0)
  const totalCash     = deptStats.reduce((s,d)=>s+d.cashActual,0)


  return (
    <div>
      {/* 헤더 */}
      <div style={{background:"linear-gradient(135deg,#312E81,#6366F1)",borderRadius:16,padding:"20px 26px",marginBottom:16,color:"#fff"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>🏢 본부별 현황</div>
            <div style={{fontSize:13,opacity:.8}}>본부별 수주·매출(수금)·지출 현황을 한눈에</div>
          </div>
          <select value={selYear} onChange={e=>setSelYear(e.target.value)}
            style={{padding:"8px 14px",borderRadius:9,border:"1.5px solid rgba(255,255,255,.4)",background:"rgba(255,255,255,.15)",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
            {yearOpts.map(y=><option key={y} value={y} style={{color:"#111"}}>{y}년</option>)}
          </select>
        </div>
        {/* 전사 요약 */}
        <div style={{display:"flex",gap:16,marginTop:16,flexWrap:"wrap"}}>
          {[
            ["총 수주","₩ "+fA(totalContract),"💰"],
            ["총 수금 ("+selYear+"년)","₩ "+fA(totalCash),"💧"],
            ["참여 본부",deptStats.length+"개","🏢"],
            ["전체 프로젝트",projects.length+"건","🏗"],
          ].map(([label,val,icon])=>(
            <div key={label} style={{background:"rgba(255,255,255,.15)",borderRadius:12,padding:"12px 18px",minWidth:140}}>
              <div style={{fontSize:12,opacity:.7,marginBottom:4}}>{icon} {label}</div>
              <div style={{fontSize:18,fontWeight:800}}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 본부별 카드 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14,marginBottom:20}}>
        {deptStats.map(d=>(
          <div key={d.dept} style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
            {/* 본부 헤더 */}
            <div style={{background:d.color+"18",borderBottom:`3px solid ${d.color}`,padding:"14px 18px",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:d.color,flexShrink:0}}/>
              <div style={{fontSize:16,fontWeight:800,color:"#111827",flex:1}}>{d.dept}</div>
              <span style={{fontSize:12,padding:"3px 10px",borderRadius:20,background:d.color+"22",color:d.color,fontWeight:700}}>
                {d.projectCount}건
              </span>
            </div>
            {/* 지표 */}
            <div style={{padding:"14px 18px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                {[
                  ["수주 (지분 반영)",fA(d.contract),"#6366F1"],
                  ["계획기성 ("+selYear+")",fA(d.cashPlan),"#6B7280"],
                  ["입금실적 ("+selYear+")",fA(d.cashActual),"#059669"],
                  ["외주비 지출",fA(d.expense),"#DC2626"],
                ].map(([label,val,color])=>(
                  <div key={label} style={{background:"#F8FAFC",borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:11.5,color:"#6B7280",fontWeight:600,marginBottom:3}}>{label}</div>
                    <div style={{fontSize:15,fontWeight:800,color}}>{val}</div>
                  </div>
                ))}
              </div>
              {/* 수금 달성률 */}
              {d.cashPlan>0&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}>
                    <span style={{color:"#6B7280",fontWeight:600}}>수금 달성률</span>
                    <span style={{fontWeight:800,color:d.achieveRate>=100?"#059669":d.achieveRate>=70?"#D97706":"#DC2626"}}>
                      {d.achieveRate}%
                    </span>
                  </div>
                  <div style={{height:8,background:"#F3F4F6",borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:4,
                      background:d.achieveRate>=100?"#059669":d.achieveRate>=70?"#D97706":"#DC2626",
                      width:`${Math.min(d.achieveRate,100)}%`,transition:"width .5s"}}/>
                  </div>
                </div>
              )}
              {/* 프로젝트 목록 */}
              <div style={{marginTop:12,maxHeight:120,overflowY:"auto"}}>
                {d.projects.slice(0,5).map(p=>(
                  <div key={p.id} style={{display:"flex",gap:8,alignItems:"center",padding:"4px 0",borderBottom:"1px solid #F9FAFB"}}>
                    <span style={{fontSize:11.5,fontWeight:600,color:"#374151",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                    <span style={{fontSize:11,color:"#9CA3AF",flexShrink:0}}>{fA(p.serviceFee)}</span>
                  </div>
                ))}
                {d.projects.length>5&&<div style={{fontSize:11,color:"#9CA3AF",paddingTop:4}}>+{d.projects.length-5}건 더</div>}
              </div>
            </div>
          </div>
        ))}
        {deptStats.length===0&&(
          <div style={{gridColumn:"1/-1",background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"48px",textAlign:"center",color:"#6B7280",fontSize:14}}>
            <div style={{fontSize:40,marginBottom:12}}>🏢</div>
            프로젝트에 본부 정보가 입력되면 여기에 표시됩니다.
          </div>
        )}
      </div>

      {/* 본부별 비교 테이블 */}
      {deptStats.length>0&&(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
          <div style={{padding:"16px 20px",borderBottom:"1px solid #E5E7EB",fontSize:15,fontWeight:800,color:"#111827"}}>
            📊 본부별 비교 ({selYear}년 기준)
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#F8FAFC"}}>
                  {["본부","프로젝트","수주(지분반영)","계획기성","입금실적","달성률","외주비"].map(h=>(
                    <th key={h} style={{padding:"11px 14px",textAlign:h==="본부"?"left":"right",fontSize:12.5,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deptStats.map((d,i)=>(
                  <tr key={d.dept} style={{background:i%2===0?"#fff":"#FAFAFA"}}>
                    <td style={{padding:"12px 14px",borderBottom:"1px solid #F3F4F6"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:d.color}}/>
                        <span style={{fontSize:14,fontWeight:700,color:"#111827"}}>{d.dept}</span>
                      </div>
                    </td>
                    <td style={{padding:"12px 14px",textAlign:"right",fontSize:13,color:"#374151",borderBottom:"1px solid #F3F4F6"}}>{d.projectCount}건</td>
                    <td style={{padding:"12px 14px",textAlign:"right",fontSize:13,fontWeight:700,color:"#6366F1",borderBottom:"1px solid #F3F4F6"}}>{fA(d.contract)}</td>
                    <td style={{padding:"12px 14px",textAlign:"right",fontSize:13,color:"#6B7280",borderBottom:"1px solid #F3F4F6"}}>{fA(d.cashPlan)}</td>
                    <td style={{padding:"12px 14px",textAlign:"right",fontSize:13,fontWeight:700,color:"#059669",borderBottom:"1px solid #F3F4F6"}}>{fA(d.cashActual)}</td>
                    <td style={{padding:"12px 14px",textAlign:"right",fontSize:13,fontWeight:700,
                      color:d.achieveRate==null?"#9CA3AF":d.achieveRate>=100?"#059669":d.achieveRate>=70?"#D97706":"#DC2626",
                      borderBottom:"1px solid #F3F4F6"}}>
                      {d.achieveRate!=null?d.achieveRate+"%":"-"}
                    </td>
                    <td style={{padding:"12px 14px",textAlign:"right",fontSize:13,color:"#DC2626",borderBottom:"1px solid #F3F4F6"}}>{fA(d.expense)}</td>
                  </tr>
                ))}
                <tr style={{background:"#EEF2FF",fontWeight:800}}>
                  <td style={{padding:"12px 14px",fontSize:14,color:"#312E81"}}>합계</td>
                  <td style={{padding:"12px 14px",textAlign:"right",fontSize:13}}>{projects.length}건</td>
                  <td style={{padding:"12px 14px",textAlign:"right",fontSize:13,color:"#6366F1"}}>{fA(deptStats.reduce((s,d)=>s+d.contract,0))}</td>
                  <td style={{padding:"12px 14px",textAlign:"right",fontSize:13}}>{fA(deptStats.reduce((s,d)=>s+d.cashPlan,0))}</td>
                  <td style={{padding:"12px 14px",textAlign:"right",fontSize:13,color:"#059669"}}>{fA(deptStats.reduce((s,d)=>s+d.cashActual,0))}</td>
                  <td style={{padding:"12px 14px",textAlign:"right",fontSize:13}}>-</td>
                  <td style={{padding:"12px 14px",textAlign:"right",fontSize:13,color:"#DC2626"}}>{fA(deptStats.reduce((s,d)=>s+d.expense,0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 💧 건별 기성 내역 뷰
// 본부, 발주구분, 신규/기성, 프로젝트명, 기성단계, 입금일/예상일, 금액
// ══════════════════════════════════════════════════════════════
function CashItemsView({cashItems, setCashItems, projects, setProjects, DEPTS, currentUser, itemTotal, itemPaid, itemExp, viewMode:extViewMode, isSale=false, setTab, setSelProjId}) {
  const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"]
  const EMPTY = {dept:"", orderType:"민간", itemType:isSale?"세금계산서":"기성", projectName:"", stage:"", paidDate:"", expectedDate:"", amount:0, memo:""}

  const [form, setForm]       = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]   = useState(null)
  const [filterDept, setFilterDept] = useState("")
  const [filterType, setFilterType] = useState("")
  const [sortBy, setSortBy]   = useState("date")  // date | dept | amount | project
  const [viewMode, setViewMode] = useState("list") // list | monthly | dept | annual
  const [showBulk, setShowBulk] = useState(false)

  const effView = extViewMode==="monthly"?"monthly" : extViewMode==="dept"?"dept" : viewMode

  const u = (k,v) => setForm(p=>({...p,[k]:v}))

  // ── 유사 프로젝트명 정규화 매칭 ──
  const normName = s => (s||"").replace(/[\s\-_·.\(\)【】\[\]「」]/g,"").toLowerCase()
  const findMatchedProj = (itemName) => {
    if(!itemName) return null
    const a = normName(itemName)
    return (projects||[]).find(p => {
      const b = normName(p.name)
      if(a===b) return true
      // 앞부분 8글자 이상 일치
      const minLen = Math.min(a.length, b.length, 8)
      if(minLen>=6 && a.slice(0,minLen)===b.slice(0,minLen)) return true
      // 한쪽이 다른 쪽을 포함
      if(a.length>=6 && b.includes(a)) return true
      if(b.length>=6 && a.includes(b)) return true
      return false
    }) || null
  }

  // 시리얼 날짜 변환
  const fixDate = s => {
    if(!s) return ""
    const n = parseInt(String(s))
    if(!isNaN(n) && n>40000 && n<60000) {
      const d = new Date((n-25569)*86400*1000)
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`
    }
    return String(s).trim()
  }
  const fmtDate = s => { const f=fixDate(s); return f?f.replace(/-/g,"."):"-" }
  const fAmt = n => n>=1e8?`${(n/1e8).toFixed(2)}억`:n>=1e4?`${Math.round(n/1e4)}만`:n>0?n.toLocaleString()+"원":"-"
  const getYM = item => { const d=fixDate(item.paidDate||item.expectedDate); return d?d.slice(0,7):"미정" }

  // 기존 잘못 저장된 시리얼 날짜 자동 수정
  const fixedItems = useMemo(()=>{
    const needFix = cashItems.some(i=>(i.paidDate&&parseInt(i.paidDate)>40000)||(i.expectedDate&&parseInt(i.expectedDate)>40000))
    if(!needFix) return cashItems
    return cashItems.map(i=>({...i, paidDate:fixDate(i.paidDate), expectedDate:fixDate(i.expectedDate)}))
  },[cashItems])
  if(fixedItems!==cashItems) setTimeout(()=>setCashItems(fixedItems),0)
  const items = fixedItems

  const toast = useToast()

  const save = () => {
    if(!form.projectName.trim()||(!form.paidDate&&!form.expectedDate)){
      toast("프로젝트명과 입금일(또는 예상일) 중 하나는 필수입니다.", "error")
      return
    }
    if(editId){
      setCashItems(prev=>prev.map(x=>x.id===editId?{...form,id:editId,updatedAt:new Date().toISOString(),updatedBy:currentUser?.name}:x))
      toast(`✏ "${form.projectName}" 항목이 수정되었습니다.`, "success")
      setEditId(null)
    } else {
      setCashItems(prev=>[...prev,{...form,id:`CI${Date.now()}`,createdAt:new Date().toISOString(),createdBy:currentUser?.name}])
      toast(`✅ "${form.projectName}" 항목이 추가되었습니다.`, "success")
    }
    setForm(EMPTY); setShowForm(false)
  }
  const del = id => {
    const item = items.find(x=>x.id===id)
    if(window.confirm(`"${item?.projectName||"항목"}"을 삭제하시겠습니까?`)){
      setCashItems(prev=>prev.filter(x=>x.id!==id))
      toast(`🗑 "${item?.projectName||"항목"}"이 삭제되었습니다.`, "warning")
    }
  }
  // 수정 시 해당 행 ID 기록 (인라인 표시용)
  const startEdit = item => { setForm({...EMPTY,...item}); setEditId(item.id); setShowForm(false) }

  // 프로젝트 자동완성 목록
  const projNames = [...new Set([...(projects||[]).map(p=>p.name),...items.map(i=>i.projectName)])].filter(Boolean)

  // 필터+정렬
  const filtered = useMemo(()=>{
    let r = [...items]
    if(filterDept) r = r.filter(x=>x.dept===filterDept)
    if(filterType) r = r.filter(x=>x.itemType===filterType)
    r.sort((a,b)=>{
      if(sortBy==="date")    return (fixDate(a.paidDate||a.expectedDate)||"").localeCompare(fixDate(b.paidDate||b.expectedDate)||"")
      if(sortBy==="dept")    return (a.dept||"").localeCompare(b.dept||"")
      if(sortBy==="amount")  return (b.amount||0)-(a.amount||0)
      if(sortBy==="project") return (a.projectName||"").localeCompare(b.projectName||"")
      return 0
    })
    return r
  },[items,filterDept,filterType,sortBy])

  // 월별 그룹
  const byMonth = useMemo(()=>{
    const grp={}
    filtered.forEach(item=>{const ym=getYM(item);if(!grp[ym])grp[ym]=[];grp[ym].push(item)})
    return Object.entries(grp).sort(([a],[b])=>a.localeCompare(b))
  },[filtered])

  // 본부별 그룹
  const byDept = useMemo(()=>{
    const grp={}
    filtered.forEach(item=>{const d=item.dept||"미분류";if(!grp[d])grp[d]=[];grp[d].push(item)})
    return Object.entries(grp).sort(([a],[b])=>a.localeCompare(b))
  },[filtered])

  // 연간 월별 합산 (전체·본부별)
  const annualData = useMemo(()=>{
    const thisYear = new Date().getFullYear()
    const years = [...new Set(items.map(i=>parseInt((fixDate(i.paidDate||i.expectedDate)||"").slice(0,4))).filter(y=>y>2000))].sort()
    if(!years.length) years.push(thisYear)

    return years.map(yr=>{
      const yearItems = items.filter(i=>parseInt((fixDate(i.paidDate||i.expectedDate)||"").slice(0,4))===yr)
      // 월별 전체
      const monthly = MONTHS.map((_,mi)=>{
        const m = String(mi+1).padStart(2,"0")
        const ym = `${yr}-${m}`
        const monthItems = yearItems.filter(i=>getYM(i)===ym)
        const paid = monthItems.filter(i=>i.paidDate).reduce((s,i)=>s+(i.amount||0),0)
        const exp  = monthItems.filter(i=>!i.paidDate&&i.expectedDate).reduce((s,i)=>s+(i.amount||0),0)
        return {month:mi+1,label:`${mi+1}월`,paid,exp,total:paid+exp}
      })
      // 본부별 월별
      const byDeptMonthly = {}
      DEPTS.forEach(dept=>{
        byDeptMonthly[dept] = MONTHS.map((_,mi)=>{
          const m = String(mi+1).padStart(2,"0")
          const ym = `${yr}-${m}`
          const monthItems = yearItems.filter(i=>i.dept===dept&&getYM(i)===ym)
          const paid = monthItems.filter(i=>i.paidDate).reduce((s,i)=>s+(i.amount||0),0)
          const exp  = monthItems.filter(i=>!i.paidDate&&i.expectedDate).reduce((s,i)=>s+(i.amount||0),0)
          return {month:mi+1,label:`${mi+1}월`,paid,exp,total:paid+exp}
        })
      })
      return {yr, monthly, byDeptMonthly, total:yearItems.reduce((s,i)=>s+(i.amount||0),0)}
    })
  },[items,DEPTS])

  const [annualYear, setAnnualYear] = useState(()=>String(new Date().getFullYear()))
  const [annualDept, setAnnualDept] = useState("전체")
  const curAnnual = annualData.find(d=>String(d.yr)===annualYear) || annualData[annualData.length-1]
  const chartData = curAnnual ? (annualDept==="전체" ? curAnnual.monthly : (curAnnual.byDeptMonthly[annualDept]||[])) : []
  const maxBar = Math.max(...(chartData||[]).map(d=>d.total),1)

  const ORDER_COLOR = {민간:"#6366F1", 공공:"#059669", 해외:"#D97706"}
  const TYPE_COLOR  = {신규:"#D97706", 기성:"#6B7280", 정산:"#4F46E5", 세금계산서:"#059669", 확정:"#6366F1", 추진:"#D97706", 미정:"#9CA3AF", 선급금:"#0891B2", 어음:"#7C3AED"}

  const goToProj = (item) => {
    const proj = findMatchedProj(item.projectName)
    if(proj && setTab && setSelProjId){ setSelProjId(proj.id); setTab("projects") }
    else if(!proj) alert(`"${item.projectName}" — 매칭된 프로젝트가 없습니다.\n프로젝트 목록에서 먼저 등록해주세요.`)
  }

  return (
    <div>
      {/* KPI 카드 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {[["전체 건수",items.length+"건","#6366F1"],["총 금액",fAmt(itemTotal),"#312E81"],["입금 완료",fAmt(itemPaid),"#059669"],["입금 예정",fAmt(itemExp),"#D97706"]].map(([l,v,c])=>(
          <div key={l} style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"14px 16px",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
            <div style={{fontSize:12,color:"#6B7280",fontWeight:600,marginBottom:4}}>{l}</div>
            <div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* 툴바 */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"12px 16px",marginBottom:14,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        {/* 뷰 전환 */}
        <div style={{display:"flex",gap:2,background:"#F3F4F6",borderRadius:8,padding:3}}>
          {[["list","📋 목록"],["monthly","📅 월별"],["dept","🏢 본부별"],["annual","📊 연간현황"]].map(([v,l])=>(
            <button key={v} onClick={()=>setViewMode(v)}
              style={{padding:"5px 12px",border:"none",borderRadius:6,fontSize:12.5,fontWeight:viewMode===v?700:400,cursor:"pointer",
                background:viewMode===v?"#fff":"none",color:viewMode===v?isSale?"#059669":"#6366F1":"#6B7280"}}>
              {l}
            </button>
          ))}
        </div>
        {/* 필터 */}
        <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} style={{...INP(),width:120,padding:"6px 10px",fontSize:12.5}}>
          <option value="">전체 본부</option>
          {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{...INP(),width:100,padding:"6px 10px",fontSize:12.5}}>
          <option value="">전체 구분</option>
          {(isSale?["세금계산서","선급금"]:["기성","확정","미정","추진","신규","정산","선급금","어음"]).map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        {/* 정렬 */}
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{...INP(),width:110,padding:"6px 10px",fontSize:12.5}}>
          <option value="date">날짜순</option>
          <option value="project">프로젝트순</option>
          <option value="dept">본부순</option>
          <option value="amount">금액순</option>
        </select>
        <span style={{fontSize:12,color:"#9CA3AF"}}>{filtered.length}건</span>
        <button onClick={()=>{setForm(EMPTY);setEditId(null);setShowForm(v=>!v)}}
          style={{marginLeft:"auto",padding:"8px 16px",background:isSale?"#059669":"#6366F1",color:"#fff",border:"none",borderRadius:9,fontSize:13.5,fontWeight:700,cursor:"pointer"}}>
          {showForm&&!editId?"✕ 닫기":"+ "+(isSale?"매출내역":"기성내역")+" 추가"}
        </button>
        {!isSale&&<button onClick={()=>setShowBulk(v=>!v)}
          style={{padding:"8px 14px",background:showBulk?"#374151":"#1E293B",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>
          📋 {showBulk?"대량입력 닫기":"대량입력"}
        </button>}
      </div>

      {/* 대량 입력 도구 */}
      {showBulk&&!isSale&&(
        <BulkInputTool
          DEPTS={DEPTS}
          projects={projects}
          onSave={newRows=>{
            const now = new Date().toISOString()
            setCashItems(prev=>[...prev,...newRows.map(r=>({
              ...r,
              id:`CI${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
              createdAt:now,
              createdBy:currentUser?.name||"",
            }))])
            setShowBulk(false)
          }}
          onClose={()=>setShowBulk(false)}
        />
      )}
        <div style={{background:"#EEF2FF",borderRadius:14,border:"1.5px solid #6366F133",padding:"18px 20px",marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:800,color:"#6366F1",marginBottom:14}}>{editId?"✏ 수정":"+ 추가"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>
            <div><label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>본부 *</label>
              <select value={form.dept} onChange={e=>u("dept",e.target.value)} style={INP()}><option value="">선택</option>{DEPTS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
            <div><label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>발주구분</label>
              <select value={form.orderType} onChange={e=>u("orderType",e.target.value)} style={INP()}>{["민간","공공","해외"].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div><label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>구분</label>
              <select value={form.itemType} onChange={e=>u("itemType",e.target.value)} style={INP()}>
                {(isSale?["세금계산서","선급금"]:["기성","확정","미정","추진","신규","정산","선급금","어음"]).map(t=><option key={t} value={t}>{t}</option>)}
              </select></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div><label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>프로젝트명 *</label>
              <input list="proj-list-ci" value={form.projectName} onChange={e=>u("projectName",e.target.value)} placeholder="프로젝트명" style={INP()}/>
              <datalist id="proj-list-ci">{projNames.map(n=><option key={n} value={n}/>)}</datalist>
              {form.projectName&&!findMatchedProj(form.projectName)&&<div style={{fontSize:11,color:"#D97706",marginTop:3}}>⚠ 프로젝트 목록에 없는 이름 — 유사명 자동매칭 시도됩니다</div>}
            </div>
            <div><label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>기성단계</label>
              <input value={form.stage} onChange={e=>u("stage",e.target.value)} placeholder="예: 1차 기성, 준공후" style={INP()}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
            <div><label style={{fontSize:12,fontWeight:700,color:"#059669",display:"block",marginBottom:4}}>✅ 입금완료일</label>
              <input type="date" value={form.paidDate} onChange={e=>u("paidDate",e.target.value)} style={INP()}/></div>
            <div><label style={{fontSize:12,fontWeight:700,color:"#D97706",display:"block",marginBottom:4}}>📅 입금예상일</label>
              <input type="date" value={form.expectedDate} onChange={e=>u("expectedDate",e.target.value)} style={INP()}/></div>
            <div><label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>금액 (원) *</label>
              <input type="number" value={form.amount||""} onChange={e=>u("amount",parseInt(e.target.value)||0)} placeholder="예: 3900000" style={INP()}/>
              {form.amount>0&&<div style={{fontSize:12,color:"#6366F1",marginTop:3}}>= {fAmt(form.amount)}</div>}</div>
          </div>
          <div style={{marginBottom:12}}><label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>메모</label>
            <input value={form.memo} onChange={e=>u("memo",e.target.value)} placeholder="추가 메모" style={INP()}/></div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={save} style={{padding:"10px 22px",background:"#6366F1",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>{editId?"수정 저장":"저장"}</button>
            <button onClick={()=>{setShowForm(false);setEditId(null);setForm(EMPTY)}} style={{padding:"10px 16px",background:"#F3F4F6",color:"#374151",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>취소</button>
          </div>
        </div>
      )}

      {/* ── 📊 연간현황 뷰 ── */}
      {viewMode==="annual"&&(
        <div>
          {/* 연도·본부 선택 */}
          <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:2,background:"#F3F4F6",borderRadius:8,padding:3}}>
              {annualData.map(d=>(
                <button key={d.yr} onClick={()=>setAnnualYear(String(d.yr))}
                  style={{padding:"5px 13px",border:"none",borderRadius:6,fontSize:13,fontWeight:String(d.yr)===annualYear?700:400,cursor:"pointer",
                    background:String(d.yr)===annualYear?"#fff":"none",color:String(d.yr)===annualYear?"#6366F1":"#6B7280"}}>
                  {d.yr}년
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:2,background:"#F3F4F6",borderRadius:8,padding:3}}>
              {["전체",...DEPTS].map(d=>(
                <button key={d} onClick={()=>setAnnualDept(d)}
                  style={{padding:"5px 12px",border:"none",borderRadius:6,fontSize:12.5,fontWeight:annualDept===d?700:400,cursor:"pointer",
                    background:annualDept===d?"#fff":"none",color:annualDept===d?"#6366F1":"#6B7280"}}>
                  {d}
                </button>
              ))}
            </div>
            {curAnnual&&<span style={{fontSize:13,color:"#6B7280",marginLeft:"auto"}}>연간합계: <strong style={{color:"#312E81"}}>{fAmt(curAnnual.total)}</strong></span>}
          </div>

          {/* 월별 바 차트 */}
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"20px 24px",marginBottom:14}}>
            <div style={{fontSize:15,fontWeight:800,color:"#111827",marginBottom:16}}>
              📊 {annualYear}년 월별 {isSale?"매출":"수금"} 현황 — {annualDept}
            </div>
            <div style={{display:"flex",gap:6,alignItems:"flex-end",minHeight:220,borderBottom:"2px solid #E5E7EB",paddingBottom:4,overflow:"visible"}}>
              {(chartData||[]).map((d,i)=>{
                const paidH = maxBar>0?Math.round((d.paid/maxBar)*140):0
                const expH  = maxBar>0?Math.round((d.exp/maxBar)*140):0
                const total = d.paid+d.exp
                return (
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:0}}>
                    {total>0&&<div style={{fontSize:10,fontWeight:700,color:"#312E81",textAlign:"center",whiteSpace:"nowrap"}}>
                      {total>=1e8?(total/1e8).toFixed(1)+"억":Math.round(total/1e4)+"만"}
                    </div>}
                    <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                      {expH>0&&<div style={{width:"70%",height:expH,background:"#D97706",borderRadius:"3px 3px 0 0",opacity:.8}}/>}
                      {paidH>0&&<div style={{width:"70%",height:paidH,background:"#059669",borderRadius:expH>0?"0":"3px 3px 0 0"}}/>}
                      {total===0&&<div style={{width:"70%",height:4,background:"#E5E7EB",borderRadius:2}}/>}
                    </div>
                    <div style={{fontSize:10.5,color:"#6B7280",marginTop:3}}>{d.label}</div>
                  </div>
                )
              })}
            </div>
            <div style={{display:"flex",gap:16,marginTop:10,fontSize:12,color:"#6B7280"}}>
              <span><span style={{display:"inline-block",width:10,height:10,background:"#059669",borderRadius:2,marginRight:5}}/>입금 완료</span>
              <span><span style={{display:"inline-block",width:10,height:10,background:"#D97706",borderRadius:2,marginRight:5,opacity:.8}}/>입금 예정</span>
            </div>
          </div>

          {/* 월별 상세 테이블 */}
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#F8FAFC"}}>
                  <th style={{padding:"10px 14px",textAlign:"left",fontSize:12.5,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB"}}>월</th>
                  <th style={{padding:"10px 14px",textAlign:"right",fontSize:12.5,fontWeight:700,color:"#059669",borderBottom:"2px solid #E5E7EB"}}>입금 완료</th>
                  <th style={{padding:"10px 14px",textAlign:"right",fontSize:12.5,fontWeight:700,color:"#D97706",borderBottom:"2px solid #E5E7EB"}}>입금 예정</th>
                  <th style={{padding:"10px 14px",textAlign:"right",fontSize:12.5,fontWeight:700,color:"#312E81",borderBottom:"2px solid #E5E7EB"}}>합계</th>
                  <th style={{padding:"10px 14px",textAlign:"left",fontSize:12.5,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB"}}>프로젝트</th>
                </tr>
              </thead>
              <tbody>
                {(chartData||[]).filter(d=>d.total>0).map((d,i)=>{
                  const ym = `${annualYear}-${String(d.month).padStart(2,"0")}`
                  const monthItems = items.filter(item=>getYM(item)===ym&&(annualDept==="전체"||item.dept===annualDept))
                  return (
                    <tr key={i} style={{borderBottom:"1px solid #F3F4F6"}}>
                      <td style={{padding:"10px 14px",fontSize:14,fontWeight:700,color:"#374151"}}>{d.label}</td>
                      <td style={{padding:"10px 14px",textAlign:"right",fontSize:13.5,fontWeight:700,color:"#059669"}}>{d.paid>0?fAmt(d.paid):"-"}</td>
                      <td style={{padding:"10px 14px",textAlign:"right",fontSize:13.5,fontWeight:600,color:"#D97706"}}>{d.exp>0?fAmt(d.exp):"-"}</td>
                      <td style={{padding:"10px 14px",textAlign:"right",fontSize:14,fontWeight:800,color:"#312E81"}}>{fAmt(d.total)}</td>
                      <td style={{padding:"10px 14px",fontSize:12}}>
                        {monthItems.slice(0,3).map((item,j)=>(
                          <span key={j} onClick={()=>goToProj(item)}
                            style={{display:"inline-block",background:"#EEF2FF",color:"#6366F1",borderRadius:6,padding:"2px 7px",margin:"1px 2px",fontSize:11.5,cursor:"pointer",fontWeight:600}}
                            title={item.projectName}>
                            {item.projectName.slice(0,12)}{item.projectName.length>12?"…":""}
                          </span>
                        ))}
                        {monthItems.length>3&&<span style={{fontSize:11,color:"#9CA3AF"}}>+{monthItems.length-3}건</span>}
                      </td>
                    </tr>
                  )
                })}
                <tr style={{background:"#EEF2FF",fontWeight:700}}>
                  <td style={{padding:"10px 14px",fontSize:13.5,color:"#312E81"}}>연간 합계</td>
                  <td style={{padding:"10px 14px",textAlign:"right",fontSize:14,color:"#059669"}}>{fAmt((chartData||[]).reduce((s,d)=>s+d.paid,0))}</td>
                  <td style={{padding:"10px 14px",textAlign:"right",fontSize:14,color:"#D97706"}}>{fAmt((chartData||[]).reduce((s,d)=>s+d.exp,0))}</td>
                  <td style={{padding:"10px 14px",textAlign:"right",fontSize:15,color:"#312E81"}}>{fAmt((chartData||[]).reduce((s,d)=>s+d.total,0))}</td>
                  <td/>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 📋 목록 뷰 ── */}
      {viewMode==="list"&&(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
          {filtered.length===0
            ?<div style={{padding:"48px",textAlign:"center",color:"#6B7280"}}>
                <div style={{fontSize:36,marginBottom:10}}>💧</div>
                기성내역을 추가하거나 엑셀 업로드를 이용해주세요.
              </div>
            :<table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#F8FAFC"}}>
                  {["본부","발주","구분","프로젝트명","기성단계","입금완료일","입금예상일","금액",""].map((h,i)=>(
                    <th key={i} style={{padding:"10px 12px",textAlign:i>=7?"right":"left",fontSize:12.5,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(()=>{
                  // 기성 / 확정 / 추진 그룹 분리
                  const 기성List  = filtered.filter(x=>x.paidDate)
                  const 확정List  = filtered.filter(x=>!x.paidDate&&x.expectedDate&&x.itemType!=="추진")
                  const 추진List  = filtered.filter(x=>x.itemType==="추진"||(!x.paidDate&&!x.expectedDate&&x.itemType==="추진"))
                  const 기타List  = filtered.filter(x=>!x.paidDate&&!x.expectedDate&&x.itemType!=="추진")
                  const SECS = [
                    {label:"✅ 기성 (입금 완료)", color:"#059669", bg:"#D1FAE5", items:기성List},
                    {label:"📅 확정 (입금 예정)", color:"#6366F1", bg:"#EEF2FF", items:확정List},
                    {label:"🔶 추진", color:"#D97706", bg:"#FEF3C7", items:추진List},
                  ].filter(s=>s.items.length>0)
                  if(기타List.length>0) SECS.push({label:"기타", color:"#6B7280", bg:"#F3F4F6", items:기타List})

                  const COLS = 9
                  const rows = []
                  SECS.forEach(({label,color,bg,items})=>{
                    // 구분 헤더
                    rows.push(<tr key={"hdr-"+label} style={{background:bg,borderTop:"2px solid "+color}}>
                      <td colSpan={COLS} style={{padding:"8px 14px",fontSize:13,fontWeight:800,color}}>
                        {label} — {items.length}건 · {fAmt(items.reduce((s,x)=>s+(x.amount||0),0))}
                      </td>
                    </tr>)
                    items.forEach((item,i)=>{
                      const matched = findMatchedProj(item.projectName)
                      rows.push(
                        <tr key={item.id} style={{background:i%2===0?"#fff":"#FAFAFA",borderBottom:"1px solid #F3F4F6"}}>
                          <td style={{padding:"9px 12px",fontSize:12.5,fontWeight:700,color:"#374151",whiteSpace:"nowrap"}}>{item.dept||"-"}</td>
                          <td style={{padding:"9px 10px"}}>
                            <span style={{fontSize:11.5,padding:"2px 7px",borderRadius:20,background:(ORDER_COLOR[item.orderType]||"#6B7280")+"18",color:ORDER_COLOR[item.orderType]||"#6B7280",fontWeight:700}}>{item.orderType||"-"}</span>
                          </td>
                          <td style={{padding:"9px 10px"}}>
                            <span style={{fontSize:11.5,padding:"2px 7px",borderRadius:20,background:(TYPE_COLOR[item.itemType]||"#6B7280")+"18",color:TYPE_COLOR[item.itemType]||"#6B7280",fontWeight:700}}>{item.itemType||"-"}</span>
                          </td>
                          <td style={{padding:"9px 12px",minWidth:180,maxWidth:280,wordBreak:"keep-all",whiteSpace:"normal",lineHeight:1.4}}>
                            <span onClick={()=>goToProj(item)}
                              style={{fontSize:13.5,fontWeight:600,color:matched?"#6366F1":"#111827",cursor:matched?"pointer":"default",textDecoration:matched?"underline":"none"}}>
                              {item.projectName}
                              {matched&&matched.name!==item.projectName&&<span style={{fontSize:10,color:"#9CA3AF",marginLeft:4,display:"block"}}>≈ {matched.name}</span>}
                            </span>
                          </td>
                          <td style={{padding:"9px 12px",fontSize:12,color:"#6B7280",whiteSpace:"nowrap"}}>{item.stage||"-"}</td>
                          <td style={{padding:"9px 12px",fontSize:12.5,color:"#059669",fontWeight:item.paidDate?700:400,whiteSpace:"nowrap"}}>
                            {item.paidDate?<>✅ {fmtDate(item.paidDate)}</>:"-"}
                          </td>
                          <td style={{padding:"9px 12px",fontSize:12.5,color:"#D97706",fontWeight:item.expectedDate?600:400,whiteSpace:"nowrap"}}>
                            {item.expectedDate?<>📅 {fmtDate(item.expectedDate)}</>:"-"}
                          </td>
                          <td style={{padding:"9px 12px",textAlign:"right",fontSize:14,fontWeight:800,color:"#312E81",whiteSpace:"nowrap"}}>{fAmt(item.amount||0)}</td>
                          <td style={{padding:"9px 8px",whiteSpace:"nowrap"}}>
                            <div style={{display:"flex",gap:4}}>
                              <button onClick={()=>startEdit(item)} style={{padding:"3px 8px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:6,fontSize:11.5,fontWeight:600,cursor:"pointer"}}>{editId===item.id?"✕ 취소":"✏ 수정"}</button>
                              <button onClick={()=>del(item.id)} style={{padding:"3px 8px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:6,fontSize:11.5,fontWeight:600,cursor:"pointer"}}>🗑 삭제</button>
                            </div>
                          </td>
                      </tr>
                    )
                    // 인라인 수정 폼
                    if(editId===item.id) rows.push(
                      <tr key={item.id+"-edit"}>
                        <td colSpan={9} style={{padding:"12px 16px",background:"#EEF2FF",borderBottom:"2px solid #6366F1"}}>
                          <InlineEditForm form={form} setForm={setForm} DEPTS={DEPTS} projNames={projNames} isSale={isSale} onSave={save} onCancel={()=>{setEditId(null);setForm(EMPTY)}}/>
                        </td>
                      </tr>
                    )
                    })
                    // 소계 행
                    rows.push(<tr key={"sub-"+label} style={{background:bg}}>
                      <td colSpan={7} style={{padding:"9px 14px",fontSize:13,fontWeight:700,color}}>{label.split(" ")[1]||label} 소계</td>
                      <td style={{padding:"9px 14px",textAlign:"right",fontSize:13.5,fontWeight:800,color}}>{fAmt(items.reduce((s,x)=>s+(x.amount||0),0))}</td>
                      <td/>
                    </tr>)
                  })
                  // 총합계
                  rows.push(<tr key="total" style={{background:"#EEF2FF",borderTop:"2px solid #6366F1"}}>
                    <td colSpan={7} style={{padding:"11px 14px",fontSize:14,fontWeight:800,color:"#312E81"}}>총 합계 ({filtered.length}건)</td>
                    <td style={{padding:"11px 14px",textAlign:"right",fontSize:15,fontWeight:800,color:"#312E81"}}>{fAmt(filtered.reduce((s,x)=>s+(x.amount||0),0))}</td>
                    <td/>
                  </tr>)
                  return rows
                })()}
              </tbody>
            </table>
          }
        </div>
      )}

      {/* ── 📅 월별 뷰 ── */}
      {viewMode==="monthly"&&(
        <div>
          {byMonth.length===0&&<div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"48px",textAlign:"center",color:"#6B7280"}}>데이터 없음</div>}
          {byMonth.map(([ym,monthItems])=>{
            const monthTotal = monthItems.reduce((s,x)=>s+(x.amount||0),0)
            const paidCnt  = monthItems.filter(x=>x.paidDate).length
            const expCnt   = monthItems.filter(x=>!x.paidDate&&x.expectedDate).length
            const ymLabel  = /^\d{4}-\d{2}$/.test(ym) ? ym.slice(0,4)+"년 "+parseInt(ym.slice(5))+"월" : (ym==="미정"?"날짜 미정":ym)
            return (
              <div key={ym} style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",marginBottom:12,overflow:"hidden"}}>
                <div style={{background:"#F8FAFC",padding:"12px 18px",borderBottom:"1px solid #E5E7EB",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:15,fontWeight:800,color:"#111827"}}>📆 {ymLabel}</div>
                  <div style={{fontSize:13,color:"#059669",fontWeight:600}}>✅ 완료 {paidCnt}건</div>
                  <div style={{fontSize:13,color:"#D97706",fontWeight:600}}>📅 예정 {expCnt}건</div>
                  <div style={{marginLeft:"auto",fontSize:16,fontWeight:800,color:"#312E81"}}>{fAmt(monthTotal)}</div>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <tbody>
                    {monthItems.map((item,i)=>(
                      <tr key={item.id} style={{borderBottom:"1px solid #F9FAFB",background:i%2===0?"#fff":"#FAFAFA"}}>
                        <td style={{padding:"9px 14px",fontSize:12.5,fontWeight:700,color:"#374151",width:120}}>{item.dept||"-"}</td>
                        <td style={{padding:"9px 10px",width:50}}><span style={{fontSize:11,padding:"2px 6px",borderRadius:10,background:(ORDER_COLOR[item.orderType]||"#6B7280")+"18",color:ORDER_COLOR[item.orderType]||"#6B7280",fontWeight:700}}>{item.orderType}</span></td>
                        <td style={{padding:"9px 10px",width:50}}><span style={{fontSize:11,padding:"2px 6px",borderRadius:10,background:(TYPE_COLOR[item.itemType]||"#6B7280")+"18",color:TYPE_COLOR[item.itemType]||"#6B7280",fontWeight:700}}>{item.itemType}</span></td>
                        <td style={{padding:"9px 10px",fontSize:13.5,fontWeight:600,color:"#111827",cursor:"pointer"}} onClick={()=>goToProj(item)}>{item.projectName}</td>
                        <td style={{padding:"9px 10px",fontSize:12.5,color:"#6B7280"}}>{item.stage||""}</td>
                        <td style={{padding:"9px 10px",fontSize:12.5,color:item.paidDate?"#059669":"#D97706",fontWeight:600,whiteSpace:"nowrap"}}>
                          {item.paidDate?`✅ ${fmtDate(item.paidDate)}`:item.expectedDate?`📅 ${fmtDate(item.expectedDate)}`:"-"}
                        </td>
                        <td style={{padding:"9px 14px",textAlign:"right",fontSize:14,fontWeight:800,color:"#312E81",whiteSpace:"nowrap"}}>{fAmt(item.amount||0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 🏢 본부별 뷰 ── */}
      {viewMode==="dept"&&(
        <div>
          {byDept.length===0&&<div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"48px",textAlign:"center",color:"#6B7280"}}>데이터 없음</div>}
          {byDept.map(([dept,deptItems])=>{
            const deptTotal = deptItems.reduce((s,x)=>s+(x.amount||0),0)
            const paidAmt   = deptItems.filter(x=>x.paidDate).reduce((s,x)=>s+(x.amount||0),0)
            const expAmt    = deptItems.filter(x=>!x.paidDate&&x.expectedDate).reduce((s,x)=>s+(x.amount||0),0)
            return (
              <div key={dept} style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",marginBottom:12,overflow:"hidden"}}>
                <div style={{padding:"14px 18px",borderBottom:"2px solid #E5E7EB",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#111827",flex:1}}>{dept}</div>
                  <span style={{fontSize:13,color:"#059669",fontWeight:600}}>✅ {fAmt(paidAmt)}</span>
                  <span style={{fontSize:13,color:"#D97706",fontWeight:600}}>📅 {fAmt(expAmt)}</span>
                  <span style={{fontSize:16,fontWeight:800,color:"#312E81"}}>합계 {fAmt(deptTotal)}</span>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{background:"#F8FAFC"}}>
                      {["발주","구분","프로젝트명","기성단계","입금완료일","입금예상일","금액"].map((h,i)=>(
                        <th key={i} style={{padding:"8px 12px",textAlign:i===6?"right":"left",fontSize:12,fontWeight:700,color:"#6B7280",borderBottom:"1px solid #E5E7EB"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deptItems.map((item,i)=>(
                      <tr key={item.id} style={{borderBottom:"1px solid #F9FAFB",background:i%2===0?"#fff":"#FAFAFA"}}>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:11.5,padding:"2px 7px",borderRadius:10,background:(ORDER_COLOR[item.orderType]||"#6B7280")+"18",color:ORDER_COLOR[item.orderType]||"#6B7280",fontWeight:700}}>{item.orderType}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:11.5,padding:"2px 7px",borderRadius:10,background:(TYPE_COLOR[item.itemType]||"#6B7280")+"18",color:TYPE_COLOR[item.itemType]||"#6B7280",fontWeight:700}}>{item.itemType}</span></td>
                        <td style={{padding:"9px 12px",fontSize:13.5,fontWeight:600,color:"#111827",cursor:"pointer"}} onClick={()=>goToProj(item)}>{item.projectName}</td>
                        <td style={{padding:"9px 12px",fontSize:12.5,color:"#6B7280"}}>{item.stage||"-"}</td>
                        <td style={{padding:"9px 12px",fontSize:12.5,color:"#059669",fontWeight:item.paidDate?600:400}}>{item.paidDate?`✅ ${fmtDate(item.paidDate)}`:"-"}</td>
                        <td style={{padding:"9px 12px",fontSize:12.5,color:"#D97706",fontWeight:item.expectedDate?600:400}}>{item.expectedDate?`📅 ${fmtDate(item.expectedDate)}`:"-"}</td>
                        <td style={{padding:"9px 14px",textAlign:"right",fontSize:14,fontWeight:800,color:"#312E81",whiteSpace:"nowrap"}}>{fAmt(item.amount||0)}</td>
                      </tr>
                    ))}
                    <tr style={{background:"#EEF2FF"}}>
                      <td colSpan={6} style={{padding:"10px 12px",fontSize:13.5,fontWeight:700,color:"#312E81"}}>소계</td>
                      <td style={{padding:"10px 14px",textAlign:"right",fontSize:15,fontWeight:800,color:"#312E81"}}>{fAmt(deptTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function downloadCashTemplate(type="cash") {
  const isSale = type==="sale"
  const title  = isSale ? "매출(세금계산서)" : "월수금(기성)"

  const ws = XLSX.utils.aoa_to_sheet([
    [`■ 상지서울 통합경영시스템 — ${title} 입력 양식`],
    ["※ 4행부터 데이터 입력. 금액은 원(₩) 단위 숫자만 입력."],
    [],
    ["본부","발주구분","구분","프로젝트명","기성단계/내역","입금완료일(YYYY-MM-DD)","입금예상일(YYYY-MM-DD)","금액(원)","메모"],
    // 예시 행
    ["설계1본부","공공", isSale?"세금계산서":"기성","우즈베키스탄 제약클러스터","1차 감리단계 DA건축 정산","2026-01-06","",1000000,""],
    ["설계1본부","민간", isSale?"세금계산서":"기성","쿠팡 울산Sub-HUB 신축","준공후","2026-01-13","",3900000,""],
    ["설계2본부","공공", isSale?"세금계산서":"신규","서산시 시청사 설계용역","기본설계 납품 후","","2026-03-31",8000000,""],
  ])
  ws["!cols"] = [{wch:14},{wch:10},{wch:12},{wch:30},{wch:25},{wch:18},{wch:18},{wch:14},{wch:20}]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title)
  XLSX.writeFile(wb, `상지서울_${title}_입력양식.xlsx`)
}

function uploadCashExcel(e, type, cashItems, setCashItems, saleItems, setSaleItems, DEPTS, currentUser) {
  const file = e.target.files?.[0]; if(!file) return
  const isSale = type==="sale"

  const toDateStr = (val) => {
    if(!val && val!==0) return ""
    const s = String(val).trim()
    if(!s) return ""
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    if(/^\d{4}\.\d{2}\.\d{2}$/.test(s)) return s.replace(/\./g, "-")
    if(/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, "-")
    const n = parseInt(s)
    if(!isNaN(n) && n > 40000 && n < 60000) {
      const d = new Date((n - 25569) * 86400 * 1000)
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`
    }
    if(/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
    return s
  }

  const reader = new FileReader()
  reader.onload = ev => {
    try {
      const wb   = XLSX.read(ev.target.result, {type:"binary"})
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""})

      // 헤더 행 찾기 (프로젝트명 컬럼이 있는 행)
      let headerRow = 2  // 기본 3행(0-indexed 2)
      let dataStart = 3
      for(let i=0;i<Math.min(rows.length,6);i++){
        if(rows[i].some(c=>String(c).includes("프로젝트명")||String(c).includes("프로젝트"))){
          headerRow=i; dataStart=i+1; break
        }
      }
      const headers = rows[headerRow].map(h=>String(h).trim())

      // 컬럼 인덱스 찾기 — 정확 매칭 우선, 없으면 포함 매칭
      const colIdx = (names) => {
        // 1순위: 정확히 일치
        for(const n of names){ const i=headers.findIndex(h=>h===n||h===n.replace(/[\(\)]/g,"")); if(i>=0)return i }
        // 2순위: 포함 (단, 더 짧은 이름이 더 긴 헤더에 걸리지 않도록 exact word 우선)
        for(const n of names){ const i=headers.findIndex(h=>h.startsWith(n)||h===n); if(i>=0)return i }
        // 3순위: 느슨한 포함
        for(const n of names){ const i=headers.findIndex(h=>h.includes(n)); if(i>=0)return i }
        return -1
      }
      const CI = {
        dept:        colIdx(["본부"]),
        orderType:   colIdx(["발주구분"]),
        itemType:    colIdx(["구분"]).toString()==="1" ? 2 : colIdx(["구분"]),  // "발주구분"(1)과 구분 필요
        projectName: colIdx(["프로젝트명"]),
        stage:       colIdx(["기성단계","단계/내역","기성단계/내역"]),
        paidDate:    colIdx(["입금완료일","완료일"]),
        expectedDate:colIdx(["입금예상일","예상일"]),
        amount:      colIdx(["금액"]),
        memo:        colIdx(["메모","비고"]),
        id:          colIdx(["시스템ID","[시스템ID"]),
      }
      // itemType 정확 보정: "발주구분"(index1)이 아닌 "구분"(index2) 이어야 함
      if(CI.itemType === CI.orderType) {
        CI.itemType = headers.findIndex((h,i)=>i!==CI.orderType&&(h==="구분"||h==="항목구분"||h.endsWith("구분")))
        if(CI.itemType<0) CI.itemType = CI.orderType+1  // fallback
      }

      const get = (r,k) => CI[k]>=0 ? r[CI[k]] : ""

      const data = rows.slice(dataStart).filter(r => {
        const pname = get(r,"projectName")
        if(!pname || !String(pname).trim()) return false
        if(String(pname).startsWith("※")) return false
        // 헤더 중복행 필터링 (프로젝트명 컬럼에 "프로젝트명" 텍스트가 있으면 헤더행)
        if(String(pname).includes("프로젝트명")) return false
        // 금액이 0이고 본부도 "본부"인 경우 (헤더 중복)
        const dept = String(get(r,"dept")||"").trim()
        if(dept==="본부" && String(pname).trim()==="프로젝트명") return false
        return true
      })

      const newItems = data.map(r => {
        const existingId = String(get(r,"id")||"").trim()
        // ID가 있으면 기존 항목 업데이트용으로 사용, 없으면 새 ID 생성
        const id = existingId && existingId!=="[시스템ID-수정금지]"
          ? existingId
          : `CI${Date.now()}_${Math.random().toString(36).slice(2,7)}`
        return {
          id,
          dept:        String(get(r,"dept")||"").trim(),
          orderType:   String(get(r,"orderType")||"민간").trim(),
          itemType:    String(get(r,"itemType")||"기성").trim(),
          projectName: String(get(r,"projectName")||"").trim(),
          stage:       String(get(r,"stage")||"").trim(),
          paidDate:    toDateStr(get(r,"paidDate")),
          expectedDate:toDateStr(get(r,"expectedDate")),
          amount:      parseInt(String(get(r,"amount")||"0").replace(/[^0-9]/g,""))||0,
          memo:        String(get(r,"memo")||"").trim(),
          createdAt:   new Date().toISOString(),
          createdBy:   currentUser?.name||"",
          fromExcel:   true,
        }
      }).filter(x=>x.projectName)

      if(newItems.length===0){alert("입력된 데이터가 없습니다.\n프로젝트명 컬럼이 있는 행부터 입력하세요.");return}

      // 중복 처리: ID가 있으면 ID 기준 업데이트, 없으면 내용 기준 중복 체크
      // makeKey에 날짜 포함 → 같은 프로젝트도 입금예상일이 다르면 별개 항목
      const existList = isSale?saleItems:cashItems
      const makeKey = item => {
        const date = item.paidDate||item.expectedDate||""
        return `${item.dept}|${item.projectName}|${item.stage}|${item.amount}|${date.slice(0,7)}`
      }
      const existById  = new Set(existList.map(x=>x.id).filter(Boolean))
      const existByKey = new Set(existList.map(makeKey))

      const updateItems = newItems.filter(x=>existById.has(x.id))
      const dupByKey    = newItems.filter(x=>!existById.has(x.id)&&existByKey.has(makeKey(x)))
      const freshItems  = newItems.filter(x=>!existById.has(x.id)&&!existByKey.has(makeKey(x)))

      // 유사 프로젝트명 중복 감지
      const normName = s => (s||"").replace(/[\s\-_·.\(\)【】\[\]]/g,"").toLowerCase()
      const similarGroups = {}
      freshItems.forEach(item=>{
        const an = normName(item.projectName)
        const similar = freshItems.filter(x=>x!==item&&normName(x.projectName).slice(0,8)===an.slice(0,8))
        if(similar.length>0&&an.length>4){
          const key = an.slice(0,8)
          if(!similarGroups[key]) similarGroups[key]=new Set()
          similarGroups[key].add(item.projectName)
          similar.forEach(x=>similarGroups[key].add(x.projectName))
        }
      })
      const similarMsg = Object.values(similarGroups).map(s=>[...s]).filter(g=>g.length>1)

      let msg = `총 ${newItems.length}건 업로드 예정\n✅ 신규: ${freshItems.length}건`
      if(updateItems.length>0) msg += `\n🔄 ID기준 업데이트: ${updateItems.length}건`
      if(dupByKey.length>0)    msg += `\n⚠ 내용중복(덮어쓰기): ${dupByKey.length}건`
      if(similarMsg.length>0)  msg += `\n\n🔍 유사 프로젝트명 발견 (동일 프로젝트일 수 있음):\n${similarMsg.map(g=>`· ${g.join(" vs ")}`).slice(0,3).join("\n")}`

      if(window.confirm(msg)){
        // 업로드 전 현재 데이터 localStorage 백업
        const backupKey = `sjs_backup_${isSale?"sale":"cash"}_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}`
        try{
          const currentData = isSale?saleItems:cashItems
          if(currentData.length>0){
            localStorage.setItem(backupKey, JSON.stringify(currentData))
            console.log(`💾 백업 저장: ${backupKey} (${currentData.length}건)`)
          }
        }catch(e){ console.warn("백업 저장 실패:", e) }

        const setter = isSale?setSaleItems:setCashItems
        setter(prev=>{
          // ID기준 업데이트 + 내용중복 덮어쓰기 + 신규 추가
          let next = prev.filter(x=>
            !updateItems.some(u=>u.id===x.id) &&
            !dupByKey.some(d=>makeKey(d)===makeKey(x))
          )
          return [...next, ...newItems]
        })
        alert(`✓ 완료: 신규 ${freshItems.length}건 추가, 업데이트 ${updateItems.length}건, 중복교체 ${dupByKey.length}건\n\n💾 이전 데이터는 브라우저 로컬에 자동 백업됐습니다.\n   관리자도구 콘솔 → localStorage.getItem("${backupKey}")`)
      }
    } catch(err){ alert("업로드 오류: "+err.message) }
    e.target.value=""
  }
  reader.readAsBinaryString(file)
}

// ══════════════════════════════════════════════════════════════
// 📊 경영 대시보드 — 계약·매출·지출 현황
// ══════════════════════════════════════════════════════════════
function AnalysisDashboard({projects, cashItems, saleItems, DEPTS, DEPT_COLORS, DEPT_BIZ, deptStaff, years, contractItems=[], yearTargets={}}) {
  /* ═══════════════════════════════════════════════════════════
   * 단위 규칙 (UNIT RULES) — 절대 변경 금지
   * ───────────────────────────────────────────────────────────
   * contractItems.serviceFeeExpect : 원(₩) 단위로 저장
   *   예) 17.55억 → 1755000000 (원)
   *   표시: /1e8 → 17.55억
   *
   * cashItems.amount               : 원(₩) 단위로 저장
   *   표시: /1e8 → 억원
   *
   * deptBiz.orderDone/conf/push    : 억원 단위로 저장
   *   예) 17.55 → 17.55억 (그대로 표시)
   *
   * fA (AnalysisDashboard 내)      : 억원 단위 값을 받아 표시
   *   contractByDept.done/conf/push: 반드시 억원 단위
   * ═══════════════════════════════════════════════════════════ */
  const {STAFF_DEPTS} = useDepts()
  const now      = new Date()
  const thisYear = String(now.getFullYear())
  const thisMonth= now.getMonth() + 1
  const MONTHS   = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"]

  // ── yearTargets에서 연간 목표 (월수금현황과 동일한 소스) ──
  const YR_TARGETS = yearTargets[Number(thisYear)] || yearTargets[thisYear] || {salesTarget:145, contractTarget:170}
  const SALES_TARGET    = (YR_TARGETS.salesTarget    || 0)       // 억원
  const CONTRACT_TARGET = (YR_TARGETS.contractTarget || 0)       // 억원

  const totalStaff = (STAFF_DEPTS||DEPTS).reduce((s,d)=>s+((deptStaff||{})[d]?.total||0), 0)

  // ── 계약현황 집계 (contractItems 기반) ──────────────────────
  const contractByDept = useMemo(()=>{
    return DEPTS.map(dept=>{
      const db      = (DEPT_BIZ||{})[dept] || {}
      const myProjs = projects.filter(p=>(p.depts||[]).includes(dept)||(p.deptShares||[]).some(s=>s.dept===dept))
      const staff   = (deptStaff||{})[dept]?.total || 1
      const target  = db.orderTarget || 0  // 억원 단위

      const deptShare = (item) => {
        const ds = (item.deptShares||[]).find(s=>s.dept===dept)
        if(ds) return ds.share/100
        if((item.depts||[]).includes(dept)) return 1/((item.depts||[]).length||1)
        return 0
      }
      // ══ 단위 변환 규칙 ══
      // contractItems.serviceFeeExpect = 원(₩) 단위 저장
      // 건축 설계 용역비 현실 범위: 1천만원 ~ 200억원
      // → 1e7(1천만) ~ 2e10(200억) 원 범위
      // → 억원 단위: 0.1 ~ 200 범위
      // 반드시 /1e8 변환해서 억원으로 통일
      const toAmt = v => {
        const n = Math.abs(Number(v)||0)
        if(n === 0) return 0
        // 0.001 미만: 잘못된 값 → 0 처리
        // 1000 초과: 원 단위(≥1000원) → /1e8 변환
        // 0.001~1000: 억원 단위 → 그대로
        if(n > 1000) return n/1e8
        return n
      }

      const myItems = contractItems.filter(i=>
        (i.depts||[]).includes(dept)||(i.deptShares||[]).some(s=>s.dept===dept)
      )
      const done = myItems.filter(i=>(i.type||"").includes("계약"))
                          .reduce((s,i)=>s+toAmt(i.serviceFeeExpect||i.amount||0)*deptShare(i),0)
      const conf = myItems.filter(i=>i.type==="확정")
                          .reduce((s,i)=>s+toAmt(i.serviceFeeExpect||i.amount||0)*deptShare(i),0)
      const push = myItems.filter(i=>i.type==="추진")
                          .reduce((s,i)=>s+toAmt(i.serviceFeeExpect||i.amount||0)*deptShare(i),0)

      // contractItems 없으면 기존 deptBiz 값 폴백 (모두 억원 단위)
      const hasCItems = contractItems.length > 0
      const doneAmt = hasCItems ? done : (db.orderDone||0)
      const confAmt = hasCItems ? conf : (db.orderConfirmed||0)
      const pushAmt = hasCItems ? push : (db.orderPush||0)

      const total = doneAmt + confAmt + pushAmt
      const rate  = target > 0 ? Math.round((doneAmt+confAmt)/target*100) : null

      return {dept, target, done:doneAmt, conf:confAmt, push:pushAmt, total, rate, staff,
              perCapita: staff>0?(doneAmt+confAmt)/staff:0, projects:myProjs.length}
    })
  },[DEPTS,DEPT_BIZ,projects,deptStaff,contractItems])

  // ── 매출현황 집계 (saleItems + DEPT_BIZ 기반) ──────────────
  const saleByDept = useMemo(()=>{
    return DEPTS.map(dept=>{
      const db   = (DEPT_BIZ||{})[dept] || {}
      const staff= (deptStaff||{})[dept]?.total || 1

      // cashItems에서 이 본부의 기성+확정 (월수금계획 기반)
      // dept 단일필드 OR depts 배열 OR projectName 매칭 모두 지원
      const myItems = cashItems.filter(i=>
        i.dept===dept ||
        (Array.isArray(i.depts)&&i.depts.includes(dept))
      )
      const paidAmt = myItems.filter(i=>i.paidDate).reduce((s,i)=>s+(i.amount||0),0)/1e8
      const expAmt  = myItems.filter(i=>!i.paidDate&&i.expectedDate&&i.itemType!=="미정"&&i.itemType!=="추진").reduce((s,i)=>s+(i.amount||0),0)/1e8
      const pushAmt = myItems.filter(i=>i.itemType==="미정"||i.itemType==="추진").reduce((s,i)=>s+(i.amount||0),0)/1e8

      const revCum    = paidAmt
      const revConf   = expAmt
      const revPush   = pushAmt
      const revTarget = db.revTarget || 0

      const totalContract = projects.filter(p=>(p.depts||[]).includes(dept)).reduce((s,p)=>{
        const share=(p.deptShares||[]).find(s2=>s2.dept===dept)?.share||100/(p.depts?.length||1)
        return s+(p.serviceFee||0)*(share/100)/1e8
      },0)
      const carryOver = Math.max(0, totalContract - revCum - revConf)
      const rate  = revTarget > 0 ? Math.round(revCum/revTarget*100) : null   // 현누계 기준
      const rateWithConf = revTarget > 0 ? Math.round((revCum+revConf)/revTarget*100) : null

      return {dept, revTarget, revCum, revConf, revPush, rate, staff,
        perCapita:staff>0?(revCum+revConf)/staff:0, carryOver}
    })
  },[DEPTS,DEPT_BIZ,cashItems,projects,deptStaff,thisYear])

  // ── 지출현황 (cashItems 기반) ──────────────────────────────
  const expByDept = useMemo(()=>{
    return DEPTS.map(dept=>{
      const db   = (DEPT_BIZ||{})[dept] || {}
      const myItems = cashItems.filter(i=>i.dept===dept&&i.paidDate?.startsWith(thisYear))
      const paid = myItems.reduce((s,i)=>s+(i.amount||0),0)/1e8
      const cost5m = db.cost5m || 0  // 기존 데이터
      const pnl5m  = db.pnl5m  || 0
      return {dept, paid: Math.max(paid, cost5m), cost5m, pnl5m}
    })
  },[DEPTS,DEPT_BIZ,cashItems,thisYear])

  // 전사 합계
  const totContract = contractByDept.reduce((s,d)=>s+d.done+d.conf,0)
  const totTarget   = contractByDept.reduce((s,d)=>s+d.target,0)
  const totSale     = saleByDept.reduce((s,d)=>s+d.revCum,0)
  const totSaleTarget = saleByDept.reduce((s,d)=>s+d.revTarget,0)
  const totExp      = expByDept.reduce((s,d)=>s+d.paid,0)

  // ── 전사 현누계 (월수금현황과 동일: cashItems paidDate 기준) ──
  const totPaid_YTD = cashItems
    .filter(i => i.paidDate && String(i.paidDate).startsWith(thisYear))
    .reduce((s,i) => s + (i.amount||0), 0) / 1e8

  // 파이차트 데이터
  const contractPie = DEPTS.map((d,i)=>({name:d.replace("본부",""),value:+(contractByDept[i].done).toFixed(2),color:DEPT_COLORS[d]||"#6B7280"}))
  const salePie     = DEPTS.map((d,i)=>({name:d.replace("본부",""),value:+saleByDept[i].revCum.toFixed(2),color:DEPT_COLORS[d]||"#6B7280"}))
  const expPie      = DEPTS.map((d,i)=>({name:d.replace("본부",""),value:+expByDept[i].paid.toFixed(2),color:DEPT_COLORS[d]||"#6B7280"}))

  const tblH = {padding:"10px 12px",textAlign:"left",fontSize:12.5,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB",whiteSpace:"nowrap",background:"#F8FAFC"}
  const tblD = (align="left",bold=false,color="#374151")=>({padding:"10px 12px",textAlign:align,fontSize:13,fontWeight:bold?700:400,color,borderBottom:"1px solid #F3F4F6",whiteSpace:"nowrap"})

  // 계약·매출 합계
  const totDone   = contractByDept.reduce((s,d)=>s+d.done,0)  // 계약 완료만
  const totConf   = contractByDept.reduce((s,d)=>s+d.conf,0)
  const totPush   = contractByDept.reduce((s,d)=>s+d.push,0)
  const totSaleConf = saleByDept.reduce((s,d)=>s+d.revConf,0)
  const totSalePush = saleByDept.reduce((s,d)=>s+d.revPush,0)

  // 목표: yearTargets 우선, 없으면 DEPT_BIZ 합산 폴백
  const effectiveContractTarget = CONTRACT_TARGET > 0 ? CONTRACT_TARGET
    : contractByDept.reduce((s,d)=>s+d.target,0)
  const effectiveSaleTarget     = SALES_TARGET > 0 ? SALES_TARGET
    : saleByDept.reduce((s,d)=>s+d.revTarget,0)

  // 달성률: 계약완료만 / 현누계(입금완료)만
  const contractRate = effectiveContractTarget>0 ? Math.round(totDone/effectiveContractTarget*100) : 0
  const saleRate     = effectiveSaleTarget>0     ? Math.round(totPaid_YTD/effectiveSaleTarget*100) : 0

  return (
    <div>
      {/* 전사 KPI — 현재값 크게, 달성률 부가 표시 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>

        {/* ── 계약현황: 완료(계약) 금액 메인 ── */}
        <div style={{background:"linear-gradient(135deg,#312E81,#6366F1)",borderRadius:14,padding:"18px 20px",color:"#fff"}}>
          <div style={{fontSize:13,fontWeight:700,opacity:.8,marginBottom:6}}>📝 계약현황</div>
          <div style={{fontSize:34,fontWeight:900,letterSpacing:"-0.03em",marginBottom:2}}>{fA(totDone)}</div>
          <div style={{fontSize:12,opacity:.7,marginBottom:10}}>계약 완료 기준</div>
          <div style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,opacity:.8,marginBottom:4}}>
              <span>달성률 {effectiveContractTarget>0?`(목표 ${effectiveContractTarget}억)`:"(목표 미설정)"}</span>
              <span style={{fontWeight:800,fontSize:14,color:"#34D399"}}>
                {effectiveContractTarget>0 ? `${contractRate}%` : "-"}
              </span>
            </div>
            <div style={{height:7,background:"rgba(255,255,255,.2)",borderRadius:4}}>
              <div style={{height:"100%",background:"#34D399",borderRadius:4,width:effectiveContractTarget>0?`${Math.min(contractRate,100)}%`:"0%"}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
            {[["✅ 완료",fA(totDone),"#34D399",true],["📋 확정",fA(totConf),"#A5B4FC",false],["🔶 추진",fA(totPush),"#FDE68A",false]].map(([l,v,c,bold])=>(
              <div key={l} style={{background:"rgba(255,255,255,.12)",borderRadius:8,padding:"8px 6px",textAlign:"center",border:bold?"1.5px solid rgba(255,255,255,.4)":"none"}}>
                <div style={{fontSize:10,color:c,fontWeight:600,marginBottom:2}}>{l}</div>
                <div style={{fontSize:bold?15:13,fontWeight:bold?900:600,color:"#fff"}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 매출현황: 현누계(입금완료) 메인 크게 ── */}
        <div style={{background:"linear-gradient(135deg,#065F46,#059669)",borderRadius:14,padding:"18px 20px",color:"#fff"}}>
          <div style={{fontSize:13,fontWeight:700,opacity:.8,marginBottom:6}}>💧 매출현황</div>
          <div style={{fontSize:34,fontWeight:900,letterSpacing:"-0.03em",marginBottom:2}}>{fA(totPaid_YTD)}</div>
          <div style={{fontSize:12,opacity:.7,marginBottom:10}}>현누계 (입금완료) 기준</div>
          <div style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,opacity:.8,marginBottom:4}}>
              <span>달성률 {effectiveSaleTarget>0?`(목표 ${effectiveSaleTarget}억)`:"(목표 미설정)"}</span>
              <span style={{fontWeight:800,fontSize:14,color:"#34D399"}}>
                {effectiveSaleTarget>0 ? `${saleRate}%` : "-"}
              </span>
            </div>
            <div style={{height:7,background:"rgba(255,255,255,.2)",borderRadius:4}}>
              <div style={{height:"100%",background:"#34D399",borderRadius:4,width:effectiveSaleTarget>0?`${Math.min(saleRate,100)}%`:"0%"}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
            {[["✅ 현누계",fA(totPaid_YTD),"#34D399",true],["📋 확정",fA(totSaleConf),"#A5B4FC",false],["❓ 미정",fA(totSalePush),"#FDE68A",false]].map(([l,v,c,bold])=>(
              <div key={l} style={{background:"rgba(255,255,255,.12)",borderRadius:8,padding:"8px 6px",textAlign:"center",border:bold?"1.5px solid rgba(255,255,255,.4)":"none"}}>
                <div style={{fontSize:10,color:c,fontWeight:600,marginBottom:2}}>{l}</div>
                <div style={{fontSize:bold?15:13,fontWeight:bold?900:600,color:"#fff"}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 지출 + 인원 ── */}
        <div style={{display:"grid",gridTemplateRows:"1fr 1fr",gap:10}}>
          <div style={{background:"linear-gradient(135deg,#7C1D1D,#DC2626)",borderRadius:12,padding:"14px 18px",color:"#fff"}}>
            <div style={{fontSize:12,opacity:.8,marginBottom:4}}>💸 지출 합계 (현재 기준)</div>
            <div style={{fontSize:28,fontWeight:900,marginBottom:2}}>{fA(totExp)}</div>
            <div style={{fontSize:11,opacity:.7}}>
              {totPaid_YTD>0 ? `수금 대비 ${Math.round(totExp/totPaid_YTD*100)}%` : ""}
            </div>
          </div>
          <div style={{background:"linear-gradient(135deg,#374151,#6B7280)",borderRadius:12,padding:"14px 18px",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,opacity:.8,marginBottom:4}}>👥 총 인원</div>
              <div style={{fontSize:28,fontWeight:800}}>{totalStaff}명</div>
            </div>
            <div style={{fontSize:32,opacity:.4}}>👤</div>
          </div>
        </div>
      </div>

      {/* ── 계약현황 ── */}
      <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",marginBottom:16,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:"1px solid #E5E7EB",display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:16,fontWeight:800,color:"#111827"}}>📝 계약현황 ({thisYear}년 목표 대비)</div>
          <div style={{marginLeft:"auto",fontSize:13,color:"#6B7280"}}>단위: 억원</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:0}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                {["본부","목표","완료(계약)","확정","추진","합계(완료+확정)","달성률","인당(완료+확정)","프로젝트"].map((h,i)=>(
                  <th key={i} style={{...tblH,textAlign:i===0?"left":"right"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {contractByDept.map((d,i)=>(
                  <tr key={d.dept} style={{background:i%2===0?"#fff":"#FAFAFA"}}>
                    <td style={tblD("left",true,"#111827")}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:DEPT_COLORS[d.dept]||"#6B7280"}}/>
                        {d.dept}
                      </div>
                    </td>
                    <td style={tblD("right")}>{fA(d.target)}</td>
                    <td style={tblD("right",true,"#6366F1")}>{fA(d.done)}</td>
                    <td style={tblD("right",false,"#059669")}>{fA(d.conf)}</td>
                    <td style={tblD("right",false,"#D97706")}>{fA(d.push)}</td>
                    <td style={tblD("right",true,"#312E81")}>{fA(d.done+d.conf+d.push)}</td>
                    <td style={{...tblD("right",true),color:d.rate>=100?"#059669":d.rate>=70?"#D97706":"#DC2626"}}>
                      {d.rate!=null&&!isNaN(d.rate)?d.rate+"%":"-"}
                    </td>
                    <td style={tblD("right")}>{d.perCapita>0?fA(d.perCapita):"-"}</td>
                    <td style={tblD("right")}>{d.projects}건</td>
                  </tr>
                ))}
                <tr style={{background:"#EEF2FF",fontWeight:700}}>
                  <td style={tblD("left",true,"#312E81")}>
                    합계 <span style={{fontSize:11,fontWeight:400,color:"#6B7280",marginLeft:4}}>(전체 {totalStaff}명)</span>
                  </td>
                  <td style={tblD("right",true)}>{fA(totTarget)}</td>
                  <td style={tblD("right",true,"#6366F1")}>{fA(contractByDept.reduce((s,d)=>s+d.done,0))}</td>
                  <td style={tblD("right",true,"#059669")}>{fA(contractByDept.reduce((s,d)=>s+d.conf,0))}</td>
                  <td style={tblD("right",true,"#D97706")}>{fA(contractByDept.reduce((s,d)=>s+d.push,0))}</td>
                  <td style={tblD("right",true,"#312E81")}>{fA(totContract+contractByDept.reduce((s,d)=>s+d.push,0))}</td>
                  <td style={{...tblD("right",true),color:totTarget>0&&totContract/totTarget>=1?"#059669":"#D97706"}}>{totTarget>0?Math.round(totContract/totTarget*100)+"%":"-"}</td>
                  <td style={tblD("right",true)}>{totalStaff>0?fA(totContract/totalStaff):"-"}</td>
                  <td style={tblD("right",true)}>{projects.length}건</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* 파이차트 */}
          <div style={{padding:"16px",borderLeft:"1px solid #E5E7EB",display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#6B7280",marginBottom:8}}>본부별 계약 비중(확정포함)</div>
            <SimplePieChart data={contractPie} total={totContract}/>
          </div>
        </div>
      </div>

      {/* ── 매출현황 ── */}
      <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",marginBottom:16,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:"1px solid #E5E7EB",display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:16,fontWeight:800,color:"#111827"}}>📈 매출현황 ({thisYear}년 목표 대비)</div>
          <div style={{marginLeft:"auto",fontSize:13,color:"#6B7280"}}>단위: 억원</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:0}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                {["본부","목표","현누계","확정","미정","합계(기성+확정)","달성률(현누계)","인당(기성+확정)","이월잔액"].map((h,i)=>(
                  <th key={i} style={{...tblH,textAlign:i===0?"left":"right",
                    color:i===5?"#312E81":i===6||i===7?"#059669":"#6B7280",
                    background:i===5?"#DCFCE7":i===7?"#D1FAE5":"#F8FAFC"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {saleByDept.map((d,i)=>(
                  <tr key={d.dept} style={{background:i%2===0?"#fff":"#FAFAFA"}}>
                    <td style={tblD("left",true,"#111827")}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:DEPT_COLORS[d.dept]||"#6B7280"}}/>
                        {d.dept}
                      </div>
                    </td>
                    <td style={tblD("right")}>{fA(d.revTarget)}</td>
                    <td style={tblD("right",true,"#059669")}>{fA(d.revCum)}</td>
                    <td style={tblD("right",false,"#6366F1")}>{fA(d.revConf)}</td>
                    <td style={tblD("right",false,"#D97706")}>{fA(d.revPush)}</td>
                    <td style={tblD("right",true,"#312E81","#ECFDF5")}>{fA(d.revCum+d.revConf)}</td>
                    <td style={{...tblD("right",true),color:d.rate>=100?"#059669":d.rate>=70?"#D97706":"#DC2626"}}>
                      {d.rate!=null&&!isNaN(d.rate)?(
                        <div>
                          <div style={{fontSize:14,fontWeight:800}}>{d.rate}%</div>
                          <div style={{fontSize:10,color:"#9CA3AF",fontWeight:400,marginTop:1}}>+확정 {d.rateWithConf??"-"}%</div>
                        </div>
                      ):"-"}
                    </td>
                    <td style={tblD("right",false,"#059669","#D1FAE5")}>{d.perCapita>0?fA(d.perCapita):"-"}</td>
                    <td style={tblD("right",false,"#6B7280")}>{d.carryOver>0?fA(d.carryOver):"-"}</td>
                  </tr>
                ))}
                <tr style={{background:"#EEF2FF",fontWeight:700}}>
                  <td style={tblD("left",true,"#312E81")}>합계 <span style={{fontSize:11,fontWeight:400,color:"#6B7280",marginLeft:4}}>(전체 {totalStaff}명)</span></td>
                  <td style={tblD("right",true)}>{fA(totSaleTarget)}</td>
                  <td style={tblD("right",true,"#059669")}>{fA(totSale)}</td>
                  <td style={tblD("right",true,"#6366F1")}>{fA(saleByDept.reduce((s,d)=>s+d.revConf,0))}</td>
                  <td style={tblD("right",true,"#D97706")}>{fA(saleByDept.reduce((s,d)=>s+d.revPush,0))}</td>
                  <td style={tblD("right",true,"#312E81","#DCFCE7")}>{fA(totSale+saleByDept.reduce((s,d)=>s+d.revConf,0))}</td>
                  <td style={{...tblD("right",true),color:totSaleTarget>0&&totSale/totSaleTarget>=1?"#059669":"#D97706"}}>{totSaleTarget>0?Math.round(totSale/totSaleTarget*100)+"%":"-"}</td>
                  <td style={tblD("right",false,"#059669","#D1FAE5")}>{totalStaff>0?fA((totSale+saleByDept.reduce((s,d)=>s+d.revConf,0))/totalStaff):"-"}</td>
                  <td style={tblD("right",true,"#6B7280")}>{fA(saleByDept.reduce((s,d)=>s+d.carryOver,0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{padding:"16px",borderLeft:"1px solid #E5E7EB",display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#6B7280",marginBottom:8}}>본부별 매출 비중(기성+확정)</div>
            <SimplePieChart data={salePie} total={totSale}/>
          </div>
        </div>
      </div>

      {/* ── 지출현황 ── */}
      <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:"1px solid #E5E7EB",display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:16,fontWeight:800,color:"#111827"}}>💸 지출현황 ({thisYear}년)</div>
          <div style={{marginLeft:"auto",fontSize:13,color:"#6B7280"}}>단위: 억원</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:0}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                {["본부","지출 합계","인건비 등","손익(5월)"].map((h,i)=>(
                  <th key={i} style={{...tblH,textAlign:i===0?"left":"right"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {expByDept.map((d,i)=>(
                  <tr key={d.dept} style={{background:i%2===0?"#fff":"#FAFAFA"}}>
                    <td style={tblD("left",true,"#111827")}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:DEPT_COLORS[d.dept]||"#6B7280"}}/>
                        {d.dept}
                      </div>
                    </td>
                    <td style={tblD("right",true,"#DC2626")}>{fA(d.paid)}</td>
                    <td style={tblD("right",false,"#6B7280")}>{fA(d.cost5m)}</td>
                    <td style={{...tblD("right",true),color:d.pnl5m>=0?"#059669":"#DC2626"}}>{d.pnl5m!==0?fA(d.pnl5m):"-"}</td>
                  </tr>
                ))}
                <tr style={{background:"#FEE2E2",fontWeight:700}}>
                  <td style={tblD("left",true,"#312E81")}>합계 <span style={{fontSize:11,fontWeight:400,color:"#6B7280",marginLeft:4}}>(전체 {totalStaff}명)</span></td>
                  <td style={tblD("right",true,"#DC2626")}>{fA(totExp)}</td>
                  <td style={tblD("right",true)}>{fA(expByDept.reduce((s,d)=>s+d.cost5m,0))}</td>
                  <td style={{...tblD("right",true),color:expByDept.reduce((s,d)=>s+d.pnl5m,0)>=0?"#059669":"#DC2626"}}>{fA(expByDept.reduce((s,d)=>s+d.pnl5m,0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{padding:"16px",borderLeft:"1px solid #E5E7EB",display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#6B7280",marginBottom:8}}>본부별 지출 비중</div>
            <SimplePieChart data={expPie} total={totExp}/>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 파이차트 (수치 표시 포함) ────────────────────────────────
function SimplePieChart({data=[], total=0}) {
  if(!data.length||!total) return <div style={{width:200,height:200,display:"flex",alignItems:"center",justifyContent:"center",color:"#9CA3AF",fontSize:13}}>데이터 없음</div>

  const W=200,CX=80,CY=90,R=68,IR=32
  let angle=-Math.PI/2
  const slices=data.filter(d=>d.value>0).map(d=>{
    const a=(d.value/total)*2*Math.PI
    const x1=CX+R*Math.cos(angle), y1=CY+R*Math.sin(angle)
    const x2=CX+R*Math.cos(angle+a), y2=CY+R*Math.sin(angle+a)
    const xi1=CX+IR*Math.cos(angle),yi1=CY+IR*Math.sin(angle)
    const xi2=CX+IR*Math.cos(angle+a),yi2=CY+IR*Math.sin(angle+a)
    const lg=a>Math.PI?1:0
    const mid=angle+a/2
    const path=`M ${xi1} ${yi1} L ${x1} ${y1} A ${R} ${R} 0 ${lg} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${IR} ${IR} 0 ${lg} 0 ${xi1} ${yi1}`
    const pct=Math.round(d.value/total*100)
    angle+=a
    return{path,fill:d.fill||d.color,name:d.name,value:d.value,pct,mid}
  })

  return (
    <svg viewBox={`0 0 240 200`} style={{width:"100%",maxWidth:240}}>
      {slices.map((s,i)=>(
        <path key={i} d={s.path} fill={s.fill} stroke="#fff" strokeWidth={2}/>
      ))}
      {/* 중앙 합계 */}
      <text x={CX} y={CY-6} textAnchor="middle" fontSize={10} fill="#6B7280">합계</text>
      <text x={CX} y={CY+10} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#111827">{total>0?total.toFixed(1)+"억":"-"}</text>
      {/* 범례 */}
      {slices.map((s,i)=>(
        <g key={i} transform={`translate(155,${20+i*22})`}>
          <rect width={10} height={10} fill={s.fill} rx={2}/>
          <text x={14} y={9} fontSize={11} fill="#374151" fontWeight="600">{s.name}</text>
          <text x={14} y={9} dx={50} fontSize={11} fill={s.fill} fontWeight="800" textAnchor="end">{s.pct}%</text>
        </g>
      ))}
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════
// 🔒 권한 없음 안내 화면
// ══════════════════════════════════════════════════════════════
function NoPermScreen({tabId}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:320,gap:16,color:"#6B7280"}}>
      <div style={{fontSize:56}}>🔒</div>
      <div style={{fontSize:20,fontWeight:800,color:"#374151"}}>접근 권한이 없습니다</div>
      <div style={{fontSize:14,color:"#9CA3AF",textAlign:"center",maxWidth:360,lineHeight:1.7}}>
        이 메뉴는 관리자가 접근 권한을 부여해야 사용할 수 있습니다.<br/>
        관리자에게 <strong>권한관리 → 탭권한</strong>에서 권한 설정을 요청하세요.
      </div>
      <div style={{background:"#F3F4F6",borderRadius:10,padding:"10px 20px",fontSize:13,color:"#6B7280",fontFamily:"monospace"}}>
        메뉴 ID: {tabId}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 💧 프로젝트 상세 — 월수금 연동 (가로형 캘린더)
// ══════════════════════════════════════════════════════════════
function ProjectCashflowDetail({proj, cashItems, setCashItems, DEPTS, DEPT_COLORS, MONTH, YEAR, YR, projBaseline={}, setProjBaseline}) {
  const fixDate = s => {
    if(!s) return ""
    const n=parseInt(String(s))
    if(!isNaN(n)&&n>40000&&n<60000){const d=new Date((n-25569)*86400*1000);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`}
    return String(s).trim()
  }
  const fAmt = n => n>=1e8?`${(n/1e8).toFixed(2)}억`:n>=1e4?`${(n/1e4).toFixed(0)}만`:n>0?n.toLocaleString()+"원":"-"

  // ── 기준일 잔금 상태 ─────────────────────────────────────
  const bl = projBaseline[proj.id] || {}
  const [editBL, setEditBL] = useState(false)
  const [blDraft, setBlDraft] = useState({})

  const startEditBL = () => {
    setBlDraft({
      baseDate:     bl.baseDate     || "2026-01-01",
      serviceFee:   bl.serviceFee   || (proj.serviceFee>0 ? +(proj.serviceFee/1e8).toFixed(4) : ""),
      prevReceived: bl.prevReceived || "",
      memo:         bl.memo         || "",
    })
    setEditBL(true)
  }
  const saveBL = () => {
    const fee  = parseFloat(String(blDraft.serviceFee).replace(/[^0-9.]/g,""))||0
    const prev = parseFloat(String(blDraft.prevReceived).replace(/[^0-9.]/g,""))||0
    setProjBaseline(p=>({...p,[proj.id]:{
      baseDate:     blDraft.baseDate,
      serviceFee:   fee,      // 억원
      prevReceived: prev,     // 억원
      balance:      fee-prev, // 잔금
      memo:         blDraft.memo,
      updatedAt:    new Date().toISOString(),
    }}))
    setEditBL(false)
  }
  const u = (k,v) => setBlDraft(p=>({...p,[k]:v}))

  // ── 유사명 매칭 ───────────────────────────────────────────
  const normName = s => (s||"").replace(/[\s\-_·.\(\)【】\[\]]/g,"").toLowerCase()
  const projNorm = normName(proj.name)
  const myItems = cashItems.filter(i=>{
    const a=normName(i.projectName)
    return a===projNorm||a.includes(projNorm.slice(0,Math.min(projNorm.length,8)))||projNorm.includes(a.slice(0,Math.min(a.length,8)))
  })

  const projGroups = {}
  myItems.forEach(item=>{const key=item.projectName||proj.name;if(!projGroups[key])projGroups[key]=[];projGroups[key].push(item)})

  const MONTHS_LABEL=["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"]
  const getYM = item => { const d=fixDate(item.paidDate||item.expectedDate); return d?d.slice(0,7):"미정" }

  const paidAmt    = myItems.filter(i=>i.paidDate).reduce((s,i)=>s+(i.amount||0),0)
  const expAmt     = myItems.filter(i=>!i.paidDate&&i.expectedDate).reduce((s,i)=>s+(i.amount||0),0)
  const thisYearAmt= myItems.filter(i=>getYM(i).startsWith(YR)).reduce((s,i)=>s+(i.amount||0),0)

  // 기준일 이후 입금/예정
  const afterBase = bl.baseDate ? myItems.filter(i=>fixDate(i.paidDate||i.expectedDate)>=bl.baseDate) : myItems
  const afterBasePaid= afterBase.filter(i=>i.paidDate).reduce((s,i)=>s+(i.amount||0),0)
  const afterBaseExp = afterBase.filter(i=>!i.paidDate&&i.expectedDate).reduce((s,i)=>s+(i.amount||0),0)

  // 총 수령액 = 기수령(억→원) + 기준일 이후 입금완료 + 예정
  const prevRcv     = (bl.prevReceived||0)*1e8
  const totalRcv    = prevRcv + afterBasePaid + afterBaseExp
  const feeBl       = (bl.serviceFee||(proj.serviceFee||0)/1e8)*1e8  // 설계비(원)
  const balRemain   = feeBl - totalRcv

  return (
    <div>
      {/* ── 기준일 잔금 카드 ── */}
      <div style={{background:"linear-gradient(135deg,#312E81,#6366F1)",borderRadius:16,padding:"20px 24px",marginBottom:16,color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:12.5,opacity:.75,marginBottom:4}}>
              📅 기준일: <strong>{bl.baseDate||"미설정"}</strong>
              {bl.baseDate&&<span style={{fontSize:11,opacity:.6,marginLeft:8}}>({bl.baseDate} 이전 기수령액 기반)</span>}
            </div>
            <div style={{fontSize:13,opacity:.8,marginBottom:8}}>설계비 · 기수령액 · 잔금 (단위: 억원)</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {[
                {label:"설계비(용역비)", val:bl.serviceFee>0?`${bl.serviceFee.toFixed(2)}억`:fAmt(proj.serviceFee||0), color:"#C7D2FE"},
                {label:`기수령액(${bl.baseDate||"기준일"} 전)`, val:bl.prevReceived>0?`${bl.prevReceived.toFixed(2)}억`:"-", color:"#34D399"},
                {label:"잔금(기준일 기준)", val:bl.balance>0?`${bl.balance.toFixed(2)}억`:(feeBl>0?fAmt(feeBl):"-"), color:"#FDE68A"},
              ].map(c=>(
                <div key={c.label} style={{background:"rgba(255,255,255,.12)",borderRadius:12,padding:"12px 14px"}}>
                  <div style={{fontSize:11,color:c.color,marginBottom:5,opacity:.9}}>{c.label}</div>
                  <div style={{fontSize:20,fontWeight:800,color:"#fff"}}>{c.val}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
            <button onClick={startEditBL}
              style={{padding:"8px 16px",background:"rgba(255,255,255,.2)",color:"#fff",border:"1px solid rgba(255,255,255,.4)",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>
              ✏ 기준일 잔금 {bl.baseDate?"수정":"입력"}
            </button>
            {bl.updatedAt&&<div style={{fontSize:11,opacity:.6}}>수정: {bl.updatedAt.slice(0,10)}</div>}
          </div>
        </div>

        {/* 현황 요약 바 */}
        {feeBl>0&&(
          <div style={{marginTop:16}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6,opacity:.85}}>
              <span>수령 현황</span>
              <span><strong>{Math.round(totalRcv/feeBl*100)}%</strong> 수령 완료</span>
            </div>
            <div style={{height:10,background:"rgba(255,255,255,.2)",borderRadius:5,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:5,
                background:"linear-gradient(90deg,#34D399,#34D399)",
                width:`${Math.min(totalRcv/feeBl*100,100)}%`,transition:"width .8s"}}/>
            </div>
            <div style={{display:"flex",gap:16,marginTop:8,fontSize:11.5,opacity:.8}}>
              <span>기수령 {fAmt(prevRcv)}</span>
              <span>이후 완료 {fAmt(afterBasePaid)}</span>
              <span>예정 {fAmt(afterBaseExp)}</span>
              <span style={{marginLeft:"auto",fontWeight:700}}>잔금 {fAmt(balRemain)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 기준일 입력 폼 ── */}
      {editBL&&(
        <div style={{background:"#EEF2FF",border:"2px solid #6366F1",borderRadius:14,padding:"20px 22px",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:800,color:"#312E81",marginBottom:16}}>
            📅 기준일 잔금 입력 — {proj.name}
          </div>
          <div style={{background:"#FEF3C7",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12.5,color:"#92400E",lineHeight:1.6}}>
            <strong>💡 입력 방법:</strong> 기준일 이전까지 수령한 누적 금액을 "기수령액"에 입력하세요.<br/>
            기준일 이후는 월수금계획 탭에서 건별로 자동 집계됩니다.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:12}}>
            <div>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>기준일 *</label>
              <input type="date" value={blDraft.baseDate||""} onChange={e=>u("baseDate",e.target.value)} style={INP()}/>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>설계비(용역비) — 억원</label>
              <input type="number" step="0.01" value={blDraft.serviceFee||""} onChange={e=>u("serviceFee",e.target.value)}
                placeholder={proj.serviceFee>0?(proj.serviceFee/1e8).toFixed(4):""} style={INP()}/>
              {proj.serviceFee>0&&<div style={{fontSize:11,color:"#6B7280",marginTop:3}}>
                프로젝트 등록 용역비: {fAmt(proj.serviceFee)}
              </div>}
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:700,color:"#059669",display:"block",marginBottom:5}}>
                기수령액 (기준일 이전 누계) — 억원
              </label>
              <input type="number" step="0.01" value={blDraft.prevReceived||""} onChange={e=>u("prevReceived",e.target.value)}
                placeholder="예: 5.23" style={{...INP(),borderColor:"#059669"}}/>
              {blDraft.serviceFee&&blDraft.prevReceived&&(
                <div style={{fontSize:12,fontWeight:700,color:"#6366F1",marginTop:4}}>
                  잔금: {(parseFloat(blDraft.serviceFee||0)-parseFloat(blDraft.prevReceived||0)).toFixed(2)}억
                </div>
              )}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>메모</label>
            <input value={blDraft.memo||""} onChange={e=>u("memo",e.target.value)} placeholder="특이사항, 계약조건 등" style={INP()}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={saveBL} style={{padding:"10px 22px",background:"#6366F1",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>저장</button>
            <button onClick={()=>setEditBL(false)} style={{padding:"10px 16px",background:"#F3F4F6",color:"#374151",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>취소</button>
          </div>
        </div>
      )}

      {/* ── KPI 카드 ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {[
          {label:"설계비(용역비)", val:bl.serviceFee>0?`${bl.serviceFee.toFixed(2)}억`:fAmt(proj.serviceFee||0), color:"#312E81"},
          {label:"입금 완료(기준일 이후)", val:fAmt(afterBasePaid), color:"#059669"},
          {label:"입금 예정", val:fAmt(afterBaseExp), color:"#6366F1"},
          {label:"최종 잔금 예상", val:fAmt(Math.max(balRemain,0)), color:"#D97706"},
        ].map(c=>(
          <div key={c.label} style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
            <div style={{fontSize:11.5,color:"#6B7280",fontWeight:600,marginBottom:6}}>{c.label}</div>
            <div style={{fontSize:18,fontWeight:800,color:c.color}}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* ── 가로형 캘린더 테이블 ── */}
      {myItems.length===0
        ?<div style={{background:"#F8FAFC",borderRadius:14,border:"1px solid #E5E7EB",padding:"48px",textAlign:"center",color:"#6B7280"}}>
            <div style={{fontSize:36,marginBottom:12}}>💧</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>기준일 이후 월수금 내역이 없습니다</div>
            <div style={{fontSize:13}}>월수금계획 탭에서 <strong>{proj.name}</strong> 관련 기성 내역을 등록하세요.</div>
          </div>
        :<div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:"1px solid #E5E7EB",fontSize:15,fontWeight:800,color:"#111827"}}>
            💧 {YR}년 월수금 계획 — 가로형 캘린더 (단위: 억원)
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:1000}}>
              <thead>
                <tr style={{background:"#F8FAFC"}}>
                  <th style={{padding:"9px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB",borderRight:"1px solid #E5E7EB",minWidth:150,position:"sticky",left:0,background:"#F8FAFC",zIndex:2}}>용역명</th>
                  <th style={{padding:"9px 10px",textAlign:"right",fontSize:12,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB",borderRight:"1px solid #E5E7EB",minWidth:65,background:"#F8FAFC"}}>용역비</th>
                  <th style={{padding:"9px 10px",textAlign:"right",fontSize:12,fontWeight:700,color:"#059669",borderBottom:"2px solid #E5E7EB",borderRight:"2px solid #E5E7EB",minWidth:65,background:"#D1FAE5"}}>기수령액</th>
                  {MONTHS_LABEL.map((m,mi)=>(
                    <th key={m} style={{padding:"9px 7px",textAlign:"right",fontSize:11.5,fontWeight:700,
                      color:mi+1===parseInt(MONTH)?"#DC2626":"#6B7280",
                      borderBottom:"2px solid #E5E7EB",
                      borderRight:mi+1===parseInt(MONTH)?"2px solid #DC2626":"1px solid #E5E7EB",
                      borderLeft:mi+1===parseInt(MONTH)?"2px solid #DC2626":"none",
                      minWidth:55,background:mi+1===parseInt(MONTH)?"#FEF2F2":"#F8FAFC"}}>{m}</th>
                  ))}
                  <th style={{padding:"9px 10px",textAlign:"right",fontSize:11.5,fontWeight:700,color:"#059669",borderBottom:"2px solid #E5E7EB",borderLeft:"2px solid #E5E7EB",minWidth:65,background:"#D1FAE5"}}>{MONTH}월누계</th>
                  <th style={{padding:"9px 10px",textAlign:"right",fontSize:11.5,fontWeight:700,color:"#6366F1",borderBottom:"2px solid #E5E7EB",minWidth:65,background:"#EEF2FF"}}>확정합계</th>
                  <th style={{padding:"9px 10px",textAlign:"right",fontSize:11.5,fontWeight:700,color:"#312E81",borderBottom:"2px solid #E5E7EB",minWidth:65,background:"#EDE9FE"}}>{YR}합계</th>
                  <th style={{padding:"9px 10px",textAlign:"right",fontSize:11.5,fontWeight:700,color:"#374151",borderBottom:"2px solid #E5E7EB",minWidth:65}}>이월예상</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(projGroups).map(([pName,items],ri)=>{
                  // 기수령액: bl에서 가져오거나 기준일 이전 입금
                  const prevPaidBl  = bl.prevReceived>0 ? bl.prevReceived*1e8
                    : items.filter(i=>i.paidDate&&fixDate(i.paidDate)<(bl.baseDate||`${YR}-01`)).reduce((s,i)=>s+(i.amount||0),0)
                  const monthly=Array.from({length:12},(_,mi)=>{
                    const m=String(mi+1).padStart(2,"0"); const ym=`${YR}-${m}`
                    const paid=items.filter(i=>i.paidDate&&fixDate(i.paidDate).slice(0,7)===ym).reduce((s,i)=>s+(i.amount||0),0)
                    const exp =items.filter(i=>!i.paidDate&&i.expectedDate&&i.itemType!=="미정"&&i.itemType!=="추진"&&fixDate(i.expectedDate).slice(0,7)===ym).reduce((s,i)=>s+(i.amount||0),0)
                    return {paid,exp}
                  })
                  const cumToNow  = monthly.slice(0,parseInt(MONTH)).reduce((s,m)=>s+m.paid,0)
                  const confTotal = items.filter(i=>i.paidDate||i.expectedDate).reduce((s,i)=>s+(i.amount||0),0)
                  const yearTotal = monthly.reduce((s,m)=>s+m.paid+m.exp,0)
                  const blFee     = bl.serviceFee>0?bl.serviceFee*1e8:(proj.serviceFee||0)
                  const carry     = blFee - prevPaidBl - yearTotal
                  return (
                    <tr key={pName} style={{background:ri%2===0?"#fff":"#FAFAFA",borderBottom:"1px solid #E5E7EB"}}>
                      <td style={{padding:"9px 12px",fontSize:12.5,fontWeight:600,color:"#111827",borderRight:"1px solid #E5E7EB",position:"sticky",left:0,background:ri%2===0?"#fff":"#FAFAFA",zIndex:1}}
                        title={pName}>{pName.length>20?pName.slice(0,20)+"…":pName}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:12,color:"#374151",borderRight:"1px solid #E5E7EB"}}>
                        {bl.serviceFee>0?bl.serviceFee.toFixed(2):fC(proj.serviceFee||0)}
                      </td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:12,fontWeight:700,color:"#059669",borderRight:"2px solid #E5E7EB",background:"#ECFDF5"}}>
                        {prevPaidBl>0?fC(prevPaidBl):"-"}
                      </td>
                      {monthly.map((m,mi)=>(
                        <td key={mi} style={{padding:"9px 7px",textAlign:"right",fontSize:12.5,fontWeight:m.paid+m.exp>0?700:400,
                          color:m.paid>0?"#059669":m.exp>0?"#6366F1":"#D1D5DB",
                          borderRight:mi+1===parseInt(MONTH)?"2px solid #DC2626":"1px solid #E5E7EB",
                          borderLeft:mi+1===parseInt(MONTH)?"2px solid #DC2626":"none",
                          background:mi+1===parseInt(MONTH)?"#FEF2F2":m.paid>0?"#ECFDF5":m.exp>0?"#EEF2FF":"transparent"}}>
                          {m.paid>0?fC(m.paid):m.exp>0?fC(m.exp):"-"}
                        </td>
                      ))}
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:12.5,fontWeight:700,color:"#059669",borderLeft:"2px solid #E5E7EB",background:"#D1FAE5"}}>{cumToNow>0?fC(cumToNow):"-"}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:12.5,fontWeight:700,color:"#6366F1",background:"#EEF2FF"}}>{confTotal>0?fC(confTotal):"-"}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:12.5,fontWeight:800,color:"#312E81",background:"#EDE9FE"}}>{yearTotal>0?fC(yearTotal):"-"}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:12.5,color:carry>0?"#374151":"#D1D5DB"}}>{carry>0?fC(carry):"-"}</td>
                    </tr>
                  )
                })}
                {/* 합계 행 */}
                <tr style={{background:"#EEF2FF",fontWeight:700,borderTop:"2px solid #E5E7EB"}}>
                  <td style={{padding:"10px 12px",fontSize:13,fontWeight:800,color:"#312E81",borderRight:"1px solid #E5E7EB",position:"sticky",left:0,background:"#EEF2FF",zIndex:1}}>합계</td>
                  <td style={{padding:"10px 10px",textAlign:"right",fontSize:13,color:"#312E81",borderRight:"1px solid #E5E7EB"}}>
                    {bl.serviceFee>0?bl.serviceFee.toFixed(2):fC(proj.serviceFee||0)}
                  </td>
                  <td style={{padding:"10px 10px",textAlign:"right",fontSize:13,fontWeight:800,color:"#059669",borderRight:"2px solid #E5E7EB",background:"#D1FAE5"}}>
                    {bl.prevReceived>0?bl.prevReceived.toFixed(2):"-"}
                  </td>
                  {Array.from({length:12},(_,mi)=>{
                    const m=String(mi+1).padStart(2,"0"); const ym=`${YR}-${m}`
                    const paid=myItems.filter(i=>i.paidDate&&fixDate(i.paidDate).slice(0,7)===ym).reduce((s,i)=>s+(i.amount||0),0)
                    const exp =myItems.filter(i=>!i.paidDate&&i.expectedDate&&i.itemType!=="미정"&&i.itemType!=="추진"&&fixDate(i.expectedDate).slice(0,7)===ym).reduce((s,i)=>s+(i.amount||0),0)
                    return <td key={mi} style={{padding:"10px 7px",textAlign:"right",fontSize:13,fontWeight:800,
                      color:paid>0?"#059669":exp>0?"#6366F1":"#D1D5DB",
                      borderRight:mi+1===parseInt(MONTH)?"2px solid #DC2626":"1px solid #E5E7EB",
                      borderLeft:mi+1===parseInt(MONTH)?"2px solid #DC2626":"none",
                      background:mi+1===parseInt(MONTH)?"#FEF2F2":"transparent"}}>
                      {paid>0?fC(paid):exp>0?fC(exp):"-"}
                    </td>
                  })}
                  <td style={{padding:"10px 10px",textAlign:"right",fontSize:13,fontWeight:800,color:"#059669",borderLeft:"2px solid #E5E7EB",background:"#D1FAE5"}}>{fC(afterBasePaid)}</td>
                  <td style={{padding:"10px 10px",textAlign:"right",fontSize:13,fontWeight:800,color:"#6366F1",background:"#EEF2FF"}}>{fC(afterBasePaid+afterBaseExp)}</td>
                  <td style={{padding:"10px 10px",textAlign:"right",fontSize:14,fontWeight:800,color:"#312E81",background:"#C4B5FD"}}>{fC(thisYearAmt)}</td>
                  <td style={{padding:"10px 10px",textAlign:"right",fontSize:13,fontWeight:700,color:balRemain>0?"#D97706":"#059669"}}>
                    {fAmt(Math.max(balRemain,0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* 범례 */}
          <div style={{display:"flex",gap:16,fontSize:11.5,color:"#6B7280",padding:"10px 18px",borderTop:"1px solid #E5E7EB",flexWrap:"wrap"}}>
            <span><span style={{display:"inline-block",width:12,height:12,background:"#D1FAE5",border:"1px solid #059669",borderRadius:2,marginRight:4}}/>입금 완료</span>
            <span><span style={{display:"inline-block",width:12,height:12,background:"#EEF2FF",border:"1px solid #6366F1",borderRadius:2,marginRight:4}}/>입금 예정</span>
            <span><span style={{display:"inline-block",width:12,height:12,background:"#FEF2F2",border:"2px solid #DC2626",borderRadius:2,marginRight:4}}/>현재월</span>
            <span style={{marginLeft:"auto",color:"#312E81",fontWeight:600}}>단위: 억원 (소수점 2자리)</span>
          </div>
        </div>
      }
    </div>
  )
}


// 프로젝트 상세 계약 탭
function ProjectContractDetail({proj, setProjects, canWrite}) {
  const fAmt = n => n>=1e8?`${(n/1e8).toFixed(2)}억`:n>0?n.toLocaleString()+"원":"-"
  return (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"20px 24px"}}>
      <div style={{fontSize:16,fontWeight:800,color:"#111827",marginBottom:16}}>📝 계약 정보</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        {[
          ["총 설계비", proj.totalFee>0?fAmt(proj.totalFee):"-"],
          ["상지 용역비", proj.serviceFee>0?fAmt(proj.serviceFee):"-"],
          ["상지 지분율", proj.shareRatio>0?`${(proj.shareRatio*100).toFixed(0)}%`:"-"],
          ["계약일", proj.contractDate||"-"],
          ["수주일", proj.orderDate||"-"],
          ["발주구분", proj.orderType||"-"],
          ["수주형태", proj.bidType||"-"],
          ["공동이행", proj.jvType||"단독이행"],
          ["발주처", proj.client||"-"],
        ].map(([label,val])=>(
          <div key={label} style={{background:"#F8FAFC",borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:12,color:"#6B7280",fontWeight:600,marginBottom:4}}>{label}</div>
            <div style={{fontSize:14,fontWeight:700,color:"#111827"}}>{val}</div>
          </div>
        ))}
      </div>
      {(proj.jvMembers||[]).length>0&&(
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"#374151",marginBottom:10}}>공동이행 구성원</div>
          {proj.jvMembers.map((m,i)=>(
            <div key={i} style={{display:"flex",gap:12,padding:"10px 14px",background:"#F8FAFC",borderRadius:10,marginBottom:8}}>
              <span style={{fontWeight:700,color:"#111827",flex:1}}>{m.name}</span>
              <span style={{color:"#6366F1",fontWeight:600}}>{m.ratio}%</span>
              <span style={{color:"#059669",fontWeight:600}}>{m.amount>0?fAmt(m.amount):"-"}</span>
              <span style={{color:"#6B7280"}}>{m.role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 프로젝트 상세 지출 탭
function ProjectExpenseDetail({proj, cashItems, YEAR, YR}) {
  const fixDate = s => {
    if(!s) return ""
    const n=parseInt(String(s))
    if(!isNaN(n)&&n>40000&&n<60000){const d=new Date((n-25569)*86400*1000);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`}
    return String(s).trim()
  }
  const fAmt = n => n>=1e8?`${(n/1e8).toFixed(2)}억`:n>=1e4?`${(n/1e4).toFixed(0)}만`:n>0?n.toLocaleString()+"원":"-"
  const normName = s => (s||"").replace(/[\s\-_·.\(\)【】\[\]]/g,"").toLowerCase()
  const projNorm = normName(proj.name)
  const myItems = cashItems.filter(i=>{
    const a=normName(i.projectName)
    return a===projNorm||a.includes(projNorm.slice(0,Math.min(projNorm.length,8)))||projNorm.includes(a.slice(0,Math.min(a.length,8)))
  })

  const vendors = proj.versions?.[proj.versions.length-1]?.vendors || []
  const totalVendor = vendors.reduce((s,v)=>s+(v.amount||0),0)
  const paidItems = myItems.filter(i=>i.paidDate)

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        {[
          {label:"외주비 계획", val:totalVendor>0?fAmt(totalVendor*1e8):"-", color:"#312E81"},
          {label:"기성 입금 합계", val:fAmt(paidItems.reduce((s,i)=>s+(i.amount||0),0)), color:"#059669"},
          {label:"미수금 예정", val:fAmt(myItems.filter(i=>!i.paidDate&&i.expectedDate).reduce((s,i)=>s+(i.amount||0),0)), color:"#D97706"},
        ].map(c=>(
          <div key={c.label} style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"14px 16px"}}>
            <div style={{fontSize:12,color:"#6B7280",fontWeight:600,marginBottom:6}}>{c.label}</div>
            <div style={{fontSize:18,fontWeight:800,color:c.color}}>{c.val}</div>
          </div>
        ))}
      </div>
      {vendors.length>0&&(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:"1px solid #E5E7EB",fontSize:14,fontWeight:800,color:"#111827"}}>협력업체 외주비</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#F8FAFC"}}>
                {["업체명","공종","계약금액","지급률"].map((h,i)=>(
                  <th key={i} style={{padding:"9px 12px",textAlign:i>=2?"right":"left",fontSize:12.5,fontWeight:700,color:"#6B7280",borderBottom:"2px solid #E5E7EB"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.map((v,i)=>(
                <tr key={i} style={{background:i%2===0?"#fff":"#FAFAFA",borderBottom:"1px solid #F3F4F6"}}>
                  <td style={{padding:"9px 12px",fontSize:13.5,fontWeight:600,color:"#111827"}}>{v.name}</td>
                  <td style={{padding:"9px 12px",fontSize:12.5,color:"#6B7280"}}>{v.type||"-"}</td>
                  <td style={{padding:"9px 12px",textAlign:"right",fontSize:13.5,fontWeight:700,color:"#312E81"}}>{v.amount>0?`${v.amount}억`:"-"}</td>
                  <td style={{padding:"9px 12px",textAlign:"right",fontSize:12.5,color:"#374151"}}>{v.ratio>0?`${v.ratio}%`:"-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 기성 수금 계획 등록 ── */}
      <CashPlanEditor proj={proj} cashItems={cashItems} setCashItems={setCashItems} currentUser={undefined}/>
    </div>
  )
}

// ── 기성 수금 계획 등록 컴포넌트 ─────────────────────────────
function CashPlanEditor({proj, cashItems, setCashItems}) {
  const STAGES = ["제안설계","계획설계","기본설계","중간설계","실시설계","준공설계","납품","사업완료","기타"]
  const [showAdd, setShowAdd] = useState(false)
  const [form,    setForm]    = useState({stage:"제안설계",expectedDate:"",amount:"",note:"",isPaid:false,paidDate:""})

  const myItems = (cashItems||[]).filter(i=>{
    const n1=(i.projectName||"").replace(/[\s\-_]/g,"").toLowerCase()
    const n2=(proj.name||"").replace(/[\s\-_]/g,"").toLowerCase().slice(0,8)
    return n1.includes(n2)||n2.includes(n1.slice(0,8))
  })

  const fAmt = v => v>=1e8?`${(v/1e8).toFixed(2)}억`:v>=1e4?`${Math.round(v/1e4).toLocaleString()}만`:v.toLocaleString()+"원"

  const addPlan = () => {
    if(!form.amount||!form.expectedDate) return alert("금액과 예정일을 입력하세요")
    const newItem = {
      id: `CF${Date.now()}`,
      projectName: proj.name,
      dept: (proj.depts||[])[0]||"",
      itemType: "기성",
      stage: form.stage,
      expectedDate: form.expectedDate,
      amount: parseInt(form.amount)||0,
      note: form.note,
      paidDate: form.isPaid ? (form.paidDate||form.expectedDate) : "",
      createdAt: new Date().toISOString(),
    }
    setCashItems(prev=>[...(prev||[]),newItem])
    setForm({stage:"기본설계",expectedDate:"",amount:"",note:"",isPaid:false,paidDate:""})
    setShowAdd(false)
  }

  const delItem = (id) => {
    if(!window.confirm("삭제하시겠습니까?")) return
    setCashItems(prev=>(prev||[]).filter(i=>i.id!==id))
  }

  const totalPlanned = myItems.filter(i=>i.itemType==="기성").reduce((s,i)=>s+(i.amount||0),0)
  const totalPaid    = myItems.filter(i=>i.itemType==="기성"&&i.paidDate).reduce((s,i)=>s+(i.amount||0),0)
  const remain       = (proj.serviceFee||0) - totalPaid

  return (
    <div style={{marginTop:16,background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
      {/* 헤더 */}
      <div style={{background:"linear-gradient(135deg,#059669,#10B981)",padding:"14px 18px",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:15,fontWeight:800,marginBottom:2}}>💧 기성 수금 계획</div>
          <div style={{fontSize:12,opacity:.8}}>단계별 기성 청구·수금 일정을 등록합니다</div>
        </div>
        <div style={{display:"flex",gap:12}}>
          {[["계획합계",totalPlanned,"#D1FAE5","#059669"],["수금완료",totalPaid,"#A7F3D0","#065F46"],["잔액",remain,"#FEF3C7","#D97706"]].map(([l,v,bg,c])=>(
            <div key={l} style={{background:"rgba(255,255,255,.15)",borderRadius:9,padding:"8px 14px",textAlign:"center"}}>
              <div style={{fontSize:10.5,opacity:.8,marginBottom:2}}>{l}</div>
              <div style={{fontSize:14,fontWeight:800}}>{fAmt(v)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 기성 목록 */}
      <div style={{padding:"14px 16px"}}>
        {myItems.filter(i=>i.itemType==="기성").length===0 && !showAdd && (
          <div style={{textAlign:"center",padding:"24px",color:"#9CA3AF",fontSize:13.5}}>
            아직 등록된 기성 수금 계획이 없습니다.
          </div>
        )}
        {myItems.filter(i=>i.itemType==="기성").length > 0 && (
          <div style={{overflowX:"auto",marginBottom:12}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#F0FDF4"}}>
                  {["단계","수금 예정일","금액","수금 완료일","메모",""].map((h,i)=>(
                    <th key={h+i} style={{padding:"8px 12px",textAlign:i>=1&&i<=2?"center":"left",fontSize:12.5,fontWeight:700,color:"#059669",borderBottom:"2px solid #D1FAE5"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myItems.filter(i=>i.itemType==="기성")
                  .sort((a,b)=>(a.expectedDate||"").localeCompare(b.expectedDate||""))
                  .map((item,i)=>{
                    const isPaid = !!item.paidDate
                    return (
                      <tr key={item.id} style={{background:isPaid?"#F0FDF4":i%2===0?"#fff":"#F9FAFB"}}>
                        <td style={{padding:"9px 12px",fontSize:13}}>
                          <span style={{background:isPaid?"#D1FAE5":"#EEF2FF",color:isPaid?"#059669":"#6366F1",padding:"2px 8px",borderRadius:6,fontSize:12,fontWeight:700}}>
                            {item.stage||"기타"}
                          </span>
                        </td>
                        <td style={{padding:"9px 12px",textAlign:"center",fontSize:13,fontWeight:600,color:"#374151"}}>{item.expectedDate||"-"}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",fontSize:14,fontWeight:800,color:"#185FA5"}}>{fAmt(item.amount||0)}</td>
                        <td style={{padding:"9px 12px",textAlign:"center"}}>
                          {isPaid
                            ? <span style={{fontSize:12.5,fontWeight:700,color:"#059669"}}>✅ {item.paidDate}</span>
                            : <span style={{fontSize:12,color:"#9CA3AF"}}>미수금</span>}
                        </td>
                        <td style={{padding:"9px 12px",fontSize:12.5,color:"#6B7280"}}>{item.note||""}</td>
                        <td style={{padding:"6px 8px",textAlign:"center"}}>
                          {!isPaid&&(
                            <button onClick={()=>setCashItems(prev=>(prev||[]).map(ci=>ci.id===item.id?{...ci,paidDate:new Date().toISOString().slice(0,10)}:ci))}
                              style={{padding:"3px 8px",background:"#D1FAE5",color:"#059669",border:"none",borderRadius:6,fontSize:11.5,cursor:"pointer",fontWeight:700,marginRight:4}}>
                              수금처리
                            </button>
                          )}
                          <button onClick={()=>delItem(item.id)}
                            style={{padding:"3px 8px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:6,fontSize:11.5,cursor:"pointer"}}>🗑</button>
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{background:"#ECFDF5",borderTop:"2px solid #059669"}}>
                    <td style={{padding:"9px 12px",fontWeight:800,color:"#059669",fontSize:13}} colSpan={2}>합계</td>
                    <td style={{padding:"9px 12px",textAlign:"right",fontWeight:900,color:"#059669",fontSize:14}}>{fAmt(totalPlanned)}</td>
                    <td style={{padding:"9px 12px",textAlign:"center",fontWeight:700,color:"#065F46",fontSize:13}}>{fAmt(totalPaid)} 수금</td>
                    <td colSpan={2}/>
                  </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 추가 폼 */}
        {showAdd && (
          <div style={{background:"#F0FDF4",borderRadius:12,border:"2px solid #059669",padding:"14px 16px",marginBottom:12}}>
            <div style={{fontSize:13.5,fontWeight:700,color:"#065F46",marginBottom:10}}>+ 기성 수금 계획 등록</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#059669",display:"block",marginBottom:3}}>설계 단계</label>
                <select value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value}))} style={INP()}>
                  {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#059669",display:"block",marginBottom:3}}>수금 예정일 *</label>
                <input type="date" value={form.expectedDate} onChange={e=>setForm(f=>({...f,expectedDate:e.target.value}))} style={INP()}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#059669",display:"block",marginBottom:3}}>금액(원) *</label>
                <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="100000000" style={INP()}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#059669",display:"block",marginBottom:3}}>메모</label>
                <input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="기성 1회차 등" style={INP()}/>
              </div>
            </div>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
              <label style={{display:"flex",gap:6,alignItems:"center",cursor:"pointer",fontSize:13,fontWeight:600}}>
                <input type="checkbox" checked={form.isPaid} onChange={e=>setForm(f=>({...f,isPaid:e.target.checked}))} style={{width:15,height:15}}/>
                이미 수금 완료됨
              </label>
              {form.isPaid&&(
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <label style={{fontSize:12,fontWeight:600,color:"#059669"}}>수금일:</label>
                  <input type="date" value={form.paidDate} onChange={e=>setForm(f=>({...f,paidDate:e.target.value}))} style={{...INP(),width:150}}/>
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={addPlan}
                style={{padding:"8px 20px",background:"#059669",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>💾 등록</button>
              <button onClick={()=>setShowAdd(false)}
                style={{padding:"8px 14px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:9,fontSize:13,cursor:"pointer"}}>취소</button>
            </div>
          </div>
        )}

        {!showAdd&&(
          <button onClick={()=>setShowAdd(true)}
            style={{padding:"8px 18px",background:"#059669",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>
            + 기성 수금 계획 등록
          </button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 🔴 프로젝트 탭 에러 안내
// ══════════════════════════════════════════════════════════════
function ProjTabError() {
  return (
    <div style={{padding:40,textAlign:"center",color:"#6B7280"}}>
      <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
      <div style={{fontSize:15,fontWeight:700,color:"#374151",marginBottom:8}}>프로젝트를 먼저 선택해주세요</div>
      <div style={{fontSize:13}}>왼쪽 목록에서 프로젝트를 선택하면 상세 정보를 볼 수 있습니다.</div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 📊 경영분석 허브 — 서브탭: 대시보드/월수금/계약/지출/인원
// ══════════════════════════════════════════════════════════════
function AnalysisHub({deptStaff,setDeptStaff,years,setYears,canWrite,isAdmin,cashflow,cashItems=[],saleItems=[],contractItems=[],setContractItems,projects=[],setProjects,setTab,setSelProjId,currentUser,yearTargets={},setYearTargets,deptBiz={},staffMonthly={},staffTarget={},setCashItems,setSaleItems,setDetailTab,selProjId,selVerIdx,setSelVerIdx}) {
  const {DEPTS,DEPT_COLORS,DEPT_BIZ} = useDepts()
  const [subTab, setSubTab] = useState("dashboard")
  const NOW   = new Date()
  const YEAR  = NOW.getFullYear()
  const YR    = String(YEAR)

  const SUBS = [
    {id:"dashboard", label:"📊 경영 대시보드"},
    {id:"cash",      label:"💧 월수금현황"},
    {id:"contract",  label:"📝 계약현황"},
    {id:"expense",   label:"💸 지출현황"},
    {id:"staff",     label:"👥 인원 현황"},
    {id:"projects",  label:"🏗 프로젝트현황"},
  ]

  return (
    <div>
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"2px solid #E5E7EB",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {SUBS.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{padding:"10px 16px",border:"none",background:"none",fontSize:13,fontWeight:subTab===t.id?800:500,cursor:"pointer",
              color:subTab===t.id?"#6366F1":"#6B7280",flexShrink:0,
              borderBottom:subTab===t.id?"3px solid #6366F1":"3px solid transparent",marginBottom:-2}}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab==="dashboard" && <AnalysisDashboard projects={projects} cashItems={cashItems} saleItems={saleItems} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS} DEPT_BIZ={DEPT_BIZ} deptStaff={deptStaff} years={years} contractItems={contractItems}/>}

      {subTab==="cash" && <CashflowTab cashflow={cashflow} setCashflow={()=>{}} currentUser={currentUser} projects={projects} setProjects={setProjects} projectCashflowByDept={{}} cashItems={cashItems} setCashItems={setCashItems} saleItems={saleItems} setSaleItems={setSaleItems} setTab={setTab} setSelProjId={setSelProjId} setDetailTab={setDetailTab} yearTargets={yearTargets} setYearTargets={isAdmin?setYearTargets:undefined} deptBiz={deptBiz} deptStaff={deptStaff} staffMonthly={staffMonthly} staffTarget={staffTarget} contractItems={contractItems} setContractItems={setContractItems} initTab="cash" hideTabNav={true}/>}

      {subTab==="contract" && <ContractStatusPage
        contractItems={contractItems} setContractItems={setContractItems}
        DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS}
        currentUser={currentUser} yearTargets={yearTargets} setYearTargets={isAdmin?setYearTargets:undefined}
        deptBiz={deptBiz} YEAR={YEAR} YR={YR}
        setSelProjId={setSelProjId} setTab={setTab} setDetailTab={setDetailTab}
        isAdmin={isAdmin}/>}

      {subTab==="expense" && <CashflowTab cashflow={cashflow} setCashflow={()=>{}} currentUser={currentUser} projects={projects} setProjects={setProjects} projectCashflowByDept={{}} cashItems={cashItems} setCashItems={setCashItems} saleItems={saleItems} setSaleItems={setSaleItems} setTab={setTab} setSelProjId={setSelProjId} setDetailTab={setDetailTab} yearTargets={yearTargets} setYearTargets={isAdmin?setYearTargets:undefined} deptBiz={deptBiz} deptStaff={deptStaff} staffMonthly={staffMonthly} staffTarget={staffTarget} initTab="expense" hideTabNav={true}/>}

      {subTab==="staff" && <StaffStatusPanel DEPT_COLORS={DEPT_COLORS} deptStaff={deptStaff} staffMonthly={staffMonthly} staffTarget={staffTarget}/>}

      {subTab==="projects" && <ProjectsTab projects={projects} setProjects={setProjects} selProjId={selProjId} setSelProjId={setSelProjId} selVerIdx={selVerIdx||0} setSelVerIdx={setSelVerIdx||((v)=>{})} cmpIds={[]} setCmpIds={()=>{}} showNewVer={false} setShowNewVer={()=>{}} canWrite={canWrite} contractTypes={[]} currentUser={currentUser} setDetailTab={setDetailTab} detailTab={undefined} cashItems={cashItems} setCashItems={setCashItems} vendorsDB={{}}/>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 👥 인원 현황 패널
// ══════════════════════════════════════════════════════════════
function StaffStatusPanel({DEPT_COLORS, deptStaff={}, staffMonthly={}, staffTarget={}}) {
  const {STAFF_DEPTS} = useDepts()
  const NOW = new Date(); const YEAR = NOW.getFullYear(); const YR = String(YEAR)
  const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"]
  const num = v => Number.isFinite(+v)?+v:0

  const rows = STAFF_DEPTS.map(dept=>{
    const monthly = staffMonthly?.[dept]?.[YR] || Array(12).fill(0)
    const target  = num(staffTarget?.[dept]?.[YR])||0
    const filled  = monthly.filter(v=>num(v)>0)
    const avg     = filled.length>0 ? Math.round(filled.reduce((s,v)=>s+num(v),0)/filled.length*10)/10 : 0
    const li      = monthly.reduce((best,v,i)=>num(v)>0?i:best, -1)
    const current = li>=0 ? num(monthly[li]) : (deptStaff[dept]?.total||0)
    return {dept, target, avg, current, monthly, color:DEPT_COLORS[dept]||"#6366F1"}
  })

  const totTarget  = rows.reduce((s,d)=>s+d.target,0)
  const totAvg     = Math.round(rows.reduce((s,d)=>s+d.avg,0)*10)/10
  const totCurrent = rows.reduce((s,d)=>s+d.current,0)
  const curMonth   = NOW.getMonth()  // 0-indexed


  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        {[
          {label:"목표 인원",   val:totTarget+"명", color:"#DC2626",bg:"#FEF2F2"},
          {label:"연평균 인원", val:totAvg+"명",    color:"#6B7280",bg:"#F9FAFB"},
          {label:"현재 인원",   val:totCurrent+"명",color:"#312E81",bg:"#EEF2FF"},
        ].map(c=>(
          <div key={c.label} style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"18px 22px",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
            <div style={{fontSize:12.5,color:"#6B7280",fontWeight:600,marginBottom:8}}>{c.label}</div>
            <div style={{fontSize:28,fontWeight:800,color:c.color}}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid #E5E7EB",fontSize:15,fontWeight:800,color:"#111827"}}>
          {YEAR}년 본부별 인원 현황 (단위: 명)
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
            <thead>
              <tr>
                <th style={{...TH("left","#374151"),minWidth:120}}>본부</th>
                <th style={TH("right","#DC2626","#FEF2F2")}>목표</th>
                <th style={TH("right","#6B7280")}>연평균</th>
                <th style={TH("right","#312E81","#EEF2FF")}>현재</th>
                {MONTHS.map((m,mi)=>(
                  <th key={m} style={TH("right",mi===curMonth?"#DC2626":"#6B7280",mi===curMonth?"#FEF2F2":"#F8FAFC")}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d,i)=>(
                <tr key={d.dept} style={{background:i%2===0?"#fff":"#FAFAFA"}}>
                  <td style={{padding:"9px 11px",textAlign:"left",borderBottom:"1px solid #F3F4F6"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:9,height:9,borderRadius:"50%",background:d.color,flexShrink:0}}/>
                      <span style={{fontSize:13.5,fontWeight:700,color:"#111827"}}>{d.dept}</span>
                    </div>
                  </td>
                  <td style={TD("#DC2626",true,"#FEF2F2")}>{d.target>0?d.target:"-"}</td>
                  <td style={TD("#6B7280")}>{d.avg>0?d.avg:"-"}</td>
                  <td style={TD("#312E81",true,"#EEF2FF")}>{d.current>0?d.current:"-"}</td>
                  {d.monthly.map((v,mi)=>(
                    <td key={mi} style={TD(num(v)>0?"#374151":"#D1D5DB",mi===curMonth,mi===curMonth?"#FEF2F2":"transparent")}>
                      {num(v)>0?v:"-"}
                    </td>
                  ))}
                </tr>
              ))}
              <tr style={{background:"#EEF2FF",borderTop:"2px solid #E5E7EB"}}>
                <td style={{padding:"10px 11px",textAlign:"left",fontSize:14,fontWeight:800,color:"#312E81"}}>합계</td>
                <td style={TD("#DC2626",true,"#C4B5FD")}>{totTarget||"-"}</td>
                <td style={TD("#6B7280",true)}>{totAvg||"-"}</td>
                <td style={TD("#312E81",true,"#C4B5FD")}>{totCurrent}</td>
                {Array.from({length:12},(_,mi)=>{
                  const s = rows.reduce((acc,d)=>acc+num(d.monthly[mi]),0)
                  return <td key={mi} style={TD(s>0?"#312E81":"#D1D5DB",true,mi===curMonth?"#FEF2F2":"transparent")}>{s||"-"}</td>
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 📝 계약 상세 탭 — 전체 필드 (본부복수, 수주형태, 우선순위)
// ══════════════════════════════════════════════════════════════
function ProjectContractDetailFull({proj, setProjects, canWrite, projects=[]}) {
  const {DEPTS} = useDepts()
  const fAmt = n => n>=1e8?`${(n/1e8).toFixed(2)}억`:n>=1e4?`${(n/1e4).toFixed(0)}만`:n>0?n.toLocaleString()+"원":"-"

  const [editing, setEditing]   = useState(false)
  const [draft,   setDraft]     = useState({})
  const [bidTypes,setBidTypesRaw] = useState(()=>{
    try{return JSON.parse(localStorage.getItem("sjs_bid_types")||"null")||
      ["민간/실시기술","현상설계","민간/사업공모","설계변경","기술제안","설계공모","특수목적법인"]
    }catch{return["민간/실시기술","현상설계","민간/사업공모","설계변경","기술제안"]}
  })
  const setBidTypes = v => {
    const n=typeof v==="function"?v(bidTypes):v
    try{localStorage.setItem("sjs_bid_types",JSON.stringify(n))}catch{}
    setBidTypesRaw(n)
  }
  const [newBT, setNewBT] = useState("")

  const startEdit = () => {
    setDraft({
      depts:            proj.depts||[],
      name:             proj.name||"",
      totalFee:         proj.totalFee||(proj.serviceFee||0),
      shareRatio:       proj.shareRatio||(proj.jvMembers?.length?0:1),
      serviceFee:       proj.serviceFee||0,
      execDate:         proj.execDate||"",
      contractExpect:   proj.contractExpect||"",
      announcementDate: proj.announcementDate||"",
      jvType:           proj.jvType||"단독이행",
      jvMembers:        (proj.jvMembers||[]).map(m=>({...m})),
      bidType:          proj.bidType||"",
      orderType:        proj.orderType||"공공",
      priority:         proj.priority||false,
      type:             proj.type||"추진",
      contractDate:     proj.contractDate||"",
      orderDate:        proj.orderDate||"",
      note:             proj.note||"",
      memo:             proj.memo||"",
    })
    setEditing(true)
  }
  const save = () => { setProjects(prev=>prev.map(p=>p.id===proj.id?{...p,...draft}:p)); setEditing(false) }
  const u = (k,v) => setDraft(p=>({...p,[k]:v}))
  const toggleDept = d => { const cur=draft.depts||[]; u("depts",cur.includes(d)?cur.filter(x=>x!==d):[...cur,d]) }

  const TYPE_C = {확정:"#6366F1",계약:"#059669",추진:"#D97706",완료:"#9CA3AF"}

  if(!editing) return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {proj.type&&<span style={{padding:"4px 14px",borderRadius:20,fontSize:13,fontWeight:700,background:(TYPE_C[proj.type]||"#9CA3AF")+"18",color:TYPE_C[proj.type]||"#9CA3AF"}}>{proj.type}</span>}
          {proj.priority&&<span style={{fontSize:13,fontWeight:700,color:"#D97706"}}>⭐ 우선순위</span>}
          {proj.orderType&&<span style={{padding:"3px 10px",borderRadius:20,fontSize:12,background:"#EEF2FF",color:"#6366F1",fontWeight:600}}>{proj.orderType}</span>}
          {proj.bidType&&<span style={{padding:"3px 10px",borderRadius:20,fontSize:12,background:"#F0FDF4",color:"#059669",fontWeight:600}}>{proj.bidType}</span>}
        </div>
        {canWrite&&<button onClick={startEdit} style={{padding:"8px 16px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>✏ 수정</button>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"16px 18px"}}>
          <div style={{fontSize:13,fontWeight:800,color:"#374151",marginBottom:10}}>기본 정보</div>
          {[["담당 본부",(proj.depts||[]).join(", ")||"-"],["발주구분",proj.orderType||"-"],["수주형태",proj.bidType||"-"],["공동이행",proj.jvType||"단독이행"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid #F3F4F6"}}>
              <span style={{fontSize:12,color:"#6B7280",fontWeight:600,width:80,flexShrink:0}}>{k}</span>
              <span style={{fontSize:13.5,fontWeight:600,color:"#111827"}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"16px 18px"}}>
          <div style={{fontSize:13,fontWeight:800,color:"#374151",marginBottom:10}}>금액 정보</div>
          {[["총 설계비",proj.totalFee>0?fAmt(proj.totalFee):proj.serviceFee>0?fAmt(proj.serviceFee):"-"],["상지 지분",proj.shareRatio>0?`${(proj.shareRatio*100).toFixed(0)}%`:"-"],["용역비(상지)",proj.serviceFee>0?fAmt(proj.serviceFee):"-"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid #F3F4F6"}}>
              <span style={{fontSize:12,color:"#6B7280",fontWeight:600,width:80,flexShrink:0}}>{k}</span>
              <span style={{fontSize:13.5,fontWeight:700,color:"#312E81"}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"16px 18px"}}>
          <div style={{fontSize:13,fontWeight:800,color:"#374151",marginBottom:10}}>일정 정보</div>
          {[["수행시점",proj.execDate||"-"],["계약예상",proj.contractExpect||"-"],["공고일",proj.announcementDate||"-"],["계약일",proj.contractDate||"-"],["수주일",proj.orderDate||"-"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid #F3F4F6"}}>
              <span style={{fontSize:12,color:"#6B7280",fontWeight:600,width:80,flexShrink:0}}>{k}</span>
              <span style={{fontSize:13.5,color:"#374151"}}>{v}</span>
            </div>
          ))}
        </div>
        {(proj.note||proj.memo)&&(
          <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"16px 18px"}}>
            <div style={{fontSize:13,fontWeight:800,color:"#374151",marginBottom:10}}>비고 / 메모</div>
            {proj.note&&<div style={{fontSize:13.5,color:"#374151",marginBottom:8,lineHeight:1.7}}>{proj.note}</div>}
            {proj.memo&&<div style={{fontSize:13,color:"#6B7280",lineHeight:1.7}}>{proj.memo}</div>}
          </div>
        )}
      </div>
      {(proj.jvMembers||[]).length>0&&(
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"16px 18px",marginTop:14}}>
          <div style={{fontSize:13,fontWeight:800,color:"#374151",marginBottom:10}}>컨소시엄 구성</div>
          {proj.jvMembers.map((m,i)=>(
            <div key={i} style={{display:"flex",gap:12,padding:"8px 0",borderBottom:"1px solid #F3F4F6",alignItems:"center"}}>
              <span style={{fontSize:13.5,fontWeight:700,color:"#111827",flex:1}}>{m.name||"-"}</span>
              <span style={{fontSize:13,color:"#6366F1",fontWeight:600}}>{m.ratio>0?m.ratio+"%":""}</span>
              <span style={{fontSize:13,color:"#059669",fontWeight:600}}>{m.amount>0?m.amount+"억":""}</span>
              <span style={{fontSize:12,color:"#6B7280"}}>{m.role||""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:15,fontWeight:800,color:"#312E81"}}>📝 계약 정보 수정</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={save} style={{padding:"9px 20px",background:"#6366F1",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>저장</button>
          <button onClick={()=>setEditing(false)} style={{padding:"9px 16px",background:"#F3F4F6",color:"#374151",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>취소</button>
        </div>
      </div>

      {/* 단계 + 우선순위 */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"16px 18px",marginBottom:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>프로젝트 단계</label>
            <select value={draft.type||""} onChange={e=>u("type",e.target.value)} style={INP()}>
              {["추진","확정","계약","완료"].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,background:"#FEF3C7",borderRadius:10,padding:"12px 16px",border:"1px solid #D97706"}}>
            <input type="checkbox" id="priority-chk" checked={draft.priority||false} onChange={e=>u("priority",e.target.checked)} style={{width:16,height:16,cursor:"pointer"}}/>
            <label htmlFor="priority-chk" style={{fontSize:13.5,fontWeight:700,color:"#92400E",cursor:"pointer"}}>⭐ 우선순위 프로젝트 (목록 상단 고정)</label>
          </div>
        </div>

        {/* 담당 본부 다중선택 */}
        <div>
          <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:8}}>담당 본부 (복수 선택)</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {DEPTS.map(d=>{
              const sel=(draft.depts||[]).includes(d)
              return <button key={d} onClick={()=>toggleDept(d)}
                style={{padding:"6px 14px",border:`2px solid ${sel?"#6366F1":"#E5E7EB"}`,borderRadius:20,fontSize:13,fontWeight:600,cursor:"pointer",
                  background:sel?"#EEF2FF":"#fff",color:sel?"#6366F1":"#6B7280"}}>{d}</button>
            })}
          </div>
        </div>
      </div>

      {/* 금액 */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"16px 18px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:800,color:"#374151",marginBottom:12}}>금액 정보</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>총 설계비(예상) — 원</label>
            <input type="number" value={draft.totalFee||""} onChange={e=>u("totalFee",parseInt(e.target.value)||0)} style={INP()}/>
            {draft.totalFee>0&&<div style={{fontSize:11,color:"#6366F1",marginTop:3}}>{fAmt(draft.totalFee)}</div>}
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>상지 지분 (%)</label>
            <input type="number" min={0} max={100} value={Math.round((draft.shareRatio||0)*100)||""} onChange={e=>u("shareRatio",(parseFloat(e.target.value)||0)/100)} style={INP()}/>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#6366F1",display:"block",marginBottom:5}}>용역비(예상) — 원</label>
            <input type="number" value={draft.serviceFee||""} onChange={e=>u("serviceFee",parseInt(e.target.value)||0)} style={{...INP(),borderColor:"#6366F1"}}/>
            {draft.totalFee>0&&draft.shareRatio>0&&<button onClick={()=>u("serviceFee",Math.round(draft.totalFee*(draft.shareRatio||1)))}
              style={{marginTop:5,padding:"4px 10px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:6,fontSize:11.5,fontWeight:700,cursor:"pointer"}}>
              지분기준 자동계산 ({fAmt(Math.round(draft.totalFee*(draft.shareRatio||1)))})
            </button>}
          </div>
        </div>
      </div>

      {/* 일정 */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"16px 18px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:800,color:"#374151",marginBottom:12}}>일정 정보</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {[["수행시점(예상)","execDate"],["계약 예상 시점","contractExpect"],["공고일(예정)","announcementDate"],["계약일","contractDate"],["수주일","orderDate"]].map(([label,key])=>(
            <div key={key}>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>{label}</label>
              <input type="date" value={draft[key]||""} onChange={e=>u(key,e.target.value)} style={INP()}/>
            </div>
          ))}
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>발주구분</label>
            <select value={draft.orderType||"공공"} onChange={e=>u("orderType",e.target.value)} style={INP()}>
              {["공공","민간","해외"].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 수주형태 */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"16px 18px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:800,color:"#374151",marginBottom:10}}>수주형태</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          {bidTypes.map(bt=>{
            const sel=draft.bidType===bt
            return <button key={bt} onClick={()=>u("bidType",bt)}
              style={{padding:"6px 14px",border:`2px solid ${sel?"#6366F1":"#E5E7EB"}`,borderRadius:20,fontSize:12.5,fontWeight:600,cursor:"pointer",
                background:sel?"#EEF2FF":"#fff",color:sel?"#6366F1":"#6B7280"}}>{bt}</button>
          })}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={newBT} onChange={e=>setNewBT(e.target.value)} placeholder="새 수주형태 추가..."
            onKeyDown={e=>e.key==="Enter"&&newBT.trim()&&(setBidTypes(p=>[...p,newBT.trim()]),setNewBT(""))}
            style={{...INP(),flex:1}}/>
          <button onClick={()=>newBT.trim()&&(setBidTypes(p=>[...p,newBT.trim()]),setNewBT(""))}
            style={{padding:"9px 14px",background:"#6366F1",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>추가</button>
          {draft.bidType&&<button onClick={()=>{setBidTypes(p=>p.filter(b=>b!==draft.bidType));u("bidType","")}}
            style={{padding:"9px 12px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:9,fontSize:13,cursor:"pointer"}}>삭제</button>}
        </div>
      </div>

      {/* 컨소시엄 */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"16px 18px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:800,color:"#374151"}}>컨소시엄 구성</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <select value={draft.jvType||"단독이행"} onChange={e=>u("jvType",e.target.value)} style={{...INP(),width:"auto",padding:"7px 10px"}}>
              {["단독이행","공동이행","분리이행"].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={()=>u("jvMembers",[...(draft.jvMembers||[]),{name:"",ratio:0,amount:0,role:""}])}
              style={{padding:"8px 14px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>+ 추가</button>
          </div>
        </div>
        {(draft.jvMembers||[]).map((m,mi)=>(
          <div key={mi} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:8,marginBottom:8}}>
            <input value={m.name} onChange={e=>{const jv=[...draft.jvMembers];jv[mi]={...m,name:e.target.value};u("jvMembers",jv)}} placeholder="회사명" style={INP()}/>
            <input type="number" value={m.ratio||""} onChange={e=>{const jv=[...draft.jvMembers];jv[mi]={...m,ratio:parseFloat(e.target.value)||0};u("jvMembers",jv)}} placeholder="지분%" style={INP()}/>
            <input type="number" value={m.amount||""} onChange={e=>{const jv=[...draft.jvMembers];jv[mi]={...m,amount:parseFloat(e.target.value)||0};u("jvMembers",jv)}} placeholder="금액(억)" style={INP()}/>
            <select value={m.role||"분담이행"} onChange={e=>{const jv=[...draft.jvMembers];jv[mi]={...m,role:e.target.value};u("jvMembers",jv)}} style={{...INP(),padding:"7px 8px"}}>
                  {["주관사","부관사","분담이행","특수목적법인"].map(r=><option key={r} value={r}>{r}</option>)}
                </select>
            <button onClick={()=>u("jvMembers",draft.jvMembers.filter((_,i2)=>i2!==mi))}
              style={{padding:"8px 10px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:8,cursor:"pointer"}}>✕</button>
          </div>
        ))}
      </div>

      {/* 비고/메모 */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"16px 18px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>비고</label>
            <textarea value={draft.note||""} onChange={e=>u("note",e.target.value)} rows={3} style={{...INP(),resize:"vertical"}}/>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>메모</label>
            <textarea value={draft.memo||""} onChange={e=>u("memo",e.target.value)} rows={3} style={{...INP(),resize:"vertical"}}/>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 월수금 전체 데이터 내보내기 (관리자용)
// ══════════════════════════════════════════════════════════════
function downloadCashDataExcel(cashItems=[], label="월수금계획") {
  const fixDate = s => {
    if(!s) return ""
    const n=parseInt(String(s))
    if(!isNaN(n)&&n>40000&&n<60000){const d=new Date((n-25569)*86400*1000);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`}
    return String(s).trim()
  }
  // ID 컬럼은 숨김 처리(Z열 이후) - 사용자에게 보이지 않고 내부 업데이트용
  const rows = [
    ["※ 4행부터 데이터 입력/수정. 금액은 원(₩) 단위 숫자. 시스템ID열(마지막)은 건드리지 마세요."],
    [],
    ["본부","발주구분","구분","프로젝트명","기성단계","입금완료일(YYYY-MM-DD)","입금예상일(YYYY-MM-DD)","금액(원)","메모","[시스템ID-수정금지]"],
    ...cashItems.map(i=>[
      i.dept||"", i.orderType||"", i.itemType||"",
      i.projectName||"", i.stage||"",
      fixDate(i.paidDate), fixDate(i.expectedDate),
      i.amount||0, i.memo||"",
      i.id||""   // 마지막 컬럼에 ID (수정 금지 안내)
    ])
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [{wch:14},{wch:10},{wch:8},{wch:32},{wch:24},{wch:16},{wch:16},{wch:14},{wch:20},{wch:20}]
  // 마지막 열(ID) 숨김
  ws["!cols"][9] = {wch:20, hidden:true}
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, label)
  XLSX.writeFile(wb, `상지서울_${label}_${new Date().toISOString().slice(0,10)}.xlsx`)
}

// ══════════════════════════════════════════════════════════════
// 📋 대량 입력 도구 — 스프레드시트 형식으로 여러 행 한번에 입력
// ══════════════════════════════════════════════════════════════
function BulkInputTool({DEPTS, projects, onSave, onClose}) {
  const EMPTY_ROW = () => ({dept:"", orderType:"민간", itemType:"기성", projectName:"", stage:"", paidDate:"", expectedDate:"", amount:"", memo:""})
  const INIT_ROWS = 10

  const [rows, setRows] = useState(()=>Array.from({length:INIT_ROWS}, EMPTY_ROW))
  const [errors, setErrors] = useState({})
  const [pasteMsg, setPasteMsg] = useState("")

  const projNames = [...new Set([...(projects||[]).map(p=>p.name)])].filter(Boolean)
  const u = (ri, key, val) => setRows(prev=>prev.map((r,i)=>i===ri?{...r,[key]:val}:r))

  // 행 추가/삭제
  const addRow  = () => setRows(p=>[...p, EMPTY_ROW()])
  const delRow  = ri => setRows(p=>p.filter((_,i)=>i!==ri))
  const addRows = n => setRows(p=>[...p,...Array.from({length:n},EMPTY_ROW)])

  // 붙여넣기 처리 (엑셀 복사→붙여넣기)
  const handlePaste = (e, startRow, startCol) => {
    const text = e.clipboardData.getData('text')
    if(!text.includes('\t') && !text.includes('\n')) return
    e.preventDefault()

    const COLS = ['dept','orderType','itemType','projectName','stage','paidDate','expectedDate','amount','memo']
    const pastedRows = text.trim().split('\n').map(line=>line.split('\t'))

    setRows(prev => {
      const next = [...prev]
      pastedRows.forEach((cells, ri) => {
        const targetRow = startRow + ri
        // 행이 부족하면 자동 추가
        while(next.length <= targetRow) next.push(EMPTY_ROW())
        cells.forEach((cell, ci) => {
          const colIdx = startCol + ci
          if(colIdx < COLS.length) {
            const key = COLS[colIdx]
            let val = cell.trim()
            // 금액 컬럼: 쉼표 제거
            if(key==='amount') val = val.replace(/[,원억만]/g,'')
            next[targetRow] = {...next[targetRow], [key]: val}
          }
        })
      })
      return next
    })
    setPasteMsg(`✓ ${pastedRows.length}행 붙여넣기 완료`)
    setTimeout(()=>setPasteMsg(""), 2000)
  }

  // 저장
  const handleSave = () => {
    const errs = {}
    const valid = rows.filter((r,ri) => {
      if(!r.projectName?.trim() && !r.dept?.trim()) return false // 완전 빈 행 제외
      if(!r.projectName?.trim()) { errs[`${ri}_proj`] = true; return false }
      if(!r.paidDate && !r.expectedDate) { errs[`${ri}_date`] = true; return false }
      if(!r.amount || parseInt(r.amount)<=0) { errs[`${ri}_amt`] = true; return false }
      return true
    }).map(r=>({
      ...r,
      amount: parseInt(String(r.amount).replace(/[^0-9]/g,''))||0,
    }))

    if(Object.keys(errs).length > 0) {
      setErrors(errs)
      alert(`⚠ ${Object.keys(errs).length}개 필드를 확인하세요.\n• 프로젝트명 필수\n• 입금완료일 또는 입금예상일 중 1개 필수\n• 금액 필수`)
      return
    }
    if(valid.length===0) { alert("입력된 데이터가 없습니다."); return }
    if(window.confirm(`${valid.length}건을 저장하시겠습니까?`)) onSave(valid)
  }


  const fPreview = n => {
    const num = parseInt(String(n).replace(/[^0-9]/g,''))
    if(!num) return ""
    if(num>=1e8) return `${(num/1e8).toFixed(2)}억`
    if(num>=1e4) return `${Math.round(num/1e4)}만`
    return num.toLocaleString()+"원"
  }

  return (
    <div style={{background:"#1E293B",borderRadius:14,padding:"18px 20px",marginBottom:14,color:"#fff"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>📋 대량 입력 도구</div>
          <div style={{fontSize:12,color:"#94A3B8",lineHeight:1.6}}>
            엑셀에서 셀을 복사(Ctrl+C) 후 아래 표의 셀을 클릭하고 붙여넣기(Ctrl+V)하면 한번에 입력됩니다.
            컬럼 순서: 본부 → 발주구분 → 구분 → 프로젝트명 → 기성단계 → 입금완료일 → 입금예상일 → 금액 → 메모
          </div>
        </div>
        <button onClick={onClose} style={{padding:"6px 12px",background:"#374151",color:"#fff",border:"none",borderRadius:8,fontSize:13,cursor:"pointer"}}>✕ 닫기</button>
      </div>

      {pasteMsg&&<div style={{background:"#059669",color:"#fff",padding:"8px 14px",borderRadius:8,marginBottom:10,fontSize:13,fontWeight:700}}>{pasteMsg}</div>}

      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:1100}}>
          <thead>
            <tr style={{background:"#334155"}}>
              {[["#","32px"],["본부","100px"],["발주","70px"],["구분","70px"],["프로젝트명","220px"],["기성단계","120px"],["입금완료일","120px"],["입금예상일","120px"],["금액(원)","130px"],["미리보기","80px"],["메모","120px"],["삭제","40px"]].map(([h,w])=>(
                <th key={h} style={{padding:"8px 6px",textAlign:"center",fontSize:11.5,fontWeight:700,color:"#94A3B8",borderBottom:"2px solid #475569",minWidth:w,width:w,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,ri)=>(
              <tr key={ri} style={{background:ri%2===0?"#1E293B":"#263347",borderBottom:"1px solid #334155"}}>
                <td style={{padding:"4px 6px",textAlign:"center",fontSize:12,color:"#64748B",fontWeight:600}}>{ri+1}</td>

                {/* 본부 */}
                <td style={{padding:"3px 4px"}}>
                  <select value={row.dept} onChange={e=>u(ri,"dept",e.target.value)}
                    onPaste={e=>handlePaste(e,ri,0)}
                    style={{...INP(errors[`${ri}_dept`]),fontSize:12,padding:"5px 4px"}}>
                    <option value="">선택</option>
                    {DEPTS.map(d=><option key={d} value={d}>{d.replace("본부","")}</option>)}
                  </select>
                </td>

                {/* 발주구분 */}
                <td style={{padding:"3px 4px"}}>
                  <select value={row.orderType} onChange={e=>u(ri,"orderType",e.target.value)}
                    style={{...INP(),fontSize:12,padding:"5px 4px"}}>
                    {["민간","공공","해외"].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </td>

                {/* 구분 */}
                <td style={{padding:"3px 4px"}}>
                  <select value={row.itemType} onChange={e=>u(ri,"itemType",e.target.value)}
                    style={{...INP(),fontSize:12,padding:"5px 4px"}}>
                    {["기성","확정","추진","미정","신규","정산"].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </td>

                {/* 프로젝트명 */}
                <td style={{padding:"3px 4px"}}>
                  <input
                    list={`proj-bulk-${ri}`}
                    value={row.projectName}
                    onChange={e=>u(ri,"projectName",e.target.value)}
                    onPaste={e=>handlePaste(e,ri,3)}
                    placeholder="프로젝트명"
                    style={{...INP(errors[`${ri}_proj`]),fontSize:12}}
                  />
                  <datalist id={`proj-bulk-${ri}`}>{projNames.map(n=><option key={n} value={n}/>)}</datalist>
                </td>

                {/* 기성단계 */}
                <td style={{padding:"3px 4px"}}>
                  <input value={row.stage} onChange={e=>u(ri,"stage",e.target.value)}
                    onPaste={e=>handlePaste(e,ri,4)}
                    placeholder="1차기성" style={{...INP(),fontSize:12}}/>
                </td>

                {/* 입금완료일 */}
                <td style={{padding:"3px 4px"}}>
                  <input type="date" value={row.paidDate||""} onChange={e=>u(ri,"paidDate",e.target.value)}
                    style={{...INP(errors[`${ri}_date`]&&!row.paidDate&&!row.expectedDate),fontSize:12}}/>
                </td>

                {/* 입금예상일 */}
                <td style={{padding:"3px 4px"}}>
                  <input type="date" value={row.expectedDate||""} onChange={e=>u(ri,"expectedDate",e.target.value)}
                    style={{...INP(errors[`${ri}_date`]&&!row.paidDate&&!row.expectedDate),fontSize:12}}/>
                </td>

                {/* 금액 */}
                <td style={{padding:"3px 4px"}}>
                  <input type="text" inputMode="numeric"
                    value={row.amount}
                    onChange={e=>u(ri,"amount",e.target.value.replace(/[^0-9]/g,''))}
                    onPaste={e=>handlePaste(e,ri,7)}
                    placeholder="원 단위"
                    style={{...INP(errors[`${ri}_amt`]),fontSize:12}}/>
                </td>

                {/* 미리보기 */}
                <td style={{padding:"3px 6px",textAlign:"right",fontSize:12,color:"#34D399",fontWeight:600,whiteSpace:"nowrap"}}>
                  {fPreview(row.amount)}
                </td>

                {/* 메모 */}
                <td style={{padding:"3px 4px"}}>
                  <input value={row.memo} onChange={e=>u(ri,"memo",e.target.value)}
                    placeholder="메모" style={{...INP(),fontSize:12}}/>
                </td>

                {/* 삭제 */}
                <td style={{padding:"3px 4px",textAlign:"center"}}>
                  <button onClick={()=>delRow(ri)}
                    style={{padding:"3px 7px",background:"#DC2626",color:"#fff",border:"none",borderRadius:5,fontSize:12,cursor:"pointer"}}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 하단 버튼 */}
      <div style={{display:"flex",gap:8,marginTop:12,alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={addRow} style={{padding:"7px 14px",background:"#334155",color:"#fff",border:"none",borderRadius:8,fontSize:13,cursor:"pointer"}}>+ 행 추가</button>
        <button onClick={()=>addRows(10)} style={{padding:"7px 14px",background:"#334155",color:"#fff",border:"none",borderRadius:8,fontSize:13,cursor:"pointer"}}>+ 10행</button>
        <button onClick={()=>setRows(Array.from({length:INIT_ROWS},EMPTY_ROW))} style={{padding:"7px 14px",background:"#475569",color:"#fff",border:"none",borderRadius:8,fontSize:13,cursor:"pointer"}}>🔄 초기화</button>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <div style={{fontSize:12,color:"#94A3B8",alignSelf:"center"}}>
            {rows.filter(r=>r.projectName?.trim()).length}행 입력됨
          </div>
          <button onClick={handleSave}
            style={{padding:"10px 24px",background:"#6366F1",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:"pointer"}}>
            💾 저장
          </button>
        </div>
      </div>

      {/* 입력 가이드 */}
      <div style={{marginTop:12,padding:"10px 14px",background:"#0F172A",borderRadius:10,fontSize:12,color:"#64748B",lineHeight:1.8}}>
        <strong style={{color:"#94A3B8"}}>💡 사용 팁</strong><br/>
        • 엑셀에서 데이터를 복사 후 <strong style={{color:"#C4B5FD"}}>첫 번째 셀 클릭 → Ctrl+V</strong> 로 한번에 붙여넣기<br/>
        • 날짜는 <strong style={{color:"#C4B5FD"}}>YYYY-MM-DD</strong> 형식으로 입력 (또는 달력 선택)<br/>
        • 금액은 <strong style={{color:"#34D399"}}>원 단위</strong> 숫자만 입력 (쉼표 자동 제거)<br/>
        • 입금완료일 = 이미 받은 금액 / 입금예상일 = 앞으로 받을 금액<br/>
        • 구분: 기성(완료됨), 확정(예정), 추진(추진중), 미정(불확실)
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 🔔 토스트 메시지 시스템
// ══════════════════════════════════════════════════════════════
const ToastCtx = React.createContext(()=>{})

function ToastProvider({children}) {
  const [toasts, setToasts] = useState([])
  const show = useCallback((msg, type="success", duration=3000) => {
    const id = Date.now()
    setToasts(p=>[...p, {id, msg, type}])
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)), duration)
  }, [])

  const TYPE = {
    success: {bg:"#059669", icon:"✅"},
    error:   {bg:"#DC2626", icon:"❌"},
    info:    {bg:"#6366F1", icon:"ℹ️"},
    warning: {bg:"#D97706", icon:"⚠️"},
  }

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div style={{position:"fixed",bottom:28,right:24,zIndex:9999,display:"flex",flexDirection:"column-reverse",gap:10,pointerEvents:"none"}}>
        {toasts.map(t=>{
          const s = TYPE[t.type]||TYPE.success
          return (
            <div key={t.id} style={{
              background:s.bg, color:"#fff", padding:"12px 20px",
              borderRadius:12, fontSize:14, fontWeight:600,
              boxShadow:"0 4px 20px rgba(0,0,0,.25)",
              display:"flex", alignItems:"center", gap:10,
              minWidth:220, maxWidth:380,
              animation:"slideUp .25s ease",
              pointerEvents:"auto",
            }}>
              <span style={{fontSize:18}}>{s.icon}</span>
              <span style={{lineHeight:1.4}}>{t.msg}</span>
            </div>
          )
        })}
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </ToastCtx.Provider>
  )
}

function useToast() { return React.useContext(ToastCtx) }

// ══════════════════════════════════════════════════════════════
// ✏ 인라인 수정 폼
// ══════════════════════════════════════════════════════════════
function InlineEditForm({form, setForm, DEPTS, projNames, isSale, onSave, onCancel}) {
  const u = (k,v) => setForm(p=>({...p,[k]:v}))
  const ITEM_TYPES = isSale ? ["세금계산서","선급금"] : ["기성","확정","미정","추진","신규","정산","선급금","어음"]

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
      <div>
        <div style={{fontSize:11,color:"#6366F1",fontWeight:700,marginBottom:3}}>본부</div>
        <select value={form.dept||""} onChange={e=>u("dept",e.target.value)} style={INP()}>
          <option value="">선택</option>
          {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div>
        <div style={{fontSize:11,color:"#6366F1",fontWeight:700,marginBottom:3}}>발주구분</div>
        <select value={form.orderType||"민간"} onChange={e=>u("orderType",e.target.value)} style={INP()}>
          {["민간","공공","해외"].map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <div style={{fontSize:11,color:"#6366F1",fontWeight:700,marginBottom:3}}>구분</div>
        <select value={form.itemType||""} onChange={e=>u("itemType",e.target.value)} style={INP()}>
          {ITEM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{gridColumn:"span 2"}}>
        <div style={{fontSize:11,color:"#6366F1",fontWeight:700,marginBottom:3}}>프로젝트명</div>
        <input list="inline-proj-list" value={form.projectName||""} onChange={e=>u("projectName",e.target.value)} style={INP()} placeholder="프로젝트명"/>
        <datalist id="inline-proj-list">{projNames.map(n=><option key={n} value={n}/>)}</datalist>
      </div>
      <div>
        <div style={{fontSize:11,color:"#6366F1",fontWeight:700,marginBottom:3}}>입금완료일</div>
        <input type="date" value={form.paidDate||""} onChange={e=>u("paidDate",e.target.value)} style={INP()}/>
      </div>
      <div>
        <div style={{fontSize:11,color:"#6366F1",fontWeight:700,marginBottom:3}}>입금예상일</div>
        <input type="date" value={form.expectedDate||""} onChange={e=>u("expectedDate",e.target.value)} style={INP()}/>
      </div>
      <div>
        <div style={{fontSize:11,color:"#6366F1",fontWeight:700,marginBottom:3}}>금액(원)</div>
        <input type="number" value={form.amount||""} onChange={e=>u("amount",parseInt(e.target.value)||0)} style={INP()} placeholder="원 단위"/>
      </div>
      <div style={{display:"flex",gap:6,paddingBottom:0}}>
        <button onClick={onSave}
          style={{padding:"8px 16px",background:"#6366F1",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
          💾 저장
        </button>
        <button onClick={onCancel}
          style={{padding:"8px 12px",background:"#F3F4F6",color:"#374151",border:"none",borderRadius:8,fontSize:13,cursor:"pointer"}}>
          취소
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 🏠 모바일 허브 홈페이지
// ══════════════════════════════════════════════════════════════
function MobileHub({setTab, tabOrder=[], currentUser, projects=[], cashItems=[]}) {
  const [search, setSearch] = useState("")
  const [favorites, setFavorites] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem("sjs_hub_favorites")||"[]") }catch{ return [] }
  })

  const toggleFav = (id) => {
    const next = favorites.includes(id) ? favorites.filter(f=>f!==id) : [...favorites, id]
    setFavorites(next)
    try{ localStorage.setItem("sjs_hub_favorites", JSON.stringify(next)) }catch{}
  }

  // 허브 메뉴 정의
  const HUB_MENUS = [
    {
      group: "📊 경영관리",
      color: "#6366F1",
      bg: "#EEF2FF",
      items: [
        {id:"analysis", icon:"📊", label:"경영분석",    sub:"MANAGEMENT ANALYSIS"},
        {id:"deptdash", icon:"🏢", label:"본부별 현황", sub:"DEPT DASHBOARD"},
        {id:"notice",   icon:"📢", label:"공지사항",    sub:"NOTICE"},
        {id:"stats",    icon:"📈", label:"사용 통계",   sub:"STATISTICS"},
      ]
    },
    {
      group: "🏗 프로젝트",
      color: "#059669",
      bg: "#D1FAE5",
      items: [
        {id:"projects", icon:"🏗", label:"프로젝트",    sub:"PROJECTS"},
        {id:"history",  icon:"📜", label:"히스토리",    sub:"HISTORY"},
        {id:"calendar", icon:"📅", label:"일정 캘린더", sub:"CALENDAR"},
      ]
    },
    {
      group: "💧 수금·계약",
      color: "#0891B2",
      bg: "#E0F7FA",
      items: [
        {id:"analysis", icon:"💧", label:"월수금현황",  sub:"CASHFLOW", subTab:"cash"},
        {id:"analysis", icon:"📝", label:"계약현황",    sub:"CONTRACT",  subTab:"contract"},
        {id:"analysis", icon:"💸", label:"지출현황",    sub:"EXPENSE",   subTab:"expense"},
        {id:"analysis", icon:"👥", label:"인원현황",    sub:"STAFF",     subTab:"staff"},
      ]
    },
    {
      group: "📁 문서·관리",
      color: "#D97706",
      bg: "#FEF3C7",
      items: [
        {id:"contract", icon:"📄", label:"계약서",      sub:"CONTRACTS"},
        {id:"vendors",  icon:"🤝", label:"협력업체",    sub:"VENDORS"},
        {id:"archive",  icon:"📁", label:"아카이브",    sub:"ARCHIVE"},
        {id:"manual",   icon:"📚", label:"업무매뉴얼",  sub:"MANUAL"},
      ]
    },
    {
      group: "🔧 분석·설정",
      color: "#7C3AED",
      bg: "#EDE9FE",
      items: [
        {id:"pnl",      icon:"📉", label:"손익분석",    sub:"P&L ANALYSIS"},
        {id:"optimize", icon:"⚙️", label:"경영최적화",  sub:"OPTIMIZATION"},
        {id:"datahub",  icon:"🗄️", label:"데이터관리",  sub:"DATA HUB"},
        {id:"gamify",   icon:"🎮", label:"포인트·랭킹", sub:"GAMIFICATION"},
      ]
    },
  ]

  // 검색 필터
  const allItems = HUB_MENUS.flatMap(g=>g.items.map(i=>({...i, group:g.group, color:g.color, bg:g.bg})))
  const filtered = search.trim()
    ? allItems.filter(i=>i.label.includes(search)||i.sub.toLowerCase().includes(search.toLowerCase()))
    : []
  const favItems = allItems.filter(i=>favorites.includes(i.id+(i.subTab||"")))

  // KPI 요약
  const now = new Date()
  const YR  = String(now.getFullYear())
  const thisMon = `${YR}-${String(now.getMonth()+1).padStart(2,"0")}`
  const totalPaid = cashItems.filter(i=>i.paidDate).reduce((s,i)=>s+(i.amount||0),0)
  const totalConf = cashItems.filter(i=>!i.paidDate&&i.expectedDate&&i.itemType!=="미정"&&i.itemType!=="추진").reduce((s,i)=>s+(i.amount||0),0)

  const CardItem = ({item, groupColor, groupBg}) => {
    const isFav = favorites.includes(item.id+(item.subTab||""))
    return (
      <div
        onClick={()=>setTab(item.id)}
        style={{
          background:groupBg,
          borderRadius:16,
          padding:"16px 14px",
          cursor:"pointer",
          position:"relative",
          border:`1px solid ${groupColor}22`,
          transition:"transform .1s, box-shadow .1s",
          userSelect:"none",
        }}
        onTouchStart={e=>e.currentTarget.style.transform="scale(0.97)"}
        onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}
        onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 4px 12px ${groupColor}33`}
        onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}
      >
        {/* 즐겨찾기 버튼 */}
        <button
          onClick={e=>{e.stopPropagation();toggleFav(item.id+(item.subTab||""))}}
          style={{position:"absolute",top:10,right:10,background:"none",border:"none",fontSize:16,cursor:"pointer",
            color:isFav?groupColor:"#D1D5DB",padding:4}}>
          {isFav?"★":"☆"}
        </button>
        {/* 아이콘 */}
        <div style={{
          width:52,height:52,borderRadius:14,
          background:"white",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:26,marginBottom:10,
          boxShadow:`0 2px 8px ${groupColor}22`
        }}>
          {item.icon}
        </div>
        {/* 텍스트 */}
        <div style={{fontSize:15,fontWeight:800,color:groupColor,marginBottom:2}}>{item.label}</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:10,fontWeight:600,color:`${groupColor}99`,letterSpacing:".05em"}}>{item.sub}</div>
          <span style={{fontSize:14,color:groupColor}}>→</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{maxWidth:680,margin:"0 auto",padding:"0 0 80px"}}>
      {/* 헤더 */}
      <div style={{background:"linear-gradient(135deg,#312E81,#6366F1)",padding:"24px 20px 20px",marginBottom:0}}>
        <div style={{fontSize:12,color:"rgba(255,255,255,.7)",marginBottom:4}}>
          {currentUser?.dept||""} {currentUser?.name||""}님
        </div>
        <div style={{fontSize:22,fontWeight:800,color:"#fff",marginBottom:16}}>
          🏠 상지서울 업무 허브
        </div>

        {/* KPI 요약 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
          {[
            {label:"진행중 프로젝트",val:projects.filter(p=>p.type==="확정"||p.type==="계약").length+"건",icon:"🏗"},
            {label:"현누계",         val:fA(totalPaid),                                                   icon:"✅"},
            {label:"기성+확정",      val:fA(totalPaid+totalConf),                                         icon:"💧"},
          ].map(k=>(
            <div key={k.label} style={{background:"rgba(255,255,255,.15)",borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:18,marginBottom:4}}>{k.icon}</div>
              <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{k.val}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.7)",marginTop:2}}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* 검색 */}
        <div style={{background:"white",borderRadius:12,padding:"10px 14px",display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:16}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="메뉴 검색 — 이름 입력..."
            style={{border:"none",outline:"none",fontSize:14,flex:1,fontFamily:"inherit",background:"transparent"}}/>
          {search&&<button onClick={()=>setSearch("")} style={{border:"none",background:"none",cursor:"pointer",fontSize:14,color:"#9CA3AF"}}>✕</button>}
        </div>
      </div>

      <div style={{padding:"16px 14px"}}>

        {/* 검색 결과 */}
        {search.trim()&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:14,fontWeight:700,color:"#374151",marginBottom:10}}>
              🔍 검색 결과 {filtered.length}건
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {filtered.map((item,i)=>(
                <CardItem key={i} item={item} groupColor={item.color} groupBg={item.bg}/>
              ))}
            </div>
            {filtered.length===0&&<div style={{color:"#9CA3AF",fontSize:14,textAlign:"center",padding:"20px 0"}}>검색 결과가 없습니다.</div>}
          </div>
        )}

        {/* 즐겨찾기 */}
        {!search&&favItems.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:14,fontWeight:800,color:"#374151",marginBottom:10}}>
              ⭐ 즐겨찾기 {favItems.length}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {favItems.map((item,i)=>(
                <CardItem key={i} item={item} groupColor={item.color} groupBg={{...item,bg:"#FFF8F0"}.bg}/>
              ))}
            </div>
          </div>
        )}

        {/* 카테고리별 메뉴 */}
        {!search&&HUB_MENUS.map(({group,color,bg,items})=>(
          <div key={group} style={{marginBottom:20}}>
            <div style={{
              display:"flex",alignItems:"center",gap:8,
              marginBottom:10,paddingBottom:8,
              borderBottom:`2px solid ${color}33`
            }}>
              <div style={{fontSize:14,fontWeight:800,color:color}}>{group}</div>
              <div style={{fontSize:12,color:`${color}88`,fontWeight:600}}>{items.length}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {items.map((item,i)=>(
                <CardItem key={i} item={item} groupColor={color} groupBg={bg}/>
              ))}
            </div>
          </div>
        ))}

        {/* 버전 */}
        <div style={{textAlign:"center",color:"#D1D5DB",fontSize:12,marginTop:20}}>
          상지서울건축사사무소 통합경영시스템 v5 · {new Date().getFullYear()}
        </div>
      </div>

      {/* 하단 고정 네비 (모바일 전용 - 데스크탑에서는 사이드바와 겹치지 않게 처리) */}
      <style>{`
        @media (min-width: 769px) {
          .sjs-mobile-bottom-nav { display: none !important; }
        }
      `}</style>
      <div className="sjs-mobile-bottom-nav" style={{
        position:"fixed",bottom:0,left:0,right:0,
        background:"white",
        borderTop:"1px solid #E5E7EB",
        display:"flex",
        padding:"8px 0 env(safe-area-inset-bottom)",
        zIndex:50,
        boxShadow:"0 -4px 20px rgba(0,0,0,.08)"
      }}>
        {[
          {id:"home",     icon:"🏠", label:"홈"},
          {id:"analysis", icon:"📊", label:"경영"},
          {id:"projects", icon:"🏗", label:"프로젝트"},
          {id:"history",  icon:"📜", label:"히스토리"},
          {id:"manual",   icon:"📚", label:"매뉴얼"},
        ].map(({id,icon,label})=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{flex:1,border:"none",background:"none",cursor:"pointer",padding:"4px 0",
              display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:22}}>{icon}</span>
            <span style={{fontSize:10,fontWeight:600,color:id==="home"?"#6366F1":"#9CA3AF"}}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 📝 계약현황 페이지 — contractItems 독립 저장소 사용
//    projects와 완전 분리. 엑셀 업로드 → contractItems에만 저장
// ══════════════════════════════════════════════════════════════
function ContractStatusPage({contractItems=[], setContractItems, DEPTS, DEPT_COLORS,
  currentUser, yearTargets, setYearTargets, deptBiz, YEAR, YR,
  setSelProjId, setTab, isAdmin, setDetailTab}) {

  const toast  = useToast()
  // 비정상 대값 자동 보정: 단일 프로젝트 용역비가 1000억(1e11)을 넘는 경우는 사실상 없음
  // (예전 업로드에서 억단위가 원단위로 중복 변환되어 저장된 경우 자동 복구)
  const normFee = v => {
    let n = Number(v)||0
    let guard = 0
    while(Math.abs(n) >= 1e11 && guard < 5) { n = n/1e8; guard++ }
    return n
  }
  const fAin   = v => v>0?(v/1e8).toFixed(2):""  // 억원 단위 입력값

  // 비정상 데이터 자동 감지 (1000억 초과 항목 존재 여부)
  const hasAbnormalData = contractItems.some(i=>{
    const raw = Number(i.serviceFeeExpect||i.amount||0)
    return Math.abs(raw) >= 1e11
  })
  const targets   = (yearTargets||{})[YEAR] || {}
  const tContract = (targets.contractTarget || 170) * 1e8

  const [editId, setEditId] = useState(null)   // 인라인 편집중인 항목 id
  const [draft,  setDraft]  = useState(null)
  const [expandedDept, setExpandedDept] = useState(null) // 본부별 펼침

  // 구분(type) 기준 분류 — 오직 이 필드만 사용
  const getType = (item) => {
    const t = (item.type||"").trim()
    if(t==="계약"||t==="계약(수주)"||t==="수주") return "계약"
    if(t==="확정") return "확정"
    if(t==="추진") return "추진"
    return null
  }

  const 계약Items = contractItems.filter(i=>getType(i)==="계약")
  const 확정Items = contractItems.filter(i=>getType(i)==="확정")
  const 추진Items = contractItems.filter(i=>getType(i)==="추진").sort((a,b)=>{
    if(a.important&&!b.important) return -1
    if(!a.important&&b.important) return 1
    const da = a.execTime||a.contractTime||"9999"
    const db = b.execTime||b.contractTime||"9999"
    return String(da).localeCompare(String(db))
  })

  const sum = arr => arr.reduce((s,i)=>s+normFee(i.serviceFeeExpect||i.amount||0),0)
  const 계약Sum = sum(계약Items)
  const 확정Sum = sum(확정Items)
  const 추진Sum = sum(추진Items)
  const 합계    = 계약Sum + 확정Sum

  // 구분별 섹션 (SECS) - CashItemsView와 독립적으로 선언
  const SECS = [
    {type:"계약", label:"✅ 완료(계약)", color:"#059669", bg:"#F0FDF4", border:"#059669", items:계약Items, sum:계약Sum},
    {type:"확정", label:"🔵 확정",       color:"#6366F1", bg:"#EEF2FF", border:"#6366F1", items:확정Items, sum:확정Sum},
    {type:"추진", label:"🟡 추진",       color:"#D97706", bg:"#FFFBEB", border:"#D97706", items:추진Items, sum:추진Sum},
  ]

  // 본부 지분 헬퍼
  const deptShare = (item, dept) => {
    const ds = (item.deptShares||[]).find(s=>s.dept===dept)
    if(ds) return ds.share/100
    const depts = item.depts||[]
    if(depts.includes(dept)) return 1/depts.length
    return 0
  }

  // 본부별 집계
  const byDept = DEPTS.map(dept=>{
    const my = contractItems.filter(i=>(i.depts||[]).includes(dept)||(i.deptShares||[]).some(s=>s.dept===dept))
    const feeOf = i => normFee(i.serviceFeeExpect||i.amount||0)
    const items계약 = my.filter(i=>getType(i)==="계약")
    const items확정 = my.filter(i=>getType(i)==="확정")
    const items추진 = my.filter(i=>getType(i)==="추진")
    const 계약 = items계약.reduce((s,i)=>s+feeOf(i)*deptShare(i,dept),0)
    const 확정 = items확정.reduce((s,i)=>s+feeOf(i)*deptShare(i,dept),0)
    const 추진 = items추진.reduce((s,i)=>s+feeOf(i)*deptShare(i,dept),0)
    const 목표 = ((deptBiz||{})[dept]?.orderTarget||0)*1e8
    return {dept,계약,확정,추진,합계:계약+확정,목표,color:DEPT_COLORS[dept]||"#6B7280",
      items계약, items확정, items추진, items합계:[...items계약,...items확정]}
  }).filter(d=>d.합계+d.추진+d.목표>0)

  const [detailView, setDetailView] = useState(null)

  const startEdit = (item) => { setEditId(item.id); setDraft({...item}) }
  const saveEdit = () => {
    if(!draft) return
    // 사업자공모 최종설계비 자동계산
    const bizCompFee = Math.round((draft.serviceFeeExpect||0) * (draft.bizCompPct||100) / 100)
    updateItem(editId, {...draft, bizCompFee})
    setEditId(null); setDraft(null)
  }
  const cancelEdit = () => { setEditId(null); setDraft(null) }
  const deleteItem = (id) => {
    if(!window.confirm("이 항목을 삭제하시겠습니까?")) return
    setContractItems(prev => (prev||[]).filter(i => i.id !== id))
  }

  const goProj = (item) => { if(setTab) setTab("projects") }

  // 계약현황 전체 데이터 다운로드
  const downloadAllContract = () => {
    const rows = [
      ["■ 상지서울건축사사무소 — 계약현황 전체 데이터"],
      [`기준일: ${new Date().toLocaleDateString("ko-KR")}`],
      [],
      ["본부(복수시 '본부명:지분%')","발주구분","구분","프로젝트명","공모형식","총설계비예상(원)","상지지분예상(%)","용역비예상(원)","사업자공모비율(%)","사업자공모최종설계비(원)","수행예상시점","계약예상시점","컨소시엄","내용","[시스템ID]"],
      ...contractItems.map(i=>[
        (i.deptShares||[]).length>1
          ? (i.deptShares||[]).map(s=>`${s.dept}:${s.share}%`).join(",")
          : (i.depts||[]).join(",") || "",
        i.orderType||"민간", i.type||"", i.name||"", i.bidType||"",
        i.totalFeeExpect||0, i.shareRatioExpect||100, i.serviceFeeExpect||i.amount||0,
        i.bizCompPct||100, i.bizCompFee||0,
        i.execTime||"", i.contractTime||"", i.consortium||"", i.note||"", i.id||"",
      ])
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws["!cols"] = [{wch:28},{wch:9},{wch:7},{wch:35},{wch:12},{wch:15},{wch:12},{wch:14},{wch:12},{wch:18},{wch:12},{wch:12},{wch:20},{wch:25},{wch:20}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "계약현황")
    XLSX.writeFile(wb, `상지서울_계약현황_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ── 인라인 편집 입력 컴포넌트 ──────────────────────────
  const EditRow = ({item}) => {
    const d = draft
    const u = (k,v) => setDraft(p=>({...p,[k]:v}))
    const uDeptShare = (idx,key,val) => {
      const next = [...(d.deptShares||[])]
      next[idx] = {...next[idx], [key]:val}
      u("deptShares", next)
      u("depts", next.map(s=>s.dept))
    }
    const addDeptShare = () => {
      const used = (d.deptShares||[]).map(s=>s.dept)
      const avail = DEPTS.find(dp=>!used.includes(dp)) || DEPTS[0]
      u("deptShares", [...(d.deptShares||[]), {dept:avail, share:0}])
    }
    const removeDeptShare = (idx) => {
      const next=(d.deptShares||[]).filter((_,i)=>i!==idx)
      u("deptShares", next); u("depts", next.map(s=>s.dept))
    }
    const bizCompFeePreview = Math.round((d.serviceFeeExpect||0)*(d.bizCompPct||100)/100)

    const inp = {padding:"6px 8px",border:"1.5px solid #C7D2FE",borderRadius:7,fontSize:12.5,width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none"}
    const lbl = {fontSize:11,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}

    return (
      <tr>
        <td colSpan={9} style={{padding:0,background:"#EEF2FF"}}>
          <div style={{padding:"16px 18px",border:"2px solid #6366F1",borderRadius:10,margin:6}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <label style={lbl}>프로젝트명</label>
                <input value={d.name||""} onChange={e=>u("name",e.target.value)} style={inp}/>
              </div>
              <div>
                <label style={lbl}>발주구분</label>
                <select value={d.orderType||"민간"} onChange={e=>u("orderType",e.target.value)} style={inp}>
                  <option value="민간">민간</option><option value="공공">공공</option><option value="해외">해외</option>
                </select>
              </div>
              <div>
                <label style={lbl}>공모형식</label>
                <input value={d.bidType||""} onChange={e=>u("bidType",e.target.value)} placeholder="기술제안/수의계약 등" style={inp}/>
              </div>
            </div>

            {/* 본부 분할 */}
            <div style={{marginBottom:10}}>
              <label style={lbl}>본부 (복수 분할 가능)</label>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {(d.deptShares||[]).map((s,idx)=>(
                  <div key={idx} style={{display:"flex",gap:6,alignItems:"center"}}>
                    <select value={s.dept} onChange={e=>uDeptShare(idx,"dept",e.target.value)} style={{...inp,flex:2}}>
                      {DEPTS.map(dp=><option key={dp} value={dp}>{dp}</option>)}
                    </select>
                    <input type="number" value={s.share} onChange={e=>uDeptShare(idx,"share",parseFloat(e.target.value)||0)}
                      style={{...inp,flex:1}} placeholder="지분%"/>
                    <span style={{fontSize:12,color:"#6B7280"}}>%</span>
                    {(d.deptShares||[]).length>1&&
                      <button onClick={()=>removeDeptShare(idx)} style={{padding:"4px 9px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:6,fontSize:11,cursor:"pointer"}}>✕</button>}
                  </div>
                ))}
                <button onClick={addDeptShare} style={{padding:"5px 10px",background:"#E0E7FF",color:"#4338CA",border:"none",borderRadius:7,fontSize:11.5,fontWeight:600,cursor:"pointer",alignSelf:"flex-start"}}>
                  + 본부 추가 (분할)
                </button>
                <div style={{fontSize:11,color:(d.deptShares||[]).reduce((s,x)=>s+(x.share||0),0)===100?"#059669":"#DC2626"}}>
                  지분 합계: {(d.deptShares||[]).reduce((s,x)=>s+(x.share||0),0)}% {(d.deptShares||[]).reduce((s,x)=>s+(x.share||0),0)!==100&&"(100%이어야 함)"}
                </div>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <label style={lbl}>총설계비(예상) — 억원</label>
                <input type="number" step="0.01" value={fAin(d.totalFeeExpect)} onChange={e=>u("totalFeeExpect",Math.round((parseFloat(e.target.value)||0)*1e8))} style={inp}/>
              </div>
              <div>
                <label style={lbl}>상지지분(예상) — %</label>
                <input type="number" value={d.shareRatioExpect||""} onChange={e=>u("shareRatioExpect",parseFloat(e.target.value)||0)} style={inp}/>
              </div>
              <div>
                <label style={lbl}>용역비(예상) — 억원</label>
                <input type="number" step="0.01" value={fAin(d.serviceFeeExpect)} onChange={e=>u("serviceFeeExpect",Math.round((parseFloat(e.target.value)||0)*1e8))} style={inp}/>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:10,background:"#FEF3C7",padding:"10px 12px",borderRadius:8}}>
              <div>
                <label style={lbl}>사업자공모 비율 — %</label>
                <input type="number" value={d.bizCompPct||""} onChange={e=>u("bizCompPct",parseFloat(e.target.value)||0)} style={inp} placeholder="예: 40"/>
              </div>
              <div>
                <label style={lbl}>사업자공모 최종설계비 (자동계산)</label>
                <div style={{padding:"6px 8px",background:"#fff",borderRadius:7,fontSize:13,fontWeight:800,color:"#D97706",border:"1.5px solid #FDE68A"}}>
                  {fA(bizCompFeePreview)}
                </div>
                <div style={{fontSize:10,color:"#92400E",marginTop:2}}>용역비예상 × 공모비율</div>
              </div>
              <div>
                <label style={lbl}>수행예상시점</label>
                <input value={d.execTime||""} onChange={e=>u("execTime",e.target.value)} placeholder="2026년 1월" style={inp}/>
              </div>
              <div>
                <label style={lbl}>계약예상시점</label>
                <input value={d.contractTime||""} onChange={e=>u("contractTime",e.target.value)} placeholder="2026년 12월" style={inp}/>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10,marginBottom:12}}>
              <div>
                <label style={lbl}>컨소시엄</label>
                <input value={d.consortium||""} onChange={e=>u("consortium",e.target.value)} placeholder="토문건축, 상지건축, 이림건축" style={inp}/>
              </div>
              <div>
                <label style={lbl}>내용</label>
                <input value={d.note||""} onChange={e=>u("note",e.target.value)} placeholder="9/12 공고 등" style={inp}/>
              </div>
            </div>

            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={cancelEdit} style={{padding:"7px 16px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:8,fontSize:12.5,fontWeight:600,cursor:"pointer"}}>취소</button>
              <button onClick={saveEdit} style={{padding:"7px 18px",background:"#6366F1",color:"#fff",border:"none",borderRadius:8,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>💾 저장</button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div>
      {/* 비정상 금액 데이터 경고 */}
      {hasAbnormalData && isAdmin && (
        <div style={{background:"#FEE2E2",border:"2px solid #DC2626",borderRadius:12,padding:"12px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>⚠️</span>
          <div style={{flex:1,fontSize:13,color:"#991B1B"}}>
            <strong>금액 단위 오류가 감지되었습니다.</strong> 일부 프로젝트 금액이 비정상적으로 큰 값으로 표시됩니다.
            아래 <strong>🔧 금액 단위 보정</strong> 버튼을 눌러 데이터를 영구적으로 수정하세요. (화면에는 자동 보정되어 표시되지만, 저장된 원본 데이터는 그대로입니다)
          </div>
        </div>
      )}
      {/* KPI 배너 */}
      <div style={{background:"linear-gradient(135deg,#065F46,#059669)",borderRadius:16,padding:"22px 28px",marginBottom:16,color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16}}>
          <div>
            <div style={{fontSize:13,opacity:.75,marginBottom:4}}>{YEAR}년 계약·확정 금액</div>
            <div style={{fontSize:36,fontWeight:800,marginBottom:10}}>{fA(합계)}</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {[["✅ 계약",계약Sum,"#34D399"],["📋 확정",확정Sum,"#A5B4FC"],["🔶 추진",추진Sum,"#FDE68A"]].map(([l,v,c])=>(
                <span key={l} style={{background:"rgba(255,255,255,.15)",padding:"4px 12px",borderRadius:20,fontSize:13,fontWeight:700,color:c}}>{l} {fA(v)}</span>
              ))}
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,opacity:.7,marginBottom:2}}>{YEAR}년 계약 목표</div>
            <div style={{fontSize:28,fontWeight:800}}>{fA(tContract)}</div>
            <div style={{fontSize:20,fontWeight:800,color:합계>=tContract?"#34D399":"#FDE68A",marginTop:4}}>
              달성률 {tContract>0?Math.round(합계/tContract*100):0}%
            </div>
          </div>
        </div>
      </div>

      {/* 버튼 */}
      {isAdmin&&(
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          <button onClick={downloadContractTemplate}
            style={{padding:"7px 14px",background:"#D1FAE5",color:"#059669",border:"none",borderRadius:9,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
            ⬇ 빈 양식
          </button>
          <button onClick={downloadAllContract}
            style={{padding:"7px 14px",background:"#EDE9FE",color:"#7C3AED",border:"none",borderRadius:9,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
            ⬇ 계약전체데이터
          </button>
          <label style={{padding:"7px 14px",background:"#6366F1",color:"#fff",borderRadius:9,fontSize:12.5,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}>
            ⬆ 엑셀 업로드
            <input type="file" accept=".xlsx,.xls" style={{display:"none"}}
              onChange={e=>uploadContractExcel(e,contractItems,setContractItems,currentUser,toast)}/>
          </label>
          <button onClick={()=>{
            if(!window.confirm("금액 단위 오류를 자동 보정합니다. 계속하시겠습니까?")) return
            setContractItems(prev=>prev.map(i=>{
              const fixedSvc   = normFee(i.serviceFeeExpect||i.amount||0)
              const fixedTotal = normFee(i.totalFeeExpect||0)
              const fixedBiz   = normFee(i.bizCompFee||0)
              return {
                ...i,
                serviceFeeExpect: fixedSvc,
                amount: fixedSvc,  // amount와 serviceFeeExpect를 동일한 정규화값으로 통일
                totalFeeExpect: fixedTotal,
                bizCompFee: fixedBiz,
              }
            }))
            toast&&toast("금액 단위 보정 완료","success")
          }} style={{padding:"7px 14px",background:hasAbnormalData?"#DC2626":"#FEE2E2",color:hasAbnormalData?"#fff":"#DC2626",border:"none",borderRadius:9,fontSize:12.5,fontWeight:800,cursor:"pointer",animation:hasAbnormalData?"pulse 1.5s infinite":"none"}}>
            🔧 금액 단위 보정{hasAbnormalData?" (필요!)":""}
          </button>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>
          <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
            <button onClick={()=>addItem("계약")} style={{padding:"7px 13px",background:"#D1FAE5",color:"#059669",border:"none",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 계약 추가</button>
            <button onClick={()=>addItem("확정")} style={{padding:"7px 13px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 확정 추가</button>
            <button onClick={()=>addItem("추진")} style={{padding:"7px 13px",background:"#FEF3C7",color:"#D97706",border:"none",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 추진 추가</button>
          </div>
        </div>
      )}

      {/* 본부별 요약 */}
      {byDept.length>0&&(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:14}}>
          <div style={{padding:"13px 18px",borderBottom:"1px solid #E5E7EB",fontSize:14,fontWeight:800,color:"#111827",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>📊 본부별 계약 현황 (지분 반영)</span>
            <span style={{fontSize:11.5,fontWeight:500,color:"#9CA3AF"}}>금액 클릭 → 상세 프로젝트 보기</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                {["본부","목표","계약","확정","합계(계약+확정)","추진","달성률"].map((h,i)=>(
                  <th key={h} style={TH(i===0?"left":"right",i===4?"#059669":i===2?"#059669":i===3?"#6366F1":i===5?"#D97706":"#6B7280")}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {byDept.map((d,i)=>{
                  const Cell = ({val, items, type, color, bg, bold}) => {
                    const clickable = val>0 && items && items.length>0
                    const isActive = detailView&&detailView.dept===d.dept&&detailView.type===type
                    return (
                      <td style={{...TD("right",color,bold),background:isActive?"#FEF9C3":bg,
                        cursor:clickable?"pointer":"default",
                        textDecoration:clickable?"underline":"none",
                        textDecorationStyle:"dotted",textUnderlineOffset:3}}
                        onClick={()=>{
                          if(!clickable) return
                          if(isActive) setDetailView(null)
                          else setDetailView({dept:d.dept, type, label:`${d.dept} · ${type}`, items, color})
                        }}>
                        {val>0?fA(val):"-"}
                      </td>
                    )
                  }
                  return (
                    <tr key={d.dept} style={{background:i%2===0?"#fff":"#FAFAFA"}}>
                      <td style={TD("left","#111827",true)}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:d.color}}/>{d.dept}
                        </div>
                      </td>
                      <td style={TD("right","#DC2626")}>{d.목표>0?fA(d.목표):"-"}</td>
                      <Cell val={d.계약} items={d.items계약} type="계약" color="#059669" bold/>
                      <Cell val={d.확정} items={d.items확정} type="확정" color="#6366F1"/>
                      <Cell val={d.합계} items={d.items합계} type="합계(계약+확정)" color="#059669" bg="#ECFDF5" bold/>
                      <Cell val={d.추진} items={d.items추진} type="추진" color="#D97706"/>
                      <td style={{...TD(),color:d.목표>0&&d.합계/d.목표>=1?"#059669":d.목표>0&&d.합계/d.목표>=0.7?"#D97706":"#DC2626",fontWeight:700}}>
                        {d.목표>0?Math.round(d.합계/d.목표*100)+"%":"-"}
                      </td>
                    </tr>
                  )
                })}
                <tr style={{background:"#EEF2FF",borderTop:"2px solid #6366F1"}}>
                  <td style={TD("left","#312E81",true)}>합계</td>
                  <td style={TD("right","#DC2626",true)}>{fA(byDept.reduce((s,d)=>s+d.목표,0))}</td>
                  <td style={{...TD("right","#059669",true),cursor:계약Sum>0?"pointer":"default",textDecoration:계약Sum>0?"underline":"none",textDecorationStyle:"dotted"}}
                    onClick={()=>계약Sum>0&&setDetailView(prev=>prev?.type==="전체계약"?null:{dept:"전체",type:"전체계약",label:"전체 · 계약",items:계약Items,color:"#059669"})}>
                    {fA(계약Sum)}
                  </td>
                  <td style={{...TD("right","#6366F1",true),cursor:확정Sum>0?"pointer":"default",textDecoration:확정Sum>0?"underline":"none",textDecorationStyle:"dotted"}}
                    onClick={()=>확정Sum>0&&setDetailView(prev=>prev?.type==="전체확정"?null:{dept:"전체",type:"전체확정",label:"전체 · 확정",items:확정Items,color:"#6366F1"})}>
                    {fA(확정Sum)}
                  </td>
                  <td style={{...TD("right","#059669",true),background:"#A7F3D0",cursor:합계>0?"pointer":"default",textDecoration:합계>0?"underline":"none",textDecorationStyle:"dotted"}}
                    onClick={()=>합계>0&&setDetailView(prev=>prev?.type==="전체합계"?null:{dept:"전체",type:"전체합계",label:"전체 · 계약+확정",items:[...계약Items,...확정Items],color:"#059669"})}>
                    {fA(합계)}
                  </td>
                  <td style={{...TD("right","#D97706",true),cursor:추진Sum>0?"pointer":"default",textDecoration:추진Sum>0?"underline":"none",textDecorationStyle:"dotted"}}
                    onClick={()=>추진Sum>0&&setDetailView(prev=>prev?.type==="전체추진"?null:{dept:"전체",type:"전체추진",label:"전체 · 추진",items:추진Items,color:"#D97706"})}>
                    {fA(추진Sum)}
                  </td>
                  <td style={TD("right","#059669",true)}>{tContract>0?Math.round(합계/tContract*100)+"%":"-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 상세 프로젝트 리스트 (클릭 시 펼침) */}
          {detailView&&(
            <div style={{borderTop:`3px solid ${detailView.color}`,background:`${detailView.color}0A`,padding:"14px 18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13.5,fontWeight:800,color:detailView.color}}>
                  📋 {detailView.label} — {detailView.items.length}건 / {fA(detailView.items.reduce((s,i)=>s+normFee(i.serviceFeeExpect||i.amount||0)*(detailView.dept==="전체"?1:deptShare(i,detailView.dept)),0))}
                </div>
                <button onClick={()=>setDetailView(null)}
                  style={{padding:"4px 10px",background:"#fff",color:"#6B7280",border:"1px solid #E5E7EB",borderRadius:7,fontSize:11.5,cursor:"pointer"}}>
                  ✕ 닫기
                </button>
              </div>
              <div style={{background:"#fff",borderRadius:10,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:"#F8FAFC"}}>
                    {["연번","구분","본부(지분)","프로젝트명","해당금액","전체용역비"].map((h,i)=>(
                      <th key={h} style={TH(i>=4?"right":i===0?"center":"left")}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {detailView.items.map((item,i)=>{
                      const fullFee = normFee(item.serviceFeeExpect||item.amount||0)
                      const sh = detailView.dept==="전체" ? 1 : deptShare(item, detailView.dept)
                      const myFee = fullFee*sh
                      const t = getType(item)
                      const tColor = t==="계약"?"#059669":t==="확정"?"#6366F1":"#D97706"
                      const deptLabel = (item.deptShares||[]).length>1
                        ? (item.deptShares||[]).map(s=>`${s.dept}:${s.share}%`).join(" / ")
                        : (item.depts||[]).join(", ")
                      return (
                        <tr key={item.id||i} style={{background:i%2===0?"#fff":"#FAFAFA",cursor:"pointer"}}
                          onClick={()=>startEdit(item)}>
                          <td style={{...TD("center","#9CA3AF"),fontSize:11.5}}>{i+1}</td>
                          <td style={TD("left")}>
                            <span style={{fontSize:10.5,padding:"1px 7px",borderRadius:9,background:tColor+"18",color:tColor,fontWeight:700}}>{t}</span>
                          </td>
                          <td style={{...TD("left","#6B7280"),fontSize:11.5}}>{deptLabel}</td>
                          <td style={{...TD("left","#111827",true)}}>{item.name}</td>
                          <td style={{...TD("right",detailView.color,true)}}>{fA(myFee)}</td>
                          <td style={{...TD("right","#9CA3AF"),fontSize:11.5}}>{fA(fullFee)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 구분별 프로젝트 목록 */}
      {SECS.map(sec=>(
        <div key={sec.type} style={{background:"#fff",borderRadius:14,border:`2px solid ${sec.border}`,overflow:"hidden",marginBottom:14}}>
          <div style={{padding:"12px 18px",background:sec.bg,borderBottom:`1px solid ${sec.border}33`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:15,fontWeight:800,color:sec.color}}>{sec.label} ({sec.items.length}건)</div>
            <div style={{fontSize:15,fontWeight:800,color:sec.color}}>{fA(sec.sum)}</div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:1300}}>
              <thead><tr>
                {["연번","본부","공모형식","프로젝트명","총설계비(예상)","상지지분(예상)","용역비(예상)","사업자공모","최종설계비","수행예상","계약예상","컨소시엄","내용",isAdmin?"관리":null].filter(Boolean).map((h,i)=>(
                  <th key={h} style={TH(i>=4&&i<=8?"right":i===0?"center":"left")}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {sec.items.map((item,i)=>{
                  if(editId===item.id) return <EditRow key={item.id} item={item}/>
                  const bidColor = {"공공":"#6366F1","민간":"#059669","해외":"#DC2626"}[item.orderType||"민간"]||"#6B7280"
                  const depts = (item.deptShares||[]).length>1
                    ? (item.deptShares||[]).map(s=>`${s.dept}:${s.share}%`).join(" / ")
                    : (item.depts||[]).join(", ")||"-"
                  const svcFee = normFee(item.serviceFeeExpect||item.amount||0)
                  const totalFee = normFee(item.totalFeeExpect||0)
                  const bizFee = normFee(item.bizCompFee||0)
                  return (
                    <tr key={item.id||i} style={{background:i%2===0?"#fff":"#FAFAFA"}}>
                      <td style={{...TD("center","#9CA3AF"),fontSize:11.5}}>{i+1}</td>
                      <td style={{...TD("left","#6B7280"),fontSize:11.5,whiteSpace:"nowrap",maxWidth:140}}>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:10,padding:"1px 5px",borderRadius:8,background:bidColor+"18",color:bidColor,fontWeight:700}}>{item.orderType||"민간"}</span>
                          {depts}
                        </div>
                      </td>
                      <td style={{...TD("left","#6B7280"),fontSize:11.5}}>{item.bidType||"-"}</td>
                      <td style={{...TD("left","#111827",true),minWidth:180,cursor:"pointer"}} onClick={()=>startEdit(item)}>
                        {item.name}
                        {item.important&&
                          <span style={{marginLeft:0,marginRight:5,fontSize:9,background:"#DC2626",color:"#fff",padding:"1px 6px",borderRadius:5,fontWeight:800}}>⭐중요</span>}
                        {item.contractYear&&String(item.contractYear)===YR&&
                          <span style={{marginLeft:5,fontSize:9,background:sec.color,color:"#fff",padding:"1px 5px",borderRadius:5}}>{YR}신규</span>}
                      </td>
                      <td style={{...TD("right","#374151"),whiteSpace:"nowrap"}}>{totalFee?fA(totalFee):"-"}</td>
                      <td style={{...TD("right","#6366F1"),whiteSpace:"nowrap"}}>{item.shareRatioExpect?item.shareRatioExpect+"%":"-"}</td>
                      <td style={{...TD("right",sec.color,true),whiteSpace:"nowrap"}}>{fA(svcFee)}</td>
                      <td style={{...TD("right","#D97706"),whiteSpace:"nowrap"}}>{item.bizCompPct?item.bizCompPct+"%":"-"}</td>
                      <td style={{...TD("right","#D97706",true),whiteSpace:"nowrap"}}>{bizFee?fA(bizFee):"-"}</td>
                      <td style={{...TD("right","#6B7280"),fontSize:11.5,whiteSpace:"nowrap"}}>{item.execTime||"-"}</td>
                      <td style={{...TD("right","#6B7280"),fontSize:11.5,whiteSpace:"nowrap"}}>{item.contractTime||"-"}</td>
                      <td style={{...TD("left","#6B7280"),fontSize:11.5,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={item.consortium||""}>{item.consortium||"-"}</td>
                      <td style={{...TD("left","#9CA3AF"),fontSize:11.5,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={item.note||""}>{item.note||"-"}</td>
                      {isAdmin&&(
                        <td style={{...TD("center"),whiteSpace:"nowrap"}}>
                          <div style={{display:"flex",gap:3,justifyContent:"center"}}>
                            <button onClick={()=>updateItem(item.id,{important:!item.important})}
                              title={item.important?"⭐ 중요 해제":"☆ 중요 설정"}
                              style={{padding:"3px 7px",background:item.important?"#FEF3C7":"#F3F4F6",color:item.important?"#D97706":"#9CA3AF",border:`1.5px solid ${item.important?"#FDE68A":"#E5E7EB"}`,borderRadius:5,fontSize:10.5,cursor:"pointer",fontWeight:800}}>
                              {item.important?"⭐":"☆"}
                            </button>
                            <button onClick={()=>startEdit(item)} title="편집"
                              style={{padding:"3px 7px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:5,fontSize:10.5,cursor:"pointer"}}>✏</button>
                            {sec.type!=="계약"&&<button onClick={()=>moveType(item,sec.type==="추진"?"확정":"계약")} title="상위 단계로 이동"
                              style={{padding:"3px 7px",background:"#D1FAE5",color:"#059669",border:"none",borderRadius:5,fontSize:10.5,cursor:"pointer"}}>↑</button>}
                            {sec.type!=="추진"&&<button onClick={()=>moveType(item,sec.type==="계약"?"확정":"추진")} title="하위 단계로 이동"
                              style={{padding:"3px 7px",background:"#FEF3C7",color:"#D97706",border:"none",borderRadius:5,fontSize:10.5,cursor:"pointer"}}>↓</button>}
                            <button onClick={()=>deleteItem(item.id)} title="삭제"
                              style={{padding:"3px 7px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:5,fontSize:10.5,cursor:"pointer"}}>✕</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
                <tr style={{background:sec.bg}}>
                  <td colSpan={6} style={{...TD("right",sec.color,true)}}>소계 ({sec.items.length}건)</td>
                  <td style={{...TD("right",sec.color,true)}}>{fA(sec.sum)}</td>
                  <td colSpan={isAdmin?7:6}/>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {contractItems.length===0&&(
        <div style={{background:"#fff",borderRadius:14,border:"2px dashed #E5E7EB",padding:"60px",textAlign:"center",color:"#9CA3AF"}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontSize:16,fontWeight:700,marginBottom:8,color:"#374151"}}>계약현황 데이터가 없습니다</div>
          <div style={{fontSize:13,marginBottom:16}}>⬇ 빈 양식을 다운로드하거나 + 추가 버튼으로 직접 입력하세요.</div>
        </div>
      )}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════
// 📅 스마트 일정 관리 & 알람 시스템
// ══════════════════════════════════════════════════════════════
function SmartSchedulePage({projects=[], cashItems=[], contractItems=[], currentUser, schedules=[], setSchedules}) {
  const [view, setView]       = useState("month")   // month | week | list
  const [today]               = useState(new Date())
  const [curDate, setCurDate] = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [editEvt, setEditEvt] = useState(null)
  const [filterType, setFilterType] = useState("all")
  const [notifPerm, setNotifPerm] = useState(Notification?.permission||"default")
  const [draftEvt, setDraftEvt] = useState({
    title:"", date:"", time:"09:00", endDate:"", type:"개인",
    repeat:"none", alarm:"30", note:"", color:"#6366F1"
  })

  const TYPES = {
    "개인":"#6366F1","회의":"#0891B2","납기":"#DC2626","기성":"#059669",
    "계약":"#D97706","공문":"#7C3AED","기타":"#6B7280"
  }
  const REPEAT = {"none":"반복없음","daily":"매일","weekly":"매주","monthly":"매월","yearly":"매년"}
  const ALARM  = {"0":"알람없음","10":"10분 전","30":"30분 전","60":"1시간 전","1440":"하루 전","2880":"2일 전"}

  // 시스템 일정 자동 수집
  const systemEvts = useMemo(()=>{
    const evts = []
    const YR = String(today.getFullYear())
    // 계약 예상시점
    ;(contractItems||[]).forEach(i=>{
      if(i.contractTime) evts.push({id:`sys_ct_${i.id}`,title:`📝 계약예정: ${i.name}`,date:i.contractTime,type:"계약",system:true,color:"#D97706",projectId:i.id})
      if(i.execTime)     evts.push({id:`sys_et_${i.id}`,title:`🏗 수행예정: ${i.name}`,date:i.execTime,type:"납기",system:true,color:"#DC2626",projectId:i.id})
    })
    // 기성 예정일
    ;(cashItems||[]).filter(i=>i.expectedDate&&!i.paidDate).forEach(i=>{
      evts.push({id:`sys_cd_${i.id||Math.random()}`,title:`💧 기성예정: ${i.projectName||""} ${i.stage||""}`,date:i.expectedDate,type:"기성",system:true,color:"#059669"})
    })
    // 프로젝트 납기
    ;(projects||[]).filter(p=>p.contractExpect||p.execDate).forEach(p=>{
      if(p.contractExpect) evts.push({id:`sys_pe_${p.id}`,title:`📋 계약예상: ${p.name}`,date:p.contractExpect,type:"계약",system:true,color:"#D97706",projectId:p.id})
    })
    return evts
  },[contractItems,cashItems,projects])

  // 전체 이벤트 = 개인 + 시스템
  const allEvts = useMemo(()=>[
    ...schedules.map(s=>({...s,system:false})),
    ...(filterType==="all"||filterType==="system"?systemEvts:[])
  ].filter(e=>filterType==="all"||filterType==="system"?true:e.type===filterType)
  ,[schedules,systemEvts,filterType])

  // 날짜 파싱 (다양한 형식 지원)
  const parseDate = (d) => {
    if(!d) return null
    // YYYY-MM-DD
    if(/^\d{4}-\d{2}-\d{2}/.test(d)) return new Date(d)
    // YYYY년 MM월
    const m = d.match(/(\d{4})년\s*(\d{1,2})월/)
    if(m) return new Date(parseInt(m[1]), parseInt(m[2])-1, 1)
    // YYYY년 MM월 DD일
    const m2 = d.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})/)
    if(m2) return new Date(parseInt(m2[1]), parseInt(m2[2])-1, parseInt(m2[3]))
    return null
  }

  // 월 내 이벤트
  const curYear  = curDate.getFullYear()
  const curMonth = curDate.getMonth()
  const daysInMonth = new Date(curYear, curMonth+1, 0).getDate()
  const firstDow    = new Date(curYear, curMonth, 1).getDay()

  const evtsByDay = useMemo(()=>{
    const map = {}
    allEvts.forEach(e=>{
      const d = parseDate(e.date)
      if(!d) return
      const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
      if(!map[key]) map[key]=[]
      map[key].push(e)
    })
    return map
  },[allEvts])

  // 알림 권한 요청
  const requestNotif = async () => {
    if(!("Notification" in window)) return alert("이 브라우저는 알림을 지원하지 않습니다.")
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
    if(perm==="granted") alert("✅ 알림 허용됐습니다. 이벤트 알람을 받을 수 있습니다.")
  }

  // 이벤트 저장
  const saveEvent = () => {
    if(!draftEvt.title.trim()||!draftEvt.date) return
    const id = editEvt?.id || `E${Date.now()}_${Math.random().toString(36).slice(2,5)}`
    const evt = {...draftEvt, id, createdBy:currentUser?.name||"", createdAt:new Date().toISOString()}
    if(editEvt) setSchedules(prev=>prev.map(e=>e.id===editEvt.id?evt:e))
    else setSchedules(prev=>[...prev, evt])
    setShowAdd(false); setEditEvt(null)
    setDraftEvt({title:"",date:"",time:"09:00",endDate:"",type:"개인",repeat:"none",alarm:"30",note:"",color:"#6366F1"})
  }

  const deleteEvent = (id) => {
    if(!window.confirm("삭제하시겠습니까?")) return
    setSchedules(prev=>prev.filter(e=>e.id!==id))
  }

  // 오늘 + 이번주 임박 이벤트
  const todayStr = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`
  const upcomingEvts = allEvts.filter(e=>{
    const d = parseDate(e.date); if(!d) return false
    const diff = (d-today)/(1000*60*60*24)
    return diff>=-1&&diff<=7
  }).sort((a,b)=>(parseDate(a.date)||0)-(parseDate(b.date)||0))


  return (
    <div>
      {/* 헤더 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:18,fontWeight:800,color:"#111827"}}>📅 일정 관리</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          {/* 알림 권한 */}
          <button onClick={requestNotif}
            style={{padding:"6px 12px",background:notifPerm==="granted"?"#D1FAE5":"#EEF2FF",color:notifPerm==="granted"?"#059669":"#6366F1",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            {notifPerm==="granted"?"🔔 알림 ON":"🔔 알림 설정"}
          </button>
          {/* 뷰 전환 */}
          <div style={{display:"flex",background:"#F3F4F6",borderRadius:8,padding:3,gap:2}}>
            {[["month","월"],["week","주"],["list","목록"]].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)}
                style={{padding:"5px 12px",border:"none",borderRadius:6,fontSize:12.5,fontWeight:view===v?700:400,cursor:"pointer",background:view===v?"#6366F1":"none",color:view===v?"#fff":"#6B7280"}}>{l}</button>
            ))}
          </div>
          {/* 필터 */}
          <select value={filterType} onChange={e=>setFilterType(e.target.value)}
            style={{padding:"6px 10px",border:"1px solid #E5E7EB",borderRadius:8,fontSize:12.5,fontFamily:"inherit",outline:"none"}}>
            <option value="all">전체</option>
            <option value="system">시스템 일정</option>
            {Object.keys(TYPES).map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={()=>{setShowAdd(true);setEditEvt(null)}}
            style={{padding:"7px 14px",background:"#6366F1",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>
            + 일정 추가
          </button>
        </div>
      </div>

      {/* 임박 일정 배너 */}
      {upcomingEvts.length>0&&(
        <div style={{background:"#EEF2FF",borderRadius:12,padding:"12px 16px",marginBottom:14,border:"1px solid #C7D2FE"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#312E81",marginBottom:8}}>🔔 7일 내 일정 ({upcomingEvts.length}건)</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {upcomingEvts.slice(0,6).map(e=>{
              const d = parseDate(e.date)
              const diff = d?Math.round((d-today)/(1000*60*60*24)):0
              const label = diff<0?"지남":diff===0?"오늘":diff===1?"내일":`${diff}일 후`
              return (
                <div key={e.id} style={{background:"#fff",borderRadius:8,padding:"6px 12px",border:`1.5px solid ${e.color||TYPES[e.type]||"#6B7280"}`,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:6,background:e.color||TYPES[e.type]||"#6B7280",color:"#fff"}}>{label}</span>
                  <span style={{fontSize:12.5,fontWeight:600,color:"#111827"}}>{e.title}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 일정 추가/수정 폼 */}
      {showAdd&&(
        <div style={{background:"#EEF2FF",borderRadius:14,border:"2px solid #6366F1",padding:"18px 20px",marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:800,color:"#312E81",marginBottom:12}}>{editEvt?"📝 일정 수정":"+ 일정 추가"}</div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10,marginBottom:10}}>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>제목 *</label>
              <input value={draftEvt.title} onChange={e=>setDraftEvt(p=>({...p,title:e.target.value}))} placeholder="일정 제목" style={INP()}/></div>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>유형</label>
              <select value={draftEvt.type} onChange={e=>setDraftEvt(p=>({...p,type:e.target.value,color:TYPES[e.target.value]||"#6366F1"}))} style={INP()}>
                {Object.keys(TYPES).map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>알람</label>
              <select value={draftEvt.alarm} onChange={e=>setDraftEvt(p=>({...p,alarm:e.target.value}))} style={INP()}>
                {Object.entries(ALARM).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>날짜 *</label>
              <input type="date" value={draftEvt.date} onChange={e=>setDraftEvt(p=>({...p,date:e.target.value}))} style={INP()}/></div>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>시간</label>
              <input type="time" value={draftEvt.time} onChange={e=>setDraftEvt(p=>({...p,time:e.target.value}))} style={INP()}/></div>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>종료일</label>
              <input type="date" value={draftEvt.endDate} onChange={e=>setDraftEvt(p=>({...p,endDate:e.target.value}))} style={INP()}/></div>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>반복</label>
              <select value={draftEvt.repeat} onChange={e=>setDraftEvt(p=>({...p,repeat:e.target.value}))} style={INP()}>
                {Object.entries(REPEAT).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:11.5,fontWeight:700,color:"#6366F1",display:"block",marginBottom:3}}>메모</label>
            <input value={draftEvt.note} onChange={e=>setDraftEvt(p=>({...p,note:e.target.value}))} placeholder="내용 메모" style={INP()}/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>{setShowAdd(false);setEditEvt(null)}} style={{padding:"7px 16px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:8,fontSize:12.5,fontWeight:600,cursor:"pointer"}}>취소</button>
            <button onClick={saveEvent} style={{padding:"7px 18px",background:"#6366F1",color:"#fff",border:"none",borderRadius:8,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>💾 저장</button>
          </div>
        </div>
      )}

      {/* 월간 캘린더 뷰 */}
      {view==="month"&&(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
          {/* 월 네비게이션 */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",borderBottom:"1px solid #E5E7EB"}}>
            <button onClick={()=>setCurDate(new Date(curYear,curMonth-1,1))} style={{padding:"6px 12px",background:"#F3F4F6",border:"none",borderRadius:8,cursor:"pointer",fontSize:14}}>‹</button>
            <div style={{fontSize:16,fontWeight:800,color:"#111827"}}>{curYear}년 {curMonth+1}월</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setCurDate(new Date())} style={{padding:"5px 12px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700}}>오늘</button>
              <button onClick={()=>setCurDate(new Date(curYear,curMonth+1,1))} style={{padding:"6px 12px",background:"#F3F4F6",border:"none",borderRadius:8,cursor:"pointer",fontSize:14}}>›</button>
            </div>
          </div>
          {/* 요일 헤더 */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
            {["일","월","화","수","목","금","토"].map((d,i)=>(
              <div key={d} style={{padding:"8px",textAlign:"center",fontSize:12.5,fontWeight:700,color:i===0?"#DC2626":i===6?"#2563EB":"#6B7280",background:"#F8FAFC",borderBottom:"1px solid #E5E7EB"}}>{d}</div>
            ))}
          </div>
          {/* 날짜 그리드 */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
            {Array.from({length:firstDow}).map((_,i)=>(
              <div key={`empty-${i}`} style={{minHeight:80,borderRight:"1px solid #F3F4F6",borderBottom:"1px solid #F3F4F6",background:"#FAFAFA"}}/>
            ))}
            {Array.from({length:daysInMonth}).map((_,idx)=>{
              const day = idx+1
              const isToday = curYear===today.getFullYear()&&curMonth===today.getMonth()&&day===today.getDate()
              const key = `${curYear}-${curMonth+1}-${day}`
              const dayEvts = evtsByDay[key]||[]
              const dow = (firstDow+idx)%7
              return (
                <div key={day} style={{minHeight:80,borderRight:"1px solid #F3F4F6",borderBottom:"1px solid #F3F4F6",padding:"4px",position:"relative",background:isToday?"#EEF2FF":"#fff",cursor:"pointer"}}
                  onDoubleClick={()=>{setDraftEvt(p=>({...p,date:`${curYear}-${String(curMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`}));setShowAdd(true)}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:isToday?"#6366F1":"none",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:2,fontSize:12.5,fontWeight:isToday?700:400,color:isToday?"#fff":dow===0?"#DC2626":dow===6?"#2563EB":"#374151"}}>{day}</div>
                  {dayEvts.slice(0,3).map(e=>(
                    <div key={e.id} style={{fontSize:10,padding:"1px 4px",borderRadius:4,marginBottom:1,background:(e.color||TYPES[e.type]||"#6B7280")+"22",color:e.color||TYPES[e.type]||"#6B7280",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer"}}
                      onClick={evt=>{evt.stopPropagation();if(!e.system){setEditEvt(e);setDraftEvt(e);setShowAdd(true)}}}>
                      {e.title}
                    </div>
                  ))}
                  {dayEvts.length>3&&<div style={{fontSize:9,color:"#9CA3AF",fontWeight:600}}>+{dayEvts.length-3}건</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 목록 뷰 */}
      {view==="list"&&(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
          <div style={{padding:"13px 18px",borderBottom:"1px solid #E5E7EB",fontSize:14,fontWeight:700,color:"#111827"}}>
            📋 전체 일정 ({allEvts.length}건)
          </div>
          {allEvts.length===0&&<div style={{padding:"48px",textAlign:"center",color:"#9CA3AF"}}>등록된 일정이 없습니다.</div>}
          {allEvts.sort((a,b)=>(parseDate(a.date)||0)-(parseDate(b.date)||0)).map((e,i)=>{
            const d = parseDate(e.date)
            const diff = d?Math.round((d-today)/(1000*60*60*24)):null
            return (
              <div key={e.id} style={{padding:"12px 18px",borderBottom:"1px solid #F3F4F6",display:"flex",gap:12,alignItems:"flex-start",background:i%2===0?"#fff":"#FAFAFA"}}>
                <div style={{width:4,background:e.color||TYPES[e.type]||"#6B7280",borderRadius:2,alignSelf:"stretch",flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                    <span style={{fontSize:10.5,padding:"1px 7px",borderRadius:9,background:(e.color||TYPES[e.type]||"#6B7280")+"18",color:e.color||TYPES[e.type]||"#6B7280",fontWeight:700}}>{e.type||"개인"}</span>
                    <span style={{fontSize:13.5,fontWeight:700,color:"#111827"}}>{e.title}</span>
                    {e.system&&<span style={{fontSize:9,background:"#EEF2FF",color:"#6366F1",padding:"1px 5px",borderRadius:5,fontWeight:600}}>시스템</span>}
                  </div>
                  <div style={{fontSize:12,color:"#6B7280"}}>{e.date} {e.time||""} {e.note&&`· ${e.note}`}</div>
                </div>
                <div style={{flexShrink:0,display:"flex",gap:6,alignItems:"center"}}>
                  {diff!==null&&<span style={{fontSize:11,fontWeight:700,color:diff<0?"#DC2626":diff===0?"#6366F1":"#6B7280"}}>{diff<0?"지남":diff===0?"오늘":`${diff}일 후`}</span>}
                  {!e.system&&(
                    <>
                      <button onClick={()=>{setEditEvt(e);setDraftEvt(e);setShowAdd(true)}} style={{padding:"3px 8px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:6,fontSize:11,cursor:"pointer"}}>✏</button>
                      <button onClick={()=>deleteEvent(e.id)} style={{padding:"3px 8px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:6,fontSize:11,cursor:"pointer"}}>✕</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 주간 뷰 */}
      {view==="week"&&(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
          <div style={{padding:"13px 18px",borderBottom:"1px solid #E5E7EB",fontSize:14,fontWeight:700,color:"#111827"}}>
            📅 이번 주 일정
          </div>
          {Array.from({length:7}).map((_,i)=>{
            const d = new Date(today); d.setDate(today.getDate()-today.getDay()+i)
            const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
            const dayEvts = evtsByDay[key]||[]
            const isToday = key===todayStr
            const DOW = ["일","월","화","수","목","금","토"]
            return (
              <div key={i} style={{display:"flex",gap:0,borderBottom:"1px solid #F3F4F6",background:isToday?"#EEF2FF":"#fff"}}>
                <div style={{width:80,padding:"12px",textAlign:"center",flexShrink:0,borderRight:"1px solid #E5E7EB"}}>
                  <div style={{fontSize:12,color:i===0?"#DC2626":i===6?"#2563EB":"#6B7280",fontWeight:700}}>{DOW[i]}</div>
                  <div style={{fontSize:20,fontWeight:800,color:isToday?"#6366F1":"#374151"}}>{d.getDate()}</div>
                </div>
                <div style={{flex:1,padding:"8px 12px",display:"flex",flexDirection:"column",gap:4}}>
                  {dayEvts.length===0&&<div style={{fontSize:12,color:"#D1D5DB",paddingTop:4}}>일정 없음</div>}
                  {dayEvts.map(e=>(
                    <div key={e.id} style={{padding:"5px 10px",borderRadius:7,background:(e.color||TYPES[e.type]||"#6B7280")+"18",borderLeft:`3px solid ${e.color||TYPES[e.type]||"#6B7280"}`,display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:12.5,fontWeight:600,color:"#111827"}}>{e.time?`${e.time} `:""}  {e.title}</span>
                      <span style={{fontSize:10,color:e.color||TYPES[e.type]||"#6B7280",fontWeight:600}}>{e.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{marginTop:14,padding:"10px 14px",background:"#F9FAFB",borderRadius:10,fontSize:11.5,color:"#9CA3AF",border:"1px solid #F3F4F6"}}>
        💡 날짜 더블클릭으로 일정 추가 · 시스템 일정은 계약현황·월수금계획에서 자동 수집 · 알림 설정 시 브라우저 푸시 알람 지원
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
// 📂 문서 보관소 — 계약서/공문/회의록 통합 관리
// ══════════════════════════════════════════════════════════════
function DocVaultPage({currentUser, projects=[]}) {
  const [docs, setDocsRaw] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem("sjs_docvault")||"[]") }catch{ return [] }
  })
  const setDocs = v => {
    const next = typeof v==="function"?v(docs):v
    try{ localStorage.setItem("sjs_docvault",JSON.stringify(next)) }catch{}
    setDocsRaw(next)
  }
  const [filterCat, setFilterCat]   = useState("전체")
  const [filterYear, setFilterYear] = useState("전체")
  const [search, setSearch]         = useState("")
  const [showAdd, setShowAdd]       = useState(false)
  const [analyzing, setAnalyzing]   = useState(false)
  const [draft, setDraft]           = useState({title:"",category:"연간계약서",year:String(new Date().getFullYear()),project:"",date:"",summary:"",tags:"",fileData:null,fileName:"",fileSize:0})

  const CATS = ["연간계약서","협력업체계약서","공문(수신)","공문(발신)","회의록","기타"]
  const CAT_ICON = {"연간계약서":"📝","협력업체계약서":"🤝","공문(수신)":"📨","공문(발신)":"📤","회의록":"📋","기타":"📌"}
  const CAT_COLOR = {"연간계약서":"#6366F1","협력업체계약서":"#059669","공문(수신)":"#0891B2","공문(발신)":"#D97706","회의록":"#7C3AED","기타":"#6B7280"}

  const years = [...new Set([String(new Date().getFullYear()),...docs.map(d=>d.year)])].sort((a,b)=>b-a)

  // 필터링
  const filtered = docs.filter(d=>{
    if(filterCat!=="전체"&&d.category!==filterCat) return false
    if(filterYear!=="전체"&&d.year!==filterYear) return false
    if(search.trim()&&!(d.title.includes(search)||d.summary.includes(search)||(d.tags||"").includes(search)||(d.project||"").includes(search))) return false
    return true
  }).sort((a,b)=>(b.date||"").localeCompare(a.date||""))

  // 파일 읽기 → AI 분석
  const handleFile = async (file) => {
    if(!file) return
    setDraft(p=>({...p,fileName:file.name,fileSize:file.size}))
    // AI 분석
    setAnalyzing(true)
    try {
      const base64 = await new Promise((res,rej)=>{
        const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file)
      })
      const isPdf = file.type==="application/pdf"
      const block = isPdf
        ? {type:"document",source:{type:"base64",media_type:"application/pdf",data:base64}}
        : {type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:base64}}

      const res = await fetch("/api/chat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",max_tokens:600,
          system:`문서를 분석하여 JSON으로만 응답하세요:
{"title":"문서 제목","category":"연간계약서|협력업체계약서|공문(수신)|공문(발신)|회의록|기타 중 하나","date":"날짜(YYYY-MM-DD)","project":"관련 프로젝트명","summary":"2~3줄 요약","tags":"주요 키워드 쉼표 구분"}
설명 없이 JSON만.`,
          messages:[{role:"user",content:[block,{type:"text",text:"이 문서를 분석하여 JSON으로 응답하세요."}]}]
        })
      })
      if(res.ok){
        const json=await res.json()
        const text=json.content?.[0]?.text||""
        const parsed=JSON.parse(text.replace(/```json|```/g,"").trim())
        setDraft(p=>({...p,...parsed,fileName:file.name,fileSize:file.size}))
      }
    } catch(e){ console.warn("AI 분석 실패:",e) }
    setAnalyzing(false)
  }

  const saveDoc = () => {
    if(!draft.title.trim()) return
    const id = `D${Date.now()}_${Math.random().toString(36).slice(2,5)}`
    const doc = {...draft, id, createdAt:new Date().toISOString(), createdBy:currentUser?.name||""}
    setDocs(prev=>[...prev, doc])
    setShowAdd(false)
    setDraft({title:"",category:"연간계약서",year:String(new Date().getFullYear()),project:"",date:"",summary:"",tags:"",fileData:null,fileName:"",fileSize:0})
  }

  const deleteDoc = (id) => { if(window.confirm("삭제하시겠습니까?")) setDocs(prev=>prev.filter(d=>d.id!==id)) }


  // 카테고리별 통계
  const catStats = CATS.map(c=>({cat:c,count:docs.filter(d=>d.category===c).length}))

  return (
    <div>
      {/* 헤더 */}
      <div style={{background:"linear-gradient(135deg,#92400E,#D97706)",borderRadius:16,padding:"20px 24px",marginBottom:16,color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>📂 문서 보관소</div>
          <div style={{fontSize:13,opacity:.85}}>계약서·공문·회의록 {docs.length}건 보관 중 · AI 자동 분류</div>
        </div>
        <button onClick={()=>setShowAdd(v=>!v)}
          style={{padding:"9px 18px",background:"rgba(255,255,255,.2)",color:"#fff",border:"2px solid rgba(255,255,255,.4)",borderRadius:10,fontSize:13.5,fontWeight:800,cursor:"pointer"}}>
          {showAdd?"✕ 취소":"+ 문서 등록"}
        </button>
      </div>

      {/* 카테고리 통계 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:14}}>
        {catStats.map(({cat,count})=>(
          <div key={cat} onClick={()=>setFilterCat(filterCat===cat?"전체":cat)}
            style={{background:filterCat===cat?CAT_COLOR[cat]||"#6B7280":"#fff",borderRadius:11,padding:"10px 12px",textAlign:"center",cursor:"pointer",border:`1.5px solid ${CAT_COLOR[cat]||"#E5E7EB"}`,transition:"all .15s"}}>
            <div style={{fontSize:18,marginBottom:3}}>{CAT_ICON[cat]||"📌"}</div>
            <div style={{fontSize:11,fontWeight:700,color:filterCat===cat?"#fff":CAT_COLOR[cat]||"#374151",lineHeight:1.3}}>{cat.replace("계약서","").replace("(","\n(")}</div>
            <div style={{fontSize:16,fontWeight:800,color:filterCat===cat?"#fff":"#111827",marginTop:2}}>{count}</div>
          </div>
        ))}
      </div>

      {/* 문서 등록 폼 */}
      {showAdd&&(
        <div style={{background:"#FEF9C3",borderRadius:14,border:"2px solid #D97706",padding:"18px 20px",marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:800,color:"#92400E",marginBottom:12}}>📁 새 문서 등록</div>

          {/* 파일 업로드 */}
          <label style={{display:"flex",alignItems:"center",gap:10,border:"2px dashed #D97706",borderRadius:10,padding:"12px 16px",cursor:"pointer",background:"#fff",marginBottom:12}}>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.hwp,.xlsx" style={{display:"none"}} onChange={e=>handleFile(e.target.files?.[0])}/>
            <span style={{fontSize:22}}>📤</span>
            <div>
              <div style={{fontSize:13.5,fontWeight:700,color:"#92400E"}}>{draft.fileName||"파일 선택 (PDF/이미지/Word)"}</div>
              {draft.fileName&&<div style={{fontSize:11,color:"#6B7280"}}>{(draft.fileSize/1024).toFixed(0)} KB · AI가 자동 분류합니다</div>}
            </div>
            {analyzing&&<div style={{marginLeft:"auto",fontSize:12,color:"#D97706",fontWeight:700}}>🤖 AI 분석 중...</div>}
          </label>

          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#92400E",display:"block",marginBottom:3}}>문서 제목 *</label>
              <input value={draft.title} onChange={e=>setDraft(p=>({...p,title:e.target.value}))} placeholder="문서 제목" style={INP()}/></div>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#92400E",display:"block",marginBottom:3}}>분류</label>
              <select value={draft.category} onChange={e=>setDraft(p=>({...p,category:e.target.value}))} style={INP()}>
                {CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#92400E",display:"block",marginBottom:3}}>연도</label>
              <input value={draft.year} onChange={e=>setDraft(p=>({...p,year:e.target.value}))} placeholder="2026" style={INP()}/></div>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#92400E",display:"block",marginBottom:3}}>문서일자</label>
              <input type="date" value={draft.date} onChange={e=>setDraft(p=>({...p,date:e.target.value}))} style={INP()}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10,marginBottom:10}}>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#92400E",display:"block",marginBottom:3}}>관련 프로젝트</label>
              <input list="proj-list-dv" value={draft.project} onChange={e=>setDraft(p=>({...p,project:e.target.value}))} placeholder="프로젝트명 검색" style={INP()}/>
              <datalist id="proj-list-dv">{projects.map(p=><option key={p.id} value={p.name}/>)}</datalist></div>
            <div><label style={{fontSize:11.5,fontWeight:700,color:"#92400E",display:"block",marginBottom:3}}>태그 (쉼표 구분)</label>
              <input value={draft.tags} onChange={e=>setDraft(p=>({...p,tags:e.target.value}))} placeholder="계약, 2026, 경남의료원" style={INP()}/></div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11.5,fontWeight:700,color:"#92400E",display:"block",marginBottom:3}}>요약 / 내용</label>
            <textarea value={draft.summary} onChange={e=>setDraft(p=>({...p,summary:e.target.value}))} rows={2} placeholder="AI가 자동 요약하거나 직접 입력" style={{...INP(),resize:"vertical"}}/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>setShowAdd(false)} style={{padding:"7px 16px",background:"#fff",color:"#6B7280",border:"1px solid #E5E7EB",borderRadius:8,fontSize:12.5,fontWeight:600,cursor:"pointer"}}>취소</button>
            <button onClick={saveDoc} style={{padding:"7px 18px",background:"#D97706",color:"#fff",border:"none",borderRadius:8,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>💾 저장</button>
          </div>
        </div>
      )}

      {/* 검색 + 필터 */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 제목·요약·태그·프로젝트 검색"
          style={{flex:1,padding:"8px 14px",border:"1.5px solid #E5E7EB",borderRadius:9,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
        <select value={filterYear} onChange={e=>setFilterYear(e.target.value)}
          style={{padding:"8px 12px",border:"1px solid #E5E7EB",borderRadius:9,fontSize:13,fontFamily:"inherit",outline:"none"}}>
          <option value="전체">전체 연도</option>
          {years.map(y=><option key={y} value={y}>{y}년</option>)}
        </select>
      </div>

      {/* 문서 목록 */}
      {filtered.length===0?(
        <div style={{background:"#fff",borderRadius:14,border:"2px dashed #E5E7EB",padding:"60px",textAlign:"center",color:"#9CA3AF"}}>
          <div style={{fontSize:36,marginBottom:8}}>📂</div>
          <div style={{fontSize:15,fontWeight:600,marginBottom:6,color:"#374151"}}>등록된 문서가 없습니다</div>
          <div style={{fontSize:13}}>+ 문서 등록 버튼으로 계약서, 공문, 회의록 등을 보관하세요.</div>
        </div>
      ):(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
          <div style={{padding:"12px 18px",borderBottom:"1px solid #E5E7EB",fontSize:13.5,fontWeight:700,color:"#374151",display:"flex",justifyContent:"space-between"}}>
            <span>검색결과 {filtered.length}건</span>
            <span style={{fontSize:12,color:"#9CA3AF",fontWeight:400}}>최신순</span>
          </div>
          {filtered.map((doc,i)=>(
            <div key={doc.id} style={{padding:"13px 18px",borderBottom:"1px solid #F3F4F6",display:"flex",gap:12,alignItems:"flex-start",background:i%2===0?"#fff":"#FAFAFA"}}>
              <div style={{fontSize:24,flexShrink:0,marginTop:2}}>{CAT_ICON[doc.category]||"📌"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,padding:"1px 7px",borderRadius:9,background:(CAT_COLOR[doc.category]||"#6B7280")+"18",color:CAT_COLOR[doc.category]||"#6B7280",fontWeight:700}}>{doc.category}</span>
                  {doc.year&&<span style={{fontSize:11,color:"#9CA3AF"}}>{doc.year}년</span>}
                  <span style={{fontSize:14,fontWeight:700,color:"#111827"}}>{doc.title}</span>
                </div>
                {doc.summary&&<div style={{fontSize:12.5,color:"#6B7280",marginBottom:4,lineHeight:1.5}}>{doc.summary}</div>}
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  {doc.project&&<span style={{fontSize:11.5,color:"#6366F1",fontWeight:600}}>🏗 {doc.project}</span>}
                  {doc.date&&<span style={{fontSize:11.5,color:"#6B7280"}}>📅 {doc.date}</span>}
                  {doc.fileName&&<span style={{fontSize:11,color:"#9CA3AF"}}>📎 {doc.fileName}</span>}
                  {doc.tags&&doc.tags.split(",").map(t=>t.trim()).filter(Boolean).map(t=>(
                    <span key={t} style={{fontSize:10,padding:"1px 6px",borderRadius:8,background:"#F3F4F6",color:"#6B7280"}}>#{t}</span>
                  ))}
                </div>
              </div>
              <div style={{flexShrink:0}}>
                <button onClick={()=>deleteDoc(doc.id)} style={{padding:"4px 9px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:6,fontSize:11.5,cursor:"pointer"}}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 📋 프로젝트 히스토리 메모 탭
// ══════════════════════════════════════════════════════════════
function ProjectMemoTab({proj, setProjects, currentUser}) {
  const [newText, setNewText] = useState("")
  const memos = proj.memo || []

  const addMemo = () => {
    if(!newText.trim()) return
    const entry = {id:`M${Date.now()}`, date:new Date().toISOString().slice(0,10),
                   text:newText.trim(), author:currentUser?.name||""}
    setProjects(prev=>prev.map(p=>p.id===proj.id?{...p,memo:[...(p.memo||[]),entry]}:p))
    setNewText("")
  }
  const delMemo = (id) => setProjects(prev=>prev.map(p=>p.id===proj.id?{...p,memo:(p.memo||[]).filter(m=>m.id!==id)}:p))


  return (
    <div style={{maxWidth:760}}>
      <div style={{background:"#EEF2FF",borderRadius:12,padding:"14px 16px",marginBottom:14,border:"1px solid #C7D2FE"}}>
        <div style={{fontSize:13.5,fontWeight:700,color:"#312E81",marginBottom:10}}>📋 {proj.name} — 히스토리 메모</div>
        <div style={{display:"flex",gap:8}}>
          <input value={newText} onChange={e=>setNewText(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addMemo()}
            placeholder="특이사항, 이슈, 진행현황 등 메모 입력 (Enter)"
            style={INP()}/>
          <button onClick={addMemo}
            style={{padding:"9px 18px",background:"#6366F1",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",flexShrink:0}}>
            + 기록
          </button>
        </div>
      </div>

      {memos.length===0 && (
        <div style={{padding:"48px",textAlign:"center",color:"#9CA3AF",background:"#fff",borderRadius:12,border:"1px solid #E5E7EB"}}>
          <div style={{fontSize:28,marginBottom:8}}>📋</div>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4,color:"#374151"}}>기록된 히스토리가 없습니다</div>
          <div style={{fontSize:12}}>위 입력창에서 이슈, 진행사항, 특이사항 등을 날짜별로 기록하세요.</div>
        </div>
      )}

      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden"}}>
        {[...memos].reverse().map((m,i)=>(
          <div key={m.id||i} style={{padding:"13px 16px",borderBottom:"1px solid #F3F4F6",display:"flex",gap:12,alignItems:"flex-start",background:i%2===0?"#fff":"#FAFAFA"}}>
            <div style={{width:3,background:"#6366F1",borderRadius:2,alignSelf:"stretch",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:700,color:"#6366F1"}}>{m.date}</span>
                {m.author&&<span style={{fontSize:11,color:"#9CA3AF"}}>by {m.author}</span>}
              </div>
              <div style={{fontSize:13.5,color:"#111827",lineHeight:1.65,whiteSpace:"pre-wrap"}}>{m.text}</div>
            </div>
            <button onClick={()=>delMemo(m.id)}
              style={{padding:"2px 9px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:6,fontSize:11,cursor:"pointer",flexShrink:0}}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 📋 실행계획서 워크플로우 — 협력업체 비용 비교 + 기안 시스템
// ══════════════════════════════════════════════════════════════
function PlanWorkflow({proj, selVer, selVerIdx, pyF, pyS, editVend, setEditVend, vDraft, setVDraft, saveVend, upd, projects, vendorsDB, canWrite}) {
  const [activeTab,   setActiveTab]   = useState("compare") // compare | draft | payment
  const [selCatFocus, setSelCatFocus] = useState(null)      // 공종 포커스
  const [showVendorPool, setShowVendorPool] = useState(false)

  if(!selVer) return null

  const vendors = editVend ? vDraft : (selVer.vendors || [])
  const fW2 = v => v>=1e8?`${(v/1e8).toFixed(2)}억`:`${Math.round(v).toLocaleString()}원`
  const fPy2 = v => v>0?`${Math.round(v).toLocaleString()}원/평`:"-"

  // 공종별로 그룹화
  const byCAT = {}
  vendors.forEach((v,i)=>{
    if(!byCAT[v.cat]) byCAT[v.cat]=[]
    byCAT[v.cat].push({...v, _idx:i})
  })

  // vendorsDB에서 같은 공종의 다른 프로젝트 실적 가져오기
  const getHistoricalData = (cat) => {
    const results = []
    projects.forEach(p=>{
      if(p.id===proj.id) return
      p.versions?.forEach(ver=>{
        const match = ver.vendors?.find(v=>v.cat===cat&&v.contract>0)
        if(!match) return
        const basis=getAreaBasis(cat)
        const py = basis==="대지"?toPy(p.siteArea||0):toPy(p.floorArea||0)
        const up = py>0 ? match.contract/py : 0
        results.push({
          projName: p.name, projCode: p.code, ver: ver.ver,
          areaM2: basis==="대지"?(p.siteArea||0):(p.floorArea||0),
          py, contract: match.contract, nego2: match.nego2||0,
          up, up2: match.nego2&&py>0?match.nego2/py:0,
          vendorName: match.name
        })
      })
    })
    return results.sort((a,b)=>b.contract-a.contract).slice(0,10)
  }

  // 전체 비교 엑셀 다운로드
  const downloadCompareExcel = () => {
    const wb = XLSX.utils.book_new()

    // ① 표지 / 기본 정보
    const coverRows = [
      [`실행계획서 협력업체 비용 비교표`],
      [],
      [`프로젝트명`, proj.name],
      [`프로젝트코드`, proj.code||""],
      [`주관본부`, (proj.depts||[]).join(", ")],
      [`담당PM`, proj.pm||""],
      [`용역비(VAT별도)`, proj.serviceFee||0],
      [`연면적`, `${(proj.floorArea||0).toLocaleString()}㎡ (${Math.round(toPy(proj.floorArea||0)).toLocaleString()}평)`],
      [`대지면적`, `${(proj.siteArea||0).toLocaleString()}㎡ (${Math.round(toPy(proj.siteArea||0)).toLocaleString()}평)`],
      [`작성일`, new Date().toISOString().slice(0,10)],
      [`회차`, selVer.ver||""],
    ]
    const wsCover = XLSX.utils.aoa_to_sheet(coverRows)
    wsCover["!cols"] = [{wch:18},{wch:40}]
    XLSX.utils.book_append_sheet(wb, wsCover, "① 기본정보")

    // ② 협력업체 비용 현황
    const vendorRows = [
      [`분야`, `업체명`, `원가견적(원)`, `1차NEGO(원)`, `2차NEGO(원)`, `면적기준`, `평당단가(원가)`, `평당단가(2차)`, `용역비대비(%)`, `비고`],
    ]
    let totalContract=0, totalNego2=0
    vendors.forEach(v=>{
      const basis=getAreaBasis(v.cat)
      const py = basis==="대지"?pyS:basis==="연면적"?pyF:0
      const up1 = py>0?Math.round(v.contract/py):"-"
      const up2 = py>0&&v.nego2?Math.round(v.nego2/py):"-"
      const ratio = proj.serviceFee>0?(v.contract/proj.serviceFee*100).toFixed(2)+"%":"-"
      vendorRows.push([v.cat, v.name, v.contract, v.nego1||0, v.nego2||0,
        basis==="대지"?"대지면적":basis==="연면적"?"연면적":"1식",
        up1, up2, ratio, ""])
      totalContract += v.contract
      totalNego2 += v.nego2||0
    })
    const totalRatio = proj.serviceFee>0?(totalContract/proj.serviceFee*100).toFixed(1)+"%":"-"
    vendorRows.push([`합계`, "", totalContract, "", totalNego2, "", "", "", totalRatio, ""])
    const wsVend = XLSX.utils.aoa_to_sheet(vendorRows)
    wsVend["!cols"] = [{wch:14},{wch:24},{wch:16},{wch:14},{wch:14},{wch:10},{wch:14},{wch:14},{wch:12},{wch:20}]
    XLSX.utils.book_append_sheet(wb, wsVend, "② 협력업체비용현황")

    // ③ 공종별 유사 프로젝트 비교 (평당단가)
    const UP_CATS=["구조","토목","조경","기계","전기통신소방","전기통신","기계소방","CG","견적","건축외주","부대토목","흙막이","지반조사","현황측량","소방"]
    const compRows = [`공종`, `프로젝트명`, `연면적(㎡)`, `연면적(평)`, `공종금액(원)`, `2차NEGO`, `평당단가(원가)`, `평당단가(2차)`, `업체명`]
    const allCompRows = [compRows]

    vendors.filter(v=>UP_CATS.some(u=>v.cat.includes(u)||u.includes(v.cat))).forEach(v=>{
      // 현재 프로젝트
      const basis=getAreaBasis(v.cat)
      const py = basis==="대지"?pyS:basis==="연면적"?pyF:0
      allCompRows.push([
        v.cat, `▶ ${proj.name}(현재)`,
        basis==="대지"?proj.siteArea||0:proj.floorArea||0,
        py>0?Math.round(py):"-",
        v.contract, v.nego2||0,
        py>0?Math.round(v.contract/py):"-",
        py>0&&v.nego2?Math.round(v.nego2/py):"-",
        v.name
      ])
      // 유사 프로젝트
      getHistoricalData(v.cat).forEach(h=>{
        allCompRows.push([
          "", h.projName,
          Math.round(h.areaM2), Math.round(h.py),
          h.contract, h.nego2||0,
          h.up>0?Math.round(h.up):"-",
          h.up2>0?Math.round(h.up2):"-",
          h.vendorName
        ])
      })
      allCompRows.push([]) // 공종 구분 빈줄
    })
    const wsComp = XLSX.utils.aoa_to_sheet(allCompRows)
    wsComp["!cols"] = [{wch:14},{wch:36},{wch:12},{wch:10},{wch:16},{wch:14},{wch:14},{wch:14},{wch:24}]
    XLSX.utils.book_append_sheet(wb, wsComp, "③ 유사프로젝트비교")

    // ④ 지급계획 (단계별)
    const STAGES = ["제안·계획설계","기본설계","중간설계","실시설계","준공설계","납품"]
    const payRows = [
      [`분야`, `업체명`, `최종금액(원)`, ...STAGES, `합계`]
    ]
    vendors.forEach(v=>{
      const finalAmt = v.nego2||v.contract
      const stageAmt = Math.round(finalAmt/STAGES.length)
      payRows.push([v.cat, v.name, finalAmt, ...STAGES.map(()=>stageAmt), finalAmt])
    })
    payRows.push([`합계`, "", vendors.reduce((s,v)=>s+(v.nego2||v.contract),0),
      ...STAGES.map(()=>""), vendors.reduce((s,v)=>s+(v.nego2||v.contract),0)])
    const wsPay = XLSX.utils.aoa_to_sheet(payRows)
    wsPay["!cols"] = [{wch:14},{wch:24},{wch:16},...STAGES.map(()=>({wch:14})),{wch:16}]
    XLSX.utils.book_append_sheet(wb, wsPay, "④ 단계별지급계획")

    XLSX.writeFile(wb, `실행계획서_협력업체비교_${proj.code||proj.name}_${selVer.ver||""}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const C2 = {navyM:"#185FA5",navyL:"#E6F1FB",green:"#1D9E75",greenL:"#EAF3DE",amber:"#BA7517",amberL:"#FAEEDA",red:"#A32D2D",redL:"#FCEBEB",gray:"#888780",grayL:"#F1EFE8"}
  const th = (a="left") => ({padding:"9px 12px",textAlign:a,fontSize:12.5,fontWeight:700,color:"#6B7280",background:"#F8FAFC",borderBottom:"2px solid #E5E7EB",whiteSpace:"nowrap"})
  const td = (a="left",bold=false,color="#374151") => ({padding:"9px 12px",textAlign:a,fontSize:13,fontWeight:bold?700:400,color,borderBottom:"1px solid #F3F4F6"})

  return (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden",marginTop:16}}>
      {/* 워크플로우 헤더 */}
      <div style={{background:"linear-gradient(135deg,#0C447C,#185FA5)",padding:"16px 20px",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:16,fontWeight:900,marginBottom:3}}>📋 실행계획서 — 협력업체 비용 비교 · 기안</div>
          <div style={{fontSize:12.5,opacity:.8}}>공종별 단가 비교 → NEGO → 지급계획 → 엑셀 다운로드</div>
        </div>
        <button onClick={downloadCompareExcel}
          style={{padding:"9px 20px",background:"#34D399",color:"#fff",border:"none",borderRadius:10,fontSize:13.5,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          ⬇ 비교표 엑셀 다운로드
        </button>
      </div>

      {/* 탭 */}
      <div style={{display:"flex",borderBottom:"2px solid #E5E7EB",background:"#F8FAFC"}}>
        {[["compare","📊 공종별 비교표"],["draft","✏ 비용 편집"],["payment","📅 단계별 지급계획"]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)}
            style={{padding:"11px 20px",border:"none",background:"none",fontSize:13.5,fontWeight:700,cursor:"pointer",
              color:activeTab===id?"#185FA5":"#6B7280",
              borderBottom:activeTab===id?"3px solid #185FA5":"3px solid transparent",
              marginBottom:-2,transition:"all .15s"}}>
            {label}
          </button>
        ))}
      </div>

      <div style={{padding:"16px 20px"}}>

        {/* ── ① 공종별 비교표 ── */}
        {activeTab==="compare"&&(
          <div>
            <div style={{marginBottom:14,padding:"10px 14px",background:"#EEF2FF",borderRadius:10,fontSize:12.5,color:"#312E81",lineHeight:1.7}}>
              💡 각 공종의 현재 입력 금액과 <strong>유사 프로젝트 실적</strong>을 비교합니다.
              공종명을 클릭하면 해당 공종 상세 비교가 펼쳐집니다.
              비교 후 <strong>엑셀 다운로드</strong>하여 기안 자료로 활용하세요.
            </div>

            {/* 전체 요약 */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
              {[
                ["공종 수",vendors.length+"개","#6366F1"],
                ["원가 합계",fW2(vendors.reduce((s,v)=>s+v.contract,0)),"#185FA5"],
                ["NEGO 합계",fW2(vendors.reduce((s,v)=>s+(v.nego2||0),0)),"#059669"],
                ["용역비 대비",proj.serviceFee>0?(vendors.reduce((s,v)=>s+v.contract,0)/proj.serviceFee*100).toFixed(1)+"%":"-","#D97706"],
              ].map(([l,v,c])=>(
                <div key={l} style={{background:"#F8FAFC",borderRadius:10,padding:"12px 14px",border:"1px solid #E5E7EB"}}>
                  <div style={{fontSize:12,color:"#9CA3AF",marginBottom:4}}>{l}</div>
                  <div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div>
                </div>
              ))}
            </div>

            {/* 공종별 비교 테이블 */}
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    <th style={th()}>공종</th>
                    <th style={th()}>업체명</th>
                    <th style={th("right")}>연면적(㎡)</th>
                    <th style={th("right")}>평수</th>
                    <th style={th("right")}>원가견적</th>
                    <th style={th("right")}>2차NEGO</th>
                    <th style={th("right")}>평당단가(원가)</th>
                    <th style={th("right")}>평당단가(NEGO)</th>
                    <th style={th("right")}>용역비 대비</th>
                    <th style={th("center")}>유사실적</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v,i)=>{
                    const basis=getAreaBasis(v.cat)
                    const areaM2 = basis==="대지"?(proj.siteArea||0):(proj.floorArea||0)
                    const py = basis==="대지"?pyS:basis==="연면적"?pyF:0
                    const up1 = py>0?v.contract/py:null
                    const up2 = py>0&&v.nego2?v.nego2/py:null
                    const hist = getHistoricalData(v.cat)
                    const avgUp = hist.length>0 ? hist.reduce((s,h)=>s+h.up,0)/hist.length : 0
                    const diffPct = up1&&avgUp>0 ? ((up1-avgUp)/avgUp*100) : null
                    const isExpanded = selCatFocus===`${v.cat}_${i}`
                    return (
                      <>
                        <tr key={`${v.cat}_${i}`}
                          style={{background:i%2===0?"#fff":"#F9FAFB",cursor:"pointer"}}
                          onClick={()=>setSelCatFocus(isExpanded?null:`${v.cat}_${i}`)}>
                          <td style={td("left",true,"#185FA5")}>
                            <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                              {v.cat}
                              {hist.length>0&&<span style={{fontSize:10,background:"#EEF2FF",color:"#6366F1",padding:"1px 5px",borderRadius:5}}>{hist.length}건</span>}
                            </span>
                          </td>
                          <td style={td()}>{v.name||"-"}</td>
                          <td style={td("right",false,"#9CA3AF")}>{areaM2>0?areaM2.toLocaleString():"-"}</td>
                          <td style={td("right",false,"#9CA3AF")}>{py>0?Math.round(py).toLocaleString():"-"}</td>
                          <td style={td("right",true,"#185FA5")}>{v.contract>0?fW2(v.contract):"-"}</td>
                          <td style={td("right",true,"#059669")}>{v.nego2>0?fW2(v.nego2):"-"}</td>
                          <td style={td("right")}>
                            {up1?<div>
                              <div style={{fontSize:13.5,fontWeight:700}}>{Math.round(up1).toLocaleString()}<span style={{fontSize:10,fontWeight:400}}>원/평</span></div>
                              {avgUp>0&&diffPct!==null&&<div style={{fontSize:10.5,color:diffPct>20?"#DC2626":diffPct<-20?"#059669":"#6B7280",fontWeight:600}}>
                                평균대비 {diffPct>0?"+":""}{diffPct.toFixed(0)}%
                              </div>}
                            </div>:"-"}
                          </td>
                          <td style={td("right",false,"#059669")}>
                            {up2?<>{Math.round(up2).toLocaleString()}<span style={{fontSize:10}}>원/평</span></>:"-"}
                          </td>
                          <td style={td("right")}>
                            {proj.serviceFee>0?(v.contract/proj.serviceFee*100).toFixed(2)+"%":"-"}
                          </td>
                          <td style={td("center")}>
                            <span style={{fontSize:12,color:"#6366F1",fontWeight:600}}>
                              {isExpanded?"▲ 접기":hist.length>0?`▼ ${hist.length}건 보기`:"-"}
                            </span>
                          </td>
                        </tr>
                        {/* 유사 프로젝트 실적 펼침 */}
                        {isExpanded&&hist.map((h,hi)=>(
                          <tr key={`hist_${i}_${hi}`} style={{background:"#EEF2FF"}}>
                            <td style={{...td("left"),paddingLeft:24,fontSize:12,color:"#6B7280"}}>└ 유사실적</td>
                            <td style={{...td(),fontSize:12,color:"#6366F1"}}>{h.vendorName}</td>
                            <td style={{...td("right"),fontSize:12,color:"#9CA3AF"}}>{Math.round(h.areaM2).toLocaleString()}</td>
                            <td style={{...td("right"),fontSize:12,color:"#9CA3AF"}}>{Math.round(h.py).toLocaleString()}</td>
                            <td style={{...td("right"),fontSize:12}}>{fW2(h.contract)}</td>
                            <td style={{...td("right"),fontSize:12,color:"#059669"}}>{h.nego2>0?fW2(h.nego2):"-"}</td>
                            <td style={{...td("right"),fontSize:12,fontWeight:600}}>{h.up>0?Math.round(h.up).toLocaleString()+"원/평":"-"}</td>
                            <td style={{...td("right"),fontSize:12,color:"#059669"}}>{h.up2>0?Math.round(h.up2).toLocaleString()+"원/평":"-"}</td>
                            <td style={td("right",false,"#9CA3AF")} colSpan={2}>
                              <span style={{fontSize:11}}>{h.projCode} {h.projName.slice(0,20)}</span>
                            </td>
                          </tr>
                        ))}
                      </>
                    )
                  })}
                  {/* 합계 행 */}
                  <tr style={{background:"#EEF2FF",borderTop:"2px solid #6366F1"}}>
                    <td style={td("left",true,"#312E81")} colSpan={4}>합계</td>
                    <td style={td("right",true,"#185FA5")}>{fW2(vendors.reduce((s,v)=>s+v.contract,0))}</td>
                    <td style={td("right",true,"#059669")}>{fW2(vendors.reduce((s,v)=>s+(v.nego2||0),0))}</td>
                    <td colSpan={2}/>
                    <td style={td("right",true,"#D97706")}>
                      {proj.serviceFee>0?(vendors.reduce((s,v)=>s+v.contract,0)/proj.serviceFee*100).toFixed(1)+"%":"-"}
                    </td>
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ② 비용 편집 ── */}
        {activeTab==="draft"&&(
          <div>
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
              {canWrite&&(!editVend
                ?<button onClick={()=>{setVDraft(selVer.vendors.map(v=>({...v})));setEditVend(true)}}
                  style={{padding:"8px 16px",background:"#185FA5",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  ✏ 편집 시작
                </button>
                :<>
                  <button onClick={saveVend}
                    style={{padding:"8px 16px",background:"#059669",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>✓ 저장</button>
                  <button onClick={()=>setVDraft(prev=>[...prev,{cat:"",name:"",contract:0,nego1:0,nego2:0}])}
                    style={{padding:"8px 14px",background:"#EEF2FF",color:"#6366F1",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>+ 행 추가</button>
                  <button onClick={()=>{setEditVend(false);setVDraft(null)}}
                    style={{padding:"8px 14px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:9,fontSize:13,cursor:"pointer"}}>취소</button>
                </>
              )}
              <div style={{fontSize:12.5,color:"#9CA3AF",marginLeft:"auto"}}>
                토목·조경·흙막이·지반조사 → 대지면적 | 구조·기계·전기·소방·CG·건축외주 → 연면적 | 친환경·BIM·인테리어 → 1식
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  {["분야","업체명","원가견적(원)","1차NEGO","2차NEGO","면적기준","평당단가(원가)","평당단가(2차)","비율%"].map((h,i)=>(
                    <th key={h} style={th(i>=2?"right":"left")}>{h}</th>
                  ))}
                  {editVend&&<th style={th("center")}>삭제</th>}
                </tr></thead>
                <tbody>
                  {vendors.map((v,i)=>{
                    const basis=getAreaBasis(v.cat)
                    const py=basis==="대지"?pyS:basis==="연면적"?pyF:0
                    const up1=py>0?v.contract/py:null, up2=py>0&&v.nego2?v.nego2/py:null
                    const bLabel=basis==="대지"?"대지면적":basis==="연면적"?"연면적":"1식"
                    return <tr key={i} style={{background:i%2===0?"#fff":"#F9FAFB"}}>
                      <td style={td()}>{editVend?<input value={v.cat} onChange={e=>upd(i,"cat",e.target.value)} style={{padding:"5px 8px",border:"1px solid #E5E7EB",borderRadius:6,fontSize:13,width:90,fontFamily:"inherit"}}/>:<span style={{padding:"2px 8px",background:"#EEF2FF",color:"#185FA5",borderRadius:6,fontSize:12.5,fontWeight:700}}>{v.cat}</span>}</td>
                      <td style={td()}>{editVend?<input value={v.name} onChange={e=>upd(i,"name",e.target.value)} style={{padding:"5px 8px",border:"1px solid #E5E7EB",borderRadius:6,fontSize:13,width:160,fontFamily:"inherit"}}/>:v.name}</td>
                      <td style={td("right",true,"#185FA5")}>{editVend?<input type="number" value={v.contract} onChange={e=>upd(i,"contract",e.target.value)} style={{padding:"5px 8px",border:"1px solid #E5E7EB",borderRadius:6,fontSize:13,width:120,textAlign:"right",fontFamily:"inherit"}}/>:fW2(v.contract)}</td>
                      <td style={td("right",false,"#9CA3AF")}>{editVend?<input type="number" value={v.nego1||0} onChange={e=>upd(i,"nego1",e.target.value)} style={{padding:"5px 8px",border:"1px solid #E5E7EB",borderRadius:6,fontSize:13,width:100,textAlign:"right",fontFamily:"inherit"}}/>:v.nego1?fW2(v.nego1):"-"}</td>
                      <td style={td("right",true,"#059669")}>{editVend?<input type="number" value={v.nego2||0} onChange={e=>upd(i,"nego2",e.target.value)} style={{padding:"5px 8px",border:"1px solid #6366F1",borderRadius:6,fontSize:13,width:100,textAlign:"right",fontFamily:"inherit"}}/>:v.nego2?fW2(v.nego2):"-"}</td>
                      <td style={td("center")}><span style={{fontSize:11,padding:"2px 6px",borderRadius:5,background:basis==="대지"?"#FEF3C7":basis==="1식"?"#F3F4F6":"#D1FAE5",color:basis==="대지"?"#D97706":basis==="1식"?"#6B7280":"#059669"}}>{bLabel}</span></td>
                      <td style={td("right",false,"#185FA5")}>{up1?`${Math.round(up1).toLocaleString()}원/평`:"1식"}</td>
                      <td style={td("right",false,"#059669")}>{up2?`${Math.round(up2).toLocaleString()}원/평`:"-"}</td>
                      <td style={td("right")}>{proj.serviceFee>0?(v.contract/proj.serviceFee*100).toFixed(2)+"%":"-"}</td>
                      {editVend&&<td style={td("center")}><button onClick={()=>setVDraft(prev=>prev.filter((_,ri)=>ri!==i))} style={{padding:"3px 8px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:6,fontSize:12,cursor:"pointer"}}>✕</button></td>}
                    </tr>
                  })}
                  <tr style={{background:"#EEF2FF",borderTop:"2px solid #185FA5"}}>
                    <td style={td("left",true,"#0C447C")} colSpan={2}>합계</td>
                    <td style={td("right",true,"#185FA5")}>{fW2(vendors.reduce((s,v)=>s+v.contract,0))}</td>
                    <td style={td("right",false,"#9CA3AF")}>{fW2(vendors.reduce((s,v)=>s+(v.nego1||0),0))}</td>
                    <td style={td("right",true,"#059669")}>{fW2(vendors.reduce((s,v)=>s+(v.nego2||0),0))}</td>
                    <td colSpan={3}/>
                    <td style={td("right",true,"#D97706")}>{proj.serviceFee>0?(vendors.reduce((s,v)=>s+v.contract,0)/proj.serviceFee*100).toFixed(1)+"%":"-"}</td>
                    {editVend&&<td/>}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ③ 단계별 지급계획 ── */}
        {activeTab==="payment"&&(
          <div>
            <div style={{marginBottom:12,padding:"10px 14px",background:"#FEF3C7",borderRadius:10,fontSize:12.5,color:"#92400E"}}>
              💡 수주 후 계약체결 → 실행계획서 작성 → 단계별 수금에 맞춰 협력업체 지급 계획을 수립합니다.
              각 단계별 지급 비율을 조정하고 엑셀로 내보낼 수 있습니다.
            </div>
            {(() => {
              const STAGES = [
                {id:"plan", label:"제안·계획설계", default:15},
                {id:"basic", label:"기본설계", default:20},
                {id:"mid", label:"중간설계", default:20},
                {id:"exec", label:"실시설계", default:30},
                {id:"final", label:"준공설계", default:10},
                {id:"deliver", label:"납품완료", default:5},
              ]
              return (
                <div>
                  <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                    {STAGES.map(s=>(
                      <div key={s.id} style={{flex:1,minWidth:100,background:"#F8FAFC",borderRadius:9,padding:"10px 12px",border:"1px solid #E5E7EB",textAlign:"center"}}>
                        <div style={{fontSize:11.5,fontWeight:700,color:"#6366F1",marginBottom:4}}>{s.label}</div>
                        <div style={{fontSize:16,fontWeight:900,color:"#374151"}}>{s.default}%</div>
                      </div>
                    ))}
                  </div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",minWidth:800}}>
                      <thead>
                        <tr style={{background:"#F8FAFC"}}>
                          <th style={th()}>공종</th>
                          <th style={th()}>업체명</th>
                          <th style={th("right")}>최종금액(원)</th>
                          {STAGES.map(s=><th key={s.id} style={th("right")}>{s.label}<br/><span style={{fontSize:10,fontWeight:400,color:"#9CA3AF"}}>{s.default}%</span></th>)}
                          <th style={th("right")}>합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendors.map((v,i)=>{
                          const final = v.nego2||v.contract
                          return (
                            <tr key={i} style={{background:i%2===0?"#fff":"#F9FAFB"}}>
                              <td style={td("left",true,"#185FA5")}>
                                <span style={{padding:"2px 7px",background:"#EEF2FF",color:"#185FA5",borderRadius:5,fontSize:12}}>{v.cat}</span>
                              </td>
                              <td style={td()}>{v.name||"-"}</td>
                              <td style={td("right",true)}>{fW2(final)}</td>
                              {STAGES.map(s=><td key={s.id} style={td("right",false,"#374151")}>
                                {fW2(Math.round(final*s.default/100))}
                              </td>)}
                              <td style={td("right",true,"#185FA5")}>{fW2(final)}</td>
                            </tr>
                          )
                        })}
                        <tr style={{background:"#EEF2FF",borderTop:"2px solid #185FA5"}}>
                          <td style={td("left",true,"#0C447C")} colSpan={2}>합계</td>
                          <td style={td("right",true,"#185FA5")}>{fW2(vendors.reduce((s,v)=>s+(v.nego2||v.contract),0))}</td>
                          {STAGES.map(s=><td key={s.id} style={td("right",true,"#374151")}>
                            {fW2(vendors.reduce((s2,v)=>s2+Math.round((v.nego2||v.contract)*s.default/100),0))}
                          </td>)}
                          <td style={td("right",true,"#185FA5")}>{fW2(vendors.reduce((s,v)=>s+(v.nego2||v.contract),0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 🔭 연말 손익 예상 분석 리포트
// ══════════════════════════════════════════════════════════════
function YearEndForecast({cashItems=[],saleItems=[],contractItems=[],deptBiz={},years=[],DEPTS=[],DEPT_COLORS={}}) {
  const NOW   = new Date()
  const YEAR  = NOW.getFullYear()
  const MONTH = NOW.getMonth() + 1  // 현재 월
  const REMAINING = 12 - MONTH      // 남은 개월

  // ── 수금 현황 분석 ───────────────────────────────────────────
  const cashThisYear = cashItems.filter(i => String(i.expectedDate||"").startsWith(YEAR))
  const cashPaid     = cashThisYear.filter(i => i.paidDate).reduce((s,i)=>s+(i.amount||0),0)
  const cashConf     = cashThisYear.filter(i => !i.paidDate && i.itemType!=="미정").reduce((s,i)=>s+(i.amount||0),0)
  const cashUnconf   = cashThisYear.filter(i => i.itemType==="미정").reduce((s,i)=>s+(i.amount||0),0)
  const cashTotal    = cashPaid + cashConf

  // 월별 수금 실적 (1~MONTH)
  const cashByMonth  = Array.from({length:12},(_,mi)=>{
    const m = String(mi+1).padStart(2,"0")
    const paid = cashItems.filter(i=>i.paidDate?.startsWith(`${YEAR}-${m}`)).reduce((s,i)=>s+(i.amount||0),0)
    const plan = cashItems.filter(i=>i.expectedDate?.startsWith(`${YEAR}-${m}`)&&!i.paidDate).reduce((s,i)=>s+(i.amount||0),0)
    return {month:mi+1,paid,plan,total:paid+plan}
  })
  const avgMonthly = MONTH > 0 ? cashPaid / MONTH : 0
  const forecastCash = cashPaid + cashConf + (avgMonthly * REMAINING * 0.7) // 70% 실현율 가정

  // ── 계약 현황 분석 ───────────────────────────────────────────
  const thisYearContracts = contractItems.filter(i=>String(i.contractYear||"").startsWith(YEAR))
  const normFee = v => { const n=Math.abs(Number(v)||0); return n>1000?n/1e8:n }
  const contractDone = thisYearContracts.filter(i=>(i.type||"").includes("계약")).reduce((s,i)=>s+normFee(i.serviceFeeExpect||i.amount||0),0)
  const contractConf = thisYearContracts.filter(i=>i.type==="확정").reduce((s,i)=>s+normFee(i.serviceFeeExpect||i.amount||0),0)
  const contractPush = thisYearContracts.filter(i=>i.type==="추진").reduce((s,i)=>s+normFee(i.serviceFeeExpect||i.amount||0),0)
  const contractTotal= contractDone + contractConf

  // 목표 (years에서 가져오기)
  const yearTarget = years.find(y=>String(y.yr)===String(YEAR))
  const targetCash = (yearTarget?.목표매출||0)
  const targetOrder= (yearTarget?.목표수주||0)

  // ── 지출 현황 ────────────────────────────────────────────────
  const saleThisYear = saleItems.filter(i=>String(i.date||"").startsWith(YEAR))
  const expTotal     = saleThisYear.reduce((s,i)=>s+(i.amount||0),0)
  const avgMonthlyExp= MONTH > 0 ? expTotal / MONTH / 1e8 : 0

  // ── 손익 예상 ────────────────────────────────────────────────

  const forecastCashAmt = forecastCash / 1e8
  const forecastExpAmt  = avgMonthlyExp * 12
  const forecastProfitAmt = forecastCashAmt - forecastExpAmt
  const profitRate      = forecastCashAmt > 0 ? (forecastProfitAmt/forecastCashAmt*100).toFixed(1) : 0

  // 월별 수금 실현율 계산
  const realizationMonths = cashByMonth.filter(m=>m.month<=MONTH&&m.total>0)
  const realizationRate   = realizationMonths.length>0
    ? realizationMonths.reduce((s,m)=>s+(m.paid/Math.max(m.total,1)),0)/realizationMonths.length*100 : 70

  // ── 본부별 수주 달성률 ────────────────────────────────────────
  const deptStats = DEPTS.map(dept=>{
    const db = deptBiz[dept]||{}
    const done  = (db.orderDone||0)
    const conf  = (db.orderConfirmed||0)
    const push  = (db.orderPush||0)
    const target= (db.orderTarget||0)
    const rate  = target>0 ? ((done+conf)/target*100).toFixed(0) : 0
    return {dept, done, conf, push, target, rate}
  }).filter(d=>d.target>0||d.done>0)

  // 시나리오 3가지
  const scenarios = [
    {label:"보수적 (현 기조 유지)", icon:"🔵", color:"#6366F1",
     cash: cashPaid/1e8 + cashConf/1e8 * 0.6 + avgMonthly/1e8 * REMAINING * 0.5,
     desc:"확정 수금 60% 실현, 월평균 수금의 50%만 추가 발생"},
    {label:"기준 (현재 예상)", icon:"🟢", color:"#059669",
     cash: cashPaid/1e8 + cashConf/1e8 + avgMonthly/1e8 * REMAINING * 0.7,
     desc:"확정 수금 전부 실현, 월평균 수금의 70% 추가 발생"},
    {label:"낙관적 (적극 수금)", icon:"🟡", color:"#D97706",
     cash: cashPaid/1e8 + cashConf/1e8 + cashUnconf/1e8*0.4 + avgMonthly/1e8 * REMAINING,
     desc:"미확정 40% 추가 실현, 월평균 수금 100% 달성"},
  ]

  const Card2 = ({title,children,color="#6366F1"}) => (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:14}}>
      <div style={{padding:"12px 16px",borderBottom:"2px solid "+color,display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:4,height:20,background:color,borderRadius:2}}/>
        <div style={{fontSize:14.5,fontWeight:800,color:"#111827"}}>{title}</div>
      </div>
      <div style={{padding:"14px 16px"}}>{children}</div>
    </div>
  )

  const StatRow = ({label,value,sub,color="#374151",badge}) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #F3F4F6"}}>
      <div style={{fontSize:13.5,color:"#6B7280"}}>{label}</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {badge&&<span style={{fontSize:10.5,padding:"1px 7px",borderRadius:8,background:badge.bg,color:badge.fg,fontWeight:700}}>{badge.text}</span>}
        <div style={{fontSize:14.5,fontWeight:700,color}}>{value}</div>
        {sub&&<div style={{fontSize:11.5,color:"#9CA3AF"}}>{sub}</div>}
      </div>
    </div>
  )

  // 수금 달성율 진행바
  const CashBar = ({label,pct,color,value}) => (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:12.5,color:"#6B7280"}}>{label}</span>
        <span style={{fontSize:12.5,fontWeight:700,color}}>{value}</span>
      </div>
      <div style={{height:8,background:"#F3F4F6",borderRadius:4,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:color,borderRadius:4,transition:"width .5s"}}/>
      </div>
    </div>
  )

  return (
    <div>
      {/* 헤더 */}
      <div style={{background:"linear-gradient(135deg,#312E81,#6366F1)",borderRadius:16,padding:"18px 20px",marginBottom:16,color:"#fff"}}>
        <div style={{fontSize:17,fontWeight:900,marginBottom:4}}>🔭 {YEAR}년 연말 손익 예상 분석 리포트</div>
        <div style={{fontSize:12.5,opacity:.8}}>
          기준: {YEAR}.{MONTH}월 현재 · 잔여 {REMAINING}개월 · 수금 실현율 {realizationRate.toFixed(0)}%
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:14}}>
          {[
            ["실제 수금(YTD)",fA(cashPaid),"#34D399"],
            ["연말 예상 수금",fB(forecastCashAmt),"#FDE68A"],
            ["수금 목표",`${targetCash}억`,"#C4B5FD"],
          ].map(([l,v,c])=>(
            <div key={l} style={{background:"rgba(255,255,255,.12)",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:11,opacity:.8,marginBottom:3}}>{l}</div>
              <div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 시나리오 3가지 */}
      <Card2 title="📊 연말 수금 시나리오" color="#6366F1">
        {scenarios.map((sc,i)=>(
          <div key={i} style={{padding:"12px 14px",marginBottom:8,borderRadius:10,background:i===1?"#EEF2FF":"#F9FAFB",border:`1.5px solid ${i===1?"#6366F1":"#E5E7EB"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontSize:13.5,fontWeight:700,color:sc.color}}>{sc.icon} {sc.label}</div>
              <div style={{fontSize:17,fontWeight:900,color:sc.color}}>{sc.cash.toFixed(2)}억</div>
            </div>
            <div style={{fontSize:11.5,color:"#9CA3AF"}}>{sc.desc}</div>
            {targetCash>0&&(
              <div style={{marginTop:6}}>
                <CashBar label="" pct={sc.cash/targetCash*100} color={sc.color} value={`목표 ${(sc.cash/targetCash*100).toFixed(0)}%`}/>
              </div>
            )}
          </div>
        ))}
      </Card2>

      {/* 수금 · 지출 현황 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <Card2 title="💧 수금 현황" color="#059669">
          <StatRow label="실제 수금 완료" value={fA(cashPaid)} color="#059669"/>
          <StatRow label="확정 예정" value={fA(cashConf)} color="#6366F1"/>
          <StatRow label="미확정" value={fA(cashUnconf)} color="#D97706"
            badge={{text:"가능성↑",bg:"#FEF3C7",fg:"#D97706"}}/>
          <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #E5E7EB"}}>
            <div style={{fontSize:12,color:"#6B7280",marginBottom:6}}>월평균 수금 실적</div>
            <div style={{fontSize:18,fontWeight:900,color:"#059669"}}>{(avgMonthly/1e8).toFixed(2)}억/월</div>
          </div>
        </Card2>
        <Card2 title="💸 지출 현황" color="#DC2626">
          <StatRow label="YTD 지출 합계" value={`${(expTotal/1e8).toFixed(2)}억`} color="#DC2626"/>
          <StatRow label="월평균 지출" value={`${avgMonthlyExp.toFixed(2)}억`} color="#D97706"/>
          <StatRow label="연말 추정 지출" value={`${forecastExpAmt.toFixed(2)}억`} color="#374151"/>
          <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #E5E7EB"}}>
            <div style={{fontSize:12,color:"#6B7280",marginBottom:6}}>예상 손익률</div>
            <div style={{fontSize:18,fontWeight:900,color:Number(profitRate)>=0?"#059669":"#DC2626"}}>
              {profitRate}%
            </div>
          </div>
        </Card2>
      </div>

      {/* 계약 수주 현황 */}
      <Card2 title="📝 계약 수주 현황" color="#185FA5">
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
          {[
            ["계약 완료",`${contractDone.toFixed(2)}억`,"#059669"],
            ["확정",`${contractConf.toFixed(2)}억`,"#6366F1"],
            ["추진",`${contractPush.toFixed(2)}억`,"#D97706"],
            ["합계",`${contractTotal.toFixed(2)}억`,"#185FA5"],
          ].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center",background:"#F8FAFC",borderRadius:9,padding:"10px 6px",border:"1px solid #E5E7EB"}}>
              <div style={{fontSize:11.5,color:"#9CA3AF",marginBottom:4}}>{l}</div>
              <div style={{fontSize:14,fontWeight:800,color:c}}>{v}</div>
            </div>
          ))}
        </div>
        {targetOrder>0&&(
          <CashBar label={`수주 목표 달성률 (목표: ${targetOrder}억)`} pct={contractTotal/targetOrder*100} color="#185FA5" value={`${(contractTotal/targetOrder*100).toFixed(0)}%`}/>
        )}
      </Card2>

      {/* 본부별 달성 현황 */}
      {deptStats.length>0&&(
        <Card2 title="🏢 본부별 수주 달성률" color="#7C3AED">
          {deptStats.map(d=>(
            <div key={d.dept} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:DEPT_COLORS[d.dept]||"#6366F1"}}/>
                  <span style={{fontSize:13.5,fontWeight:600,color:"#374151"}}>{d.dept}</span>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:12,color:"#9CA3AF"}}>{d.done+d.conf}억/{d.target}억</span>
                  <span style={{fontSize:13,fontWeight:800,color:Number(d.rate)>=100?"#059669":Number(d.rate)>=70?"#185FA5":"#D97706"}}>{d.rate}%</span>
                </div>
              </div>
              <div style={{height:7,background:"#F3F4F6",borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${Math.min(Number(d.rate),100)}%`,
                  background:Number(d.rate)>=100?"#059669":Number(d.rate)>=70?"#185FA5":"#D97706",
                  borderRadius:4,transition:"width .5s"}}/>
              </div>
            </div>
          ))}
        </Card2>
      )}

      {/* 종합 의견 */}
      <Card2 title="📋 종합 분석 의견" color="#374151">
        <div style={{fontSize:13.5,lineHeight:1.8,color:"#374151"}}>
          <div style={{marginBottom:8}}>
            <strong>수금:</strong> {MONTH}월 기준 실제 수금 <strong style={{color:"#059669"}}>{(cashPaid/1e8).toFixed(2)}억원</strong>으로,
            월평균 <strong>{(avgMonthly/1e8).toFixed(2)}억원</strong> 속도입니다.
            {targetCash>0 && ` 연간 목표 ${targetCash}억 대비 현재 달성률은 ${(cashPaid/1e8/targetCash*100).toFixed(0)}%입니다.`}
          </div>
          <div style={{marginBottom:8}}>
            <strong>수주:</strong> 계약 완료 <strong style={{color:"#059669"}}>{contractDone.toFixed(2)}억</strong> + 확정 <strong style={{color:"#6366F1"}}>{contractConf.toFixed(2)}억</strong>으로
            {targetOrder>0&&` 목표 ${targetOrder}억 대비 ${(contractTotal/targetOrder*100).toFixed(0)}% 달성 중입니다.`}
            {contractPush>0&&` 추진 중 ${contractPush.toFixed(2)}억이 추가 전환 가능합니다.`}
          </div>
          <div style={{marginBottom:8}}>
            <strong>손익:</strong> 현재 기조 유지 시 연말 예상 수금 <strong style={{color:"#6366F1"}}>{forecastCashAmt.toFixed(2)}억</strong>,
            지출 <strong style={{color:"#DC2626"}}>{forecastExpAmt.toFixed(2)}억</strong>으로
            예상 손익률 <strong style={{color:Number(profitRate)>=0?"#059669":"#DC2626"}}>{profitRate}%</strong>입니다.
          </div>
          <div style={{background:"#FEF3C7",borderRadius:8,padding:"10px 12px",marginTop:10,fontSize:12.5,color:"#92400E"}}>
            ⚠ 본 리포트는 입력된 월수금계획·계약현황·지출현황 데이터 기반 예측입니다.
            실제 수금 실현율, 신규 수주 등에 따라 달라질 수 있습니다.
          </div>
        </div>
      </Card2>
    </div>
  )
}
