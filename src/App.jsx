
import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, ComposedChart, Area, ReferenceLine
} from "recharts"

// ── 색상 ─────────────────────────────────────────────────────
const C = {
  navy:"#0C447C",navyM:"#185FA5",navyL:"#E6F1FB",
  green:"#1D9E75",greenL:"#EAF3DE",
  amber:"#BA7517",amberL:"#FAEEDA",
  red:"#A32D2D",redL:"#FCEBEB",
  gray:"#888780",grayL:"#F1EFE8",white:"#FFFFFF",
  teal:"#0F6E56",tealL:"#E1F5EE",
}
const CHART_COLORS=["#185FA5","#1D9E75","#BA7517","#A32D2D","#534AB7","#0F6E56","#888780","#D85A30"]

// ── 포맷 헬퍼 ─────────────────────────────────────────────────
const fmtE=n=>n!=null?`${(+n).toFixed(2)}억`:"-"
const fmtW=n=>n!=null?`${Math.round(+n).toLocaleString("ko-KR")}원`:"-"
const fmtP=n=>n!=null?`${(+n*100).toFixed(1)}%`:"-"
const fmtPy=n=>n!=null?`${Math.round(+n).toLocaleString()}원/평`:"-"

// ── 손익 월별 초기값 ─────────────────────────────────────────
const INIT_PNL_MONTHS = [
  {m:"1월",매출:5.10,급여:3.48,야근:0.12,기타인건:0.68,외주직접:2.40,외주정산:0,경비:0.36,업무추진:0.14,집기여비:0.16,기타경비:0.30,공동:1.28},
  {m:"2월",매출:5.10,급여:3.48,야근:0.12,기타인건:0.68,외주직접:2.40,외주정산:0,경비:0.36,업무추진:0.14,집기여비:0.16,기타경비:0.30,공동:1.28},
  {m:"3월",매출:6.59,급여:3.48,야근:0.12,기타인건:0.68,외주직접:5.80,외주정산:0,경비:0.36,업무추진:0.14,집기여비:0.16,기타경비:0.30,공동:1.28},
  {m:"4월",매출:6.53,급여:3.48,야근:0.12,기타인건:0.68,외주직접:8.10,외주정산:0,경비:0.36,업무추진:0.14,집기여비:0.16,기타경비:0.30,공동:1.28},
  {m:"5월",매출:6.29,급여:3.48,야근:0.12,기타인건:0.68,외주직접:8.01,외주정산:0.99,경비:0.36,업무추진:0.14,집기여비:0.16,기타경비:0.30,공동:1.28},
  {m:"6월",매출:0,급여:3.48,야근:0.12,기타인건:0.68,외주직접:0,외주정산:0,경비:0.36,업무추진:0.14,집기여비:0.16,기타경비:0.30,공동:1.28},
  {m:"7월",매출:0,급여:3.48,야근:0.12,기타인건:0.68,외주직접:0,외주정산:0,경비:0.36,업무추진:0.14,집기여비:0.16,기타경비:0.30,공동:1.28},
  {m:"8월",매출:0,급여:3.48,야근:0.12,기타인건:0.68,외주직접:0,외주정산:0,경비:0.36,업무추진:0.14,집기여비:0.16,기타경비:0.30,공동:1.28},
  {m:"9월",매출:0,급여:3.48,야근:0.12,기타인건:0.68,외주직접:0,외주정산:0,경비:0.36,업무추진:0.14,집기여비:0.16,기타경비:0.30,공동:1.28},
  {m:"10월",매출:0,급여:3.48,야근:0.12,기타인건:0.68,외주직접:0,외주정산:0,경비:0.36,업무추진:0.14,집기여비:0.16,기타경비:0.30,공동:1.28},
  {m:"11월",매출:0,급여:3.48,야근:0.12,기타인건:0.68,외주직접:0,외주정산:0,경비:0.36,업무추진:0.14,집기여비:0.16,기타경비:0.30,공동:1.28},
  {m:"12월",매출:0,급여:3.48,야근:0.12,기타인건:0.68,외주직접:0,외주정산:0,경비:0.36,업무추진:0.14,집기여비:0.16,기타경비:0.30,공동:1.28},
]

// ── 협력업체 DB ───────────────────────────────────────────────
const VENDORS_DB = [
  {
    id:"V001",name:"㈜씨에이치구조엔지니어링",cat:"구조",area:"국내",
    projects:[
      {code:"E26004",pname:"평택고덕 A68BL·Aab13BL",contract:34736956,pyFloor:8522,pyBuilding:null,dept:"설계2",year:2026,note:"성능기반 제외"},
      {code:"E26005",pname:"평택고덕 Aab18-1BL·Aa20-1BL",contract:18793986,pyFloor:7616,pyBuilding:null,dept:"설계2",year:2026,note:"성능기반 제외"},
    ]
  },
  {
    id:"V002",name:"㈜대신종합이엔지",cat:"토목·지반",area:"국내",
    projects:[
      {code:"E26004",pname:"평택고덕 A68BL·Aab13BL",contract:33552742+8909091+5454545,pyFloor:6174,pyBuilding:null,dept:"설계2",year:2026,note:"토목+지반+현황측량"},
      {code:"E26005",pname:"평택고덕 Aab18-1BL·Aa20-1BL",contract:13995521+8909091+1818182,pyFloor:4847,pyBuilding:null,dept:"설계2",year:2026,note:"토목+지반"},
    ]
  },
  {
    id:"V003",name:"㈜에이치에이",cat:"조경",area:"국내",
    projects:[
      {code:"E26004",pname:"평택고덕 A68BL·Aab13BL",contract:37500123,pyFloor:6900,pyBuilding:null,dept:"설계2",year:2026,note:"대지면적기준"},
      {code:"E26005",pname:"평택고덕 Aab18-1BL·Aa20-1BL",contract:21992962,pyFloor:7616,pyBuilding:null,dept:"설계2",year:2026,note:"대지면적기준"},
    ]
  },
  {
    id:"V004",name:"삼신설계㈜",cat:"기계",area:"국내",
    projects:[
      {code:"E26004",pname:"평택고덕 A68BL·Aab13BL",contract:24868503,pyFloor:1814,pyBuilding:null,dept:"설계2",year:2026,note:""},
      {code:"E26005",pname:"평택고덕 Aab18-1BL·Aa20-1BL",contract:18793986,pyFloor:2491,pyBuilding:null,dept:"설계2",year:2026,note:""},
    ]
  },
  {
    id:"V005",name:"㈜나라기술단",cat:"전기·통신·소방",area:"국내",
    projects:[
      {code:"E26004",pname:"평택고덕 A68BL·Aab13BL",contract:31973789,pyFloor:2333,pyBuilding:null,dept:"설계2",year:2026,note:""},
      {code:"E26005",pname:"평택고덕 Aab18-1BL·Aa20-1BL",contract:16794626,pyFloor:2226,pyBuilding:null,dept:"설계2",year:2026,note:""},
      {code:"E22021",pname:"우즈베키스탄 제약클러스터 1차",contract:17820000,pyFloor:null,pyBuilding:null,dept:"해외사업부",year:2024,note:"전기통신소방"},
    ]
  },
  {
    id:"V006",name:"㈜건원엔지니어링",cat:"친환경·경관",area:"국내",
    projects:[
      {code:"E26004",pname:"평택고덕 A68BL·Aab13BL",contract:43090909+38363636,pyFloor:null,pyBuilding:null,dept:"설계2",year:2026,note:"친환경+경관/토탈디자인"},
      {code:"E26005",pname:"평택고덕 Aab18-1BL·Aa20-1BL",contract:22909091+15636364,pyFloor:null,pyBuilding:null,dept:"설계2",year:2026,note:"친환경+경관"},
    ]
  },
  {
    id:"V007",name:"㈜한길알앤디",cat:"교통영향평가",area:"국내",
    projects:[
      {code:"E26004",pname:"평택고덕 A68BL·Aab13BL",contract:31090909+400000,pyFloor:null,pyBuilding:null,dept:"설계2",year:2026,note:"교통+교통변경신고"},
      {code:"E26005",pname:"평택고덕 Aab18-1BL·Aa20-1BL",contract:21090909+2000000,pyFloor:null,pyBuilding:null,dept:"설계2",year:2026,note:"교통+교통변경신고"},
    ]
  },
  {
    id:"V008",name:"대평엔지니어링㈜",cat:"기계소방",area:"국내",
    projects:[
      {code:"E26004",pname:"평택고덕 A68BL·Aab13BL",contract:25065872,pyFloor:1829,pyBuilding:null,dept:"설계2",year:2026,note:""},
      {code:"E26005",pname:"평택고덕 Aab18-1BL·Aa20-1BL",contract:11996161,pyFloor:1590,pyBuilding:null,dept:"설계2",year:2026,note:""},
    ]
  },
  {
    id:"V009",name:"㈜위즈앤",cat:"CG",area:"국내",
    projects:[
      {code:"E26004",pname:"평택고덕 A68BL·Aab13BL",contract:15454545,pyFloor:null,pyBuilding:null,dept:"설계2",year:2026,note:"1식"},
      {code:"E26005",pname:"평택고덕 Aab18-1BL·Aa20-1BL",contract:545455,pyFloor:null,pyBuilding:null,dept:"설계2",year:2026,note:"1식"},
    ]
  },
  {
    id:"V010",name:"㈜성진적산",cat:"견적",area:"국내",
    projects:[
      {code:"E26004",pname:"평택고덕 A68BL·Aab13BL",contract:1000000,pyFloor:null,pyBuilding:null,dept:"설계2",year:2026,note:"착공신고용"},
      {code:"E26005",pname:"평택고덕 Aab18-1BL·Aa20-1BL",contract:1000000,pyFloor:null,pyBuilding:null,dept:"설계2",year:2026,note:"착공신고용"},
    ]
  },
  {
    id:"V011",name:"주식회사청우종합건축사사무소",cat:"건축외주",area:"국내",
    projects:[
      {code:"E26004",pname:"평택고덕 A68BL·Aab13BL",contract:54059125,pyFloor:3944,pyBuilding:null,dept:"설계2",year:2026,note:"건축구조/도면작성"},
    ]
  },
  {
    id:"V012",name:"구조사건축연구소",cat:"건축외주",area:"국내",
    projects:[
      {code:"E26005",pname:"평택고덕 Aab18-1BL·Aa20-1BL",contract:29990403,pyFloor:3975,pyBuilding:null,dept:"설계2",year:2026,note:"건축구조/도면작성"},
    ]
  },
  {
    id:"V013",name:"㈜케이메디컬컨설팅",cat:"현지조사",area:"해외",
    projects:[
      {code:"E22021",pname:"우즈베키스탄 제약클러스터 1차",contract:558481038,pyFloor:null,pyBuilding:null,dept:"해외사업부",year:2024,note:"현지 제약산업 컨설팅 / 지급완료"},
    ]
  },
  {
    id:"V014",name:"Hplus건축사사무소",cat:"해외코디",area:"해외",
    projects:[
      {code:"E22021",pname:"우즈베키스탄 제약클러스터 1차",contract:580800000,pyFloor:null,pyBuilding:null,dept:"해외사업부",year:2024,note:"설계 코디네이션(기본·실시) / 지급완료"},
    ]
  },
  {
    id:"V015",name:"H-ARHITECT",cat:"해외협력·저작권감리",area:"해외",
    projects:[
      {code:"E22021",pname:"우즈베키스탄 제약클러스터 1차(설계)",contract:132000000,pyFloor:null,pyBuilding:null,dept:"해외사업부",year:2024,note:"현지협력·측량·번역·인허가 / 지급완료"},
      {code:"E22021",pname:"우즈베키스탄 제약클러스터 1차(감리)",contract:42568934,pyFloor:null,pyBuilding:null,dept:"해외사업부",year:2025,note:"저작권 감리 / 지급완료"},
    ]
  },
  {
    id:"V016",name:"General Project Expert LLC",cat:"기술감리",area:"해외",
    projects:[
      {code:"E22021",pname:"우즈베키스탄 제약클러스터 1차",contract:182927245,pyFloor:null,pyBuilding:null,dept:"해외사업부",year:2025,note:"감리 진행 중 / 30.82% 지급"},
    ]
  },
  {
    id:"V017",name:"Marva",cat:"저작권감리(신규)",area:"해외",
    projects:[
      {code:"E22021",pname:"우즈베키스탄 제약클러스터 1차",contract:89180218,pyFloor:null,pyBuilding:null,dept:"해외사업부",year:2025,note:"5차변경 신규 / 50.06% 지급"},
    ]
  },
  {
    id:"V018",name:"원진회계법인",cat:"PE회계",area:"해외",
    projects:[
      {code:"E22021",pname:"우즈베키스탄 제약클러스터 1차",contract:67180960,pyFloor:null,pyBuilding:null,dept:"해외사업부",year:2025,note:"PE설립·회계·청산 / 23.04% 지급"},
    ]
  },
  {
    id:"V019",name:"무영CM",cat:"설계PM",area:"국내",
    projects:[
      {code:"E22021",pname:"우즈베키스탄 제약클러스터 1차",contract:206800000,pyFloor:null,pyBuilding:null,dept:"해외사업부",year:2024,note:"키스탭 설계+입찰 / 20% 지급"},
    ]
  },
]

// ── 월수금 데이터 ──────────────────────────────────────────────
const CF_2026 = [
  {m:"1월",cash:2.21,note:0,blue:0,actual:true,memo:"의정부동·평택고덕 등"},
  {m:"2월",cash:2.24,note:0,blue:0,actual:true,memo:"에코델타15BL·보훈병원"},
  {m:"3월",cash:6.59,note:0,blue:0,actual:true,memo:"서산시청사 2차선금·국립포항"},
  {m:"4월",cash:10.11,note:1.73,blue:0,actual:true,memo:"우즈벡 입찰지원·서부의료원"},
  {m:"5월",cash:8.47,note:0,blue:0,actual:true,memo:"에코앤로지스·라오스 감리"},
  {m:"6월",cash:21.65,note:0,blue:0,actual:false,memo:"서부산행정복합 기대"},
  {m:"7월",cash:36.32,note:0,blue:14.32,actual:false,memo:"동해용정 9.56억·청량리 4.76억(민간위험)"},
  {m:"8월",cash:15.07,note:0,blue:0,actual:false,memo:""},
  {m:"9월",cash:10.90,note:0,blue:6.99,actual:false,memo:"안산장상(민간위험)"},
  {m:"10월",cash:7.54,note:0,blue:0,actual:false,memo:""},
  {m:"11월",cash:10.25,note:0,blue:0,actual:false,memo:""},
  {m:"12월",cash:27.27,note:0.86,blue:0,actual:false,memo:"남양주왕숙2·청량리 이월"},
]

// ── 프로젝트 DB ────────────────────────────────────────────────
const PROJECTS_DB = [
  {type:"계약",dept:"설계1",name:"경상남도 서부의료원 설립 기본 및 실시설계",fee:1.47,prog:45,acc:2.47,rev26:4.08,pub:"공공",pyFloor:null},
  {type:"계약",dept:"설계2",name:"화성 배양2지구 1BL 공동주택",fee:0.25,prog:15,acc:1.07,rev26:0.25,pub:"민간",pyFloor:null},
  {type:"계약",dept:"주거",name:"에코델타시티 1BL 민참(기본설계)",fee:5.92,prog:5,acc:0.59,rev26:5.92,pub:"민간",pyFloor:9737},
  {type:"확정",dept:"디자인",name:"사직야구장 임시구장 조성사업",fee:8.48,prog:0,acc:0,rev26:2.54,pub:"공공",pyFloor:null},
  {type:"확정",dept:"설계1+디자인",name:"서부산행정복합타운 실시설계기술제안",fee:19.15,prog:40,acc:1.97,rev26:14.36,pub:"민간",pyFloor:null},
  {type:"확정",dept:"주거",name:"청량리동 주상복합 건립사업",fee:23.78,prog:0,acc:0,rev26:4.76,pub:"민간",pyFloor:null},
  {type:"확정",dept:"주거+디자인",name:"에코델타시티 3BL 민참",fee:17.50,prog:0,acc:0,rev26:3.50,pub:"민간",pyFloor:9737},
  {type:"추진",dept:"설계1",name:"익산 융복합스마트팜 클러스터",fee:60.00,prog:0,acc:0,rev26:0,pub:"민간",pyFloor:null},
  {type:"추진",dept:"설계1",name:"김천 융복합스마트팜 클러스터",fee:22.00,prog:0,acc:0,rev26:0,pub:"민간",pyFloor:null},
  {type:"추진",dept:"디자인",name:"부산시중구 신청사 설계공모",fee:20.00,prog:0,acc:0,rev26:0,pub:"공공",pyFloor:null},
  {type:"추진",dept:"디자인",name:"사직야구장 재건축 기본설계공모",fee:27.27,prog:0,acc:0,rev26:0,pub:"공공",pyFloor:null},
  {type:"추진",dept:"설계2",name:"청주 내수3지구 공동주택(영무건설)",fee:47.00,prog:0,acc:0,rev26:0,pub:"민간",pyFloor:null},
  {type:"기성",dept:"설계1",name:"중앙보훈병원 시설재배치사업",fee:4.03,prog:40,acc:1.61,rev26:2.42,pub:"공공",pyFloor:null},
  {type:"기성",dept:"설계1",name:"서부산의료원 BTL",fee:13.60,prog:45,acc:6.12,rev26:2.42,pub:"민간",pyFloor:null},
  {type:"기성",dept:"설계1",name:"쿠팡부산FC 신축공사",fee:32.96,prog:35,acc:11.54,rev26:2.01,pub:"민간",pyFloor:null},
  {type:"기성",dept:"설계2",name:"안산장상 A-8BL 공동주택",fee:13.65,prog:50,acc:6.83,rev26:5.71,pub:"공공",pyFloor:24706},
  {type:"기성",dept:"설계2",name:"남양주왕숙2 A-4BL 공동주택",fee:16.39,prog:49,acc:8.03,rev26:4.81,pub:"공공",pyFloor:null},
  {type:"기성",dept:"해외",name:"우즈베키스탄 제약클러스터 1차",fee:32.76,prog:60,acc:19.66,rev26:7.97,pub:"공공",pyFloor:null},
  {type:"기성",dept:"해외",name:"라오스 대학병원 건립사업",fee:8.60,prog:60,acc:5.16,rev26:1.20,pub:"공공",pyFloor:null},
]

// ── 3개년 데이터 ───────────────────────────────────────────────
const YEARS_DB = [
  {yr:"2023",목표수주:223.11,실행수주:154.79,목표매출:163.08,실행매출:139.65,인원:97.92},
  {yr:"2024",목표수주:201,실행수주:79.19,목표매출:165.87,실행매출:92.01,인원:86},
  {yr:"2025",목표수주:170,실행수주:95,목표매출:150,실행매출:120,인원:70},
  {yr:"2026",목표수주:170,실행수주:96.72,목표매출:145,실행매출:29.61,인원:61.75},
]

// ── 스타일 헬퍼 ───────────────────────────────────────────────
const S = {
  card:(extra={})=>({background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e0e0e0)",borderRadius:12,padding:"13px 15px",marginBottom:13,...extra}),
  kpi:()=>({background:"var(--color-background-secondary,#f5f5f3)",borderRadius:8,padding:"11px 13px"}),
  grid:(cols,gap=12)=>({display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap,marginBottom:gap}),
  th:(align="left")=>({padding:"6px 9px",textAlign:align,fontSize:11,fontWeight:500,color:"var(--color-text-secondary,#888)",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",background:"var(--color-background-secondary,#f8f8f6)",whiteSpace:"nowrap"}),
  td:(align="right")=>({padding:"6px 9px",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",textAlign:align,fontSize:12}),
  badge:(bg,color)=>({display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:500,background:bg,color}),
  btn:(bg=C.navyM,color="#fff")=>({padding:"7px 14px",background:bg,color,border:"none",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer"}),
  inp:()=>({padding:"6px 9px",border:"1px solid var(--color-border-secondary,#ddd)",borderRadius:8,fontSize:12,width:"100%",textAlign:"right",background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)",fontFamily:"inherit"}),
  lbl:()=>({display:"block",fontSize:11,color:C.gray,fontWeight:500,marginBottom:3}),
}

const TYPE_BADGE={
  계약:{bg:C.navyL,color:C.navy},확정:{bg:C.greenL,color:"#27500A"},
  추진:{bg:C.amberL,color:"#633806"},기성:{bg:C.tealL,color:C.teal}
}

// ════════════════════════════════════════════════════════════
// 메인 앱
// ════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("overview")
  const [pnlData, setPnlData] = useState(INIT_PNL_MONTHS)
  const [editingPnl, setEditingPnl] = useState(false)
  const [pnlDraft, setPnlDraft] = useState(null)
  const [selVendor, setSelVendor] = useState(null)
  const [vendorSearch, setVendorSearch] = useState("")
  const [globalSearch, setGlobalSearch] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [years, setYears] = useState(YEARS_DB)
  const [showAddYear, setShowAddYear] = useState(false)
  const searchRef = useRef(null)

  // 전역 검색
  const handleSearch = useCallback((q) => {
    if (!q.trim()) { setSearchResults([]); return }
    const kw = q.toLowerCase()
    const results = []
    PROJECTS_DB.filter(p=>p.name.toLowerCase().includes(kw)||p.dept.toLowerCase().includes(kw)).forEach(p=>results.push({type:"프로젝트",icon:"📐",title:p.name,sub:`${p.dept} · ${p.type} · ${fmtE(p.fee)}`,action:()=>{setTab("projects");setShowSearch(false)}}))
    VENDORS_DB.filter(v=>v.name.toLowerCase().includes(kw)||v.cat.toLowerCase().includes(kw)).forEach(v=>results.push({type:"협력업체",icon:"🏢",title:v.name,sub:`${v.cat} · ${v.projects.length}개 프로젝트`,action:()=>{setSelVendor(v);setTab("vendors");setShowSearch(false)}}))
    CF_2026.filter(m=>m.memo.toLowerCase().includes(kw)).forEach(m=>results.push({type:"기성수금",icon:"💧",title:`${m.m} 기성수금`,sub:fmtE(m.cash+m.note),action:()=>{setTab("cashflow");setShowSearch(false)}}))
    const numQ = parseFloat(q.replace(/[^0-9.]/g,""))
    if (!isNaN(numQ)) {
      PROJECTS_DB.filter(p=>Math.abs(p.fee-numQ)<0.1).forEach(p=>results.push({type:"금액일치",icon:"🔢",title:p.name,sub:`용역비 ${fmtE(p.fee)}`,action:()=>{setTab("projects");setShowSearch(false)}}))
    }
    setSearchResults(results.slice(0,12))
  }, [])

  useEffect(()=>{ handleSearch(globalSearch) },[globalSearch, handleSearch])

  const TABS = [
    {id:"overview",label:"📊 경영개요"},
    {id:"cashflow",label:"💧 월별기성"},
    {id:"projects",label:"🏗 프로젝트"},
    {id:"pnl",label:"📉 손익"},
    {id:"compare",label:"📆 연도비교"},
    {id:"vendors",label:"🏢 협력업체"},
    {id:"productivity",label:"👤 인당생산성"},
  ]

  const calcPnl = (row) => {
    const 인건비=+row.급여+ +row.야근+ +row.기타인건
    const 외주비=+row.외주직접+ +row.외주정산
    const 경비합=+row.경비+ +row.업무추진+ +row.집기여비+ +row.기타경비
    const 지출=인건비+외주비+경비합+ +row.공동
    return {인건비,외주비,경비합,지출,손익:+row.매출-지출}
  }

  return (
    <div style={{fontFamily:"var(--font-sans,'Apple SD Gothic Neo',sans-serif)",fontSize:13,color:"var(--color-text-primary,#222)",background:"var(--color-background-tertiary,#f5f5f3)",minHeight:"100vh"}}>

      {/* ── 헤더 ── */}
      <div style={{background:C.navy,padding:"11px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:C.navyM,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>📐</div>
          <div>
            <div style={{fontSize:14,fontWeight:500,color:"#fff"}}>상지서울건축사사무소 — 경영 대시보드</div>
            <div style={{fontSize:10,color:"#85B7EB"}}>기준 2026-06-09 · 5월 누계 · 억원(VAT별도:수주 / VAT포함:매출·지출)</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {/* 검색 */}
          <div style={{position:"relative"}} ref={searchRef}>
            <div style={{display:"flex",alignItems:"center",background:"rgba(255,255,255,.12)",borderRadius:8,padding:"5px 10px",gap:6,border:"1px solid rgba(255,255,255,.2)"}}>
              <i className="ti ti-search" style={{color:"#85B7EB",fontSize:13}} aria-hidden="true"/>
              <input value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)}
                onFocus={()=>setShowSearch(true)} placeholder="프로젝트·협력업체·금액 검색…"
                style={{background:"none",border:"none",color:"#fff",fontSize:11,width:160,outline:"none"}}
                aria-label="전체 검색"/>
              {globalSearch && <button onClick={()=>{setGlobalSearch("");setSearchResults([])}} style={{background:"none",border:"none",color:"#85B7EB",cursor:"pointer",fontSize:12}}>✕</button>}
            </div>
            {showSearch && searchResults.length>0 && (
              <div style={{position:"absolute",top:"100%",right:0,marginTop:4,background:"var(--color-background-primary,#fff)",border:"1px solid var(--color-border-secondary,#ddd)",borderRadius:10,boxShadow:"0 4px 20px rgba(0,0,0,.15)",zIndex:500,minWidth:300,maxHeight:320,overflowY:"auto"}}>
                {searchResults.map((r,i)=>(
                  <div key={i} onClick={r.action} style={{padding:"9px 13px",cursor:"pointer",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",display:"flex",gap:8,alignItems:"flex-start"}}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary,#f5f5f3)"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <span style={{fontSize:14,flexShrink:0,marginTop:1}}>{r.icon}</span>
                    <div>
                      <div style={{fontSize:12,fontWeight:500}}>{r.title}</div>
                      <div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginTop:2}}>{r.sub}</div>
                    </div>
                    <span style={{...S.badge(C.navyL,C.navyM),marginLeft:"auto",flexShrink:0,fontSize:9}}>{r.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <span style={S.badge(C.greenL,"#27500A")}>58명</span>
          <span style={S.badge(C.amberL,"#633806")}>수주목표 170억</span>
          <span style={S.badge(C.redL,C.red)}>비상경영</span>
        </div>
      </div>

      {/* ── 탭 ── */}
      <div style={{background:"var(--color-background-primary,#fff)",borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)",display:"flex",overflowX:"auto",padding:"0 14px"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setShowSearch(false)}} style={{padding:"9px 13px",border:"none",background:"none",fontSize:12,fontWeight:tab===t.id?500:400,cursor:"pointer",whiteSpace:"nowrap",
            color:tab===t.id?C.navyM:"var(--color-text-secondary,#888)",
            borderBottom:tab===t.id?`2px solid ${C.navyM}`:"2px solid transparent"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 바디 ── */}
      <div style={{padding:"14px 16px",maxWidth:1400,margin:"0 auto"}}>
        {tab==="overview"    && <OverviewTab />}
        {tab==="cashflow"    && <CashflowTab />}
        {tab==="projects"    && <ProjectsTab onVendorClick={(v)=>{setSelVendor(v);setTab("vendors")}} />}
        {tab==="pnl"         && <PnlTab pnlData={pnlData} setPnlData={setPnlData} editingPnl={editingPnl} setEditingPnl={setEditingPnl} pnlDraft={pnlDraft} setPnlDraft={setPnlDraft} calcPnl={calcPnl} />}
        {tab==="compare"     && <CompareTab years={years} setYears={setYears} showAddYear={showAddYear} setShowAddYear={setShowAddYear} />}
        {tab==="vendors"     && <VendorsTab selVendor={selVendor} setSelVendor={setSelVendor} vendorSearch={vendorSearch} setVendorSearch={setVendorSearch} />}
        {tab==="productivity"&& <ProductivityTab years={years} />}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 경영개요 탭
// ════════════════════════════════════════════════════════════
function OverviewTab() {
  const totalCash=CF_2026.reduce((s,d)=>s+d.cash,0)
  const totalNote=CF_2026.reduce((s,d)=>s+d.note,0)
  const kpis=[
    ["계약+확정","96.72억","56.9%",C.navyM,57],
    ["누계 매출","29.61억","20.4%",C.amber,20],
    ["누계 지출","57.37억","5월누계",C.red,100],
    ["손익","-27.76억","매출-지출",C.red,0],
    ["예상기성(연간)",`${(totalCash+totalNote).toFixed(2)}억`,"현금+어음",C.green,100],
    ["민간위험",`${CF_2026.reduce((s,d)=>s+d.blue,0).toFixed(2)}억`,"파란셀",C.amber,0],
  ]
  const progData=[
    {n:"설계1(해외)",t:20,a:20.62},{n:"설계2",t:40,a:2.51},
    {n:"디자인",t:60,a:28.04},{n:"주거디자인",t:50,a:45.56}
  ]
  const barData = CF_2026.map(d=>({name:d.m,현금:+d.cash.toFixed(2),어음:+d.note.toFixed(2),합계:+(d.cash+d.note).toFixed(2)}))
  const forecastData=[
    {name:"1월",실적:null,추세:1.53,낙관:null,목표:170},
    {name:"2월",실적:null,추세:3.06,낙관:null,목표:170},
    {name:"3월",실적:null,추세:4.59,낙관:null,목표:170},
    {name:"4월",실적:null,추세:6.12,낙관:null,목표:170},
    {name:"5월",실적:7.63,추세:7.65,낙관:7.63,목표:170},
    {name:"6월",실적:null,추세:9.18,낙관:96.72,목표:170},
    {name:"7월",실적:null,추세:10.71,낙관:96.72,목표:170},
    {name:"8월",실적:null,추세:12.24,낙관:110,목표:170},
    {name:"9월",실적:null,추세:13.77,낙관:120,목표:170},
    {name:"10월",실적:null,추세:15.30,낙관:130,목표:170},
    {name:"11월",실적:null,추세:16.83,낙관:150,목표:170},
    {name:"12월",실적:null,추세:18.36,낙관:170,목표:170},
  ]
  return (
    <div>
      <div style={S.grid(6)}>
        {kpis.map(([l,v,s,c,p])=>(
          <div key={l} style={S.kpi()}>
            <div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginBottom:4}}>{l}</div>
            <div style={{fontSize:19,fontWeight:500,color:c,letterSpacing:-.5}}>{v}</div>
            <div style={{fontSize:10,color:"var(--color-text-secondary,#888)",marginTop:2}}>{s}</div>
          </div>
        ))}
      </div>
      <div style={{background:C.amberL,borderLeft:`3px solid ${C.amber}`,borderRadius:"0 8px 8px 0",padding:"9px 13px",fontSize:12,color:"#633806",marginBottom:12,display:"flex",gap:8}}>
        <i className="ti ti-alert-triangle" aria-hidden="true" style={{flexShrink:0,marginTop:1}}/>
        <span><strong>비상경영 체제.</strong> 5월 누계: 매출 29.61억 vs 지출 57.37억 → 27.76억 적자. 민간위험 48.64억 별도 관리 필요. 7월 기성집중(36.32억) 및 6월 서부산·사직 확정 시 회복 가능.</span>
      </div>
      <div style={S.grid(2,12)}>
        <Card title="본부별 계약 달성률" note="목표 대비 계약+확정">
          {progData.map(d=>{
            const p=d.t>0?Math.min(d.a/d.t,1.5):0, c=p>=1?C.green:p>=.5?C.amber:C.navyM
            return <div key={d.n} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 0",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)"}}>
              <span style={{fontSize:11,color:"var(--color-text-secondary,#888)",width:90,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.n}</span>
              <div style={{flex:1,height:7,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:4,overflow:"hidden"}}><div style={{width:`${Math.min(p*100,100).toFixed(0)}%`,height:7,background:c,borderRadius:4,transition:"width .5s"}}/></div>
              <span style={{fontSize:11,fontWeight:500,color:c,minWidth:36,textAlign:"right"}}>{d.t>0?`${((d.a/d.t)*100).toFixed(0)}%`:"-"}</span>
            </div>
          })}
        </Card>
        <Card title="월별 기성수금 예상" note="VAT포함 · 현금+어음">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{top:4,right:6,left:-10,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
              <XAxis dataKey="name" tick={{fontSize:10}} tickFormatter={v=>v.replace("월","")}/>
              <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
              <Tooltip formatter={(v,n)=>[`${v}억`,n]}/>
              <Bar dataKey="현금" fill={C.navyM} stackId="s" radius={[0,0,2,2]} barSize={18}/>
              <Bar dataKey="어음" fill={C.amber} stackId="s" radius={[2,2,0,0]} barSize={18}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="수주 달성 예측" note="현재 추세 vs 낙관 시나리오">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={forecastData} margin={{top:4,right:10,left:-10,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
            <XAxis dataKey="name" tick={{fontSize:10}}/>
            <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
            <Tooltip formatter={(v,n)=>v!=null?[`${v}억`,n]:["-",n]}/>
            <ReferenceLine y={170} stroke={C.red} strokeDasharray="6 3" label={{value:"목표 170억",position:"right",fontSize:10,fill:C.red}}/>
            <Line type="monotone" dataKey="실적" stroke={C.navyM} strokeWidth={2.5} dot={{r:4,fill:C.navyM}} connectNulls={false}/>
            <Line type="monotone" dataKey="추세" stroke={C.gray} strokeDasharray="5 4" strokeWidth={1.5} dot={false} connectNulls/>
            <Line type="monotone" dataKey="낙관" stroke={C.green} strokeDasharray="4 3" strokeWidth={1.5} dot={false} connectNulls/>
          </LineChart>
        </ResponsiveContainer>
        <div style={{display:"flex",gap:12,marginTop:6,fontSize:11,color:"var(--color-text-secondary,#888)"}}>
          <span><span style={{display:"inline-block",width:12,height:3,background:C.navyM,verticalAlign:"middle",marginRight:4,borderRadius:2}}/>실적</span>
          <span><span style={{display:"inline-block",width:14,height:2,background:C.gray,verticalAlign:"middle",marginRight:4,borderRadius:1,borderTop:"2px dashed"}}/>현재추세(18.4억 예상)</span>
          <span><span style={{display:"inline-block",width:14,height:2,background:C.green,verticalAlign:"middle",marginRight:4,borderRadius:1,borderTop:"2px dashed"}}/>낙관(확정완료시 170억)</span>
        </div>
      </Card>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 월별기성수금 탭
// ════════════════════════════════════════════════════════════
function CashflowTab() {
  const [year,setYear]=useState("2026")
  const data=year==="2026"?CF_2026:[
    {m:"1월",cash:3.01,note:0,blue:0,actual:false,memo:"화성배양 착공"},
    {m:"2월",cash:0,note:0,blue:0,actual:false,memo:"-"},
    {m:"3월",cash:23.55,note:0,blue:0,actual:false,memo:"수원남부경찰서·쿠팡부산FC"},
    ...Array.from({length:9},(_,i)=>({m:`${i+4}월`,cash:0,note:0,blue:0,actual:false,memo:"-"}))
  ]
  const tc=data.reduce((s,d)=>s+d.cash,0)
  const tn=data.reduce((s,d)=>s+d.note,0)
  const tb=data.reduce((s,d)=>s+d.blue,0)
  const q=[[0,1,2],[3,4,5],[6,7,8],[9,10,11]].map(idx=>idx.reduce((s,i)=>s+(data[i].cash+data[i].note),0))
  const barData=data.map(d=>({name:d.m,현금:+d.cash.toFixed(2),어음:+d.note.toFixed(2)}))
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <select value={year} onChange={e=>setYear(e.target.value)} style={{padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ddd)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
          <option value="2026">2026년</option>
          <option value="2027">2027년</option>
        </select>
        <div style={{fontSize:11,color:C.gray}}>현금·어음 스택바 / 민간위험(파란셀) 별도 표시</div>
      </div>
      <div style={S.grid(6)}>
        {[["연간합계",`${(tc+tn).toFixed(2)}억`,"현금+어음",C.navyM],[`현금`,`${tc.toFixed(2)}억`,"어음제외",C.navyM],[`어음`,`${tn>0?tn.toFixed(2):"없음"}`,"별도관리",tn>0?C.amber:C.gray],[`민간위험(파란셀)`,`${tb>0?tb.toFixed(2)+"억":"없음"}`,"달성불확실",tb>0?C.red:C.gray],...[[0,1],[2,3]].map((idx,qi)=>[`${qi*2+1}~${qi*2+2}분기`,`${(q[qi*2]+q[qi*2+1]).toFixed(2)}억`,""])].map(([l,v,s,c])=>(
          <div key={l} style={S.kpi()}>
            <div style={{fontSize:10,color:"var(--color-text-secondary,#888)",marginBottom:4}}>{l}</div>
            <div style={{fontSize:16,fontWeight:500,color:c||"var(--color-text-primary)"}}>{v}</div>
            {s&&<div style={{fontSize:10,color:"var(--color-text-secondary,#888)",marginTop:2}}>{s}</div>}
          </div>
        ))}
      </div>
      {tb>0&&<div style={{background:C.amberL,borderLeft:`3px solid ${C.amber}`,borderRadius:"0 8px 8px 0",padding:"9px 13px",fontSize:12,color:"#633806",marginBottom:12,display:"flex",gap:8}}>
        <i className="ti ti-flag" aria-hidden="true" style={{flexShrink:0}}/>
        <span><strong>민간위험 프로젝트 {tb.toFixed(2)}억</strong> — 시행사 상황에 따라 기성 달성이 불확실합니다. 합계에 포함되어 있으며 별도 모니터링이 필요합니다.</span>
      </div>}
      <Card title="월별 기성수금 (현금+어음)" note="VAT포함 억원">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} margin={{top:4,right:6,left:-10,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
            <XAxis dataKey="name" tick={{fontSize:10}} tickFormatter={v=>v.replace("월","")}/>
            <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
            <Tooltip formatter={(v,n)=>[`${v}억`,n]}/>
            <Bar dataKey="현금" fill={C.navyM} stackId="s" radius={[0,0,2,2]} barSize={22}/>
            <Bar dataKey="어음" fill={C.amber} stackId="s" radius={[2,2,0,0]} barSize={22}/>
          </BarChart>
        </ResponsiveContainer>
        <div style={{display:"flex",gap:12,marginTop:6,fontSize:11,color:"var(--color-text-secondary,#888)"}}>
          <span><span style={{display:"inline-block",width:10,height:10,background:C.navyM,borderRadius:2,verticalAlign:"middle",marginRight:4}}/>현금</span>
          <span><span style={{display:"inline-block",width:10,height:10,background:C.amber,borderRadius:2,verticalAlign:"middle",marginRight:4}}/>어음(별도)</span>
          <span style={{marginLeft:"auto"}}>1~5월: <strong>실적</strong> / 6~12월: <strong>예상</strong></span>
        </div>
      </Card>
      <Card title="월별 상세 내역">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              {["월","현금(억)","어음(억)","합계(억)","민간위험","상태","주요 내역"].map((h,i)=><th key={h} style={S.th(i>1&&i<5?"right":"left")}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.map((d,i)=>{
                const tot=(d.cash+d.note).toFixed(2)
                return <tr key={i}>
                  <td style={S.td("left")}><span style={{fontWeight:d.actual?600:400}}>{d.m}</span>{d.actual&&<span style={{...S.badge(C.navyL,C.navyM),marginLeft:5,fontSize:9}}>실적</span>}</td>
                  <td style={S.td("right")}>{d.cash.toFixed(2)}</td>
                  <td style={{...S.td("right"),color:d.note>0?C.amber:"var(--color-text-secondary)"}}>{d.note>0?d.note.toFixed(2):"-"}</td>
                  <td style={{...S.td("right"),fontWeight:500,color:+tot>20?C.green:+tot>10?C.navyM:"inherit"}}>{tot}</td>
                  <td style={S.td("center")}>{d.blue>0?<span style={S.badge(C.amberL,"#633806")}>{d.blue.toFixed(2)}억</span>:"-"}</td>
                  <td style={S.td("center")}>{d.actual?<span style={S.badge(C.greenL,C.green)}>실적</span>:<span style={S.badge(C.grayL,C.gray)}>예상</span>}</td>
                  <td style={{...S.td("left"),fontSize:11,color:"var(--color-text-secondary,#888)"}}>{d.memo||"-"}</td>
                </tr>
              })}
              <tr style={{background:"var(--color-background-secondary,#f8f8f6)",fontWeight:600}}>
                <td style={S.td("left")}>합계</td>
                <td style={{...S.td("right"),color:C.navyM}}>{tc.toFixed(2)}</td>
                <td style={{...S.td("right"),color:tn>0?C.amber:"var(--color-text-secondary)"}}>{tn>0?tn.toFixed(2):"-"}</td>
                <td style={{...S.td("right"),color:C.green}}>{(tc+tn).toFixed(2)}</td>
                <td style={S.td("center")}>{tb>0?<span style={S.badge(C.redL,C.red)}>{tb.toFixed(2)}억</span>:"-"}</td>
                <td colSpan={2}/>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 프로젝트 탭
// ════════════════════════════════════════════════════════════
function ProjectsTab({onVendorClick}) {
  const [dept,setDept]=useState("")
  const [type,setType]=useState("")
  const filtered=PROJECTS_DB.filter(p=>(!dept||p.dept.includes(dept))&&(!type||p.type===type))
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {[["dept",setDept,[["","전체 본부"],["설계1","설계1본부"],["설계2","설계2본부"],["디자인","디자인본부"],["주거","주거디자인본부"],["해외","해외사업부"]]],
          ["type",setType,[["","전체 구분"],["계약","계약"],["확정","확정"],["추진","추진"],["기성","기성"]]]
        ].map(([id,setter,opts])=>(
          <select key={id} onChange={e=>setter(e.target.value)} style={{padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ddd)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
            {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <span style={{fontSize:11,color:C.gray}}>총 {filtered.length}건</span>
      </div>
      <Card title="프로젝트별 진행률·기성율·2026예상기성">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              {["구분","본부","프로젝트명","용역비","진행률","진행바","기성율","2026예상","평당단가","발주"].map((h,i)=>(
                <th key={h} style={S.th(i>2?"right":i===2?"left":"center")}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((p,i)=>{
                const tb=TYPE_BADGE[p.type]||{bg:C.grayL,color:C.gray}
                const bc=p.prog>=70?C.green:p.prog>=30?C.navyM:C.gray
                const acr=p.fee>0?(p.acc/p.fee*100).toFixed(0):0
                // 해당 프로젝트의 외주업체 찾기
                const vlist=VENDORS_DB.filter(v=>v.projects.some(vp=>vp.pname.includes(p.name.slice(0,8))))
                return <tr key={i} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={S.td("center")}><span style={S.badge(tb.bg,tb.color)}>{p.type}</span></td>
                  <td style={{...S.td("center"),fontSize:11}}>{p.dept}</td>
                  <td style={{...S.td("left"),maxWidth:200,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={p.name}>
                    {p.name}
                    {vlist.length>0&&<button onClick={()=>onVendorClick(vlist[0])} style={{marginLeft:5,padding:"1px 6px",borderRadius:6,border:`1px solid ${C.navyM}`,background:C.navyL,color:C.navyM,fontSize:9,cursor:"pointer"}}>협력사↗</button>}
                  </td>
                  <td style={S.td("right")}>{fmtE(p.fee)}</td>
                  <td style={{...S.td("right"),fontWeight:500,color:bc}}>{p.prog}%</td>
                  <td style={S.td("center")}>
                    <div style={{width:70,height:7,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:4,overflow:"hidden",display:"inline-block"}}>
                      <div style={{width:`${p.prog}%`,height:7,background:bc,borderRadius:4}}/>
                    </div>
                  </td>
                  <td style={{...S.td("right"),color:+acr>=50?C.green:C.gray}}>{p.fee>0?acr+"%":"-"}</td>
                  <td style={S.td("right")}>{fmtE(p.rev26)}</td>
                  <td style={{...S.td("right"),fontSize:11}}>{p.pyFloor?fmtPy(p.fee*1e8/p.pyFloor):"-"}</td>
                  <td style={{...S.td("center"),fontSize:10}}>{p.pub}</td>
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
// 손익분석 탭 — 월별 직접 입력 기능 포함
// ════════════════════════════════════════════════════════════
function PnlTab({pnlData,setPnlData,editingPnl,setEditingPnl,pnlDraft,setPnlDraft,calcPnl}) {
  const [view,setView]=useState("monthly")

  const startEdit=()=>{
    setPnlDraft(pnlData.map(r=>({...r})))
    setEditingPnl(true)
  }
  const saveEdit=()=>{
    setPnlData(pnlDraft)
    setEditingPnl(false)
    setPnlDraft(null)
  }
  const cancelEdit=()=>{ setEditingPnl(false); setPnlDraft(null) }
  const updateDraft=(idx,field,val)=>{
    setPnlDraft(prev=>prev.map((r,i)=>i===idx?{...r,[field]:parseFloat(val)||0}:r))
  }

  const workData = editingPnl ? pnlDraft : pnlData
  const cumData  = workData.slice(0,5)

  const cumTotals = cumData.reduce((acc,r)=>{
    const c=calcPnl(r)
    acc.매출+=r.매출; acc.인건비+=c.인건비; acc.외주비+=c.외주비; acc.경비합+=c.경비합; acc.공동+=r.공동; acc.지출+=c.지출; acc.손익+=c.손익
    return acc
  },{매출:0,인건비:0,외주비:0,경비합:0,공동:0,지출:0,손익:0})

  const barData=workData.map(r=>{
    const c=calcPnl(r)
    return {name:r.m,매출:+r.매출.toFixed(2),지출:+c.지출.toFixed(2),손익:+c.손익.toFixed(2)}
  })

  const FIELDS=[
    {key:"매출",label:"매출",color:C.green,group:"매출"},
    {key:"급여",label:"급여",color:C.navyM,group:"인건비"},
    {key:"야근",label:"야근보조금",color:C.navyM,group:"인건비"},
    {key:"기타인건",label:"기타인건비",color:C.navyM,group:"인건비"},
    {key:"외주직접",label:"직접외주비",color:C.amber,group:"외주비"},
    {key:"외주정산",label:"외주정산금",color:C.amber,group:"외주비"},
    {key:"경비",label:"경비",color:C.gray,group:"경비"},
    {key:"업무추진",label:"업무추진비",color:C.gray,group:"경비"},
    {key:"집기여비",label:"집기여비",color:C.gray,group:"경비"},
    {key:"기타경비",label:"기타경비",color:C.gray,group:"경비"},
    {key:"공동",label:"공동비",color:C.gray,group:"공동"},
  ]

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <select value={view} onChange={e=>setView(e.target.value)} style={{padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ddd)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
          <option value="monthly">월별 입력/조회</option>
          <option value="chart">차트 분석</option>
          <option value="annual">연도별 비교</option>
        </select>
        {!editingPnl
          ? <button onClick={startEdit} style={S.btn(C.navyM)}><i className="ti ti-edit" aria-hidden="true"/> 월별 수치 입력</button>
          : <>
              <button onClick={saveEdit} style={S.btn(C.green)}><i className="ti ti-check" aria-hidden="true"/> 저장</button>
              <button onClick={cancelEdit} style={S.btn(C.gray)}><i className="ti ti-x" aria-hidden="true"/> 취소</button>
              <span style={{fontSize:11,color:C.amber}}><i className="ti ti-pencil" aria-hidden="true"/> 수정 중 — 수치 입력 후 저장하세요</span>
            </>
        }
      </div>

      {/* 누계 KPI */}
      <div style={S.grid(7)}>
        {[["매출(5월누계)",cumTotals.매출.toFixed(2)+"억",C.green],["인건비",cumTotals.인건비.toFixed(2)+"억",C.navyM],["외주비",cumTotals.외주비.toFixed(2)+"억",C.amber],["경비류",cumTotals.경비합.toFixed(2)+"억",C.gray],["공동비",cumTotals.공동.toFixed(2)+"억",C.gray],["지출합계",cumTotals.지출.toFixed(2)+"억",C.red],["손익",cumTotals.손익.toFixed(2)+"억",cumTotals.손익>=0?C.green:C.red]].map(([l,v,c])=>(
          <div key={l} style={S.kpi()}>
            <div style={{fontSize:10,color:"var(--color-text-secondary,#888)",marginBottom:4}}>{l}</div>
            <div style={{fontSize:15,fontWeight:500,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {view==="monthly" && (
        <Card title={editingPnl?"📝 월별 손익 입력 (억원 단위로 입력)":"월별 손익 현황"} note="억원 VAT포함">
          {editingPnl && (
            <div style={{background:C.navyL,borderRadius:8,padding:"9px 12px",marginBottom:12,fontSize:11,color:C.navyM}}>
              <i className="ti ti-info-circle" aria-hidden="true"/> 각 셀을 클릭해서 수치를 직접 입력하세요. 억원 단위. 소수점 2자리까지 입력 가능. 지출·손익은 자동 계산됩니다.
            </div>
          )}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr>
                  <th style={{...S.th("left"),background:"var(--color-background-secondary,#f0f0ee)",minWidth:90}}>항목</th>
                  {workData.map(r=><th key={r.m} style={{...S.th("right"),background:r.m<="5월"?"var(--color-background-secondary,#f0f0ee)":"var(--color-background-tertiary,#f8f8f6)"}}>{r.m}{r.m<="5월"&&<span style={{...S.badge(C.navyL,C.navyM),marginLeft:3,fontSize:8}}>실</span>}</th>)}
                  <th style={{...S.th("right"),background:"var(--color-background-secondary)"}}>합계</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map(({key,label,color,group},fi)=>{
                  const rowSum=workData.reduce((s,r)=>s+(r[key]||0),0)
                  return <tr key={key} style={{background:fi%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                    <td style={{...S.td("left"),fontWeight:group!==FIELDS[fi-1]?.group?600:400,color}}>{label}</td>
                    {workData.map((r,ri)=>(
                      <td key={ri} style={S.td("right")}>
                        {editingPnl
                          ? <input type="number" step="0.01" value={pnlDraft[ri][key]||0}
                              onChange={e=>updateDraft(ri,key,e.target.value)}
                              style={{...S.inp(),width:60,fontSize:11,padding:"3px 5px",textAlign:"right"}}/>
                          : <span style={{color:r[key]>0?color:"var(--color-text-secondary,#aaa)"}}>{r[key]>0?(+r[key]).toFixed(2):"-"}</span>
                        }
                      </td>
                    ))}
                    <td style={{...S.td("right"),fontWeight:600,color}}>{rowSum.toFixed(2)}</td>
                  </tr>
                })}
                {/* 자동계산 행 */}
                {[
                  {label:"인건비 소계",fn:r=>calcPnl(r).인건비,color:C.navyM,bold:true},
                  {label:"외주비 소계",fn:r=>calcPnl(r).외주비,color:C.amber,bold:true},
                  {label:"지출 합계",fn:r=>calcPnl(r).지출,color:C.red,bold:true},
                  {label:"손익 (매출-지출)",fn:r=>calcPnl(r).손익,color:null,bold:true,pnl:true},
                ].map(({label,fn,color,bold,pnl})=>{
                  const vals=workData.map(r=>fn(r))
                  const sum=vals.reduce((s,v)=>s+v,0)
                  return <tr key={label} style={{background:pnl?"var(--color-background-danger,#FCEBEB)":"var(--color-background-secondary,#f5f5f3)"}}>
                    <td style={{...S.td("left"),fontWeight:600,color:color||"var(--color-text-primary)"}}>{label}</td>
                    {vals.map((v,i)=><td key={i} style={{...S.td("right"),fontWeight:bold?600:400,color:pnl?(v>=0?C.green:C.red):(color||"var(--color-text-primary)")}}>{v.toFixed(2)}</td>)}
                    <td style={{...S.td("right"),fontWeight:700,color:pnl?(sum>=0?C.green:C.red):(color||"var(--color-text-primary)")}}>{sum.toFixed(2)}</td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view==="chart" && (
        <div style={S.grid(2,12)}>
          <Card title="월별 매출·지출·손익 추이" style={{marginBottom:0}}>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={barData} margin={{top:4,right:6,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                <XAxis dataKey="name" tick={{fontSize:10}} tickFormatter={v=>v.replace("월","")}/>
                <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
                <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억`,n]}/>
                <Bar dataKey="매출" fill={C.green} opacity={0.8} radius={[2,2,0,0]} barSize={14}/>
                <Bar dataKey="지출" fill={C.red} opacity={0.7} radius={[2,2,0,0]} barSize={14}/>
                <Line type="monotone" dataKey="손익" stroke={C.gray} strokeWidth={2} dot={{r:3}} strokeDasharray="4 3"/>
                <ReferenceLine y={0} stroke={C.red} strokeDasharray="4 2"/>
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
          <Card title="지출 구성 비율 (5월 누계)" style={{marginBottom:0}}>
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={[
                  {name:"인건비",value:+cumTotals.인건비.toFixed(2)},
                  {name:"외주비",value:+cumTotals.외주비.toFixed(2)},
                  {name:"경비류",value:+cumTotals.경비합.toFixed(2)},
                  {name:"공동비",value:+cumTotals.공동.toFixed(2)},
                ]} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" nameKey="name"
                  label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {["#185FA5","#BA7517","#1D9E75","#888780"].map((c,i)=><Cell key={i} fill={c}/>)}
                </Pie>
                <Tooltip formatter={v=>[`${v.toFixed(2)}억`]}/>
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {view==="annual" && (
        <Card title="연도별 손익 비교">
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>
                {["연도","매출","지출(추정)","손익","비고"].map((h,i)=><th key={h} style={S.th(i>0&&i<4?"right":"left")}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[["2023",139.65,130,9.65,"연간실적"],["2024",92.01,110,-17.99,"연간실적"],["2025",120,115,5,"추정치"],["2026(5월)",29.61,57.37,-27.76,"5월누계"]].map(([yr,rev,exp,pnl,note],i)=>(
                  <tr key={yr} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                    <td style={{...S.td("left"),fontWeight:600}}>{yr}</td>
                    <td style={{...S.td("right"),color:C.green}}>{rev.toFixed(2)}</td>
                    <td style={{...S.td("right"),color:C.red}}>{exp.toFixed(2)}</td>
                    <td style={{...S.td("right"),fontWeight:600,color:pnl>=0?C.green:C.red}}>{pnl.toFixed(2)}</td>
                    <td style={{...S.td("left"),fontSize:11,color:"var(--color-text-secondary,#888)"}}>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 협력업체 탭
// ════════════════════════════════════════════════════════════
function VendorsTab({selVendor,setSelVendor,vendorSearch,setVendorSearch}) {
  const filtered=VENDORS_DB.filter(v=>!vendorSearch||(v.name.toLowerCase().includes(vendorSearch.toLowerCase())||v.cat.toLowerCase().includes(vendorSearch.toLowerCase())))
  const cats=[...new Set(VENDORS_DB.map(v=>v.cat))]
  const [catFilter,setCatFilter]=useState("")
  const catFiltered=filtered.filter(v=>!catFilter||v.cat===catFilter)

  if (selVendor) {
    const totalContract=selVendor.projects.reduce((s,p)=>s+p.contract,0)
    const barData=selVendor.projects.map(p=>({name:p.pname.slice(0,12)+"…",contract:+(p.contract/1e8).toFixed(2)}))
    return (
      <div>
        <button onClick={()=>setSelVendor(null)} style={{...S.btn(C.grayL,C.navy),marginBottom:12,display:"flex",alignItems:"center",gap:5}}>
          <i className="ti ti-arrow-left" aria-hidden="true"/> 협력업체 목록으로
        </button>
        <Card title={`🏢 ${selVendor.name}`} note={selVendor.cat+" · "+selVendor.area}>
          <div style={S.grid(4,10)}>
            {[["분야",selVendor.cat],["구분",selVendor.area],["참여 프로젝트",selVendor.projects.length+"건"],["총 계약금",fmtE(totalContract/1e8)]].map(([k,v])=>(
              <div key={k} style={S.kpi()}>
                <div style={{fontSize:10,color:C.gray,marginBottom:4}}>{k}</div>
                <div style={{fontSize:14,fontWeight:500}}>{v}</div>
              </div>
            ))}
          </div>
        </Card>
        {selVendor.projects.length>1&&(
          <Card title="프로젝트별 계약금 비교 (억원)" note="전체 계약 이력">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} layout="vertical" margin={{left:10,right:20,top:4,bottom:4}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
                <XAxis type="number" tick={{fontSize:10}} tickFormatter={v=>v+"억"}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={100}/>
                <Tooltip formatter={v=>[`${v}억`,"계약금"]}/>
                <Bar dataKey="contract" fill={C.navyM} radius={[0,3,3,0]} barSize={18}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
        <Card title="프로젝트별 상세 계약 이력">
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>
                {["프로젝트명","부서","연도","계약금(원)","억원","평당단가","비고"].map((h,i)=><th key={h} style={S.th(i>=3&&i<=5?"right":"left")}>{h}</th>)}
              </tr></thead>
              <tbody>
                {selVendor.projects.map((p,i)=>(
                  <tr key={i} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                    <td style={{...S.td("left"),maxWidth:200,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={p.pname}>{p.pname}</td>
                    <td style={{...S.td("left"),fontSize:11}}>{p.dept}</td>
                    <td style={S.td("center")}>{p.year}</td>
                    <td style={S.td("right")}>{fmtW(p.contract)}</td>
                    <td style={{...S.td("right"),fontWeight:500}}>{fmtE(p.contract/1e8)}</td>
                    <td style={{...S.td("right"),fontSize:11,color:C.navyM}}>{p.pyFloor?fmtPy(p.pyFloor):"-"}</td>
                    <td style={{...S.td("left"),fontSize:11,color:"var(--color-text-secondary,#888)"}}>{p.note||"-"}</td>
                  </tr>
                ))}
                <tr style={{background:"var(--color-background-secondary,#f5f5f3)",fontWeight:600}}>
                  <td style={S.td("left")}>합계</td>
                  <td colSpan={3}/>
                  <td style={{...S.td("right"),color:C.navyM}}>{fmtE(totalContract/1e8)}</td>
                  <td colSpan={2}/>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        {selVendor.projects.some(p=>p.pyFloor)&&(
          <Card title="평당단가 비교" note="공종별 단가 벤치마킹">
            <div style={S.grid(3,10)}>
              {selVendor.projects.filter(p=>p.pyFloor).map((p,i)=>(
                <div key={i} style={S.kpi()}>
                  <div style={{fontSize:10,color:C.gray,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.pname.slice(0,16)}</div>
                  <div style={{fontSize:16,fontWeight:500,color:C.navyM}}>{fmtPy(p.pyFloor)}</div>
                  <div style={{fontSize:10,color:C.gray,marginTop:2}}>{p.year}년 · {p.dept}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <input value={vendorSearch} onChange={e=>setVendorSearch(e.target.value)}
          placeholder="업체명·분야 검색…" style={{...S.inp(),width:200}}/>
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ddd)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
          <option value="">전체 분야</option>
          {cats.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{fontSize:11,color:C.gray}}>{catFiltered.length}개 업체</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10,marginBottom:14}}>
        {catFiltered.map(v=>{
          const total=v.projects.reduce((s,p)=>s+p.contract,0)
          return (
            <div key={v.id} onClick={()=>setSelVendor(v)} style={{...S.card({cursor:"pointer",transition:"box-shadow .15s",marginBottom:0}),padding:"12px 14px"}}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 2px 12px rgba(24,95,165,.15)`;e.currentTarget.style.borderColor=C.navyM}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="";e.currentTarget.style.borderColor="var(--color-border-tertiary,#e0e0e0)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <span style={S.badge(v.area==="해외"?C.navyL:C.greenL,v.area==="해외"?C.navy:C.green)}>{v.area}</span>
                <span style={{fontSize:11,color:C.gray}}>{v.projects.length}건</span>
              </div>
              <div style={{fontSize:13,fontWeight:500,marginBottom:3,lineHeight:1.3}}>{v.name}</div>
              <div style={{fontSize:11,color:C.gray,marginBottom:6}}>{v.cat}</div>
              <div style={{fontSize:14,fontWeight:500,color:C.navyM}}>{fmtE(total/1e8)}</div>
              <div style={{fontSize:10,color:C.gray,marginTop:2}}>총 계약금</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 연도비교 탭
// ════════════════════════════════════════════════════════════
function CompareTab({years,setYears,showAddYear,setShowAddYear}) {
  const [metric,setMetric]=useState("both")
  const [newYear,setNewYear]=useState({yr:"",목표수주:0,실행수주:0,목표매출:0,실행매출:0,인원:0})

  const barData=years.map(d=>({name:d.yr,수주목표:d.목표수주,수주실행:d.실행수주,매출목표:d.목표매출,매출실행:d.실행매출}))

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <select value={metric} onChange={e=>setMetric(e.target.value)} style={{padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ddd)",borderRadius:8,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
          <option value="both">수주+매출</option>
          <option value="contract">수주</option>
          <option value="revenue">매출</option>
        </select>
        <button onClick={()=>setShowAddYear(true)} style={S.btn(C.green)}>+ 연도 데이터 추가</button>
        <span style={{fontSize:11,color:C.gray}}>데이터 추가 시 자동 확장</span>
      </div>
      <Card title="연도별 수주·매출 현황" note="VAT별도(수주)·VAT포함(매출) 억원">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} margin={{top:4,right:10,left:-10,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
            <XAxis dataKey="name" tick={{fontSize:11}}/>
            <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
            <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억`,n]}/>
            {(metric==="both"||metric==="contract")&&<><Bar dataKey="수주목표" fill="rgba(136,135,128,.25)" stroke={C.gray} strokeWidth={0.5} radius={[2,2,0,0]} barSize={14}/><Bar dataKey="수주실행" fill={C.navyM} radius={[2,2,0,0]} barSize={14}/></>}
            {(metric==="both"||metric==="revenue")&&<><Bar dataKey="매출목표" fill="rgba(186,117,23,.2)" stroke={C.amber} strokeWidth={0.5} radius={[2,2,0,0]} barSize={14}/><Bar dataKey="매출실행" fill={C.amber} radius={[2,2,0,0]} barSize={14}/></>}
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="연도별 수주·매출·인당 생산성 비교">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              {["연도","수주목표","수주실행","달성률","매출목표","매출실행","달성률","인원","인당수주","인당매출"].map((h,i)=><th key={h} style={S.th(i>0?"right":"left")}>{h}</th>)}
            </tr></thead>
            <tbody>
              {years.map((d,i)=>{
                const cr=d.목표수주>0?(d.실행수주/d.목표수주*100).toFixed(1):"-"
                const rr=d.목표매출>0?(d.실행매출/d.목표매출*100).toFixed(1):"-"
                const badge=(v)=>({bg:+v>=80?C.greenL:+v>=50?C.amberL:C.redL,color:+v>=80?"#27500A":+v>=50?"#633806":C.red})
                return <tr key={d.yr} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={{...S.td("left"),fontWeight:600}}>{d.yr}{d.yr==="2026"&&<span style={{...S.badge(C.navyL,C.navyM),marginLeft:4,fontSize:9}}>5월누계</span>}</td>
                  <td style={S.td("right")}>{d.목표수주.toFixed(1)}</td>
                  <td style={S.td("right")}>{d.실행수주.toFixed(2)}</td>
                  <td style={S.td("right")}>{cr!=="-"?<span style={S.badge(badge(cr).bg,badge(cr).color)}>{cr}%</span>:"-"}</td>
                  <td style={S.td("right")}>{d.목표매출.toFixed(1)}</td>
                  <td style={S.td("right")}>{d.실행매출.toFixed(2)}</td>
                  <td style={S.td("right")}>{rr!=="-"?<span style={S.badge(badge(rr).bg,badge(rr).color)}>{rr}%</span>:"-"}</td>
                  <td style={S.td("right")}>{d.인원.toFixed(1)}</td>
                  <td style={{...S.td("right"),color:C.navyM,fontWeight:500}}>{(d.실행수주/d.인원).toFixed(2)}</td>
                  <td style={{...S.td("right"),color:C.amber,fontWeight:500}}>{(d.실행매출/d.인원).toFixed(2)}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {showAddYear&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
          <div style={{...S.card(),width:380,maxWidth:"95vw"}}>
            <div style={{fontSize:14,fontWeight:500,marginBottom:14}}>연도 데이터 추가</div>
            {[["yr","연도(예:2027)","text"],["목표수주","수주목표(억원)","number"],["실행수주","수주실행(억원)","number"],["목표매출","매출목표(억원)","number"],["실행매출","매출실행(억원)","number"],["인원","연평균 인원(명)","number"]].map(([k,l,t])=>(
              <div key={k} style={{marginBottom:10}}>
                <label style={S.lbl()}>{l}</label>
                <input type={t} value={newYear[k]} onChange={e=>setNewYear(p=>({...p,[k]:t==="number"?parseFloat(e.target.value)||0:e.target.value}))} style={S.inp()}/>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <button onClick={()=>{if(newYear.yr){setYears(prev=>[...prev,{...newYear}]);setShowAddYear(false);setNewYear({yr:"",목표수주:0,실행수주:0,목표매출:0,실행매출:0,인원:0})}}} style={S.btn(C.navyM)}>추가</button>
              <button onClick={()=>setShowAddYear(false)} style={S.btn(C.gray)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 인당생산성 탭
// ════════════════════════════════════════════════════════════
function ProductivityTab({years}) {
  const deptData=[
    {dept:"설계1(해외)",인원:10.5,수주:20.62,매출:11.38,인건비:4.21},
    {dept:"설계2",인원:17.83,수주:2.51,매출:14.99,인건비:5.22},
    {dept:"디자인",인원:14.17,수주:28.04,매출:0,인건비:4.08},
    {dept:"주거디자인",인원:7.58,수주:45.56,매출:0.11,인건비:3.89},
  ]
  const lineData=years.map(d=>({name:d.yr,인당수주:+(d.실행수주/d.인원).toFixed(2),인당매출:+(d.실행매출/d.인원).toFixed(2)}))
  return (
    <div>
      <div style={S.grid(6)}>
        {[["전사 연평균인원","61.75명","","#185FA5"],["인당 계약+확정","1.57억","96.72÷61.75",C.green],["인당 매출(누계)","0.48억","29.61÷61.75",C.amber],["인당 매출(목표)","2.35억","145÷61.75",C.amber],["인건비 비율","58.8%","인건비÷매출",C.red],["외주비 비율","82.1%","외주비÷매출",C.red]].map(([l,v,s,c])=>(
          <div key={l} style={S.kpi()}><div style={{fontSize:10,color:C.gray,marginBottom:4}}>{l}</div><div style={{fontSize:17,fontWeight:500,color:c}}>{v}</div>{s&&<div style={{fontSize:10,color:C.gray,marginTop:2}}>{s}</div>}</div>
        ))}
      </div>
      <div style={S.grid(2,12)}>
        <Card title="본부별 인당 수주·매출" note="억원/인">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptData} margin={{top:4,right:6,left:-10,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
              <XAxis dataKey="dept" tick={{fontSize:10}}/>
              <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
              <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}억/인`,n]}/>
              <Bar dataKey="인당수주" fill={C.navyM} radius={[2,2,0,0]} barSize={18} name="인당수주"
                data={deptData.map(d=>({...d,인당수주:+(d.수주/d.인원).toFixed(2)}))}/>
              <Bar dataKey="인당매출" fill={C.amber} radius={[2,2,0,0]} barSize={18} name="인당매출"
                data={deptData.map(d=>({...d,인당매출:+(d.매출/d.인원).toFixed(2)}))}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="연도별 인당 생산성 추이" note="억원/인">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData} margin={{top:4,right:10,left:-10,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)"/>
              <XAxis dataKey="name" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:9}} tickFormatter={v=>v+"억"}/>
              <Tooltip formatter={(v,n)=>[`${v}억/인`,n]}/>
              <Line type="monotone" dataKey="인당수주" stroke={C.navyM} strokeWidth={2} dot={{r:4,fill:C.navyM}}/>
              <Line type="monotone" dataKey="인당매출" stroke={C.amber} strokeWidth={2} dot={{r:4,fill:C.amber}} strokeDasharray="5 3"/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="본부별 인당 생산성 상세">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              {["본부","인원","계약+확정","인당수주","현누계매출","인당매출","인건비소계","인당인건비"].map((h,i)=><th key={h} style={S.th(i>0?"right":"left")}>{h}</th>)}
            </tr></thead>
            <tbody>
              {deptData.map((d,i)=>(
                <tr key={d.dept} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={S.td("left")}>{d.dept}</td>
                  <td style={S.td("right")}>{d.인원.toFixed(1)}</td>
                  <td style={S.td("right")}>{d.수주.toFixed(2)}</td>
                  <td style={{...S.td("right"),color:C.green,fontWeight:500}}>{(d.수주/d.인원).toFixed(2)}</td>
                  <td style={S.td("right")}>{d.매출.toFixed(2)}</td>
                  <td style={S.td("right")}>{(d.매출/d.인원).toFixed(2)}</td>
                  <td style={S.td("right")}>{d.인건비.toFixed(2)}</td>
                  <td style={{...S.td("right"),color:C.navyM}}>{(d.인건비/d.인원).toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{background:"var(--color-background-secondary,#f5f5f3)",fontWeight:600}}>
                <td style={S.td("left")}>전사 합계</td>
                <td style={S.td("right")}>61.75</td>
                <td style={S.td("right")}>96.72</td>
                <td style={{...S.td("right"),color:C.green,fontWeight:700}}>1.57</td>
                <td style={S.td("right")}>29.61</td>
                <td style={S.td("right")}>0.48</td>
                <td style={S.td("right")}>17.40</td>
                <td style={{...S.td("right"),color:C.navyM,fontWeight:700}}>0.28</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── 공통 컴포넌트 ────────────────────────────────────────────
function Card({title,note,children,style={}}) {
  return (
    <div style={{...S.card(),...style}}>
      {title&&<div style={{fontSize:13,fontWeight:500,marginBottom:11,display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,flexWrap:"wrap"}}>
        <span>{title}</span>
        {note&&<span style={{fontSize:10,color:"var(--color-text-tertiary,#aaa)",fontWeight:400}}>{note}</span>}
      </div>}
      {children}
    </div>
  )
}
