// ══════════════════════════════════════════════════════════════
// 🗺 프로젝트 지도 — 카카오맵 기반
// 프로젝트 주소를 카카오맵 위에 본부별 색상 핀으로 표시하고, 본부별로 필터링.
// 주소→좌표 변환(지오코딩)은 카카오 로컬 API(REST)를 사용. 결과는 서버(geocodeCache)에
// 저장해 모든 사용자가 재사용한다(같은 주소를 반복해서 API 호출하지 않도록).
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useMemo } from "react"
import { useDepts } from "./DeptContext.jsx"

// ⚠ developers.kakao.com에서 발급받은 키 — 등록된 도메인에서만 동작하도록 카카오 측에서 제한하는 공개용 키입니다.
const KAKAO_JS_KEY   = "33ac6b75145611fd7aba3e45c9db9b33"
const KAKAO_REST_KEY = "e4c1b0baa8430fa6fc9b85f0e578df2c"

// 카카오맵 JS SDK를 페이지에 한 번만 로드
let kakaoSdkPromise = null
function loadKakaoSdk() {
  if (window.kakao?.maps) return Promise.resolve(window.kakao)
  if (kakaoSdkPromise) return kakaoSdkPromise
  kakaoSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    script.onerror = () => reject(new Error("카카오맵 SDK 로드 실패"))
    document.head.appendChild(script)
  })
  return kakaoSdkPromise
}

// 카카오 로컬 API(주소 검색)로 지오코딩 — 도로명·지번 주소 모두 지원
async function geocodeAddress(address) {
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } })
    if (!res.ok) return null
    const data = await res.json()
    const doc = data?.documents?.[0]
    if (!doc) return null
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) }
  } catch { return null }
}
const sleep = ms => new Promise(r=>setTimeout(r, ms))

export function ProjectMapPage({projects=[], geocodeCache={}, setGeocodeCache, currentUser, setTab, setSelProjId, setDetailTab}) {
  const {DEPTS, DEPT_COLORS} = useDepts()
  const mapRef = useRef(null)
  const mapObj = useRef(null)
  const markersRef = useRef([])
  const [sdkReady, setSdkReady] = useState(false)
  const [sdkError, setSdkError] = useState(false)
  const [deptFilter, setDeptFilter] = useState("전체")
  const [geocoding, setGeocoding] = useState(false)
  const [geoProgress, setGeoProgress] = useState({done:0, total:0})
  const isAdmin = currentUser?.role==="admin"

  const withAddress = useMemo(()=>projects.filter(p=>p.address && p.address.trim()), [projects])
  const missingCoords = useMemo(()=>withAddress.filter(p=>!geocodeCache[p.address]), [withAddress, geocodeCache])

  // SDK 로드 + 지도 초기화 (한 번만)
  useEffect(()=>{
    let cancelled = false
    loadKakaoSdk().then(kakao=>{
      if(cancelled || !mapRef.current) return
      mapObj.current = new kakao.maps.Map(mapRef.current, {
        center: new kakao.maps.LatLng(37.4138, 127.1216), // 판교 부근 기본 중심
        level: 8,
      })
      setSdkReady(true)
    }).catch(()=>{ if(!cancelled) setSdkError(true) })
    return ()=>{ cancelled = true }
  },[])

  const pinned = useMemo(()=>{
    return withAddress
      .filter(p=>deptFilter==="전체" || (p.depts||[]).includes(deptFilter))
      .map(p=>({p, coord: geocodeCache[p.address]}))
      .filter(x=>x.coord)
  },[withAddress, deptFilter, geocodeCache])

  // 마커 렌더링
  useEffect(()=>{
    if(!sdkReady || !mapObj.current) return
    const kakao = window.kakao
    markersRef.current.forEach(m=>m.setMap(null))
    markersRef.current = []
    if(pinned.length===0) return
    const bounds = new kakao.maps.LatLngBounds()
    const infoWindow = new kakao.maps.InfoWindow({ removable: true })

    pinned.forEach(({p, coord})=>{
      const dept = (p.depts||[])[0] || "기타"
      const color = DEPT_COLORS?.[dept] || "#0E9C8C"
      const pos = new kakao.maps.LatLng(coord.lat, coord.lng)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="${color.replace("#","%23")}" stroke="white" stroke-width="2"/></svg>`
      const marker = new kakao.maps.Marker({
        position: pos, map: mapObj.current,
        image: new kakao.maps.MarkerImage(`data:image/svg+xml,${svg}`, new kakao.maps.Size(20,20), {offset:new kakao.maps.Point(10,10)}),
      })
      kakao.maps.event.addListener(marker, "click", ()=>{
        const html = document.createElement("div")
        html.style.cssText = "min-width:220px;padding:12px 14px;font-family:inherit"
        html.innerHTML = `
          <div style="font-weight:800;font-size:14px;color:#0B6E63;margin-bottom:6px">${p.name}</div>
          <div style="font-size:12.5px;color:#64748B;line-height:1.7">
            ${dept}${p.pm?" · PM "+p.pm:""}<br/>
            ${p.client?"발주처: "+p.client+"<br/>":""}
            ${p.address}
          </div>
          <button id="mapopen-${p.id}" style="margin-top:8px;padding:5px 12px;background:#E3F6F3;color:#0B6E63;border:none;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer">상세 열기 →</button>
        `
        infoWindow.setContent(html)
        infoWindow.open(mapObj.current, marker)
        setTimeout(()=>{
          document.getElementById(`mapopen-${p.id}`)?.addEventListener("click", ()=>{
            setTab("projects"); setSelProjId(p.id); setDetailTab && setDetailTab("basic")
          })
        }, 0)
      })
      markersRef.current.push(marker)
      bounds.extend(pos)
    })
    if(pinned.length>0) mapObj.current.setBounds(bounds)
  },[pinned, sdkReady, DEPT_COLORS])

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
      await sleep(150) // 카카오는 일일 할당량 기준이라 초당 제한이 느슨함 — 가볍게만 페이싱
    }
    setGeocodeCache(prev=>({...prev, ...newEntries}))
    setGeocoding(false)
  }

  return (
    <div>
      <div style={{fontSize:24.2,fontWeight:800,color:"#0B6E63",marginBottom:6}}>🗺 프로젝트 지도</div>
      <div style={{fontSize:14.3,color:"#64748B",marginBottom:16}}>
        프로젝트 상세정보의 "주소"를 기준으로 카카오맵에 표시합니다.
      </div>

      {sdkError && (
        <div style={{background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:10,padding:"14px 16px",marginBottom:14,fontSize:13.6,color:"#7F1D1D"}}>
          ⚠ 카카오맵을 불러오지 못했습니다. developers.kakao.com에서 이 사이트 도메인이 [플랫폼]에 정확히 등록되어 있는지 확인해주세요
          (등록한 주소와 지금 접속 중인 주소가 https:// 까지 정확히 일치해야 합니다).
        </div>
      )}

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

      <div ref={mapRef} style={{width:"100%",height:600,borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden",background:"#F8FAFC"}}/>
    </div>
  )
}
