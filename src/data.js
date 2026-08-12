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
  versions:[],  // 실행계획서 버전 기본값
  shareRatio:0, // 기본값 - 없으면 NaN% 로 보이는 문제 방지
  certDocs:[],  // 보증서·증권·실적증명서·건축물대장·계약서·합사서류 등 첨부서류 — {key,versions:[...]} 구조 (아래 CERT_DOC_TYPES 참고)
  vendorDocs:[], // 협력업체별 계약서 — {vendorName,versions:[...]} 구조
  billingSubmissions:[], // 기성청구서 발송내역 — 선금/1차기성/2차기성... 누적 로그
  ...p,
  // 이름 앞에 "[E26010-VSG]" 같은 코드가 그대로 붙어 들어온 경우 항상 분리해서 표시용 이름을 깨끗하게 만듦.
  // code가 이미 있어도(다른 값이라도) 이름에 남아있는 대괄호 접두어는 제거 — 업로드 파일의 "코드" 열이
  // 이름 속 코드와 다르거나 비어있을 때 코드가 이름에 그대로 남아버리던 문제의 근본 수정.
  ...((() => {
    const m = (p.name||"").match(/^\[([^\]]+)\]\s*(.*)$/)
    if(!m) return {}
    return { code: p.code || m[1], name: m[2] }
  })()),
  deptShares: getDeptShares(p),
})

// ── 프로젝트 첨부서류(보증/증권/실적/대장) 유형 정의 ──────────────
// AI 자동인식(문서 업로드) 프롬프트와 화면 라벨/필드 구성에 공용으로 사용
export const CERT_DOC_TYPES = [
  {
    key:"contract", label:"계약서", icon:"📄",
    fields:[
      {k:"docNo",   label:"계약번호"},
      {k:"amount",  label:"계약금액", type:"money"},
      {k:"startDate", label:"계약일"},
      {k:"orderDate", label:"수주일"},
      {k:"endDate",   label:"계약기간 종료일"},
      {k:"contractName", label:"계약명"},
      {k:"issuer",  label:"발주처"},
    ],
    prompt:`이 문서는 설계용역 등 "계약서"입니다. 아래 JSON 형식으로만 응답하세요(설명 없이 JSON만):
{"docNo":"계약번호(없으면 빈문자열)","amount":계약금액(숫자, 원 단위, VAT 포함 총액 기준),"startDate":"계약일 YYYY-MM-DD","orderDate":"수주일(낙찰일/선정일 등, 계약일과 다른 경우만. 없으면 빈문자열) YYYY-MM-DD","endDate":"계약기간 종료일 YYYY-MM-DD(없으면 빈문자열)","contractName":"계약명(용역명)","issuer":"발주처명"}
찾을 수 없는 값은 빈 문자열 또는 0으로 두세요. 최초 계약서인지 변경계약서인지는 신경쓰지 마세요 — 업로드할 때마다 새 버전으로 기록됩니다.`,
  },
  {
    key:"perfBond", label:"계약이행보증서", icon:"📜",
    fields:[
      {k:"docNo",   label:"증권번호"},
      {k:"amount",  label:"보증금액", type:"money"},
      {k:"startDate", label:"보증 시작일", type:"date"},
      {k:"endDate",   label:"보증 종료일", type:"date"},
      {k:"contractName", label:"계약명"},
      {k:"issuer",  label:"발행기관"},
    ],
    prompt:`이 문서는 "계약이행보증서"입니다. 아래 JSON 형식으로만 응답하세요(설명 없이 JSON만):
{"docNo":"증권번호","amount":보증금액(숫자,원 단위),"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","contractName":"계약명","issuer":"발행기관(예: 엔지니어링공제조합)"}
날짜가 "2025 04 01" 같은 형식이면 "2025-04-01"로 변환하세요. 찾을 수 없는 값은 빈 문자열 또는 0으로 두세요.`,
  },
  {
    key:"liabilityCert", label:"손해배상공제증권", icon:"🛡️",
    fields:[
      {k:"docNo",   label:"증권번호"},
      {k:"certType", label:"공제종류"},
      {k:"amount",  label:"공제가입금액", type:"money"},
      {k:"startDate", label:"공제 시작일", type:"date"},
      {k:"endDate",   label:"공제 종료일", type:"date"},
      {k:"contractName", label:"계약명"},
      {k:"issuer",  label:"발행기관"},
    ],
    prompt:`이 문서는 "손해배상공제증권"입니다. 아래 JSON 형식으로만 응답하세요(설명 없이 JSON만):
{"docNo":"증권번호","certType":"공제종류(예: 실시설계)","amount":공제가입금액(숫자,원 단위),"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","contractName":"계약명","issuer":"발행기관(예: 엔지니어링공제조합)"}
날짜가 "2026년 05월 20일" 같은 형식이면 "2026-05-20"로 변환하세요. 찾을 수 없는 값은 빈 문자열 또는 0으로 두세요.`,
  },
  {
    key:"experienceCert", label:"실적증명서", icon:"📋",
    fields:[
      {k:"docNo",   label:"용역명/계약번호"},
      {k:"amount",  label:"계약금액", type:"money"},
      {k:"startDate", label:"계약기간 시작"},
      {k:"endDate",   label:"계약기간 종료"},
      {k:"contractName", label:"용역명"},
      {k:"issuer",  label:"발급기관"},
    ],
    prompt:`이 문서는 "용역이행 실적증명서"입니다. 아래 JSON 형식으로만 응답하세요(설명 없이 JSON만):
{"docNo":"계약번호(없으면 빈문자열)","amount":계약금액(숫자,원 단위),"startDate":"계약기간 시작일 YYYY-MM-DD","endDate":"계약기간 종료일 YYYY-MM-DD","contractName":"용역명","issuer":"증명서 발급기관명"}
찾을 수 없는 값은 빈 문자열 또는 0으로 두세요. 이 서류는 만료일 개념이 없으니 endDate는 계약 종료일(이행기간 종료일)을 넣으세요.`,
  },
  {
    key:"buildingReg", label:"건축물대장", icon:"🏢",
    fields:[
      {k:"docNo",   label:"고유번호"},
      {k:"amount",  label:"연면적(㎡)", type:"number"},
      {k:"startDate", label:"착공일"},
      {k:"endDate",   label:"사용승인일"},
      {k:"contractName", label:"건물명"},
      {k:"issuer",  label:"대지위치"},
    ],
    prompt:`이 문서는 "건축물대장"입니다. 아래 JSON 형식으로만 응답하세요(설명 없이 JSON만):
{"docNo":"고유번호","amount":연면적(숫자, ㎡ 단위, 소수점 가능),"startDate":"착공일 YYYY-MM-DD(없으면 빈문자열)","endDate":"사용승인일 YYYY-MM-DD(없으면 빈문자열)","contractName":"건물 명칭","issuer":"대지위치"}
찾을 수 없는 값은 빈 문자열 또는 0으로 두세요. 이 서류는 만료일 개념이 없습니다.`,
  },
  {
    key:"jvMou", label:"업무협약서(합동사무소)", icon:"🤝",
    fields:[
      {k:"docNo",   label:"협약번호"},
      {k:"amount",  label:"지분율/분담비율(%)", type:"number"},
      {k:"startDate", label:"협약일"},
      {k:"endDate",   label:"협약기간 종료일"},
      {k:"contractName", label:"참여사(합동사무소 구성사)"},
      {k:"issuer",  label:"주관사"},
      {k:"contactName",  label:"담당자 성함"},
      {k:"contactPhone", label:"담당자 연락처"},
      {k:"contactEmail", label:"담당자 메일"},
    ],
    prompt:`이 문서는 합동사무소(컨소시엄) 구성을 위한 "업무협약서(MOU)"입니다. 아래 JSON 형식으로만 응답하세요(설명 없이 JSON만):
{"docNo":"협약번호(없으면 빈문자열)","amount":우리 회사(상지서울 등) 지분율(숫자, %, 없으면 0),"startDate":"협약일 YYYY-MM-DD","endDate":"협약기간 종료일 YYYY-MM-DD(없으면 빈문자열)","contractName":"참여사 목록(쉼표로 구분)","issuer":"주관사명","contactName":"문서에 담당자 이름이 있으면 채우고 없으면 빈문자열","contactPhone":"담당자 연락처(없으면 빈문자열)","contactEmail":"담당자 이메일(없으면 빈문자열)"}
찾을 수 없는 값은 빈 문자열 또는 0으로 두세요.`,
  },
  {
    key:"jvSettlement", label:"합사정산서", icon:"🧾",
    fields:[
      {k:"docNo",   label:"정산번호/차수"},
      {k:"amount",  label:"정산금액", type:"money"},
      {k:"startDate", label:"정산기준일"},
      {k:"endDate",   label:"정산완료일"},
      {k:"contractName", label:"정산 대상(참여사)"},
      {k:"issuer",  label:"작성사"},
      {k:"contactName",  label:"담당자 성함"},
      {k:"contactPhone", label:"담당자 연락처"},
      {k:"contactEmail", label:"담당자 메일"},
    ],
    prompt:`이 문서는 합동사무소(컨소시엄) "합사정산서"입니다. 아래 JSON 형식으로만 응답하세요(설명 없이 JSON만):
{"docNo":"정산번호 또는 O차 정산 표기(없으면 빈문자열)","amount":정산금액(숫자, 원 단위),"startDate":"정산기준일 YYYY-MM-DD(없으면 빈문자열)","endDate":"정산완료일 YYYY-MM-DD(없으면 빈문자열)","contractName":"정산 대상 참여사명","issuer":"정산서 작성사명","contactName":"담당자 이름(없으면 빈문자열)","contactPhone":"담당자 연락처(없으면 빈문자열)","contactEmail":"담당자 이메일(없으면 빈문자열)"}
찾을 수 없는 값은 빈 문자열 또는 0으로 두세요.`,
  },
  {
    key:"contractApproval", label:"계약체결보고서", icon:"🖋️",
    fields:[
      {k:"docNo",   label:"계약번호"},
      {k:"amount",  label:"상지 계약금액", type:"money"},
      {k:"startDate", label:"계약일"},
      {k:"orderDate", label:"착수일"},
      {k:"endDate",   label:"계약기간 종료일(총완수일)"},
      {k:"contractName", label:"용역명"},
      {k:"issuer",  label:"발주처"},
      {k:"consortium", label:"공동/분담 수급현황(참여사·지분율)"},
      {k:"bondInfo", label:"계약보증금액/보증기간/보증처"},
      {k:"specialTerms", label:"계약 특수조건"},
      {k:"contactName",  label:"작성자"},
      {k:"contactPhone", label:"작성자 소속/연락처"},
    ],
    prompt:`이 문서는 공공 또는 민간 발주 프로젝트의 내부결재용 "계약검토/체결 보고서"입니다. 아래 JSON 형식으로만 응답하세요(설명 없이 JSON만):
{"docNo":"계약번호","amount":문서에 "상지" 또는 "상지엔지니어링/상지서울" 몫으로 표기된 계약금액(숫자, 원 단위 — 컨소시엄 합계금액이 아니라 우리 회사 몫만),"startDate":"계약일(최초) YYYY-MM-DD","orderDate":"착수일 YYYY-MM-DD(없으면 빈문자열)","endDate":"계약기간 종료일 또는 총완수일 YYYY-MM-DD(없으면 빈문자열)","contractName":"용역명","issuer":"발주처명","consortium":"공동이행/분담이행 참여사명과 지분율을 간단히 나열(예: 건원 50%, 해마 30%, 상지 10%, 삼우엠이피 10%)","bondInfo":"계약보증금액과 보증기간, 보증처(공제조합 등)를 한 줄로(없으면 빈문자열)","specialTerms":"용역범위·특수조건을 1~2줄로 요약(없으면 빈문자열)","contactName":"작성자 이름(없으면 빈문자열)","contactPhone":"작성자 소속(부서명, 없으면 빈문자열)"}
찾을 수 없는 값은 빈 문자열 또는 0으로 두세요. amount는 반드시 상지(우리 회사) 몫 금액이어야 하며, 컨소시엄 전체 합계금액을 넣지 마세요.`,
  },
]

// ── 프로젝트별 협력업체 계약서 — 사용 안내: p.vendorDocs = [{vendorName, versions:[{docNo,amount,startDate,endDate,fileName,fileData,versionLabel,uploadedAt,...}]}]
export const VENDOR_DOC_PROMPT = `이 문서는 협력업체(외주업체)와 체결한 "계약서"입니다. 아래 JSON 형식으로만 응답하세요(설명 없이 JSON만):
{"docNo":"계약번호(없으면 빈문자열)","amount":계약금액(숫자, 원 단위),"startDate":"계약일 YYYY-MM-DD","endDate":"계약기간 종료일 YYYY-MM-DD(없으면 빈문자열)","vendorName":"협력업체명","workScope":"용역범위/공종(간단히)"}
찾을 수 없는 값은 빈 문자열 또는 0으로 두세요.`

// ── 협력업체 사업자등록증 / 세금계산서 업로드용 AI 프롬프트 ──────────
export const VENDOR_BIZREG_PROMPT = `이 문서는 협력업체의 "사업자등록증"입니다. 아래 JSON 형식으로만 응답하세요(설명 없이 JSON만):
{"bizNo":"사업자등록번호","name":"상호(회사명)","rep":"대표자명","addr":"사업장 소재지","bizType":"업태/종목(간단히)"}
찾을 수 없는 값은 빈 문자열로 두세요.`
export const VENDOR_TAXINVOICE_PROMPT = `이 문서는 "세금계산서"입니다. 아래 JSON 형식으로만 응답하세요(설명 없이 JSON만):
{"docNo":"세금계산서 승인번호(없으면 빈문자열)","amount":공급가액+세액 합계(숫자, 원 단위),"startDate":"작성일자 YYYY-MM-DD","issuer":"공급자(발행자) 상호","contractName":"품목/비고(간단히)"}
찾을 수 없는 값은 빈 문자열 또는 0으로 두세요.`

// ── 기성청구서 발송내역 — 사용 안내: p.billingSubmissions = [{stage, date, amount, fileName, fileData,
//    clientBizNo, clientBizName, taxContactName, taxContactPhone, taxContactEmail, note, createdAt}]
export const BILLING_STAGE_OPTIONS = ["선금","1차 기성","2차 기성","3차 기성","4차 기성","5차 기성","중도금","잔금","정산"]
export const BILLING_PROMPT = `이 문서는 발주처에 보낸 "기성청구서" 또는 관련 세금계산서입니다. 아래 JSON 형식으로만 응답하세요(설명 없이 JSON만):
{"stage":"청구 단계(선금/1차 기성/2차 기성/3차 기성/중도금/잔금/정산 중 가장 가까운 것, 모르면 빈문자열)","date":"청구일 YYYY-MM-DD","amount":청구금액(숫자, 원 단위),"clientBizNo":"발주처 사업자등록번호(문서에 있으면)","clientBizName":"발주처 상호","taxContactName":"세금계산서 발행 담당자 이름(있으면)","taxContactPhone":"담당자 연락처(있으면)","taxContactEmail":"담당자 이메일(있으면)"}
찾을 수 없는 값은 빈 문자열 또는 0으로 두세요.`

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
