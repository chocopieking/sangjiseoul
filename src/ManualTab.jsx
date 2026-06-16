// ══════════════════════════════════════════════════════════════
// 📚 업무 매뉴얼 AI — PDF/문서 업로드 + 질의응답
// ══════════════════════════════════════════════════════════════
import { useState, useRef, useEffect } from "react"

const C = {
  navyM:"#3B72F6", navyL:"#EEF3FF", navy:"#1A3B6E",
  green:"#0EA86E", greenL:"#E6F9F2",
  amber:"#F59E0B", amberL:"#FEF3C7",
  red:"#EF4444",   redL:"#FEE2E2",
  gray:"#6B7280",  grayL:"#F3F4F6",
}

const S = {
  card:(x={})=>({background:"#fff",border:"1px solid #E5E7EB",borderRadius:16,padding:"22px 26px",marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.05)",...x}),
  btn:(bg="#3B72F6",fg="#fff")=>({padding:"10px 18px",background:bg,color:fg,border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:7}),
}

// PDF를 base64로 변환
const pdfToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result.split(",")[1])
  reader.onerror = reject
  reader.readAsDataURL(file)
})

export function ManualTab() {
  const [manuals, setManuals]   = useState(() => {
    try{ return JSON.parse(localStorage.getItem("sjs_manuals")||"[]") }catch{ return [] }
  })
  const [selIdx, setSelIdx]     = useState(0)
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [uploading, setUploading]= useState(false)
  const [tab, setTab]           = useState("chat")  // chat | files | search
  const [searchQ, setSearchQ]   = useState("")
  const [searchRes, setSearchRes]= useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const fileRef = useRef(null)
  const scrollRef = useRef(null)

  const saveManuals = (list) => {
    // base64 데이터는 크므로 이름/크기만 저장 (실제 데이터는 세션메모리)
    const meta = list.map(m=>({...m, data:undefined, preview: m.preview}))
    try{ localStorage.setItem("sjs_manuals_meta", JSON.stringify(meta)) }catch{}
    setManuals(list)
  }

  useEffect(()=>{ scrollRef.current?.scrollTo({top:9999,behavior:"smooth"}) },[messages])

  // 선택된 매뉴얼의 초기 메시지
  useEffect(()=>{
    const m = manuals[selIdx]
    if(m) setMessages([{role:"assistant",text:`📖 **${m.name}** 매뉴얼이 로드되었습니다.\n\n궁금한 업무 절차나 양식에 대해 자유롭게 질문하세요.\n\n예시 질문:\n• "계약 프로세스를 단계별로 설명해줘"\n• "실행계획서 작성 절차는?"\n• "결재 양식은 어디서 다운받아?"\n• "외주비 정산 방법 알려줘"`}])
    else setMessages([{role:"assistant",text:"왼쪽에서 업무 매뉴얼 PDF를 업로드하거나 선택하면 해당 내용을 기반으로 질문에 답변해 드립니다."}])
  },[selIdx, manuals.length])

  const uploadFile = async (file) => {
    if(!file) return
    const allowed = ["application/pdf","text/plain","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    const isPdf = file.type==="application/pdf"
    const isTxt = file.type==="text/plain"

    setUploading(true)
    try {
      if(isPdf) {
        const base64 = await pdfToBase64(file)
        const newManual = {
          id: `M${Date.now()}`,
          name: file.name.replace(/\.[^.]+$/,""),
          fileName: file.name,
          type: "pdf",
          size: file.size,
          uploadedAt: new Date().toISOString(),
          data: base64,
          preview: null,
        }
        const updated = [...manuals, newManual]
        saveManuals(updated)
        setSelIdx(updated.length-1)
      } else if(isTxt) {
        const text = await file.text()
        const newManual = {
          id: `M${Date.now()}`,
          name: file.name.replace(/\.[^.]+$/,""),
          fileName: file.name,
          type: "text",
          size: file.size,
          uploadedAt: new Date().toISOString(),
          text: text.slice(0, 50000),  // 5만자 제한
          preview: text.slice(0, 200),
        }
        const updated = [...manuals, newManual]
        saveManuals(updated)
        setSelIdx(updated.length-1)
      }
    } catch(e) {
      alert("파일 업로드 오류: "+e.message)
    }
    setUploading(false)
    fileRef.current && (fileRef.current.value="")
  }

  const deleteManual = (i) => {
    if(!window.confirm("이 매뉴얼을 삭제하시겠습니까?")) return
    const updated = manuals.filter((_,ri)=>ri!==i)
    saveManuals(updated)
    setSelIdx(Math.min(selIdx, updated.length-1))
  }

  const buildMessages = (q, manual, history) => {
    const msgs = []
    if(manual?.type==="pdf"&&manual.data) {
      msgs.push({
        role:"user",
        content:[
          { type:"document", source:{ type:"base64", media_type:"application/pdf", data:manual.data } },
          { type:"text", text:`위 문서는 "${manual.name}" 업무 매뉴얼입니다. 이 문서를 기반으로 다음 질문에 한국어로 답변해주세요. 관련 양식이나 절차가 있으면 구체적으로 알려주세요.\n\n${q}` }
        ]
      })
    } else if(manual?.type==="text"&&manual.text) {
      msgs.push(...history.slice(-4).map(m=>({role:m.role==="user"?"user":"assistant",content:m.text})))
      msgs.push({role:"user",content:`[업무 매뉴얼: ${manual.name}]\n\n${manual.text}\n\n---\n위 매뉴얼 내용을 기반으로 질문에 답변해주세요.\n\n${q}`})
    } else {
      msgs.push(...history.slice(-4).map(m=>({role:m.role==="user"?"user":"assistant",content:m.text})))
      msgs.push({role:"user",content:q})
    }
    return msgs
  }

  const send = async (text) => {
    const q = (text||input).trim()
    if(!q||loading) return
    setInput("")
    setMessages(prev=>[...prev,{role:"user",text:q}])
    setLoading(true)

    const manual = manuals[selIdx]

    try {
      const res = await fetch("/api/chat",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:2000,
          system:`당신은 상지서울건축사사무소의 업무 매뉴얼 전문 AI 어시스턴트입니다.
업무 절차, 양식, 규정 등을 명확하고 단계별로 안내해주세요.
직원들이 이해하기 쉽게 핵심을 짚어주고, 필요한 경우 단계 번호를 붙여 설명하세요.
매뉴얼에 없는 내용이면 "매뉴얼에서 찾을 수 없습니다"라고 솔직하게 말하세요.`,
          messages: buildMessages(q, manual, messages)
        })
      })
      const json = await res.json()
      if(json.error) throw new Error(json.error)
      const reply = json.content?.[0]?.text || "응답을 가져오지 못했습니다."
      setMessages(prev=>[...prev,{role:"assistant",text:reply}])
    } catch(e) {
      setMessages(prev=>[...prev,{role:"assistant",text:`⚠ 오류: ${e.message}\n\nVercel에 ANTHROPIC_API_KEY 환경변수가 설정되어 있는지 확인하세요.`}])
    }
    setLoading(false)
  }

  // 전체 매뉴얼 검색
  const searchAll = async () => {
    const q = searchQ.trim()
    if(!q||searchLoading) return
    setSearchLoading(true)
    setSearchRes(null)

    const pdfs = manuals.filter(m=>m.type==="pdf"&&m.data)
    const texts = manuals.filter(m=>m.type==="text"&&m.text)

    if(pdfs.length===0&&texts.length===0) {
      setSearchRes("업로드된 매뉴얼이 없습니다.")
      setSearchLoading(false)
      return
    }

    try {
      // 텍스트 매뉴얼만 묶어서 한 번에 검색 (PDF는 첫 번째 것만)
      const firstPdf = pdfs[0]
      const textContent = texts.map(m=>`[${m.name}]\n${m.text}`).join("\n\n---\n\n")
      const msgs = []

      if(firstPdf) {
        msgs.push({
          role:"user",
          content:[
            {type:"document", source:{type:"base64",media_type:"application/pdf",data:firstPdf.data}},
            ...(textContent?[{type:"text",text:`추가 매뉴얼:\n${textContent}`}]:[]),
            {type:"text",text:`위 업무 매뉴얼에서 다음을 검색해주세요: "${q}"\n\n관련 내용을 찾아서 어느 섹션에 있는지, 핵심 내용은 무엇인지 알려주세요.`}
          ]
        })
      } else {
        msgs.push({
          role:"user",
          content:`다음 업무 매뉴얼에서 "${q}"를 검색해주세요:\n\n${textContent}\n\n관련 내용의 위치(섹션명)와 핵심 내용을 알려주세요.`
        })
      }

      const res = await fetch("/api/chat",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1500,messages:msgs})
      })
      const json = await res.json()
      setSearchRes(json.content?.[0]?.text||"결과 없음")
    } catch(e) {
      setSearchRes("⚠ 검색 오류: "+e.message)
    }
    setSearchLoading(false)
  }

  const formatBytes = b => b>1024*1024?`${(b/1024/1024).toFixed(1)}MB`:`${(b/1024).toFixed(0)}KB`
  const fmtDate = iso => new Date(iso).toLocaleDateString("ko-KR",{month:"short",day:"numeric"})

  const QUICK = [
    "계약 체결 프로세스를 단계별로 알려줘",
    "실행계획서 작성 및 결재 방법은?",
    "외주용역비 정산 절차를 설명해줘",
    "사내 결재 양식은 어디서 받아?",
    "프로젝트 수행 단계별 주요 업무는?",
  ]

  return (
    <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:0,height:"calc(100vh - 120px)",minHeight:600}}>

      {/* ── 왼쪽: 매뉴얼 목록 ── */}
      <div style={{background:"#fff",borderRight:"1px solid #E5E7EB",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px",borderBottom:"1px solid #F3F4F6"}}>
          <div style={{fontSize:16,fontWeight:800,color:"#111827",marginBottom:12}}>📚 업무 매뉴얼</div>
          <label style={{...S.btn(C.navyM),width:"100%",justifyContent:"center",cursor:"pointer",borderRadius:10}}>
            {uploading?"업로드 중...":"📎 PDF / TXT 업로드"}
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md" style={{display:"none"}} onChange={e=>uploadFile(e.target.files?.[0])} disabled={uploading}/>
          </label>
          <div style={{fontSize:11.5,color:C.gray,marginTop:6,textAlign:"center"}}>PDF, TXT 파일 지원</div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
          {manuals.length===0
            ? <div style={{padding:"24px 16px",textAlign:"center",color:C.gray,fontSize:13,lineHeight:1.7}}>
                아직 업로드된 매뉴얼이 없습니다.<br/>
                <b>PDF 또는 TXT</b> 형식의<br/>
                업무 매뉴얼을 업로드하면<br/>
                AI가 내용을 분석하여<br/>
                질의응답을 도와드립니다.
              </div>
            : manuals.map((m,i)=>(
              <div key={m.id} onClick={()=>setSelIdx(i)}
                style={{padding:"11px 13px",borderRadius:10,cursor:"pointer",marginBottom:4,border:`1.5px solid ${i===selIdx?C.navyM:"transparent"}`,background:i===selIdx?C.navyL:"transparent",transition:"all .15s"}}
                onMouseEnter={e=>{if(i!==selIdx)e.currentTarget.style.background="#F8FAFC"}}
                onMouseLeave={e=>{if(i!==selIdx)e.currentTarget.style.background="transparent"}}
              >
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:6}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:700,color:i===selIdx?C.navyM:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</div>
                    <div style={{fontSize:11,color:C.gray,marginTop:2}}>{m.type.toUpperCase()} · {formatBytes(m.size)} · {fmtDate(m.uploadedAt)}</div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();deleteManual(i)}} style={{background:"none",border:"none",cursor:"pointer",color:"#D1D5DB",fontSize:14,flexShrink:0,padding:"2px 4px"}} title="삭제">✕</button>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── 오른쪽: 탭 콘텐츠 ── */}
      <div style={{display:"flex",flexDirection:"column",background:"#F8FAFC"}}>
        {/* 탭 */}
        <div style={{background:"#fff",borderBottom:"1px solid #E5E7EB",display:"flex",gap:0,padding:"0 20px"}}>
          {[["chat","💬 AI 질의응답"],["search","🔍 전체 검색"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:"12px 18px",border:"none",background:"none",fontSize:14,fontWeight:700,cursor:"pointer",color:tab===id?C.navyM:"#6B7280",borderBottom:tab===id?`3px solid ${C.navyM}`:"3px solid transparent",marginBottom:-1}}>
              {lbl}
            </button>
          ))}
        </div>

        {/* ── 질의응답 탭 ── */}
        {tab==="chat" && <>
          {manuals[selIdx] && (
            <div style={{padding:"10px 20px",background:C.navyL,borderBottom:"1px solid #C7D2FE",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>📖</span>
              <div>
                <span style={{fontSize:13.5,fontWeight:700,color:C.navyM}}>{manuals[selIdx].name}</span>
                <span style={{fontSize:12,color:C.gray,marginLeft:8}}>기반 응답</span>
              </div>
            </div>
          )}

          <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
            {messages.map((m,i)=>(
              <div key={i} style={{display:"flex",gap:10,flexDirection:m.role==="user"?"row-reverse":"row",alignItems:"flex-start"}}>
                <div style={{width:34,height:34,borderRadius:10,background:m.role==="user"?C.navyM:"#E5E7EB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                  {m.role==="user"?"👤":"🤖"}
                </div>
                <div style={{maxWidth:"80%",padding:"12px 16px",borderRadius:m.role==="user"?"14px 4px 14px 14px":"4px 14px 14px 14px",background:m.role==="user"?C.navyM:"#fff",color:m.role==="user"?"#fff":"#111827",fontSize:14,lineHeight:1.7,whiteSpace:"pre-wrap",border:m.role==="assistant"?"1px solid #E5E7EB":"none",boxShadow:m.role==="assistant"?"0 1px 3px rgba(0,0,0,.05)":"none"}}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{width:34,height:34,borderRadius:10,background:"#E5E7EB",display:"flex",alignItems:"center",justifyContent:"center"}}>🤖</div>
                <div style={{padding:"14px 18px",borderRadius:"4px 14px 14px 14px",background:"#fff",border:"1px solid #E5E7EB",display:"flex",gap:5,alignItems:"center"}}>
                  {[0,1,2].map(j=><div key={j} style={{width:8,height:8,borderRadius:"50%",background:C.navyM,animation:`bounce 1.2s ${j*0.2}s infinite`}}/>)}
                </div>
              </div>
            )}
          </div>

          {/* 퀵 질문 */}
          {messages.length<=1&&(
            <div style={{padding:"0 20px 12px",display:"flex",flexWrap:"wrap",gap:7}}>
              {QUICK.map((q,i)=>(
                <button key={i} onClick={()=>send(q)} style={{padding:"7px 13px",background:"#fff",color:C.navyM,border:`1.5px solid ${C.navyM}44`,borderRadius:20,fontSize:13,fontWeight:600,cursor:"pointer",transition:"all .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background=C.navyL}}
                  onMouseLeave={e=>{e.currentTarget.style.background="#fff"}}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div style={{padding:"12px 20px",borderTop:"1px solid #E5E7EB",background:"#fff",display:"flex",gap:8}}>
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}}
              placeholder={manuals[selIdx]?"업무 매뉴얼 관련 질문... (Enter 전송)":"먼저 왼쪽에서 매뉴얼을 업로드하거나 선택하세요."}
              rows={2} disabled={!manuals[selIdx]}
              style={{flex:1,padding:"10px 14px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:14,fontFamily:"inherit",resize:"none",outline:"none",lineHeight:1.5,color:"#111827",background:manuals[selIdx]?"#fff":"#F8FAFC"}}/>
            <button onClick={()=>send()} disabled={!input.trim()||loading||!manuals[selIdx]}
              style={{width:44,background:input.trim()&&!loading&&manuals[selIdx]?C.navyM:"#E5E7EB",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontSize:20,transition:"background .15s"}}>↑</button>
          </div>
        </>}

        {/* ── 전체 검색 탭 ── */}
        {tab==="search" && (
          <div style={{flex:1,overflowY:"auto",padding:"20px"}}>
            <div style={S.card()}>
              <div style={{fontSize:16,fontWeight:800,color:"#111827",marginBottom:6}}>🔍 업무 매뉴얼 전체 검색</div>
              <div style={{fontSize:13.5,color:C.gray,marginBottom:16}}>업로드된 모든 매뉴얼에서 키워드를 검색합니다.</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchAll()}
                  placeholder="검색어를 입력하세요... (예: 결재 절차, 외주비 정산)"
                  style={{flex:1,padding:"11px 14px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:14,fontFamily:"inherit",outline:"none"}}/>
                <button onClick={searchAll} disabled={!searchQ.trim()||searchLoading} style={{...S.btn(),padding:"11px 20px",opacity:!searchQ.trim()||searchLoading?.6:1}}>
                  {searchLoading?"검색 중...":"검색"}
                </button>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:searchRes?16:0}}>
                {["결재 프로세스","계약 체결","외주비 정산","실행계획서","업무 분장","양식 다운로드"].map(kw=>(
                  <button key={kw} onClick={()=>{setSearchQ(kw);}} style={{padding:"5px 12px",background:"#F3F4F6",color:"#374151",border:"none",borderRadius:20,fontSize:13,cursor:"pointer"}}>{kw}</button>
                ))}
              </div>
            </div>
            {searchLoading&&<div style={{textAlign:"center",padding:"30px",color:C.gray}}>🤖 매뉴얼 분석 중...</div>}
            {searchRes&&(
              <div style={S.card()}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#111827"}}>검색 결과</div>
                <div style={{fontSize:14,lineHeight:1.8,color:"#374151",whiteSpace:"pre-wrap"}}>{searchRes}</div>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
    </div>
  )
}
