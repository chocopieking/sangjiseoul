// ══════════════════════════════════════════════════════════════
// 데이터관리 탭 — 모든 운영 데이터를 한 곳에서, 본부별 권한으로 입력
// ══════════════════════════════════════════════════════════════
import { useState } from "react"
import { fE, MONTHS, DEPTS, DEPT_COLORS } from "./data.js"

const C = {
  navy:"#0C447C",navyM:"#185FA5",navyL:"#E6F1FB",
  green:"#1D9E75",greenL:"#EAF3DE",
  amber:"#BA7517",amberL:"#FAEEDA",
  red:"#A32D2D",  redL:"#FCEBEB",
  gray:"#888780", grayL:"#F1EFE8",
}
const S = {
  card:(x={})=>({background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:14,padding:"19px 22px",marginBottom:16,...x}),
  th:(a="left")=>({padding:"10px 12px",textAlign:a,fontSize:13,fontWeight:600,color:"var(--color-text-secondary,#888)",background:"var(--color-background-secondary,#f8f8f6)",borderBottom:"1px solid var(--color-border-tertiary,#eee)",whiteSpace:"nowrap"}),
  td:(a="right")=>({padding:"9px 12px",borderBottom:"0.5px solid var(--color-border-tertiary,#eee)",textAlign:a,fontSize:14,verticalAlign:"middle"}),
  bdg:(bg,fg)=>({display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:10,fontSize:12,fontWeight:600,background:bg,color:fg}),
  inp:(w=78)=>({width:w,padding:"7px 9px",border:"1px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:14,textAlign:"right",fontFamily:"inherit",background:"#fff",color:"#222"}),
  btn:(bg=C.navyM,fg="#fff")=>({padding:"10px 18px",background:bg,color:fg,border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}),
}
const cardTitle = {fontSize:17,fontWeight:700,marginBottom:4,letterSpacing:-.2}
const cardNote  = {fontSize:12.5,color:C.gray,marginBottom:14}
const num = v => { const n=parseFloat(v); return Number.isFinite(n)?n:0 }

const STAFF_DEPTS  = ["설계1본부","설계2본부","주거디자인본부","디자인본부","경영지원","해외사업부"]
const STAFF_FIELDS = [["total","합계"],["pm","PM"],["designer","설계인력"],["admin","행정"]]

// ══════════════════════════════════════════════════════════════
export function DataHubTab({
  currentUser, deptStaff, setDeptStaff, pnlData, setPnlData,
  cashflow, setCashflow, years, setYears,
  projects, setTab, setSelProjId, setSelVerIdx, setShowNewProj,
}) {
  const isAdmin = currentUser.role === "admin"
  const canEditDept = dept => isAdmin || (currentUser.write===true && currentUser.dept===dept)
  const myEditable = STAFF_DEPTS.filter(d=>canEditDept(d))

  const SECTIONS = [
    {id:"staff",     label:"👥 본부 인원현황"},
    {id:"pnl",       label:"💰 월별 손익(부서별)"},
    {id:"cashflow",  label:"💧 월수금(부서별)"},
    {id:"years",     label:"📈 3개년 실적"},
    {id:"projects",  label:"🏗 프로젝트·협력업체"},
  ]
  const [section,setSection] = useState("staff")

  return (
    <div>
      {/* 권한 안내 배너 */}
      <div style={{background:C.navyL,borderLeft:`6px solid ${C.navyM}`,borderRadius:"0 12px 12px 0",padding:"14px 18px",marginBottom:18,display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
        <i className="ti ti-database" aria-hidden="true" style={{fontSize:26,color:C.navyM,flexShrink:0}}/>
        <div style={{fontSize:14,lineHeight:1.7,color:"#0C447C"}}>
          <b>모든 운영 데이터를 이 화면에서 입력합니다.</b> 본부 인원·월별 손익·월수금계획은 <b>본인 본부 데이터만 입력</b>할 수 있고,
          입력 즉시 <b>전체 구성원이 조회</b>할 수 있습니다. 프로젝트·협력업체는 구조가 달라 전용 화면(프로젝트 탭)에서 관리하며, 아래 ‘프로젝트·협력업체’ 섹션에서 바로 이동할 수 있습니다.
          {isAdmin
            ? <div style={{marginTop:6}}><span style={S.bdg(C.greenL,"#27500A")}>관리자</span> 모든 본부 데이터를 입력할 수 있습니다.</div>
            : <div style={{marginTop:6}}>
                {myEditable.length>0
                  ? <><span style={S.bdg(C.greenL,"#27500A")}>입력 가능 본부</span> {myEditable.join(", ")}</>
                  : <><span style={S.bdg(C.amberL,"#633806")}>조회 전용</span> 현재 계정({currentUser.dept})은 입력 권한이 없습니다. 데이터 입력이 필요하면 관리자에게 요청하세요.</>}
              </div>}
        </div>
      </div>

      {/* 섹션 탭 */}
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        {SECTIONS.map(s=>(
          <button key={s.id} onClick={()=>setSection(s.id)} style={{
            padding:"11px 18px",border:"none",borderRadius:11,fontSize:14.5,fontWeight:700,cursor:"pointer",
            background:section===s.id?C.navy:"var(--color-background-primary,#fff)",
            color:section===s.id?"#fff":"var(--color-text-secondary,#888)",
            boxShadow:section===s.id?"0 2px 10px rgba(12,68,124,.25)":"0 0 0 0.5px var(--color-border-tertiary,#e4e4e0)",
          }}>{s.label}</button>
        ))}
      </div>

      {section==="staff"     && <StaffSection deptStaff={deptStaff} setDeptStaff={setDeptStaff} canEditDept={canEditDept}/>}
      {section==="pnl"       && <PnlDeptSection pnlData={pnlData} setPnlData={setPnlData} canEditDept={canEditDept} currentUser={currentUser} isAdmin={isAdmin}/>}
      {section==="cashflow"  && <CashflowDeptSection cashflow={cashflow} setCashflow={setCashflow} canEditDept={canEditDept} currentUser={currentUser} isAdmin={isAdmin}/>}
      {section==="years"     && <YearsSection years={years} setYears={setYears} isAdmin={isAdmin}/>}
      {section==="projects"  && <ProjectsShortcut projects={projects} currentUser={currentUser} isAdmin={isAdmin} setTab={setTab} setSelProjId={setSelProjId} setSelVerIdx={setSelVerIdx} setShowNewProj={setShowNewProj}/>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 1) 본부 인원현황
// ════════════════════════════════════════════════════════════
function StaffSection({deptStaff,setDeptStaff,canEditDept}) {
  const [editing,setEditing] = useState(false)
  const [draft,setDraft]     = useState(null)
  const work = editing ? draft : deptStaff
  const start = ()=>{ setDraft(JSON.parse(JSON.stringify(deptStaff))); setEditing(true) }
  const save  = ()=>{ setDeptStaff(draft); setEditing(false); setDraft(null) }
  const cancel= ()=>{ setEditing(false); setDraft(null) }
  const upd   = (dept,field,v)=>setDraft(p=>({...p,[dept]:{...p[dept],[field]:num(v)}}))
  const editableAny = STAFF_DEPTS.some(canEditDept)

  return (
    <div style={S.card()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:4}}>
        <div>
          <div style={cardTitle}>👥 본부별 인원현황</div>
          <div style={cardNote}>합계 = PM + 설계인력 + 행정 권장 (검산은 자동표시)</div>
        </div>
        {editableAny && (!editing
          ? <button onClick={start} style={S.btn(C.navyL,C.navyM)}><i className="ti ti-edit" aria-hidden="true"/> 인원 입력</button>
          : <div style={{display:"flex",gap:8}}>
              <button onClick={save} style={S.btn(C.green)}>저장</button>
              <button onClick={cancel} style={S.btn(C.grayL,C.gray)}>취소</button>
            </div>)}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:620}}>
          <thead><tr>
            <th style={S.th()}>본부</th>
            {STAFF_FIELDS.map(([k,l])=><th key={k} style={S.th("right")}>{l}(명)</th>)}
            <th style={S.th("right")}>검산</th>
            <th style={S.th("center")}>권한</th>
          </tr></thead>
          <tbody>
            {STAFF_DEPTS.map((dept,i)=>{
              const st = work[dept]||{total:0,pm:0,designer:0,admin:0}
              const editableHere = editing && canEditDept(dept)
              const sum = num(st.pm)+num(st.designer)+num(st.admin)
              const mismatch = Math.abs(sum-num(st.total))>0.01
              return (
                <tr key={dept} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={{...S.td("left"),fontWeight:700}}>
                    <span style={{display:"inline-block",width:11,height:11,borderRadius:3,background:DEPT_COLORS[dept]||C.gray,marginRight:8,verticalAlign:"middle"}}/>{dept}
                  </td>
                  {STAFF_FIELDS.map(([k])=>(
                    <td key={k} style={S.td()}>
                      {editableHere
                        ? <input type="number" step="0.1" value={st[k]} onChange={e=>upd(dept,k,e.target.value)} style={S.inp()}/>
                        : <span style={{fontWeight:k==="total"?700:400,fontSize:k==="total"?16:14}}>{num(st[k]).toFixed(1)}</span>}
                    </td>
                  ))}
                  <td style={S.td()}>{!mismatch
                    ? <span style={{...S.bdg(C.greenL,"#27500A"),fontSize:11}}>일치</span>
                    : <span style={{...S.bdg(C.amberL,"#633806"),fontSize:11}}>{sum.toFixed(1)} 합계</span>}</td>
                  <td style={S.td("center")}>{canEditDept(dept)
                    ? <span style={{...S.bdg(C.greenL,"#27500A"),fontSize:11}}>입력가능</span>
                    : <span style={{...S.bdg(C.grayL,C.gray),fontSize:11}}>조회</span>}</td>
                </tr>
              )
            })}
            <tr style={{background:"var(--color-background-secondary,#f0f0ee)",fontWeight:700}}>
              <td style={S.td("left")}>전사 합계</td>
              <td style={{...S.td(),fontSize:16,color:C.navyM}}>{STAFF_DEPTS.reduce((s,d)=>s+num(work[d]?.total),0).toFixed(1)}</td>
              <td style={S.td()}>{STAFF_DEPTS.reduce((s,d)=>s+num(work[d]?.pm),0).toFixed(1)}</td>
              <td style={S.td()}>{STAFF_DEPTS.reduce((s,d)=>s+num(work[d]?.designer),0).toFixed(1)}</td>
              <td style={S.td()}>{STAFF_DEPTS.reduce((s,d)=>s+num(work[d]?.admin),0).toFixed(1)}</td>
              <td/><td/>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 2) 월별 손익 (부서별 — 매출/인건비/외주비)
// ════════════════════════════════════════════════════════════
function PnlDeptSection({pnlData,setPnlData,canEditDept,currentUser,isAdmin}) {
  const myDeptInList = DEPTS.includes(currentUser.dept) ? currentUser.dept : DEPTS[0]
  const [selDept,setSelDept] = useState(myDeptInList)
  const [editing,setEditing] = useState(false)
  const [draft,setDraft]     = useState(null)

  const canEdit = canEditDept(selDept)
  const buildDraft = ()=>pnlData.map(r=>{
    const bd = r.byDept?.[selDept]||{}
    return {rev:num(bd.rev),sal:num(bd.sal),sub:num(bd.sub)}
  })
  const start = ()=>{ setDraft(buildDraft()); setEditing(true) }
  const save  = ()=>{
    setPnlData(prev=>prev.map((r,i)=>({...r,byDept:{...r.byDept,[selDept]:{...draft[i]}}})))
    setEditing(false); setDraft(null)
  }
  const cancel = ()=>{ setEditing(false); setDraft(null) }
  const upd = (i,k,v)=>setDraft(p=>p.map((row,ri)=>ri===i?{...row,[k]:num(v)}:row))

  const FIELDS = [["rev","매출",C.green],["sal","인건비",C.navyM],["sub","외주비",C.amber]]
  const work = editing ? draft : pnlData.map(r=>r.byDept?.[selDept]||{rev:0,sal:0,sub:0})
  const totals = FIELDS.map(([k])=>work.reduce((s,r)=>s+num(r[k]),0))
  const pnlTotal = totals[0]-totals[1]-totals[2]

  return (
    <div style={S.card()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:6}}>
        <div>
          <div style={cardTitle}>💰 본부별 월별 손익 입력</div>
          <div style={cardNote}>단위: 억원 · 매출·인건비·외주비를 입력하면 본부 손익(추정)이 자동 계산됩니다</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <select value={selDept} onChange={e=>{setSelDept(e.target.value);setEditing(false);setDraft(null)}}
            style={{padding:"9px 13px",border:"1px solid var(--color-border-secondary,#ccc)",borderRadius:10,fontSize:14,fontWeight:600,background:"#fff"}}>
            {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
          {canEdit && (!editing
            ? <button onClick={start} style={S.btn(C.navyL,C.navyM)}><i className="ti ti-edit" aria-hidden="true"/> {selDept} 손익 입력</button>
            : <div style={{display:"flex",gap:8}}>
                <button onClick={save} style={S.btn(C.green)}>저장</button>
                <button onClick={cancel} style={S.btn(C.grayL,C.gray)}>취소</button>
              </div>)}
        </div>
      </div>
      {!canEdit && <div style={{...S.bdg(C.amberL,"#633806"),marginBottom:12}}>조회 전용 — {selDept}은(는) 현재 계정으로 입력할 수 없습니다.</div>}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
          <thead><tr>
            <th style={S.th()}>항목</th>
            {MONTHS.map(m=><th key={m} style={S.th("right")}>{m}</th>)}
            <th style={S.th("right")}>합계</th>
          </tr></thead>
          <tbody>
            {FIELDS.map(([k,l,c],fi)=>(
              <tr key={k} style={{background:fi%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                <td style={{...S.td("left"),fontWeight:700,color:c}}>{l}</td>
                {work.map((r,i)=>(
                  <td key={i} style={S.td()}>
                    {editing
                      ? <input type="number" step="0.01" value={r[k]} onChange={e=>upd(i,k,e.target.value)} style={S.inp(64)}/>
                      : <span style={{color:r[k]>0?c:"var(--color-text-secondary,#aaa)"}}>{num(r[k])>0?num(r[k]).toFixed(2):"-"}</span>}
                  </td>
                ))}
                <td style={{...S.td(),fontWeight:700,color:c}}>{totals[fi].toFixed(2)}</td>
              </tr>
            ))}
            <tr style={{background:"#FCEBEB",fontWeight:700}}>
              <td style={S.td("left")}>손익(추정)</td>
              {work.map((r,i)=>{
                const v = num(r.rev)-num(r.sal)-num(r.sub)
                return <td key={i} style={{...S.td(),color:v>=0?C.green:C.red}}>{v.toFixed(2)}</td>
              })}
              <td style={{...S.td(),fontSize:16,color:pnlTotal>=0?C.green:C.red}}>{pnlTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 3) 월수금계획 (부서별 — 월별 기성수금)
// ════════════════════════════════════════════════════════════
function CashflowDeptSection({cashflow,setCashflow,canEditDept,currentUser,isAdmin}) {
  const myDeptInList = DEPTS.includes(currentUser.dept) ? currentUser.dept : DEPTS[0]
  const [selDept,setSelDept] = useState(myDeptInList)
  const [editing,setEditing] = useState(false)
  const [draft,setDraft]     = useState(null)
  const canEdit = canEditDept(selDept)

  const buildDraft = ()=>cashflow.map(m=>num(m.byDept?.[selDept]))
  const start = ()=>{ setDraft(buildDraft()); setEditing(true) }
  const save  = ()=>{
    setCashflow(prev=>prev.map((m,i)=>({...m,byDept:{...m.byDept,[selDept]:draft[i]}})))
    setEditing(false); setDraft(null)
  }
  const cancel = ()=>{ setEditing(false); setDraft(null) }
  const upd = (i,v)=>setDraft(p=>p.map((x,ri)=>ri===i?num(v):x))

  const work = editing ? draft : cashflow.map(m=>num(m.byDept?.[selDept]))
  const total = work.reduce((s,v)=>s+v,0)

  return (
    <div style={S.card()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:6}}>
        <div>
          <div style={cardTitle}>💧 본부별 월수금계획 입력</div>
          <div style={cardNote}>단위: 억원(VAT포함) · 본부별 월별 기성수금 예상·실적을 입력합니다</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <select value={selDept} onChange={e=>{setSelDept(e.target.value);setEditing(false);setDraft(null)}}
            style={{padding:"9px 13px",border:"1px solid var(--color-border-secondary,#ccc)",borderRadius:10,fontSize:14,fontWeight:600,background:"#fff"}}>
            {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
          {canEdit && (!editing
            ? <button onClick={start} style={S.btn(C.navyL,C.navyM)}><i className="ti ti-edit" aria-hidden="true"/> {selDept} 수금 입력</button>
            : <div style={{display:"flex",gap:8}}>
                <button onClick={save} style={S.btn(C.green)}>저장</button>
                <button onClick={cancel} style={S.btn(C.grayL,C.gray)}>취소</button>
              </div>)}
        </div>
      </div>
      {!canEdit && <div style={{...S.bdg(C.amberL,"#633806"),marginBottom:12}}>조회 전용 — {selDept}은(는) 현재 계정으로 입력할 수 없습니다.</div>}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
          <thead><tr>
            <th style={S.th()}>구분</th>
            {MONTHS.map((m,i)=><th key={m} style={S.th("right")}>{m}{cashflow[i]?.actual&&<span style={{...S.bdg(C.navyL,C.navyM),marginLeft:3,fontSize:9}}>실</span>}</th>)}
            <th style={S.th("right")}>합계</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style={{...S.td("left"),fontWeight:700,color:DEPT_COLORS[selDept]||C.navyM}}>기성수금</td>
              {work.map((v,i)=>(
                <td key={i} style={S.td()}>
                  {editing
                    ? <input type="number" step="0.01" value={v} onChange={e=>upd(i,e.target.value)} style={S.inp(64)}/>
                    : <span style={{color:v>0?DEPT_COLORS[selDept]||C.navyM:"var(--color-text-secondary,#aaa)"}}>{v>0?v.toFixed(2):"-"}</span>}
                </td>
              ))}
              <td style={{...S.td(),fontSize:16,fontWeight:700,color:C.navyM}}>{total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 4) 3개년 실적 (관리자)
// ════════════════════════════════════════════════════════════
function YearsSection({years,setYears,isAdmin}) {
  const [editing,setEditing] = useState(false)
  const [draft,setDraft]     = useState(null)
  const work = editing ? draft : years
  const start = ()=>{ setDraft(JSON.parse(JSON.stringify(years))); setEditing(true) }
  const save  = ()=>{ setYears(draft); setEditing(false); setDraft(null) }
  const cancel= ()=>{ setEditing(false); setDraft(null) }
  const upd = (i,k,v)=>setDraft(p=>p.map((row,ri)=>ri===i?{...row,[k]:k==="yr"?v:num(v)}:row))
  const addYear = ()=>{
    const last = draft[draft.length-1]
    setDraft(p=>[...p,{yr:String(num(last?.yr)+1||new Date().getFullYear()),목표수주:0,실행수주:0,목표매출:0,실행매출:0,인원:0}])
  }
  const FIELDS = [["목표수주","수주목표"],["실행수주","수주실행"],["목표매출","매출목표"],["실행매출","매출실행"],["인원","연평균인원"]]

  return (
    <div style={S.card()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:6}}>
        <div>
          <div style={cardTitle}>📈 연도별 수주·매출·인원 (3개년 이상)</div>
          <div style={cardNote}>전사 단위 데이터 · 관리자만 입력 가능</div>
        </div>
        {isAdmin && (!editing
          ? <button onClick={start} style={S.btn(C.navyL,C.navyM)}><i className="ti ti-edit" aria-hidden="true"/> 연도 데이터 입력</button>
          : <div style={{display:"flex",gap:8}}>
              <button onClick={addYear} style={S.btn(C.amber)}>+ 연도 추가</button>
              <button onClick={save} style={S.btn(C.green)}>저장</button>
              <button onClick={cancel} style={S.btn(C.grayL,C.gray)}>취소</button>
            </div>)}
      </div>
      {!isAdmin && <div style={{...S.bdg(C.amberL,"#633806"),marginBottom:12}}>조회 전용 — 3개년 실적 입력은 관리자만 가능합니다.</div>}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:680}}>
          <thead><tr>
            <th style={S.th()}>연도</th>
            {FIELDS.map(([k,l])=><th key={k} style={S.th("right")}>{l}(억)</th>)}
          </tr></thead>
          <tbody>
            {work.map((y,i)=>(
              <tr key={i} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                <td style={{...S.td("left"),fontWeight:700}}>
                  {editing ? <input value={y.yr} onChange={e=>upd(i,"yr",e.target.value)} style={{...S.inp(70),textAlign:"left"}}/> : y.yr}
                </td>
                {FIELDS.map(([k])=>(
                  <td key={k} style={S.td()}>
                    {editing
                      ? <input type="number" step="0.01" value={y[k]} onChange={e=>upd(i,k,e.target.value)} style={S.inp()}/>
                      : <span>{num(y[k]).toFixed(2)}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 5) 프로젝트·협력업체 — 전용 화면 바로가기
// ════════════════════════════════════════════════════════════
function ProjectsShortcut({projects,currentUser,isAdmin,setTab,setSelProjId,setSelVerIdx,setShowNewProj}) {
  const list = Array.isArray(projects) ? projects : []
  const mine = isAdmin || currentUser.dept==="경영진"
    ? list
    : list.filter(p=>Array.isArray(p.depts) && p.depts.includes(currentUser.dept))

  const goto = (id)=>{ setSelProjId?.(id); setSelVerIdx?.(0); setTab("projects") }
  const goNew = ()=>{ setShowNewProj?.(true); setTab("projects") }

  return (
    <div style={S.card()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:6}}>
        <div>
          <div style={cardTitle}>🏗 프로젝트·협력업체 데이터</div>
          <div style={cardNote}>프로젝트 정보·실행계획서 버전·협력업체 비용은 구조가 복잡해 전용 화면(프로젝트 탭)에서 관리합니다. 아래에서 바로 이동하세요.</div>
        </div>
        <button onClick={goNew} style={S.btn(C.green)}><i className="ti ti-plus" aria-hidden="true"/> 신규 프로젝트 등록</button>
      </div>
      <div style={{...S.bdg(C.navyL,C.navyM),marginBottom:12,fontWeight:600}}>
        {isAdmin||currentUser.dept==="경영진" ? "전체 프로젝트" : `${currentUser.dept} 관련 프로젝트`} {mine.length}건
      </div>
      {mine.length===0
        ? <div style={{padding:"14px 16px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:13}}>관련 프로젝트가 없습니다.</div>
        : <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}>
              <thead><tr>
                <th style={S.th()}>프로젝트명</th><th style={S.th()}>코드</th><th style={S.th()}>본부</th>
                <th style={S.th("right")}>진행률</th><th style={S.th()}>협력업체</th><th style={S.th("center")}>이동</th>
              </tr></thead>
              <tbody>
                {mine.map((p,i)=>{
                  const last = p.versions?.[p.versions.length-1]
                  return (
                    <tr key={p.id} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                      <td style={{...S.td("left"),fontWeight:600,maxWidth:280,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</td>
                      <td style={S.td("left")}>{p.code}</td>
                      <td style={S.td("left")}>{(p.depts||[]).join(", ")}</td>
                      <td style={S.td()}>{p.prog||0}%</td>
                      <td style={S.td()}>{last?.vendors?.length||0}개</td>
                      <td style={S.td("center")}><button onClick={()=>goto(p.id)} style={{...S.btn(C.navyL,C.navyM),padding:"7px 14px",fontSize:12.5}}>편집 ›</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>}
    </div>
  )
}
