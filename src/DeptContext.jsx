// ══════════════════════════════════════════════════════════════
// 본부(부서) 목록 컨텍스트 — 추가/수정/삭제 가능한 본부 정의를
// 모든 화면(경영분석/월수금/손익/프로젝트/데이터관리/아카이브)에 전달
// ══════════════════════════════════════════════════════════════
import { createContext, useContext } from "react"

export const DeptContext = createContext({
  departments: [],     // [{name,color,finance}]
  DEPTS: [],           // finance:true 인 본부명 배열 (손익/수금 부서별 입력 대상)
  STAFF_DEPTS: [],     // 전체 본부명 배열 (인원현황 대상)
  DEPT_COLORS: {},     // {본부명: color}
  DEPT_BIZ: {},        // {본부명: {orderTarget,...}}
  isAdmin: false,
  contractTypes: [],
  setContractTypes: ()=>{},
  projTypes: [],
  setProjTypes: ()=>{},
  bidTypes: [],
  setBidTypes: ()=>{},
  addDept: ()=>({ok:false,msg:"unavailable"}),
  renameDept: ()=>({ok:false,msg:"unavailable"}),
  deleteDept: ()=>({ok:false,msg:"unavailable"}),
  setDeptColor: ()=>{},
  setDeptFinance: ()=>{},
  deptUsage: ()=>({staff:0,projects:0,users:[]}),
})

export const useDepts = () => useContext(DeptContext)
