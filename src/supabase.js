// Supabase 클라이언트 설정
// .env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 설정 필요
import { createClient } from '@supabase/supabase-js'

const URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = URL && KEY ? createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
}) : null

export const isSupabaseConfigured = () => !!URL && !!KEY

// ── Auth helpers ──────────────────────────────────────────
export const signInWithGoogle = () =>
  supabase?.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })

export const signInWithEmail = (email, password) =>
  supabase?.auth.signInWithPassword({ email, password })

export const signOut = () => supabase?.auth.signOut()
export const getSession = () => supabase?.auth.getSession()
export const onAuthChange = (cb) => supabase?.auth.onAuthStateChange(cb)

// ── Storage helpers ───────────────────────────────────────
export const BUCKET = 'sjs-archive'

export const uploadFile = async (file, path) => {
  if (!supabase) return null
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return publicUrl
}

export const deleteFile = async (path) => {
  if (!supabase) return
  await supabase.storage.from(BUCKET).remove([path])
}

export const getFileUrl = (path) =>
  supabase?.storage.from(BUCKET).getPublicUrl(path).data.publicUrl || ''

// ── DB helpers ────────────────────────────────────────────
export const db = {
  // 프로젝트
  getProjects:   ()       => supabase?.from('projects').select('*').order('created_at',{ascending:false}),
  getProject:    (id)     => supabase?.from('projects').select(`*, project_versions(*, project_vendors(*)), archive_items(*)`).eq('id',id).single(),
  upsertProject: (data)   => supabase?.from('projects').upsert(data),
  deleteProject: (id)     => supabase?.from('projects').delete().eq('id',id),

  // 버전
  getVersions:   (projId) => supabase?.from('project_versions').select(`*, project_vendors(*)`).eq('project_id',projId).order('created_at'),
  upsertVersion: (data)   => supabase?.from('project_versions').upsert(data),

  // 협력업체
  upsertVendors: (rows)   => supabase?.from('project_vendors').upsert(rows),
  deleteVendors: (verId)  => supabase?.from('project_vendors').delete().eq('version_id',verId),

  // 기성수금
  getCashflow:   (year)   => supabase?.from('cashflow').select('*').eq('year',year).order('month'),
  upsertCashflow:(data)   => supabase?.from('cashflow').upsert(data, {onConflict:'year,month,dept'}),

  // 손익
  getPnl:        (year)   => supabase?.from('pnl_monthly').select('*').eq('year',year).order('month'),
  upsertPnl:     (data)   => supabase?.from('pnl_monthly').upsert(data, {onConflict:'year,month,dept'}),

  // 아카이브
  getArchive:    (filters={}) => {
    let q = supabase?.from('archive_items').select('*').order('created_at',{ascending:false})
    if (filters.category)   q = q.eq('category', filters.category)
    if (filters.project_id) q = q.eq('project_id', filters.project_id)
    if (filters.dept)       q = q.eq('dept', filters.dept)
    if (filters.search)     q = q.textSearch('search_vector', filters.search, {config:'simple'})
    return q
  },
  upsertArchive: (data)   => supabase?.from('archive_items').upsert(data),
  deleteArchive: (id)     => supabase?.from('archive_items').delete().eq('id',id),

  // 인사
  getStaff:      ()       => supabase?.from('staff').select('*').eq('is_active',true).order('dept'),

  // 연도 집계
  getYearly:     ()       => supabase?.from('yearly_summary').select('*').order('year'),
  upsertYearly:  (data)   => supabase?.from('yearly_summary').upsert(data, {onConflict:'year'}),

  // 사용자
  getUsers:      ()       => supabase?.from('user_profiles').select('*').order('dept'),
  updateUser:    (id,data)=> supabase?.from('user_profiles').update(data).eq('id',id),

  // 실시간
  subscribeProjects: (cb) =>
    supabase?.channel('projects').on('postgres_changes',{event:'*',schema:'public',table:'projects'},cb).subscribe(),
  subscribeArchive: (cb) =>
    supabase?.channel('archive').on('postgres_changes',{event:'*',schema:'public',table:'archive_items'},cb).subscribe(),
}

export default supabase
