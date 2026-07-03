// ══════════════════════════════════════════════════════════════
// 데이터관리 탭 — 모든 운영 데이터를 한 곳에서, 본부별 권한으로 입력
// ══════════════════════════════════════════════════════════════
import { useState } from "react"
import { fE, MONTHS } from "./data.js"
import { useDepts } from "./DeptContext.jsx"

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

const STAFF_FIELDS = [["total","합계"],["pm","PM"],["designer","설계인력"],["admin","행정"]]

const TYPE_LABEL = {staff:"본부인원",pnl:"월별손익",cashflow:"월수금",years:"3개년실적",all:"전체 스냅샷"}
const TYPE_COLOR = {staff:C.navyM,pnl:C.green,cashflow:C.amber,years:"#534AB7",all:C.red}

const summarizeStaff = (data,staffDepts) => (staffDepts||[]).map(d=>({dept:d,...(data?.[d]||{total:0,pm:0,designer:0,admin:0})}))
const summarizePnl = (data,depts) => (depts||[]).map(d=>{
  const s = (Array.isArray(data)?data:[]).reduce((a,r)=>{const bd=r.byDept?.[d]||{};return{rev:a.rev+num(bd.rev),sal:a.sal+num(bd.sal),sub:a.sub+num(bd.sub)}},{rev:0,sal:0,sub:0})
  return {dept:d,...s,pnl:s.rev-s.sal-s.sub}
})
const summarizeCashflow = (data,depts) => (depts||[]).map(d=>({dept:d,total:(Array.isArray(data)?data:[]).reduce((s,m)=>s+num(m.byDept?.[d]),0)}))

// ══════════════════════════════════════════════════════════════
export function DataHubTab({
  currentUser, deptStaff, setDeptStaff, staffTarget, setStaffTarget, staffMonthly, setStaffMonthly,
  pnlData, setPnlData,
  cashflow, setCashflow, years, setYears,
  projects, setProjects, setTab, setSelProjId, setSelVerIdx, setShowNewProj,
  versions, saveVersion, restoreVersion, deleteVersion,
  contractTypes, setContractTypes,
  projTypes, setProjTypes,
  bidTypes, setBidTypes,
  allData, restoreAllData,
  vendorsDB, setVendorsDB,
  vendorPayments, setVendorPayments,
}) {
  const {STAFF_DEPTS,DEPTS,DEPT_COLORS,departments,addDept,renameDept,deleteDept,setDeptColor,setDeptFinance,deptUsage} = useDepts()
  const isAdmin = currentUser.role === "admin"
  const canEditDept = dept => isAdmin || (currentUser.write===true && currentUser.dept===dept)
  const canManage = isAdmin || currentUser.write===true
  const myEditable = STAFF_DEPTS.filter(d=>canEditDept(d))

  const SECTIONS = [
    {id:"staff",     label:"👥 본부 인원현황"},
    {id:"pnl",       label:"💰 월별 손익(부서별)"},
    {id:"cashflow",  label:"💧 월수금(부서별)"},
    {id:"years",     label:"📈 3개년 실적"},
    {id:"projects",  label:"🏗 프로젝트·협력업체"},
    {id:"depts",     label:"🏢 본부 관리"},
    {id:"ctypes",    label:"🏷 수주유형 관리"},
    {id:"ptypes",    label:"🏢 건물유형 관리"},
    {id:"btypes",    label:"📋 수주형태 관리"},
    {id:"backup",    label:"💾 데이터 백업·복구", accent:true},
    {id:"history",   label:"📜 버전 기록", accent:true},
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
          저장할 때마다 <b>버전 기록</b>에 자동 보관되어 언제든 꺼내보고 복원할 수 있습니다.
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
            background:section===s.id?(s.accent?C.amber:C.navy):"var(--color-background-primary,#fff)",
            color:section===s.id?"#fff":(s.accent?C.amber:"var(--color-text-secondary,#888)"),
            boxShadow:section===s.id?"0 2px 10px rgba(12,68,124,.25)":"0 0 0 0.5px var(--color-border-tertiary,#e4e4e0)",
          }}>{s.label}</button>
        ))}
      </div>

      {section==="staff"     && <StaffSection deptStaff={deptStaff} setDeptStaff={setDeptStaff} staffTarget={staffTarget} setStaffTarget={setStaffTarget} staffMonthly={staffMonthly} setStaffMonthly={setStaffMonthly} years={years} STAFF_DEPTS={STAFF_DEPTS} DEPT_COLORS={DEPT_COLORS} canEditDept={canEditDept} currentUser={currentUser} saveVersion={saveVersion}/>}
      {section==="pnl"       && <PnlDeptSection pnlData={pnlData} setPnlData={setPnlData} DEPTS={DEPTS} canEditDept={canEditDept} currentUser={currentUser} isAdmin={isAdmin} saveVersion={saveVersion}/>}
      {section==="cashflow"  && <CashflowDeptSection cashflow={cashflow} setCashflow={setCashflow} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS} canEditDept={canEditDept} currentUser={currentUser} isAdmin={isAdmin} saveVersion={saveVersion}/>}
      {section==="years"     && <YearsSection years={years} setYears={setYears} isAdmin={isAdmin} currentUser={currentUser} saveVersion={saveVersion}/>}
      {section==="projects"  && <ProjectsShortcut projects={projects} setProjects={setProjects} vendorsDB={vendorsDB} setVendorsDB={setVendorsDB} setVendorPayments={setVendorPayments} currentUser={currentUser} isAdmin={isAdmin} setTab={setTab} setSelProjId={setSelProjId} setSelVerIdx={setSelVerIdx} setShowNewProj={setShowNewProj}/>}
      {section==="depts"     && <DeptManageSection departments={departments} addDept={addDept} renameDept={renameDept} deleteDept={deleteDept} setDeptColor={setDeptColor} setDeptFinance={setDeptFinance} deptUsage={deptUsage} isAdmin={isAdmin}/>}
      {section==="ctypes"    && <ContractTypeSection contractTypes={contractTypes||[]} setContractTypes={setContractTypes} canManage={canManage}/>}
      {section==="ptypes"    && <SimpleListSection title="🏢 건물유형 관리" description="프로젝트 개설 시 선택하는 건물 유형 목록입니다." list={projTypes||[]} setList={setProjTypes} canManage={canManage}/>}
      {section==="btypes"    && <SimpleListSection title="📋 수주형태 관리" description="프로젝트 수주형태(외주비 비교 기준) 목록입니다." list={bidTypes||[]} setList={setBidTypes} canManage={canManage}/>}
      {section==="backup"    && <BackupSection allData={allData} restoreAllData={restoreAllData} isAdmin={isAdmin}/>}
      {section==="history"   && <VersionHistorySection versions={versions} restoreVersion={restoreVersion} deleteVersion={deleteVersion} saveVersion={saveVersion}
                                    currentUser={currentUser} canManage={canManage} STAFF_DEPTS={STAFF_DEPTS} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS}
                                    deptStaff={deptStaff} staffTarget={staffTarget} staffMonthly={staffMonthly} pnlData={pnlData} cashflow={cashflow} years={years}/>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 1) 본부 인원현황
// ════════════════════════════════════════════════════════════
function StaffSection({deptStaff,setDeptStaff,staffTarget,setStaffTarget,staffMonthly,setStaffMonthly,years,STAFF_DEPTS,DEPT_COLORS,canEditDept,currentUser,saveVersion}) {
  const [editing,setEditing] = useState(false)
  const [draft,setDraft]     = useState(null)
  const [note,setNote]       = useState("")
  const work = editing ? draft : deptStaff
  const start = ()=>{ setDraft(JSON.parse(JSON.stringify(deptStaff))); setNote(""); setEditing(true) }
  const save  = ()=>{
    setDeptStaff(draft)
    saveVersion?.("staff", note.trim()||"본부 인원현황 수정", draft, currentUser.name)
    setEditing(false); setDraft(null); setNote("")
  }
  const cancel= ()=>{ setEditing(false); setDraft(null); setNote("") }
  const upd   = (dept,field,v)=>setDraft(p=>({...p,[dept]:{...p[dept],[field]:num(v)}}))
  const editableAny = STAFF_DEPTS.some(canEditDept)

  return (
    <>
    <div style={S.card()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:4}}>
        <div>
          <div style={cardTitle}>👥 본부별 인원현황</div>
          <div style={cardNote}>합계 = PM + 설계인력 + 행정 권장 (검산은 자동표시)</div>
        </div>
        {editableAny && (!editing
          ? <button onClick={start} style={S.btn(C.navyL,C.navyM)}><i className="ti ti-edit" aria-hidden="true"/> 인원 입력</button>
          : <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="버전 메모(선택) — 예: 6월 인사발령 반영" style={{...S.inp(220),textAlign:"left"}}/>
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
    <StaffPlanSection deptStaff={deptStaff} staffTarget={staffTarget} setStaffTarget={setStaffTarget} staffMonthly={staffMonthly} setStaffMonthly={setStaffMonthly} years={years} STAFF_DEPTS={STAFF_DEPTS} DEPT_COLORS={DEPT_COLORS} canEditDept={canEditDept} currentUser={currentUser} saveVersion={saveVersion}/>
    </>
  )
}

// ════════════════════════════════════════════════════════════
// 2) 월별 손익 (부서별 — 매출/인건비/외주비)
// ════════════════════════════════════════════════════════════
function PnlDeptSection({pnlData,setPnlData,DEPTS,canEditDept,currentUser,isAdmin,saveVersion}) {
  const myDeptInList = DEPTS.includes(currentUser.dept) ? currentUser.dept : DEPTS[0]
  const [selDept,setSelDept] = useState(myDeptInList)
  const [editing,setEditing] = useState(false)
  const [draft,setDraft]     = useState(null)
  const [note,setNote]       = useState("")

  const canEdit = canEditDept(selDept)
  const buildDraft = ()=>pnlData.map(r=>{
    const bd = r.byDept?.[selDept]||{}
    return {rev:num(bd.rev),sal:num(bd.sal),sub:num(bd.sub)}
  })
  const start = ()=>{ setDraft(buildDraft()); setNote(""); setEditing(true) }
  const save  = ()=>{
    const merged = pnlData.map((r,i)=>({...r,byDept:{...r.byDept,[selDept]:{...draft[i]}}}))
    setPnlData(merged)
    saveVersion?.("pnl", note.trim()||`${selDept} 월별 손익 입력`, merged, currentUser.name)
    setEditing(false); setDraft(null); setNote("")
  }
  const cancel = ()=>{ setEditing(false); setDraft(null); setNote("") }
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
            : <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <input value={note} onChange={e=>setNote(e.target.value)} placeholder="버전 메모(선택)" style={{...S.inp(180),textAlign:"left"}}/>
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
function CashflowDeptSection({cashflow,setCashflow,DEPTS,DEPT_COLORS,canEditDept,currentUser,isAdmin,saveVersion}) {
  const myDeptInList = DEPTS.includes(currentUser.dept) ? currentUser.dept : DEPTS[0]
  const [selDept,setSelDept] = useState(myDeptInList)
  const [editing,setEditing] = useState(false)
  const [draft,setDraft]     = useState(null)
  const [note,setNote]       = useState("")
  const canEdit = canEditDept(selDept)

  const buildDraft = ()=>cashflow.map(m=>num(m.byDept?.[selDept]))
  const start = ()=>{ setDraft(buildDraft()); setNote(""); setEditing(true) }
  const save  = ()=>{
    const merged = cashflow.map((m,i)=>({...m,byDept:{...m.byDept,[selDept]:draft[i]}}))
    setCashflow(merged)
    saveVersion?.("cashflow", note.trim()||`${selDept} 월수금 입력`, merged, currentUser.name)
    setEditing(false); setDraft(null); setNote("")
  }
  const cancel = ()=>{ setEditing(false); setDraft(null); setNote("") }
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
            : <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <input value={note} onChange={e=>setNote(e.target.value)} placeholder="버전 메모(선택)" style={{...S.inp(180),textAlign:"left"}}/>
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
function YearsSection({years,setYears,isAdmin,currentUser,saveVersion}) {
  const [editing,setEditing] = useState(false)
  const [draft,setDraft]     = useState(null)
  const [note,setNote]       = useState("")
  const work = editing ? draft : years
  const start = ()=>{ setDraft(JSON.parse(JSON.stringify(years))); setNote(""); setEditing(true) }
  const save  = ()=>{
    setYears(draft)
    saveVersion?.("years", note.trim()||"3개년 실적 수정", draft, currentUser.name)
    setEditing(false); setDraft(null); setNote("")
  }
  const cancel= ()=>{ setEditing(false); setDraft(null); setNote("") }
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
          : <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="버전 메모(선택)" style={{...S.inp(180),textAlign:"left"}}/>
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
// 5) 프로젝트·협력업체 — 통합 업로드 마법사
// ════════════════════════════════════════════════════════════
import * as XLSX from "xlsx"

function ProjectsShortcut({projects,setProjects,vendorsDB,setVendorsDB,setVendorPayments,currentUser,isAdmin,setTab,setSelProjId,setSelVerIdx,setShowNewProj}) {
  const [step, setStep]   = useState(null) // null | 'wizard' | 'done'
  const [files, setFiles] = useState({proj:null, vendor:null, payment:null})
  const [progress, setProgress] = useState({proj:null, vendor:null, payment:null})
  const [results, setResults]   = useState(null)
  const [running, setRunning]   = useState(false)

  const FILE_DEFS = [
    { key:"proj",    icon:"🏗", label:"프로젝트 목록",      desc:"프로젝트_목록.xls / xlsx", accept:".xls,.xlsx,.html" },
    { key:"vendor",  icon:"🤝", label:"협력업체 참여프로젝트", desc:"참여프로젝트_목록.xls / xlsx", accept:".xls,.xlsx,.html" },
    { key:"payment", icon:"💰", label:"프로젝트별 외주비",   desc:"프로젝트별_외주비.xlsx", accept:".xlsx,.xls" },
  ]

  const handleFile = (key, file) => {
    setFiles(p=>({...p,[key]:file}))
    setProgress(p=>({...p,[key]:"대기"}))
  }

  // 프로젝트 목록 파싱 (HTML XLS 또는 xlsx)
  const parseProjects = async (file) => {
    const text = await file.text()
    const isHTML = text.includes("<html") || text.includes("<!DOCTYPE")
    let rows = []
    if(isHTML) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, "text/html")
      const trs = doc.querySelectorAll("tr")
      trs.forEach(tr=>{ rows.push([...tr.querySelectorAll("td,th")].map(td=>td.textContent.trim())) })
    } else {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf); const ws = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:""})
    }
    const result = []; let added=0, updated=0
    const norm = n => { const m=n?.match(/^(\d{4}[-_]\d+)/); return m?m[1]:"" }
    rows.forEach((r,i)=>{
      if(i<3) return
      const pjno=String(r[0]||"").trim(); const name=String(r[1]||"").trim()
      if(!pjno || !name || pjno==="Pj No") return
      const dept=String(r[6]||"").trim(); const pm=String(r[7]||"").trim()
      const fee=parseFloat(String(r[15]||"0").replace(/,/g,""))||0
      const existing=(Array.isArray(projects)?projects:[]).find(p=>p.code===pjno||norm(p.name)===norm(name))
      if(existing){ result.push({...existing,code:pjno,pm:pm||existing.pm,totalFee:fee||existing.totalFee}); updated++ }
      else { result.push({id:`PI_${pjno||Date.now()}_${i}`,code:pjno,name,depts:[dept].filter(Boolean),pm,totalFee:fee,contractYear:parseInt(pjno)||new Date().getFullYear(),type:"확정",versions:[],memo:[]}); added++ }
    })
    return {data:result, added, updated}
  }

  // 협력업체 목록 파싱
  const parseVendors = async (file) => {
    const text = await file.text()
    const isHTML = text.includes("<html")
    let rows = []
    if(isHTML){
      const doc = new DOMParser().parseFromString(text,"text/html")
      doc.querySelectorAll("tr").forEach(tr=>rows.push([...tr.querySelectorAll("td,th")].map(td=>td.textContent.trim())))
    } else {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""})
    }
    const db = {...(vendorsDB||{})}; let added=0, updated=0
    const skips = new Set(["","nan","협력업체명","업무구분","이름","등록된 프로젝트가 없습니다."])
    rows.forEach((r,i)=>{
      if(i<3) return
      const name=String(r[2]||"").trim(); if(!name||skips.has(name)) return
      const existing=Object.values(db).find(v=>v.name===name)
      const pjno=String(r[14]||"").trim(); const pjname=String(r[15]||"").trim()
      const projEntry = pjno&&pjno.includes("[")?{pjNo:pjno,name:pjname,type:String(r[16]||""),dept:String(r[17]||""),contractField:String(r[20]||"")}:null
      if(existing){
        if(projEntry&&!existing.projects?.some(p=>p.pjNo===projEntry.pjNo))
          db[existing.id]={...existing,projects:[...(existing.projects||[]),projEntry]}
        updated++
      } else {
        const id=`V${Date.now()}_${i}`
        db[id]={id,name,bizType:String(r[0]||""),bizNo:String(r[1]||""),rep:String(r[3]||""),repTel:String(r[4]||""),repMail:String(r[5]||""),addr:String(r[9]||""),projects:projEntry?[projEntry]:[],paymentHistory:[],memo:[]}
        added++
      }
    })
    return {data:db, added, updated}
  }

  // 외주비 파싱
  const parsePayments = async (file) => {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf); const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:""})
    const records=[]; let currentProj=""
    const toAmt=v=>{ try{const f=parseFloat(String(v).replace(/,/g,""));return Number.isFinite(f)&&f>0?Math.round(f):0}catch{return 0} }
    const toDate=v=>{ const m=String(v).match(/(\d{4})-(\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:""  }
    for(let i=3;i<rows.length;i++){
      const r=rows[i]; const c0=String(r[0]||"").trim(); const c4=String(r[4]||"").trim(); const c5=String(r[5]||"").trim(); const c6=String(r[6]||"").trim()
      if(c0&&!c4&&!c5){currentProj=c0;continue}
      if(c4&&c5&&toAmt(c6)>0&&currentProj){
        const payments=[]
        const condRow=rows[i]; const dateRow=rows[i+1]||[]; const amtRow=rows[i+2]||[]
        for(let j=7;j<27;j++){
          const cond=String(condRow[j]||"").trim(); const date=toDate(dateRow[j]); const amt=toAmt(amtRow[j])
          if(cond||amt) payments.push({condition:cond,date,amount:amt})
        }
        records.push({project:currentProj,vendor:c5,type:c4,totalAmt:toAmt(c6),payments})
        i+=2
      }
    }
    return {data:records, count:records.length}
  }

  const runUpload = async () => {
    setRunning(true)
    const res = {}
    try{
      // 1. 프로젝트
      if(files.proj){
        setProgress(p=>({...p,proj:"처리중..."}))
        const r = await parseProjects(files.proj)
        setProjects(r.data); setProgress(p=>({...p,proj:"✅ 완료"})); res.proj=r
      }
      // 2. 협력업체
      if(files.vendor){
        setProgress(p=>({...p,vendor:"처리중..."}))
        const r = await parseVendors(files.vendor)
        setVendorsDB(r.data); setProgress(p=>({...p,vendor:"✅ 완료"})); res.vendor=r
      }
      // 3. 외주비
      if(files.payment){
        setProgress(p=>({...p,payment:"처리중..."}))
        const r = await parsePayments(files.payment)
        // 협력업체 DB에 paymentHistory 연결
        setVendorsDB(prev=>{
          const next={...prev}
          const normN=n=>n.replace(/[\s\(\)\[\]㈜주식회사]/g,"").toLowerCase()
          r.data.forEach(pay=>{
            const pkey=normN(pay.vendor)
            const match=Object.values(next).find(v=>normN(v.name||"")===pkey||normN(v.name||"").slice(0,4)===pkey.slice(0,4))
            if(match){
              const exists=(next[match.id].paymentHistory||[]).some(h=>h.project===pay.project&&h.vendor===pay.vendor&&h.totalAmt===pay.totalAmt)
              if(!exists) next[match.id]={...next[match.id],paymentHistory:[...(next[match.id].paymentHistory||[]),pay]}
            }
          })
          return next
        })
        if(setVendorPayments) setVendorPayments(r.data)
        setProgress(p=>({...p,payment:"✅ 완료"})); res.payment=r
      }
      setResults(res); setStep("done")
    }catch(e){
      alert("업로드 오류: "+e.message)
    }
    setRunning(false)
  }

  const list = Array.isArray(projects)?projects:[]
  const goto=(id)=>{ setSelProjId?.(id); setSelVerIdx?.(0); setTab("projects") }

  return (
    <div>
      {/* 통합 업로드 마법사 카드 */}
      <div style={{background:"linear-gradient(135deg,#312E81,#6366F1)",borderRadius:16,padding:"20px 24px",marginBottom:16,color:"#fff"}}>
        <div style={{fontSize:18,fontWeight:900,marginBottom:4}}>📦 통합 데이터 업로드</div>
        <div style={{fontSize:13,opacity:.85,marginBottom:16}}>
          프로젝트 목록 · 협력업체 참여프로젝트 · 외주비 — 3개 파일을 동시에 업로드합니다
        </div>

        {step===null&&(
          <button onClick={()=>setStep("wizard")}
            style={{padding:"10px 22px",background:"#fff",color:"#6366F1",border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:"pointer"}}>
            🚀 업로드 마법사 시작
          </button>
        )}

        {step==="wizard"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
              {FILE_DEFS.map(({key,icon,label,desc,accept})=>(
                <div key={key} style={{background:"rgba(255,255,255,.12)",borderRadius:12,padding:"14px 16px",border:`2px solid ${files[key]?"#34D399":"rgba(255,255,255,.25)"}`}}>
                  <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
                  <div style={{fontSize:13.5,fontWeight:700,marginBottom:2}}>{label}</div>
                  <div style={{fontSize:11,opacity:.75,marginBottom:10}}>{desc}</div>
                  <label style={{display:"block",padding:"7px 12px",background:files[key]?"#D1FAE5":"rgba(255,255,255,.2)",
                    color:files[key]?"#065F46":"#fff",borderRadius:8,fontSize:12.5,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
                    {files[key]?`✓ ${files[key].name.slice(0,18)}...`:"파일 선택"}
                    <input type="file" accept={accept} style={{display:"none"}} onChange={e=>handleFile(key,e.target.files?.[0])}/>
                  </label>
                  {progress[key]&&<div style={{marginTop:6,fontSize:11.5,fontWeight:700,color:progress[key].includes("✅")?"#34D399":"#FDE68A"}}>{progress[key]}</div>}
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{fontSize:12.5,opacity:.8}}>
                {Object.values(files).filter(Boolean).length}개 파일 선택됨 · 선택한 파일만 업로드됩니다 · 기존 데이터는 중복 체크 후 병합됩니다
              </div>
              <button onClick={()=>{setStep(null);setFiles({proj:null,vendor:null,payment:null});setProgress({proj:null,vendor:null,payment:null})}}
                style={{padding:"7px 14px",background:"rgba(255,255,255,.2)",color:"#fff",border:"none",borderRadius:8,fontSize:12.5,cursor:"pointer"}}>취소</button>
              <button onClick={runUpload} disabled={running||!Object.values(files).some(Boolean)}
                style={{padding:"9px 22px",background:Object.values(files).some(Boolean)?"#34D399":"rgba(255,255,255,.3)",
                  color:"#fff",border:"none",borderRadius:9,fontSize:14,fontWeight:800,cursor:"pointer",opacity:running?0.7:1}}>
                {running?"⏳ 처리중...":"⬆ 업로드 실행"}
              </button>
            </div>
          </div>
        )}

        {step==="done"&&results&&(
          <div style={{background:"rgba(255,255,255,.15)",borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:15,fontWeight:800,marginBottom:10}}>✅ 업로드 완료!</div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {results.proj&&<div style={{background:"rgba(255,255,255,.15)",borderRadius:9,padding:"10px 14px",fontSize:13}}>
                🏗 프로젝트<br/><b style={{fontSize:17}}>{results.proj.data.length}</b>건 반영<br/>
                <span style={{fontSize:11,opacity:.8}}>신규 {results.proj.added} · 업데이트 {results.proj.updated}</span>
              </div>}
              {results.vendor&&<div style={{background:"rgba(255,255,255,.15)",borderRadius:9,padding:"10px 14px",fontSize:13}}>
                🤝 협력업체<br/><b style={{fontSize:17}}>{Object.keys(results.vendor.data).length}</b>개 반영<br/>
                <span style={{fontSize:11,opacity:.8}}>신규 {results.vendor.added} · 업데이트 {results.vendor.updated}</span>
              </div>}
              {results.payment&&<div style={{background:"rgba(255,255,255,.15)",borderRadius:9,padding:"10px 14px",fontSize:13}}>
                💰 외주비<br/><b style={{fontSize:17}}>{results.payment.count}</b>건 반영<br/>
                <span style={{fontSize:11,opacity:.8}}>협력업체에 자동 연결</span>
              </div>}
            </div>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>{setStep(null);setFiles({proj:null,vendor:null,payment:null});setProgress({proj:null,vendor:null,payment:null});setResults(null)}}
                style={{padding:"7px 16px",background:"rgba(255,255,255,.2)",color:"#fff",border:"none",borderRadius:8,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
                🔄 재업로드
              </button>
              <button onClick={()=>setTab("projects")}
                style={{padding:"7px 16px",background:"#fff",color:"#6366F1",border:"none",borderRadius:8,fontSize:12.5,fontWeight:800,cursor:"pointer"}}>
                프로젝트 확인 →
              </button>
              <button onClick={()=>setTab("vendors")}
                style={{padding:"7px 16px",background:"rgba(255,255,255,.2)",color:"#fff",border:"none",borderRadius:8,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
                협력업체 확인 →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 현황 요약 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
        {[
          ["🏗 프로젝트",list.length+"건",C.navyL,C.navyM,()=>setTab("projects")],
          ["🤝 협력업체",Object.keys(vendorsDB||{}).length+"개",C.greenL,C.green,()=>setTab("vendors")],
          ["💰 외주비",Object.values(vendorsDB||{}).reduce((s,v)=>s+(v.paymentHistory||[]).length,0)+"건","#FEF3C7",C.amber,null],
        ].map(([l,v,bg,fg,action])=>(
          <div key={l} onClick={action||undefined}
            style={{...S.card({background:bg,cursor:action?"pointer":"default",marginBottom:0}),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:14,fontWeight:700,color:fg}}>{l}</div>
            <div style={{fontSize:26,fontWeight:900,color:fg}}>{v}</div>
          </div>
        ))}
      </div>

      {/* 최근 프로젝트 목록 */}
      <div style={S.card()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={cardTitle}>최근 프로젝트 목록 (상위 10건)</div>
          <button onClick={()=>setTab("projects")} style={S.btn(C.navyL,C.navyM)}>전체 보기 →</button>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>
              {["프로젝트명","코드","본부",""].map((h,i)=><th key={i} style={S.th(i===3?"center":"left")}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.slice(0,10).map((p,i)=>(
                <tr key={p.id} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={{...S.td("left"),fontWeight:600,maxWidth:280,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</td>
                  <td style={S.td("left")}><span style={{fontSize:11.5,color:C.gray}}>{p.code}</span></td>
                  <td style={S.td("left")}>{(p.depts||[]).join(", ")}</td>
                  <td style={S.td("center")}><button onClick={()=>goto(p.id)} style={{...S.btn(C.navyL,C.navyM),padding:"5px 12px",fontSize:12}}>편집</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 6) 버전 기록 — 저장 시 자동 보관된 스냅샷 조회/복원
// ════════════════════════════════════════════════════════════
const HIST_FILTERS = [["__all__","전체보기"],["staff","본부인원"],["pnl","월별손익"],["cashflow","월수금"],["years","3개년실적"],["all","통합스냅샷"]]

function VersionHistorySection({versions,restoreVersion,deleteVersion,saveVersion,currentUser,canManage,STAFF_DEPTS,DEPTS,DEPT_COLORS,deptStaff,staffTarget,staffMonthly,pnlData,cashflow,years}) {
  const [filter,setFilter]       = useState("__all__")
  const [expandedId,setExpandedId] = useState(null)
  const [note,setNote]           = useState("")
  const [pendingRestore,setPendingRestore] = useState(null)
  const [pendingDelete,setPendingDelete]   = useState(null)

  const list = (versions||[]).filter(v=>filter==="__all__"||v.type===filter)

  const snapshotAll = ()=>{
    saveVersion?.("all", note.trim()||"전체 데이터 스냅샷", {deptStaff,staffTarget,staffMonthly,pnlData,cashflow,years}, currentUser.name)
    setNote("")
  }
  const fmtDate = iso => { try{ return new Date(iso).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}) }catch{ return iso } }

  return (
    <div>
      {canManage && (
        <div style={S.card()}>
          <div style={cardTitle}>📌 전체 데이터 스냅샷 저장</div>
          <div style={cardNote}>현재 본부인원·월별손익·월수금·3개년 실적 전체를 하나의 버전으로 통합 저장합니다. 월말 마감 등 중요한 시점에 사용하세요.</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="버전 메모(선택) — 예: 2026년 6월 마감" style={{...S.inp(300),textAlign:"left"}}/>
            <button onClick={snapshotAll} style={S.btn(C.red)}><i className="ti ti-camera" aria-hidden="true"/> 지금 상태 스냅샷 저장</button>
          </div>
        </div>
      )}

      <div style={S.card()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:10}}>
          <div>
            <div style={cardTitle}>📜 버전 기록</div>
            <div style={cardNote}>본부 인원·손익·수금·3개년 데이터를 저장할 때마다 자동으로 기록됩니다 (이 브라우저 기준 최신 80개 보관).</div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {HIST_FILTERS.map(([k,l])=>(
              <button key={k} onClick={()=>setFilter(k)} style={{padding:"7px 13px",border:"none",borderRadius:8,fontSize:12.5,fontWeight:600,cursor:"pointer",background:filter===k?C.navy:C.grayL,color:filter===k?"#fff":"#666"}}>{l}</button>
            ))}
          </div>
        </div>

        {list.length===0
          ? <div style={{padding:"14px 16px",borderRadius:10,background:C.grayL,color:C.gray,fontSize:13}}>저장된 버전 기록이 없습니다. 각 섹션에서 데이터를 입력·저장하면 여기에 자동으로 쌓입니다.</div>
          : list.map(v=>{
              const expanded = expandedId===v.id
              return (
                <div key={v.id} style={{border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",flexWrap:"wrap"}}>
                    <span style={{...S.bdg("#fff",TYPE_COLOR[v.type]||C.gray),border:`1px solid ${TYPE_COLOR[v.type]||C.gray}`,fontWeight:700}}>{TYPE_LABEL[v.type]||v.type}</span>
                    <span style={{fontSize:13.5,fontWeight:700,flex:1,minWidth:140}}>{v.label}</span>
                    <span style={{fontSize:12,color:C.gray,whiteSpace:"nowrap"}}>{v.savedBy||"-"} · {fmtDate(v.savedAt)}</span>
                    <button onClick={()=>setExpandedId(expanded?null:v.id)} style={{...S.btn(C.grayL,"#555"),padding:"6px 12px",fontSize:12}}>{expanded?"닫기":"보기"}</button>
                    {canManage && <button onClick={()=>setPendingRestore(v)} style={{...S.btn(C.navyL,C.navyM),padding:"6px 12px",fontSize:12}}>복원</button>}
                    {canManage && <button onClick={()=>setPendingDelete(v)} style={{...S.btn(C.redL,C.red),padding:"6px 12px",fontSize:12}}>삭제</button>}
                  </div>
                  {expanded && <div style={{padding:"0 14px 14px",borderTop:"0.5px solid var(--color-border-tertiary,#eee)"}}><SnapshotPreview snap={v} STAFF_DEPTS={STAFF_DEPTS} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS}/></div>}
                </div>
              )
            })}
      </div>

      {/* 복원 확인 */}
      {pendingRestore && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
          <div style={S.card({width:420,maxWidth:"95vw",marginBottom:0})}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:10}}>이 버전으로 복원하시겠습니까?</div>
            <div style={{fontSize:13,color:"#555",marginBottom:14,lineHeight:1.7}}>
              <span style={{...S.bdg("#fff",TYPE_COLOR[pendingRestore.type]||C.gray),border:`1px solid ${TYPE_COLOR[pendingRestore.type]||C.gray}`,fontWeight:700,marginRight:6}}>{TYPE_LABEL[pendingRestore.type]||pendingRestore.type}</span>
              {pendingRestore.label}<br/>{fmtDate(pendingRestore.savedAt)} · {pendingRestore.savedBy}<br/><br/>
              현재 데이터는 이 버전의 값으로 교체됩니다. 복원 전 현재 상태도 자동으로 새 버전으로 기록되니 필요하면 다시 되돌릴 수 있습니다.
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{restoreVersion?.(pendingRestore,currentUser.name);setPendingRestore(null)}} style={S.btn(C.navyM)}>복원</button>
              <button onClick={()=>setPendingRestore(null)} style={S.btn(C.grayL,C.gray)}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      {pendingDelete && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
          <div style={S.card({width:380,maxWidth:"95vw",marginBottom:0})}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:10}}>이 버전 기록을 삭제하시겠습니까?</div>
            <div style={{fontSize:13,color:"#555",marginBottom:14,lineHeight:1.7}}>{pendingDelete.label} · {fmtDate(pendingDelete.savedAt)}<br/>삭제 후에는 복구할 수 없습니다.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{deleteVersion?.(pendingDelete.id);setPendingDelete(null)}} style={S.btn(C.red)}>삭제</button>
              <button onClick={()=>setPendingDelete(null)} style={S.btn(C.grayL,C.gray)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 스냅샷 미리보기 — 유형별 요약 테이블
function SnapshotPreview({snap,STAFF_DEPTS,DEPTS,DEPT_COLORS}) {
  const {type,data} = snap
  if(type==="staff")    return <><StaffPreviewTable data={data} STAFF_DEPTS={STAFF_DEPTS} DEPT_COLORS={DEPT_COLORS}/><StaffPlanPreviewTable data={data} STAFF_DEPTS={STAFF_DEPTS} DEPT_COLORS={DEPT_COLORS}/></>
  if(type==="pnl")      return <PnlPreviewTable data={data} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS}/>
  if(type==="cashflow") return <CashflowPreviewTable data={data} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS}/>
  if(type==="years")    return <YearsPreviewTable data={data}/>
  if(type==="all") return <>
    <div style={{fontWeight:700,fontSize:13,margin:"12px 0 4px"}}>👥 본부 인원</div><StaffPreviewTable data={data.deptStaff} STAFF_DEPTS={STAFF_DEPTS} DEPT_COLORS={DEPT_COLORS}/>
    <div style={{fontWeight:700,fontSize:13,margin:"12px 0 4px"}}>📅 연간 인원계획</div><StaffPlanPreviewTable data={data} STAFF_DEPTS={STAFF_DEPTS} DEPT_COLORS={DEPT_COLORS}/>
    <div style={{fontWeight:700,fontSize:13,margin:"12px 0 4px"}}>💰 월별 손익 (부서별 12개월 합계)</div><PnlPreviewTable data={data.pnlData} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS}/>
    <div style={{fontWeight:700,fontSize:13,margin:"12px 0 4px"}}>💧 월수금 (부서별 12개월 합계)</div><CashflowPreviewTable data={data.cashflow} DEPTS={DEPTS} DEPT_COLORS={DEPT_COLORS}/>
    <div style={{fontWeight:700,fontSize:13,margin:"12px 0 4px"}}>📈 3개년 실적</div><YearsPreviewTable data={data.years}/>
  </>
  return null
}
function StaffPreviewTable({data,STAFF_DEPTS,DEPT_COLORS}) {
  const ds = data?.deptStaff || data
  const rows = summarizeStaff(ds,STAFF_DEPTS)
  return <table style={{width:"100%",borderCollapse:"collapse",marginTop:6}}>
    <thead><tr><th style={S.th()}>본부</th><th style={S.th("right")}>합계</th><th style={S.th("right")}>PM</th><th style={S.th("right")}>설계인력</th><th style={S.th("right")}>행정</th></tr></thead>
    <tbody>{rows.map(r=>(
      <tr key={r.dept}>
        <td style={{...S.td("left"),fontWeight:600}}><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:DEPT_COLORS?.[r.dept]||C.gray,marginRight:7,verticalAlign:"middle"}}/>{r.dept}</td>
        <td style={{...S.td(),fontWeight:700}}>{num(r.total).toFixed(1)}</td>
        <td style={S.td()}>{num(r.pm).toFixed(1)}</td><td style={S.td()}>{num(r.designer).toFixed(1)}</td><td style={S.td()}>{num(r.admin).toFixed(1)}</td>
      </tr>
    ))}</tbody>
  </table>
}
function StaffPlanPreviewTable({data,STAFF_DEPTS,DEPT_COLORS}) {
  const target = data?.staffTarget, monthly = data?.staffMonthly
  if(!target && !monthly) return null
  const yrs = Object.keys((monthly||target)?.[STAFF_DEPTS?.[0]]||{})
  const yr = yrs[yrs.length-1]
  return <table style={{width:"100%",borderCollapse:"collapse",marginTop:6}}>
    <thead><tr><th style={S.th()}>본부{yr?` (${yr}년)`:""}</th><th style={S.th("right")}>목표인원</th><th style={S.th("right")}>현인원</th><th style={S.th("right")}>연간평균</th></tr></thead>
    <tbody>{(STAFF_DEPTS||[]).map(d=>{
      const m = monthly?.[d]?.[yr]||Array(12).fill(0)
      const li = lastFilled(m), cur = li>=0?num(m[li]):0, a = annualAvg(m), t = num(target?.[d]?.[yr])
      return (
        <tr key={d}>
          <td style={{...S.td("left"),fontWeight:600}}><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:DEPT_COLORS?.[d]||C.gray,marginRight:7,verticalAlign:"middle"}}/>{d}</td>
          <td style={S.td()}>{t.toFixed(0)}명</td>
          <td style={S.td()}>{li>=0?cur.toFixed(1)+"명":"-"}{li>=0&&<span style={{fontSize:10,color:C.gray,marginLeft:4}}>({MONTHS[li]})</span>}</td>
          <td style={{...S.td(),fontWeight:700,color:a>0?C.green:"var(--color-text-secondary,#aaa)"}}>{a>0?a.toFixed(1)+"명":"-"}</td>
        </tr>
      )
    })}</tbody>
  </table>
}
function PnlPreviewTable({data,DEPTS,DEPT_COLORS}) {
  const rows = summarizePnl(data,DEPTS)
  return <table style={{width:"100%",borderCollapse:"collapse",marginTop:6}}>
    <thead><tr><th style={S.th()}>본부</th><th style={S.th("right")}>매출(억)</th><th style={S.th("right")}>인건비(억)</th><th style={S.th("right")}>외주비(억)</th><th style={S.th("right")}>손익(억)</th></tr></thead>
    <tbody>{rows.map(r=>(
      <tr key={r.dept}>
        <td style={{...S.td("left"),fontWeight:600}}><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:DEPT_COLORS?.[r.dept]||C.gray,marginRight:7,verticalAlign:"middle"}}/>{r.dept}</td>
        <td style={{...S.td(),color:C.green}}>{r.rev.toFixed(2)}</td>
        <td style={S.td()}>{r.sal.toFixed(2)}</td>
        <td style={{...S.td(),color:C.amber}}>{r.sub.toFixed(2)}</td>
        <td style={{...S.td(),fontWeight:700,color:r.pnl>=0?C.green:C.red}}>{r.pnl.toFixed(2)}</td>
      </tr>
    ))}</tbody>
  </table>
}
function CashflowPreviewTable({data,DEPTS,DEPT_COLORS}) {
  const rows = summarizeCashflow(data,DEPTS)
  const total = rows.reduce((s,r)=>s+r.total,0)
  return <table style={{width:"100%",borderCollapse:"collapse",marginTop:6}}>
    <thead><tr><th style={S.th()}>본부</th><th style={S.th("right")}>연간 합계(억)</th></tr></thead>
    <tbody>
      {rows.map(r=>(
        <tr key={r.dept}>
          <td style={{...S.td("left"),fontWeight:600}}><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:DEPT_COLORS?.[r.dept]||C.gray,marginRight:7,verticalAlign:"middle"}}/>{r.dept}</td>
          <td style={{...S.td(),fontWeight:700,color:DEPT_COLORS?.[r.dept]||C.navyM}}>{r.total.toFixed(2)}</td>
        </tr>
      ))}
      <tr style={{background:"var(--color-background-secondary,#f0f0ee)",fontWeight:700}}>
        <td style={S.td("left")}>합계</td><td style={{...S.td(),fontSize:15,color:C.navy}}>{total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
}
function YearsPreviewTable({data}) {
  const rows = Array.isArray(data) ? data : []
  const FIELDS = [["목표수주","수주목표"],["실행수주","수주실행"],["목표매출","매출목표"],["실행매출","매출실행"],["인원","연평균인원"]]
  return <table style={{width:"100%",borderCollapse:"collapse",marginTop:6}}>
    <thead><tr><th style={S.th()}>연도</th>{FIELDS.map(([k,l])=><th key={k} style={S.th("right")}>{l}(억)</th>)}</tr></thead>
    <tbody>{rows.map((y,i)=>(
      <tr key={i}><td style={{...S.td("left"),fontWeight:700}}>{y.yr}</td>{FIELDS.map(([k])=><td key={k} style={S.td()}>{num(y[k]).toFixed(2)}</td>)}</tr>
    ))}</tbody>
  </table>
}

// ════════════════════════════════════════════════════════════
// 1b) 연간 인원계획 — 본부별 목표인원 / 월별 현인원 / 연간평균
// ════════════════════════════════════════════════════════════
const lastFilled = monthly => { let idx=-1; (monthly||[]).forEach((v,i)=>{if(num(v)>0)idx=i}); return idx }
const annualAvg  = monthly => { const f=(monthly||[]).filter(v=>num(v)>0); return f.length? f.reduce((s,v)=>s+num(v),0)/f.length : 0 }

function StaffPlanSection({deptStaff,staffTarget,setStaffTarget,staffMonthly,setStaffMonthly,years,STAFF_DEPTS,DEPT_COLORS,canEditDept,currentUser,saveVersion}) {
  const YEARS = (years||[]).map(y=>y.yr)
  const myDeptInList = STAFF_DEPTS.includes(currentUser.dept) ? currentUser.dept : STAFF_DEPTS[0]
  const [selDept,setSelDept] = useState(myDeptInList)
  const [selYear,setSelYear] = useState(YEARS[YEARS.length-1]||"2026")
  const [editing,setEditing] = useState(false)
  const [draft,setDraft]     = useState(null) // {target, monthly:[12]}
  const [note,setNote]       = useState("")
  const canEdit = canEditDept(selDept)

  const getTarget  = (d,y)=>num(staffTarget?.[d]?.[y])
  const getMonthly = (d,y)=>staffMonthly?.[d]?.[y]||Array(12).fill(0)

  const start = ()=>{ setDraft({target:getTarget(selDept,selYear), monthly:[...getMonthly(selDept,selYear)]}); setNote(""); setEditing(true) }
  const save  = ()=>{
    const newTarget  = {...staffTarget,  [selDept]:{...(staffTarget?.[selDept]||{}),  [selYear]:draft.target}}
    const newMonthly = {...staffMonthly, [selDept]:{...(staffMonthly?.[selDept]||{}), [selYear]:draft.monthly}}
    setStaffTarget(newTarget); setStaffMonthly(newMonthly)
    saveVersion?.("staff", note.trim()||`${selDept} ${selYear}년 인원계획 입력`, {deptStaff, staffTarget:newTarget, staffMonthly:newMonthly}, currentUser.name)
    setEditing(false); setDraft(null); setNote("")
  }
  const cancel = ()=>{ setEditing(false); setDraft(null); setNote("") }
  const updMonth  = (i,v)=>setDraft(p=>({...p, monthly:p.monthly.map((x,ri)=>ri===i?num(v):x)}))
  const updTarget = v=>setDraft(p=>({...p,target:num(v)}))

  const work = editing ? draft : {target:getTarget(selDept,selYear), monthly:getMonthly(selDept,selYear)}
  const lastIdx  = lastFilled(work.monthly)
  const current  = lastIdx>=0 ? num(work.monthly[lastIdx]) : 0
  const avg      = annualAvg(work.monthly)
  const rate     = work.target>0 ? current/work.target*100 : 0
  const rateBdg  = r => r>=100 ? S.bdg(C.greenL,"#27500A") : r>=85 ? S.bdg(C.amberL,"#633806") : S.bdg(C.redL,C.red)

  return (
    <div style={S.card()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:6}}>
        <div>
          <div style={cardTitle}>📅 연간 인원계획 — 연도별 목표인원 대비 월별 현인원</div>
          <div style={cardNote}>연도별로 본부 목표인원을 설정하고 매월 현인원을 입력하면, 해당 연도의 연간 평균인원·목표 달성률이 자동 계산됩니다.</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <select value={selYear} onChange={e=>{setSelYear(e.target.value);setEditing(false);setDraft(null)}}
            style={{padding:"9px 13px",border:"1px solid var(--color-border-secondary,#ccc)",borderRadius:10,fontSize:14,fontWeight:700,background:"#fff",color:C.navy}}>
            {YEARS.map(y=><option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={selDept} onChange={e=>{setSelDept(e.target.value);setEditing(false);setDraft(null)}}
            style={{padding:"9px 13px",border:"1px solid var(--color-border-secondary,#ccc)",borderRadius:10,fontSize:14,fontWeight:600,background:"#fff"}}>
            {STAFF_DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
          {canEdit && (!editing
            ? <button onClick={start} style={S.btn(C.navyL,C.navyM)}><i className="ti ti-edit" aria-hidden="true"/> {selDept} {selYear} 계획 입력</button>
            : <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <input value={note} onChange={e=>setNote(e.target.value)} placeholder="버전 메모(선택)" style={{...S.inp(180),textAlign:"left"}}/>
                <button onClick={save} style={S.btn(C.green)}>저장</button>
                <button onClick={cancel} style={S.btn(C.grayL,C.gray)}>취소</button>
              </div>)}
        </div>
      </div>
      {!canEdit && <div style={{...S.bdg(C.amberL,"#633806"),marginBottom:12}}>조회 전용 — {selDept}은(는) 현재 계정으로 입력할 수 없습니다.</div>}

      {/* 선택 본부 KPI */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
        <div style={S.card({marginBottom:0,padding:"13px 15px"})}>
          <div style={{fontSize:12,color:C.gray,marginBottom:6}}>목표인원 ({selYear})</div>
          {editing
            ? <input type="number" step="1" value={work.target} onChange={e=>updTarget(e.target.value)} style={{...S.inp(80),fontSize:20,fontWeight:800}}/>
            : <div style={{fontSize:24,fontWeight:800,color:C.navy}}>{work.target.toFixed(0)}명</div>}
        </div>
        <div style={S.card({marginBottom:0,padding:"13px 15px"})}>
          <div style={{fontSize:12,color:C.gray,marginBottom:6}}>현인원 {lastIdx>=0?`(${MONTHS[lastIdx]} 기준)`:"(미입력)"}</div>
          <div style={{fontSize:24,fontWeight:800,color:C.navyM}}>{lastIdx>=0?current.toFixed(1)+"명":"-"}</div>
        </div>
        <div style={S.card({marginBottom:0,padding:"13px 15px"})}>
          <div style={{fontSize:12,color:C.gray,marginBottom:6}}>{selYear} 연간 평균인원 (입력월 기준)</div>
          <div style={{fontSize:24,fontWeight:800,color:C.green}}>{avg>0?avg.toFixed(1)+"명":"-"}</div>
        </div>
        <div style={S.card({marginBottom:0,padding:"13px 15px"})}>
          <div style={{fontSize:12,color:C.gray,marginBottom:6}}>목표 달성률 (현인원 기준)</div>
          <div style={{fontSize:24,fontWeight:800,color:rate>=100?C.green:rate>=85?C.amber:C.red}}>{lastIdx>=0?rate.toFixed(0)+"%":"-"}</div>
        </div>
      </div>

      {/* 월별 현인원 입력표 */}
      <div style={{overflowX:"auto",marginBottom:18}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
          <thead><tr>
            <th style={S.th()}>{selYear}년 구분</th>
            {MONTHS.map(m=><th key={m} style={S.th("right")}>{m}</th>)}
            <th style={S.th("right")}>연간평균</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style={{...S.td("left"),fontWeight:700,color:DEPT_COLORS[selDept]||C.navyM}}>현인원(명)</td>
              {work.monthly.map((v,i)=>(
                <td key={i} style={S.td()}>
                  {editing
                    ? <input type="number" step="0.1" value={v} onChange={e=>updMonth(i,e.target.value)} style={S.inp(58)}/>
                    : <span style={{color:v>0?DEPT_COLORS[selDept]||C.navyM:"var(--color-text-secondary,#aaa)",fontWeight:v>0?700:400}}>{v>0?(+v).toFixed(1):"-"}</span>}
                </td>
              ))}
              <td style={{...S.td(),fontSize:15,fontWeight:800,color:C.green}}>{avg>0?avg.toFixed(1):"-"}</td>
            </tr>
            <tr>
              <td style={{...S.td("left"),color:C.gray}}>목표 대비</td>
              {work.monthly.map((v,i)=>{
                const r = work.target>0&&num(v)>0 ? num(v)/work.target*100 : null
                return <td key={i} style={S.td()}>{r!=null?<span style={{...rateBdg(r),fontSize:10.5}}>{r.toFixed(0)}%</span>:<span style={{color:"var(--color-text-secondary,#ccc)"}}>-</span>}</td>
              })}
              <td/>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 전체 본부 현황 요약 */}
      <div style={cardNote}>{selYear}년 기준 전체 본부 현황</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
          <thead><tr>
            <th style={S.th()}>본부</th><th style={S.th("right")}>목표인원</th>
            <th style={S.th("right")}>현인원</th><th style={S.th("right")}>연간평균</th><th style={S.th("right")}>달성률</th>
          </tr></thead>
          <tbody>
            {STAFF_DEPTS.map((d,i)=>{
              const monthly = getMonthly(d,selYear)
              const li = lastFilled(monthly)
              const cur = li>=0?num(monthly[li]):0
              const a = annualAvg(monthly)
              const t = getTarget(d,selYear)
              const r = t>0&&li>=0 ? cur/t*100 : null
              return (
                <tr key={d} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                  <td style={{...S.td("left"),fontWeight:600}}><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:DEPT_COLORS[d]||C.gray,marginRight:7,verticalAlign:"middle"}}/>{d}</td>
                  <td style={S.td()}>{t.toFixed(0)}명</td>
                  <td style={S.td()}>{li>=0?cur.toFixed(1)+"명":"-"}{li>=0&&<span style={{fontSize:10,color:C.gray,marginLeft:4}}>({MONTHS[li]})</span>}</td>
                  <td style={{...S.td(),fontWeight:700,color:a>0?C.green:"var(--color-text-secondary,#aaa)"}}>{a>0?a.toFixed(1)+"명":"-"}</td>
                  <td style={S.td()}>{r!=null?<span style={rateBdg(r)}>{r.toFixed(0)}%</span>:"-"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 7) 본부 관리 — 본부 추가 · 이름변경 · 삭제 · 색상/재무추적 설정
// ════════════════════════════════════════════════════════════
function DeptManageSection({departments,addDept,renameDept,deleteDept,setDeptColor,setDeptFinance,deptUsage,isAdmin}) {
  const [editingName,setEditingName] = useState(null) // 원래 이름
  const [editVal,setEditVal] = useState("")
  const [editMsg,setEditMsg] = useState("")
  const [pendingDelete,setPendingDelete] = useState(null) // {name,usage}

  const [newName,setNewName] = useState("")
  const [newColor,setNewColor] = useState("#185FA5")
  const [newFinance,setNewFinance] = useState(true)
  const [addMsg,setAddMsg] = useState("")

  const startRename = d=>{ setEditingName(d.name); setEditVal(d.name); setEditMsg("") }
  const cancelRename = ()=>{ setEditingName(null); setEditVal(""); setEditMsg("") }
  const saveRename = d=>{
    const r = renameDept(d.name, editVal)
    if(!r.ok){ setEditMsg(r.msg||"변경할 수 없습니다."); return }
    setEditingName(null); setEditVal(""); setEditMsg("")
  }

  const askDelete = d=> setPendingDelete({name:d.name, usage:deptUsage(d.name)})
  const confirmDelete = ()=>{ if(pendingDelete) deleteDept(pendingDelete.name); setPendingDelete(null) }

  const submitAdd = ()=>{
    const r = addDept(newName, newColor, newFinance)
    if(!r.ok){ setAddMsg(r.msg||"추가할 수 없습니다."); return }
    setNewName(""); setNewColor(DEPT_COLOR_POOL_DEFAULT[(departments.length+1)%DEPT_COLOR_POOL_DEFAULT.length]); setNewFinance(true); setAddMsg("")
  }

  return (
    <div>
      <div style={{background:C.navyL,borderLeft:`6px solid ${C.navyM}`,borderRadius:"0 12px 12px 0",padding:"14px 18px",marginBottom:18,fontSize:13.5,lineHeight:1.8,color:"#0C447C"}}>
        <b>본부(부서)를 추가·이름변경·삭제합니다.</b> 변경 즉시 본부 인원현황·월별손익·월수금·경영분석·경영최적화·프로젝트·아카이브 전체 화면에 반영됩니다.
        <br/>"재무추적"을 켠 본부는 월별손익·월수금을 본부별로 입력할 수 있습니다(설계 계열 본부 권장). 행정·해외 등 인원만 관리하는 본부는 꺼두세요.
        <br/><span style={{...S.bdg(C.amberL,"#633806"),marginTop:6,display:"inline-flex"}}>주의</span> 사용자 계정의 "소속 부서"는 별도 시스템(권한관리)에 고정되어 있어, 본부명을 변경해도 기존 계정의 소속은 자동으로 바뀌지 않습니다. 이름을 바꾼 경우 관리자가 계정 소속을 함께 점검해 주세요.
        {!isAdmin && <div style={{marginTop:6}}><span style={S.bdg(C.amberL,"#633806")}>조회 전용</span> 본부 추가·수정·삭제는 관리자만 가능합니다.</div>}
      </div>

      <div style={S.card()}>
        <div style={cardTitle}>🏢 본부 목록</div>
        <div style={cardNote}>색상은 모든 차트·표에서 해당 본부를 구분하는 색으로 사용됩니다.</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}>
            <thead><tr>
              <th style={S.th("center")}>색상</th>
              <th style={S.th()}>본부명</th>
              <th style={S.th("center")}>재무추적</th>
              <th style={S.th("right")}>인원</th>
              <th style={S.th("right")}>프로젝트</th>
              <th style={S.th()}>연결 계정</th>
              <th style={S.th("center")}>관리</th>
            </tr></thead>
            <tbody>
              {departments.map((d,i)=>{
                const usage = deptUsage(d.name)
                const editing = editingName===d.name
                return (
                  <tr key={d.name} style={{background:i%2===0?"var(--color-background-primary,#fff)":"var(--color-background-secondary,#f8f8f6)"}}>
                    <td style={S.td("center")}>
                      {isAdmin
                        ? <input type="color" value={d.color} onChange={e=>setDeptColor(d.name,e.target.value)} style={{width:34,height:28,border:"none",borderRadius:6,cursor:"pointer",background:"none"}}/>
                        : <span style={{display:"inline-block",width:16,height:16,borderRadius:4,background:d.color}}/>}
                    </td>
                    <td style={S.td("left")}>
                      {editing
                        ? <div style={{display:"flex",gap:6,alignItems:"center"}}>
                            <input value={editVal} onChange={e=>setEditVal(e.target.value)} style={{...S.inp(160),textAlign:"left",fontWeight:700}}/>
                            <button onClick={()=>saveRename(d)} style={{...S.btn(C.green),padding:"6px 12px",fontSize:12}}>저장</button>
                            <button onClick={cancelRename} style={{...S.btn(C.grayL,C.gray),padding:"6px 12px",fontSize:12}}>취소</button>
                          </div>
                        : <span style={{fontWeight:700}}>{d.name}</span>}
                      {editing && editMsg && <div style={{fontSize:11.5,color:C.red,marginTop:4}}>{editMsg}</div>}
                    </td>
                    <td style={S.td("center")}>
                      {isAdmin
                        ? <input type="checkbox" checked={!!d.finance} onChange={e=>setDeptFinance(d.name,e.target.checked)} style={{width:18,height:18,cursor:"pointer"}}/>
                        : (d.finance ? <span style={{...S.bdg(C.greenL,"#27500A"),fontSize:11}}>ON</span> : <span style={{...S.bdg(C.grayL,C.gray),fontSize:11}}>OFF</span>)}
                    </td>
                    <td style={S.td()}>{usage.staff.toFixed(1)}명</td>
                    <td style={S.td()}>{usage.projects}건</td>
                    <td style={{...S.td("left"),fontSize:12,color:C.gray}}>{usage.users.length?usage.users.join(", "):"-"}</td>
                    <td style={S.td("center")}>
                      {isAdmin && !editing && <div style={{display:"flex",gap:6,justifyContent:"center"}}>
                        <button onClick={()=>startRename(d)} style={{...S.btn(C.navyL,C.navyM),padding:"6px 12px",fontSize:12}}>이름변경</button>
                        <button onClick={()=>askDelete(d)} style={{...S.btn(C.redL,C.red),padding:"6px 12px",fontSize:12}}>삭제</button>
                      </div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <div style={S.card()}>
          <div style={cardTitle}>+ 본부 추가</div>
          <div style={cardNote}>새 본부를 추가하면 인원현황·인원계획에 0으로 초기화되어 즉시 입력할 수 있게 됩니다. 재무추적을 켜면 월별손익·월수금 입력란도 함께 생성됩니다.</div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="본부명 (예: 신사업본부)" style={{...S.inp(200),textAlign:"left"}}/>
            <input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)} style={{width:40,height:36,border:"none",borderRadius:8,cursor:"pointer",background:"none"}}/>
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:600,cursor:"pointer"}}>
              <input type="checkbox" checked={newFinance} onChange={e=>setNewFinance(e.target.checked)} style={{width:18,height:18,cursor:"pointer"}}/>재무추적(손익·수금 부서별 입력)
            </label>
            <button onClick={submitAdd} style={S.btn(C.green)}><i className="ti ti-plus" aria-hidden="true"/> 본부 추가</button>
          </div>
          {addMsg && <div style={{fontSize:12.5,color:C.red,marginTop:8}}>{addMsg}</div>}
        </div>
      )}

      {/* 삭제 확인 */}
      {pendingDelete && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
          <div style={S.card({width:420,maxWidth:"95vw",marginBottom:0})}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:10}}>'{pendingDelete.name}' 본부를 삭제하시겠습니까?</div>
            <div style={{fontSize:13,color:"#555",marginBottom:14,lineHeight:1.8}}>
              인원현황·인원계획·월별손익·월수금에서 이 본부의 데이터가 모두 제거되고, 연결된 프로젝트에서도 담당본부 목록에서 빠집니다.
              {(pendingDelete.usage.staff>0||pendingDelete.usage.projects>0||pendingDelete.usage.users.length>0) && (
                <div style={{marginTop:8,...S.bdg(C.amberL,"#633806"),display:"block",padding:"8px 12px",lineHeight:1.8}}>
                  현재 인원 {pendingDelete.usage.staff.toFixed(1)}명, 연결 프로젝트 {pendingDelete.usage.projects}건
                  {pendingDelete.usage.users.length>0 && <>, 소속 계정: {pendingDelete.usage.users.join(", ")}</>}
                  이 있습니다. 그래도 삭제하면 위 데이터의 본부 연결이 모두 해제됩니다.
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={confirmDelete} style={S.btn(C.red)}>삭제</button>
              <button onClick={()=>setPendingDelete(null)} style={S.btn(C.grayL,C.gray)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
const DEPT_COLOR_POOL_DEFAULT = ["#185FA5","#1D9E75","#BA7517","#A32D2D","#534AB7","#0F6E56","#D85A30","#7C5295","#2E86AB","#C0392B"]

// ── 수주 유형 관리 ────────────────────────────────────────────
function ContractTypeSection({contractTypes, setContractTypes, canManage}) {
  const [newType, setNewType] = useState("")
  const [editIdx, setEditIdx] = useState(null)
  const [editVal, setEditVal] = useState("")
  const [msg, setMsg]         = useState("")

  const flash = m => { setMsg(m); setTimeout(()=>setMsg(""),2000) }

  const add = () => {
    const t = newType.trim()
    if(!t) return flash("유형명을 입력하세요.")
    if(contractTypes.includes(t)) return flash("이미 존재하는 유형입니다.")
    setContractTypes([...contractTypes, t])
    setNewType("")
    flash(`"${t}" 추가됨`)
  }

  const startEdit = (i) => { setEditIdx(i); setEditVal(contractTypes[i]) }
  const saveEdit  = () => {
    const t = editVal.trim()
    if(!t) return flash("유형명을 입력하세요.")
    if(contractTypes.some((x,i)=>x===t&&i!==editIdx)) return flash("이미 존재하는 유형입니다.")
    const next = contractTypes.map((x,i)=>i===editIdx?t:x)
    setContractTypes(next)
    setEditIdx(null); setEditVal("")
    flash(`"${t}"(으)로 수정됨`)
  }
  const remove = (i) => {
    const t = contractTypes[i]
    if(!window.confirm(`"${t}" 유형을 삭제하시겠습니까?\n이미 이 유형으로 등록된 프로젝트의 수주유형 값은 변경되지 않습니다.`)) return
    setContractTypes(contractTypes.filter((_,ri)=>ri!==i))
    flash(`"${t}" 삭제됨`)
  }
  const moveUp   = i => { if(i===0) return; const a=[...contractTypes]; [a[i-1],a[i]]=[a[i],a[i-1]]; setContractTypes(a) }
  const moveDown = i => { if(i===contractTypes.length-1) return; const a=[...contractTypes]; [a[i],a[i+1]]=[a[i+1],a[i]]; setContractTypes(a) }

  const C2 = {navy:"#0C447C",navyM:"#185FA5",navyL:"#E6F1FB",green:"#1D9E75",red:"#A32D2D",redL:"#FCEBEB",gray:"#888780",grayL:"#F1EFE8",amber:"#BA7517"}
  const card = {background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:14,padding:"19px 22px",marginBottom:16}
  const inp  = (w=200)=>({width:w,padding:"7px 9px",border:"1px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:13,fontFamily:"inherit",background:"#fff",color:"#222",boxSizing:"border-box"})
  const btn  = (bg=C2.navyM,fg="#fff")=>({padding:"7px 14px",background:bg,color:fg,border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"})

  return (
    <div style={card}>
      <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>🏷 수주유형 관리</div>
      <div style={{fontSize:12,color:C2.gray,marginBottom:16}}>프로젝트 등록 시 선택할 수주 유형 목록을 관리합니다. 순서를 드래그하거나 위/아래 버튼으로 조정할 수 있습니다.</div>

      {msg && <div style={{background:C2.navyL,borderRadius:8,padding:"7px 12px",fontSize:12,color:C2.navyM,fontWeight:600,marginBottom:12}}>{msg}</div>}

      {/* 추가 */}
      {canManage && (
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
          <input value={newType} onChange={e=>setNewType(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}
            placeholder="새 유형명 (예: 리모델링)" style={inp(200)}/>
          <button onClick={add} style={btn(C2.navyM)}>+ 추가</button>
        </div>
      )}

      {/* 목록 */}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {contractTypes.length===0 && <div style={{color:C2.gray,fontSize:13}}>등록된 유형이 없습니다.</div>}
        {contractTypes.map((t,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"var(--color-background-secondary,#f8f8f6)",borderRadius:10,border:"0.5px solid var(--color-border-tertiary,#eee)"}}>
            {/* 순서 이동 */}
            {canManage && (
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                <button onClick={()=>moveUp(i)} style={{...btn(C2.navyL,C2.navyM),padding:"2px 6px",fontSize:10,lineHeight:1}} title="위로">▲</button>
                <button onClick={()=>moveDown(i)} style={{...btn(C2.navyL,C2.navyM),padding:"2px 6px",fontSize:10,lineHeight:1}} title="아래로">▼</button>
              </div>
            )}

            {/* 번호 뱃지 */}
            <span style={{width:22,height:22,borderRadius:6,background:C2.navyM,color:"#fff",fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>

            {/* 이름 또는 편집 입력 */}
            {editIdx===i
              ? <>
                  <input value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") saveEdit(); if(e.key==="Escape"){setEditIdx(null);setEditVal("")} }}
                    style={{...inp(180),flex:1}} autoFocus/>
                  <button onClick={saveEdit} style={{...btn(C2.green),padding:"5px 11px"}}>저장</button>
                  <button onClick={()=>{setEditIdx(null);setEditVal("")}} style={{...btn(C2.grayL,C2.gray),padding:"5px 11px"}}>취소</button>
                </>
              : <>
                  <span style={{flex:1,fontSize:14,fontWeight:600}}>{t}</span>
                  {canManage && <>
                    <button onClick={()=>startEdit(i)} style={{...btn(C2.navyL,C2.navyM),padding:"5px 11px",fontSize:12}}>수정</button>
                    <button onClick={()=>remove(i)} style={{...btn(C2.redL,C2.red),padding:"5px 11px",fontSize:12}}>삭제</button>
                  </>}
                </>
            }
          </div>
        ))}
      </div>

      <div style={{marginTop:14,fontSize:11,color:C2.gray,lineHeight:1.7}}>
        ※ 유형을 삭제해도 이미 해당 유형으로 저장된 프로젝트에는 영향을 주지 않습니다.<br/>
        ※ 유형 이름을 수정하면 이후 신규 등록/수정 시 새 이름으로 선택됩니다.
      </div>
    </div>
  )
}

// ── 데이터 백업·복구 ────────────────────────────────────────────
function BackupSection({allData, restoreAllData, isAdmin}) {
  const [msg, setMsg] = useState("")
  const [importing, setImporting] = useState(false)
  const flash = (m,ok=true) => { setMsg({text:m,ok}); setTimeout(()=>setMsg(""),4000) }

  const SJS_KEYS = [
    "sjs_projects","sjs_pnl","sjs_years","sjs_cashflow",
    "sjs_dept_staff","sjs_staff_target","sjs_staff_monthly",
    "sjs_departments","sjs_dept_biz","sjs_vendors","sjs_vendor_payments",
    "sjs_contract_types","sjs_versions","sjs_pw",
  ]

  // 전체 내보내기
  const exportAll = () => {
    const snap = {__sjs_backup:true, __version:2, __savedAt:new Date().toISOString(), data:{}}
    SJS_KEYS.forEach(k=>{ try{ const v=localStorage.getItem(k); if(v) snap.data[k]=JSON.parse(v) }catch{} })
    const blob = new Blob([JSON.stringify(snap,null,2)],{type:"application/json"})
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href=url
    a.download = `sjs_backup_${new Date().toISOString().slice(0,10)}.json`
    a.click(); URL.revokeObjectURL(url)
    flash("✓ 백업 파일을 다운로드했습니다. 안전한 곳에 보관하세요.")
  }

  // 불러오기
  const importAll = (e) => {
    const file = e.target.files?.[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const snap = JSON.parse(ev.target.result)
        if(!snap.__sjs_backup) { flash("⚠ 올바른 백업 파일이 아닙니다.",false); return }
        if(!window.confirm(`${snap.__savedAt?.slice(0,10)||"알 수 없음"} 날짜의 백업 파일을 복구합니다.\n\n현재 입력된 모든 데이터가 백업 파일로 대체됩니다.\n계속하시겠습니까?`)) return
        SJS_KEYS.forEach(k=>{ if(snap.data[k]!==undefined) try{ localStorage.setItem(k,JSON.stringify(snap.data[k])) }catch{} })
        flash("✓ 복구 완료! 페이지를 새로고침하면 데이터가 반영됩니다.")
        setTimeout(()=>window.location.reload(), 1500)
      } catch(err) { flash("⚠ 파일을 읽는 중 오류가 발생했습니다: "+err.message, false) }
      e.target.value=""
    }
    reader.readAsText(file)
  }

  const C2 = {navy:"#0C447C",navyM:"#185FA5",navyL:"#E6F1FB",green:"#1D9E75",greenL:"#EAF3DE",red:"#A32D2D",redL:"#FCEBEB",amber:"#BA7517",amberL:"#FAEEDA",gray:"#888780",grayL:"#F1EFE8"}
  const card2 = {background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:14,padding:"20px 24px",marginBottom:16}
  const btn2  = (bg,fg="#fff")=>({padding:"10px 20px",background:bg,color:fg,border:"none",borderRadius:10,fontSize:13.5,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:7})

  // localStorage 사용 현황
  const lsSize = SJS_KEYS.reduce((s,k)=>{ try{return s+(localStorage.getItem(k)||"").length}catch{return s} },0)
  const lsKB = (lsSize/1024).toFixed(1)

  return (
    <div>
      {/* 안내 배너 */}
      <div style={{...card2,background:C2.amberL,border:`1px solid ${C2.amber}44`}}>
        <div style={{fontSize:15,fontWeight:700,color:C2.amber,marginBottom:6}}>💾 데이터 백업·복구 안내</div>
        <div style={{fontSize:13,color:"#5a3c00",lineHeight:1.8}}>
          시스템의 모든 데이터는 <b>이 브라우저의 localStorage</b>에 저장됩니다.<br/>
          GitHub에 새 파일을 올려도 <b>같은 도메인이면 데이터가 유지</b>되지만,<br/>
          다른 브라우저·기기로 접속하거나 브라우저 데이터를 지우면 사라집니다.<br/><br/>
          <b>👉 중요 데이터는 정기적으로 아래의 "전체 백업 내보내기"를 사용해 JSON 파일로 보관하세요.</b>
        </div>
      </div>

      {/* 저장 현황 */}
      <div style={{...card2}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>📊 현재 저장 현황</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
          {SJS_KEYS.filter(k=>k!=="sjs_pw").map(k=>{
            let size=0, count=""; 
            try{ const v=localStorage.getItem(k); if(v){ size=v.length; try{const p=JSON.parse(v); count=Array.isArray(p)?`${p.length}건`:(typeof p==="object"?`${Object.keys(p).length}항목`:"")}catch{} } }catch{}
            if(!size) return null
            return (
              <div key={k} style={{background:"var(--color-background-secondary,#f8f8f6)",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:10,color:C2.gray,fontWeight:600,marginBottom:2}}>{k.replace("sjs_","")}</div>
                <div style={{fontSize:13,fontWeight:700}}>{count}</div>
                <div style={{fontSize:10,color:C2.gray}}>{(size/1024).toFixed(1)}KB</div>
              </div>
            )
          })}
        </div>
        <div style={{marginTop:10,fontSize:12,color:C2.gray}}>총 저장 용량: <b>{lsKB}KB</b> / 브라우저 최대 ~5MB</div>
      </div>

      {/* 내보내기 / 가져오기 */}
      <div style={{...card2}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>📤 전체 백업 내보내기</div>
        <div style={{fontSize:13,color:C2.gray,marginBottom:12,lineHeight:1.7}}>
          현재 저장된 모든 데이터(프로젝트, 인원정보, 손익, 수금계획, 협력업체 등)를<br/>
          JSON 파일 하나로 내보냅니다. GitHub 업로드 전 또는 정기적으로 백업하세요.
        </div>
        <button onClick={exportAll} style={btn2(C2.navyM)}>
          📥 전체 데이터 JSON 백업
        </button>
      </div>

      <div style={{...card2}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>📥 백업 파일에서 복구</div>
        <div style={{fontSize:13,color:C2.gray,marginBottom:12,lineHeight:1.7}}>
          이전에 내보낸 백업 JSON 파일을 불러와 데이터를 복구합니다.<br/>
          <b style={{color:C2.red}}>⚠ 복구 시 현재 입력된 모든 데이터가 백업 파일로 덮어씌워집니다.</b>
        </div>
        <label style={btn2(C2.green)}>
          📂 백업 파일 불러오기 (JSON)
          <input type="file" accept=".json" style={{display:"none"}} onChange={importAll}/>
        </label>
      </div>

      {msg && (
        <div style={{...card2,background:msg.ok?C2.greenL:C2.redL,border:`1px solid ${msg.ok?C2.green:C2.red}44`,color:msg.ok?C2.green:C2.red,fontWeight:700,fontSize:14}}>
          {msg.text}
        </div>
      )}
    </div>
  )
}

// ── 범용 목록 관리 (건물유형·수주형태용) ────────────────────────
function SimpleListSection({title, description, list, setList, canManage}) {
  const [newVal, setNewVal] = useState("")
  const [editIdx, setEditIdx] = useState(null)
  const [editVal, setEditVal] = useState("")
  const [msg, setMsg]         = useState("")

  const C2 = {navy:"#0C447C",navyM:"#185FA5",navyL:"#E6F1FB",green:"#1D9E75",red:"#A32D2D",redL:"#FCEBEB",gray:"#888780",grayL:"#F1EFE8",amber:"#BA7517"}
  const card2 = {background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e4e4e0)",borderRadius:14,padding:"20px 24px",marginBottom:16}
  const inp2  = (w="100%")=>({width:w,padding:"7px 9px",border:"1px solid var(--color-border-secondary,#ccc)",borderRadius:8,fontSize:13,fontFamily:"inherit",background:"#fff",color:"#222",boxSizing:"border-box"})
  const btn2  = (bg=C2.navyM,fg="#fff")=>({padding:"7px 14px",background:bg,color:fg,border:"none",borderRadius:9,fontSize:13,fontWeight:600,cursor:"pointer"})

  const flash = m => { setMsg(m); setTimeout(()=>setMsg(""),2000) }

  const add = () => {
    const t=newVal.trim(); if(!t) return flash("값을 입력하세요.")
    if(list.includes(t)) return flash("이미 존재합니다.")
    setList([...list, t]); setNewVal(""); flash(`"${t}" 추가됨`)
  }
  const startEdit = i => { setEditIdx(i); setEditVal(list[i]) }
  const saveEdit  = () => {
    const t=editVal.trim(); if(!t) return flash("값을 입력하세요.")
    if(list.some((x,i)=>x===t&&i!==editIdx)) return flash("이미 존재합니다.")
    setList(list.map((x,i)=>i===editIdx?t:x))
    setEditIdx(null); flash("수정됨")
  }
  const remove = i => {
    if(!window.confirm(`"${list[i]}"을(를) 삭제하시겠습니까?`)) return
    setList(list.filter((_,ri)=>ri!==i)); flash("삭제됨")
  }
  const moveUp   = i => { if(i===0) return; const a=[...list]; [a[i-1],a[i]]=[a[i],a[i-1]]; setList(a) }
  const moveDown = i => { if(i===list.length-1) return; const a=[...list]; [a[i],a[i+1]]=[a[i+1],a[i]]; setList(a) }

  return (
    <div style={card2}>
      <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{title}</div>
      <div style={{fontSize:12,color:C2.gray,marginBottom:14}}>{description}</div>
      {msg && <div style={{background:C2.navyL,borderRadius:8,padding:"7px 12px",fontSize:12,color:C2.navyM,fontWeight:600,marginBottom:10}}>{msg}</div>}
      {canManage && (
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <input value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}
            placeholder="새 항목 추가" style={{...inp2(),maxWidth:240}}/>
          <button onClick={add} style={btn2(C2.navyM)}>+ 추가</button>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {list.length===0 && <div style={{color:C2.gray,fontSize:13}}>등록된 항목이 없습니다.</div>}
        {list.map((t,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"var(--color-background-secondary,#f8f8f6)",borderRadius:10,border:"0.5px solid var(--color-border-tertiary,#eee)"}}>
            {canManage && (
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                <button onClick={()=>moveUp(i)}   style={{...btn2(C2.navyL,C2.navyM),padding:"2px 6px",fontSize:10}}>▲</button>
                <button onClick={()=>moveDown(i)} style={{...btn2(C2.navyL,C2.navyM),padding:"2px 6px",fontSize:10}}>▼</button>
              </div>
            )}
            <span style={{width:22,height:22,borderRadius:6,background:C2.navyM,color:"#fff",fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>
            {editIdx===i
              ? <>
                  <input value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveEdit();if(e.key==="Escape"){setEditIdx(null)}}} style={{...inp2(),flex:1,maxWidth:240}} autoFocus/>
                  <button onClick={saveEdit} style={{...btn2(C2.green),padding:"5px 11px"}}>저장</button>
                  <button onClick={()=>setEditIdx(null)} style={{...btn2(C2.grayL,C2.gray),padding:"5px 11px"}}>취소</button>
                </>
              : <>
                  <span style={{flex:1,fontSize:14,fontWeight:600}}>{t}</span>
                  {canManage && <>
                    <button onClick={()=>startEdit(i)} style={{...btn2(C2.navyL,C2.navyM),padding:"5px 11px",fontSize:12}}>수정</button>
                    <button onClick={()=>remove(i)}    style={{...btn2(C2.redL,C2.red),padding:"5px 11px",fontSize:12}}>삭제</button>
                  </>}
                </>
            }
          </div>
        ))}
      </div>
      <div style={{marginTop:12,fontSize:11,color:C2.gray}}>※ 삭제해도 기존 프로젝트에 저장된 값에는 영향을 주지 않습니다.</div>
    </div>
  )
}
