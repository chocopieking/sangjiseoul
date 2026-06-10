import { useState, useMemo, useRef, useEffect } from "react"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from "recharts"

// ── 색상 ─────────────────────────────────────────────────────
const C = {
  navy:"#0C447C", navyM:"#185FA5", navyL:"#E6F1FB",
  green:"#1D9E75", greenL:"#EAF3DE",
  amber:"#BA7517", amberL:"#FAEEDA",
  red:"#A32D2D", redL:"#FCEBEB",
  gray:"#888780", grayL:"#F1EFE8", white:"#FFFFFF"
}
const CHART_COLORS = ["#185FA5","#1D9E75","#BA7517","#A32D2D","#639922","#534AB7","#888780"]

// ── 숫자 포맷 ────────────────────────────────────────────────
const fmtW  = n => n ? `${Math.round(n).toLocaleString("ko-KR")}원` : "-"
const fmtE  = n => n ? `${(n/1e8).toFixed(2)}억` : "-"
const fmtP  = n => n ? `${(n*100).toFixed(1)}%` : "0.0%"
const fmtPy = n => n ? `${Math.round(n).toLocaleString()}원/평` : "-"

// ── VAT 계산 ─────────────────────────────────────────────────
const calcVAT = (base, type, ratio=1.0) => {
  if (type==="tax_exempt") return {base, vat:0, total:base}
  if (type==="national_housing") {
    const taxable=base*ratio, exempt=base*(1-ratio), vat=taxable*0.1
    return {base, vat, total:base+vat, taxable, exempt}
  }
  const vat=base*0.1
  return {base, vat, total:base+vat}
}

const VAT_LABEL = {
  general:"일반과세 (VAT 10%)",
  national_housing:"국민주택 (과세/면세 혼합)",
  tax_exempt:"면세"
}
const VAT_BADGE = {
  general:{bg:"#E6F1FB", color:"#0C447C", label:"일반과세"},
  national_housing:{bg:"#FAEEDA", color:"#633806", label:"국민주택"},
  tax_exempt:{bg:"#EAF3DE", color:"#27500A", label:"면세"}
}

// ── 초기 프로젝트 데이터 ─────────────────────────────────────
const INIT = [
  {
    id:"P001", code:"E22021-FSM-D",
    name:"우즈베키스탄 제약클러스터 건립사업 1차",
    dept:"해외사업부", pm:"김한준", client:"우즈베키스탄 제약청",
    vatType:"tax_exempt", taxRatio:1.0,
    siteArea:85000, floorArea:42000, pyFloor:12700,
    baseContract:3275892545,
    versions:[
      { v:"v1.0 최초", date:"2024-01-09", reason:"최초 작성",
        laborCost:258986626, directExp:403922538, subContract:1528781038,
        indirect:null, profit:null,
        vendors:[
          {cat:"구조",    name:"㈜센구조연구소",      contract:19008000,  paid:19008000,  pct:100},
          {cat:"기계",    name:"㈜우원엠앤이",        contract:10890000,  paid:10890000,  pct:100},
          {cat:"전기통신",name:"㈜예다종합설계",       contract:17820000,  paid:17820000,  pct:100},
          {cat:"CG",      name:"레드스톤",            contract:6000000,   paid:6000000,   pct:100},
          {cat:"현지조사",name:"㈜케이메디컬컨설팅",  contract:558481038, paid:558481038, pct:100},
          {cat:"해외코디",name:"Hplus건축사사무소",    contract:580800000, paid:580800000, pct:100},
          {cat:"해외협력",name:"H-ARHITECT",          contract:132000000, paid:132000000, pct:100},
          {cat:"인테리어",name:"바루다건축사사무소",   contract:24750000,  paid:24750000,  pct:100},
          {cat:"키스탭",  name:"무영CM",              contract:206800000, paid:41360000,  pct:20},
        ],
        milestones:[
          {stage:"선급금",          pct:34.21, received:true,  date:"2023-12-27"},
          {stage:"기본설계완료",    pct:8.60,  received:true,  date:"2024-05-13"},
          {stage:"실시설계완료",    pct:8.60,  received:true,  date:"2025-02-03"},
          {stage:"입찰지원",        pct:8.60,  received:false, date:""},
          {stage:"감리중",          pct:30.00, received:false, date:""},
          {stage:"준공",            pct:10.00, received:false, date:""},
        ]
      },
      { v:"v6.0 5차변경", date:"2025-11-18", reason:"감리인건비 재산정·Marva신규",
        laborCost:139253515, directExp:717039290, subContract:1994348995,
        indirect:153178867, profit:272071878,
        vendors:[
          {cat:"구조",      name:"㈜센구조연구소",     contract:19008000,  paid:19008000,  pct:100},
          {cat:"기계",      name:"㈜우원엠앤이",       contract:10890000,  paid:10890000,  pct:100},
          {cat:"전기통신",  name:"㈜예다종합설계",     contract:17820000,  paid:17820000,  pct:100},
          {cat:"현지조사",  name:"㈜케이메디컬컨설팅", contract:558481038, paid:558481038, pct:100},
          {cat:"해외코디",  name:"Hplus건축사사무소",  contract:580800000, paid:580800000, pct:100},
          {cat:"해외협력",  name:"H-ARHITECT",         contract:132000000, paid:132000000, pct:100},
          {cat:"인테리어",  name:"바루다건축사사무소",  contract:24750000,  paid:24750000,  pct:100},
          {cat:"감리(기술)",name:"General Project Expert",contract:182927245,paid:56379412,pct:30.82},
          {cat:"감리(저작권)",name:"H-ARHITECT",       contract:42568934,  paid:42568934,  pct:100},
          {cat:"감리(신규)", name:"Marva",             contract:89180218,  paid:44642746,  pct:50.06},
          {cat:"PE회계",    name:"원진회계법인",       contract:67180960,  paid:15478197,  pct:23.04},
        ],
        milestones:[
          {stage:"선급금",       pct:34.21, received:true,  date:"2023-12-27"},
          {stage:"기본설계완료", pct:8.60,  received:true,  date:"2024-05-13"},
          {stage:"실시설계완료", pct:8.60,  received:true,  date:"2025-02-03"},
          {stage:"입찰지원",     pct:8.60,  received:false, date:""},
          {stage:"감리중",       pct:30.00, received:false, date:""},
          {stage:"준공",         pct:10.00, received:false, date:""},
        ]
      }
    ]
  },
  {
    id:"P002", code:"E26004-VDH-W",
    name:"평택고덕 패키지형 실시설계 (A68BL·Aab13BL)",
    dept:"설계2본부", pm:"김동헌", client:"계룡건설 컨소시엄",
    vatType:"general", taxRatio:1.0,
    siteArea:89837, floorArea:226541, pyFloor:68529,
    baseContract:801000000,
    versions:[
      { v:"v1.0 최초", date:"2026-01-20", reason:"최초 작성",
        laborCost:139201245, directExp:36738100, subContract:390211654,
        indirect:153121373, profit:79727729,
        vendors:[
          {cat:"구조",     name:"씨에이치구조㈜",   contract:34736956, paid:0, pct:0},
          {cat:"토목",     name:"대신종합이엔지㈜",  contract:33552742, paid:0, pct:0},
          {cat:"조경",     name:"에이치에이㈜",      contract:37500123, paid:0, pct:0},
          {cat:"기계",     name:"삼신설계㈜",        contract:24868503, paid:0, pct:0},
          {cat:"전기통신", name:"나라기술단㈜",      contract:31973789, paid:0, pct:0},
          {cat:"건축외주", name:"청우종합건축사㈜",  contract:54059125, paid:0, pct:0},
          {cat:"친환경",   name:"건원엔지니어링",    contract:43090909, paid:0, pct:0},
          {cat:"교통",     name:"한길알앤디㈜",      contract:31090909, paid:0, pct:0},
          {cat:"토탈디자인",name:"건원엔지니어링",   contract:38363636, paid:0, pct:0},
          {cat:"지반조사", name:"대신종합이엔지㈜",  contract:8909091,  paid:0, pct:0},
        ],
        milestones:[
          {stage:"계약시+심의완료", pct:20, received:true,  date:"2026-01-12"},
          {stage:"사업승인완료",    pct:30, received:false, date:""},
          {stage:"실시설계납품",    pct:30, received:false, date:""},
          {stage:"준공",            pct:20, received:false, date:""},
        ]
      }
    ]
  },
  {
    id:"P003", code:"E26005-VSH-W",
    name:"평택고덕 패키지형 실시설계 (Aab18-1BL·Aa20-1BL)",
    dept:"설계2본부", pm:"김동헌", client:"계룡건설 컨소시엄",
    vatType:"general", taxRatio:1.0,
    siteArea:47728, floorArea:124712, pyFloor:37722,
    baseContract:439000000,
    versions:[
      { v:"v1.0 최초", date:"2026-01-20", reason:"최초 작성",
        laborCost:0, directExp:9560320, subContract:220084919,
        indirect:0, profit:209354761,
        vendors:[
          {cat:"구조",    name:"씨에이치구조㈜",   contract:18793986, paid:0, pct:0},
          {cat:"토목",    name:"대신종합이엔지㈜",  contract:13995521, paid:0, pct:0},
          {cat:"조경",    name:"에이치에이㈜",      contract:21992962, paid:0, pct:0},
          {cat:"기계",    name:"삼신설계㈜",        contract:18793986, paid:0, pct:0},
          {cat:"전기통신",name:"나라기술단㈜",      contract:16794626, paid:0, pct:0},
          {cat:"친환경",  name:"건원엔지니어링",    contract:22909091, paid:0, pct:0},
          {cat:"교통",    name:"한길알앤디㈜",      contract:21090909, paid:0, pct:0},
          {cat:"풍동",    name:"티이솔류션",        contract:9090909,  paid:0, pct:0},
          {cat:"건축외주",name:"구조사건축연구소",  contract:29990403, paid:0, pct:0},
        ],
        milestones:[
          {stage:"계약시+사업승인", pct:40, received:false, date:""},
          {stage:"실시설계납품",    pct:40, received:false, date:""},
          {stage:"준공",            pct:20, received:false, date:""},
        ]
      }
    ]
  },
  {
    id:"P004", code:"E26-ECO3BL",
    name:"부산에코델타시티 3BL 민참 (비교분석용)",
    dept:"주거디자인본부", pm:"정진성", client:"부산도시공사",
    vatType:"national_housing", taxRatio:0.65,
    siteArea:32175, floorArea:70000, pyFloor:21183,
    baseContract:2500000000,
    versions:[
      { v:"v1.0 실행검토", date:"2026-01-01", reason:"협력업체 견적 비교",
        laborCost:0, directExp:0, subContract:1248500000,
        indirect:0, profit:0,
        vendors:[
          {cat:"구조",   name:"㈜보성이앤지그룹",          contract:68000000,  paid:0, pct:0},
          {cat:"기계",   name:"㈜디이테크설비컨설턴트",    contract:60000000,  paid:0, pct:0},
          {cat:"전기통신",name:"석우엔지니어링㈜",         contract:75000000,  paid:0, pct:0},
          {cat:"조경",   name:"조경사무소 루다",           contract:75000000,  paid:0, pct:0},
          {cat:"친환경", name:"㈜디이테크설비컨설턴트",    contract:90000000,  paid:0, pct:0},
          {cat:"인테리어",name:"㈜스튜디오 덴",            contract:85000000,  paid:0, pct:0},
          {cat:"BIM",    name:"㈜트윈빔",                  contract:100000000, paid:0, pct:0},
          {cat:"교통",   name:"㈜시케인엔지니어링",        contract:60000000,  paid:0, pct:0},
          {cat:"건축외주",name:"희우건축",                 contract:83000000,  paid:0, pct:0},
          {cat:"외부특화",name:"스키닉 경관연구소",        contract:60000000,  paid:0, pct:0},
          {cat:"견적",   name:"코토적산",                  contract:57000000,  paid:0, pct:0},
          {cat:"CG",     name:"51H",                       contract:25000000,  paid:0, pct:0},
        ],
        milestones:[
          {stage:"제안설계완료", pct:40, received:false, date:""},
          {stage:"실시설계완료", pct:40, received:false, date:""},
          {stage:"준공",         pct:20, received:false, date:""},
        ]
      }
    ]
  }
]

// ── 버전 계산 ─────────────────────────────────────────────────
const calcVer = (ver, proj) => {
  const base = proj.baseContract
  const labor = ver.laborCost||0
  const exp   = ver.directExp||0
  const sub   = ver.subContract||0
  const direct = labor+exp+sub
  const indirect = ver.indirect ?? Math.round(labor*1.1)
  const profit   = ver.profit   ?? Math.round(direct*0.083)
  const total    = direct+indirect+profit
  const subRatio = base>0 ? sub/base : 0
  const vatInfo  = calcVAT(base, proj.vatType, proj.taxRatio)
  const pyFloor  = proj.pyFloor>0 ? base/proj.pyFloor : 0
  const received = (ver.milestones||[]).filter(m=>m.received).reduce((s,m)=>s+m.pct/100,0)
  return {labor,exp,sub,direct,indirect,profit,total,base,subRatio,vatInfo,pyFloor,received}
}

// ── 스타일 헬퍼 ──────────────────────────────────────────────
const S = {
  card: {background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e0e0e0)", borderRadius:12, padding:"14px 16px", marginBottom:14},
  th:   (align="center") => ({padding:"7px 10px", fontWeight:500, fontSize:11, textAlign:align, whiteSpace:"nowrap", color:"#fff", background:C.navyM}),
  td:   (align="right")  => ({padding:"7px 10px", borderBottom:"0.5px solid var(--color-border-tertiary,#eee)", textAlign:align, fontSize:12}),
  btn:  (bg=C.navyM)     => ({padding:"7px 14px", background:bg, color:"#fff", border:"none", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", display:"flex", alignItems:"center", gap:4}),
  inp:  () => ({width:"100%", padding:"7px 9px", border:"1px solid var(--color-border-secondary,#ddd)", borderRadius:8, fontSize:12, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary,#333)", fontFamily:"inherit"}),
  lbl:  () => ({display:"block", fontSize:11, color:C.gray, fontWeight:500, marginBottom:3}),
  grid: (cols,gap=12) => ({display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap, marginBottom:gap}),
}

// ════════════════════════════════════════════════════════════
// 메인 앱
// ════════════════════════════════════════════════════════════
export default function App() {
  const [tab,      setTab]      = useState("dashboard")
  const [projects, setProjects] = useState(INIT)
  const [selId,    setSelId]    = useState("P001")
  const [selVerIdx,setSelVerIdx]= useState(0)
  const [chatOpen, setChatOpen] = useState(false)
  const [msgs,     setMsgs]     = useState([{role:"assistant",text:"안녕하세요! 프로젝트 수치 조회, 외주비 비율, 평당단가 등 무엇이든 질문하세요."}])
  const [chatInput,setChatInput]= useState("")
  const [chatLoading,setChatLoading]=useState(false)
  const [showAddProj,  setShowAddProj]  = useState(false)
  const [showAddVer,   setShowAddVer]   = useState(false)
  const chatRef = useRef(null)

  const selProj = useMemo(()=>projects.find(p=>p.id===selId)||projects[0],[projects,selId])
  const selVer  = useMemo(()=>selProj.versions[selVerIdx]||selProj.versions[0],[selProj,selVerIdx])
  const cv      = useMemo(()=>calcVer(selVer,selProj),[selVer,selProj])

  // 프로젝트 탭 바뀔 때 버전 인덱스 초기화
  const selectProj = (id) => { setSelId(id); setSelVerIdx(0) }

  // 챗봇
  const sendChat = async () => {
    if (!chatInput.trim()||chatLoading) return
    const q = chatInput.trim(); setChatInput(""); setChatLoading(true)
    setMsgs(p=>[...p,{role:"user",text:q}])
    const ctx = projects.map(p=>{
      const v=p.versions[p.versions.length-1]; const c=calcVer(v,p)
      return `[${p.code}] ${p.name}: 계약금 ${fmtE(p.baseContract)}, 외주비 ${fmtE(v.subContract)}(${fmtP(c.subRatio)}), 연면적 ${p.floorArea.toLocaleString()}㎡, 평당단가 ${fmtPy(c.pyFloor)}, VAT ${VAT_LABEL[p.vatType]}`
    }).join("\n")
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:800,
          system:`건축설계사무소 실행계획서 분석 챗봇.\n프로젝트 데이터:\n${ctx}\n금액은 억원 단위로 답변. VAT포함/별도 항상 명시. 2~3문장으로 간결하게.`,
          messages:[{role:"user",content:q}]
        })
      })
      const d=await res.json()
      const txt=d.content?.find(c=>c.type==="text")?.text||"다시 시도해 주세요."
      setMsgs(p=>[...p,{role:"assistant",text:txt}])
    } catch {
      setMsgs(p=>[...p,{role:"assistant",text:"연결 오류. 잠시 후 다시 시도해 주세요."}])
    }
    setChatLoading(false)
  }
  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight},[msgs])

  const TABS=[
    {id:"dashboard",label:"📊 대시보드"},
    {id:"execution", label:"📋 실행계획서"},
    {id:"vendors",   label:"🏢 외주비"},
    {id:"milestone", label:"💰 기성현황"},
    {id:"compare",   label:"🔍 비교분석"},
    {id:"vat",       label:"🧾 VAT 계산기"},
  ]

  return (
    <div style={{fontFamily:"var(--font-sans,'Apple SD Gothic Neo',sans-serif)",fontSize:13,background:"var(--color-background-tertiary,#f5f5f3)",minHeight:"100vh"}}>

      {/* 헤더 */}
      <div style={{background:C.navy,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,background:C.navyM,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📐</div>
          <div>
            <div style={{fontSize:15,fontWeight:600,color:"#fff"}}>상지서울 통합경영시스템</div>
            <div style={{fontSize:11,color:"#85B7EB"}}>실행계획서 · 외주비 · 기성 · 비교분석 · VAT</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowAddProj(true)} style={S.btn(C.navyM)}>+ 프로젝트 추가</button>
          <button onClick={()=>setChatOpen(o=>!o)} style={S.btn(C.green)}>💬 AI 도우미</button>
        </div>
      </div>

      {/* 탭 */}
      <div style={{background:"var(--color-background-primary,#fff)",borderBottom:"1px solid var(--color-border-tertiary,#e0e0e0)",display:"flex",overflowX:"auto",padding:"0 16px"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 16px",border:"none",background:"none",fontSize:12,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",color:tab===t.id?C.navyM:"var(--color-text-secondary,#888)",borderBottom:tab===t.id?`2px solid ${C.navyM}`:"2px solid transparent"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 프로젝트 선택 바 */}
      <div style={{background:"var(--color-background-secondary,#f8f8f6)",padding:"10px 20px",display:"flex",gap:8,overflowX:"auto",alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:C.gray,whiteSpace:"nowrap"}}>프로젝트:</span>
        {projects.map(p=>(
          <button key={p.id} onClick={()=>selectProj(p.id)} style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${selId===p.id?C.navyM:"var(--color-border-secondary,#ccc)"}`,background:selId===p.id?C.navyL:"var(--color-background-primary,#fff)",color:selId===p.id?C.navy:"var(--color-text-secondary,#666)",fontSize:11,fontWeight:selId===p.id?600:400,cursor:"pointer",whiteSpace:"nowrap"}}>
            {p.code}
            <span style={{marginLeft:4,padding:"1px 5px",borderRadius:8,fontSize:10,background:VAT_BADGE[p.vatType].bg,color:VAT_BADGE[p.vatType].color}}>{VAT_BADGE[p.vatType].label}</span>
          </button>
        ))}
      </div>

      {/* 본문 */}
      <div style={{padding:"16px 20px",maxWidth:1400,margin:"0 auto"}}>
        {tab==="dashboard"  && <DashTab  projects={projects} selProj={selProj} selVer={selVer} cv={cv} />}
        {tab==="execution"  && <ExecTab  selProj={selProj} selVer={selVer} selVerIdx={selVerIdx} setSelVerIdx={setSelVerIdx} cv={cv} onAddVer={()=>setShowAddVer(true)} />}
        {tab==="vendors"    && <VendTab  selProj={selProj} selVer={selVer} cv={cv} />}
        {tab==="milestone"  && <MileTab  selProj={selProj} selVer={selVer} setProjects={setProjects} />}
        {tab==="compare"    && <CmpTab   projects={projects} />}
        {tab==="vat"        && <VATTab />}
      </div>

      {/* 챗봇 */}
      {chatOpen&&(
        <div style={{position:"fixed",bottom:20,right:20,width:340,height:480,background:"var(--color-background-primary,#fff)",borderRadius:16,boxShadow:"0 8px 32px rgba(0,0,0,.18)",display:"flex",flexDirection:"column",zIndex:1000,border:"1px solid var(--color-border-secondary,#ddd)"}}>
          <div style={{padding:"12px 16px",background:C.navy,borderRadius:"16px 16px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:"#fff",fontWeight:600,fontSize:13}}>💬 AI 도우미</span>
            <button onClick={()=>setChatOpen(false)} style={{background:"none",border:"none",color:"#85B7EB",cursor:"pointer",fontSize:16}}>✕</button>
          </div>
          <div ref={chatRef} style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:8}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"82%",padding:"8px 12px",borderRadius:m.role==="user"?"12px 12px 0 12px":"12px 12px 12px 0",background:m.role==="user"?C.navyM:"var(--color-background-secondary,#f5f5f3)",color:m.role==="user"?"#fff":"var(--color-text-primary,#333)",fontSize:12,lineHeight:1.6}}>
                  {m.text}
                </div>
              </div>
            ))}
            {chatLoading&&<div style={{color:C.gray,fontSize:11,textAlign:"center"}}>답변 생성 중…</div>}
          </div>
          <div style={{padding:"8px 12px",borderTop:"1px solid var(--color-border-tertiary,#eee)",display:"flex",gap:6}}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} placeholder="예) 우즈벡 외주비 비율은?" style={{...S.inp(),flex:1,fontSize:12}} />
            <button onClick={sendChat} style={S.btn(C.navyM)}>전송</button>
          </div>
          <div style={{padding:"6px 12px 10px",display:"flex",gap:5,flexWrap:"wrap"}}>
            {["외주비 비율 요약","평당단가 비교","미수령 기성 조회"].map(q=>(
              <button key={q} onClick={()=>setChatInput(q)} style={{padding:"3px 8px",borderRadius:10,border:`1px solid ${C.navyM}`,background:C.navyL,color:C.navy,fontSize:10,cursor:"pointer"}}>{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* 모달 */}
      {showAddProj&&<AddProjModal onClose={()=>setShowAddProj(false)} onSave={p=>{setProjects(prev=>[...prev,{...p,id:`P${Date.now()}`}]);setShowAddProj(false)}} />}
      {showAddVer &&<AddVerModal  selProj={selProj} onClose={()=>setShowAddVer(false)}  onSave={v=>{setProjects(prev=>prev.map(p=>p.id===selProj.id?{...p,versions:[...p.versions,v]}:p));setSelVerIdx(selProj.versions.length);setShowAddVer(false)}} />}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 대시보드 탭
// ────────────────────────────────────────────────────────────
function DashTab({projects,selProj,selVer,cv}) {
  const latest = projects.map(p=>({...p,ver:p.versions[p.versions.length-1],c:calcVer(p.versions[p.versions.length-1],p)}))
  const totalC  = latest.reduce((s,p)=>s+p.baseContract,0)
  const totalS  = latest.reduce((s,p)=>s+(p.ver.subContract||0),0)
  const barData = latest.map(p=>({name:p.code.split("-").slice(0,2).join("-"),계약금:+(p.baseContract/1e8).toFixed(2),외주비:+(p.ver.subContract/1e8).toFixed(2)}))
  const pieData = [{name:"직접인건비",value:selVer.laborCost||0},{name:"직접경비",value:selVer.directExp||0},{name:"외주용역비",value:selVer.subContract||0},{name:"간접비",value:cv.indirect||0},{name:"이윤",value:cv.profit||0}].filter(d=>d.value>0)
  return (
    <div>
      <div style={S.grid(4)}>
        {[["전체 계약금",fmtE(totalC),"VAT별도",C.navyM],["전체 외주비",fmtE(totalS),`평균 ${fmtP(totalC>0?totalS/totalC:0)}`,C.amber],["평당단가(연면적)",fmtPy(cv.pyFloor),selProj.code,C.green],["기성 수령률",fmtP(cv.received),selProj.name.slice(0,14)+"…",C.red]].map(([l,v,s,c])=>(
          <div key={l} style={{background:"var(--color-background-secondary,#f8f8f6)",borderRadius:10,padding:"14px 16px",border:"0.5px solid var(--color-border-tertiary,#e8e8e4)"}}>
            <div style={{fontSize:11,color:C.gray,marginBottom:6}}>{l}</div>
            <div style={{fontSize:20,fontWeight:600,color:c,letterSpacing:-0.5}}>{v}</div>
            <div style={{fontSize:10,color:C.gray,marginTop:3}}>{s}</div>
          </div>
        ))}
      </div>
      <div style={S.grid(2)}>
        <Card title="프로젝트별 외주비 현황 (억원)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:10}} tickFormatter={v=>v+"억"}/><Tooltip formatter={(v,n)=>[v+"억",n]}/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="계약금" fill={C.navyL} stroke={C.navyM}/><Bar dataKey="외주비" fill={C.navyM}/></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title={`${selProj.code} 비용 구성`}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" nameKey="name" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>{pieData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fmtW(v)}/></PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="전체 프로젝트 요약">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>{["프로젝트코드","프로젝트명","PM","계약금","외주비","외주비율","평당단가","VAT","버전"].map(h=><th key={h} style={S.th()}>{h}</th>)}</tr></thead>
            <tbody>{latest.map((p,i)=>(
              <tr key={p.id} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                <td style={S.td("center")}><code style={{fontSize:10}}>{p.code}</code></td>
                <td style={S.td("left")}>{p.name.length>22?p.name.slice(0,22)+"…":p.name}</td>
                <td style={S.td("center")}>{p.pm}</td>
                <td style={S.td("right")}>{fmtE(p.baseContract)}</td>
                <td style={S.td("right")}>{fmtE(p.ver.subContract)}</td>
                <td style={S.td("center")}><span style={{padding:"2px 8px",borderRadius:8,fontSize:11,background:p.c.subRatio>0.5?C.redL:p.c.subRatio>0.35?C.amberL:C.greenL,color:p.c.subRatio>0.5?C.red:p.c.subRatio>0.35?C.amber:C.green}}>{fmtP(p.c.subRatio)}</span></td>
                <td style={S.td("right")}>{fmtPy(p.c.pyFloor)}</td>
                <td style={S.td("center")}><span style={{padding:"2px 7px",borderRadius:8,fontSize:10,background:VAT_BADGE[p.vatType].bg,color:VAT_BADGE[p.vatType].color}}>{VAT_BADGE[p.vatType].label}</span></td>
                <td style={S.td("center")}><span style={{fontSize:11,color:C.navyM}}>{p.versions[p.versions.length-1].v}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 실행계획서 탭
// ────────────────────────────────────────────────────────────
function ExecTab({selProj,selVer,selVerIdx,setSelVerIdx,cv,onAddVer}) {
  const base=selProj.baseContract
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:11,color:C.gray}}>버전:</span>
        {selProj.versions.map((v,i)=>(
          <button key={i} onClick={()=>setSelVerIdx(i)} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${selVerIdx===i?C.navyM:"var(--color-border-secondary,#ccc)"}`,background:selVerIdx===i?C.navyL:"var(--color-background-primary,#fff)",color:selVerIdx===i?C.navy:"var(--color-text-secondary,#666)",fontSize:11,cursor:"pointer"}}>
            {v.v} <span style={{fontSize:10,color:C.gray}}>({v.date})</span>
          </button>
        ))}
        <button onClick={onAddVer} style={S.btn(C.green)}>+ 버전 추가</button>
      </div>

      <Card title={`📋 실행계획서 — ${selProj.name}`}>
        <div style={S.grid(4,10)}>
          {[["코드",selProj.code],["부서",selProj.dept],["PM",selProj.pm],["발주처",selProj.client],["연면적",`${selProj.floorArea.toLocaleString()}㎡`],["VAT유형",VAT_LABEL[selProj.vatType]],["작성일",selVer.date],["변경사유",selVer.reason]].map(([k,v])=>(
            <div key={k} style={{padding:"7px 0",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",fontSize:12,display:"flex",justifyContent:"space-between"}}>
              <span style={{color:C.gray,fontWeight:500}}>{k}</span>
              <span style={{fontWeight:400}}>{v}</span>
            </div>
          ))}
        </div>
      </Card>

      <div style={S.grid(2)}>
        <Card title="비용 구성 상세">
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"var(--color-background-secondary,#f8f8f6)"}}><th style={{...S.th("left"),background:"transparent",color:C.gray}}>항목</th><th style={{...S.th(),background:"transparent",color:C.gray}}>금액(원)</th><th style={{...S.th(),background:"transparent",color:C.gray}}>억원</th><th style={{...S.th(),background:"transparent",color:C.gray}}>비율</th></tr></thead>
            <tbody>
              {[{l:"직접인건비",v:cv.labor},{l:"직접경비",v:cv.exp},{l:"외주용역비",v:cv.sub},{l:"직접비 소계",v:cv.direct,bold:true,bg:C.navyL},{l:"간접비",v:cv.indirect},{l:"이윤",v:cv.profit},{l:"예상용역금액 합계",v:cv.total,bold:true,bg:C.navyL}].map((row,i)=>(
                <tr key={i} style={{background:row.bg||(i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)")}}>
                  <td style={{...S.td("left"),fontWeight:row.bold?700:400,color:row.bold?C.navy:undefined}}>{row.l}</td>
                  <td style={{...S.td("right"),fontWeight:row.bold?700:400}}>{fmtW(row.v)}</td>
                  <td style={{...S.td("right"),fontWeight:row.bold?700:400}}>{fmtE(row.v)}</td>
                  <td style={S.td("center")}>{base>0?fmtP(row.v/base):"-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="평당단가 · VAT 분석">
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[["계약금액(VAT별도)",fmtW(base),true],["연면적 기준 평당단가",fmtPy(cv.pyFloor),true],["외주비 평당단가",selProj.pyFloor>0?fmtPy(cv.sub/selProj.pyFloor):"-",false],["VAT유형",VAT_LABEL[selProj.vatType],false],["공급가액(VAT별도)",fmtW(cv.vatInfo.base),false],["부가가치세",fmtW(cv.vatInfo.vat),cv.vatInfo.vat>0],["합계(VAT포함)",fmtW(cv.vatInfo.total),true]].map(([k,v,hi])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",fontSize:12}}>
                <span style={{color:C.gray,fontWeight:500}}>{k}</span>
                <span style={{fontWeight:hi?700:400,color:hi?C.navy:undefined}}>{v}</span>
              </div>
            ))}
            {selProj.vatType==="national_housing"&&cv.vatInfo.taxable!==undefined&&(
              <>
                <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:12,borderBottom:"0.5px solid var(--color-border-tertiary,#eee)"}}>
                  <span style={{color:C.gray,fontWeight:500}}>  └ 과세분</span><span>{fmtW(cv.vatInfo.taxable)}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:12}}>
                  <span style={{color:C.gray,fontWeight:500}}>  └ 면세분</span><span>{fmtW(cv.vatInfo.exempt)}</span>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {selProj.versions.length>1&&(
        <Card title="버전별 변경 이력 비교">
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:C.navyM}}><th style={S.th("left")}>항목</th>{selProj.versions.map(v=><th key={v.v} style={S.th()}>{v.v}</th>)}</tr></thead>
              <tbody>
                {[{l:"작성일",key:"date"},{l:"변경사유",key:"reason"},{l:"외주용역비",key:"subContract",fmt:fmtE},{l:"외주비율",key:"subContract",fmt:v=>base>0?fmtP(v/base):"-"},{l:"직접인건비",key:"laborCost",fmt:fmtE},{l:"직접경비",key:"directExp",fmt:fmtE}].map((row,i)=>(
                  <tr key={i} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                    <td style={{...S.td("left"),fontWeight:500}}>{row.l}</td>
                    {selProj.versions.map((v,j)=>{
                      const raw=v[row.key]; const val=row.fmt?row.fmt(raw):raw
                      const prev=j>0&&row.fmt?row.fmt(selProj.versions[j-1][row.key]):null
                      const changed=prev!==null&&val!==prev&&row.key!=="date"&&row.key!=="reason"
                      return <td key={j} style={{...S.td("right"),color:changed?C.amber:undefined,fontWeight:j===selVerIdx?700:400}}>{val}{changed?" ▲":""}</td>
                    })}
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

// ────────────────────────────────────────────────────────────
// 외주비 관리 탭
// ────────────────────────────────────────────────────────────
function VendTab({selProj,selVer,cv}) {
  const vendors=selVer.vendors||[]
  const totC=vendors.reduce((s,v)=>s+v.contract,0)
  const totP=vendors.reduce((s,v)=>s+v.paid,0)
  const catData=Object.entries(vendors.reduce((a,v)=>{if(!a[v.cat])a[v.cat]={c:0,p:0};a[v.cat].c+=v.contract;a[v.cat].p+=v.paid;return a},{})).map(([n,d])=>({name:n,계약:+(d.c/1e6).toFixed(0),기지급:+(d.p/1e6).toFixed(0)}))
  return (
    <div>
      <div style={S.grid(3)}>
        {[["총계약",fmtE(totC),`계약금 대비 ${fmtP(totC/selProj.baseContract)}`,C.navyM],["기지급",fmtE(totP),`지급률 ${fmtP(totC>0?totP/totC:0)}`,C.green],["미지급",fmtE(totC-totP),"청구 예정",C.amber]].map(([l,v,s,c])=>(
          <div key={l} style={{background:"var(--color-background-secondary,#f8f8f6)",borderRadius:10,padding:"14px 16px",border:"0.5px solid var(--color-border-tertiary,#e8e8e4)"}}>
            <div style={{fontSize:11,color:C.gray,marginBottom:6}}>{l}</div>
            <div style={{fontSize:20,fontWeight:600,color:c}}>{v}</div>
            <div style={{fontSize:10,color:C.gray,marginTop:3}}>{s}</div>
          </div>
        ))}
      </div>
      <div style={S.grid(2)}>
        <Card title="공종별 외주비 (백만원)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={catData} layout="vertical" margin={{left:60,right:20}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee"/>
              <XAxis type="number" tick={{fontSize:10}} tickFormatter={v=>v+"M"}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={60}/>
              <Tooltip formatter={(v,n)=>[v+"백만원",n]}/>
              <Legend wrapperStyle={{fontSize:11}}/>
              <Bar dataKey="계약" fill={C.navyM}/><Bar dataKey="기지급" fill={C.green}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="지급 현황">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={[{name:"기지급",value:totP},{name:"미지급",value:totC-totP}]} cx="50%" cy="50%" outerRadius={85} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}><Cell fill={C.green}/><Cell fill={C.amberL}/></Pie><Tooltip formatter={v=>fmtW(v)}/></PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title={`외주비 상세 — ${selVer.v}`}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>{["공종","업체명","계약금","기지급","미지급","지급률","계약금 대비"].map(h=><th key={h} style={S.th()}>{h}</th>)}</tr></thead>
            <tbody>
              {vendors.map((v,i)=>(
                <tr key={i} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={S.td("center")}><span style={{padding:"2px 7px",borderRadius:8,background:C.navyL,color:C.navy,fontSize:10}}>{v.cat}</span></td>
                  <td style={S.td("left")}>{v.name}</td>
                  <td style={S.td("right")}>{fmtW(v.contract)}</td>
                  <td style={{...S.td("right"),color:C.green}}>{fmtW(v.paid)}</td>
                  <td style={{...S.td("right"),color:(v.contract-v.paid)>0?C.amber:C.gray}}>{fmtW(v.contract-v.paid)}</td>
                  <td style={S.td("center")}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:44,height:6,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:3}}><div style={{width:`${v.pct}%`,height:6,background:v.pct>=100?C.green:C.navyM,borderRadius:3}}/></div>
                      <span>{v.pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td style={S.td("center")}>{selProj.baseContract>0?fmtP(v.contract/selProj.baseContract):"-"}</td>
                </tr>
              ))}
              <tr style={{background:C.navyL,fontWeight:700}}>
                <td style={{...S.td("center"),color:C.navy}} colSpan={2}>합 계</td>
                <td style={{...S.td("right"),color:C.navy}}>{fmtW(totC)}</td>
                <td style={{...S.td("right"),color:C.green}}>{fmtW(totP)}</td>
                <td style={{...S.td("right"),color:C.amber}}>{fmtW(totC-totP)}</td>
                <td style={{...S.td("center"),color:C.navy}}>{totC>0?fmtP(totP/totC):"-"}</td>
                <td style={{...S.td("center"),color:C.navy}}>{selProj.baseContract>0?fmtP(totC/selProj.baseContract):"-"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 기성 현황 탭
// ────────────────────────────────────────────────────────────
function MileTab({selProj,selVer,setProjects}) {
  const ms=selVer.milestones||[]
  const totRcv=ms.filter(m=>m.received).reduce((s,m)=>s+m.pct,0)
  const base=selProj.baseContract
  const toggle=(vi,mi)=>setProjects(prev=>prev.map(p=>p.id===selProj.id?{...p,versions:p.versions.map((v,i)=>i===vi?{...v,milestones:v.milestones.map((m,j)=>j===mi?{...m,received:!m.received}:m)}:v)}:p))
  const verIdx=selProj.versions.indexOf(selVer)
  return (
    <div>
      <div style={S.grid(3)}>
        {[["총 계약금",fmtE(base),"VAT별도",C.navyM],["기수령률",`${totRcv.toFixed(1)}%`,fmtW(base*totRcv/100),C.green],["미수령",`${(100-totRcv).toFixed(1)}%`,fmtW(base*(100-totRcv)/100),C.amber]].map(([l,v,s,c])=>(
          <div key={l} style={{background:"var(--color-background-secondary,#f8f8f6)",borderRadius:10,padding:"14px 16px",border:"0.5px solid var(--color-border-tertiary,#e8e8e4)"}}>
            <div style={{fontSize:11,color:C.gray,marginBottom:6}}>{l}</div>
            <div style={{fontSize:20,fontWeight:600,color:c}}>{v}</div>
            <div style={{fontSize:10,color:C.gray,marginTop:3}}>{s}</div>
          </div>
        ))}
      </div>
      <Card title="기성 수령 현황">
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.gray,marginBottom:4}}><span>기수령 {totRcv.toFixed(1)}%</span><span>{fmtW(base*totRcv/100)} / {fmtW(base)}</span></div>
          <div style={{height:14,background:"var(--color-background-secondary,#f0f0ee)",borderRadius:7,overflow:"hidden"}}>
            <div style={{width:`${totRcv}%`,height:14,background:`linear-gradient(90deg,${C.green},${C.navyM})`,borderRadius:7,transition:"width .5s"}}/>
          </div>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:"var(--color-background-secondary,#f8f8f6)"}}>{["기성 단계","비율","금액(VAT별도)","수령일","상태",""].map(h=><th key={h} style={{...S.th(),background:"transparent",color:C.gray}}>{h}</th>)}</tr></thead>
          <tbody>
            {ms.map((m,i)=>(
              <tr key={i} style={{background:m.received?C.greenL:"var(--color-background-primary,#fff)"}}>
                <td style={S.td("left")}>{m.stage}</td>
                <td style={S.td("center")}>{m.pct.toFixed(2)}%</td>
                <td style={S.td("right")}>{fmtW(base*m.pct/100)}</td>
                <td style={S.td("center")}>{m.date||"-"}</td>
                <td style={S.td("center")}>{m.received?<span style={{padding:"2px 8px",borderRadius:8,background:C.greenL,color:C.green,fontSize:11}}>✅ 완료</span>:<span style={{padding:"2px 8px",borderRadius:8,background:C.amberL,color:C.amber,fontSize:11}}>⏳ 미수령</span>}</td>
                <td style={S.td("center")}><button onClick={()=>toggle(verIdx,i)} style={{padding:"3px 10px",borderRadius:6,border:`1px solid ${m.received?C.green:C.navyM}`,background:m.received?C.greenL:C.navyL,color:m.received?C.green:C.navyM,fontSize:11,cursor:"pointer"}}>{m.received?"취소":"수령"}</button></td>
              </tr>
            ))}
            <tr style={{background:C.navyL,fontWeight:700}}>
              <td style={{...S.td("left"),color:C.navy}}>합 계</td>
              <td style={{...S.td("center"),color:C.navy}}>100%</td>
              <td style={{...S.td("right"),color:C.navy}}>{fmtW(base)}</td>
              <td colSpan={3}/>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 비교분석 탭
// ────────────────────────────────────────────────────────────
function CmpTab({projects}) {
  const [sel,setSel]=useState(projects.slice(0,3).map(p=>p.id))
  const selP=projects.filter(p=>sel.includes(p.id)).map(p=>{
    const v=p.versions[p.versions.length-1]; const c=calcVer(v,p)
    return {name:p.code.split("-").slice(0,2).join("-"),fullName:p.name,subRatio:+(c.subRatio*100).toFixed(1),pyFloor:Math.round(c.pyFloor),contract:p.baseContract,subAmt:v.subContract,vatType:p.vatType,id:p.id}
  })
  return (
    <div>
      <Card title="비교 프로젝트 선택 (최대 4개)">
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {projects.map(p=>(
            <button key={p.id} onClick={()=>setSel(prev=>prev.includes(p.id)?prev.filter(id=>id!==p.id):prev.length<4?[...prev,p.id]:prev)} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${sel.includes(p.id)?C.navyM:"var(--color-border-secondary,#ccc)"}`,background:sel.includes(p.id)?C.navyL:"var(--color-background-primary,#fff)",color:sel.includes(p.id)?C.navy:"var(--color-text-secondary,#666)",fontSize:11,cursor:"pointer"}}>
              {p.code}
            </button>
          ))}
        </div>
      </Card>
      <div style={S.grid(2)}>
        <Card title="외주비율 비교 (%)">
          <ResponsiveContainer width="100%" height={200}><BarChart data={selP}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:10}} tickFormatter={v=>v+"%"}/><Tooltip formatter={(v,n)=>[v+"%",n]}/><Bar dataKey="subRatio" fill={C.navyM} name="외주비율" label={{position:"top",fontSize:10}}/></BarChart></ResponsiveContainer>
        </Card>
        <Card title="연면적 평당단가 비교 (원/평)">
          <ResponsiveContainer width="100%" height={200}><BarChart data={selP}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:10}} tickFormatter={v=>(v/1000).toFixed(0)+"k"}/><Tooltip formatter={v=>[fmtPy(v),"평당단가"]}/><Bar dataKey="pyFloor" fill={C.green} name="평당단가" label={{position:"top",fontSize:10,formatter:v=>(v/1000).toFixed(0)+"k"}}/></BarChart></ResponsiveContainer>
        </Card>
      </div>
      <Card title="수치 비교">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:C.navyM}}><th style={S.th("left")}>항목</th>{selP.map(p=><th key={p.id} style={S.th()}>{p.name}</th>)}</tr></thead>
            <tbody>
              {[{l:"계약금액",f:p=>fmtE(p.contract)},{l:"외주비 합계",f:p=>fmtE(p.subAmt)},{l:"외주비율",f:p=>fmtP(p.subRatio/100)},{l:"평당단가",f:p=>fmtPy(p.pyFloor)},{l:"VAT유형",f:p=>VAT_BADGE[p.vatType].label}].map((row,i)=>(
                <tr key={i} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={{...S.td("left"),fontWeight:500}}>{row.l}</td>
                  {selP.map(p=><td key={p.id} style={S.td("center")}>{row.f(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// VAT 계산기 탭
// ────────────────────────────────────────────────────────────
function VATTab() {
  const [base,setBase]=useState(1000000000)
  const [type,setType]=useState("general")
  const [ratio,setRatio]=useState(0.65)
  const [inp,setInp]=useState("1000000000")
  const res=calcVAT(base,type,ratio)
  const handle=v=>{setInp(v.replace(/[^0-9]/g,""));const n=parseInt(v.replace(/[^0-9]/g,""),10);if(!isNaN(n))setBase(n)}
  return (
    <div>
      <div style={S.grid(2,16)}>
        <Card title="🧾 VAT 계산기">
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><label style={S.lbl()}>용역비 (원, VAT별도)</label><input type="text" value={inp} onChange={e=>handle(e.target.value)} style={S.inp()} placeholder="예: 1000000000"/><div style={{fontSize:11,color:C.green,marginTop:3}}>= {fmtE(base)}</div></div>
            <div><label style={S.lbl()}>VAT 유형</label>
              <select value={type} onChange={e=>setType(e.target.value)} style={S.inp()}>
                <option value="general">일반과세 (VAT 10%)</option>
                <option value="national_housing">국민주택 (과세/면세 혼합)</option>
                <option value="tax_exempt">면세</option>
              </select>
            </div>
            {type==="national_housing"&&(
              <div><label style={S.lbl()}>과세 비율 (0~1 사이 숫자)</label><input type="number" min="0" max="1" step="0.01" value={ratio} onChange={e=>setRatio(parseFloat(e.target.value)||0)} style={S.inp()}/><div style={{fontSize:11,color:C.gray,marginTop:3}}>면세 비율: {((1-ratio)*100).toFixed(0)}% · 예) 과세 65% → 0.65 입력</div></div>
            )}
          </div>
        </Card>
        <Card title="계산 결과">
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[["공급가액(VAT별도)",fmtW(res.base),false],["부가가치세",fmtW(res.vat),res.vat>0],["합계(VAT포함)",fmtW(res.total),true],["합계(억원)",fmtE(res.total),true]].map(([k,v,hi])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",fontSize:12}}>
                <span style={{color:C.gray,fontWeight:500}}>{k}</span>
                <span style={{fontWeight:hi?700:400,color:hi?C.navy:undefined}}>{v}</span>
              </div>
            ))}
            {type==="national_housing"&&res.taxable!==undefined&&(
              <>
                <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:11,borderBottom:"0.5px solid var(--color-border-tertiary,#eee)"}}><span style={{color:C.gray}}>  └ 과세분</span><span>{fmtW(res.taxable)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:11}}><span style={{color:C.gray}}>  └ 면세분</span><span>{fmtW(res.exempt)}</span></div>
              </>
            )}
          </div>
        </Card>
      </div>
      <Card title="📌 국민주택 VAT 규정">
        <div style={{fontSize:12,color:"var(--color-text-secondary,#555)",lineHeight:1.9}}>
          <div>• <b>국민주택 규모</b>: 전용면적 85㎡ 이하 (수도권 외 읍·면은 100㎡ 이하)</div>
          <div>• <b>과세비율 계산</b>: 전용 85㎡ 초과 세대 면적 합 ÷ 전체 전용면적 합 × 100</div>
          <div>• <b>실무 예시</b>: 전체 100평 중 65평이 85㎡ 초과 → 과세비율 65% → 0.65 입력</div>
          <div style={{marginTop:8,padding:"8px 12px",background:C.amberL,borderRadius:8,color:C.amber}}>⚠ 정확한 비율은 도면의 세대별 전용면적 기준으로 산정하며, 세무사 확인을 권장합니다.</div>
        </div>
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 공통 컴포넌트
// ────────────────────────────────────────────────────────────
function Card({title,children}) {
  return (
    <div style={S.card}>
      {title&&<div style={{fontSize:13,fontWeight:600,color:"var(--color-text-primary,#333)",marginBottom:12}}>{title}</div>}
      {children}
    </div>
  )
}

function Modal({title,onClose,onSave,children}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:200,padding:20,overflowY:"auto"}}>
      <div style={{background:"var(--color-background-primary,#fff)",borderRadius:16,padding:22,width:"100%",maxWidth:520,marginTop:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:15,fontWeight:600}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.gray}}>✕</button>
        </div>
        {children}
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button onClick={onSave} style={S.btn(C.navyM)}>저장</button>
          <button onClick={onClose} style={{...S.btn(C.gray),background:"var(--color-background-secondary,#f5f5f3)"}}>취소</button>
        </div>
      </div>
    </div>
  )
}

function Field({label,val,onChange,type="text",full=false}) {
  return (
    <div style={full?{}:{}}>
      <label style={S.lbl()}>{label}</label>
      {type==="select"?
        <select value={val} onChange={e=>onChange(e.target.value)} style={S.inp()}>{(onChange.opts||[]).map(o=><option key={o}>{o}</option>)}</select>:
        <input type={type} value={val} onChange={e=>onChange(e.target.value)} style={S.inp()}/>
      }
    </div>
  )
}

function AddProjModal({onClose,onSave}) {
  const [f,setF]=useState({code:"",name:"",dept:"",pm:"",client:"",vatType:"general",taxRatio:1.0,siteArea:0,floorArea:0,baseContract:0})
  const u=(k,v)=>setF(p=>({...p,[k]:v}))
  const pyFloor=f.floorArea>0?Math.round(f.floorArea/3.30579):0
  return (
    <Modal title="새 프로젝트 추가" onClose={onClose} onSave={()=>onSave({...f,pyFloor,versions:[]})}>
      <div style={S.grid(2,10)}>
        {[["프로젝트 코드 *","code"],["프로젝트명 *","name"],["주관부서","dept"],["PM","pm"],["발주처","client"]].map(([l,k])=>(
          <div key={k}><label style={S.lbl()}>{l}</label><input type="text" value={f[k]} onChange={e=>u(k,e.target.value)} style={S.inp()}/></div>
        ))}
        <div><label style={S.lbl()}>VAT 유형</label>
          <select value={f.vatType} onChange={e=>u("vatType",e.target.value)} style={S.inp()}>
            <option value="general">일반과세</option><option value="national_housing">국민주택</option><option value="tax_exempt">면세</option>
          </select>
        </div>
        {f.vatType==="national_housing"&&<div><label style={S.lbl()}>과세비율 (0~1)</label><input type="number" min="0" max="1" step="0.01" value={f.taxRatio} onChange={e=>u("taxRatio",parseFloat(e.target.value)||0)} style={S.inp()}/></div>}
        {[["계약금액 (원, VAT별도)","baseContract","number"],["대지면적 (㎡)","siteArea","number"],["연면적 (㎡)","floorArea","number"]].map(([l,k,t])=>(
          <div key={k}><label style={S.lbl()}>{l}</label><input type={t} value={f[k]} onChange={e=>u(k,parseInt(e.target.value)||0)} style={S.inp()}/></div>
        ))}
      </div>
      {f.baseContract>0&&f.floorArea>0&&<div style={{marginTop:8,padding:"8px 12px",background:C.navyL,borderRadius:8,fontSize:11,color:C.navy}}>계산된 평당단가: {fmtPy(f.baseContract/pyFloor)}</div>}
    </Modal>
  )
}

function AddVerModal({selProj,onClose,onSave}) {
  const last=selProj.versions[selProj.versions.length-1]
  const [f,setF]=useState({v:`v${selProj.versions.length+1}.0 ${selProj.versions.length}차변경`,date:new Date().toISOString().slice(0,10),reason:"",laborCost:last.laborCost||0,directExp:last.directExp||0,subContract:last.subContract||0,indirect:null,profit:null,vendors:[...(last.vendors||[])],milestones:[...(last.milestones||[])]})
  const u=(k,v)=>setF(p=>({...p,[k]:v}))
  return (
    <Modal title="새 버전 추가" onClose={onClose} onSave={()=>onSave(f)}>
      <div style={S.grid(2,10)}>
        {[["버전명","v","text"],["작성일","date","date"],["변경 사유","reason","text"],["직접인건비 (원)","laborCost","number"],["직접경비 (원)","directExp","number"],["외주용역비 (원)","subContract","number"],["간접비 (비워두면 자동)","indirect","number"],["이윤 (비워두면 자동)","profit","number"]].map(([l,k,t])=>(
          <div key={k}><label style={S.lbl()}>{l}</label><input type={t} value={f[k]||""} onChange={e=>u(k,t==="number"?(parseInt(e.target.value)||null):e.target.value)} style={S.inp()}/></div>
        ))}
      </div>
      <div style={{marginTop:8,padding:"8px 12px",background:C.navyL,borderRadius:8,fontSize:11,color:C.navy}}>
        직접비 합계: {fmtE((f.laborCost||0)+(f.directExp||0)+(f.subContract||0))}
      </div>
    </Modal>
  )
}
