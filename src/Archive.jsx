import { useState, useMemo, useRef } from "react"
import { uploadFile, db } from "./supabase.js"

const C={navy:"#0C447C",navyM:"#185FA5",navyL:"#E6F1FB",green:"#1D9E75",greenL:"#EAF3DE",amber:"#BA7517",amberL:"#FAEEDA",red:"#A32D2D",redL:"#FCEBEB",gray:"#888780",grayL:"#F1EFE8",dark:"#1A1A2E"}

const CAT={
  "계약서":  {icon:"ti-file-certificate",color:"#185FA5",bg:"#E6F1FB"},
  "도면":    {icon:"ti-ruler-measure",   color:"#1D9E75",bg:"#EAF3DE"},
  "사진":    {icon:"ti-camera",          color:"#BA7517",bg:"#FAEEDA"},
  "회의록":  {icon:"ti-notes",           color:"#534AB7",bg:"#EEECFB"},
  "보고서":  {icon:"ti-report",          color:"#0F6E56",bg:"#E1F5EE"},
  "견적서":  {icon:"ti-receipt",         color:"#D85A30",bg:"#FDE8E1"},
  "인허가":  {icon:"ti-license",         color:"#A32D2D",bg:"#FCEBEB"},
  "설계안전":{icon:"ti-shield-check",    color:"#888780",bg:"#F1EFE8"},
  "기타":    {icon:"ti-folder",          color:"#888780",bg:"#F1EFE8"},
}
const CATS=Object.keys(CAT)
const DEPTS=["설계1본부","설계2본부","디자인본부","주거디자인본부","해외사업부","경영지원"]

const DEMO=[
  {id:"A001",title:"평택고덕 A68BL 기본설계 계약서",category:"계약서",project_id:"P001",dept:"설계2본부",date_created:"2026-01-20",tags:["평택고덕","계약","2026"],file_type:"pdf",file_size_kb:1240,description:"DA 컨소시엄 기본설계 계약 체결서류 일체",thumbnail_url:null,version:"1.0",created_at:"2026-01-20T00:00:00"},
  {id:"A002",title:"평택고덕 A68BL 1층 평면도 (PDF변환)",category:"도면",project_id:"P001",dept:"설계2본부",date_created:"2026-02-10",tags:["평택고덕","도면","평면도"],file_type:"pdf",file_size_kb:8540,description:"1~3층 평면도 PDF 변환본",thumbnail_url:null,version:"2.1",created_at:"2026-02-10T00:00:00"},
  {id:"A003",title:"서부의료원 설계 착수 회의록",category:"회의록",project_id:"P004",dept:"설계1본부",date_created:"2024-12-05",tags:["서부의료원","회의록","착수"],file_type:"docx",file_size_kb:312,description:"착수 킥오프 미팅 전체 회의록",thumbnail_url:null,version:"1.0",created_at:"2024-12-05T00:00:00"},
  {id:"A004",title:"에코델타3BL 협력업체 견적 비교표",category:"견적서",project_id:"P002",dept:"주거디자인본부",date_created:"2026-01-15",tags:["에코델타","견적","2차NEGO"],file_type:"xlsx",file_size_kb:245,description:"구조·기계·전기통신 2차 네고 결과",thumbnail_url:null,version:"2.0",created_at:"2026-01-15T00:00:00"},
  {id:"A005",title:"우즈베키스탄 현장 사진 - 타슈켄트 제약클러스터",category:"사진",project_id:"P003",dept:"해외사업부",date_created:"2025-09-20",tags:["우즈벡","현장사진","감리"],file_type:"jpg",file_size_kb:5120,description:"5차변경 이후 감리 현장 사진",thumbnail_url:null,version:"1.0",created_at:"2025-09-20T00:00:00"},
  {id:"A006",title:"2026년 비상경영 임원회의 회의록 (5월)",category:"회의록",project_id:null,dept:"경영지원",date_created:"2026-05-31",tags:["비상경영","임원회의","2026"],file_type:"pdf",file_size_kb:890,description:"5월 임원회의 안건 및 결의사항",thumbnail_url:null,version:"1.0",created_at:"2026-05-31T00:00:00"},
  {id:"A007",title:"사직야구장 임시구장 당선작 설계보고서",category:"보고서",project_id:"P005",dept:"디자인본부",date_created:"2026-05-29",tags:["사직야구장","당선","공모"],file_type:"pdf",file_size_kb:24800,description:"당선작 설계개념 및 심사 결과 보고",thumbnail_url:null,version:"1.0",created_at:"2026-05-29T00:00:00"},
  {id:"A008",title:"건축사 자격증 현황 (2026.06)",category:"기타",project_id:null,dept:"경영지원",date_created:"2026-06-01",tags:["인사","자격증"],file_type:"xlsx",file_size_kb:88,description:"전 직원 보유 자격증 목록",thumbnail_url:null,version:"1.0",created_at:"2026-06-01T00:00:00"},
  {id:"A009",title:"서부산행정복합타운 사업계획서",category:"보고서",project_id:"P005",dept:"설계1본부",date_created:"2026-04-10",tags:["서부산","사업계획"],file_type:"pdf",file_size_kb:3200,description:"합사 운영 제안 포함 사업계획서",thumbnail_url:null,version:"1.2",created_at:"2026-04-10T00:00:00"},
  {id:"A010",title:"2026 상반기 인허가 현황 보고",category:"인허가",project_id:null,dept:"경영지원",date_created:"2026-06-01",tags:["인허가","상반기","보고"],file_type:"xlsx",file_size_kb:182,description:"전 프로젝트 인허가 단계별 현황",thumbnail_url:null,version:"1.0",created_at:"2026-06-01T00:00:00"},
]

function fSize(kb){return kb<1024?kb+"KB":(kb/1024).toFixed(1)+"MB"}

export function ArchiveTab({currentUser,projects}){
  const [items,setItems]=useState(DEMO)
  const [view,setView]=useState("grid")
  const [zoom,setZoom]=useState("m")
  const [selCat,setSelCat]=useState("")
  const [selProj,setSelProj]=useState("")
  const [selDept,setSelDept]=useState("")
  const [search,setSearch]=useState("")
  const [selItem,setSelItem]=useState(null)
  const [showUpload,setShowUpload]=useState(false)

  const filtered=useMemo(()=>{
    let r=[...items]
    if(selCat) r=r.filter(i=>i.category===selCat)
    if(selProj)r=r.filter(i=>i.project_id===selProj)
    if(selDept)r=r.filter(i=>i.dept===selDept)
    if(search) r=r.filter(i=>i.title.includes(search)||i.description?.includes(search)||i.tags?.some(t=>t.includes(search)))
    return r.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
  },[items,selCat,selProj,selDept,search])

  const timeGroups=useMemo(()=>{
    const g={}
    filtered.forEach(it=>{const k=(it.date_created||it.created_at.slice(0,10)).slice(0,7);if(!g[k])g[k]=[];g[k].push(it)})
    return Object.entries(g).sort(([a],[b])=>b.localeCompare(a))
  },[filtered])

  const stats=useMemo(()=>CATS.reduce((a,c)=>{a[c]=items.filter(i=>i.category===c).length;return a},{}),[items])
  const CW={s:140,m:200,l:280}

  return(
    <div style={{minHeight:"80vh"}}>
      {/* 배너 */}
      <div style={{background:`linear-gradient(135deg,${C.dark} 0%,#16213E 50%,#0F3460 100%)`,borderRadius:14,padding:"28px 32px",marginBottom:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(circle at 20% 50%,rgba(24,95,165,.2) 0%,transparent 50%),radial-gradient(circle at 80% 20%,rgba(29,158,117,.15) 0%,transparent 40%)`,pointerEvents:"none"}}/>
        <div style={{position:"relative"}}>
          <div style={{fontSize:10,letterSpacing:3,color:"#85B7EB",marginBottom:6,fontWeight:500,textTransform:"uppercase"}}>상지서울건축사사무소</div>
          <div style={{fontSize:26,fontWeight:600,color:"#fff",marginBottom:5,letterSpacing:-1}}>아카이브</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.6)",marginBottom:18}}>프로젝트 문서 · 도면 · 계약서 · 회의록 · 사진 통합 관리</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {CATS.map(cat=>{
              const cfg=CAT[cat];const on=selCat===cat
              return <button key={cat} onClick={()=>setSelCat(s=>s===cat?"":cat)}
                style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:20,border:`1px solid ${on?"#fff":"rgba(255,255,255,.2)"}`,background:on?"rgba(255,255,255,.2)":"rgba(255,255,255,.06)",cursor:"pointer"}}>
                <i className={`ti ${cfg.icon}`} style={{fontSize:12,color:on?"#fff":cfg.color}} aria-hidden="true"/>
                <span style={{fontSize:11,color:on?"#fff":"rgba(255,255,255,.7)",fontWeight:on?600:400}}>{cat}</span>
                <span style={{fontSize:9,color:"rgba(255,255,255,.4)",background:"rgba(0,0,0,.3)",borderRadius:8,padding:"0 4px"}}>{stats[cat]||0}</span>
              </button>
            })}
          </div>
        </div>
      </div>

      {/* 툴바 */}
      <div style={{display:"flex",gap:7,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:180,position:"relative"}}>
          <i className="ti ti-search" style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.gray,fontSize:13}} aria-hidden="true"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="제목·태그·내용 검색…"
            style={{width:"100%",padding:"7px 9px 7px 30px",border:"0.5px solid var(--color-border-secondary,#ddd)",borderRadius:9,fontSize:12,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}/>
        </div>
        <select value={selProj} onChange={e=>setSelProj(e.target.value)} style={{padding:"6px 9px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:11,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)",maxWidth:160}}>
          <option value="">전체 프로젝트</option>
          {(projects||[]).map(p=><option key={p.id} value={p.id}>{p.name.slice(0,18)}</option>)}
        </select>
        <select value={selDept} onChange={e=>setSelDept(e.target.value)} style={{padding:"6px 9px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:11,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#333)"}}>
          <option value="">전체 본부</option>{DEPTS.map(d=><option key={d} value={d}>{d.replace("본부","").replace("사업부","")}</option>)}
        </select>
        <div style={{display:"flex",gap:1,border:"0.5px solid var(--color-border-secondary,#ddd)",borderRadius:8,overflow:"hidden"}}>
          {[["grid","ti-layout-grid"],["timeline","ti-timeline"],["list","ti-list"]].map(([v,ic])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"6px 10px",border:"none",background:view===v?C.navyM:"var(--color-background-primary,#fff)",color:view===v?"#fff":C.gray,cursor:"pointer"}}><i className={`ti ${ic}`} aria-hidden="true"/></button>
          ))}
        </div>
        {view==="grid"&&<div style={{display:"flex",gap:1,border:"0.5px solid var(--color-border-secondary,#ddd)",borderRadius:8,overflow:"hidden"}}>
          {[["s","S"],["m","M"],["l","L"]].map(([v,l])=>(
            <button key={v} onClick={()=>setZoom(v)} style={{padding:"5px 9px",border:"none",background:zoom===v?C.navyL:"var(--color-background-primary,#fff)",color:zoom===v?C.navyM:C.gray,cursor:"pointer",fontSize:11,fontWeight:zoom===v?600:400}}>{l}</button>
          ))}
        </div>}
        <span style={{fontSize:11,color:C.gray}}>{filtered.length}개</span>
        {(currentUser?.can_write||currentUser?.role==="admin")&&
          <button onClick={()=>setShowUpload(true)} style={{padding:"7px 13px",background:C.navyM,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
            <i className="ti ti-upload" aria-hidden="true"/>문서 추가
          </button>}
      </div>

      {/* 그리드 */}
      {view==="grid"&&<div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${CW[zoom]}px,1fr))`,gap:11}}>
        {filtered.map(it=><ACard key={it.id} item={it} zoom={zoom} onClick={()=>setSelItem(it)}/>)}
        {!filtered.length&&<NoData/>}
      </div>}

      {/* 타임라인 */}
      {view==="timeline"&&<div style={{position:"relative",paddingLeft:22}}>
        <div style={{position:"absolute",left:7,top:0,bottom:0,width:2,background:`linear-gradient(to bottom,${C.navyM},${C.navyL})`,borderRadius:1}}/>
        {timeGroups.map(([month,mis])=>(
          <div key={month} style={{marginBottom:28,position:"relative"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{width:14,height:14,borderRadius:"50%",background:C.navyM,border:"3px solid var(--color-background-tertiary,#f5f5f5)",position:"absolute",left:-3,top:3}}/>
              <div style={{marginLeft:18,background:C.navyM,color:"#fff",padding:"3px 11px",borderRadius:20,fontSize:11,fontWeight:600}}>
                {month.replace("-","년 ")}월 ({mis.length}건)
              </div>
            </div>
            <div style={{marginLeft:20,display:"flex",gap:9,flexWrap:"wrap"}}>
              {mis.map(it=><ACard key={it.id} item={it} zoom="s" onClick={()=>setSelItem(it)} compact/>)}
            </div>
          </div>
        ))}
        {!timeGroups.length&&<NoData/>}
      </div>}

      {/* 리스트 */}
      {view==="list"&&<div style={{background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:"var(--color-background-secondary,#f8f8f6)"}}>
            {["분류","제목","프로젝트","본부","날짜","버전","크기"].map((h,i)=><th key={h} style={{padding:"9px 11px",textAlign:i===0?"center":"left",fontSize:11,fontWeight:500,color:"var(--color-text-secondary,#888)",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",whiteSpace:"nowrap"}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((it,i)=>{
              const cfg=CAT[it.category]||CAT["기타"]
              const proj=(projects||[]).find(p=>p.id===it.project_id)
              return <tr key={it.id} onClick={()=>setSelItem(it)}
                style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(24,95,165,.04)"}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}>
                <td style={{padding:"8px 11px",textAlign:"center"}}>
                  <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:7,background:cfg.bg}}>
                    <i className={`ti ${cfg.icon}`} style={{fontSize:13,color:cfg.color}} aria-hidden="true"/>
                  </span>
                </td>
                <td style={{padding:"8px 11px"}}>
                  <div style={{fontSize:13,fontWeight:500}}>{it.title}</div>
                  {it.description&&<div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginTop:2}}>{it.description.slice(0,55)}</div>}
                  <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                    {(it.tags||[]).slice(0,3).map(t=><span key={t} style={{fontSize:9,padding:"1px 5px",borderRadius:5,background:"var(--color-background-secondary,#f0f0ee)",color:"var(--color-text-secondary,#888)"}}>{t}</span>)}
                  </div>
                </td>
                <td style={{padding:"8px 11px",fontSize:12,color:"var(--color-text-secondary,#888)"}}>{proj?.name?.slice(0,16)||"-"}</td>
                <td style={{padding:"8px 11px",fontSize:12}}>{it.dept||"-"}</td>
                <td style={{padding:"8px 11px",fontSize:12}}>{it.date_created||"-"}</td>
                <td style={{padding:"8px 11px",fontSize:12,color:C.navyM}}>{it.version}</td>
                <td style={{padding:"8px 11px",fontSize:11,color:"var(--color-text-secondary,#888)"}}>{it.file_size_kb?fSize(it.file_size_kb):"-"}</td>
              </tr>
            })}
          </tbody>
        </table>
        {!filtered.length&&<div style={{padding:"40px 20px",textAlign:"center"}}><NoData/></div>}
      </div>}

      {selItem&&<DetailModal item={selItem} projects={projects} onClose={()=>setSelItem(null)} onDelete={id=>{setItems(p=>p.filter(x=>x.id!==id));setSelItem(null)}} currentUser={currentUser}/>}
      {showUpload&&<UploadModal projects={projects} onClose={()=>setShowUpload(false)} onSave={it=>{setItems(p=>[it,...p]);setShowUpload(false)}} currentUser={currentUser}/>}
    </div>
  )
}

function ACard({item,zoom,onClick,compact}){
  const cfg=CAT[item.category]||CAT["기타"]
  const H={s:60,m:96,l:136}
  return(
    <div onClick={onClick} style={{borderRadius:11,overflow:"hidden",cursor:"pointer",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",background:"var(--color-background-primary,#fff)",transition:"transform .15s,box-shadow .15s",display:"flex",flexDirection:"column"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,.1)"}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
      {!compact&&<div style={{height:H[zoom]||H.m,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",flexShrink:0}}>
        {item.thumbnail_url
          ?<img src={item.thumbnail_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          :<i className={`ti ${cfg.icon}`} style={{fontSize:H[zoom]*0.35,color:cfg.color,opacity:.55}} aria-hidden="true"/>}
        <span style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,.5)",color:"#fff",borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:600,textTransform:"uppercase"}}>{item.file_type||"?"}</span>
      </div>}
      <div style={{padding:compact?"5px 7px":"8px 10px",flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:compact?2:4}}>
          <span style={{fontSize:9,padding:"1px 6px",borderRadius:7,background:cfg.bg,color:cfg.color,fontWeight:500,flexShrink:0}}>{item.category}</span>
          {item.version&&<span style={{fontSize:9,color:"var(--color-text-tertiary,#aaa)"}}>v{item.version}</span>}
        </div>
        <div style={{fontSize:compact?11:12,fontWeight:500,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:compact?1:2,WebkitBoxOrient:"vertical"}}>{item.title}</div>
        {!compact&&zoom!=="s"&&<div style={{marginTop:4,display:"flex",gap:3,flexWrap:"wrap"}}>
          {(item.tags||[]).slice(0,zoom==="l"?4:2).map(t=><span key={t} style={{fontSize:9,padding:"1px 4px",borderRadius:5,background:"var(--color-background-secondary,#f0f0ee)",color:"var(--color-text-secondary,#888)"}}>{t}</span>)}
        </div>}
        {!compact&&<div style={{marginTop:4,fontSize:9,color:"var(--color-text-tertiary,#aaa)",display:"flex",justifyContent:"space-between"}}>
          <span>{item.dept?.slice(0,4)}</span><span>{item.date_created?.slice(0,10)||"-"}</span>
        </div>}
      </div>
    </div>
  )
}

function DetailModal({item,projects,onClose,onDelete,currentUser}){
  const cfg=CAT[item.category]||CAT["기타"]
  const proj=(projects||[]).find(p=>p.id===item.project_id)
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:20}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"var(--color-background-primary,#fff)",borderRadius:14,width:"100%",maxWidth:580,maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{background:`linear-gradient(135deg,${cfg.bg},white)`,padding:"18px 22px",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{display:"flex",gap:11,alignItems:"flex-start"}}>
            <div style={{width:46,height:46,borderRadius:11,background:cfg.color+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <i className={`ti ${cfg.icon}`} style={{fontSize:22,color:cfg.color}} aria-hidden="true"/>
            </div>
            <div>
              <div style={{fontSize:10,color:cfg.color,fontWeight:600,marginBottom:2}}>{item.category}</div>
              <div style={{fontSize:16,fontWeight:600,lineHeight:1.3}}>{item.title}</div>
              <div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginTop:3}}>v{item.version} · {item.dept} · {item.date_created}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"var(--color-text-secondary,#888)"}}>×</button>
        </div>
        <div style={{padding:"16px 22px"}}>
          {item.description&&<p style={{fontSize:13,lineHeight:1.7,color:"var(--color-text-secondary,#666)",marginBottom:14}}>{item.description}</p>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:14}}>
            {[["연결 프로젝트",proj?.name?.slice(0,22)||"-"],["파일 형식",(item.file_type||"-").toUpperCase()],["파일 크기",item.file_size_kb?fSize(item.file_size_kb):"-"],["등록일",item.date_created||"-"]].map(([k,v])=>(
              <div key={k} style={{padding:"8px 11px",background:"var(--color-background-secondary,#f8f8f6)",borderRadius:8}}>
                <div style={{fontSize:10,color:"var(--color-text-secondary,#888)",marginBottom:2}}>{k}</div>
                <div style={{fontSize:13,fontWeight:500}}>{v}</div>
              </div>
            ))}
          </div>
          {(item.tags||[]).length>0&&<div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:"var(--color-text-secondary,#888)",marginBottom:5}}>태그</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{item.tags.map(t=><span key={t} style={{fontSize:11,padding:"3px 9px",borderRadius:10,background:cfg.bg,color:cfg.color}}>{t}</span>)}</div>
          </div>}
          <div style={{display:"flex",gap:7,marginTop:16}}>
            {item.file_url&&<a href={item.file_url} target="_blank" rel="noopener noreferrer" style={{padding:"8px 16px",background:C.navyM,color:"#fff",borderRadius:8,fontSize:12,fontWeight:500,textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>
              <i className="ti ti-download" aria-hidden="true"/>다운로드
            </a>}
            {(currentUser?.can_write||currentUser?.role==="admin")&&<button onClick={()=>onDelete(item.id)} style={{padding:"8px 13px",background:"var(--color-background-secondary,#f5f5f5)",color:"var(--color-text-secondary,#888)",border:"none",borderRadius:8,fontSize:12,cursor:"pointer"}}>삭제</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

function UploadModal({projects,onClose,onSave,currentUser}){
  const [f,setF]=useState({title:"",category:"계약서",project_id:"",dept:currentUser?.dept||"경영지원",description:"",tags:"",date_created:new Date().toISOString().slice(0,10),version:"1.0"})
  const [file,setFile]=useState(null)
  const [preview,setPreview]=useState(null)
  const [busy,setBusy]=useState(false)
  const ref=useRef(null)
  const u=(k,v)=>setF(p=>({...p,[k]:v}))

  const pick=e=>{
    const picked=e.target.files?.[0];if(!picked)return
    setFile(picked)
    if(picked.type.startsWith("image/")){const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(picked)}
    else setPreview(null)
  }

  const save=async()=>{
    if(!f.title.trim()){alert("제목을 입력하세요");return}
    setBusy(true)
    try{
      let fileUrl=null
      if(file){fileUrl=await uploadFile(file,`${f.dept}/${f.category}/${Date.now()}_${file.name}`).catch(()=>null)}
      const it={id:"A"+Date.now(),...f,tags:f.tags.split(",").map(t=>t.trim()).filter(Boolean),file_url:fileUrl,file_type:file?.name.split(".").pop()?.toLowerCase()||"",file_size_kb:file?Math.round(file.size/1024):0,thumbnail_url:preview||null,created_at:new Date().toISOString()}
      await db.upsertArchive?.(it).catch(()=>{})
      onSave(it)
    }finally{setBusy(false)}
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:500,padding:20,overflowY:"auto"}}>
      <div style={{background:"var(--color-background-primary,#fff)",borderRadius:14,width:"100%",maxWidth:520,marginTop:20,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{padding:"16px 22px",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:15,fontWeight:500}}>문서 추가</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"var(--color-text-secondary,#888)"}}>×</button>
        </div>
        <div style={{padding:"16px 22px"}}>
          <div onClick={()=>ref.current?.click()} style={{border:`2px dashed ${file?"#1D9E75":C.navyM}`,borderRadius:12,padding:"24px 16px",textAlign:"center",cursor:"pointer",marginBottom:14,background:file?C.greenL:C.navyL}}>
            {preview?<img src={preview} alt="" style={{maxHeight:100,maxWidth:"100%",borderRadius:8,marginBottom:6}}/>:<i className="ti ti-upload" style={{fontSize:28,color:file?C.green:C.navyM,marginBottom:6,display:"block"}} aria-hidden="true"/>}
            <div style={{fontSize:12,color:file?C.green:C.navyM,fontWeight:500}}>{file?file.name:"클릭하거나 드래그로 파일 추가"}</div>
            <div style={{fontSize:10,color:"var(--color-text-secondary,#888)",marginTop:3}}>PDF, DWG, DOCX, XLSX, JPG, PNG</div>
            <input ref={ref} type="file" style={{display:"none"}} onChange={pick}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{display:"block",fontSize:11,color:C.gray,marginBottom:3}}>제목 *</label>
              <input value={f.title} onChange={e=>u("title",e.target.value)} placeholder="문서 제목" style={{width:"100%",padding:"7px 9px",border:"1px solid var(--color-border-secondary,#ddd)",borderRadius:8,fontSize:13}}/>
            </div>
            {[{k:"category",l:"분류",type:"sel",opts:CATS},{k:"dept",l:"담당 본부",type:"sel",opts:DEPTS},{k:"date_created",l:"문서 날짜",type:"date"},{k:"version",l:"버전",type:"text",ph:"1.0"}].map(({k,l,type,opts,ph})=>(
              <div key={k}>
                <label style={{display:"block",fontSize:11,color:C.gray,marginBottom:3}}>{l}</label>
                {type==="sel"?<select value={f[k]} onChange={e=>u(k,e.target.value)} style={{width:"100%",padding:"6px 8px",border:"1px solid var(--color-border-secondary,#ddd)",borderRadius:8,fontSize:12}}>{opts?.map(o=><option key={o} value={o}>{o}</option>)}</select>
                  :<input type={type} value={f[k]} onChange={e=>u(k,e.target.value)} placeholder={ph} style={{width:"100%",padding:"6px 8px",border:"1px solid var(--color-border-secondary,#ddd)",borderRadius:8,fontSize:12}}/>}
              </div>
            ))}
            <div>
              <label style={{display:"block",fontSize:11,color:C.gray,marginBottom:3}}>연결 프로젝트</label>
              <select value={f.project_id} onChange={e=>u("project_id",e.target.value)} style={{width:"100%",padding:"6px 8px",border:"1px solid var(--color-border-secondary,#ddd)",borderRadius:8,fontSize:12}}>
                <option value="">없음</option>{(projects||[]).map(p=><option key={p.id} value={p.id}>{p.name.slice(0,22)}</option>)}
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{display:"block",fontSize:11,color:C.gray,marginBottom:3}}>태그 (쉼표 구분)</label>
              <input value={f.tags} onChange={e=>u("tags",e.target.value)} placeholder="평택고덕, 계약서, 2026" style={{width:"100%",padding:"6px 8px",border:"1px solid var(--color-border-secondary,#ddd)",borderRadius:8,fontSize:12}}/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{display:"block",fontSize:11,color:C.gray,marginBottom:3}}>설명</label>
              <textarea value={f.description} onChange={e=>u("description",e.target.value)} rows={2} placeholder="문서 내용 요약" style={{width:"100%",padding:"6px 8px",border:"1px solid var(--color-border-secondary,#ddd)",borderRadius:8,fontSize:12,resize:"vertical"}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:7,marginTop:14}}>
            <button onClick={save} disabled={busy} style={{padding:"8px 16px",background:C.navyM,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:500,cursor:busy?"not-allowed":"pointer",opacity:busy?.6:1}}>{busy?"업로드 중…":"저장"}</button>
            <button onClick={onClose} style={{padding:"8px 12px",background:"var(--color-background-secondary,#f5f5f5)",color:"var(--color-text-secondary,#888)",border:"none",borderRadius:8,fontSize:12,cursor:"pointer"}}>취소</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NoData(){return<div style={{gridColumn:"1/-1",padding:"50px 20px",textAlign:"center",color:"var(--color-text-secondary,#888)"}}><i className="ti ti-folder-open" style={{fontSize:44,opacity:.2,display:"block",marginBottom:10}} aria-hidden="true"/><div style={{fontSize:13}}>해당하는 문서가 없습니다</div></div>}

export default ArchiveTab
