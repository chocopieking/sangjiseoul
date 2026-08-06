import { useState } from "react"

// 나무위키 스타일 접기/펼치기 섹션 — App.jsx의 Card와 동일한 룩앤필을 공유 컴포넌트로 분리
// 다른 탭 파일(Vendors.jsx, DataHub.jsx 등)에서 import해서 그대로 사용할 수 있습니다.
export function Section({ title, note, actions, children, style = {}, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,.05)", ...style }}>
      {title && (
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            fontSize: 17, fontWeight: 800, padding: "14px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, flexWrap: "wrap", cursor: "pointer", userSelect: "none",
            background: "linear-gradient(180deg,#F0FBF9,#fff)",
            borderBottom: open ? "1px solid #E5E7EB" : "none",
            color: "#0B6E63",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className={`ti ti-chevron-${open ? "down" : "right"}`} style={{ fontSize: 15, color: "#0E9C8C", flexShrink: 0 }} />
            <span>{title}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {note && <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 400 }}>{note}</span>}
            {actions && <span onClick={e => e.stopPropagation()}>{actions}</span>}
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 10px" }}>
              {open ? "접기" : "펼치기"}
            </span>
          </div>
        </div>
      )}
      {(open || !title) && <div style={{ padding: title ? "28px 38px 32px" : "32px 38px" }}>{children}</div>}
    </div>
  )
}
