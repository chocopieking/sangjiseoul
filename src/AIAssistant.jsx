// ══════════════════════════════════════════════════════════════
// 🤖 AI 어시스턴트 + ⚡ 스마트 검색
// Google Gemini API(무료 티어) 연동 — 서버(api/chat.js)에서 실제 모델 호출
// 시스템 데이터를 컨텍스트로 주입하여 맞춤형 답변 생성
// ══════════════════════════════════════════════════════════════
import { useState, useRef, useEffect, useMemo } from "react"
import { calcPnlTotals, getDeptShares, fE, VENDOR_DOC_TYPES } from "./data.js"

// ── 서류함 전체 카테고리 라벨 (프로젝트서류 8종 + 신규 4종 + 업체등록서류 10종 + 문서보관소) ──
const DOC_LABELS = {
  contract:"계약서", perfBond:"계약이행보증서", liabilityCert:"손해배상공제증권",
  experienceCert:"실적증명서", buildingReg:"건축물대장", jvMou:"업무협약서",
  jvSettlement:"합사정산서", contractApproval:"계약체결보고서",
  execPlan:"실행계획서", vendorContract:"협력업체 계약서", billing:"기성청구서",
  vault:"문서보관소",
}
const VENDOR_REG_LABELS = Object.fromEntries(VENDOR_DOC_TYPES.map(t=>[t.key, t.label]))
const VAULT_CATS = ["연간계약서","협력업체계약서","공문(수신)","공문(발신)","회의록","기타"]

const C = {
  navyM:"#3B72F6", navyL:"#EEF3FF", navy:"#1A3B6E",
  green:"#0EA86E", greenL:"#E6F9F2",
  amber:"#F59E0B", amberL:"#FEF3C7",
  red:"#EF4444",   redL:"#FEE2E2",
  gray:"#6B7280",  grayL:"#F3F4F6",
  bg:"#F8FAFC",
}

// ── 시스템 데이터를 AI 컨텍스트로 직렬화 ──────────────────────
function buildContext(data) {
  const { projects=[], cashflow=[], years=[], vendorPayments=[], vendorsDB={} } = data

  // 프로젝트 요약
  const projSummary = projects.map(p => {
    const ver = p.versions?.[p.versions.length-1]
    const pnl = ver ? calcPnlTotals(ver) : null
    const cashTotal = (p.cashflowPlan||[]).reduce((s,e)=>s+(e.actual||0),0)
    const shares = getDeptShares(p).map(s=>`${s.dept}(${s.share}%)`).join(",")
    return `[${p.code}] ${p.name} | 발주처:${p.client||"-"} | 본부:${shares||"-"} | 용역비:${fE(p.serviceFee)}억 | 수주유형:${p.contractType||"-"} | 발주구분:${p.orderType||"민간"} | 진행:${p.prog||0}% | 회차:${ver?.round||"-"}차 | 입금누계:${cashTotal.toFixed(2)}억`
  }).join("\n")

  // 프로젝트별 첨부서류 현황 (계약서/보증서/실적증명서/건축물대장 등) — 문서 검색·다운로드 질의에 사용
  const docSummary = projects.map(p=>{
    const docs = (p.certDocs||[]).map(g=>{
      const vs = Array.isArray(g.versions)?g.versions:[]
      if(!vs.length) return null
      const latest = vs[vs.length-1]
      return `${DOC_LABELS[g.key]||g.key}(${latest.versionLabel||"최초"}${latest.endDate?","+latest.endDate+"만료":""})`
    }).filter(Boolean)
    if(!docs.length) return null
    return `[${p.code}] ${p.name} (발주구분:${p.orderType||"민간"}): ${docs.join(", ")}`
  }).filter(Boolean).join("\n")

  // 프로젝트별 실행계획서 회차 현황 — "실행계획서 찾아줘/다운받고 싶어" 질의에 사용
  const execPlanSummary = projects.map(p=>{
    const vs = p.versions||[]
    if(!vs.length) return null
    const rounds = vs.map(v=>`${v.round||"?"}차(${v.date||"날짜없음"}${v.pdfData?",PDF있음":",PDF없음"})`).join(", ")
    return `[${p.code}] ${p.name}: ${rounds}`
  }).filter(Boolean).join("\n")

  // 프로젝트별 협력업체 계약서 현황
  const vendorContractSummary = projects.map(p=>{
    const groups = (p.vendorDocs||[]).map(g=>{
      const vs = g.versions||[]
      if(!vs.length) return null
      const latest = vs[vs.length-1]
      return `${g.vendorName}(${latest.versionLabel||"최초"}${latest.fileData?",PDF있음":",PDF없음"})`
    }).filter(Boolean)
    if(!groups.length) return null
    return `[${p.code}] ${p.name}: ${groups.join(", ")}`
  }).filter(Boolean).join("\n")

  // 프로젝트별 기성청구서 발송내역
  const billingSummary = projects.map(p=>{
    const list = p.billingSubmissions||[]
    if(!list.length) return null
    const items = list.map(b=>`${b.stage||"?"}(${b.date||"날짜없음"}${b.fileData?",PDF있음":",PDF없음"})`).join(", ")
    return `[${p.code}] ${p.name}: ${items}`
  }).filter(Boolean).join("\n")

  // 협력업체별 등록서류 (사업자등록증/통장사본/면허증 등) 현황
  const vendorRegSummary = Object.entries(vendorsDB||{}).map(([name, info])=>{
    const docs = (info.certDocs||[]).map(g=>{
      const vs = Array.isArray(g.versions)?g.versions:[]
      if(!vs.length) return null
      const latest = vs[vs.length-1]
      return `${VENDOR_REG_LABELS[g.key]||g.key}(${latest.fileData?"PDF있음":"PDF없음"})`
    }).filter(Boolean)
    if(!docs.length) return null
    return `${name}: ${docs.join(", ")}`
  }).filter(Boolean).join("\n")

  // 문서보관소(공문/회의록/연간계약서 등) — 브라우저 로컬 저장소 기반
  let vaultSummary = ""
  try{
    const vaultDocs = JSON.parse(localStorage.getItem("sjs_archive_docs")||"[]")
    vaultSummary = vaultDocs.map(d=>`[${d.category||"기타"}] ${d.title||"(제목없음)"} (${(d.dateDoc||d.createdAt||"").slice(0,10)||"날짜없음"}${d.fileData?", PDF있음":""})`).join("\n")
  }catch{}

  // 프로젝트별 주요일정 기록(주간보고 > 주요일정) — "OOO프로젝트 주요일정/히스토리 알려줘" 질의에 사용
  const scheduleLogSummary = projects.map(p=>{
    const log = p.weeklyReport?.scheduleLog || []
    if(!log.length) return null
    const items = log.slice().sort((a,b)=>a.date.localeCompare(b.date))
      .map(e=>`${e.date} [${e.category}] ${e.content}${e.memo?"("+e.memo+")":""}`).join("\n  ")
    return `[${p.code}] ${p.name}:\n  ${items}`
  }).filter(Boolean).join("\n")
  const normName = s => (s||"").replace(/[\s\-_·.()【】\[\]]/g,"").toLowerCase()
  const vendorPaySummary = projects.map(p=>{
    const pNorm = normName(p.name)
    const items = []
    Object.values(vendorsDB||{}).forEach(v=>{
      ;(v.paymentHistory||[]).forEach(ph=>{
        if(normName(ph.project)===pNorm) items.push(ph)
      })
    })
    if(!items.length) return null
    const contract = items.reduce((s,i)=>s+(i.totalAmt||0),0)
    const paid = items.reduce((s,i)=>s+(i.paidSum||0),0)
    const remain = items.reduce((s,i)=>s+(i.remain||0),0)
    // 아직 지급 안 된(status:planned) 항목들의 예정일 중 가장 늦은 연도를 참고용으로 표기
    const plannedDates = items.flatMap(i=>(i.payments||[]).filter(x=>x.status==="planned"&&x.date).map(x=>x.date))
    const lastPlanned = plannedDates.sort().slice(-1)[0]
    return `[${p.code}] ${p.name}: 외주계약${fE(contract)}억, 지급완료${fE(paid)}억, 잔액${fE(remain)}억${lastPlanned?`, 최종 지급예정일:${lastPlanned}`:""}`
  }).filter(Boolean).join("\n")

  // 2026 수금 현황
  const cashSummary = cashflow.map((m,i)=>`${i+1}월:${(m.cash+m.note).toFixed(1)}억`).join(", ")
  const totalCash = cashflow.reduce((s,m)=>s+m.cash+m.note,0)

  // 연도별 실적
  const yearSummary = years.map(y=>`${y.yr}년 수주${y.실행수주}억 매출${y.실행매출}억`).join(" / ")

  // 협력업체 미지급
  const unpaid = {}
  vendorPayments.forEach(p => {
    if(!unpaid[p.vendor]) unpaid[p.vendor]=0
    unpaid[p.vendor]+=p.amount||0
  })

  return `[상지서울건축사사무소 통합경영시스템 데이터]
날짜: ${new Date().toLocaleDateString("ko-KR")}

=== 프로젝트 현황 (총 ${projects.length}건) ===
${projSummary || "(없음)"}

=== 프로젝트별 첨부서류 현황 (계약서·보증서·실적증명서 등 8종) ===
${docSummary || "(등록된 서류 없음)"}

=== 프로젝트별 실행계획서 회차 현황 ===
${execPlanSummary || "(등록된 실행계획서 없음)"}

=== 프로젝트별 협력업체 계약서 현황 ===
${vendorContractSummary || "(등록된 협력업체 계약서 없음)"}

=== 프로젝트별 기성청구서 발송내역 ===
${billingSummary || "(등록된 기성청구서 없음)"}

=== 협력업체별 등록서류 현황 (사업자등록증·통장사본·면허증 등) ===
${vendorRegSummary || "(등록된 협력업체 서류 없음)"}

=== 아카이브 수동 등록 문서 (계약서/협약서/보증서/회의록/보고서/견적서/인허가/기타 등) ===
${vaultSummary || "(등록된 문서 없음)"}

=== 프로젝트별 주요일정 기록 (주간보고 > 주요일정) ===
${scheduleLogSummary || "(등록된 주요일정 기록 없음)"}

=== 프로젝트별 외주비(협력업체 기성) 지급현황 — 잔액/기성잔액 질의에 사용 ===
${vendorPaySummary || "(등록된 외주비 지급 데이터 없음)"}

=== 2026년 월별 수금 실적 ===
총 ${totalCash.toFixed(1)}억 | ${cashSummary}

=== 연도별 수주·매출 실적 ===
${yearSummary}

=== 업무 지침 ===
- 수주 = 용역비(VAT별도), 매출 = VAT포함 기준
- 이윤율 = 이윤 / 용역비 × 100%
- 기성 = 실제 수령한 금액, 잔여기성 = 용역비 - 누계기성
`
}

// ── 스마트 검색 인덱스 생성 ────────────────────────────────────
function buildSearchIndex(data) {
  const { projects=[], vendorPayments=[] } = data
  const idx = []

  projects.forEach(p => {
    // 프로젝트 기본
    idx.push({ type:"project", id:p.id, tab:"projects", icon:"🏗", title:p.name, sub:`${p.code} · ${p.client||""} · ${p.contractType||""}`, keywords:[p.name,p.code,p.client,p.pm,p.address,...(p.depts||[])].filter(Boolean).join(" ") })
    // 협력업체 (최신 버전)
    const ver = p.versions?.[p.versions.length-1]
    ;(ver?.vendors||[]).forEach(v => {
      if(!v.name) return
      idx.push({ type:"vendor", id:`${p.id}_${v.name}`, tab:"vendors", icon:"🤝", title:v.name, sub:`${v.cat} · ${p.name}`, keywords:`${v.name} ${v.cat} ${p.name}` })
    })
  })

  return idx
}

// ══════════════════════════════════════════════════════════════
// 스마트 검색 바 (사이드바 or 모달)
// ══════════════════════════════════════════════════════════════
export function SmartSearch({ data, onNavigate, style={} }) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const idx = useMemo(()=>buildSearchIndex(data),[data.projects, data.vendorPayments])

  const results = useMemo(()=>{
    if(!q.trim()||q.length<1) return []
    const lq = q.toLowerCase()
    return idx.filter(x=>x.keywords.toLowerCase().includes(lq)).slice(0,8)
  },[q, idx])

  useEffect(()=>{
    const handler = e => { if(ref.current&&!ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown",handler)
    return ()=>document.removeEventListener("mousedown",handler)
  },[])

  // 키보드 단축키: Ctrl+K
  useEffect(()=>{
    const h = e => { if((e.ctrlKey||e.metaKey)&&e.key==="k"){e.preventDefault();ref.current?.querySelector("input")?.focus();setOpen(true)} }
    document.addEventListener("keydown",h)
    return ()=>document.removeEventListener("keydown",h)
  },[])

  return (
    <div ref={ref} style={{position:"relative",...style}}>
      <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:15,color:C.gray,pointerEvents:"none"}}>🔍</span>
        <input
          value={q}
          onChange={e=>{setQ(e.target.value);setOpen(true)}}
          onFocus={()=>setOpen(true)}
          placeholder="검색... (Ctrl+K)"
          style={{width:"100%",padding:"9px 12px 9px 34px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:13.5,boxSizing:"border-box",background:"#F8FAFC",color:"#111827",fontFamily:"inherit",outline:"none"}}
        />
        {q&&<button onClick={()=>{setQ("");setOpen(false)}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:15,color:C.gray}}>✕</button>}
      </div>

      {open && (results.length>0||q.length>0) && (
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#fff",border:"1px solid #E5E7EB",borderRadius:12,boxShadow:"0 8px 24px rgba(0,0,0,.12)",zIndex:500,overflow:"hidden",maxHeight:360,overflowY:"auto"}}>
          {results.length===0&&q.length>0
            ? <div style={{padding:"16px",textAlign:"center",color:C.gray,fontSize:13}}>
                "{q}" 검색 결과 없음
                <div style={{fontSize:12,marginTop:4,color:"#9CA3AF"}}>AI에게 물어보기 ↓</div>
              </div>
            : results.map((r,i)=>(
              <div key={i} onClick={()=>{onNavigate(r.tab,r.id);setOpen(false);setQ("")}}
                style={{padding:"11px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #F3F4F6",transition:"background .1s"}}
                onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              >
                <span style={{fontSize:18,flexShrink:0}}>{r.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
                  <div style={{fontSize:12,color:C.gray,marginTop:1}}>{r.sub}</div>
                </div>
                <span style={{fontSize:11,color:C.navyM,background:C.navyL,padding:"2px 7px",borderRadius:6,flexShrink:0}}>{r.tab==="projects"?"프로젝트":r.tab==="vendors"?"협력업체":"이동"}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// AI 어시스턴트 패널
// ══════════════════════════════════════════════════════════════
const QUICK_QUESTIONS = [
  "이번 달 수금 예정 금액과 주요 프로젝트를 알려줘",
  "현재 진행 중인 프로젝트 중 이윤율이 낮은 프로젝트는?",
  "2026년 수주·매출 목표 달성률은 어떻게 돼?",
  "외주비 비중이 높은 프로젝트 상위 3개는?",
  "본부별 수주금액 현황을 요약해줘",
  "공공 프로젝트 실적증명서 목록 보여줘",
  "동아아파트 실행계획서 찾아줘",
]

export function AIAssistant({ data, onNavigate, isOpen, onClose, onApplyChange }) {
  const [messages, setMessages] = useState([
    { role:"assistant", text:"안녕하세요! 저는 상지서울 통합경영시스템 AI 어시스턴트입니다. 프로젝트, 수금, 이윤, 협력업체 등 궁금한 것을 물어보세요.\n\n일정·매출금액·상지지분 변경도 말씀하시면 됩니다. 예: \"수원남부경찰서 계약일을 10월로 변경해줘\"\n(바로 반영되지 않고, 먼저 변경 내용을 보여드리고 확인 후에만 반영됩니다.)\n\n서류 찾기도 됩니다 — 계약서·보증서·실적증명서 외에도 실행계획서, 협력업체 계약서·등록서류, 기성청구서, 문서보관소(공문/회의록 등)까지 전부 찾아드립니다. 예: \"동아아파트 실행계획서 찾아줘\", \"OO업체 사업자등록증 있어?\" — 조건에 맞는 서류를 찾아 바로 다운로드할 수 있게 보여드립니다." }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [pendingChange, setPendingChange] = useState(null) // {projectId, projectName, changes:[{field,label,oldDisplay,newDisplay,newValue}], summary}
  const [docResults, setDocResults] = useState(null) // {docKey, docLabel, items:[{projectId,projectName,doc}], summary}
  const [lastApplied, setLastApplied] = useState(null) // 되돌리기용 — {projectId, changes:[{field, prevValue}]}
  const scrollRef = useRef(null)
  const ctx = useMemo(()=>buildContext(data),[data])
  const canWrite = typeof onApplyChange === "function"

  useEffect(()=>{ scrollRef.current?.scrollTo({top:9999,behavior:"smooth"}) },[messages,pendingChange])

  // 프로젝트 이름/코드 일부만 말해도 찾을 수 있게 — 여러 개 걸리면 가장 먼저 매칭된 것
  const findProject = (query) => {
    if(!query) return null
    const q = query.trim().toLowerCase()
    const projects = data.projects||[]
    return projects.find(p=>(p.name||"").toLowerCase().includes(q) || (p.code||"").toLowerCase().includes(q))
      || projects.find(p=>q.split(/\s+/).some(tok=>tok.length>=2 && (p.name||"").toLowerCase().includes(tok)))
  }

  const FIELD_LABELS = { contractDate:"계약일", orderDate:"수주일", serviceFee:"용역비(매출)", shareRatio:"상지 지분율" }
  const fmtFieldValue = (field, v) => {
    if(v==null) return "-"
    if(field==="shareRatio") return `${Math.round(v*100)}%`
    if(field==="serviceFee") return `${Math.round(v).toLocaleString()}원`
    return String(v)
  }

  const send = async (text) => {
    const q = (text||input).trim()
    if(!q||loading) return
    setInput("")
    setMessages(prev=>[...prev,{role:"user",text:q}])
    setPendingChange(null)
    setDocResults(null)
    setLoading(true)

    const history = messages.filter(m=>m.role!=="assistant"||messages.indexOf(m)>0).slice(-6)

    try {
      // Vercel Edge Function 프록시를 통해 호출 (CORS 우회)
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          system:`당신은 상지서울건축사사무소의 통합경영시스템 전담 AI 어시스턴트입니다.
아래 시스템 데이터를 바탕으로 정확하고 실용적인 답변을 한국어로 제공하세요.
숫자는 억원 단위로, 간결하게 핵심만 답변하되 필요하면 목록으로 정리하세요.
시스템에 없는 데이터는 "데이터가 없습니다"라고 솔직하게 말하세요.

${ctx}

=== 명령 실행 모드 (중요) ===
사용자 메시지가 아래 3가지 중 하나에 해당하는 "프로젝트 데이터 변경 요청"이면, 절대 직접 데이터를 바꾸지 말고
아래 형식 그대로 맨 앞에 <<SJS_ACTION>> 마커와 함께 JSON만 응답하세요 (다른 텍스트 섞지 말 것):
1. 계약일/수주일 등 "일정" 변경 → field:"contractDate" 또는 "orderDate"
2. "매출금액"/"용역비" 변경 → field:"serviceFee" (숫자는 원 단위 정수)
3. "상지 지분(율)" 변경 → field:"shareRatio" (예: 60% → 0.6)

형식:
<<SJS_ACTION>>{"project_query":"프로젝트명에서 추출한 검색어","changes":[{"field":"contractDate","new":"2026-10-27"}],"summary":"사람이 읽을 한국어 한 줄 설명"}

- 날짜는 YYYY-MM-DD 형식으로 변환하세요 (연도가 없으면 데이터의 현재 회차 연도나 문맥상 가장 가까운 연도를 쓰고, summary에 "연도는 추정했습니다"라고 밝히세요).
- 한 메시지에 여러 필드를 동시에 바꾸려 하면 changes 배열에 여러 항목을 넣으세요.
- 어느 프로젝트인지, 어떤 값으로 바꿀지 애매하면 JSON을 만들지 말고 대신 "OO 프로젝트가 맞나요? 어떤 값으로 바꿀까요?" 처럼 되물어보는 일반 텍스트로 답하세요.
- 이 3가지 항목이 아닌 다른 필드 변경 요청(예: PM 교체, 협력업체 정보 등)은 "죄송하지만 지금은 일정·매출금액·지분율 변경만 지원합니다"라고 답하세요.
- 위 3가지에 해당하지 않는 일반 질문은 평소처럼 마커 없이 답변하세요.

=== 서류 검색 모드 (중요) ===
사용자가 시스템 안의 어떤 자료든 찾거나("실적증명서 목록 보여줘", "동아아파트 실행계획서 찾아줘", "이 업체 사업자등록증 있어?", "작년 회의록 찾아줘" 등) 다운로드를 원하는 것 같으면,
아래 형식 그대로 맨 앞에 <<SJS_DOCLIST>> 마커와 함께 JSON만 응답하세요 (다른 텍스트 섞지 말 것). docKey별로 필요한 필드가 다르니 아래 표를 정확히 따르세요.

**A. 프로젝트 첨부서류 (8종)** — "프로젝트별 첨부서류 현황" 데이터 참고
docKey: contract(계약서) | perfBond(계약이행보증서) | liabilityCert(손해배상공제증권) | experienceCert(실적증명서) | buildingReg(건축물대장) | jvMou(업무협약서) | jvSettlement(합사정산서) | contractApproval(계약체결보고서)
<<SJS_DOCLIST>>{"docKey":"experienceCert","items":[{"project_query":"프로젝트명에서 추출한 검색어"}],"summary":"..."}

**B. 실행계획서** — "프로젝트별 실행계획서 회차 현황" 데이터 참고. 특정 회차를 콕 집으면 round_query에 숫자만(예:"2"), 아니면 생략(전체 회차 반환).
docKey: execPlan
<<SJS_DOCLIST>>{"docKey":"execPlan","items":[{"project_query":"동아아파트","round_query":"2"}],"summary":"..."}

**C. 협력업체 계약서(프로젝트별)** — "프로젝트별 협력업체 계약서 현황" 데이터 참고. 특정 업체면 vendor_query, 아니면 생략(전체 업체 반환).
docKey: vendorContract
<<SJS_DOCLIST>>{"docKey":"vendorContract","items":[{"project_query":"...","vendor_query":"구조"}],"summary":"..."}

**D. 기성청구서** — "프로젝트별 기성청구서 발송내역" 데이터 참고. 특정 회차(선금/1차 기성 등)면 stage_query, 아니면 생략.
docKey: billing
<<SJS_DOCLIST>>{"docKey":"billing","items":[{"project_query":"...","stage_query":"1차 기성"}],"summary":"..."}

**E. 협력업체 등록서류** — "협력업체별 등록서류 현황" 데이터 참고. subKey는 다음 중 하나: vendorApp(등록신청서) | bizReg(사업자등록증) | techLicense(기술자면허증) | corpReg(법인등기부등본) | bankbook(통장사본) | newTech(신기술보유현황) | patent(특허기술보유현황) | taxInvoice2(세금계산서) | vendorContract2(계약서) | quote(견적서) | etc(기타서류)
docKey: vendorReg
<<SJS_DOCLIST>>{"docKey":"vendorReg","subKey":"bizReg","items":[{"vendor_query":"업체명"}],"summary":"..."}

**F. 아카이브 수동 등록 문서(계약서/협약서/보증서/회의록/보고서/견적서/인허가/기타)** — "아카이브 수동 등록 문서" 데이터 참고. vault_query는 제목·태그·프로젝트명 등 자유 검색어.
docKey: vault
<<SJS_DOCLIST>>{"docKey":"vault","items":[{"vault_query":"검색어"}],"summary":"..."}

- items에는 조건에 맞는 대상을 전부 나열하세요(예: "공공 프로젝트"면 발주구분이 공공인 것만).
- 위 데이터 섹션에 아예 등록되어 있지 않은 자료는 items에 넣지 말고, docResults 없이 "등록된 자료가 없습니다"라고 일반 텍스트로 답하세요.
- 어떤 서류를 찾는지 불명확하면 JSON을 만들지 말고 일반 텍스트로 되물어보세요.
- 이 6가지 카테고리(A~F) 외에 시스템에 아예 없는 자료를 요청받으면 정직하게 없다고 답하세요.

=== 프로젝트 히스토리 조회 모드 (중요, 마커 없이 일반 텍스트로 답변) ===
사용자가 특정 프로젝트를 콕 집어 "주요일정 알려줘", "히스토리 보여줘", "현황 요약해줘", "전체 정보 알려줘" 처럼
**어떤 데이터인지 좁히지 않고 포괄적으로** 물어보면, 가진 데이터를 전부 한 번에 쏟아내지 마세요.
대신 그 프로젝트에 실제로 등록된 데이터 종류만 골라 아래처럼 간단한 메뉴로 되물으세요(등록 안 된 항목은 아예 언급하지 마세요):

"OOO프로젝트에 대해 아래 중 어떤 내용을 보여드릴까요?
- 📅 주요일정 기록 (주간보고)
- 📝 계약정보 (계약서·계약체결보고서 등)
- 💰 월수금(매출) 입금현황
- 📐 실행계획서 이력
- 🤝 협력업체 현황(계약·기성지급)
전체를 다 보고 싶으시면 '전체'라고 말씀해주세요."

사용자가 위 메뉴 중 하나를 고르거나(예: "주요일정 알려줘", "계약정보 보여줘") 처음부터 구체적으로 물어봤다면(예: "OOO프로젝트 주요일정 알려줘"),
곧바로 해당 데이터를 아래 원칙대로 답하세요:
- 주요일정: "프로젝트별 주요일정 기록" 데이터를 날짜순(오래된순)으로 전부 나열하세요. 항목이 많다고 임의로 생략하지 말고, 등록된 전체 이력을 다 보여주세요.
- 계약정보: "프로젝트별 첨부서류 현황"의 계약서/계약체결보고서 항목과 프로젝트 요약의 용역비·수주유형을 함께 답하세요.
- 월수금(매출)현황: 프로젝트 요약의 입금누계와, 필요하면 "2026년 월별 수금 실적"을 참고해 답하세요.
- 실행계획서: "프로젝트별 실행계획서 회차 현황"을 회차순으로 답하세요.
- 협력업체 현황: "프로젝트별 협력업체 계약서 현황"과 "프로젝트별 외주비 지급현황"을 함께 답하세요.
- "전체"를 요청받으면 위 5개 항목을 소제목으로 나눠 순서대로 전부 답하세요.
- 프로젝트를 특정하지 못했으면(이름이 여러 개 걸리거나 전혀 없으면) 메뉴를 보여주지 말고 어떤 프로젝트인지 먼저 되물으세요.`,
          messages:[
            ...history.map(m=>({role:m.role==="user"?"user":"assistant",content:m.text})),
            {role:"user",content:q}
          ]
        })
      })
      const json = await res.json()
      const reply = json.content?.[0]?.text || json.error || "응답을 가져오지 못했습니다."

      const marker = "<<SJS_ACTION>>"
      const docMarker = "<<SJS_DOCLIST>>"
      if(reply.includes(docMarker)){
        try{
          const jsonStr = reply.slice(reply.indexOf(docMarker)+docMarker.length).trim()
          const parsed = JSON.parse(jsonStr)
          const findVendor = (query) => {
            if(!query) return null
            const q = query.trim().toLowerCase()
            const names = Object.keys(data.vendorsDB||{})
            return names.find(n=>n.toLowerCase().includes(q))
          }
          let items = []
          let docLabel = DOC_LABELS[parsed.docKey] || parsed.docKey

          if(parsed.docKey==="execPlan"){
            items = (parsed.items||[]).flatMap(it=>{
              const proj = findProject(it.project_query)
              if(!proj) return []
              let vs = proj.versions||[]
              if(it.round_query) vs = vs.filter(v=>String(v.round)===String(it.round_query).trim())
              return vs.map(v=>({
                projectId:proj.id, projectName:proj.name,
                doc:{versionLabel:`${v.round||"?"}차 실행계획서`, docNo:v.date||"", endDate:"", fileData:v.pdfData||"", fileName:v.pdfName||`실행계획서_${proj.code||""}${v.round||""}차.pdf`}
              }))
            })
          } else if(parsed.docKey==="vendorContract"){
            items = (parsed.items||[]).flatMap(it=>{
              const proj = findProject(it.project_query)
              if(!proj) return []
              let groups = proj.vendorDocs||[]
              if(it.vendor_query){ const vq=it.vendor_query.trim().toLowerCase(); groups = groups.filter(g=>(g.vendorName||"").toLowerCase().includes(vq)) }
              return groups.filter(g=>(g.versions||[]).length).map(g=>{
                const latest = g.versions[g.versions.length-1]
                return {projectId:proj.id, projectName:`${proj.name} — ${g.vendorName}`, doc:latest}
              })
            })
          } else if(parsed.docKey==="billing"){
            items = (parsed.items||[]).flatMap(it=>{
              const proj = findProject(it.project_query)
              if(!proj) return []
              let list = proj.billingSubmissions||[]
              if(it.stage_query){ const sq=it.stage_query.trim().toLowerCase(); list = list.filter(b=>(b.stage||"").toLowerCase().includes(sq)) }
              return list.map(b=>({
                projectId:proj.id, projectName:`${proj.name} — ${b.stage||""}`,
                doc:{versionLabel:b.stage||"", docNo:b.date||"", endDate:"", fileData:b.fileData||"", fileName:b.fileName||""}
              }))
            })
          } else if(parsed.docKey==="vendorReg"){
            docLabel = VENDOR_REG_LABELS[parsed.subKey] || parsed.subKey || "협력업체 서류"
            items = (parsed.items||[]).flatMap(it=>{
              const vname = findVendor(it.vendor_query)
              if(!vname) return []
              const info = (data.vendorsDB||{})[vname]
              const g = (info?.certDocs||[]).find(d=>d.key===parsed.subKey)
              const vs = Array.isArray(g?.versions) ? g.versions : []
              if(!vs.length) return []
              return [{projectId:vname, projectName:vname, doc:vs[vs.length-1]}]
            })
          } else if(parsed.docKey==="vault"){
            let vaultDocs = []
            try{ vaultDocs = JSON.parse(localStorage.getItem("sjs_archive_docs")||"[]") }catch{}
            const queries = (parsed.items||[]).map(it=>(it.vault_query||"").trim().toLowerCase()).filter(Boolean)
            const matched = queries.length
              ? vaultDocs.filter(d=>queries.some(q=>(d.title||"").toLowerCase().includes(q)||(d.tags||[]).join(",").toLowerCase().includes(q)||(d.description||"").toLowerCase().includes(q)||(d.category||"").toLowerCase().includes(q)))
              : vaultDocs
            items = matched.map((d,i)=>({
              projectId:`vault_${i}`, projectName:`[${d.category||"기타"}] ${d.title||"(제목없음)"}`,
              doc:{versionLabel:d.description||"", docNo:(d.dateDoc||d.createdAt||"").slice(0,10), endDate:"", fileData:d.fileData||"", fileName:d.fileName||""}
            }))
          } else {
            // 기존 8종 프로젝트 첨부서류
            items = (parsed.items||[]).map(it=>{
              const proj = findProject(it.project_query)
              if(!proj) return null
              const g = (proj.certDocs||[]).find(d=>d.key===parsed.docKey)
              const vs = Array.isArray(g?.versions) ? g.versions : []
              if(!vs.length) return null
              return {projectId:proj.id, projectName:proj.name, doc:vs[vs.length-1]}
            }).filter(Boolean)
          }

          if(items.length===0){
            setMessages(prev=>[...prev,{role:"assistant",text:"조건에 맞는 서류를 찾지 못했습니다. 다른 조건으로 다시 물어봐 주세요."}])
          } else {
            setDocResults({docKey:parsed.docKey, docLabel, items, summary:parsed.summary||""})
          }
        }catch(e){
          setMessages(prev=>[...prev,{role:"assistant",text:"서류 검색 요청을 이해했지만 형식을 해석하는 데 실패했습니다. 다시 한번 말씀해주시겠어요?"}])
        }
      } else if(reply.includes(marker)){
        try{
          const jsonStr = reply.slice(reply.indexOf(marker)+marker.length).trim()
          const parsed = JSON.parse(jsonStr)
          const proj = findProject(parsed.project_query)
          if(!proj){
            setMessages(prev=>[...prev,{role:"assistant",text:`"${parsed.project_query}"에 해당하는 프로젝트를 찾지 못했습니다. 프로젝트명을 좀 더 정확히 말씀해주세요.`}])
          } else if(!canWrite){
            setMessages(prev=>[...prev,{role:"assistant",text:"지금 화면에서는 변경사항을 반영할 수 없습니다. 프로젝트 화면에서 다시 시도해주세요."}])
          } else {
            const changes = (parsed.changes||[]).map(c=>({
              field:c.field, label:FIELD_LABELS[c.field]||c.field,
              oldDisplay: fmtFieldValue(c.field, proj[c.field]),
              newValue: c.field==="serviceFee"||c.field==="shareRatio" ? Number(c.new) : c.new,
              newDisplay: fmtFieldValue(c.field, c.field==="serviceFee"||c.field==="shareRatio" ? Number(c.new) : c.new),
            })).filter(c=>c.field && FIELD_LABELS[c.field])
            if(changes.length===0){
              setMessages(prev=>[...prev,{role:"assistant",text:"변경할 항목을 이해하지 못했습니다. 다시 한번 구체적으로 말씀해주세요."}])
            } else {
              setPendingChange({projectId:proj.id, projectName:proj.name, changes, summary:parsed.summary||""})
            }
          }
        }catch(e){
          setMessages(prev=>[...prev,{role:"assistant",text:"변경 요청을 이해했지만 형식을 해석하는 데 실패했습니다. 다시 한번 말씀해주시겠어요?"}])
        }
      } else {
        setMessages(prev=>[...prev,{role:"assistant",text:reply}])
      }
    } catch(e) {
      const msg = e.message?.includes("Failed to fetch")
        ? "⚠ 서버 연결 오류입니다.\n\nVercel 환경변수에 GEMINI_API_KEY가 설정되어 있는지 확인하세요.\n\nVercel 대시보드 → Settings → Environment Variables → GEMINI_API_KEY 추가"
        : `⚠ 오류: ${e.message}`
      setMessages(prev=>[...prev,{role:"assistant",text:msg}])
    }
    setLoading(false)
  }

  const applyPending = () => {
    if(!pendingChange || !canWrite) return
    const prevValues = {}
    pendingChange.changes.forEach(c=>{ prevValues[c.field] = data.projects.find(p=>p.id===pendingChange.projectId)?.[c.field] })
    onApplyChange(pendingChange.projectId, Object.fromEntries(pendingChange.changes.map(c=>[c.field,c.newValue])))
    setLastApplied({projectId:pendingChange.projectId, projectName:pendingChange.projectName, prevValues, changes:pendingChange.changes})
    setMessages(prev=>[...prev,{role:"assistant",text:`✅ "${pendingChange.projectName}"에 반영했습니다.\n${pendingChange.changes.map(c=>`· ${c.label}: ${c.oldDisplay} → ${c.newDisplay}`).join("\n")}`}])
    setPendingChange(null)
  }
  const undoLast = () => {
    if(!lastApplied || !canWrite) return
    onApplyChange(lastApplied.projectId, lastApplied.prevValues)
    setMessages(prev=>[...prev,{role:"assistant",text:`↩️ "${lastApplied.projectName}" 변경을 되돌렸습니다.`}])
    setLastApplied(null)
  }

  if(!isOpen) return null


  return (
    <div style={{position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:"20px",pointerEvents:"none"}}>
      <div style={{width:420,height:"80vh",maxHeight:680,background:"#fff",borderRadius:20,boxShadow:"0 20px 60px rgba(0,0,0,.18)",border:"1px solid #E5E7EB",display:"flex",flexDirection:"column",pointerEvents:"all",overflow:"hidden"}}>

        {/* 헤더 */}
        <div style={{padding:"16px 20px",borderBottom:"1px solid #F3F4F6",display:"flex",alignItems:"center",gap:12,background:"linear-gradient(135deg,#3B72F6,#1A3B6E)"}}>
          <div style={{width:38,height:38,background:"rgba(255,255,255,.2)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🤖</div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>AI 어시스턴트</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>시스템 데이터 기반 맞춤 분석</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"none",cursor:"pointer",fontSize:16,color:"#fff",width:30,height:30,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        {/* 메시지 영역 */}
        <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",gap:8,flexDirection:m.role==="user"?"row-reverse":"row",alignItems:"flex-start"}}>
              <div style={{width:30,height:30,borderRadius:8,background:m.role==="user"?C.navyM:"#F3F4F6",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
                {m.role==="user"?"👤":"🤖"}
              </div>
              <div style={{maxWidth:"85%",padding:"10px 14px",borderRadius:m.role==="user"?"14px 4px 14px 14px":"4px 14px 14px 14px",background:m.role==="user"?C.navyM:"#F8FAFC",color:m.role==="user"?"#fff":"#111827",fontSize:13.5,lineHeight:1.65,whiteSpace:"pre-wrap",border:m.role==="assistant"?"1px solid #E5E7EB":"none"}}>
                {m.text}
              </div>
            </div>
          ))}
          {loading&&(
            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <div style={{width:30,height:30,borderRadius:8,background:"#F3F4F6",display:"flex",alignItems:"center",justifyContent:"center"}}>🤖</div>
              <div style={{padding:"12px 16px",borderRadius:"4px 14px 14px 14px",background:"#F8FAFC",border:"1px solid #E5E7EB",display:"flex",gap:4,alignItems:"center"}}>
                {[0,1,2].map(j=><div key={j} style={{width:7,height:7,borderRadius:"50%",background:C.navyM,animation:`bounce 1.2s ${j*0.2}s infinite`}}/>)}
              </div>
            </div>
          )}
          {pendingChange && (
            <div style={{marginLeft:38,padding:"14px 16px",borderRadius:12,background:"#FFFBEB",border:"1.5px solid #F59E0B"}}>
              <div style={{fontSize:13,fontWeight:800,color:"#92400E",marginBottom:8}}>📝 변경 제안 — 확인 후 반영됩니다</div>
              <div style={{fontSize:13.5,fontWeight:700,color:"#111827",marginBottom:6}}>{pendingChange.projectName}</div>
              <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>
                {pendingChange.changes.map((c,i)=>(
                  <div key={i} style={{fontSize:13,color:"#78350F",display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontWeight:700}}>{c.label}</span>
                    <span style={{color:"#B45309"}}>{c.oldDisplay}</span>
                    <span>→</span>
                    <span style={{fontWeight:800,color:"#92400E"}}>{c.newDisplay}</span>
                  </div>
                ))}
              </div>
              {pendingChange.summary && <div style={{fontSize:12,color:"#92400E",marginBottom:10,fontStyle:"italic"}}>{pendingChange.summary}</div>}
              <div style={{display:"flex",gap:8}}>
                <button onClick={applyPending} style={{padding:"7px 16px",background:"#F59E0B",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>✓ 적용</button>
                <button onClick={()=>setPendingChange(null)} style={{padding:"7px 16px",background:"#fff",color:"#92400E",border:"1px solid #F59E0B",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>취소</button>
              </div>
            </div>
          )}
          {lastApplied && !pendingChange && (
            <div style={{marginLeft:38,display:"flex"}}>
              <button onClick={undoLast} style={{padding:"5px 12px",background:"#F8FAFC",color:"#64748B",border:"1px solid #E5E7EB",borderRadius:20,fontSize:11.5,fontWeight:700,cursor:"pointer"}}>
                ↩️ 방금 반영한 "{lastApplied.projectName}" 변경 되돌리기
              </button>
            </div>
          )}
          {docResults && (
            <div style={{marginLeft:38,padding:"14px 16px",borderRadius:12,background:"#EEF3FF",border:"1.5px solid #3B72F6"}}>
              <div style={{fontSize:13,fontWeight:800,color:"#1A3B6E",marginBottom:8}}>📎 {docResults.docLabel} 검색 결과 — {docResults.items.length}건</div>
              {docResults.summary && <div style={{fontSize:12,color:"#3B72F6",marginBottom:10,fontStyle:"italic"}}>{docResults.summary}</div>}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {docResults.items.map((it,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff",borderRadius:8,padding:"8px 12px"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"#111827"}}>{it.projectName}</div>
                      <div style={{fontSize:11.5,color:"#6B7280"}}>{it.doc.versionLabel||"최초"}{it.doc.endDate?` · ~${it.doc.endDate}`:""}{it.doc.docNo?` · ${it.doc.docNo}`:""}</div>
                    </div>
                    {it.doc.fileData
                      ? <a href={it.doc.fileData} download={it.doc.fileName} style={{padding:"5px 12px",background:"#3B72F6",color:"#fff",borderRadius:6,fontSize:12,fontWeight:700,textDecoration:"none",flexShrink:0}}>⬇ 다운로드</a>
                      : <span style={{fontSize:11.5,color:"#9CA3AF",flexShrink:0}}>파일 없음</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 퀵 질문 */}
        {messages.length<=1&&(
          <div style={{padding:"0 12px 8px",display:"flex",flexWrap:"wrap",gap:6}}>
            {QUICK_QUESTIONS.map((q,i)=>(
              <button key={i} onClick={()=>send(q)} style={{padding:"6px 11px",background:C.navyL,color:C.navyM,border:`1px solid ${C.navyM}22`,borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",textAlign:"left",lineHeight:1.4}}>
                {q}
              </button>
            ))}
          </div>
        )}

        {/* 입력 영역 */}
        <div style={{padding:"12px 16px",borderTop:"1px solid #F3F4F6",display:"flex",gap:8}}>
          <textarea
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}}
            placeholder="질문을 입력하세요... (Enter로 전송, Shift+Enter 줄바꿈)"
            rows={2}
            style={{flex:1,padding:"9px 12px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:13.5,fontFamily:"inherit",resize:"none",outline:"none",lineHeight:1.5,color:"#111827"}}
          />
          <button onClick={()=>send()} disabled={!input.trim()||loading}
            style={{width:42,background:input.trim()&&!loading?C.navyM:"#E5E7EB",color:"#fff",border:"none",borderRadius:10,cursor:input.trim()&&!loading?"pointer":"default",fontSize:18,flexShrink:0,transition:"background .15s"}}>
            ↑
          </button>
        </div>
        <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 주간 브리핑 위젯 (경영분석 대시보드 상단)
// ══════════════════════════════════════════════════════════════
export function WeeklyBriefing({ data }) {
  const { projects=[], cashflow=[], years=[] } = data

  const alerts = useMemo(()=>{
    const list = []
    const now = new Date()
    const thisMonth = now.getMonth()  // 0-indexed

    // 1. 이달 수금 목표 달성률
    const monthCash = cashflow[thisMonth]
    if(monthCash) {
      const planned = Object.values(monthCash.byDept||{}).reduce((s,v)=>s+v,0)
      const actual  = monthCash.cash + monthCash.note
      if(planned>0) {
        const rate = actual/planned*100
        list.push({
          icon: rate>=100?"✅":rate>=70?"⚠️":"🔴",
          type: rate>=100?"success":rate>=70?"warning":"danger",
          title:`${thisMonth+1}월 수금 달성률 ${rate.toFixed(0)}%`,
          desc:`목표 ${planned.toFixed(1)}억 · 실적 ${actual.toFixed(1)}억`,
        })
      }
    }

    // 2. 이윤율 낮은 프로젝트
    projects.forEach(p => {
      const ver = p.versions?.[p.versions.length-1]
      if(!ver||!p.serviceFee) return
      const pnl = calcPnlTotals(ver)
      const rate = pnl.profit/p.serviceFee*100
      if(rate<5&&pnl.profit>0) {
        list.push({ icon:"⚠️", type:"warning", title:`이윤율 주의: ${p.name.slice(0,20)}`, desc:`이윤율 ${rate.toFixed(1)}% (${fE(pnl.profit)}억)` })
      }
    })

    // 3. 기성 이월 위험 프로젝트
    projects.forEach(p => {
      const plan = p.cashflowPlan||[]
      const actual = plan.reduce((s,e)=>s+(e.actual||0),0)
      const plannedTotal = plan.reduce((s,e)=>s+(e.plan||0),0)
      if(plannedTotal>0&&actual<plannedTotal*0.5&&plannedTotal>5) {
        list.push({ icon:"📅", type:"info", title:`기성 지연: ${p.name.slice(0,20)}`, desc:`계획 ${plannedTotal.toFixed(1)}억 중 ${actual.toFixed(1)}억 수령 (${(actual/plannedTotal*100).toFixed(0)}%)` })
      }
    })

    // 4. 수주 달성률
    const thisYear = years.find(y=>y.yr===String(now.getFullYear()))
    if(thisYear?.목표수주&&thisYear?.실행수주) {
      const rate = thisYear.실행수주/thisYear.목표수주*100
      list.push({
        icon: rate>=100?"🎯":rate>=70?"📈":"📉",
        type: rate>=100?"success":rate>=70?"warning":"danger",
        title:`${now.getFullYear()}년 수주 달성률 ${rate.toFixed(0)}%`,
        desc:`목표 ${thisYear.목표수주}억 · 실행 ${thisYear.실행수주}억`,
      })
    }

    return list.slice(0,6)
  },[data])

  const bg = {success:"#E6F9F2",warning:"#FEF3C7",danger:"#FEE2E2",info:"#EEF3FF"}
  const fg = {success:"#0EA86E",warning:"#F59E0B",danger:"#EF4444",info:"#3B72F6"}

  return (
    <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",padding:"20px 24px",marginBottom:20,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <div style={{fontSize:20}}>📋</div>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:"#111827"}}>이번 주 경영 브리핑</div>
          <div style={{fontSize:12,color:"#6B7280"}}>{new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</div>
        </div>
      </div>
      {alerts.length===0
        ? <div style={{color:"#6B7280",fontSize:14}}>특이사항 없음 ✅</div>
        : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
            {alerts.map((a,i)=>(
              <div key={i} style={{background:bg[a.type]||"#F8FAFC",borderRadius:12,padding:"12px 16px",border:`1px solid ${fg[a.type]}22`}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                  <span>{a.icon}</span>
                  <span style={{fontSize:13.5,fontWeight:700,color:"#111827"}}>{a.title}</span>
                </div>
                <div style={{fontSize:12.5,color:"#6B7280",marginLeft:20}}>{a.desc}</div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ── AI 플로팅 버튼 ───────────────────────────────────────────
export function AIFloatButton({ onClick, hasNew }) {
  return (
    <button onClick={onClick} style={{
      position:"fixed",bottom:28,right:28,width:58,height:58,
      background:"linear-gradient(135deg,#3B72F6,#1A3B6E)",
      borderRadius:"50%",border:"none",cursor:"pointer",
      boxShadow:"0 4px 20px rgba(59,114,246,.45)",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:24,zIndex:500,transition:"transform .2s",
    }}
    onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
    onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
    title="AI 어시스턴트 열기 (시스템 데이터 기반 분석)"
    >
      🤖
      {hasNew&&<div style={{position:"absolute",top:2,right:2,width:12,height:12,background:"#EF4444",borderRadius:"50%",border:"2px solid #fff"}}/>}
    </button>
  )
}
