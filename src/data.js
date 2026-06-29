// ══════════════════════════════════════════════════════════════
// 상지서울건축사사무소 통합경영시스템 — 데이터 레이어
// ══════════════════════════════════════════════════════════════

export const PY = 0.3025
export const toPy = n => n ? +(n * PY).toFixed(1) : 0
export const fE  = n => n != null ? `${(+n).toFixed(2)}억` : "-"
export const fW  = n => n != null ? `${Math.round(+n).toLocaleString("ko-KR")}원` : "-"
export const fP  = n => n != null ? `${(+n * 100).toFixed(1)}%` : "-"
export const fPy = n => n != null ? `${Math.round(+n).toLocaleString()}원/평` : "-"
export const fPct= n => n != null ? `${(+n).toFixed(1)}%` : "-"

export const COLORS = ["#185FA5","#1D9E75","#BA7517","#A32D2D","#534AB7","#0F6E56","#D85A30","#888780"]
export const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"]
export const DEPTS  = ["설계1본부","설계2본부","주거디자인본부","디자인본부"]
export const DEPT_COLORS = { "설계1본부":"#185FA5","설계2본부":"#1D9E75","주거디자인본부":"#BA7517","디자인본부":"#A32D2D" }

// 면적 기준 분류
export const AREA_BASIS_MAP = {
  "토목":"대지","조경":"대지","흙막이":"대지","지반조사":"대지","현황측량":"대지","부대토목":"대지",
  "친환경":"1식","교통영향평가":"1식","교통":"1식","BIM":"1식","인테리어":"1식","외부특화":"1식","경관":"1식","설계안전":"1식","풍동":"1식",
}
export const getAreaBasis = cat => {
  for (const [k,v] of Object.entries(AREA_BASIS_MAP)) if (cat.includes(k)) return v
  return "연면적"
}
export const calcUP = (contract, cat, proj) => {
  const basis = getAreaBasis(cat)
  if (basis === "1식") return null
  const py = basis === "대지" ? toPy(proj.siteArea||0) : toPy(proj.floorArea||0)
  return py > 0 ? contract / py : null
}
export const calcPnlTotals = ver => {
  const direct = (ver.laborCost||0)+(ver.directExp||0)+(ver.subContract||0)
  const indirect = ver.indirect ?? Math.round((ver.laborCost||0)*1.1)
  const profit   = ver.profit   ?? Math.round(direct*0.083)
  return { direct, indirect, profit, total: direct+indirect+profit }
}

// 비밀번호 해시
export const hashPw = async pw => {
  try{
    if (crypto?.subtle?.digest) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw))
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("")
    }
  }catch{ /* crypto.subtle 사용 불가 환경 → 아래 대체 해시 사용 */ }
  // 일부 브라우저(특정 인앱 웹뷰 등)는 crypto.subtle을 지원하지 않을 수 있음.
  // 그런 경우에도 로그인 화면이 멈추지 않도록 비암호학적 대체 해시를 사용한다.
  let h1=0x811c9dc5, h2=0x1000193
  for(let i=0;i<pw.length;i++){
    const c = pw.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 ^ c, 0x01000193) >>> 0
  }
  return "fb-"+h1.toString(16).padStart(8,"0")+h2.toString(16).padStart(8,"0")
}

// ── 사용자 ────────────────────────────────────────────────────
export const MASTER_PW    = "0260111604"
export const ALL_USERS = [
  {id:"U000",name:"마스터관리자",loginId:"sogum25@gmail.com",role:"admin",dept:"경영진",avatar:"관리",active:true,read:true,write:true,canManageUsers:true,_pwHash:""},
  {id:"U001",name:"강순일",loginId:"ksi@sangjiseoul.com",role:"admin",dept:"경영진",avatar:"강순",active:true,read:true,write:true,canManageUsers:true,_pwHash:""},
  {id:"U002",name:"박희태",loginId:"bht@sangjiseoul.com",role:"executive",dept:"설계1본부",avatar:"박희",active:true,read:true,write:true,canManageUsers:false,_pwHash:""},
  {id:"U003",name:"김동헌",loginId:"kdh@sangjiseoul.com",role:"executive",dept:"설계2본부",avatar:"김동",active:true,read:true,write:true,canManageUsers:false,_pwHash:""},
  {id:"U004",name:"천용화",loginId:"cyw@sangjiseoul.com",role:"executive",dept:"디자인본부",avatar:"천용",active:true,read:true,write:false,canManageUsers:false,_pwHash:""},
  {id:"U005",name:"정진성",loginId:"jjs@sangjiseoul.com",role:"executive",dept:"주거디자인본부",avatar:"정진",active:true,read:true,write:true,canManageUsers:false,_pwHash:""},
  {id:"U006",name:"김한준",loginId:"khj@sangjiseoul.com",role:"executive",dept:"해외사업부",avatar:"김한",active:true,read:true,write:false,canManageUsers:false,_pwHash:""},
  {id:"U007",name:"임슬기",loginId:"lsk@sangjiseoul.com",role:"viewer",dept:"운영지원",avatar:"임슬",active:true,read:true,write:false,canManageUsers:false,_pwHash:""},
]
export const ROLE_BADGE = {
  admin:     {bg:"#FCEBEB",fg:"#A32D2D",label:"관리자"},
  executive: {bg:"#E6F1FB",fg:"#0C447C",label:"임원"},
  viewer:    {bg:"#F1EFE8",fg:"#888780",label:"열람자"},
}

// ── 경영 수치 ─────────────────────────────────────────────────
export const BIZ_2026 = {
  orderTarget:170, orderDone:7.63, orderConfirmed:89.10, orderPush:287.79,
  revenueTarget:145, revenueCum:29.61, revenueConfirmed:136.34, revenueCarry:167.09,
  costCum:57.37, pnlCum:-27.76,
  staffTotal:61.75,
  alertLevel:"비상경영",
}

// ── 본부 목록 (관리 화면에서 추가/수정/삭제) ───────────────────
// finance:true 인 본부만 월별손익/월수금 부서별 입력 대상이 됩니다.
export const DEPARTMENTS_INIT = [
  {name:"설계1본부",   color:"#185FA5", finance:true},
  {name:"설계2본부",   color:"#1D9E75", finance:true},
  {name:"주거디자인본부",color:"#BA7517", finance:true},
  {name:"디자인본부",  color:"#A32D2D", finance:true},
  {name:"경영지원",    color:"#534AB7", finance:false},
  {name:"해외사업부",  color:"#0F6E56", finance:false},
]
export const DEPT_COLOR_POOL = ["#185FA5","#1D9E75","#BA7517","#A32D2D","#534AB7","#0F6E56","#D85A30","#7C5295","#2E86AB","#C0392B"]
export const DEPT_BIZ_EMPTY = {orderTarget:0,orderDone:0,orderConfirmed:0,revTarget:0,revCum:0,cost5m:0,pnl5m:0}
export const DEPT_STAFF_EMPTY = {total:0,pm:0,designer:0,admin:0}

// ── 협력업체 ────────────────────────────────────────────────
export const VENDOR_EMPTY = {ceoName:"",ceoPhone:"",ceoEmail:"",contactName:"",contactPhone:"",contactEmail:"",note:""}
export const BID_TYPES = ["민간수의","제안공모","경쟁설계","기타"]
export const CONTRACT_TYPES_DEFAULT = ["턴키","BTL","공공","민간","감리","해외","기타"]
export const PROJ_TYPES_DEFAULT = ["공동주택","주상복합","업무시설","공공청사","의료시설","교육시설","물류창고","제약공장","기타"]
export const BID_TYPES_DEFAULT  = ["민간수의","제안공모","경쟁설계","기타"]


export const DEPT_STAFF_INIT = {
  "설계1본부":   {total:10.5, pm:4, designer:5, admin:1.5},
  "설계2본부":   {total:17.83, pm:5, designer:11, admin:1.83},
  "주거디자인본부":{total:7.58, pm:3, designer:4, admin:0.58},
  "디자인본부":  {total:14.17, pm:4, designer:9, admin:1.17},
  "경영지원":    {total:9, pm:0, designer:0, admin:9},
  "해외사업부":  {total:2.67, pm:2, designer:0.67, admin:0},
}

// 연간 인원계획(목표인원/월별 현인원)은 YEARS_DB_INIT 정의 이후로 이동

// ── 본부별 실적 ───────────────────────────────────────────────
export const DEPT_BIZ = {
  "설계1본부":   {orderTarget:20,orderDone:1.47,orderConfirmed:19.15,revTarget:43,revCum:11.38,cost5m:21.08,pnl5m:-6.57},
  "설계2본부":   {orderTarget:40,orderDone:0.24,orderConfirmed:2.27, revTarget:102,revCum:14.99,cost5m:20.86,pnl5m:-5.87},
  "주거디자인본부":{orderTarget:50,orderDone:5.92,orderConfirmed:39.64,revTarget:0, revCum:0.11, cost5m:6.14, pnl5m:-6.03},
  "디자인본부":  {orderTarget:60,orderDone:0,  orderConfirmed:28.04,revTarget:0, revCum:0,   cost5m:9.29, pnl5m:-9.29},
}

// ── 월별 기성수금 (VAT포함, 억원) ────────────────────────────
export const CF_2026 = [
  {m:"1월", cash:2.21,note:0,blue:0,actual:true,
   byDept:{"설계1본부":0.40,"설계2본부":1.79,"주거디자인본부":0.01,"디자인본부":0},
   memo:"의정부동·평택고덕 등"},
  {m:"2월", cash:2.24,note:0,blue:0,actual:true,
   byDept:{"설계1본부":1.45,"설계2본부":0.69,"주거디자인본부":0.11,"디자인본부":0},
   memo:"에코델타15BL·보훈병원"},
  {m:"3월", cash:6.59,note:0,blue:0,actual:true,
   byDept:{"설계1본부":4.44,"설계2본부":2.15,"주거디자인본부":0,"디자인본부":0},
   memo:"서산시청사 2차선금·국립포항"},
  {m:"4월", cash:10.11,note:1.73,blue:0,actual:true,
   byDept:{"설계1본부":6.37,"설계2본부":3.74,"주거디자인본부":0,"디자인본부":0},
   memo:"우즈벡 입찰지원·서부의료원"},
  {m:"5월", cash:8.47,note:0,blue:0,actual:true,
   byDept:{"설계1본부":1.86,"설계2본부":6.60,"주거디자인본부":0,"디자인본부":0},
   memo:"에코앤로지스·라오스 감리"},
  {m:"6월", cash:21.65,note:0,blue:0,actual:false,
   byDept:{"설계1본부":15.79,"설계2본부":4.39,"주거디자인본부":1.40,"디자인본부":0.08},
   memo:"서부산행정복합 기대"},
  {m:"7월", cash:36.32,note:0,blue:14.32,actual:false,
   byDept:{"설계1본부":0.41,"설계2본부":30.31,"주거디자인본부":5.60,"디자인본부":0},
   memo:"민간위험 14.32억 포함"},
  {m:"8월", cash:15.07,note:0,blue:0,actual:false,
   byDept:{"설계1본부":0.63,"설계2본부":14.44,"주거디자인본부":0,"디자인본부":0},
   memo:"화성배양 사업승인"},
  {m:"9월", cash:10.90,note:0,blue:6.99,actual:false,
   byDept:{"설계1본부":5.79,"설계2본부":5.11,"주거디자인본부":0,"디자인본부":0},
   memo:"민간위험 6.99억 포함"},
  {m:"10월",cash:7.54,note:0,blue:0,actual:false,
   byDept:{"설계1본부":1.02,"설계2본부":6.53,"주거디자인본부":0,"디자인본부":0},
   memo:""},
  {m:"11월",cash:10.25,note:0,blue:0,actual:false,
   byDept:{"설계1본부":1.62,"설계2본부":8.64,"주거디자인본부":0,"디자인본부":0},
   memo:""},
  {m:"12월",cash:27.27,note:0.86,blue:0,actual:false,
   byDept:{"설계1본부":12.16,"설계2본부":14.95,"주거디자인본부":0,"디자인본부":0},
   memo:"남양주왕숙2·청량리 이월"},
]

// ── 손익 초기값 ───────────────────────────────────────────────
export const PNL_INIT = MONTHS.map((m,i) => ({
  m,
  // 전체
  rev:    [5.10,5.10,6.59,6.53,6.29,0,0,0,0,0,0,0][i],
  sal:    3.48, ot:0.12, etc_lbr:0.68,
  sub_dir:[2.40,2.40,5.80,8.10,8.01,0,0,0,0,0,0,0][i],
  sub_stl:[0,0,0,0,0.99,0,0,0,0,0,0,0][i],
  exp:0.36, biz:0.14, fix:0.16, misc:0.30, shared:1.28,
  // 본부별
  byDept:{
    "설계1본부":  {rev:[2.90,2.90,1.44,1.27,1.50,0,0,0,0,0,0,0][i], sal:0.65,sub:[0.03,0.03,0.43,1.62,1.60,0,0,0,0,0,0,0][i]},
    "설계2본부":  {rev:[0.36,0.14,0.43,0.75,1.32,0,0,0,0,0,0,0][i], sal:1.04,sub:[0.01,0.01,0.41,0.41,1.21,0,0,0,0,0,0,0][i]},
    "주거디자인본부":{rev:[0.00,0.02,0,0,0,0,0,0,0,0,0,0][i], sal:0.78,sub:[0,0,0,0,0,0,0,0,0,0,0,0][i]},
    "디자인본부":  {rev:[0,0,0,0,0,0,0,0,0,0,0,0][i],         sal:0.82,sub:[0.03,0.03,0.03,0.03,0.03,0,0,0,0,0,0,0][i]},
  }
}))

// ── 3개년 ─────────────────────────────────────────────────────
export const YEARS_DB_INIT = [
  {yr:"2023",목표수주:223.11,실행수주:154.79,목표매출:163.08,실행매출:139.65,인원:97.92},
  {yr:"2024",목표수주:201,  실행수주:79.19, 목표매출:165.87,실행매출:92.01, 인원:86},
  {yr:"2025",목표수주:170,  실행수주:95,    목표매출:150,   실행매출:120,   인원:70},
  {yr:"2026",목표수주:170,  실행수주:96.72, 목표매출:145,   실행매출:29.61, 인원:61.75},
]

// 연간 인원계획 — 본부별 "연도별" 목표인원 / 월별 현인원(입력 전 0)
export const STAFF_TARGET_INIT = Object.fromEntries(
  Object.entries(DEPT_STAFF_INIT).map(([d,s])=>[d,
    Object.fromEntries(YEARS_DB_INIT.map(y=>[y.yr, Math.round(s.total)]))
  ])
)
export const STAFF_MONTHLY_INIT = Object.fromEntries(
  Object.keys(DEPT_STAFF_INIT).map(d=>[d,
    Object.fromEntries(YEARS_DB_INIT.map(y=>[y.yr, Array(12).fill(0)]))
  ])
)

// ── 프로젝트 ─────────────────────────────────────────────────
// ── 프로젝트: 본부별 지분율 / 정규화 ────────────────────────────
// deptShares: [{dept, share}] (share % 합계 100). 미지정 시 depts를 균등분배로 추정.
export const getDeptShares = p => {
  if(p?.deptShares?.length) return p.deptShares
  const ds = (p?.depts||[]).filter(Boolean)
  if(!ds.length) return []
  const base = +(100/ds.length).toFixed(2)
  return ds.map((d,i)=>({dept:d, share: i===ds.length-1 ? +(100-base*(ds.length-1)).toFixed(2) : base}))
}
// 누락 필드 보강 (orderType/cashflowPlan/deptShares)
export const normalizeProject = p => ({
  orderType:"민간", bidType:"민간수의", cashflowPlan:[], cashflowOpening:{}, contractType:"민간",
  type:"추진",  // 기본값 - contractYear 설정 시 업로드된 type으로 덮어씀
  ...p,
  deptShares: getDeptShares(p),
})

export const PROJECTS_INIT = [
  {
    id:"P001",year:"2026",code:"E26004-VSH-W",
    name:"평택고덕 패키지형 공모 실시설계 (A68BL·Aab13BL)",
    depts:["설계2본부"],pm:"김동헌",director:"김동헌 상무",
    projType:"공동주택",usage:"공동주택(분양)",scale:"지하2층/지상20~25층",
    siteArea:89837,buildArea:null,floorArea:226541,units:1588,
    client:"계룡건설 컨소시엄",clientPm:"표세원 차장",
    totalFee:4005000000,shareRatio:0.20,serviceFee:801000000,
    address:"경기도 평택시 고덕지구 A-68BL, Aab-13BL",
    contractDate:"2026-01-20",orderDate:"2026-02-12",
    note:"DA 주관(60%), 상지 20%, KD 20%",
    type:"계약",prog:25,acc:0.25*0.801,rev26:4.08,
    versions:[{
      ver:"v1.0 최초",date:"2026-01-20",reason:"최초 작성",
      laborCost:139201248,directExp:38738000,subContract:390211654,
      indirect:153121373,profit:79727729,
      vendors:[
        {cat:"구조",name:"씨에이치구조㈜",contract:34736956,nego1:0,nego2:0},
        {cat:"토목",name:"대신종합이엔지㈜",contract:33552742,nego1:0,nego2:0},
        {cat:"조경",name:"에이치에이㈜",contract:37500123,nego1:0,nego2:0},
        {cat:"기계",name:"삼신설계㈜",contract:24868503,nego1:0,nego2:0},
        {cat:"전기통신소방",name:"나라기술단㈜",contract:31973789,nego1:0,nego2:0},
        {cat:"기계소방",name:"대평엔지니어링㈜",contract:25065872,nego1:0,nego2:0},
        {cat:"CG",name:"위즈앤㈜",contract:15454545,nego1:0,nego2:0},
        {cat:"견적",name:"성진적산㈜",contract:1000000,nego1:0,nego2:0},
        {cat:"건축외주",name:"청우종합건축사㈜",contract:54059125,nego1:0,nego2:0},
        {cat:"친환경",name:"건원엔지니어링",contract:43090909,nego1:0,nego2:0},
        {cat:"교통영향평가",name:"한길알앤디㈜",contract:31090909,nego1:0,nego2:0},
        {cat:"경관/토탈",name:"건원엔지니어링",contract:38363636,nego1:0,nego2:0},
        {cat:"지반조사",name:"대신종합이엔지㈜",contract:8909091,nego1:0,nego2:0},
        {cat:"현황측량",name:"대신종합이엔지㈜",contract:5454545,nego1:0,nego2:0},
      ]
    }]
  },
  {
    id:"P002",year:"2026",code:"E26-ECO3BL",
    name:"부산 에코델타시티 3BL 민간참여 공공분양주택",
    depts:["주거디자인본부","디자인본부"],pm:"정진성",director:"정진성 이사대우",
    projType:"공동주택",usage:"공동주택(공공분양)",scale:"지하2층/지상35층",
    siteArea:32175,buildArea:null,floorArea:70000,units:700,
    client:"부산도시공사",clientPm:"",
    totalFee:2500000000,shareRatio:0.70,serviceFee:1750000000,
    address:"부산시 강서구 에코델타시티 3BL",
    contractDate:"2026-07",orderDate:"",
    note:"당선 / 동원+HJ+경동+홍우+이피엘",
    type:"확정",prog:0,acc:0,rev26:3.50,
    versions:[{
      ver:"v1.0 실행검토(2차NEGO)",date:"2026-01-01",reason:"협력업체 견적 비교",
      laborCost:0,directExp:0,subContract:1248500000,indirect:0,profit:0,
      vendors:[
        {cat:"구조",name:"보성이앤지그룹㈜",contract:84000000,nego1:74000000,nego2:68000000},
        {cat:"기계",name:"디이테크설비컨설턴트㈜",contract:84000000,nego1:65000000,nego2:60000000},
        {cat:"전기통신",name:"석우엔지니어링㈜",contract:206000000,nego1:80000000,nego2:75000000},
        {cat:"소방",name:"세종기술단㈜",contract:105000000,nego1:73000000,nego2:70000000},
        {cat:"부대토목",name:"다산이엔지",contract:80000000,nego1:70000000,nego2:60000000},
        {cat:"흙막이·지반",name:"세움텍",contract:203200000,nego1:130000000,nego2:120000000},
        {cat:"조경",name:"조경사무소 루다",contract:90000000,nego1:80000000,nego2:75000000},
        {cat:"견적",name:"코토적산",contract:57000000,nego1:57000000,nego2:57000000},
        {cat:"CG",name:"51H",contract:40500000,nego1:35000000,nego2:35000000},
        {cat:"건축외주",name:"희우건축",contract:90000000,nego1:85000000,nego2:83000000},
        {cat:"친환경",name:"디이테크설비컨설턴트㈜",contract:136995000,nego1:90000000,nego2:90000000},
        {cat:"인테리어",name:"스튜디오 덴㈜",contract:128000000,nego1:90000000,nego2:85000000},
        {cat:"외부특화",name:"스키닉 경관연구소",contract:84000000,nego1:70000000,nego2:60000000},
        {cat:"BIM",name:"트윈빔㈜",contract:100000000,nego1:100000000,nego2:100000000},
        {cat:"교통영향평가",name:"시케인엔지니어링㈜",contract:70000000,nego1:60000000,nego2:60000000},
      ]
    }]
  },
  {
    id:"P003",year:"2022",code:"E22021-FSM-D",
    name:"우즈베키스탄 제약클러스터 건립사업 1차",
    depts:["해외사업부"],pm:"김한준",director:"김한준 전무",
    projType:"제약공장·연구소",usage:"제약시설",scale:"지하1층/지상5층",
    siteArea:85000,buildArea:8500,floorArea:42000,units:0,
    client:"우즈베키스탄 제약청",clientPm:"",
    totalFee:3275892545,shareRatio:1.0,serviceFee:3275892545,
    address:"우즈베키스탄 타슈켄트",
    contractDate:"2023-12-18",orderDate:"2024-01-09",
    note:"감리 진행중 / 5차변경 완료",
    type:"기성",prog:60,acc:19.66,rev26:7.97,
    versions:[{
      ver:"v6.0 5차변경",date:"2025-11-18",reason:"감리인건비 재산정·Marva신규",
      laborCost:139253515,directExp:717039290,subContract:1994348995,
      indirect:153178867,profit:272071878,
      vendors:[
        {cat:"구조",name:"센구조연구소",contract:19008000,nego1:0,nego2:0},
        {cat:"기계",name:"우원엠앤이",contract:10890000,nego1:0,nego2:0},
        {cat:"전기통신",name:"나라기술단",contract:17820000,nego1:0,nego2:0},
        {cat:"현지조사",name:"케이메디컬컨설팅㈜",contract:558481038,nego1:0,nego2:0},
        {cat:"해외코디",name:"Hplus건축사사무소",contract:580800000,nego1:0,nego2:0},
        {cat:"해외협력",name:"H-ARHITECT",contract:132000000,nego1:0,nego2:0},
        {cat:"설계PM",name:"무영CM",contract:206800000,nego1:0,nego2:0},
        {cat:"기술감리",name:"General Project Expert",contract:182927245,nego1:0,nego2:0},
        {cat:"저작권감리",name:"Marva",contract:89180218,nego1:0,nego2:0},
        {cat:"PE회계",name:"원진회계법인",contract:67180960,nego1:0,nego2:0},
      ]
    }]
  },
  {
    id:"P004",year:"2024",code:"E26-SBM",
    name:"경상남도 서부의료원 설립 기본 및 실시설계",
    depts:["설계1본부"],pm:"박희태",director:"박희태 이사",
    projType:"의료시설",usage:"종합병원",scale:"지하1층/지상7층",
    siteArea:35000,buildArea:9000,floorArea:52000,units:0,
    client:"경상남도",clientPm:"",
    totalFee:735000000,shareRatio:0.20,serviceFee:147000000,
    address:"경상남도",
    contractDate:"2024-11-11",orderDate:"2025-02-01",
    note:"실시설계 진행중",
    type:"계약",prog:45,acc:0.661,rev26:4.08,
    versions:[{
      ver:"v1.0 최초",date:"2024-11-11",reason:"최초 작성",
      laborCost:29400000,directExp:8000000,subContract:80000000,
      indirect:32340000,profit:16773200,
      vendors:[
        {cat:"구조",name:"센구조연구소",contract:9000000,nego1:0,nego2:0},
        {cat:"기계",name:"우원엠앤이",contract:11000000,nego1:0,nego2:0},
        {cat:"전기통신소방",name:"나라기술단",contract:13000000,nego1:0,nego2:0},
        {cat:"토목",name:"대신종합이엔지",contract:8000000,nego1:0,nego2:0},
        {cat:"조경",name:"에이치에이",contract:7000000,nego1:0,nego2:0},
        {cat:"견적",name:"성진적산",contract:2000000,nego1:0,nego2:0},
        {cat:"친환경",name:"건원엔지니어링",contract:20000000,nego1:0,nego2:0},
      ]
    }]
  },
  {
    id:"P005",year:"2026",code:"E26-SJY",
    name:"사직야구장 임시구장 조성사업 (제안공모)",
    depts:["디자인본부"],pm:"천용화",director:"천용화 상무",
    projType:"공공청사",usage:"체육시설",scale:"지하1층/지상3층",
    siteArea:18000,buildArea:6000,floorArea:24000,units:0,
    client:"부산시",clientPm:"",
    totalFee:12110000000,shareRatio:0.70,serviceFee:8477000000,
    address:"부산시 동래구 사직동",
    contractDate:"2026-06",orderDate:"",
    note:"당선 5.29 / GEM 30%",
    type:"확정",prog:0,acc:0,rev26:2.54,
    versions:[{
      ver:"v1.0 최초",date:"2026-05-29",reason:"당선 후 최초",
      laborCost:0,directExp:0,subContract:0,indirect:0,profit:0,
      vendors:[]
    }]
  },
]

// ── 알람 초기값 ───────────────────────────────────────────────
export const ALERTS_INIT = [
  {id:"A1",level:"critical",icon:"ti-alert-triangle",title:"손익 위험",msg:"5월 누계 손익 -27.76억. 지출이 매출의 194%.",time:"5분 전",tab:"analysis",read:false},
  {id:"A2",level:"warning", icon:"ti-flag",           title:"민간위험 프로젝트",msg:"7월 14.32억, 9월 6.99억 기성 달성 불확실.",time:"1시간 전",tab:"cashflow",read:false},
  {id:"A3",level:"warning", icon:"ti-trending-down",  title:"수주달성률 저조",msg:"설계2본부 수주 달성률 6.3%. 목표 40억 대비 2.51억.",time:"2시간 전",tab:"analysis",read:false},
  {id:"A4",level:"info",    icon:"ti-check",          title:"사직야구장 확정",msg:"사직야구장 임시구장 조성사업 당선 확정. 8.48억.",time:"3시간 전",tab:"projects",read:false},
  {id:"A5",level:"info",    icon:"ti-cash",           title:"7월 기성 집중",msg:"7월 36.32억 기성 예정. 연간 최대 수금 월.",time:"1일 전",tab:"cashflow",read:true},
]
