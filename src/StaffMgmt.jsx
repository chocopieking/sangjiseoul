import React, { useState, useMemo, useRef, useEffect } from "react"
import { INITIAL_STAFF_DB } from "./staffData.js"
import * as XLSX from "xlsx"

const STATUS_OPTIONS = ["재직","휴직","파견","퇴사","계약직","비카운트"]
const STATUS_COLOR   = {재직:"#059669",휴직:"#D97706",파견:"#0E9C8C",퇴사:"#DC2626",계약직:"#0891B2",비카운트:"#9CA3AF"}
const STATUS_BG      = {재직:"#D1FAE5",휴직:"#FEF3C7",파견:"#E3F6F3",퇴사:"#FEE2E2",계약직:"#E0F7FA",비카운트:"#F3F4F6"}
// 인원 집계 제외 상태 (본부별 현황에 반영 안 됨)
const EXCLUDE_FROM_COUNT = new Set(["퇴사","계약직","비카운트"])
const RANK_ORDER = ["회장","부회장","사장","부사장","전무","전무보","상무","상무보","이사","이사대우","부장","차장","과장","대리","주임","사원","연구원",""]

const DEPT_MAP = {
  "설계1본부":"설계1본부","설계1":"설계1본부",
  "설계2본부":"설계2본부","설계2":"설계2본부",
  "주거디자인본부":"주거디자인본부","주거":"주거디자인본부","주거디자인":"주거디자인본부",
  "디자인본부":"디자인본부","디자인":"디자인본부","디본":"디자인본부",
  "디자인인랩실":"디자인인랩실","인랩실":"디자인인랩실","인랩":"디자인인랩실",
  "운영지원본부":"운영지원본부","운영지원":"운영지원본부","경영진":"경영진",
  "전략기획본부":"전략기획본부","전략기획":"전략기획본부",
  "감리단":"감리단","파트장":"파트장","파트":"파트장",
  "고문":"경영진","부회장":"경영진",
}
const normDept = d => DEPT_MAP[d?.trim()]||d?.trim()||""

// ── 초기화 ──────────────────────────────────────────────────
function initStaff(){
  try{
    const saved = localStorage.getItem("sjs_staff_db")
    if(saved&&saved!=="{}"){
      const parsed = JSON.parse(saved)
      if(Array.isArray(parsed)){
        const db={}
        parsed.forEach((u,i)=>{ const id=u.id||`S${i+1000}`; db[id]={...u,id} })
        localStorage.setItem("sjs_staff_db",JSON.stringify(db))
        return db
      }
      if(typeof parsed==="object"&&Object.keys(parsed).length>0) return parsed
    }
  }catch{}
  const db={}
  INITIAL_STAFF_DB.forEach((u,i)=>{
    const id=`S${i+1000}`
    db[id]={
      ...u, id,
      dept: normDept(u.dept||""),
      status: u.status==="사용"||!u.status?"재직":(u.resignDate?"퇴사":"미사용"),
      excludeCount: false, photo:"", memo:[]
    }
  })
  try{ localStorage.setItem("sjs_staff_db",JSON.stringify(db)) }catch{}
  return db
}

// ── 기본 조직도 구조 ────────────────────────────────────────
const DEFAULT_ORG = {
  id:"root", title:"오철호", role:"회장/사장/KRA", color:"#312E81",
  children:[
    { id:"advisor", title:"고문(1명)", role:"", color:"#6B7280",
      children:[
        { id:"adv1", title:"천준호", role:"고문·대원대학교", color:"#9CA3AF", children:[] }
      ]
    },
    { id:"vp", title:"부회장(1명)", role:"", color:"#7C3AED",
      children:[
        { id:"vp1", title:"이종협", role:"부회장", color:"#8B5CF6", children:[] }
      ]
    },
    { id:"strat", title:"전략기획본부(4명)", role:"", color:"#0891B2",
      children:[
        { id:"strat1", title:"이무희", role:"전무(73)", color:"#0EA5E9", children:[] },
        { id:"strat2", title:"이재훈", role:"이사대우(85)", color:"#38BDF8", children:[] },
        { id:"strat5", title:"김연규", role:"과장(93)", color:"#7DD3FC", children:[] },
      ]
    },
    { id:"ops", title:"운영지원본부(4명)", role:"", color:"#DC2626",
      children:[
        { id:"ops1", title:"김태관", role:"상무/본부장(74)", color:"#EF4444", children:[] },
        { id:"ops2", title:"유성균", role:"부장(87)", color:"#FCA5A5", children:[] },
        { id:"ops3", title:"임슬기", role:"부장(91)", color:"#FCA5A5", children:[] },
        { id:"ops4", title:"김재은", role:"사원(99)", color:"#FECACA", children:[] },
      ]
    },
    { id:"ceo", title:"강순일", role:"사장/부장장", color:"#0E9C8C",
      children:[
        { id:"design_part", title:"설계파트(28명)", role:"홍성필 전무보 / 설계·디자인파트장", color:"#059669",
          children:[
            { id:"d1", title:"설계1본부(9명)", role:"", color:"#10B981",
              children:[
                { id:"d1_head", title:"박희태", role:"상무보/본부장(75)", color:"#34D399", children:[] },
                { id:"d1_jg",   title:"장건효",  role:"부장/KRA(81)",    color:"#6EE7B7", children:[] },
                { id:"d1_sk",   title:"신승범",  role:"부장(85)",         color:"#A7F3D0", children:[] },
                { id:"d1_jh",   title:"조형민",  role:"차장(86)",         color:"#A7F3D0", children:[] },
                { id:"d1_mk",   title:"송민경",  role:"차장(91)",         color:"#A7F3D0", children:[] },
                { id:"d1_hh",   title:"한현석",  role:"차장(90)",         color:"#A7F3D0", children:[] },
                { id:"d1_ps",   title:"박소현",  role:"대리(98/4)",       color:"#D1FAE5", children:[] },
                { id:"d1_sj",   title:"정석준",  role:"대리(94/3)",       color:"#D1FAE5", children:[] },
                { id:"d1_sc",   title:"정상천",  role:"사원(94/3)",       color:"#D1FAE5", children:[] },
                { id:"d1_se",   title:"오소은",  role:"사원(99/3)",       color:"#D1FAE5", children:[] },
              ]
            },
            { id:"d2", title:"설계2본부(18명)", role:"", color:"#D97706",
              children:[
                { id:"d2_head", title:"김동헌", role:"상무/본부장(76)",  color:"#F59E0B", children:[] },
                { id:"d2_bj",   title:"배지",   role:"이사대우(79)",     color:"#FCD34D", children:[] },
                { id:"d2_jb",   title:"정한빈", role:"부장",             color:"#FCD34D", children:[] },
                { id:"d2_jm",   title:"강정문", role:"이사",             color:"#FCD34D", children:[] },
                { id:"d2_mj",   title:"민지연", role:"차장(84)",         color:"#FDE68A", children:[] },
                { id:"d2_sh",   title:"이승현", role:"차장(88)",         color:"#FDE68A", children:[] },
                { id:"d2_ip",   title:"이민성", role:"차장(91)",         color:"#FDE68A", children:[] },
                { id:"d2_sg",   title:"신광섭", role:"차장(90)",         color:"#FDE68A", children:[] },
                { id:"d2_ls",   title:"이석진", role:"차장(90)/KRA",     color:"#FDE68A", children:[] },
                { id:"d2_jr",   title:"이재욱", role:"차장(90)",         color:"#FDE68A", children:[] },
                { id:"d2_ph",   title:"박은휘", role:"과장(93)",         color:"#FEF3C7", children:[] },
                { id:"d2_ps",   title:"박상희", role:"과장(91)",         color:"#FEF3C7", children:[] },
                { id:"d2_kh",   title:"권희지", role:"대리(97/5)",       color:"#FEF3C7", children:[] },
                { id:"d2_cw",   title:"최원주", role:"대리(99/5)",       color:"#FEF3C7", children:[] },
                { id:"d2_ya",   title:"양가이", role:"대리(97/4)",       color:"#FEF3C7", children:[] },
                { id:"d2_hj",   title:"홍은지", role:"대리(98/6)",       color:"#FEF3C7", children:[] },
                { id:"d2_jh2",  title:"정현준", role:"사원(99/3)",       color:"#FFF7ED", children:[] },
                { id:"d2_hm",   title:"허성무", role:"사원(00/3)",       color:"#FFF7ED", children:[] },
              ]
            },
            { id:"sup", title:"감리단(3명)", role:"", color:"#64748B",
              children:[
                { id:"sup_kg",  title:"김헌구", role:"이사(78)/KRA·현장", color:"#94A3B8", children:[] },
                { id:"sup_kh",  title:"이경호", role:"이사대우(56)/PM:김헌준·홍성필", color:"#CBD5E1", children:[] },
                { id:"sup_jk",  title:"정경호", role:"이사대우(71)",      color:"#CBD5E1", children:[] },
                { id:"sup_jy",  title:"이지영", role:"과장(84)",          color:"#E2E8F0", children:[] },
              ]
            },
          ]
        },
        { id:"viz_part", title:"디자인파트(16명)", role:"김한준 전무 / 디자인파트장", color:"#7C3AED",
          children:[
            { id:"d4", title:"디자인본부(8명)", role:"", color:"#8B5CF6",
              children:[
                { id:"d4_head", title:"천용화", role:"상무보(77)/수퍼바이저", color:"#A78BFA", children:[] },
                { id:"d4_ky",   title:"김용수", role:"이사",                  color:"#C4B5FD", children:[] },
                { id:"d4_kg",   title:"김헌구", role:"이사(78)/KRA",          color:"#C4B5FD", children:[] },
                { id:"d4_kp",   title:"김판원", role:"부장(78)",              color:"#C4B5FD", children:[] },
                { id:"d4_sy",   title:"서용규", role:"부장(82)",              color:"#C4B5FD", children:[] },
                { id:"d4_ks",   title:"김서현", role:"대리(99/4)",            color:"#DDD6FE", children:[] },
                { id:"d4_ly",   title:"이가영", role:"대리(99/4)",            color:"#DDD6FE", children:[] },
                { id:"d4_jh",   title:"이정훈", role:"대리(95/4)",            color:"#DDD6FE", children:[] },
                { id:"d4_sn",   title:"신나랑", role:"사원(01/2)",            color:"#EDE9FE", children:[] },
                { id:"d4_jg",   title:"조정곤", role:"사원(96/2)",            color:"#EDE9FE", children:[] },
                { id:"d4_an",   title:"안서현", role:"사원(99/1)",            color:"#EDE9FE", children:[] },
                { id:"d4_os",   title:"오샘",   role:"사원(98/1)",            color:"#EDE9FE", children:[] },
              ]
            },
            { id:"d3", title:"주거디자인본부(7명)", role:"", color:"#7C3AED",
              children:[
                { id:"d3_head", title:"정진성", role:"이사대우(83)/수퍼바이저", color:"#8B5CF6", children:[] },
                { id:"d3_jh",   title:"장진혁", role:"차장(89)",              color:"#A78BFA", children:[] },
                { id:"d3_pj",   title:"박종필", role:"과장(90)",              color:"#C4B5FD", children:[] },
                { id:"d3_kw",   title:"김원주", role:"과장(91/2)",            color:"#C4B5FD", children:[] },
                { id:"d3_sh",   title:"신수현", role:"대리(99)",              color:"#DDD6FE", children:[] },
                { id:"d3_sy",   title:"이시율", role:"대리(97)",              color:"#DDD6FE", children:[] },
                { id:"d3_pc",   title:"박찬희", role:"사원(97/2)",            color:"#EDE9FE", children:[] },
              ]
            },
            { id:"d_lab", title:"디자인인랩실(4명)", role:"", color:"#DB2777",
              children:[
                { id:"lab_head", title:"김흥수", role:"이사/본부장",          color:"#EC4899", children:[] },
                { id:"lab1",     title:"이가영", role:"대리(99/4)",           color:"#F9A8D4", children:[] },
                { id:"lab2",     title:"안서현", role:"사원(99/2)",           color:"#FBCFE8", children:[] },
                { id:"lab3",     title:"오샘",   role:"사원(98/1)",           color:"#FBCFE8", children:[] },
              ]
            },
          ]
        },
      ]
    },
  ]
}

function initOrg(){
  try{
    const s=localStorage.getItem("sjs_org_chart")
    if(s) return JSON.parse(s)
  }catch{}
  return DEFAULT_ORG
}

// ── 변경 히스토리 자동 기록 ─────────────────────────────────
function buildChangeLogs(prev, next, author){
  const now = new Date()
  const datetime = `${now.toISOString().slice(0,10)} ${now.toTimeString().slice(0,5)}`
  const logs=[]
  const checks=[
    ["dept","🏢 부서이동","부서"],["rank","🎖 직급변경","직급"],["name","📛 이름변경","이름"],
    ["status","🔄 상태변경","상태"],["mobile","📱 연락처변경","연락처"],["email","📧 이메일변경","이메일"],
    ["excludeCount","📊 인원산입변경","인원집계"],
  ]
  checks.forEach(([k,label,field])=>{
    if(String(prev[k])!==String(next[k])&&(prev[k]!==undefined||next[k]!==undefined)){
      logs.push({
        id:`L${Date.now()}_${k}`,
        date: now.toISOString().slice(0,10),
        time: now.toTimeString().slice(0,5),
        datetime,
        text:`${label}: "${prev[k]||"없음"}" → "${next[k]||"없음"}"`,
        author, type: field==="부서"?"부서이동":field==="직급"?"직급변경":"변경사항",
        auto:true
      })
    }
  })
  return logs
}

// ── 조직도 노드 ──────────────────────────────────────────────
function OrgNode({node, onEdit, onAdd, onDelete, onMove, depth=0, isFirst, isLast, staffList=[]}) {
  const [collapsed,    setCollapsed]    = useState(false)
  const [showMembers,  setShowMembers]  = useState(false)
  const hasChildren = node.children && node.children.length > 0

  // 이 노드에 해당하는 직원 찾기 (title이 본부명이면 해당 본부 직원)
  const members = staffList.filter(s=>{
    const t = node.title
    // 본부명 매칭
    if(s.dept && s.dept.includes(t.replace("본부장","").trim())) return true
    if(s.name === t) return true  // 개인 노드 (회장, 사장 등)
    return false
  }).filter(s=>!["퇴사","비카운트"].includes(s.status))

  const hasDeptMembers = members.length > 0

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
      <div style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center"}}>
        {depth>0&&<div style={{width:2,height:20,background:"#CBD5E1"}}/>}

        {/* 메인 노드 박스 */}
        <div style={{
          background:node.color||"#0E9C8C",color:"#fff",borderRadius:12,
          padding:"10px 18px",minWidth:120,textAlign:"center",
          boxShadow:"0 4px 14px rgba(0,0,0,.18)",position:"relative",
          border:"2px solid rgba(255,255,255,.2)",transition:"all .15s",
        }}>
          <div style={{fontSize:21,fontWeight:800}}>{node.title}</div>
          <div style={{fontSize:16.5,opacity:.85,marginTop:2}}>{node.role}</div>

          {/* 직원 수 뱃지 */}
          {hasDeptMembers&&(
            <div onClick={e=>{e.stopPropagation();setShowMembers(v=>!v)}}
              style={{position:"absolute",top:-8,left:-8,minWidth:20,height:20,borderRadius:10,
                background:showMembers?"#FDE68A":"#fff",color:node.color||"#0E9C8C",
                fontSize:15.8,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                border:`2px solid ${node.color||"#0E9C8C"}`,padding:"0 4px",zIndex:2}}>
              {members.length}
            </div>
          )}

          {/* 편집 버튼들 */}
          <div style={{position:"absolute",top:-8,right:-8,display:"flex",gap:2}}>
            <button onClick={e=>{e.stopPropagation();onEdit(node)}}
              style={{width:18,height:18,border:"none",borderRadius:"50%",background:"#FEF3C7",color:"#D97706",fontSize:13.5,cursor:"pointer",fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>✏</button>
            <button onClick={e=>{e.stopPropagation();onAdd(node)}}
              style={{width:18,height:18,border:"none",borderRadius:"50%",background:"#D1FAE5",color:"#059669",fontSize:18,cursor:"pointer",fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
            {depth>0&&<button onClick={e=>{e.stopPropagation();onDelete(node.id)}}
              style={{width:18,height:18,border:"none",borderRadius:"50%",background:"#FEE2E2",color:"#DC2626",fontSize:13.5,cursor:"pointer",fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
          </div>

          {/* 좌우 이동 버튼 (형제 노드 순서 변경) */}
          {depth>0&&(
            <div style={{position:"absolute",bottom:-8,left:"50%",transform:"translateX(-50%)",display:"flex",gap:2,zIndex:2}}>
              {!isFirst&&<button onClick={e=>{e.stopPropagation();onMove(node.id,"left")}}
                style={{width:16,height:16,border:"none",borderRadius:"50%",background:"#E3F6F3",color:"#0E9C8C",fontSize:12,cursor:"pointer",fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>}
              {!isLast&&<button onClick={e=>{e.stopPropagation();onMove(node.id,"right")}}
                style={{width:16,height:16,border:"none",borderRadius:"50%",background:"#E3F6F3",color:"#0E9C8C",fontSize:12,cursor:"pointer",fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>→</button>}
            </div>
          )}

          {/* 접기/펼치기 */}
          {hasChildren&&(
            <div onClick={e=>{e.stopPropagation();setCollapsed(v=>!v)}}
              style={{position:"absolute",bottom:depth>0?-22:-10,left:"50%",transform:"translateX(-50%)",
                width:18,height:18,borderRadius:"50%",background:"#fff",color:"#0E9C8C",
                fontSize:15,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                border:"2px solid #0E9C8C",zIndex:1}}>
              {collapsed?"▶":"▼"}
            </div>
          )}
        </div>

        {/* 소속 직원 팝업 */}
        {showMembers&&hasDeptMembers&&(
          <div style={{position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",
            marginTop:12,background:"#fff",borderRadius:12,border:"2px solid "+node.color,
            boxShadow:"0 8px 24px rgba(0,0,0,.15)",zIndex:100,minWidth:260,maxWidth:320,
            padding:"10px 0"}}>
            <div style={{padding:"6px 14px 8px",borderBottom:"1px solid #F3F4F6",
              fontSize:19.5,fontWeight:800,color:node.color,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>👥 {node.title} ({members.length}명)</span>
              <button onClick={e=>{e.stopPropagation();setShowMembers(false)}}
                style={{border:"none",background:"none",cursor:"pointer",fontSize:21,color:"#9CA3AF"}}>✕</button>
            </div>
            <div style={{maxHeight:300,overflowY:"auto"}}>
              {members.sort((a,b)=>{
                const ra=RANK_ORDER.indexOf(a.rank||""),rb=RANK_ORDER.indexOf(b.rank||"")
                return (ra<0?99:ra)-(rb<0?99:rb)
              }).map((m,i)=>(
                <div key={m.id||i} style={{padding:"8px 14px",borderBottom:"1px solid #F9FAFB",
                  display:"flex",gap:10,alignItems:"center",
                  background:i%2===0?"#fff":"#FAFAFA"}}>
                  {/* 사진 */}
                  <div style={{width:36,height:36,borderRadius:"50%",flexShrink:0,
                    background:m.photo?"transparent":"#E5E7EB",overflow:"hidden",
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {m.photo
                      ? <img src={m.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      : <span style={{fontSize:24}}>👤</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:2}}>
                      <span style={{fontSize:21,fontWeight:800,color:"#111827"}}>{m.name}</span>
                      <span style={{fontSize:15,padding:"1px 5px",borderRadius:6,
                        background:(STATUS_BG[m.status]||"#F3F4F6"),
                        color:(STATUS_COLOR[m.status]||"#6B7280"),fontWeight:700}}>
                        {m.status}
                      </span>
                    </div>
                    <div style={{fontSize:18,color:"#6B7280",fontWeight:500}}>{m.rank}</div>
                    {m.mobile&&<div style={{fontSize:18,color:"#0E9C8C",fontWeight:600}}>{m.mobile}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(hasChildren&&!collapsed||hasDeptMembers&&!showMembers)&&<div style={{width:2,height:depth>0?26:20,background:"#CBD5E1",marginTop:depth>0&&!hasChildren?0:0}}/>}
        {hasChildren&&!collapsed&&<div style={{width:2,height:0,background:"#CBD5E1"}}/>}
      </div>

      {/* 자식 노드 */}
      {hasChildren&&!collapsed&&(
        <div style={{display:"flex",gap:16,alignItems:"flex-start",position:"relative"}}>
          {node.children.length>1&&(
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"#CBD5E1",zIndex:0}}/>
          )}
          {node.children.map((child,ci)=>(
            <OrgNode key={child.id} node={child}
              onEdit={onEdit} onAdd={onAdd} onDelete={onDelete} onMove={onMove}
              depth={depth+1}
              isFirst={ci===0} isLast={ci===node.children.length-1}
              staffList={staffList}/>
          ))}
        </div>
      )}
    </div>
  )
}

function OrgChart({org, setOrg, staffList=[]}) {
  const [editNode,    setEditNode]    = useState(null)
  const [addParentId, setAddParentId] = useState(null)
  const [draftNode,   setDraftNode]   = useState(null)

  // 트리 헬퍼 함수들
  const updateNode = (tree, id, patch) => {
    if(tree.id===id) return {...tree,...patch}
    return {...tree, children:(tree.children||[]).map(c=>updateNode(c,id,patch))}
  }
  const addChildNode = (tree, parentId, newNode) => {
    if(tree.id===parentId) return {...tree,children:[...(tree.children||[]),newNode]}
    return {...tree,children:(tree.children||[]).map(c=>addChildNode(c,parentId,newNode))}
  }
  const deleteNode = (tree, id) => ({
    ...tree,children:(tree.children||[]).filter(c=>c.id!==id).map(c=>deleteNode(c,id))
  })
  // 형제 노드 순서 이동
  const moveNode = (tree, id, dir) => {
    const children = tree.children||[]
    const idx = children.findIndex(c=>c.id===id)
    if(idx<0) return {...tree,children:children.map(c=>moveNode(c,id,dir))}
    const newChildren = [...children]
    if(dir==="left"&&idx>0) {
      [newChildren[idx-1],newChildren[idx]]=[newChildren[idx],newChildren[idx-1]]
    } else if(dir==="right"&&idx<newChildren.length-1) {
      [newChildren[idx],newChildren[idx+1]]=[newChildren[idx+1],newChildren[idx]]
    }
    return {...tree,children:newChildren}
  }

  const save = (next) => { setOrg(next); localStorage.setItem("sjs_org_chart",JSON.stringify(next)) }

  const handleEdit   = (node) => { setEditNode(node); setDraftNode({...node}); setAddParentId(null) }
  const handleAdd    = (node) => { setAddParentId(node.id); setDraftNode({id:`N${Date.now()}`,title:"",role:"",color:"#0E9C8C",children:[]}); setEditNode(null) }
  const handleDelete = (id)   => { if(window.confirm("삭제하시겠습니까?")) save(deleteNode(org,id)) }
  const handleMove   = (id, dir) => save(moveNode(org, id, dir))

  const saveNode = () => {
    if(!draftNode?.title) return
    if(editNode)     save(updateNode(org,editNode.id,draftNode))
    else if(addParentId) save(addChildNode(org,addParentId,draftNode))
    setEditNode(null); setAddParentId(null); setDraftNode(null)
  }

  const COLORS=["#312E81","#0E9C8C","#059669","#D97706","#DC2626","#7C3AED","#0891B2","#374151","#9CA3AF","#B45309","#047857"]
  const INP={padding:"7px 10px",border:"1.5px solid #E5E7EB",borderRadius:7,fontSize:19.5,width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none"}

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{fontSize:24,fontWeight:800,color:"#312E81"}}>🏢 조직도</div>
        <div style={{fontSize:18,color:"#9CA3AF",marginLeft:4}}>
          ← → 버튼으로 노드 순서 이동 · 숫자 뱃지 클릭으로 소속 직원 확인
        </div>
        <button onClick={()=>{if(window.confirm("조직도를 초기화하시겠습니까?")) save(DEFAULT_ORG)}}
          style={{marginLeft:"auto",padding:"5px 12px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:7,fontSize:18,cursor:"pointer"}}>
          🔄 초기화
        </button>
      </div>

      {/* 편집 폼 */}
      {(editNode||addParentId)&&draftNode&&(
        <div style={{background:"#E3F6F3",borderRadius:12,border:"2px solid #0E9C8C",padding:"14px 16px",marginBottom:14}}>
          <div style={{fontSize:20.2,fontWeight:700,color:"#312E81",marginBottom:10}}>
            {editNode?"✏ 노드 수정":"+ 하위 노드 추가"}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <label style={{fontSize:16.5,fontWeight:700,color:"#0E9C8C",display:"block",marginBottom:3}}>이름/부서명</label>
              <input value={draftNode.title} onChange={e=>setDraftNode(p=>({...p,title:e.target.value}))} style={INP}/>
            </div>
            <div>
              <label style={{fontSize:16.5,fontWeight:700,color:"#0E9C8C",display:"block",marginBottom:3}}>직책/역할</label>
              <input value={draftNode.role||""} onChange={e=>setDraftNode(p=>({...p,role:e.target.value}))} style={INP}/>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:16.5,fontWeight:700,color:"#0E9C8C",display:"block",marginBottom:4}}>색상</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {COLORS.map(c=>(
                <div key={c} onClick={()=>setDraftNode(p=>({...p,color:c}))}
                  style={{width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",
                    border:`3px solid ${draftNode.color===c?"#fff":"transparent"}`,
                    boxShadow:draftNode.color===c?`0 0 0 2px ${c}`:"none",transition:"all .1s"}}/>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setEditNode(null);setAddParentId(null);setDraftNode(null)}}
              style={{padding:"6px 14px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:7,fontSize:18.8,cursor:"pointer"}}>취소</button>
            <button onClick={saveNode}
              style={{padding:"6px 16px",background:"#0E9C8C",color:"#fff",border:"none",borderRadius:7,fontSize:18.8,fontWeight:700,cursor:"pointer"}}>💾 저장</button>
          </div>
        </div>
      )}

      {/* 조직도 렌더 */}
      <div style={{overflowX:"auto",padding:"24px",background:"linear-gradient(135deg,#F8FAFC,#E3F6F3)",borderRadius:14,border:"1px solid #E5E7EB",minHeight:300}}>
        <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",minWidth:"100%",position:"relative"}}>
          <OrgNode node={org}
            onEdit={handleEdit} onAdd={handleAdd} onDelete={handleDelete} onMove={handleMove}
            depth={0} isFirst={true} isLast={true} staffList={staffList}/>
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export function StaffMgmtPage({currentUser,deptStaff,setDeptStaff,DEPTS=[],DEPT_COLORS={},setTab}){
  const [staffDB, setStaffDBRaw] = useState(initStaff)
  const [org,     setOrg]        = useState(initOrg)
  const [view,    setView]       = useState("org")   // org | list
  const [filter,  setFilter]     = useState({dept:"전체",status:"재직",search:""})
  const [selId,   setSelId]      = useState(null)
  const [showAdd, setShowAdd]    = useState(false)
  const [draft,   setDraft]      = useState(null)
  const [newMemo, setNewMemo]    = useState("")
  const [memoType,setMemoType]   = useState("일반")
  const [memoDate,setMemoDate]   = useState(new Date().toISOString().slice(0,10))
  const photoRef = useRef()

  const setStaffDB = v => {
    const next = typeof v==="function"?v(staffDB):v
    setStaffDBRaw(next)
    try{ localStorage.setItem("sjs_staff_db",JSON.stringify(next)) }catch{}
    if(setDeptStaff){
      const dm={}
      Object.values(next).filter(s=>!EXCLUDE_FROM_COUNT.has(s.status)&&!s.excludeCount).forEach(s=>{
        if(s.dept){ if(!dm[s.dept])dm[s.dept]={total:0}; dm[s.dept].total++ }
      })
      setDeptStaff(prev=>({...prev,...Object.fromEntries(
        Object.entries(dm).map(([d,v])=>[d,{...(prev[d]||{}),total:v.total,current:v.total}])
      )}))
    }
  }

  const staffList = useMemo(()=>{
    if(Array.isArray(staffDB)) return staffDB
    return Object.values(staffDB)
  },[staffDB])
  const sel = selId ? (staffDB[selId]||staffList.find(s=>s.id===selId)) : null

  const filtered = useMemo(()=>staffList.filter(s=>{
    if(filter.dept!=="전체"&&s.dept!==filter.dept) return false
    if(filter.status!=="전체"&&s.status!==filter.status) return false
    if(filter.search.trim()){
      const q=filter.search.toLowerCase()
      if(!`${s.name||""}${s.dept||""}${s.rank||""}${s.email||""}`.toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a,b)=>{
    const ra=RANK_ORDER.indexOf(a.rank||""),rb=RANK_ORDER.indexOf(b.rank||"")
    if(ra!==rb) return (ra<0?99:ra)-(rb<0?99:rb)
    return (a.name||"").localeCompare(b.name||"","ko")
  }),[staffList,filter])

  const deptStats = useMemo(()=>{
    const m={}
    staffList.filter(s=>!EXCLUDE_FROM_COUNT.has(s.status)&&!s.excludeCount).forEach(s=>{
      if(s.dept){ if(!m[s.dept])m[s.dept]=0; m[s.dept]++ }
    })
    return m
  },[staffList])

  const allDepts=[...new Set(staffList.map(s=>s.dept).filter(Boolean))].sort()

  const handlePhoto = e=>{
    const f=e.target.files?.[0]; if(!f||!selId) return
    const r=new FileReader()
    r.onload=ev=>setStaffDB(prev=>({...prev,[selId]:{...prev[selId],photo:ev.target.result}}))
    r.readAsDataURL(f)
  }

  const addMemo = ()=>{
    if(!newMemo.trim()||!selId) return
    const now=new Date()
    const entry={
      id:`M${Date.now()}`,
      date: memoDate||now.toISOString().slice(0,10),
      time: now.toTimeString().slice(0,5),
      datetime:`${memoDate} ${now.toTimeString().slice(0,5)}`,
      text:newMemo.trim(),
      author:currentUser?.name||"",
      type:memoType
    }
    setStaffDB(prev=>({...prev,[selId]:{...prev[selId],memo:[...(prev[selId].memo||[]),entry]}}))
    setNewMemo("")
  }

  const saveDraft = ()=>{
    if(!draft?.name?.trim()) return
    if(draft.id&&staffDB[draft.id]){
      const prev=staffDB[draft.id]
      const autoLogs=buildChangeLogs(prev,draft,currentUser?.name||"")
      const updatedMemo=[...(prev.memo||[]),...autoLogs]
      setStaffDB(p=>({...p,[draft.id]:{...draft,memo:updatedMemo}}))
      if(autoLogs.length) {
        const changes=autoLogs.map(l=>l.text).join("\n")
        alert(`✅ 저장됨\n\n자동 기록된 변경사항:\n${changes}`)
      }
    } else {
      const id=`S${Date.now()}`
      const now=new Date()
      setStaffDB(p=>({...p,[id]:{...draft,id,memo:[{
        id:`M${Date.now()}`,date:now.toISOString().slice(0,10),time:now.toTimeString().slice(0,5),
        datetime:`${now.toISOString().slice(0,10)} ${now.toTimeString().slice(0,5)}`,
        text:"🆕 신규 등록",author:currentUser?.name||"",type:"시스템",auto:true
      }]}}))
      setSelId(id)
    }
    setDraft(null); setShowAdd(false)
  }

  // 엑셀
  const downloadTemplate = ()=>{
    const ws=XLSX.utils.aoa_to_sheet([
      ["※ 직원 정보 입력 양식. [시스템ID]열 수정 금지. 재직상태: 재직/휴직/파견/퇴사/계약직/비카운트"],
      [],
      ["이름","영문이름","본부","직급","이메일","핸드폰","성별","학위","학교","입사일(YYYY-MM-DD)","퇴사일","재직상태","인원집계제외(Y/N)","[시스템ID]"],
      ["홍길동","Hong Gildong","설계1본부","과장","hong@sangji21c.co.kr","010-1234-5678","남자","학사","서울대","2020-03-01","","재직","N",""],
    ])
    ws["!cols"]=[{wch:12},{wch:18},{wch:16},{wch:10},{wch:26},{wch:14},{wch:6},{wch:8},{wch:16},{wch:14},{wch:12},{wch:10},{wch:14},{wch:20}]
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"직원목록")
    XLSX.writeFile(wb,"상지서울_직원관리_양식.xlsx")
  }

  const downloadAll = ()=>{
    const rows=[
      ["이름","영문이름","본부","직급","이메일","핸드폰","성별","학위","학교","입사일","퇴사일","재직상태","인원집계제외","[시스템ID]"],
      ...staffList.map(s=>[s.name||"",s.nameEn||"",s.dept||"",s.rank||"",s.email||"",s.mobile||"",
        s.gender||"",s.degree||"",s.school||"",s.joinDate||"",s.resignDate||"",s.status||"재직",s.excludeCount?"Y":"N",s.id])
    ]
    const ws=XLSX.utils.aoa_to_sheet(rows)
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"직원목록")
    XLSX.writeFile(wb,`상지서울_직원데이터_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const uploadExcel = e=>{
    const f=e.target.files?.[0]; if(!f) return
    const r=new FileReader()
    r.onload=ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:"binary"})
        const ws=wb.Sheets[wb.SheetNames[0]]
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""})
        const headers=rows[0].map(h=>String(h).trim())
        const ni=ns=>{ for(const n of ns){ const i=headers.findIndex(h=>h.includes(n)); if(i>=0)return i }; return -1 }
        const CI={
          name:ni(["이름"]),nameEn:ni(["영문"]),dept:ni(["본부","부서"]),rank:ni(["직급"]),
          email:ni(["이메일","메일"]),mobile:ni(["핸드폰","연락처"]),
          gender:ni(["성별"]),degree:ni(["학위"]),school:ni(["학교"]),
          joinDate:ni(["입사일"]),resignDate:ni(["퇴사일"]),
          status:ni(["재직상태","상태"]),excludeCount:ni(["인원집계제외","집계제외"]),
          id:ni(["시스템ID","[시스템ID"])
        }
        let added=0,updated=0
        setStaffDB(prev=>{
          const next={...prev}
          rows.slice(1).forEach(r=>{
            const name=CI.name>=0?String(r[CI.name]).trim():""
            if(!name||name.startsWith("※")||name==="이름") return
            const existingId=CI.id>=0?String(r[CI.id]).trim():""
            const existing=existingId&&next[existingId]?next[existingId]:Object.values(next).find(s=>s.name===name)
            const newData={
              name,nameEn:r[CI.nameEn]||"",dept:normDept(r[CI.dept]||""),rank:r[CI.rank]||"",
              email:r[CI.email]||"",mobile:r[CI.mobile]||"",gender:r[CI.gender]||"남자",
              degree:r[CI.degree]||"",school:r[CI.school]||"",
              joinDate:r[CI.joinDate]||"",resignDate:r[CI.resignDate]||"",
              status:r[CI.status]||"재직",
              excludeCount: CI.excludeCount>=0?(r[CI.excludeCount]||"").toLowerCase()==="y":false,
            }
            if(existing){
              const autoLogs=buildChangeLogs(existing,{...existing,...newData},"엑셀업로드")
              next[existing.id]={...existing,...newData,memo:[...(existing.memo||[]),...autoLogs]}
              updated++
            } else {
              const id=`S${Date.now()}_${added}`
              const now=new Date()
              next[id]={...newData,id,photo:"",memo:[{
                id:`M${Date.now()}`,date:now.toISOString().slice(0,10),time:now.toTimeString().slice(0,5),
                datetime:`${now.toISOString().slice(0,10)} ${now.toTimeString().slice(0,5)}`,
                text:"🆕 엑셀 업로드로 등록",author:"시스템",type:"시스템",auto:true
              }]}
              added++
            }
          })
          return next
        })
        alert(`✅ 완료: 신규 ${added}명 추가, 업데이트 ${updated}명`)
      }catch(err){alert("업로드 오류: "+err.message)}
    }
    r.readAsBinaryString(f); e.target.value=""
  }

  const startEdit=s=>{setDraft({...s});setShowAdd(true)}
  const startAdd=()=>{
    setDraft({id:null,name:"",nameEn:"",dept:DEPTS[0]||"",rank:"사원",gender:"남자",email:"",
              mobile:"",degree:"",school:"",joinDate:"",resignDate:"",status:"재직",excludeCount:false,photo:"",memo:[]})
    setShowAdd(true)
  }

  const INP={padding:"8px 12px",border:"1.5px solid #E5E7EB",borderRadius:8,fontSize:21,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"}
  const LBL={fontSize:18,fontWeight:700,color:"#0E9C8C",display:"block",marginBottom:4}
  const MEMO_TYPES=["일반","부서이동","직급변경","프로젝트","평가","기타"]
  const MEMO_COLOR={"일반":"#0E9C8C","부서이동":"#D97706","직급변경":"#059669","프로젝트":"#0891B2","평가":"#7C3AED","기타":"#6B7280","시스템":"#9CA3AF","변경사항":"#DC2626"}

  return (
    <div style={{fontFamily:"'Noto Sans KR',sans-serif"}}>
      {/* 헤더 */}
      <div style={{background:"linear-gradient(135deg,#312E81,#0E9C8C)",borderRadius:16,padding:"18px 22px",marginBottom:14,color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:30,fontWeight:900,marginBottom:3}}>👤 직원 관리 시스템</div>
          <div style={{fontSize:19.5,opacity:.8}}>
            전체 {staffList.length}명 · 인원집계 {staffList.filter(s=>!EXCLUDE_FROM_COUNT.has(s.status)&&!s.excludeCount).length}명 · 퇴사 {staffList.filter(s=>s.status==="퇴사").length}명
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={()=>setTab&&setTab("home")}
            style={{padding:"7px 14px",background:"rgba(255,255,255,.2)",color:"#fff",border:"2px solid rgba(255,255,255,.35)",borderRadius:9,fontSize:18.8,fontWeight:700,cursor:"pointer"}}>🏠 홈</button>
          <button onClick={downloadTemplate}
            style={{padding:"7px 14px",background:"#D1FAE5",color:"#065F46",border:"none",borderRadius:9,fontSize:18.8,fontWeight:700,cursor:"pointer"}}>⬇ 양식</button>
          <button onClick={downloadAll}
            style={{padding:"7px 14px",background:"#EDE9FE",color:"#5B21B6",border:"none",borderRadius:9,fontSize:18.8,fontWeight:700,cursor:"pointer"}}>⬇ 전체</button>
          <label style={{padding:"7px 14px",background:"#FEF3C7",color:"#92400E",border:"none",borderRadius:9,fontSize:18.8,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:3}}>
            ⬆ 업로드 <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={uploadExcel}/>
          </label>
          <button onClick={startAdd}
            style={{padding:"7px 14px",background:"#fff",color:"#0E9C8C",border:"none",borderRadius:9,fontSize:18.8,fontWeight:800,cursor:"pointer"}}>+ 추가</button>
          <button onClick={()=>{if(window.confirm("초기화하시겠습니까?")){localStorage.removeItem("sjs_staff_db");window.location.reload()}}}
            style={{padding:"7px 12px",background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.2)",borderRadius:9,fontSize:16.5,cursor:"pointer"}}>🔄</button>
        </div>
      </div>

      {/* 뷰 탭 */}
      <div style={{display:"flex",gap:4,marginBottom:14,background:"#F3F4F6",borderRadius:10,padding:3,width:"fit-content"}}>
        {[["org","🏢 조직도"],["list","👥 직원 목록"]].map(([v,l])=>(
          <button key={v} onClick={()=>{setView(v);if(v==="org")setSelId(null)}}
            style={{padding:"8px 20px",border:"none",borderRadius:8,fontSize:20.2,fontWeight:view===v?700:400,cursor:"pointer",
              background:view===v?"#fff":"none",color:view===v?"#0E9C8C":"#6B7280",
              boxShadow:view===v?"0 1px 4px rgba(0,0,0,.1)":"none"}}>
            {l}
          </button>
        ))}
      </div>

      {/* 조직도 뷰 */}
      {view==="org"&&<OrgChart org={org} setOrg={setOrg} staffList={staffList}/>}

      {/* 직원 목록 뷰 */}
      {view==="list"&&(
        <div>
          {/* 본부별 통계 */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            <div onClick={()=>setFilter(p=>({...p,dept:"전체"}))}
              style={{padding:"8px 14px",background:filter.dept==="전체"?"#0E9C8C":"#fff",borderRadius:10,cursor:"pointer",
                border:"2px solid #E5E7EB",display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:20.2,fontWeight:700,color:filter.dept==="전체"?"#fff":"#6B7280"}}>전체</span>
              <span style={{fontSize:27,fontWeight:900,color:filter.dept==="전체"?"#fff":"#111827"}}>
                {staffList.filter(s=>!EXCLUDE_FROM_COUNT.has(s.status)&&!s.excludeCount).length}
              </span>
            </div>
            {Object.entries(deptStats).sort((a,b)=>b[1]-a[1]).map(([d,c])=>(
              <div key={d} onClick={()=>setFilter(p=>({...p,dept:d}))}
                style={{padding:"8px 14px",background:filter.dept===d?(DEPT_COLORS[d]||"#0E9C8C"):"#fff",borderRadius:10,cursor:"pointer",
                  border:`2px solid ${DEPT_COLORS[d]||"#0E9C8C"}`,display:"flex",gap:8,alignItems:"center"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:filter.dept===d?"#fff":(DEPT_COLORS[d]||"#0E9C8C")}}/>
                <span style={{fontSize:19.5,fontWeight:700,color:filter.dept===d?"#fff":(DEPT_COLORS[d]||"#0E9C8C")}}>{d}</span>
                <span style={{fontSize:27,fontWeight:900,color:filter.dept===d?"#fff":"#111827"}}>{c}</span>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:12}}>
            {/* 목록 */}
            <div style={{width:290,flexShrink:0}}>
              <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"10px",marginBottom:8}}>
                <input value={filter.search} onChange={e=>setFilter(p=>({...p,search:e.target.value}))}
                  placeholder="🔍 이름·직급·이메일" style={{...INP,marginBottom:6}}/>
                <select value={filter.status} onChange={e=>setFilter(p=>({...p,status:e.target.value}))} style={INP}>
                  <option value="전체">전체</option>
                  {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{fontSize:18,color:"#6B7280",marginTop:6,fontWeight:600}}>{filtered.length}명</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:"calc(100vh-450px)",overflowY:"auto"}}>
                {filtered.map(s=>(
                  <div key={s.id} onClick={()=>{setSelId(s.id);setShowAdd(false)}}
                    style={{background:selId===s.id?"#E3F6F3":"#fff",borderRadius:10,
                      border:`1.5px solid ${selId===s.id?"#0E9C8C":"#E5E7EB"}`,
                      padding:"9px 11px",cursor:"pointer",display:"flex",gap:9,alignItems:"center"}}>
                    <div style={{width:40,height:40,borderRadius:"50%",flexShrink:0,background:s.photo?"transparent":"#E5E7EB",
                      overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {s.photo?<img src={s.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:25.5,color:"#9CA3AF"}}>👤</span>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:4,alignItems:"center",marginBottom:1}}>
                        <span style={{fontSize:21,fontWeight:800,color:"#111827"}}>{s.name}</span>
                        <span style={{fontSize:13.5,padding:"1px 5px",borderRadius:7,background:STATUS_BG[s.status]||"#F3F4F6",color:STATUS_COLOR[s.status]||"#6B7280",fontWeight:700}}>{s.status}</span>
                        {s.excludeCount&&<span style={{fontSize:13.5,padding:"1px 5px",borderRadius:7,background:"#F3F4F6",color:"#9CA3AF",fontWeight:700}}>제외</span>}
                      </div>
                      <div style={{fontSize:17.2,color:"#6B7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.dept}·{s.rank}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 상세 */}
            <div style={{flex:1}}>
              {showAdd&&draft&&(
                <div style={{background:"#fff",borderRadius:14,border:"2px solid #0E9C8C",padding:"20px",marginBottom:12}}>
                  <div style={{fontSize:24,fontWeight:800,color:"#312E81",marginBottom:14}}>{draft.id?"✏ 정보 수정":"+ 신규 등록"}</div>
                  <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr",gap:9,marginBottom:9}}>
                    {[["이름 *","name"],["영문","nameEn"],["이메일","email"]].map(([l,k])=>(
                      <div key={k}><label style={LBL}>{l}</label><input value={draft[k]||""} onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))} style={INP}/></div>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:9,marginBottom:9}}>
                    <div><label style={LBL}>본부</label>
                      <select value={draft.dept||""} onChange={e=>setDraft(p=>({...p,dept:e.target.value}))} style={INP}>
                        {["",...allDepts,...(DEPTS.filter(d=>!allDepts.includes(d)))].map(d=><option key={d} value={d}>{d||"미배정"}</option>)}
                      </select></div>
                    <div><label style={LBL}>직급</label>
                      <select value={draft.rank||""} onChange={e=>setDraft(p=>({...p,rank:e.target.value}))} style={INP}>
                        {RANK_ORDER.map(r=><option key={r} value={r}>{r||"없음"}</option>)}
                      </select></div>
                    <div><label style={LBL}>재직상태</label>
                      <select value={draft.status||"재직"} onChange={e=>setDraft(p=>({...p,status:e.target.value}))} style={INP}>
                        {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                      </select></div>
                    <div><label style={LBL}>핸드폰</label><input value={draft.mobile||""} onChange={e=>setDraft(p=>({...p,mobile:e.target.value}))} style={INP}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:9}}>
                    {[["입사일","joinDate"],["퇴사일","resignDate"]].map(([l,k])=>(
                      <div key={k}><label style={LBL}>{l}</label><input value={draft[k]||""} placeholder="YYYY-MM-DD" onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))} style={INP}/></div>
                    ))}
                  </div>
                  <label style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,cursor:"pointer",fontSize:20.2,fontWeight:600,color:"#374151"}}>
                    <input type="checkbox" checked={draft.excludeCount||false} onChange={e=>setDraft(p=>({...p,excludeCount:e.target.checked}))} style={{width:16,height:16}}/>
                    인원 집계에서 제외 (회장, 비카운트 등)
                  </label>
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                    <button onClick={()=>{setShowAdd(false);setDraft(null)}}
                      style={{padding:"8px 16px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:9,fontSize:19.5,fontWeight:600,cursor:"pointer"}}>취소</button>
                    <button onClick={saveDraft}
                      style={{padding:"8px 20px",background:"#0E9C8C",color:"#fff",border:"none",borderRadius:9,fontSize:19.5,fontWeight:800,cursor:"pointer"}}>💾 저장</button>
                  </div>
                </div>
              )}

              {sel&&!showAdd&&(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",padding:"18px",display:"flex",gap:18,alignItems:"flex-start"}}>
                    <div style={{flexShrink:0,textAlign:"center"}}>
                      <div style={{width:90,height:90,borderRadius:14,background:"#E5E7EB",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",border:"3px solid #E5E7EB",marginBottom:6}}>
                        {sel.photo?<img src={sel.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:60}}>👤</span>}
                      </div>
                      <input type="file" ref={photoRef} accept="image/*" style={{display:"none"}} onChange={handlePhoto}/>
                      <button onClick={()=>photoRef.current?.click()}
                        style={{padding:"4px 10px",background:"#E3F6F3",color:"#0E9C8C",border:"none",borderRadius:6,fontSize:17.2,cursor:"pointer",fontWeight:700}}>📷 사진</button>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:30,fontWeight:900,color:"#111827"}}>{sel.name}</span>
                        {sel.nameEn&&<span style={{fontSize:19.5,color:"#9CA3AF"}}>{sel.nameEn}</span>}
                        <span style={{fontSize:16.5,padding:"2px 9px",borderRadius:9,background:STATUS_BG[sel.status]||"#F3F4F6",color:STATUS_COLOR[sel.status]||"#6B7280",fontWeight:800}}>{sel.status}</span>
                        {sel.excludeCount&&<span style={{fontSize:16.5,padding:"2px 9px",borderRadius:9,background:"#F3F4F6",color:"#9CA3AF",fontWeight:700}}>인원제외</span>}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px 18px",fontSize:20.2,marginBottom:10}}>
                        {[["본부",sel.dept],["직급",sel.rank],["이메일",sel.email],["핸드폰",sel.mobile||"-"],["입사일",sel.joinDate||"-"],["퇴사일",sel.resignDate||"-"]].map(([l,v])=>(
                          <div key={l} style={{display:"flex",gap:8}}>
                            <span style={{color:"#9CA3AF",minWidth:42,flexShrink:0,fontWeight:600}}>{l}</span>
                            <span style={{fontWeight:v&&v!=="-"?700:400,color:"#111827"}}>{v||"-"}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:7}}>
                        <button onClick={()=>startEdit(sel)}
                          style={{padding:"6px 14px",background:"#0E9C8C",color:"#fff",border:"none",borderRadius:9,fontSize:19.5,fontWeight:700,cursor:"pointer"}}>✏ 수정</button>
                        <button onClick={()=>{if(window.confirm("삭제?")){setStaffDB(p=>{const n={...p};delete n[sel.id];return n});setSelId(null)}}}
                          style={{padding:"6px 14px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:9,fontSize:19.5,fontWeight:700,cursor:"pointer"}}>🗑 삭제</button>
                      </div>
                    </div>
                  </div>

                  {/* 히스토리 */}
                  <div style={{background:"#fff",borderRadius:14,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                    <div style={{padding:"12px 16px",borderBottom:"1px solid #E5E7EB",fontSize:22.5,fontWeight:800,color:"#111827"}}>
                      📋 히스토리 ({(sel.memo||[]).length}건)
                    </div>
                    <div style={{padding:"10px 14px",background:"#F9FAFB",borderBottom:"1px solid #E5E7EB"}}>
                      <div style={{display:"flex",gap:5,marginBottom:7,flexWrap:"wrap"}}>
                        {MEMO_TYPES.map(t=>(
                          <button key={t} onClick={()=>setMemoType(t)}
                            style={{padding:"3px 10px",border:`2px solid ${memoType===t?(MEMO_COLOR[t]||"#0E9C8C"):"#E5E7EB"}`,
                              borderRadius:7,fontSize:18,cursor:"pointer",fontWeight:memoType===t?700:400,
                              background:memoType===t?(MEMO_COLOR[t]||"#0E9C8C"):"#fff",
                              color:memoType===t?"#fff":"#6B7280"}}>
                            {t}
                          </button>
                        ))}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"140px 1fr auto",gap:6,alignItems:"center"}}>
                        <input type="date" value={memoDate} onChange={e=>setMemoDate(e.target.value)}
                          style={{...INP,fontSize:18.8}}/>
                        <input value={newMemo} onChange={e=>setNewMemo(e.target.value)}
                          onKeyDown={e=>e.key==="Enter"&&addMemo()}
                          placeholder={`[${memoType}] 내용 입력`}
                          style={INP}/>
                        <button onClick={addMemo}
                          style={{padding:"8px 16px",background:"#0E9C8C",color:"#fff",border:"none",borderRadius:9,fontSize:19.5,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>+ 기록</button>
                      </div>
                    </div>
                    <div style={{maxHeight:360,overflowY:"auto"}}>
                      {(sel.memo||[]).length===0&&(
                        <div style={{padding:"36px",textAlign:"center",color:"#9CA3AF",fontSize:19.5}}>아직 기록이 없습니다.</div>
                      )}
                      {[...(sel.memo||[])].reverse().map((m,i)=>(
                        <div key={m.id||i} style={{padding:"11px 14px",borderBottom:"1px solid #F3F4F6",display:"flex",gap:10,alignItems:"flex-start",background:m.auto?"#FAFAFA":"#fff"}}>
                          <div style={{width:3,background:MEMO_COLOR[m.type||"일반"]||"#0E9C8C",borderRadius:2,alignSelf:"stretch",flexShrink:0}}/>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                              <span style={{fontSize:16.5,padding:"1px 6px",borderRadius:7,background:(MEMO_COLOR[m.type||"일반"]||"#0E9C8C")+"18",color:MEMO_COLOR[m.type||"일반"]||"#0E9C8C",fontWeight:700}}>{m.type||"일반"}</span>
                              <span style={{fontSize:19.5,fontWeight:800,color:"#374151"}}>{m.date}</span>
                              {m.time&&<span style={{fontSize:17.2,color:"#9CA3AF"}}>{m.time}</span>}
                              {m.author&&<span style={{fontSize:16.5,color:"#9CA3AF"}}>by {m.author}</span>}
                              {m.auto&&<span style={{fontSize:13.5,background:"#E3F6F3",color:"#0E9C8C",padding:"1px 5px",borderRadius:4}}>자동</span>}
                            </div>
                            <div style={{fontSize:20.2,color:"#111827",lineHeight:1.6}}>{m.text}</div>
                          </div>
                          {!m.auto&&<button onClick={()=>{
                            const real=[...(sel.memo||[])]; real.splice(real.length-1-i,1)
                            setStaffDB(prev=>({...prev,[sel.id]:{...sel,memo:real}}))
                          }} style={{padding:"2px 7px",background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:5,fontSize:16.5,cursor:"pointer",flexShrink:0}}>✕</button>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!sel&&!showAdd&&(
                <div style={{padding:"60px",textAlign:"center",color:"#9CA3AF",background:"#fff",borderRadius:14,border:"1px solid #E5E7EB"}}>
                  <div style={{fontSize:63,marginBottom:10}}>👤</div>
                  <div style={{fontSize:22.5,fontWeight:700,color:"#374151",marginBottom:5}}>직원을 선택하면 상세정보가 표시됩니다</div>
                  <div style={{fontSize:18.8}}>왼쪽 목록에서 이름을 클릭하세요</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
