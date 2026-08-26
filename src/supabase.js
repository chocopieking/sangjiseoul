// ══════════════════════════════════════════════════════════════
// Supabase 연동 — 키-값 방식 (app_data 테이블)
// 환경변수: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// ══════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'

const SB_URL = (import.meta.env.VITE_SUPABASE_URL  || '').trim()
const SB_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
const ORG_ID = 'sjs'

export const supabase = SB_URL && SB_KEY
  ? createClient(SB_URL, SB_KEY, { auth:{ persistSession:true, autoRefreshToken:true } })
  : null

export const isConfigured = () => !!(SB_URL && SB_KEY)

// ── 단일 키 읽기 ──────────────────────────────────────────────
export async function dbGet(key) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('app_data')
    .select('value')
    .eq('org_id', ORG_ID)
    .eq('key', key)
    .single()
  if (error) { console.warn(`dbGet(${key}):`, error.message); return null }
  return data?.value ?? null
}

// ── 단일 키 저장 (upsert) ─────────────────────────────────────
export async function dbSet(key, value, updatedBy = '') {
  if (!supabase) return false
  const { error } = await supabase
    .from('app_data')
    .upsert({ org_id: ORG_ID, key, value, updated_by: updatedBy },
             { onConflict: 'org_id,key' })
  if (error) { console.warn(`dbSet(${key}):`, error.message); return false }
  return true
}

// ── 전체 데이터 한 번에 읽기 (앱 초기 로드용) ─────────────────
export async function dbGetAll() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('app_data')
    .select('key,value')
    .eq('org_id', ORG_ID)
  if (error) { console.warn('dbGetAll:', error.message); return null }
  return Object.fromEntries((data||[]).map(r => [r.key, r.value]))
}

// ── 접두어로 시작하는 모든 행을 {key: value} 형태로 한 번에 읽기 ──
// (프로젝트를 "행 1개 = 통짜 배열"이 아니라 "행 1개 = 프로젝트 1건"으로 나눠 저장할 때 사용)
export async function dbGetAllByPrefix(prefix) {
  if (!supabase) return {}
  const { data, error } = await supabase
    .from('app_data')
    .select('key,value')
    .eq('org_id', ORG_ID)
    .like('key', `${prefix}%`)
  if (error) { console.warn(`dbGetAllByPrefix(${prefix}):`, error.message); return {} }
  return Object.fromEntries((data||[]).map(r => [r.key, r.value]))
}

// ── 전체 데이터 한 번에 쓰기 (백업 복구용) ────────────────────
export async function dbSetAll(entries, updatedBy = '') {
  if (!supabase) return false
  const rows = Object.entries(entries).map(([key, value]) => ({
    org_id: ORG_ID, key, value, updated_by: updatedBy
  }))
  const { error } = await supabase
    .from('app_data')
    .upsert(rows, { onConflict: 'org_id,key' })
  if (error) { console.warn('dbSetAll:', error.message); return false }
  return true
}

// ── 특정 접두어로 시작하는 키 목록 조회 (자동 백업 스냅샷 등) ──
export async function dbListKeys(prefix) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('app_data')
    .select('key,updated_at,updated_by')
    .eq('org_id', ORG_ID)
    .like('key', `${prefix}%`)
    .order('key', { ascending: false })
  if (error) { console.warn('dbListKeys:', error.message); return [] }
  return data || []
}

// ── 키 삭제 (오래된 자동 백업 정리용) ─────────────────────────
export async function dbDeleteKey(key) {
  if (!supabase) return false
  const { error } = await supabase
    .from('app_data')
    .delete()
    .eq('org_id', ORG_ID)
    .eq('key', key)
  if (error) { console.warn(`dbDeleteKey(${key}):`, error.message); return false }
  return true
}

// ── 실시간 구독 (다른 사용자 변경 즉시 반영) ──────────────────
// onUpdate(key, value, eventType) — eventType: 'INSERT' | 'UPDATE' | 'DELETE'
// (DELETE 이벤트에는 payload.old만 있고 value가 없을 수 있어 key만 넘어올 수 있음)
export function subscribeChanges(onUpdate) {
  if (!supabase) return ()=>{}
  const channel = supabase
    .channel('app_data_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'app_data',
      filter: `org_id=eq.${ORG_ID}`
    }, payload => {
      if(payload.eventType === 'DELETE') onUpdate(payload.old?.key, undefined, 'DELETE')
      else onUpdate(payload.new.key, payload.new.value, payload.eventType)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ── Auth helpers ──────────────────────────────────────────────
export const signInWithGoogle = () =>
  supabase?.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })

export const signInWithEmail = (email, pw) =>
  supabase?.auth.signInWithPassword({ email, password: pw })

export const signOut = () => supabase?.auth.signOut()
export const getSession = () => supabase?.auth.getSession()
export const onAuthChange = cb => supabase?.auth.onAuthStateChange(cb)

export default supabase

// ── 하위 호환 — Archive.jsx 등에서 사용 ──────────────────────
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

// db 객체 (Archive.jsx 호환)
export const db = {
  getArchive: (filters={}) => {
    if (!supabase) return null
    let q = supabase.from('archive_items').select('*').order('created_at',{ascending:false})
    if (filters.category)   q = q.eq('category', filters.category)
    if (filters.project_id) q = q.eq('project_id', filters.project_id)
    if (filters.dept)       q = q.eq('dept', filters.dept)
    return q
  },
  upsertArchive: (data) => supabase?.from('archive_items').upsert(data),
  deleteArchive: (id)   => supabase?.from('archive_items').delete().eq('id', id),
  getUsers:      ()     => supabase?.from('user_profiles').select('*').order('dept'),
  updateUser:    (id,d) => supabase?.from('user_profiles').update(d).eq('id', id),
}
