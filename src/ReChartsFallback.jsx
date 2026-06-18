// ══════════════════════════════════════════════════════════════
// recharts 완전 대체 — 순수 SVG 차트 (Hook 없음, 에러 없음)
// recharts와 동일한 컴포넌트명·props 구조 유지
// ══════════════════════════════════════════════════════════════

// ── 색상 팔레트 ──────────────────────────────────────────────
export const COLORS_DEFAULT = [
  "#3B72F6","#0EA86E","#F59E0B","#EF4444","#534AB7",
  "#D85A30","#7C5295","#2E86AB","#A63D2F","#0F6E56"
]

// ── 유틸 ────────────────────────────────────────────────────
const fmt = v => {
  if(v===undefined||v===null) return ""
  if(Math.abs(v)>=100) return Math.round(v).toLocaleString()
  if(Math.abs(v)>=10)  return v.toFixed(1)
  return v.toFixed(2)
}

// ── ResponsiveContainer (단순 width:100% div) ───────────────
export function ResponsiveContainer({width="100%", height=200, children}) {
  return (
    <div style={{width, height, position:"relative"}}>
      {typeof children === "function"
        ? children({width:"100%", height})
        : children
      }
    </div>
  )
}

// ── 더미 컴포넌트 (JSX에서 props 전달용, 실제 렌더는 부모가) ─
export const XAxis = ()=>null
export const YAxis = ()=>null
export const Tooltip = ()=>null
export const CartesianGrid = ()=>null
export const Legend = ()=>null
export const ReferenceLine = ()=>null
export const LabelList = ()=>null
export const PolarGrid = ()=>null
export const PolarAngleAxis = ()=>null

// Bar props carrier
export function Bar({dataKey, fill, name, radius, barSize, label, stackId}) {
  return null // 실제 렌더는 BarChart가 담당
}
Bar.__isBar = true

// Line props carrier
export function Line({dataKey, stroke, name, dot, strokeWidth, type}) {
  return null
}
Line.__isLine = true

// Area props carrier
export function Area({dataKey, fill, stroke, name, stackId}) {
  return null
}
Area.__isArea = true

// Cell props carrier (PieChart용)
export function Cell({fill}) { return null }

// Radar props carrier
export function Radar({dataKey, fill, stroke, name}) { return null }
Radar.__isRadar = true

// ── BarChart ─────────────────────────────────────────────────
export function BarChart({data=[], children, margin={}, layout="horizontal", barGap=4, barCategoryGap="20%", style={}}) {
  if(!data||data.length===0) return <div style={{height:40,display:"flex",alignItems:"center",justifyContent:"center",color:"#9CA3AF",fontSize:13}}>데이터 없음</div>

  // children에서 Bar 정보 추출
  const bars = []
  const toArr = c => Array.isArray(c)?c.flat():[c]
  toArr(children).filter(Boolean).forEach(c=>{
    if(!c||!c.type) return
    if(c.type===Bar||c.type?.displayName==="Bar"||c.props?.dataKey) {
      if(c.props?.dataKey) bars.push({
        dataKey: c.props.dataKey,
        fill:    c.props.fill || COLORS_DEFAULT[bars.length % COLORS_DEFAULT.length],
        name:    c.props.name || c.props.dataKey,
        label:   c.props.label,
      })
    }
  })

  if(bars.length===0) {
    // dataKey 자동 추출 (첫 항목의 숫자 키)
    const sample = data[0]||{}
    Object.entries(sample).forEach(([k,v])=>{
      if(k!=="name"&&k!=="date"&&typeof v==="number")
        bars.push({dataKey:k,fill:COLORS_DEFAULT[bars.length%COLORS_DEFAULT.length],name:k})
    })
  }

  const isVertical = layout==="vertical"
  const h = 200
  const padL = isVertical ? 70 : 30
  const padR = 10
  const padT = 20
  const padB = 30

  // 최대값 계산
  let maxVal = 0
  data.forEach(row => bars.forEach(b => { const v=Math.abs(row[b.dataKey]||0); if(v>maxVal) maxVal=v }))
  if(maxVal===0) maxVal=1

  const W = 400 // viewBox width
  const H = h
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const groupW = chartW / data.length
  const barW = Math.max(4, Math.min(40, (groupW * 0.7) / Math.max(bars.length,1)))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"100%",overflow:"visible"}} preserveAspectRatio="none">
      {/* Y축 그리드 */}
      {[0,0.25,0.5,0.75,1].map(t=>{
        const y = padT + chartH*(1-t)
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={W-padR} y2={y} stroke="#E5E7EB" strokeWidth={0.5}/>
            <text x={padL-4} y={y+4} textAnchor="end" fontSize={9} fill="#9CA3AF">
              {fmt(maxVal*t)}
            </text>
          </g>
        )
      })}

      {/* 데이터 */}
      {data.map((row,di)=>{
        const cx = padL + groupW*di + groupW/2
        return (
          <g key={di}>
            {bars.map((b,bi)=>{
              const val = row[b.dataKey]||0
              const bh  = Math.abs(val)/maxVal * chartH
              const bx  = cx - (bars.length*barW)/2 + bi*barW
              const by  = padT + chartH - bh
              return (
                <g key={bi}>
                  <rect x={bx} y={by} width={Math.max(barW-1,2)} height={Math.max(bh,1)}
                    fill={b.fill} rx={2}/>
                  {bh > 14 && b.label && (
                    <text x={bx+(barW-1)/2} y={by-3} textAnchor="middle" fontSize={9} fill={b.fill} fontWeight="bold">
                      {fmt(val)}
                    </text>
                  )}
                </g>
              )
            })}
            {/* X축 레이블 */}
            <text x={cx} y={H-4} textAnchor="middle" fontSize={9} fill="#6B7280">
              {String(row.name||row.month||row.yr||di+1).slice(0,6)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── LineChart ────────────────────────────────────────────────
export function LineChart({data=[], children, margin={}}) {
  if(!data||data.length===0) return <div style={{height:40,display:"flex",alignItems:"center",justifyContent:"center",color:"#9CA3AF",fontSize:13}}>데이터 없음</div>

  const lines = []
  const toArr = c => Array.isArray(c)?c.flat():[c]
  toArr(children).filter(Boolean).forEach(c=>{
    if(c?.props?.dataKey) lines.push({
      dataKey: c.props.dataKey,
      stroke:  c.props.stroke || COLORS_DEFAULT[lines.length%COLORS_DEFAULT.length],
      name:    c.props.name||c.props.dataKey,
    })
  })

  if(lines.length===0) {
    const sample = data[0]||{}
    Object.entries(sample).forEach(([k,v])=>{
      if(k!=="name"&&typeof v==="number")
        lines.push({dataKey:k,stroke:COLORS_DEFAULT[lines.length%COLORS_DEFAULT.length],name:k})
    })
  }

  let maxVal=0,minVal=0
  data.forEach(row=>lines.forEach(l=>{const v=row[l.dataKey]||0;if(v>maxVal)maxVal=v;if(v<minVal)minVal=v}))
  if(maxVal===minVal) maxVal=maxVal+1

  const W=400,H=160,padL=35,padR=10,padT=16,padB=24
  const chartW=W-padL-padR, chartH=H-padT-padB
  const xStep = data.length>1 ? chartW/(data.length-1) : chartW

  const toY = v => padT + chartH - ((v-minVal)/(maxVal-minVal))*chartH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"100%"}} preserveAspectRatio="none">
      {[0,0.5,1].map(t=>{
        const y=padT+chartH*(1-t)
        return <g key={t}>
          <line x1={padL} y1={y} x2={W-padR} y2={y} stroke="#E5E7EB" strokeWidth={0.5}/>
          <text x={padL-3} y={y+4} textAnchor="end" fontSize={8} fill="#9CA3AF">{fmt(minVal+(maxVal-minVal)*t)}</text>
        </g>
      })}

      {lines.map((l,li)=>{
        const pts = data.map((row,di)=>`${padL+di*xStep},${toY(row[l.dataKey]||0)}`).join(" ")
        return (
          <g key={li}>
            <polyline points={pts} fill="none" stroke={l.stroke} strokeWidth={2} strokeLinejoin="round"/>
            {data.map((row,di)=>(
              <circle key={di} cx={padL+di*xStep} cy={toY(row[l.dataKey]||0)} r={3} fill={l.stroke}/>
            ))}
          </g>
        )
      })}

      {data.map((row,di)=>(
        <text key={di} x={padL+di*xStep} y={H-4} textAnchor="middle" fontSize={8} fill="#9CA3AF">
          {String(row.name||di+1).slice(0,5)}
        </text>
      ))}
    </svg>
  )
}

// ── ComposedChart (Bar+Line 혼합) ────────────────────────────
export function ComposedChart({data=[], children, margin={}}) {
  if(!data||data.length===0) return <div style={{height:40,display:"flex",alignItems:"center",justifyContent:"center",color:"#9CA3AF",fontSize:13}}>데이터 없음</div>

  const bars=[], lines=[], areas=[]
  const toArr = c => Array.isArray(c)?c.flat():[c]
  toArr(children).filter(Boolean).forEach(c=>{
    if(!c?.props?.dataKey) return
    const t=c.type
    if(t===Bar||String(t).includes("Bar"))     bars.push({dataKey:c.props.dataKey,fill:c.props.fill||COLORS_DEFAULT[bars.length%10],name:c.props.name||c.props.dataKey})
    else if(t===Line||String(t).includes("Line")) lines.push({dataKey:c.props.dataKey,stroke:c.props.stroke||COLORS_DEFAULT[(bars.length+lines.length)%10],name:c.props.name||c.props.dataKey})
    else if(t===Area||String(t).includes("Area")) areas.push({dataKey:c.props.dataKey,fill:c.props.fill||COLORS_DEFAULT[areas.length%10]+"44",stroke:c.props.stroke||COLORS_DEFAULT[areas.length%10],name:c.props.name||c.props.dataKey})
  })

  let maxVal=0
  data.forEach(row=>{
    ;[...bars,...lines,...areas].forEach(b=>{const v=Math.abs(row[b.dataKey]||0);if(v>maxVal)maxVal=v})
  })
  if(maxVal===0) maxVal=1

  const W=400,H=180,padL=35,padR=10,padT=20,padB=28
  const chartW=W-padL-padR, chartH=H-padT-padB
  const groupW=data.length>0?chartW/data.length:chartW
  const barW=Math.max(4,Math.min(36,groupW*0.6/Math.max(bars.length,1)))
  const xStep=data.length>1?chartW/(data.length-1):chartW
  const toY=v=>padT+chartH*(1-Math.abs(v)/maxVal)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"100%"}} preserveAspectRatio="none">
      {[0,0.25,0.5,0.75,1].map(t=>{
        const y=padT+chartH*(1-t)
        return <g key={t}>
          <line x1={padL} y1={y} x2={W-padR} y2={y} stroke="#E5E7EB" strokeWidth={0.5}/>
          <text x={padL-3} y={y+4} textAnchor="end" fontSize={8} fill="#9CA3AF">{fmt(maxVal*t)}</text>
        </g>
      })}

      {/* Bars */}
      {data.map((row,di)=>{
        const cx=padL+groupW*di+groupW/2
        return bars.map((b,bi)=>{
          const val=row[b.dataKey]||0
          const bh=Math.abs(val)/maxVal*chartH
          const bx=cx-(bars.length*barW)/2+bi*barW
          return <rect key={`${di}-${bi}`} x={bx} y={padT+chartH-bh} width={Math.max(barW-1,2)} height={Math.max(bh,1)} fill={b.fill} rx={2}/>
        })
      })}

      {/* Lines */}
      {lines.map((l,li)=>{
        const pts=data.map((row,di)=>`${padL+di*xStep},${toY(row[l.dataKey]||0)}`).join(" ")
        return <polyline key={li} points={pts} fill="none" stroke={l.stroke} strokeWidth={2.5}/>
      })}

      {/* Areas */}
      {areas.map((a,ai)=>{
        const pts=data.map((row,di)=>`${padL+di*xStep},${toY(row[a.dataKey]||0)}`).join(" ")
        const base=padT+chartH
        const first=`${padL},${base}`, last=`${padL+(data.length-1)*xStep},${base}`
        return <polygon key={ai} points={`${first} ${pts} ${last}`} fill={a.fill} stroke={a.stroke} strokeWidth={1.5}/>
      })}

      {/* X Labels */}
      {data.map((row,di)=>(
        <text key={di} x={padL+groupW*di+groupW/2} y={H-4} textAnchor="middle" fontSize={8} fill="#9CA3AF">
          {String(row.name||row.yr||di+1).slice(0,6)}
        </text>
      ))}
    </svg>
  )
}

// ── PieChart ─────────────────────────────────────────────────
export function PieChart({children, width, height}) {
  // Pie 데이터 추출
  let pieData=[], colors=[]
  const toArr = c => Array.isArray(c)?c.flat():[c]
  toArr(children).filter(Boolean).forEach(c=>{
    if(c?.props?.data) { pieData=c.props.data; }
    if(c?.type===Cell||c?.props?.fill) colors.push(c.props?.fill)
  })
  if(!pieData.length) return null

  const W=200,CX=100,CY=90,R=70,IR=30
  let total=pieData.reduce((s,d)=>s+(d.value||0),0)
  if(!total) return null

  let angle=-Math.PI/2
  const slices=pieData.map((d,i)=>{
    const a=(d.value/total)*2*Math.PI
    const x1=CX+R*Math.cos(angle), y1=CY+R*Math.sin(angle)
    const x2=CX+R*Math.cos(angle+a), y2=CY+R*Math.sin(angle+a)
    const xi1=CX+IR*Math.cos(angle), yi1=CY+IR*Math.sin(angle)
    const xi2=CX+IR*Math.cos(angle+a), yi2=CY+IR*Math.sin(angle+a)
    const lg=a>Math.PI?1:0
    const path=`M ${xi1} ${yi1} L ${x1} ${y1} A ${R} ${R} 0 ${lg} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${IR} ${IR} 0 ${lg} 0 ${xi1} ${yi1}`
    const fill=colors[i]||COLORS_DEFAULT[i%COLORS_DEFAULT.length]
    angle+=a
    return {path,fill,name:d.name,value:d.value,pct:Math.round(d.value/total*100)}
  })

  return (
    <svg viewBox={`0 0 ${W} ${W}`} style={{width:"100%",height:"100%"}}>
      {slices.map((s,i)=>(<path key={i} d={s.path} fill={s.fill} stroke="#fff" strokeWidth={1.5}/>))}
      {/* 범례 */}
      {slices.map((s,i)=>(
        <g key={`l${i}`} transform={`translate(8,${160+i*14})`}>
          <rect width={10} height={10} fill={s.fill} rx={2}/>
          <text x={14} y={9} fontSize={9} fill="#374151">{s.name} {s.pct}%</text>
        </g>
      ))}
    </svg>
  )
}

// ── RadarChart ───────────────────────────────────────────────
export function RadarChart({data=[], cx, cy, outerRadius, children}) {
  if(!data.length) return null
  const keys=Object.keys(data[0]).filter(k=>k!=="subject"&&k!=="fullMark")
  const angles=data.map((_,i)=>((i/data.length)*2*Math.PI)-Math.PI/2)
  const R=80,CX=120,CY=100
  const W=240,H=220
  const toXY=(angle,r)=>[CX+r*Math.cos(angle),CY+r*Math.sin(angle)]

  const radarSeries=[]
  const toArr = c => Array.isArray(c)?c.flat():[c]
  toArr(children).filter(Boolean).forEach(c=>{
    if(c?.props?.dataKey) radarSeries.push({dataKey:c.props.dataKey,fill:c.props.fill||COLORS_DEFAULT[radarSeries.length%10]+"44",stroke:c.props.stroke||COLORS_DEFAULT[radarSeries.length%10]})
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"100%"}}>
      {/* 그리드 */}
      {[0.25,0.5,0.75,1].map(t=>{
        const pts=angles.map(a=>toXY(a,R*t).join(",")).join(" ")
        return <polygon key={t} points={pts} fill="none" stroke="#E5E7EB" strokeWidth={0.5}/>
      })}
      {/* 축선 */}
      {angles.map((a,i)=>{
        const [x,y]=toXY(a,R)
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="#E5E7EB" strokeWidth={0.5}/>
      })}
      {/* 레이블 */}
      {data.map((d,i)=>{
        const [x,y]=toXY(angles[i],R+12)
        return <text key={i} x={x} y={y} textAnchor="middle" fontSize={9} fill="#6B7280">{d.subject||""}</text>
      })}
      {/* 데이터 */}
      {radarSeries.map((s,si)=>{
        const max=Math.max(...data.map(d=>d[s.dataKey]||0),1)
        const pts=data.map((d,i)=>toXY(angles[i],R*(d[s.dataKey]||0)/max).join(",")).join(" ")
        return <polygon key={si} points={pts} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} fillOpacity={0.5}/>
      })}
    </svg>
  )
}

// ── Pie (PieChart 내부용 데이터 컨테이너) ─────────────────────
export function Pie({data=[], dataKey="value", nameKey="name", cx, cy, innerRadius, outerRadius, children}) {
  // PieChart가 처리하므로 여기선 props만 전달
  return null
}
