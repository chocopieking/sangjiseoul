-- ══════════════════════════════════════════════════════════════
-- 상지서울 통합경영시스템 v2 — Supabase DB 스키마
-- Supabase 대시보드 > SQL Editor에서 실행하세요.
-- ══════════════════════════════════════════════════════════════

-- ── 1. app_data 테이블 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_data (
  id         BIGSERIAL PRIMARY KEY,
  org_id     TEXT NOT NULL DEFAULT 'sjs',
  key        TEXT NOT NULL,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TIMESTAMPTZ,
  UNIQUE(org_id, key)
);

-- ── 2. updated_at 자동 갱신 트리거 ───────────────────────────
CREATE OR REPLACE FUNCTION update_app_data_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_data_updated_at ON app_data;

CREATE TRIGGER app_data_updated_at
  BEFORE INSERT OR UPDATE ON app_data
  FOR EACH ROW EXECUTE FUNCTION update_app_data_ts();

-- ── 3. RLS ────────────────────────────────────────────────────
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_all"           ON app_data;
DROP POLICY IF EXISTS "write_authenticated" ON app_data;

CREATE POLICY "read_all"  ON app_data FOR SELECT USING (true);
CREATE POLICY "write_all" ON app_data FOR ALL    USING (true) WITH CHECK (true);

-- ── 4. 초기 데이터 ───────────────────────────────────────────
INSERT INTO app_data (org_id, key, value) VALUES
  ('sjs','sjs_projects',         '[]'),
  ('sjs','sjs_pnl',              '{}'),
  ('sjs','sjs_years',            '[]'),
  ('sjs','sjs_cashflow',         '[]'),
  ('sjs','sjs_dept_staff',       '{}'),
  ('sjs','sjs_staff_target',     '{}'),
  ('sjs','sjs_staff_monthly',    '{}'),
  ('sjs','sjs_departments',      '[]'),
  ('sjs','sjs_dept_biz',         '{}'),
  ('sjs','sjs_vendors',          '{}'),
  ('sjs','sjs_vendor_payments',  '[]'),
  ('sjs','sjs_contract_types',   '["턴키","BTL","공공","민간","감리","해외","기타"]'),
  ('sjs','sjs_versions',         '[]')
ON CONFLICT (org_id, key) DO NOTHING;
