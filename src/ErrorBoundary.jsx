import React from 'react'

// ══════════════════════════════════════════════════════════════
// 🛡 전역 에러 바운더리 — 에러 발생 시 흰 화면 대신 복구 UI 표시
// ══════════════════════════════════════════════════════════════
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    // 에러 로그 localStorage 저장 (최근 10건)
    try {
      const logs = JSON.parse(localStorage.getItem('sjs_error_logs') || '[]')
      logs.unshift({
        time: new Date().toISOString(),
        message: error?.message || String(error),
        stack: (error?.stack || '').slice(0, 500),
        component: (errorInfo?.componentStack || '').slice(0, 300),
      })
      localStorage.setItem('sjs_error_logs', JSON.stringify(logs.slice(0, 10)))
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || String(this.state.error)
      return (
        <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8FAFC',padding:20,fontFamily:'system-ui,-apple-system,sans-serif'}}>
          <div style={{maxWidth:560,width:'100%',background:'#fff',borderRadius:16,border:'1px solid #E5E7EB',padding:'32px 28px',boxShadow:'0 4px 24px rgba(0,0,0,.08)'}}>
            <div style={{fontSize:40,marginBottom:12}}>🛠️</div>
            <div style={{fontSize:19,fontWeight:800,color:'#111827',marginBottom:8}}>
              일시적인 오류가 발생했습니다
            </div>
            <div style={{fontSize:13.5,color:'#6B7280',lineHeight:1.7,marginBottom:16}}>
              데이터는 안전하게 보관되어 있습니다. 아래 버튼으로 복구를 시도해주세요.
            </div>
            <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'10px 14px',marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:700,color:'#DC2626',marginBottom:4}}>오류 내용 (관리자 전달용)</div>
              <div style={{fontSize:12,color:'#7F1D1D',fontFamily:'monospace',wordBreak:'break-all'}}>{msg}</div>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={()=>window.location.reload()}
                style={{flex:1,minWidth:140,padding:'12px',background:'#185FA5',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                🔄 새로고침
              </button>
              <button onClick={()=>{
                if(!window.confirm('화면 설정(탭 순서 등)만 초기화합니다.\n업무 데이터는 유지됩니다. 계속할까요?')) return
                try {
                  localStorage.removeItem('sjs_tab_order')
                  localStorage.removeItem('sjs_tab_groups')
                  localStorage.removeItem('sjs_hub_favorites')
                } catch {}
                window.location.reload()
              }}
                style={{flex:1,minWidth:140,padding:'12px',background:'#F3F4F6',color:'#374151',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                ⚙️ 화면설정 초기화 후 재시작
              </button>
            </div>
            <div style={{marginTop:14,fontSize:11.5,color:'#9CA3AF',lineHeight:1.6}}>
              계속 반복되면 관리자에게 위 오류 내용을 전달해주세요.<br/>
              (설정 → 데이터관리 → 백업에서 데이터를 내보낼 수 있습니다)
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
