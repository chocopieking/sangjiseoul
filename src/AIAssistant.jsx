// ══════════════════════════════════════════════════════════════
// 🤖 AI 어시스턴트 + ⚡ 스마트 검색
// Anthropic API (claude-sonnet-4-6) 연동
// 시스템 데이터를 컨텍스트로 주입하여 맞춤형 답변 생성
// ══════════════════════════════════════════════════════════════
import { useState, useRef, useEffect, useMemo } from "react"
import { calcPnlTotals, getDeptShares, fE } from "./data.js"

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
  const { projects=[], cashflow=[], years=[], vendorPayments=[] } = data

  // 프로젝트 요약
  const projSummary = projects.map(p => {
    const ver = p.versions?.[p.versions.length-1]
    const pnl = ver ? calcPnlTotals(ver) : null
    const cashTotal = (p.cashflowPlan||[]).reduce((s,e)=>s+(e.actual||0),0)
    const shares = getDeptShares(p).map(s=>`${s.dept}(${s.share}%)`).join(",")
    return `[${p.code}] ${p.name} | 발주처:${p.client||"-"} | 본부:${shares||"-"} | 용역비:${fE(p.serviceFee)}억 | 수주유형:${p.contractType||"-"} | 진행:${p.prog||0}% | 회차:${ver?.round||"-"}차 | 입금누계:${cashTotal.toFixed(2)}억`
  }).join("\n")

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
  "최근 변경 계약이 있는 프로젝트는?",
]

export function AIAssistant({ data, onNavigate, isOpen, onClose }) {
  const [messages, setMessages] = useState([
    { role:"assistant", text:"안녕하세요! 저는 상지서울 통합경영시스템 AI 어시스턴트입니다. 프로젝트, 수금, 이윤, 협력업체 등 궁금한 것을 물어보세요. 시스템의 실제 데이터를 기반으로 답변해 드립니다." }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)
  const ctx = useMemo(()=>buildContext(data),[data])

  useEffect(()=>{ scrollRef.current?.scrollTo({top:9999,behavior:"smooth"}) },[messages])

  const send = async (text) => {
    const q = (text||input).trim()
    if(!q||loading) return
    setInput("")
    setMessages(prev=>[...prev,{role:"user",text:q}])
    setLoading(true)

    const history = messages.filter(m=>m.role!=="assistant"||messages.indexOf(m)>0).slice(-6)

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:1000,
          system:`당신은 상지서울건축사사무소의 통합경영시스템 전담 AI 어시스턴트입니다.
아래 시스템 데이터를 바탕으로 정확하고 실용적인 답변을 한국어로 제공하세요.
숫자는 억원 단위로, 간결하게 핵심만 답변하되 필요하면 목록으로 정리하세요.
시스템에 없는 데이터는 "데이터가 없습니다"라고 솔직하게 말하세요.

${ctx}`,
          messages:[
            ...history.map(m=>({role:m.role==="user"?"user":"assistant",content:m.text})),
            {role:"user",content:q}
          ]
        })
      })
      const json = await res.json()
      const reply = json.content?.[0]?.text || "응답을 가져오지 못했습니다."
      setMessages(prev=>[...prev,{role:"assistant",text:reply}])
    } catch(e) {
      setMessages(prev=>[...prev,{role:"assistant",text:"⚠ 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요."}])
    }
    setLoading(false)
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
