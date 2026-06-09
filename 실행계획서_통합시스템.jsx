
import { useState, useMemo, useRef, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis
} from "recharts";

// ── 색상 팔레트 ──────────────────────────────────────────────
const C = {
  navy: "#0C447C", navyM: "#185FA5", navyL: "#E6F1FB",
  green: "#1D9E75", greenL: "#EAF3DE",
  amber: "#BA7517", amberL: "#FAEEDA",
  red: "#A32D2D", redL: "#FCEBEB",
  gray: "#888780", grayL: "#F1EFE8",
  white: "#FFFFFF",
};

// ── 포맷 헬퍼 ────────────────────────────────────────────────
const fmtWon = (n) => n ? `${Math.round(n).toLocaleString("ko-KR")}원` : "-";
const fmtEok = (n) => n ? `${(n / 1e8).toFixed(2)}억` : "-";
const fmtPct = (n) => n ? `${(n * 100).toFixed(1)}%` : "-";
const fmtPy  = (n) => n ? `${Math.round(n).toLocaleString()}원/평` : "-";
const eok    = (n) => n / 1e8;
const won2eok = (n) => (n / 1e8).toFixed(2);

// ── 국민주택 VAT 계산 ─────────────────────────────────────────
// 국민주택: 연면적 85㎡ 이하 (25.7평 이하) → 과세/면세 혼합
// vat_type: "general"(일반), "national_housing"(국민주택), "tax_exempt"(면세)
const calcVAT = (base, vatType, taxRatio = 1.0) => {
  if (vatType === "tax_exempt") return { base, vat: 0, total: base };
  if (vatType === "national_housing") {
    // taxRatio = 과세비율 (면적 구성에 따라 달라짐)
    const taxable = base * taxRatio;
    const exempt = base * (1 - taxRatio);
    const vat = taxable * 0.1;
    return { base, vat, total: base + vat, taxable, exempt };
  }
  // general
  const vat = base * 0.1;
  return { base, vat, total: base + vat };
};

// ── 초기 데이터 ───────────────────────────────────────────────
const INIT_PROJECTS = [
  {
    id: "P001", code: "E22021-FSM-D", name: "우즈베키스탄 제약클러스터 건립사업 1차",
    dept: "해외사업부", pm: "김한준", client: "우즈베키스탄 제약청",
    vatType: "tax_exempt", taxRatio: 1.0,
    siteArea: 85000, floorArea: 42000, pyFloor: 12700, pyBuilding: 25728,
    baseContract: 3275892545,
    versions: [
      {
        v: "v1.0 최초", date: "2024-01-09", reason: "최초 작성",
        laborCost: 258986626, directExp: 403922538, subContract: 1528781038,
        indirect: null, profit: null,
        // 외주업체
        vendors: [
          { cat: "구조", name: "㈜센구조연구소", contract: 19008000, paid: 19008000, pct: 100 },
          { cat: "기계", name: "㈜우원엠앤이", contract: 10890000, paid: 10890000, pct: 100 },
          { cat: "전기통신", name: "㈜예다종합설계", contract: 17820000, paid: 17820000, pct: 100 },
          { cat: "CG", name: "레드스톤", contract: 6000000, paid: 6000000, pct: 100 },
          { cat: "현지조사", name: "㈜케이메디컬컨설팅", contract: 558481038, paid: 558481038, pct: 100 },
          { cat: "해외(코디)", name: "Hplus건축사사무소", contract: 580800000, paid: 580800000, pct: 100 },
          { cat: "해외(협력)", name: "H-ARHITECT", contract: 132000000, paid: 132000000, pct: 100 },
          { cat: "인테리어", name: "바루다건축사사무소", contract: 24750000, paid: 24750000, pct: 100 },
          { cat: "키스탭", name: "무영CM", contract: 206800000, paid: 41360000, pct: 20 },
        ],
      },
      {
        v: "v6.0 5차변경", date: "2025-11-18", reason: "감리인건비 재산정·Marva신규",
        laborCost: 139253515, directExp: 717039290, subContract: 1994348995,
        indirect: 153178867, profit: 272071878,
        vendors: [
          { cat: "구조", name: "㈜센구조연구소", contract: 19008000, paid: 19008000, pct: 100 },
          { cat: "기계", name: "㈜우원엠앤이", contract: 10890000, paid: 10890000, pct: 100 },
          { cat: "전기통신", name: "㈜예다종합설계", contract: 17820000, paid: 17820000, pct: 100 },
          { cat: "CG", name: "레드스톤", contract: 7260000, paid: 7260000, pct: 100 },
          { cat: "현지조사", name: "㈜케이메디컬컨설팅", contract: 558481038, paid: 558481038, pct: 100 },
          { cat: "해외(코디)", name: "Hplus건축사사무소", contract: 580800000, paid: 580800000, pct: 100 },
          { cat: "해외(협력)", name: "H-ARHITECT", contract: 132000000, paid: 132000000, pct: 100 },
          { cat: "인테리어", name: "바루다건축사사무소", contract: 24750000, paid: 24750000, pct: 100 },
          { cat: "키스탭", name: "무영CM", contract: 206800000, paid: 41360000, pct: 20 },
          { cat: "감리(기술)", name: "General Project Expert", contract: 182927245, paid: 56379412, pct: 30.82 },
          { cat: "감리(저작권)", name: "H-ARHITECT", contract: 42568934, paid: 42568934, pct: 100 },
          { cat: "감리(저작권신규)", name: "Marva", contract: 89180218, paid: 44642746, pct: 50.06 },
          { cat: "PE회계", name: "원진회계법인", contract: 67180960, paid: 15478197, pct: 23.04 },
        ],
      },
    ],
    // 기성 지급 계획
    milestones: [
      { stage: "선급금", pct: 34.21, received: true, date: "2023-12-27" },
      { stage: "기본설계완료", pct: 8.60, received: true, date: "2024-05-13" },
      { stage: "실시설계완료", pct: 8.60, received: true, date: "2025-02-03" },
      { stage: "입찰지원", pct: 8.60, received: false, date: "" },
      { stage: "감리중", pct: 30.00, received: false, date: "" },
      { stage: "준공", pct: 10.00, received: false, date: "" },
    ],
  },
  {
    id: "P002", code: "E26004-VDH-W", name: "평택고덕 패키지형 공모 실시설계 (A68BL·Aab13BL)",
    dept: "설계2본부", pm: "김동헌", client: "계룡건설 컨소시엄",
    vatType: "general", taxRatio: 1.0,
    siteArea: 89837, floorArea: 226541, pyFloor: 68529, pyBuilding: 27181,
    baseContract: 801000000,
    versions: [
      {
        v: "v1.0 최초", date: "2026-01-20", reason: "최초 작성",
        laborCost: 139201245, directExp: 36738100, subContract: 390211654,
        indirect: 153121373, profit: 79727729,
        vendors: [
          { cat: "구조", name: "씨에이치구조㈜", contract: 34736956, paid: 0, pct: 0 },
          { cat: "토목", name: "대신종합이엔지㈜", contract: 33552742, paid: 0, pct: 0 },
          { cat: "조경", name: "에이치에이㈜", contract: 37500123, paid: 0, pct: 0 },
          { cat: "기계", name: "삼신설계㈜", contract: 24868503, paid: 0, pct: 0 },
          { cat: "전기통신소방", name: "나라기술단㈜", contract: 31973789, paid: 0, pct: 0 },
          { cat: "기계소방", name: "대평엔지니어링㈜", contract: 25065872, paid: 0, pct: 0 },
          { cat: "CG", name: "위즈앤㈜", contract: 15454545, paid: 0, pct: 0 },
          { cat: "견적", name: "성진적산㈜", contract: 1000000, paid: 0, pct: 0 },
          { cat: "건축외주", name: "청우종합건축사사무소", contract: 54059125, paid: 0, pct: 0 },
          { cat: "친환경", name: "건원엔지니어링", contract: 43090909, paid: 0, pct: 0 },
          { cat: "교통영향평가", name: "한길알앤디㈜", contract: 31090909, paid: 0, pct: 0 },
          { cat: "토탈디자인", name: "건원엔지니어링", contract: 38363636, paid: 0, pct: 0 },
          { cat: "지반조사", name: "대신종합이엔지㈜", contract: 8909091, paid: 0, pct: 0 },
        ],
      },
    ],
    milestones: [
      { stage: "계약시+심의완료(중흥)", pct: 20, received: true, date: "2026-01-12" },
      { stage: "사업승인완료(계룡)", pct: 30, received: false, date: "" },
      { stage: "실시설계납품", pct: 30, received: false, date: "" },
      { stage: "준공", pct: 20, received: false, date: "" },
    ],
  },
  {
    id: "P003", code: "E26005-VSH-W", name: "평택고덕 패키지형 (Aab18-1BL·Aa20-1BL)",
    dept: "설계2본부", pm: "김동헌", client: "계룡건설 컨소시엄",
    vatType: "general", taxRatio: 1.0,
    siteArea: 47728, floorArea: 124712, pyFloor: 37722, pyBuilding: 14437,
    baseContract: 439000000,
    versions: [
      {
        v: "v1.0 최초", date: "2026-01-20", reason: "최초 작성",
        laborCost: 0, directExp: 9560320, subContract: 220084919,
        indirect: 0, profit: 209354761,
        vendors: [
          { cat: "구조", name: "씨에이치구조㈜", contract: 18793986, paid: 0, pct: 0 },
          { cat: "토목", name: "대신종합이엔지㈜", contract: 13995521, paid: 0, pct: 0 },
          { cat: "조경", name: "에이치에이㈜", contract: 21992962, paid: 0, pct: 0 },
          { cat: "기계", name: "삼신설계㈜", contract: 18793986, paid: 0, pct: 0 },
          { cat: "전기통신소방", name: "나라기술단㈜", contract: 16794626, paid: 0, pct: 0 },
          { cat: "기계소방", name: "대평엔지니어링㈜", contract: 11996161, paid: 0, pct: 0 },
          { cat: "교통영향평가", name: "한길알앤디㈜", contract: 21090909, paid: 0, pct: 0 },
          { cat: "친환경", name: "건원엔지니어링", contract: 22909091, paid: 0, pct: 0 },
          { cat: "풍동시뮬레이션", name: "티이솔류션", contract: 9090909, paid: 0, pct: 0 },
          { cat: "건축외주", name: "구조사건축연구소", contract: 29990403, paid: 0, pct: 0 },
        ],
      },
    ],
    milestones: [
      { stage: "계약시+사업승인완료", pct: 40, received: false, date: "" },
      { stage: "실시설계납품", pct: 40, received: false, date: "" },
      { stage: "준공", pct: 20, received: false, date: "" },
    ],
  },
  {
    id: "P004", code: "E26-ECO3BL", name: "부산에코델타시티 3BL 민참 (비교분석용)",
    dept: "주거디자인본부", pm: "정진성", client: "부산도시공사",
    vatType: "national_housing", taxRatio: 0.65,
    siteArea: 32175, floorArea: 70000, pyFloor: 21183, pyBuilding: 9737,
    baseContract: 2500000000,
    versions: [
      {
        v: "v1.0 실행검토", date: "2026-01-01", reason: "협력업체 견적 비교분석",
        laborCost: 0, directExp: 0, subContract: 1248500000,
        indirect: 0, profit: 0,
        vendors: [
          { cat: "구조", name: "㈜보성이앤지그룹", contract: 68000000, paid: 0, pct: 0 },
          { cat: "기계", name: "㈜디이테크설비컨설턴트", contract: 60000000, paid: 0, pct: 0 },
          { cat: "전기통신", name: "석우엔지니어링㈜", contract: 75000000, paid: 0, pct: 0 },
          { cat: "소방", name: "㈜세종기술단", contract: 70000000, paid: 0, pct: 0 },
          { cat: "부대토목", name: "다산이엔지", contract: 60000000, paid: 0, pct: 0 },
          { cat: "흙막이·지반", name: "세움텍", contract: 120000000, paid: 0, pct: 0 },
          { cat: "조경", name: "조경사무소 루다", contract: 75000000, paid: 0, pct: 0 },
          { cat: "견적", name: "코토적산", contract: 57000000, paid: 0, pct: 0 },
          { cat: "CG(제안)", name: "51H", contract: 25000000, paid: 0, pct: 0 },
          { cat: "건축외주", name: "희우건축", contract: 83000000, paid: 0, pct: 0 },
          { cat: "친환경", name: "㈜디이테크설비컨설턴트", contract: 90000000, paid: 0, pct: 0 },
          { cat: "인테리어", name: "㈜스튜디오 덴", contract: 85000000, paid: 0, pct: 0 },
          { cat: "외부특화", name: "스키닉 경관연구소", contract: 60000000, paid: 0, pct: 0 },
          { cat: "BIM", name: "㈜트윈빔", contract: 100000000, paid: 0, pct: 0 },
          { cat: "교통영향평가", name: "㈜시케인엔지니어링", contract: 60000000, paid: 0, pct: 0 },
        ],
      },
    ],
    milestones: [
      { stage: "제안설계완료", pct: 40, received: false, date: "" },
      { stage: "실시설계완료", pct: 40, received: false, date: "" },
      { stage: "준공", pct: 20, received: false, date: "" },
    ],
  },
];

// ── VAT 타입 레이블 ───────────────────────────────────────────
const VAT_LABELS = {
  general: "일반과세 (VAT 10%)",
  national_housing: "국민주택 (과세/면세 혼합)",
  tax_exempt: "면세",
};

const VAT_BADGE = {
  general: { bg: "#E6F1FB", color: "#0C447C", label: "일반과세" },
  national_housing: { bg: "#FAEEDA", color: "#633806", label: "국민주택" },
  tax_exempt: { bg: "#EAF3DE", color: "#27500A", label: "면세" },
};

// ── 색상 팔레트 (차트) ────────────────────────────────────────
const CHART_COLORS = ["#185FA5","#1D9E75","#BA7517","#A32D2D","#639922","#534AB7","#888780","#E05C2A"];

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function ExecutionSystem() {
  const [tab, setTab] = useState("dashboard");
  const [projects, setProjects] = useState(INIT_PROJECTS);
  const [selProjId, setSelProjId] = useState("P001");
  const [selVersionIdx, setSelVersionIdx] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", text: "안녕하세요! 실행계획서 시스템 도우미입니다. 프로젝트 검색, 수치 문의, 비교분석 등 무엇이든 물어보세요." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddVersion, setShowAddVersion] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSel, setCompareSel] = useState([]);
  const chatRef = useRef(null);

  const selProj = useMemo(() => projects.find(p => p.id === selProjId) || projects[0], [projects, selProjId]);
  const selVer  = useMemo(() => selProj.versions[selVersionIdx] || selProj.versions[0], [selProj, selVersionIdx]);

  // 최신버전 기준 계산
  const calcVersion = (ver, proj) => {
    const base = proj.baseContract;
    const labor = ver.laborCost || 0;
    const exp   = ver.directExp || 0;
    const sub   = ver.subContract || 0;
    const direct = labor + exp + sub;
    const indirect = ver.indirect ?? Math.round(labor * 1.1);
    const profit   = ver.profit   ?? Math.round(direct * 0.083);
    const total    = direct + indirect + profit;
    const subRatio = base > 0 ? sub / base : 0;
    const laborRatio = base > 0 ? labor / base : 0;
    const vatInfo  = calcVAT(base, proj.vatType, proj.taxRatio);
    const pyFloor  = proj.pyFloor > 0 ? base / proj.pyFloor : 0;
    const pyBuilding = proj.pyBuilding > 0 ? base / proj.pyBuilding : 0;
    const received = (proj.milestones || []).filter(m => m.received).reduce((s, m) => s + m.pct / 100, 0);
    return { labor, exp, sub, direct, indirect, profit, total, base, subRatio, laborRatio,
             vatInfo, pyFloor, pyBuilding, received };
  };

  const cv = useMemo(() => calcVersion(selVer, selProj), [selVer, selProj]);

  // 챗봇 응답 (Claude API)
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);

    // 현재 프로젝트 데이터 컨텍스트 구성
    const context = projects.map(p => {
      const ver = p.versions[p.versions.length - 1];
      const c = calcVersion(ver, p);
      return `[${p.code}] ${p.name}: 계약금액 ${fmtEok(p.baseContract)}, 외주비 ${fmtEok(ver.subContract)}(${fmtPct(c.subRatio)}), 연면적 ${p.floorArea.toLocaleString()}㎡, 평당단가 ${fmtPy(c.pyFloor)}, VAT유형 ${VAT_LABELS[p.vatType]}`;
    }).join("\n");

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `당신은 건축설계사무소의 실행계획서 분석 전문 챗봇입니다.
현재 시스템의 프로젝트 데이터:
${context}

규칙:
- 수치는 억원 단위로 답하고, 원 단위도 병기
- VAT 포함/별도를 항상 명시
- 국민주택의 경우 과세/면세 비율 언급
- 평당단가는 연면적 기준으로 답변
- 외주비 비율은 계약금액 대비 기준
- 간결하고 실무적으로 답변 (2-4문장)
- 한국어로 답변`,
          messages: [{ role: "user", content: userMsg }]
        })
      });
      const data = await res.json();
      const reply = data.content?.find(c => c.type === "text")?.text || "답변을 가져올 수 없습니다.";
      setChatMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", text: "잠시 후 다시 시도해 주세요." }]);
    }
    setChatLoading(false);
  };

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);

  // ── 탭별 렌더 ──────────────────────────────────────────────
  const tabs = [
    { id: "dashboard", label: "📊 대시보드" },
    { id: "execution", label: "📋 실행계획서" },
    { id: "vendors",   label: "🏢 외주비 관리" },
    { id: "milestone", label: "💰 기성 현황" },
    { id: "compare",   label: "🔍 비교분석" },
    { id: "vat",       label: "🧾 VAT 계산기" },
  ];

  return (
    <div style={{ fontFamily: "var(--font-sans,'Apple SD Gothic Neo',sans-serif)", fontSize: 13, background: "var(--color-background-tertiary,#f5f5f3)", minHeight: "100vh" }}>

      {/* ── 헤더 ── */}
      <div style={{ background: C.navy, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: C.navyM, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📐</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>실행계획서 통합관리 시스템</div>
            <div style={{ fontSize: 11, color: "#85B7EB" }}>실행계획 · 외주비 · 기성 · 비교분석 · VAT 통합</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowAddProject(true)} style={btnStyle(C.navyM)}>+ 프로젝트 추가</button>
          <button onClick={() => setChatOpen(o => !o)} style={{ ...btnStyle("#1D9E75"), position: "relative" }}>
            💬 AI 도우미
            {chatMessages.length > 1 && <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, background: "#E05C2A", borderRadius: "50%" }} />}
          </button>
        </div>
      </div>

      {/* ── 탭 바 ── */}
      <div style={{ background: "var(--color-background-primary,#fff)", borderBottom: `1px solid var(--color-border-tertiary,#e0e0e0)`, display: "flex", overflowX: "auto", padding: "0 16px" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 16px", border: "none", background: "none", fontSize: 12, fontWeight: 500,
            cursor: "pointer", whiteSpace: "nowrap",
            color: tab === t.id ? C.navyM : "var(--color-text-secondary,#888)",
            borderBottom: tab === t.id ? `2px solid ${C.navyM}` : "2px solid transparent",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── 프로젝트 선택 바 ── */}
      <div style={{ background: "var(--color-background-secondary,#f8f8f6)", padding: "10px 20px", display: "flex", gap: 8, overflowX: "auto", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.gray, whiteSpace: "nowrap" }}>프로젝트 선택:</span>
        {projects.map(p => (
          <button key={p.id} onClick={() => { setSelProjId(p.id); setSelVersionIdx(p.versions.length - 1); }}
            style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${selProjId === p.id ? C.navyM : "var(--color-border-secondary,#ccc)"}`,
              background: selProjId === p.id ? C.navyL : "var(--color-background-primary,#fff)",
              color: selProjId === p.id ? C.navy : "var(--color-text-secondary,#666)",
              fontSize: 11, fontWeight: selProjId === p.id ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>
            {p.code.length > 12 ? p.code.slice(0, 12) + "…" : p.code}
            <span style={{ marginLeft: 4, padding: "1px 5px", borderRadius: 8, fontSize: 10, background: VAT_BADGE[p.vatType].bg, color: VAT_BADGE[p.vatType].color }}>{VAT_BADGE[p.vatType].label}</span>
          </button>
        ))}
      </div>

      {/* ── 바디 ── */}
      <div style={{ padding: "16px 20px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ════════════════════════ 대시보드 ════════════════════════ */}
        {tab === "dashboard" && <DashboardTab projects={projects} selProj={selProj} selVer={selVer} cv={cv} calcVersion={calcVersion} />}

        {/* ════════════════════════ 실행계획서 ════════════════════════ */}
        {tab === "execution" && (
          <ExecutionTab selProj={selProj} selVer={selVer} selVersionIdx={selVersionIdx}
            setSelVersionIdx={setSelVersionIdx} cv={cv} calcVersion={calcVersion}
            onAddVersion={() => setShowAddVersion(true)} setProjects={setProjects} projects={projects} />
        )}

        {/* ════════════════════════ 외주비 관리 ════════════════════════ */}
        {tab === "vendors" && <VendorsTab selProj={selProj} selVer={selVer} cv={cv} />}

        {/* ════════════════════════ 기성 현황 ════════════════════════ */}
        {tab === "milestone" && <MilestoneTab selProj={selProj} cv={cv} setProjects={setProjects} projects={projects} />}

        {/* ════════════════════════ 비교분석 ════════════════════════ */}
        {tab === "compare" && <CompareTab projects={projects} calcVersion={calcVersion} />}

        {/* ════════════════════════ VAT 계산기 ════════════════════════ */}
        {tab === "vat" && <VATCalculator />}
      </div>

      {/* ── 챗봇 패널 ── */}
      {chatOpen && (
        <div style={{ position: "fixed", bottom: 20, right: 20, width: 360, height: 500, background: "var(--color-background-primary,#fff)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,.18)", display: "flex", flexDirection: "column", zIndex: 1000, border: `1px solid var(--color-border-secondary,#ddd)` }}>
          <div style={{ padding: "12px 16px", background: C.navy, borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>💬 AI 도우미</span>
            <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", color: "#85B7EB", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {chatMessages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "80%", padding: "8px 12px", borderRadius: m.role === "user" ? "12px 12px 0 12px" : "12px 12px 12px 0",
                  background: m.role === "user" ? C.navyM : "var(--color-background-secondary,#f5f5f3)",
                  color: m.role === "user" ? "#fff" : "var(--color-text-primary,#333)", fontSize: 12, lineHeight: 1.6 }}>
                  {m.text}
                </div>
              </div>
            ))}
            {chatLoading && <div style={{ color: C.gray, fontSize: 11, textAlign: "center" }}>응답 생성 중…</div>}
          </div>
          <div style={{ padding: "10px 12px", borderTop: `1px solid var(--color-border-tertiary,#eee)`, display: "flex", gap: 8 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendChat()}
              placeholder="예) 우즈벡 프로젝트 외주비 비율은?" style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: `1px solid var(--color-border-secondary,#ddd)`, fontSize: 12, background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary,#333)" }} />
            <button onClick={sendChat} style={btnStyle(C.navyM)}>전송</button>
          </div>
          <div style={{ padding: "6px 12px 10px", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["외주비 비율 요약", "VAT 계산해줘", "평당단가 비교"].map(q => (
              <button key={q} onClick={() => { setChatInput(q); }} style={{ padding: "3px 9px", borderRadius: 10, border: `1px solid ${C.navyM}`, background: C.navyL, color: C.navy, fontSize: 10, cursor: "pointer" }}>{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── 모달들 ── */}
      {showAddProject && <AddProjectModal onClose={() => setShowAddProject(false)} onSave={(p) => { setProjects(prev => [...prev, { ...p, id: `P${Date.now()}` }]); setShowAddProject(false); }} />}
      {showAddVersion && <AddVersionModal selProj={selProj} onClose={() => setShowAddVersion(false)} onSave={(v) => { setProjects(prev => prev.map(p => p.id === selProj.id ? { ...p, versions: [...p.versions, v] } : p)); setSelVersionIdx(selProj.versions.length); setShowAddVersion(false); }} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 대시보드 탭
// ════════════════════════════════════════════════════════════
function DashboardTab({ projects, selProj, selVer, cv, calcVersion }) {
  const allLatest = projects.map(p => {
    const ver = p.versions[p.versions.length - 1];
    const c = calcVersion(ver, p);
    return { ...p, ver, c };
  });

  // 전체 KPI
  const totalContract = allLatest.reduce((s, p) => s + p.baseContract, 0);
  const totalSub = allLatest.reduce((s, p) => s + (p.ver.subContract || 0), 0);
  const avgSubRatio = totalContract > 0 ? totalSub / totalContract : 0;

  // 프로젝트별 외주비 비율 차트 데이터
  const barData = allLatest.map(p => ({
    name: p.code.split("-").slice(0,2).join("-"),
    외주비: +(p.ver.subContract / 1e8).toFixed(2),
    계약금: +(p.baseContract / 1e8).toFixed(2),
    외주비율: +(p.c.subRatio * 100).toFixed(1),
  }));

  // 비용 구성 파이 데이터 (선택 프로젝트)
  const pieData = [
    { name: "직접인건비", value: selVer.laborCost || 0 },
    { name: "직접경비", value: selVer.directExp || 0 },
    { name: "외주용역비", value: selVer.subContract || 0 },
    { name: "간접비", value: cv.indirect || 0 },
    { name: "이윤", value: cv.profit || 0 },
  ].filter(d => d.value > 0);

  return (
    <div>
      {/* KPI 카드 */}
      <div style={grid(4, 12)}>
        <KpiCard label="전체 프로젝트 계약금" val={fmtEok(totalContract)} sub="VAT 별도" color={C.navyM} />
        <KpiCard label="전체 외주비 합계" val={fmtEok(totalSub)} sub={`평균 비율 ${fmtPct(avgSubRatio)}`} color={C.amber} />
        <KpiCard label={`${selProj.code} 평당단가`} val={fmtPy(cv.pyFloor)} sub="연면적 기준" color={C.green} />
        <KpiCard label="기성 수령률" val={fmtPct(cv.received)} sub={selProj.name.slice(0, 15) + "…"} color={C.red} />
      </div>

      {/* 차트 2열 */}
      <div style={grid(2, 14)}>
        <Card title="프로젝트별 외주비 현황 (억원)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v + "억"} />
              <Tooltip formatter={(v, n) => [v + "억", n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="계약금" fill={C.navyL} stroke={C.navyM} />
              <Bar dataKey="외주비" fill={C.navyM} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title={`${selProj.code} 비용 구성 비율`}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmtWon(v)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 버전 변화 추이 */}
      {selProj.versions.length > 1 && (
        <Card title={`${selProj.code} 버전별 외주비 변화`}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={selProj.versions.map((v, i) => ({
              name: v.v.split(" ")[0],
              외주비: +(v.subContract / 1e8).toFixed(2),
              인건비: +((v.laborCost || 0) / 1e8).toFixed(2),
              직접경비: +((v.directExp || 0) / 1e8).toFixed(2),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v + "억"} />
              <Tooltip formatter={(v, n) => [v + "억", n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="외주비" stroke={C.navyM} strokeWidth={2} dot />
              <Line type="monotone" dataKey="인건비" stroke={C.green} strokeWidth={2} dot />
              <Line type="monotone" dataKey="직접경비" stroke={C.amber} strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* 프로젝트 요약 테이블 */}
      <Card title="전체 프로젝트 요약">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.navyM }}>
                {["프로젝트코드","프로젝트명","PM","계약금액","외주비","외주비율","평당단가(연면적)","VAT유형","최신버전"].map(h => (
                  <th key={h} style={{ padding: "7px 10px", color: "#fff", fontWeight: 500, whiteSpace: "nowrap", textAlign: "center" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allLatest.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? "var(--color-background-primary,#fff)" : "var(--color-background-secondary,#f8f8f6)" }}>
                  <td style={td("center")}><code style={{ fontSize: 11 }}>{p.code}</code></td>
                  <td style={td("left")}>{p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name}</td>
                  <td style={td("center")}>{p.pm}</td>
                  <td style={td("right")}>{fmtEok(p.baseContract)}</td>
                  <td style={td("right")}>{fmtEok(p.ver.subContract)}</td>
                  <td style={td("center")}><Badge val={fmtPct(p.c.subRatio)} color={p.c.subRatio > 0.5 ? C.red : p.c.subRatio > 0.35 ? C.amber : C.green} /></td>
                  <td style={td("right")}>{fmtPy(p.c.pyFloor)}</td>
                  <td style={td("center")}><span style={{ padding: "2px 7px", borderRadius: 8, fontSize: 10, background: VAT_BADGE[p.vatType].bg, color: VAT_BADGE[p.vatType].color }}>{VAT_BADGE[p.vatType].label}</span></td>
                  <td style={td("center")}><span style={{ fontSize: 11, color: C.navyM }}>{p.versions[p.versions.length-1].v}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 실행계획서 탭
// ════════════════════════════════════════════════════════════
function ExecutionTab({ selProj, selVer, selVersionIdx, setSelVersionIdx, cv, calcVersion, onAddVersion, setProjects, projects }) {
  const base = selProj.baseContract;

  return (
    <div>
      {/* 버전 선택 + 추가 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.gray }}>버전 선택:</span>
        {selProj.versions.map((v, i) => (
          <button key={i} onClick={() => setSelVersionIdx(i)}
            style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${selVersionIdx === i ? C.navyM : "var(--color-border-secondary,#ccc)"}`,
              background: selVersionIdx === i ? C.navyL : "var(--color-background-primary,#fff)",
              color: selVersionIdx === i ? C.navy : "var(--color-text-secondary,#666)", fontSize: 11, cursor: "pointer" }}>
            {v.v} <span style={{ fontSize: 10, color: C.gray }}>({v.date})</span>
          </button>
        ))}
        <button onClick={onAddVersion} style={btnStyle(C.green)}>+ 새 버전 추가</button>
      </div>

      {/* 프로젝트 기본 정보 */}
      <Card title={`📋 실행계획서 — ${selProj.name}`}>
        <div style={grid(4, 10)}>
          <InfoItem label="프로젝트코드" val={selProj.code} />
          <InfoItem label="주관부서" val={selProj.dept} />
          <InfoItem label="PM" val={selProj.pm} />
          <InfoItem label="발주처" val={selProj.client} />
          <InfoItem label="대지면적" val={`${selProj.siteArea.toLocaleString()}㎡`} />
          <InfoItem label="연면적" val={`${selProj.floorArea.toLocaleString()}㎡ (${selProj.pyFloor.toLocaleString()}평)`} />
          <InfoItem label="VAT 유형" val={VAT_LABELS[selProj.vatType]} highlight />
          {selProj.vatType === "national_housing" && <InfoItem label="과세비율" val={fmtPct(selProj.taxRatio)} highlight />}
          <InfoItem label="작성일" val={selVer.date} />
          <InfoItem label="변경사유" val={selVer.reason} />
        </div>
      </Card>

      {/* 비용 구성 상세 */}
      <div style={grid(2, 14)}>
        <Card title="비용 구성 상세">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary,#f8f8f6)" }}>
                <th style={th("left")}>항목</th>
                <th style={th()}>금액 (원)</th>
                <th style={th()}>억원</th>
                <th style={th()}>비율</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "직접인건비", val: cv.labor, color: C.navyM },
                { label: "직접경비", val: cv.exp, color: C.navyM },
                { label: "외주용역비", val: cv.sub, color: C.navyM },
                { label: "직접비 소계", val: cv.direct, bold: true, color: C.navy },
                { label: "간접비 (인건비×110%)", val: cv.indirect, color: C.amber },
                { label: "이 윤", val: cv.profit, color: C.amber },
                { label: "합계 (예상용역금액)", val: cv.total, bold: true, color: C.navy, bg: C.navyL },
              ].map((row, i) => (
                <tr key={i} style={{ background: row.bg || (i % 2 === 0 ? "var(--color-background-primary,#fff)" : "var(--color-background-secondary,#f8f8f6)") }}>
                  <td style={{ ...td("left"), fontWeight: row.bold ? 700 : 400, color: row.color }}>{row.label}</td>
                  <td style={{ ...td("right"), fontWeight: row.bold ? 700 : 400 }}>{fmtWon(row.val)}</td>
                  <td style={{ ...td("right"), fontWeight: row.bold ? 700 : 400 }}>{fmtEok(row.val)}</td>
                  <td style={{ ...td("center") }}>{base > 0 ? fmtPct(row.val / base) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="평당 단가 분석">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InfoItem label="계약금액 (VAT별도)" val={fmtWon(base)} highlight />
            <InfoItem label="연면적 기준 평당단가" val={fmtPy(cv.pyFloor)} highlight />
            <InfoItem label="건축면적 기준 평당단가" val={fmtPy(cv.pyBuilding)} />
            <InfoItem label="외주비 평당단가" val={selProj.pyFloor > 0 ? fmtPy(cv.sub / selProj.pyFloor) : "-"} />
            {cv.vatInfo && (
              <>
                <div style={{ height: 1, background: "var(--color-border-tertiary,#eee)", margin: "4px 0" }} />
                <InfoItem label="VAT 유형" val={VAT_LABELS[selProj.vatType]} />
                <InfoItem label="공급가액" val={fmtWon(cv.vatInfo.base)} />
                <InfoItem label="부가세" val={fmtWon(cv.vatInfo.vat)} highlight={cv.vatInfo.vat > 0} />
                <InfoItem label="합계 (VAT포함)" val={fmtWon(cv.vatInfo.total)} highlight />
                {selProj.vatType === "national_housing" && (
                  <>
                    <InfoItem label="  └ 과세분" val={fmtWon(cv.vatInfo.taxable)} />
                    <InfoItem label="  └ 면세분" val={fmtWon(cv.vatInfo.exempt)} />
                  </>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* 버전 비교 테이블 (2개 이상일 때) */}
      {selProj.versions.length > 1 && (
        <Card title="버전별 변경 이력 비교">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.navyM }}>
                  <th style={{ ...th("left"), color: "#fff" }}>항목</th>
                  {selProj.versions.map(v => <th key={v.v} style={{ ...th(), color: "#fff" }}>{v.v}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "작성일", key: "date", fmt: v => v },
                  { label: "변경사유", key: "reason", fmt: v => v },
                  { label: "직접인건비", key: "laborCost", fmt: fmtEok },
                  { label: "직접경비", key: "directExp", fmt: fmtEok },
                  { label: "외주용역비", key: "subContract", fmt: fmtEok },
                  { label: "외주비 비율", key: "subContract", fmt: (v) => base > 0 ? fmtPct(v / base) : "-" },
                ].map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "var(--color-background-primary,#fff)" : "var(--color-background-secondary,#f8f8f6)" }}>
                    <td style={td("left")}>{row.label}</td>
                    {selProj.versions.map((v, j) => {
                      const val = row.fmt(v[row.key]);
                      const prev = j > 0 ? row.fmt(selProj.versions[j-1][row.key]) : null;
                      const changed = prev !== null && val !== prev && row.key !== "date" && row.key !== "reason";
                      return (
                        <td key={j} style={{ ...td("right"), color: changed ? C.amber : "inherit", fontWeight: j === selVersionIdx ? 700 : 400 }}>
                          {val}{changed ? " ▲" : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 외주비 관리 탭
// ════════════════════════════════════════════════════════════
function VendorsTab({ selProj, selVer, cv }) {
  const vendors = selVer.vendors || [];
  const totalContract = vendors.reduce((s, v) => s + v.contract, 0);
  const totalPaid = vendors.reduce((s, v) => s + v.paid, 0);
  const totalUnpaid = totalContract - totalPaid;

  // 공종별 집계
  const byCat = vendors.reduce((acc, v) => {
    if (!acc[v.cat]) acc[v.cat] = { contract: 0, paid: 0 };
    acc[v.cat].contract += v.contract;
    acc[v.cat].paid += v.paid;
    return acc;
  }, {});
  const catData = Object.entries(byCat).map(([cat, d]) => ({ name: cat, 계약금: +(d.contract/1e6).toFixed(0), 기지급: +(d.paid/1e6).toFixed(0) }));

  return (
    <div>
      <div style={grid(3, 12)}>
        <KpiCard label="외주비 총계약" val={fmtEok(totalContract)} sub={`계약금 대비 ${fmtPct(totalContract / selProj.baseContract)}`} color={C.navyM} />
        <KpiCard label="기지급 합계" val={fmtEok(totalPaid)} sub={`지급률 ${fmtPct(totalContract > 0 ? totalPaid / totalContract : 0)}`} color={C.green} />
        <KpiCard label="미지급 잔액" val={fmtEok(totalUnpaid)} sub="청구 예정" color={totalUnpaid > 0 ? C.amber : C.gray} />
      </div>

      <div style={grid(2, 14)}>
        <Card title="공종별 외주비 (백만원)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={catData} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v + "M"} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
              <Tooltip formatter={(v, n) => [v + "백만원", n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="계약금" fill={C.navyM} />
              <Bar dataKey="기지급" fill={C.green} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="지급 현황 파이">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={[{ name: "기지급", value: totalPaid }, { name: "미지급", value: totalUnpaid }]}
                cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                <Cell fill={C.green} /><Cell fill={C.amberL} />
              </Pie>
              <Tooltip formatter={v => fmtWon(v)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 외주비 상세 테이블 */}
      <Card title={`외주비 지급 상세 — ${selVer.v}`}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.navyM }}>
                {["공종","업체명","계약금액","기지급","미지급","지급률","계약금 대비","비고"].map(h => (
                  <th key={h} style={{ padding: "7px 10px", color: "#fff", fontWeight: 500, whiteSpace: "nowrap", textAlign: h.includes("금") || h.includes("비율") || h.includes("률") || h.includes("대비") ? "right" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.map((v, i) => {
                const unpaid = v.contract - v.paid;
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? "var(--color-background-primary,#fff)" : "var(--color-background-secondary,#f8f8f6)" }}>
                    <td style={td("center")}><span style={{ padding: "2px 7px", borderRadius: 8, background: C.navyL, color: C.navy, fontSize: 10 }}>{v.cat}</span></td>
                    <td style={td("left")}>{v.name}</td>
                    <td style={td("right")}>{fmtWon(v.contract)}</td>
                    <td style={{ ...td("right"), color: C.green }}>{fmtWon(v.paid)}</td>
                    <td style={{ ...td("right"), color: unpaid > 0 ? C.amber : C.gray }}>{fmtWon(unpaid)}</td>
                    <td style={td("center")}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 50, height: 6, background: "var(--color-background-secondary,#f0f0ee)", borderRadius: 3 }}>
                          <div style={{ width: `${v.pct}%`, height: 6, background: v.pct >= 100 ? C.green : C.navyM, borderRadius: 3 }} />
                        </div>
                        <span>{v.pct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td style={td("center")}>{selProj.baseContract > 0 ? fmtPct(v.contract / selProj.baseContract) : "-"}</td>
                    <td style={td("left")}>{v.pct >= 100 ? "✅ 지급완료" : v.pct > 0 ? "진행중" : "미지급"}</td>
                  </tr>
                );
              })}
              <tr style={{ background: C.navyL, fontWeight: 700 }}>
                <td style={{ ...td("center"), color: C.navy }} colSpan={2}>합 계</td>
                <td style={{ ...td("right"), color: C.navy }}>{fmtWon(totalContract)}</td>
                <td style={{ ...td("right"), color: C.green }}>{fmtWon(totalPaid)}</td>
                <td style={{ ...td("right"), color: C.amber }}>{fmtWon(totalUnpaid)}</td>
                <td style={{ ...td("center"), color: C.navy }}>{totalContract > 0 ? fmtPct(totalPaid / totalContract) : "-"}</td>
                <td style={{ ...td("center"), color: C.navy }}>{selProj.baseContract > 0 ? fmtPct(totalContract / selProj.baseContract) : "-"}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 기성 현황 탭
// ════════════════════════════════════════════════════════════
function MilestoneTab({ selProj, cv, setProjects, projects }) {
  const ms = selProj.milestones || [];
  const totalReceived = ms.filter(m => m.received).reduce((s, m) => s + m.pct, 0);
  const totalAmt = selProj.baseContract;

  const toggleReceived = (idx) => {
    setProjects(prev => prev.map(p => p.id === selProj.id ? {
      ...p,
      milestones: p.milestones.map((m, i) => i === idx ? { ...m, received: !m.received } : m)
    } : p));
  };

  return (
    <div>
      <div style={grid(3, 12)}>
        <KpiCard label="총 계약금액" val={fmtEok(totalAmt)} sub="VAT별도" color={C.navyM} />
        <KpiCard label="기수령률" val={`${totalReceived.toFixed(1)}%`} sub={fmtWon(totalAmt * totalReceived / 100)} color={C.green} />
        <KpiCard label="미수령" val={`${(100 - totalReceived).toFixed(1)}%`} sub={fmtWon(totalAmt * (100 - totalReceived) / 100)} color={C.amber} />
      </div>

      {/* 진행률 바 */}
      <Card title="기성 수령 현황">
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.gray, marginBottom: 4 }}>
            <span>기수령률 {totalReceived.toFixed(1)}%</span>
            <span>{fmtWon(totalAmt * totalReceived / 100)} / {fmtWon(totalAmt)}</span>
          </div>
          <div style={{ height: 16, background: "var(--color-background-secondary,#f0f0ee)", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ width: `${totalReceived}%`, height: "100%", background: `linear-gradient(90deg, ${C.green}, ${C.navyM})`, borderRadius: 8, transition: "width .5s" }} />
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--color-background-secondary,#f8f8f6)" }}>
              {["기성 단계","비율","금액 (VAT별도)","수령일","상태",""].map(h => (
                <th key={h} style={th()}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ms.map((m, i) => (
              <tr key={i} style={{ background: m.received ? C.greenL : "var(--color-background-primary,#fff)" }}>
                <td style={td("left")}>{m.stage}</td>
                <td style={td("center")}>{m.pct.toFixed(2)}%</td>
                <td style={td("right")}>{fmtWon(totalAmt * m.pct / 100)}</td>
                <td style={td("center")}>{m.date || "-"}</td>
                <td style={td("center")}>
                  {m.received
                    ? <span style={{ padding: "2px 8px", borderRadius: 8, background: C.greenL, color: C.green, fontSize: 11 }}>✅ 수령완료</span>
                    : <span style={{ padding: "2px 8px", borderRadius: 8, background: C.amberL, color: C.amber, fontSize: 11 }}>⏳ 미수령</span>}
                </td>
                <td style={td("center")}>
                  <button onClick={() => toggleReceived(i)} style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${m.received ? C.green : C.navyM}`, background: m.received ? C.greenL : C.navyL, color: m.received ? C.green : C.navyM, fontSize: 11, cursor: "pointer" }}>
                    {m.received ? "취소" : "수령"}
                  </button>
                </td>
              </tr>
            ))}
            <tr style={{ background: C.navyL, fontWeight: 700 }}>
              <td style={{ ...td("left"), color: C.navy }}>합 계</td>
              <td style={{ ...td("center"), color: C.navy }}>100%</td>
              <td style={{ ...td("right"), color: C.navy }}>{fmtWon(totalAmt)}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 비교분석 탭
// ════════════════════════════════════════════════════════════
function CompareTab({ projects, calcVersion }) {
  const [sel, setSel] = useState(projects.slice(0, 3).map(p => p.id));

  const selProjs = projects.filter(p => sel.includes(p.id));
  const compData = selProjs.map(p => {
    const ver = p.versions[p.versions.length - 1];
    const c = calcVersion(ver, p);
    return {
      name: p.code.split("-").slice(0, 2).join("-"),
      fullName: p.name,
      pyFloor: Math.round(c.pyFloor),
      subRatio: +(c.subRatio * 100).toFixed(1),
      laborRatio: +(c.laborRatio * 100).toFixed(1),
      contract: p.baseContract,
      subAmt: ver.subContract,
      vatType: p.vatType,
      floorArea: p.pyFloor,
    };
  });

  // 레이더 데이터
  const radarData = ["외주비율", "인건비율", "평당단가지수"].map(subject => {
    const row = { subject };
    compData.forEach(p => { row[p.name] = subject === "외주비율" ? p.subRatio : subject === "인건비율" ? p.laborRatio : Math.round(p.pyFloor / 1000); });
    return row;
  });

  return (
    <div>
      {/* 프로젝트 선택 */}
      <Card title="비교 프로젝트 선택 (최대 4개)">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {projects.map(p => (
            <button key={p.id} onClick={() => setSel(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : prev.length < 4 ? [...prev, p.id] : prev)}
              style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${sel.includes(p.id) ? C.navyM : "var(--color-border-secondary,#ccc)"}`,
                background: sel.includes(p.id) ? C.navyL : "var(--color-background-primary,#fff)",
                color: sel.includes(p.id) ? C.navy : "var(--color-text-secondary,#666)", fontSize: 11, cursor: "pointer" }}>
              {p.code}
            </button>
          ))}
        </div>
      </Card>

      {/* 비교 차트 */}
      <div style={grid(2, 14)}>
        <Card title="외주비율 비교 (%)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v + "%"} />
              <Tooltip formatter={(v, n) => [v + "%", n]} />
              <Bar dataKey="subRatio" fill={C.navyM} name="외주비율" label={{ position: "top", fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="연면적 평당단가 비교 (원/평)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v / 1000).toFixed(0) + "천"} />
              <Tooltip formatter={v => [fmtPy(v), "평당단가"]} />
              <Bar dataKey="pyFloor" fill={C.green} name="평당단가" label={{ position: "top", fontSize: 10, formatter: v => (v / 1000).toFixed(0) + "k" }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 비교 테이블 */}
      <Card title="상세 수치 비교">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.navyM }}>
                <th style={{ ...th("left"), color: "#fff" }}>항목</th>
                {compData.map(p => <th key={p.name} style={{ ...th(), color: "#fff" }}>{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "계약금액", fmt: (p) => fmtEok(p.contract) },
                { label: "외주비 합계", fmt: (p) => fmtEok(p.subAmt) },
                { label: "외주비 비율", fmt: (p) => fmtPct(p.subRatio / 100) },
                { label: "연면적 (평)", fmt: (p) => p.floorArea.toLocaleString() + "평" },
                { label: "연면적 평당단가", fmt: (p) => fmtPy(p.pyFloor) },
                { label: "VAT 유형", fmt: (p) => VAT_BADGE[p.vatType].label },
              ].map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "var(--color-background-primary,#fff)" : "var(--color-background-secondary,#f8f8f6)" }}>
                  <td style={{ ...td("left"), fontWeight: 500 }}>{row.label}</td>
                  {compData.map(p => <td key={p.name} style={td("center")}>{row.fmt(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// VAT 계산기 탭
// ════════════════════════════════════════════════════════════
function VATCalculator() {
  const [base, setBase] = useState(1000000000);
  const [vatType, setVatType] = useState("general");
  const [taxRatio, setTaxRatio] = useState(0.65);
  const [inputWon, setInputWon] = useState("1000000000");

  const result = calcVAT(base, vatType, taxRatio);

  const handleInput = (v) => {
    setInputWon(v.replace(/[^0-9]/g, ""));
    const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(n)) setBase(n);
  };

  return (
    <div>
      <div style={grid(2, 16)}>
        <Card title="🧾 VAT 계산기">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>용역비 (원, VAT별도)</label>
              <input type="text" value={inputWon} onChange={e => handleInput(e.target.value)}
                style={inputStyle} placeholder="예: 1000000000" />
              <div style={{ fontSize: 11, color: C.green, marginTop: 3 }}>= {fmtEok(base)}</div>
            </div>
            <div>
              <label style={labelStyle}>VAT 유형</label>
              <select value={vatType} onChange={e => setVatType(e.target.value)} style={inputStyle}>
                <option value="general">일반과세 (VAT 10%)</option>
                <option value="national_housing">국민주택 (과세/면세 혼합)</option>
                <option value="tax_exempt">면세</option>
              </select>
            </div>
            {vatType === "national_housing" && (
              <div>
                <label style={labelStyle}>과세 비율 (전용면적 85㎡ 초과 비율)</label>
                <input type="number" min="0" max="1" step="0.01" value={taxRatio}
                  onChange={e => setTaxRatio(parseFloat(e.target.value) || 0)} style={inputStyle} />
                <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>
                  예) 전용 85㎡ 초과 60% → 0.60 입력. 면세 비율: {((1 - taxRatio) * 100).toFixed(0)}%
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="계산 결과">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InfoItem label="공급가액 (VAT별도)" val={fmtWon(result.base)} />
            {vatType === "national_housing" && result.taxable !== undefined && (
              <>
                <InfoItem label="  └ 과세분 공급가액" val={fmtWon(result.taxable)} />
                <InfoItem label="  └ 면세분 공급가액" val={fmtWon(result.exempt)} />
              </>
            )}
            <InfoItem label="부가가치세" val={fmtWon(result.vat)} highlight={result.vat > 0} />
            <div style={{ height: 1, background: "var(--color-border-tertiary,#eee)" }} />
            <InfoItem label="합계 금액 (VAT포함)" val={fmtWon(result.total)} highlight />
            <InfoItem label="합계 (억원)" val={fmtEok(result.total)} />
          </div>
        </Card>
      </div>

      {/* 국민주택 안내 */}
      <Card title="📌 국민주택 VAT 규정 안내">
        <div style={{ fontSize: 12, color: "var(--color-text-secondary,#555)", lineHeight: 1.9 }}>
          <div style={{ fontWeight: 600, color: C.navy, marginBottom: 8 }}>국민주택이하 용역 VAT 처리 기준</div>
          <div>• <b>국민주택 규모:</b> 주거용 건물 전용면적 85㎡ 이하 (수도권 제외 읍·면 지역은 100㎡ 이하)</div>
          <div>• <b>면세 적용 조건:</b> 국민주택 규모 이하의 건설 용역 → 부가세 면제</div>
          <div>• <b>혼합 건물:</b> 전용면적 기준으로 과세/면세 비율 안분 계산</div>
          <div>• <b>과세 비율 계산:</b> (전용면적 85㎡ 초과 세대 면적 합계) ÷ (총 전용면적) × 100%</div>
          <div>• <b>실무 예시:</b> 총 전용면적 100평 중 65평이 85㎡ 초과 → 과세비율 65%, 면세비율 35%</div>
          <div style={{ marginTop: 10, padding: "8px 12px", background: C.amberL, borderRadius: 8, color: C.amber }}>
            ⚠ 정확한 과세/면세 비율은 주거 도면의 세대별 전용면적 기준으로 산정하며, 세무사 확인이 필요합니다.
          </div>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 모달: 프로젝트 추가
// ════════════════════════════════════════════════════════════
function AddProjectModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    code: "", name: "", dept: "", pm: "", client: "",
    vatType: "general", taxRatio: 1.0,
    siteArea: 0, floorArea: 0, pyFloor: 0, pyBuilding: 0,
    baseContract: 0,
  });
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const pyFloor  = form.pyFloor  || (form.floorArea  > 0 ? Math.round(form.floorArea  / 3.30579) : 0);
  const pyBuilding = form.pyBuilding || (form.siteArea > 0 ? Math.round(form.siteArea / 3.30579) : 0);

  return (
    <Modal title="새 프로젝트 추가" onClose={onClose} onSave={() => onSave({ ...form, pyFloor, pyBuilding, versions: [] })}>
      <div style={grid(2, 10)}>
        <ModalField label="프로젝트 코드 *" val={form.code} onChange={v => upd("code", v)} />
        <ModalField label="프로젝트명 *" val={form.name} onChange={v => upd("name", v)} />
        <ModalField label="주관부서" val={form.dept} onChange={v => upd("dept", v)} />
        <ModalField label="PM" val={form.pm} onChange={v => upd("pm", v)} />
        <ModalField label="발주처" val={form.client} onChange={v => upd("client", v)} />
        <div>
          <label style={labelStyle}>VAT 유형</label>
          <select value={form.vatType} onChange={e => upd("vatType", e.target.value)} style={inputStyle}>
            <option value="general">일반과세</option>
            <option value="national_housing">국민주택</option>
            <option value="tax_exempt">면세</option>
          </select>
        </div>
        {form.vatType === "national_housing" && (
          <ModalField label="과세비율 (0~1)" val={form.taxRatio} onChange={v => upd("taxRatio", parseFloat(v) || 0)} type="number" />
        )}
        <ModalField label="계약금액 (원, VAT별도)" val={form.baseContract} onChange={v => upd("baseContract", parseInt(v) || 0)} type="number" />
        <ModalField label="대지면적 (㎡)" val={form.siteArea} onChange={v => upd("siteArea", parseInt(v) || 0)} type="number" />
        <ModalField label="연면적 (㎡)" val={form.floorArea} onChange={v => upd("floorArea", parseInt(v) || 0)} type="number" />
      </div>
      {form.baseContract > 0 && form.floorArea > 0 && (
        <div style={{ marginTop: 8, padding: "8px 12px", background: C.navyL, borderRadius: 8, fontSize: 11, color: C.navy }}>
          계산된 평당단가: {fmtPy(form.baseContract / (form.floorArea / 3.30579))} (연면적 기준)
        </div>
      )}
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
// 모달: 버전 추가
// ════════════════════════════════════════════════════════════
function AddVersionModal({ selProj, onClose, onSave }) {
  const lastVer = selProj.versions[selProj.versions.length - 1];
  const [form, setForm] = useState({
    v: `v${selProj.versions.length + 1}.0 ${selProj.versions.length}차변경`,
    date: new Date().toISOString().slice(0, 10),
    reason: "",
    laborCost: lastVer.laborCost || 0,
    directExp: lastVer.directExp || 0,
    subContract: lastVer.subContract || 0,
    indirect: lastVer.indirect || null,
    profit: lastVer.profit || null,
    vendors: lastVer.vendors ? [...lastVer.vendors] : [],
  });
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal title="새 버전 추가" onClose={onClose} onSave={() => onSave(form)}>
      <div style={grid(2, 10)}>
        <ModalField label="버전명" val={form.v} onChange={v => upd("v", v)} />
        <ModalField label="작성일" val={form.date} onChange={v => upd("date", v)} type="date" />
        <ModalField label="변경 사유" val={form.reason} onChange={v => upd("reason", v)} />
        <ModalField label="직접인건비 (원)" val={form.laborCost} onChange={v => upd("laborCost", parseInt(v) || 0)} type="number" />
        <ModalField label="직접경비 (원)" val={form.directExp} onChange={v => upd("directExp", parseInt(v) || 0)} type="number" />
        <ModalField label="외주용역비 (원)" val={form.subContract} onChange={v => upd("subContract", parseInt(v) || 0)} type="number" />
        <ModalField label="간접비 (비어있으면 자동계산)" val={form.indirect || ""} onChange={v => upd("indirect", parseInt(v) || null)} type="number" />
        <ModalField label="이윤 (비어있으면 자동계산)" val={form.profit || ""} onChange={v => upd("profit", parseInt(v) || null)} type="number" />
      </div>
      <div style={{ marginTop: 10, padding: "8px 12px", background: C.navyL, borderRadius: 8, fontSize: 11, color: C.navy }}>
        직접비 합계: {fmtEok((form.laborCost || 0) + (form.directExp || 0) + (form.subContract || 0))}
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
// 공통 컴포넌트
// ════════════════════════════════════════════════════════════
const CHART_COLORS2 = ["#185FA5","#1D9E75","#BA7517","#A32D2D","#639922"];

function KpiCard({ label, val, sub, color }) {
  return (
    <div style={{ background: "var(--color-background-secondary,#f8f8f6)", borderRadius: 10, padding: "14px 16px", border: "0.5px solid var(--color-border-tertiary,#e8e8e4)" }}>
      <div style={{ fontSize: 11, color: C.gray, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color || C.navyM, letterSpacing: -0.5 }}>{val}</div>
      {sub && <div style={{ fontSize: 10, color: C.gray, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: "var(--color-background-primary,#fff)", borderRadius: 12, padding: "14px 16px", border: "0.5px solid var(--color-border-tertiary,#e8e8e4)", marginBottom: 14 }}>
      {title && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary,#333)", marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  );
}

function InfoItem({ label, val, highlight }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "0.5px solid var(--color-border-tertiary,#eee)", fontSize: 12 }}>
      <span style={{ color: C.gray, fontWeight: 500 }}>{label}</span>
      <span style={{ fontWeight: highlight ? 700 : 400, color: highlight ? C.navy : "var(--color-text-primary,#333)" }}>{val}</span>
    </div>
  );
}

function Badge({ val, color }) {
  return <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 11, background: color + "22", color }}>{val}</span>;
}

function Modal({ title, onClose, onSave, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 200, padding: 20, overflowY: "auto" }}>
      <div style={{ background: "var(--color-background-primary,#fff)", borderRadius: 16, padding: 22, width: "100%", maxWidth: 540, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.gray }}>✕</button>
        </div>
        {children}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onSave} style={btnStyle(C.navyM)}>저장</button>
          <button onClick={onClose} style={{ ...btnStyle(C.gray), background: "var(--color-background-secondary,#f5f5f3)" }}>취소</button>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, val, onChange, type = "text" }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={val} onChange={e => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

// ── 스타일 헬퍼 ───────────────────────────────────────────────
const grid = (cols, gap) => ({ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, marginBottom: gap });
const th  = (ha = "center") => ({ padding: "7px 10px", fontWeight: 500, fontSize: 11, whiteSpace: "nowrap", textAlign: ha, color: "var(--color-text-secondary,#888)", background: "var(--color-background-secondary,#f8f8f6)" });
const td  = (ha = "right") => ({ padding: "7px 10px", borderBottom: "0.5px solid var(--color-border-tertiary,#eee)", textAlign: ha, fontSize: 12 });
const btnStyle = (bg) => ({ padding: "7px 14px", background: bg, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 });
const labelStyle = { display: "block", fontSize: 11, color: C.gray, fontWeight: 500, marginBottom: 3 };
const inputStyle = { width: "100%", padding: "7px 9px", border: "1px solid var(--color-border-secondary,#ddd)", borderRadius: 8, fontSize: 12, color: "var(--color-text-primary,#333)", background: "var(--color-background-primary,#fff)", fontFamily: "inherit" };
