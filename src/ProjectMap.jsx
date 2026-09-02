// ══════════════════════════════════════════════════════════════
// 🗺 프로젝트 지도 — 이세미 캠프 "우리동네 현안도" 스타일 프로토타입
// 프로젝트 주소를 지도 위에 본부별 색상 핀으로 표시하고, 본부별로 필터링.
// 지금은 무료 OpenStreetMap(Leaflet) + Nominatim 지오코딩으로 동작 — 정확도를 높이려면
// 카카오맵 JS 키를 발급받아 지오코딩만 카카오 API로 교체하면 된다(레이아웃은 그대로 재사용 가능).
// 한 번 좌표로 변환한 주소는 서버(geocodeCache)에 저장해 모든 사용자가 재사용한다.
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useMemo } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { useDepts } from "./DeptContext.jsx"

// Nominatim(OpenStreetMap 무료 지오코딩) — 초당 1건 제한 권장이라 순차 호출 + 지연
async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(address)}`
    const res = await fetch(url, { headers: { "Accept-Language": "ko" } })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}
const sleep = ms => new Promise(r=>setTimeout(r, ms))

export function ProjectMapPage({projects=[], geocodeCache={}, setGeocodeCache, currentUser, setTab, setSelProjId, setDetailTab}) {
  const {DEPTS, DEPT_COLORS} = useDepts()
  const mapRef = useRef(null)
  const mapObj = useRef(null)
  const markersLayer = useRef(null)
  const [deptFilter, setDeptFilter] = useState("전체")
  const [geocoding, setGeocoding] = useState(false)
  const [geoProgress, setGeoProgress] = useState({done:0, total:0})
  const isAdmin = currentUser?.role==="admin"

  // 주소가 있는 프로젝트 중 좌표 캐시에 없는 것 개수
  const withAddress = useMemo(()=>projects.filter(p=>p.address && p.address.trim()), [projects])
  const missingCoords = useMemo(()=>withAddress.filter(p=>!geocodeCache[p.address]), [withAddress, geocodeCache])

  // 지도 초기화 (한 번만)
  useEffect(()=>{
    if(!mapRef.current || mapObj.current) return
    mapObj.current = L.map(mapRef.current, {zoomControl:true}).setView([37.4138, 127.1216], 8) // 판교 부근 기본 중심
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '© OpenStreetMap contributors'
    }).addTo(mapObj.current)
    markersLayer.current = L.layerGroup().addTo(mapObj.current)
    return ()=>{ mapObj.current?.remove(); mapObj.current=null }
  },[])

  // 필터된 프로젝트 목록 (좌표 있는 것만)
  const pinned = useMemo(()=>{
    return withAddress
      .filter(p=>deptFilter==="전체" || (p.depts||[]).includes(deptFilter))
      .map(p=>({p, coord: geocodeCache[p.address]}))
      .filter(x=>x.coord)
  },[withAddress, deptFilter, geocodeCache])

  // 마커 렌더링
  useEffect(()=>{
    if(!mapObj.current || !markersLayer.current) return
    markersLayer.current.clearLayers()
    if(pinned.length===0) return
    const bounds = []
    pinned.forEach(({p, coord})=>{
      const dept = (p.depts||[])[0] || "기타"
      const color = DEPT_COLORS?.[dept] || "#0E9C8C"
      const icon = L.divIcon({
        className: "", html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize:[16,16], iconAnchor:[8,8]
      })
      const marker = L.marker([coord.lat, coord.lng], {icon}).addTo(markersLayer.current)
      const html = document.createElement("div")
      html.style.cssText = "min-width:220px;font-family:inherit"
      html.innerHTML = `
        <div style="font-weight:800;font-size:14.3px;color:#0B6E63;margin-bottom:6px">${p.name}</div>
        <div style="font-size:12.5px;color:#64748B;line-height:1.7">
          ${dept} ${p.pm?" · PM "+p.pm:""}<br/>
          ${p.client?"발주처: "+p.client+"<br/>":""}
          ${p.address}
        </div>
        <button id="mapopen-${p.id}" style="margin-top:8px;padding:5px 12px;background:#E3F6F3;color:#0B6E63;border:none;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer">상세 열기 →</button>
      `
      marker.bindPopup(html)
      marker.on("popupopen", ()=>{
        document.getElementById(`mapopen-${p.id}`)?.addEventListener("click", ()=>{
          setTab("projects"); setSelProjId(p.id); setDetailTab && setDetailTab("basic")
        })
      })
      bounds.push([coord.lat, coord.lng])
    })
    if(bounds.length>0) mapObj.current.fitBounds(bounds, {padding:[40,40], maxZoom:14})
  },[pinned, DEPT_COLORS])

  const runGeocoding = async () => {
    if(missingCoords.length===0) return
    setGeocoding(true)
    setGeoProgress({done:0, total:missingCoords.length})
    const newEntries = {}
    for(let i=0;i<missingCoords.length;i++){
      const p = missingCoords[i]
      const coord = await geocodeAddress(p.address)
      if(coord) newEntries[p.address] = coord
      setGeoProgress({done:i+1, total:missingCoords.length})
      await sleep(1100) // Nominatim 요청 제한(1req/sec) 준수
    }
    setGeocodeCache(prev=>({...prev, ...newEntries}))
    setGeocoding(false)
  }

  return (
    <div>
      <div style={{fontSize:24.2,fontWeight:800,color:"#0B6E63",marginBottom:6}}>🗺 프로젝트 지도 <span style={{fontSize:13.2,fontWeight:600,color:"#94A3B8"}}>(프로토타입)</span></div>
      <div style={{fontSize:14.3,color:"#64748B",marginBottom:16}}>
        프로젝트 상세정보의 "주소"를 기준으로 지도에 표시합니다. 지금은 무료 OpenStreetMap 기반이라 일부 주소는 정확도가 떨어질 수 있습니다 —
        카카오맵 API 키를 발급받으시면 훨씬 정확한 버전으로 바꿔드릴 수 있습니다.
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>setDeptFilter("전체")}
          style={{padding:"7px 16px",borderRadius:20,border:`1.5px solid ${deptFilter==="전체"?"#0E9C8C":"#E5E7EB"}`,
            background:deptFilter==="전체"?"#0E9C8C":"#fff",color:deptFilter==="전체"?"#fff":"#334155",fontSize:14,fontWeight:700,cursor:"pointer"}}>
          전체 ({pinned.length})
        </button>
        {(DEPTS||[]).map(d=>{
          const cnt = pinned.filter(x=>(x.p.depts||[]).includes(d)).length
          return (
            <button key={d} onClick={()=>setDeptFilter(d)}
              style={{padding:"7px 16px",borderRadius:20,border:`1.5px solid ${deptFilter===d?(DEPT_COLORS?.[d]||"#0E9C8C"):"#E5E7EB"}`,
                background:deptFilter===d?(DEPT_COLORS?.[d]||"#0E9C8C"):"#fff",color:deptFilter===d?"#fff":"#334155",fontSize:14,fontWeight:700,cursor:"pointer"}}>
              {d} ({cnt})
            </button>
          )
        })}
      </div>

      {missingCoords.length>0 && (
        <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div style={{fontSize:13.6,color:"#92400E"}}>
            주소가 있는 프로젝트 {withAddress.length}건 중 <b>{missingCoords.length}건</b>이 아직 지도에 좌표로 변환되지 않았습니다.
            {geocoding && <> — 변환 중 {geoProgress.done}/{geoProgress.total}...</>}
          </div>
          {isAdmin && (
            <button onClick={runGeocoding} disabled={geocoding}
              style={{padding:"7px 16px",background:geocoding?"#FCD34D":"#D97706",color:"#fff",border:"none",borderRadius:8,fontSize:13.6,fontWeight:700,cursor:geocoding?"default":"pointer"}}>
              {geocoding?"⏳ 변환 중...":"📍 주소 좌표 변환 시작"}
            </button>
          )}
        </div>
      )}
      {withAddress.length===0 && (
        <div style={{background:"#F8FAFC",border:"1px solid #E5E7EB",borderRadius:10,padding:"14px 16px",marginBottom:14,fontSize:13.6,color:"#64748B"}}>
          아직 주소가 입력된 프로젝트가 없습니다. 프로젝트 상세정보 → 기본정보에서 "주소"를 입력하면 여기 지도에 자동으로 표시됩니다.
        </div>
      )}

      <div ref={mapRef} style={{width:"100%",height:600,borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden"}}/>
    </div>
  )
}
