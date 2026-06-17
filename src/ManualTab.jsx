// ══════════════════════════════════════════════════════════════
// 📚 업무매뉴얼 v2 — 목차·결재선·절차·양식첨부 완전판
// ══════════════════════════════════════════════════════════════
import { useState, useMemo, useRef } from "react"

const C={navyM:"#3B72F6",navyL:"#EEF3FF",navy:"#1A3B6E",green:"#0EA86E",greenL:"#E6F9F2",amber:"#F59E0B",amberL:"#FEF3C7",red:"#EF4444",redL:"#FEE2E2",gray:"#6B7280",grayL:"#F3F4F6"}
const now=()=>new Date().toISOString()
const fmtDT=iso=>iso?new Date(iso).toLocaleString("ko-KR",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):""
const uid=()=>`id_${Date.now()}_${Math.random().toString(36).slice(2,7)}`

// ── 섹션 타입 정의 ───────────────────────────────────────────
const SEC_TYPES=[
  {type:"heading", label:"📌 소제목", color:"#1A3B6E"},
  {type:"text",    label:"📝 본문",   color:"#374151"},
  {type:"steps",   label:"🔢 절차단계",color:"#3B72F6"},
  {type:"warning", label:"⚠ 주의",   color:"#F59E0B"},
  {type:"table",   label:"📊 표",     color:"#0EA86E"},
  {type:"link",    label:"🔗 링크",   color:"#534AB7"},
  {type:"approval",label:"📋 결재선", color:"#D85A30"},
  {type:"form",    label:"📎 양식첨부",color:"#6B7280"},
]

// ── 기본 매뉴얼 데이터 ──────────────────────────────────────
const DEFAULT_DATA={
  categories:[
    {id:"C001",name:"🏗 설계 프로세스",order:1},
    {id:"C002",name:"💰 계약 및 수주",order:2},
    {id:"C003",name:"📊 실행계획서",order:3},
    {id:"C004",name:"🤝 협력업체 관리",order:4},
    {id:"C005",name:"📋 결재 및 보고",order:5},
    {id:"C006",name:"💧 수금 및 기성",order:6},
    {id:"C007",name:"💸 지출 및 외주비",order:7},
    {id:"C008",name:"📁 자료관리",order:8},
  ],
  pages:[
    {
      id:"P001",categoryId:"C007",title:"외주용역비 지출 프로세스",
      order:1,updatedAt:now(),updatedBy:"관리자",
      toc:true,
      sections:[
        {id:uid(),type:"approval",content:JSON.stringify({
          drafter:"PM(담당자)",
          approvers:["본부장","상무이사","대표이사"],
          collaborators:["운영지원본부"],
          viewers:["경영관리팀"]
        })},
        {id:uid(),type:"heading",content:"개요"},
        {id:uid(),type:"text",content:"협력업체 외주용역비 지출 시 반드시 사전 품의를 거쳐 결재를 득한 후 지급합니다. 계약 외 추가 비용 발생 시에도 동일한 절차를 따릅니다."},
        {id:uid(),type:"heading",content:"지출 절차"},
        {id:uid(),type:"steps",content:JSON.stringify([
          {id:uid(),title:"지출품의서 작성",desc:"담당 PM이 양식에 따라 지출품의서 작성 (협력업체명, 금액, 사유 명기)"},
          {id:uid(),title:"수기결재 (견적 첨부)",desc:"결재선에 따라 수기 결재 진행. 견적서 반드시 첨부"},
          {id:uid(),title:"운영지원본부 전달",desc:"결재 완료된 품의서 + 견적서를 운영지원본부에 전달"},
          {id:uid(),title:"세금계산서 수취",desc:"협력업체로부터 세금계산서 수취 후 운영지원본부 제출"},
          {id:uid(),title:"대금 지급 확인",desc:"입금 처리 완료 여부 확인 및 시스템 지급 기록 등록"},
        ])},
        {id:uid(),type:"warning",content:"⚠ 500만원 이상 지출 시 반드시 3개사 이상 견적 비교표 첨부 필요\n⚠ 전자세금계산서 발행 기한 준수 (공급일 다음달 10일까지)"},
        {id:uid(),type:"heading",content:"관련 양식"},
        {id:uid(),type:"form",content:JSON.stringify([
          {name:"지출품의서",desc:"외주용역비 지출 결재 양식",fileData:null,fileName:null},
          {name:"외주비 비교검토표",desc:"3개사 견적 비교 양식",fileData:null,fileName:null},
        ])},
      ]
    },
    {
      id:"P002",categoryId:"C002",title:"설계용역 계약 체결 프로세스",
      order:1,updatedAt:now(),updatedBy:"관리자",
      toc:true,
      sections:[
        {id:uid(),type:"approval",content:JSON.stringify({
          drafter:"담당PM",
          approvers:["본부장","상무이사","대표이사"],
          collaborators:["운영지원본부","경영관리팀"],
          viewers:[]
        })},
        {id:uid(),type:"heading",content:"계약 체결 절차"},
        {id:uid(),type:"steps",content:JSON.stringify([
          {id:uid(),title:"제안서 제출 및 수주 확정",desc:"발주처 협의 완료 후 수주 확정 통보 수령"},
          {id:uid(),title:"계약서 초안 작성",desc:"표준계약서 기반으로 작성. 시스템 📄 계약서 탭 활용"},
          {id:uid(),title:"내부 결재",desc:"본부장 → 상무이사 → 대표이사 결재"},
          {id:uid(),title:"발주처 계약서 검토",desc:"발주처 법무 검토 후 수정사항 협의"},
          {id:uid(),title:"계약서 서명·날인",desc:"양측 날인 완료 후 각 1부 보관"},
          {id:uid(),title:"계약금(10%) 수령 확인",desc:"입금 확인 후 시스템에 수주 등록"},
          {id:uid(),title:"실행계획서 작성 착수",desc:"시스템 프로젝트 탭에서 실행계획서 첫 회차 등록"},
        ])},
        {id:uid(),type:"warning",content:"⚠ 설계비 5억 이상, 해외 프로젝트, 특수 조건 포함 시 법무검토 필수"},
      ]
    },
    {
      id:"P003",categoryId:"C003",title:"실행계획서 작성 가이드",
      order:1,updatedAt:now(),updatedBy:"관리자",toc:true,
      sections:[
        {id:uid(),type:"heading",content:"실행계획서 목적"},
        {id:uid(),type:"text",content:"프로젝트별 비용구조(인건비·외주비·간접비·이윤)를 사전 계획하여 목표 이윤율을 달성하기 위한 경영 도구입니다."},
        {id:uid(),type:"heading",content:"작성 절차"},
        {id:uid(),type:"steps",content:JSON.stringify([
          {id:uid(),title:"시스템 접속 → 프로젝트 탭",desc:"해당 프로젝트 선택 후 상세 화면 진입"},
          {id:uid(),title:"회차 추가 또는 엑셀 업로드",desc:"'+ 회차 추가' 버튼 또는 실행계획서 엑셀 업로드"},
          {id:uid(),title:"직접인건비·직접경비 입력",desc:"기본정보·비용 탭에서 각 항목 입력"},
          {id:uid(),title:"협력업체 외주비 입력",desc:"협력업체 외주비 탭에서 분야별 업체·금액 등록"},
          {id:uid(),title:"이윤율 확인",desc:"목표: 용역비의 8% 이상. 5% 미만 시 본부장 보고"},
          {id:uid(),title:"보고서 다운로드 및 결재 상신",desc:"Word 보고서 생성 후 내부 결재 진행"},
        ])},
        {id:uid(),type:"warning",content:"⚠ 이윤율 5% 미만: 본부장 보고 후 진행\n⚠ 변경 실행계획서: 기존 회차에 새 회차 추가 등록"},
      ]
    },
    {
      id:"P004",categoryId:"C006",title:"수금(기성) 관리 절차",
      order:1,updatedAt:now(),updatedBy:"관리자",toc:true,
      sections:[
        {id:uid(),type:"heading",content:"수금 입력 경로"},
        {id:uid(),type:"text",content:"수금 정보 입력은 반드시 프로젝트 상세에서 진행합니다. 입력된 정보는 전사 대시보드와 월수금계획 탭에 자동 반영됩니다."},
        {id:uid(),type:"steps",content:JSON.stringify([
          {id:uid(),title:"프로젝트 탭 → 프로젝트 선택",desc:"해당 프로젝트 상세 화면 진입"},
          {id:uid(),title:"'연도별 월수금계획(기성)' 카드 확인",desc:"계획 입력 버튼 클릭"},
          {id:uid(),title:"연도별 입금(실적) 입력",desc:"실제 입금된 달에 금액 입력 (청구일 기준 아님)"},
          {id:uid(),title:"전사 반영 확인",desc:"경영분석 탭 및 월수금계획 탭에서 자동 집계 확인"},
        ])},
        {id:uid(),type:"warning",content:"⚠ 입금실적은 실제 입금 날짜 기준 월에 입력\n⚠ 과거 월의 계획기성 입력 불가 (시스템 자동 비활성화)"},
      ]
    },
  ]
}

const STORE="sjs_manual_v2"
const loadData=()=>{try{const d=localStorage.getItem(STORE);return d?JSON.parse(d):null}catch{return null}}
const saveData=d=>{try{localStorage.setItem(STORE,JSON.stringify(d))}catch{}}

export function ManualTab({currentUser}){
  const [data,setDataRaw]=useState(()=>loadData()||DEFAULT_DATA)
  const setData=d=>{const n=typeof d==="function"?d(data):d;saveData(n);setDataRaw(n)}

  const [selCat,setSelCat]=useState(data.categories[0]?.id||"")
  const [selPage,setSelPage]=useState(null)
  const [editMode,setEditMode]=useState(false)
  const [search,setSearch]=useState("")
  const [editCat,setEditCat]=useState(false)

  const canEdit=currentUser?.role==="admin"||currentUser?.write===true

  const catPages=useMemo(()=>
    data.pages.filter(p=>p.categoryId===selCat).sort((a,b)=>a.order-b.order)
  ,[data.pages,selCat])

  const currentPage=selPage?data.pages.find(p=>p.id===selPage):(catPages[0]||null)

  const searchResults=useMemo(()=>{
    if(!search.trim())return[]
    const q=search.toLowerCase()
    return data.pages.flatMap(page=>{
      const cat=data.categories.find(c=>c.id===page.categoryId)
      const hits=[]
      if(page.title.toLowerCase().includes(q))hits.push({page,cat,excerpt:page.title})
      page.sections.forEach(s=>{
        let txt=s.content||""
        if(s.type==="steps"){try{JSON.parse(txt).forEach(st=>{if(st.title?.toLowerCase().includes(q)||st.desc?.toLowerCase().includes(q))hits.push({page,cat,excerpt:`${st.title}: ${st.desc?.slice(0,60)}`})})}catch{}}
        else if(txt.toLowerCase().includes(q)){const i=txt.toLowerCase().indexOf(q);hits.push({page,cat,excerpt:"..."+txt.slice(Math.max(0,i-20),i+60)+"..."})}
      })
      return hits.slice(0,3)
    })
  },[search,data])

  const savePage=updated=>{
    setData(prev=>({...prev,pages:prev.pages.map(p=>p.id===updated.id?{...updated,updatedAt:now(),updatedBy:currentUser?.name||"관리자"}:p)}))
    setEditMode(false)
  }

  const addPage=()=>{
    const id=uid()
    setData(prev=>({...prev,pages:[...prev.pages,{id,categoryId:selCat,title:"새 페이지",order:catPages.length+1,updatedAt:now(),updatedBy:currentUser?.name,toc:true,sections:[
      {id:uid(),type:"heading",content:"개요"},
      {id:uid(),type:"text",content:"내용을 입력하세요."},
    ]}]}))
    setSelPage(id);setEditMode(true)
  }

  const deletePage=id=>{
    if(!window.confirm("페이지를 삭제하시겠습니까?"))return
    setData(prev=>({...prev,pages:prev.pages.filter(p=>p.id!==id)}))
    setSelPage(null)
  }

  const moveCat=(i,d)=>setData(prev=>{
    const cats=[...prev.categories].sort((a,b)=>a.order-b.order)
    const j=i+d;if(j<0||j>=cats.length)return prev
    const a=[...cats];[a[i].order,a[j].order]=[a[j].order,a[i].order]
    return{...prev,categories:a}
  })

  const S={inp:{width:"100%",padding:"9px 12px",border:"1.5px solid #E5E7EB",borderRadius:9,fontSize:14,boxSizing:"border-box",fontFamily:"inherit",outline:"none"},
    btn:(bg="#3B72F6",fg="#fff")=>({padding:"8px 16px",background:bg,color:fg,border:"none",borderRadius:9,fontSize:13.5,fontWeight:700,cursor:"pointer"})}

  return (
    <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:0,height:"calc(100vh-140px)",minHeight:600}}>

      {/* ── 사이드바 ── */}
      <div style={{background:"#fff",borderRight:"1px solid #E5E7EB",display:"flex",flexDirection:"column",borderRadius:"14px 0 0 14px",overflow:"hidden"}}>
        <div style={{padding:"14px 12px",borderBottom:"1px solid #F3F4F6",display:"flex",gap:7,alignItems:"center"}}>
          <div style={{flex:1,position:"relative"}}>
            <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",fontSize:13}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="검색..."
              style={{...S.inp,padding:"8px 9px 8px 28px",fontSize:13}}/>
          </div>
          {canEdit&&<button onClick={()=>setEditCat(v=>!v)} style={{...S.btn("#F3F4F6","#374151"),padding:"7px 9px",fontSize:12}} title="카테고리 관리">⚙</button>}
        </div>

        {/* 카테고리 관리 모드 */}
        {editCat&&canEdit&&(
          <div style={{padding:"10px",background:"#FEF9EE",borderBottom:"1px solid #E5E7EB"}}>
            <div style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:7}}>⚙ 카테고리 순서 편집</div>
            {[...data.categories].sort((a,b)=>a.order-b.order).map((cat,i,arr)=>(
              <div key={cat.id} style={{display:"flex",gap:4,alignItems:"center",marginBottom:4}}>
                <div style={{display:"flex",flexDirection:"column",gap:1}}>
                  <button onClick={()=>moveCat(i,-1)} disabled={i===0} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:10,lineHeight:1,padding:"1px 4px",opacity:i===0?.3:1}}>▲</button>
                  <button onClick={()=>moveCat(i,1)} disabled={i===arr.length-1} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:10,lineHeight:1,padding:"1px 4px",opacity:i===arr.length-1?.3:1}}>▼</button>
                </div>
                <input defaultValue={cat.name} onBlur={e=>setData(prev=>({...prev,categories:prev.categories.map(c=>c.id===cat.id?{...c,name:e.target.value}:c)}))}
                  style={{flex:1,padding:"4px 7px",border:"1px solid #E5E7EB",borderRadius:6,fontSize:12,fontFamily:"inherit"}}/>
              </div>
            ))}
            <button onClick={()=>{const id=uid();setData(prev=>({...prev,categories:[...prev.categories,{id,name:"새 카테고리",order:prev.categories.length+1}]}))}}
              style={{...S.btn(C.navyL,C.navyM),width:"100%",justifyContent:"center",padding:"5px",fontSize:12,marginTop:4}}>+ 카테고리 추가</button>
          </div>
        )}

        {/* 카테고리·페이지 목록 */}
        <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
          {!search.trim()
            ? [...data.categories].sort((a,b)=>a.order-b.order).map(cat=>(
              <div key={cat.id}>
                <button onClick={()=>{setSelCat(cat.id);setSelPage(null)}}
                  style={{width:"100%",textAlign:"left",padding:"9px 12px",border:"none",borderRadius:9,marginBottom:2,cursor:"pointer",fontSize:13.5,fontWeight:700,
                    background:selCat===cat.id?"#EEF3FF":"transparent",color:selCat===cat.id?C.navyM:"#374151",transition:"all .12s"}}
                  onMouseEnter={e=>{if(selCat!==cat.id)e.currentTarget.style.background="#F8FAFC"}}
                  onMouseLeave={e=>{if(selCat!==cat.id)e.currentTarget.style.background="transparent"}}>
                  {cat.name}
                </button>
                {selCat===cat.id&&[...catPages].map((page,pi)=>(
                  <button key={page.id} onClick={()=>setSelPage(page.id)}
                    style={{width:"100%",textAlign:"left",padding:"7px 12px 7px 22px",border:"none",borderRadius:8,marginBottom:1,cursor:"pointer",fontSize:13,
                      background:currentPage?.id===page.id?"#EEF3FF":"transparent",color:currentPage?.id===page.id?C.navyM:"#6B7280",fontWeight:currentPage?.id===page.id?700:400}}>
                    └ {page.title}
                  </button>
                ))}
                {selCat===cat.id&&canEdit&&(
                  <button onClick={addPage}
                    style={{width:"100%",textAlign:"left",padding:"5px 12px 5px 22px",border:"none",background:"transparent",cursor:"pointer",fontSize:12,color:"#9CA3AF",marginBottom:4}}
                    onMouseEnter={e=>e.currentTarget.style.color=C.navyM}
                    onMouseLeave={e=>e.currentTarget.style.color="#9CA3AF"}>
                    + 페이지 추가
                  </button>
                )}
              </div>
            ))
            : searchResults.map((r,i)=>(
              <button key={i} onClick={()=>{setSelCat(r.cat?.id||"");setSelPage(r.page.id);setSearch("")}}
                style={{width:"100%",textAlign:"left",padding:"9px 12px",border:"none",borderRadius:10,marginBottom:5,cursor:"pointer",background:"#F8FAFC",color:"#111827"}}>
                <div style={{fontSize:11.5,color:C.navyM,fontWeight:700,marginBottom:2}}>{r.cat?.name}</div>
                <div style={{fontSize:13.5,fontWeight:700,marginBottom:3}}>{r.page.title}</div>
                <div style={{fontSize:11.5,color:"#6B7280",lineHeight:1.5}}>{r.excerpt}</div>
              </button>
            ))
          }
        </div>
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <div style={{background:"#fff",borderRadius:"0 14px 14px 0",border:"1px solid #E5E7EB",borderLeft:"none",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {!currentPage
          ?<div style={{padding:"60px 40px",textAlign:"center",color:"#6B7280"}}>
            <div style={{fontSize:48,marginBottom:12}}>📚</div>
            <div style={{fontSize:18,fontWeight:700,marginBottom:6}}>업무매뉴얼</div>
            <div style={{fontSize:14}}>왼쪽에서 카테고리와 페이지를 선택하세요.</div>
          </div>
          :editMode
            ?<PageEditor page={currentPage} onSave={savePage} onCancel={()=>setEditMode(false)} currentUser={currentUser}/>
            :<PageViewer page={currentPage} canEdit={canEdit} onEdit={()=>setEditMode(true)} onDelete={canEdit?()=>deletePage(currentPage.id):null}/>
        }
      </div>
    </div>
  )
}

// ── 페이지 뷰어 ─────────────────────────────────────────────
function PageViewer({page,canEdit,onEdit,onDelete}){
  // 목차 생성
  const headings=page.sections.filter(s=>s.type==="heading").map(s=>s.content)

  return(
    <div style={{flex:1,overflowY:"auto",display:"flex"}}>
      {/* 본문 */}
      <div style={{flex:1,padding:"24px 32px",maxWidth:780}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:20}}>
          <div>
            <h1 style={{fontSize:24,fontWeight:800,color:"#111827",margin:"0 0 6px",lineHeight:1.3}}>{page.title}</h1>
            <div style={{fontSize:12,color:"#9CA3AF"}}>최종 수정: {page.updatedBy} · {fmtDT(page.updatedAt)}</div>
          </div>
          {canEdit&&<div style={{display:"flex",gap:7,flexShrink:0}}>
            <button onClick={onEdit} style={{padding:"9px 16px",background:"#EEF3FF",color:C.navyM,border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>✏ 편집</button>
            {onDelete&&<button onClick={onDelete} style={{padding:"9px 16px",background:"#FEE2E2",color:"#EF4444",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>삭제</button>}
          </div>}
        </div>
        {page.sections.map(sec=><SectionView key={sec.id} s={sec}/>)}
      </div>

      {/* 우측 목차 */}
      {page.toc&&headings.length>1&&(
        <div style={{width:180,flexShrink:0,padding:"24px 16px",borderLeft:"1px solid #F3F4F6",position:"sticky",top:0,alignSelf:"flex-start"}}>
          <div style={{fontSize:12,fontWeight:800,color:"#9CA3AF",marginBottom:10,letterSpacing:".05em"}}>목차</div>
          {headings.map((h,i)=>(
            <div key={i} style={{fontSize:12.5,color:"#6B7280",marginBottom:6,lineHeight:1.5,cursor:"pointer",padding:"3px 6px",borderRadius:6}}
              onMouseEnter={e=>{e.currentTarget.style.background="#EEF3FF";e.currentTarget.style.color=C.navyM}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#6B7280"}}>
              {i+1}. {h}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 섹션 렌더러 ─────────────────────────────────────────────
function SectionView({s}){
  switch(s.type){
    case "heading":
      return<h2 style={{fontSize:17,fontWeight:800,color:"#1A3B6E",margin:"28px 0 10px",paddingBottom:6,borderBottom:"2px solid #EEF3FF"}}>{s.content}</h2>
    case "text":
      return<p style={{fontSize:15,lineHeight:1.85,color:"#374151",margin:"0 0 14px",whiteSpace:"pre-wrap"}}>{s.content}</p>
    case "steps":{
      let steps=[]
      try{steps=JSON.parse(s.content)}catch{steps=String(s.content).split("\n").filter(Boolean).map((l,i)=>({id:i,title:l.replace(/^\d+\.\s*/,""),desc:""}))}
      return(
        <div style={{margin:"0 0 20px",position:"relative"}}>
          {/* 연결선 */}
          {steps.length>1&&<div style={{position:"absolute",left:17,top:28,bottom:28,width:2,background:"#E5E7EB"}}/>}
          {steps.map((st,i)=>(
            <div key={st.id||i} style={{display:"flex",gap:14,marginBottom:12,position:"relative",zIndex:1}}>
              <div style={{width:36,height:36,borderRadius:10,background:C.navyM,color:"#fff",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(59,114,246,.3)"}}>
                {i+1}
              </div>
              <div style={{flex:1,background:"#F8FAFC",borderRadius:10,padding:"10px 14px",border:"1px solid #E5E7EB"}}>
                <div style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:st.desc?4:0}}>{st.title}</div>
                {st.desc&&<div style={{fontSize:13.5,color:"#6B7280",lineHeight:1.6}}>{st.desc}</div>}
              </div>
            </div>
          ))}
        </div>
      )
    }
    case "warning":
      return<div style={{background:"#FEF3C7",border:"1px solid #F59E0B",borderRadius:12,padding:"14px 18px",margin:"0 0 16px",fontSize:14.5,color:"#92400E",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{s.content}</div>
    case "table":{
      const rows=String(s.content).split("\n").map(r=>r.split("|"))
      if(!rows.length)return null
      return(
        <div style={{overflowX:"auto",margin:"0 0 18px"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
            <thead><tr>{rows[0].map((h,i)=><th key={i} style={{padding:"10px 14px",background:"#F8FAFC",borderBottom:"2px solid #E5E7EB",textAlign:"left",fontWeight:700,color:"#374151"}}>{h}</th>)}</tr></thead>
            <tbody>{rows.slice(1).map((row,i)=><tr key={i} style={{borderBottom:"1px solid #F3F4F6"}}>{row.map((c,j)=><td key={j} style={{padding:"10px 14px",color:"#374151",lineHeight:1.6}}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
    }
    case "approval":{
      let ap={drafter:"",approvers:[],collaborators:[],viewers:[]}
      try{ap=JSON.parse(s.content)}catch{}
      return(
        <div style={{background:"#EEF3FF",border:"1px solid #3B72F644",borderRadius:12,padding:"14px 18px",margin:"0 0 16px"}}>
          <div style={{fontSize:13,fontWeight:800,color:C.navyM,marginBottom:10}}>📋 결재선</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <ApprovalRole label="기안자" names={[ap.drafter]} color="#374151" bg="#F8FAFC"/>
            {ap.approvers?.map((n,i)=><ApprovalRole key={i} label={`결재 ${i+1}`} names={[n]} color={C.navyM} bg={C.navyL}/>)}
            {ap.collaborators?.length>0&&<ApprovalRole label="협조" names={ap.collaborators} color="#0EA86E" bg="#E6F9F2"/>}
            {ap.viewers?.length>0&&<ApprovalRole label="열람" names={ap.viewers} color="#6B7280" bg="#F3F4F6"/>}
          </div>
        </div>
      )
    }
    case "form":{
      let forms=[]
      try{forms=JSON.parse(s.content)}catch{}
      return(
        <div style={{margin:"0 0 16px"}}>
          <div style={{fontSize:13,fontWeight:800,color:"#6B7280",marginBottom:8}}>📎 관련 양식</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {forms.map((f,i)=>(
              <div key={i} style={{background:"#F8FAFC",border:"1px solid #E5E7EB",borderRadius:10,padding:"10px 14px",minWidth:180}}>
                <div style={{fontSize:14,fontWeight:700,color:"#111827",marginBottom:3}}>{f.name}</div>
                {f.desc&&<div style={{fontSize:12,color:"#6B7280",marginBottom:6}}>{f.desc}</div>}
                {f.fileData
                  ?<a href={f.fileData} download={f.fileName} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 12px",background:C.navyL,color:C.navyM,borderRadius:8,fontSize:12.5,fontWeight:700,textDecoration:"none"}}>⬇ 다운로드</a>
                  :<span style={{fontSize:12,color:"#9CA3AF"}}>파일 미등록</span>}
              </div>
            ))}
          </div>
        </div>
      )
    }
    case "link":{
      const lines=String(s.content).split("\n").filter(Boolean)
      return(
        <div style={{margin:"0 0 14px",display:"flex",flexWrap:"wrap",gap:7}}>
          {lines.map((line,i)=>{
            const[label,url]=line.split("|")
            return url
              ?<a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",background:C.navyL,color:C.navyM,borderRadius:9,fontSize:13.5,fontWeight:700,textDecoration:"none"}}>🔗 {label}</a>
              :<div key={i} style={{fontSize:14,color:"#374151",marginBottom:4}}>{line}</div>
          })}
        </div>
      )
    }
    default:return null
  }
}

function ApprovalRole({label,names,color,bg}){
  return(
    <div style={{textAlign:"center",minWidth:80}}>
      <div style={{fontSize:11,fontWeight:700,color:"#6B7280",marginBottom:4}}>{label}</div>
      {names.filter(Boolean).map((n,i)=>(
        <div key={i} style={{background:bg,color,padding:"8px 12px",borderRadius:9,border:`1.5px solid ${color}33`,fontSize:13,fontWeight:700,marginBottom:3}}>
          {n}
          <div style={{fontSize:18,marginTop:4}}>🖊</div>
        </div>
      ))}
    </div>
  )
}

// ── 페이지 에디터 ────────────────────────────────────────────
function PageEditor({page,onSave,onCancel,currentUser}){
  const[title,setTitle]=useState(page.title)
  const[toc,setToc]=useState(page.toc!==false)
  const[sections,setSections]=useState(page.sections.map(s=>({...s})))
  const fileRef=useRef(null)
  const[fileTarget,setFileTarget]=useState(null)  // {secId, formIdx}

  const addSec=type=>{
    const defs={
      heading:"새 소제목",text:"내용을 입력하세요.",
      warning:"⚠ 주의사항",
      table:"항목|설명|비고\n내용1|설명1|-",
      link:"링크명|https://",
      steps:JSON.stringify([{id:uid(),title:"1단계",desc:"설명"},{id:uid(),title:"2단계",desc:"설명"}]),
      approval:JSON.stringify({drafter:"기안자",approvers:["결재자1"],collaborators:[],viewers:[]}),
      form:JSON.stringify([{name:"양식명",desc:"",fileData:null,fileName:null}]),
    }
    setSections(p=>[...p,{id:uid(),type,content:defs[type]||""}])
  }
  const updSec=(id,k,v)=>setSections(p=>p.map(s=>s.id===id?{...s,[k]:v}:s))
  const delSec=id=>setSections(p=>p.filter(s=>s.id!==id))
  const movSec=(i,d)=>setSections(p=>{const a=[...p];[a[i],a[i+d]]=[a[i+d],a[i]];return a})

  // 양식 파일 업로드
  const uploadForm=async e=>{
    const f=e.target.files?.[0];if(!f||!fileTarget)return
    const reader=new FileReader()
    reader.onload=ev=>{
      setSections(p=>p.map(s=>{
        if(s.id!==fileTarget.secId)return s
        try{
          const forms=JSON.parse(s.content)
          forms[fileTarget.formIdx]={...forms[fileTarget.formIdx],fileData:ev.target.result,fileName:f.name}
          return{...s,content:JSON.stringify(forms)}
        }catch{return s}
      }))
    }
    reader.readAsDataURL(f)
    e.target.value=""
  }

  // 절차 단계 CRUD
  const StepsEditor=({sec})=>{
    let steps=[]
    try{steps=JSON.parse(sec.content)}catch{steps=[]}
    const setSteps=arr=>updSec(sec.id,"content",JSON.stringify(arr))
    return(
      <div>
        {steps.map((st,i)=>(
          <div key={st.id||i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:8,background:"#F8FAFC",borderRadius:10,padding:"10px 12px",border:"1px solid #E5E7EB"}}>
            <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
              <button onClick={()=>{if(i>0){const a=[...steps];[a[i-1],a[i]]=[a[i],a[i-1]];setSteps(a)}}} disabled={i===0} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:11,opacity:i===0?.3:1}}>▲</button>
              <div style={{width:26,height:26,borderRadius:7,background:C.navyM,color:"#fff",fontSize:13,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</div>
              <button onClick={()=>{if(i<steps.length-1){const a=[...steps];[a[i],a[i+1]]=[a[i+1],a[i]];setSteps(a)}}} disabled={i===steps.length-1} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:11,opacity:i===steps.length-1?.3:1}}>▼</button>
            </div>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
              <input value={st.title} onChange={e=>{const a=[...steps];a[i]={...a[i],title:e.target.value};setSteps(a)}}
                placeholder="단계 제목" style={{padding:"6px 10px",border:"1.5px solid #E5E7EB",borderRadius:8,fontSize:14,fontWeight:700,fontFamily:"inherit"}}/>
              <textarea value={st.desc||""} onChange={e=>{const a=[...steps];a[i]={...a[i],desc:e.target.value};setSteps(a)}}
                placeholder="단계 설명 (선택)" rows={2}
                style={{padding:"6px 10px",border:"1.5px solid #E5E7EB",borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical"}}/>
            </div>
            <button onClick={()=>setSteps(steps.filter((_,ri)=>ri!==i))} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:18,flexShrink:0,paddingTop:4}}>✕</button>
          </div>
        ))}
        <button onClick={()=>setSteps([...steps,{id:uid(),title:"새 단계",desc:""}])}
          style={{width:"100%",padding:"9px",background:C.navyL,color:C.navyM,border:"1.5px dashed #3B72F6",borderRadius:9,fontSize:13.5,fontWeight:700,cursor:"pointer"}}>
          + 단계 추가
        </button>
      </div>
    )
  }

  // 결재선 에디터
  const ApprovalEditor=({sec})=>{
    let ap={drafter:"",approvers:[],collaborators:[],viewers:[]}
    try{ap=JSON.parse(sec.content)}catch{}
    const set=patch=>updSec(sec.id,"content",JSON.stringify({...ap,...patch}))
    const arrFld=(key,val,i)=>{const a=[...ap[key]||[]];a[i]=val;set({[key]:a})}
    return(
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[
          ["기안자","drafter",false],
          ["결재자 (순서대로)","approvers",true],
          ["협조자","collaborators",true],
          ["열람자","viewers",true],
        ].map(([label,key,isArr])=>(
          <div key={key}>
            <div style={{fontSize:12,fontWeight:700,color:"#6B7280",marginBottom:5}}>{label}</div>
            {isArr
              ?(ap[key]||[]).map((v,i)=>(
                <div key={i} style={{display:"flex",gap:5,marginBottom:4}}>
                  <input value={v} onChange={e=>arrFld(key,e.target.value,i)} style={{flex:1,padding:"6px 9px",border:"1.5px solid #E5E7EB",borderRadius:7,fontSize:13,fontFamily:"inherit"}}/>
                  <button onClick={()=>set({[key]:(ap[key]||[]).filter((_,ri)=>ri!==i)})} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:15}}>✕</button>
                </div>
              ))
              :<input value={ap[key]||""} onChange={e=>set({[key]:e.target.value})} style={{width:"100%",padding:"6px 9px",border:"1.5px solid #E5E7EB",borderRadius:7,fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
            }
            {isArr&&<button onClick={()=>set({[key]:[...(ap[key]||[]),""]}) } style={{fontSize:12,color:C.navyM,background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>+ 추가</button>}
          </div>
        ))}
      </div>
    )
  }

  // 양식 에디터
  const FormEditor=({sec})=>{
    let forms=[]
    try{forms=JSON.parse(sec.content)}catch{}
    const setForms=arr=>updSec(sec.id,"content",JSON.stringify(arr))
    return(
      <div>
        {forms.map((f,i)=>(
          <div key={i} style={{background:"#F8FAFC",borderRadius:10,padding:"10px 12px",border:"1px solid #E5E7EB",marginBottom:7}}>
            <div style={{display:"flex",gap:7,marginBottom:6}}>
              <input value={f.name} onChange={e=>{const a=[...forms];a[i]={...a[i],name:e.target.value};setForms(a)}} placeholder="양식명" style={{flex:1,padding:"6px 9px",border:"1.5px solid #E5E7EB",borderRadius:7,fontSize:13,fontFamily:"inherit"}}/>
              <button onClick={()=>setForms(forms.filter((_,ri)=>ri!==i))} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:15}}>✕</button>
            </div>
            <input value={f.desc||""} onChange={e=>{const a=[...forms];a[i]={...a[i],desc:e.target.value};setForms(a)}} placeholder="설명" style={{width:"100%",padding:"6px 9px",border:"1.5px solid #E5E7EB",borderRadius:7,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",marginBottom:6}}/>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <button onClick={()=>{setFileTarget({secId:sec.id,formIdx:i});fileRef.current?.click()}}
                style={{padding:"5px 12px",background:C.navyL,color:C.navyM,border:"none",borderRadius:7,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
                📎 {f.fileData?"파일 교체":"파일 첨부"}
              </button>
              {f.fileData&&<span style={{fontSize:12,color:"#0EA86E",fontWeight:600}}>✓ {f.fileName}</span>}
            </div>
          </div>
        ))}
        <button onClick={()=>setForms([...forms,{name:"새 양식",desc:"",fileData:null,fileName:null}])}
          style={{width:"100%",padding:"8px",background:C.navyL,color:C.navyM,border:"1.5px dashed #3B72F6",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>
          + 양식 추가
        </button>
        <input ref={fileRef} type="file" style={{display:"none"}} onChange={uploadForm}/>
      </div>
    )
  }

  const inp2={width:"100%",padding:"8px 11px",border:"1.5px solid #E5E7EB",borderRadius:8,fontSize:14,boxSizing:"border-box",fontFamily:"inherit",outline:"none"}

  return(
    <div style={{flex:1,overflowY:"auto"}}>
      {/* 편집 헤더 */}
      <div style={{padding:"16px 22px",borderBottom:"1px solid #E5E7EB",background:"#FEF9EE",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:13,fontWeight:700,color:C.amber}}>✏ 편집 모드</span>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="페이지 제목"
          style={{...inp2,fontSize:18,fontWeight:800,flex:1,minWidth:200,border:"none",background:"transparent",padding:"4px 0"}}/>
        <label style={{display:"flex",alignItems:"center",gap:5,fontSize:13,cursor:"pointer"}}>
          <input type="checkbox" checked={toc} onChange={e=>setToc(e.target.checked)}/> 목차 표시
        </label>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>onSave({...page,title,toc,sections})} style={{padding:"9px 20px",background:C.navyM,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>✓ 저장</button>
          <button onClick={onCancel} style={{padding:"9px 16px",background:"#F3F4F6",color:"#374151",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>취소</button>
        </div>
      </div>

      <div style={{padding:"18px 22px",maxWidth:820}}>
        {/* 섹션 편집 */}
        {sections.map((sec,i)=>(
          <div key={sec.id} style={{marginBottom:12,border:"1.5px solid #E5E7EB",borderRadius:12,overflow:"hidden",background:"#fff"}}>
            <div style={{display:"flex",alignItems:"center",gap:7,padding:"7px 12px",background:"#F8FAFC",borderBottom:"1px solid #E5E7EB"}}>
              <div style={{display:"flex",flexDirection:"column",gap:1}}>
                <button onClick={()=>i>0&&movSec(i,-1)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:11,lineHeight:1,opacity:i===0?.3:1}}>▲</button>
                <button onClick={()=>i<sections.length-1&&movSec(i,1)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:11,lineHeight:1,opacity:i===sections.length-1?.3:1}}>▼</button>
              </div>
              <select value={sec.type} onChange={e=>updSec(sec.id,"type",e.target.value)}
                style={{padding:"4px 8px",border:"1px solid #E5E7EB",borderRadius:7,fontSize:12,background:"#fff",flex:1}}>
                {SEC_TYPES.map(t=><option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
              <button onClick={()=>delSec(sec.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:16,padding:"0 4px"}}>✕</button>
            </div>
            <div style={{padding:"10px 12px"}}>
              {sec.type==="steps"    ?<StepsEditor   sec={sec}/>
              :sec.type==="approval" ?<ApprovalEditor sec={sec}/>
              :sec.type==="form"     ?<FormEditor    sec={sec}/>
              :<textarea value={sec.content} onChange={e=>updSec(sec.id,"content",e.target.value)}
                  rows={sec.type==="table"?5:3} style={{...inp2,resize:"vertical",lineHeight:1.7}}/>
              }
            </div>
          </div>
        ))}

        {/* 섹션 추가 */}
        <div style={{background:"#F8FAFC",borderRadius:12,padding:"14px 16px",border:"1.5px dashed #E5E7EB"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#6B7280",marginBottom:8}}>+ 섹션 추가</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {SEC_TYPES.map(t=>(
              <button key={t.type} onClick={()=>addSec(t.type)}
                style={{padding:"7px 13px",background:"#fff",color:"#374151",border:"1.5px solid #E5E7EB",borderRadius:9,fontSize:13,fontWeight:600,cursor:"pointer"}}
                onMouseEnter={e=>{e.currentTarget.style.background="#EEF3FF";e.currentTarget.style.color=C.navyM;e.currentTarget.style.borderColor=C.navyM}}
                onMouseLeave={e=>{e.currentTarget.style.background="#fff";e.currentTarget.style.color="#374151";e.currentTarget.style.borderColor="#E5E7EB"}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManualTab
