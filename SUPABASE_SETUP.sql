-- ══════════════════════════════════════════════════════
-- 상지서울 통합경영시스템 — Supabase DB 스키마
-- sogum25@gmail.com 계정으로 실행
-- ══════════════════════════════════════════════════════

-- ── 확장 ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 한국어 검색용

-- ════════════════════════════════════════════════════
-- 1. 사용자 프로필 & 권한
-- ════════════════════════════════════════════════════
CREATE TABLE user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  dept          TEXT,  -- '설계1본부'|'설계2본부'|'디자인본부'|'주거디자인본부'|'해외사업부'|'경영지원'
  role          TEXT DEFAULT 'viewer' CHECK (role IN ('master','admin','executive','viewer')),
  can_write     BOOLEAN DEFAULT false,
  can_manage_users BOOLEAN DEFAULT false,
  avatar_url    TEXT,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 프로필 자동 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ════════════════════════════════════════════════════
-- 2. 프로젝트
-- ════════════════════════════════════════════════════
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  year          INT,
  depts         TEXT[] NOT NULL DEFAULT '{}',  -- 주관 본부 (복수)
  pm            TEXT,
  director      TEXT,
  proj_type     TEXT,
  usage_type    TEXT,
  scale         TEXT,
  site_area_m2  NUMERIC,  -- 대지면적 ㎡
  build_area_m2 NUMERIC,  -- 건축면적 ㎡
  floor_area_m2 NUMERIC,  -- 연면적 ㎡
  units         INT DEFAULT 0,  -- 세대수 (주거만)
  client        TEXT,
  client_pm     TEXT,
  -- 비용 (VAT별도 기준 — 계약은 무조건 VAT별도)
  total_fee     BIGINT,  -- 총설계비 (원, VAT별도)
  share_ratio   NUMERIC DEFAULT 1.0,  -- 상지지분 0~1
  service_fee   BIGINT,  -- 용역비 (원, VAT별도)
  -- 계약·수주
  contract_date DATE,
  order_date    DATE,  -- 계약금 10% 수령일 = 수주일 (내규)
  status        TEXT DEFAULT '추진' CHECK (status IN ('계약','확정','추진','기성','완료','취소')),
  prog_pct      INT DEFAULT 0,  -- 진행률 0~100
  acc_billing   NUMERIC DEFAULT 0,  -- 누계기성 억원
  rev_2026      NUMERIC DEFAULT 0,  -- 2026 예상기성
  pub_type      TEXT DEFAULT '공공' CHECK (pub_type IN ('공공','민간')),
  address       TEXT,
  note          TEXT,
  tags          TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  created_by    UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 프로젝트 업데이트 시각 자동갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS: 본부별 접근 제어 ──
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 읽기: 자기 본부 프로젝트 OR 관리자
CREATE POLICY "project_read" ON projects FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (
      role IN ('master','admin')
      OR dept = ANY(projects.depts)
      OR role = 'executive'  -- 임원은 전체 열람
    )
    AND active = true
  )
);

-- 쓰기: 해당 본부 + can_write OR 관리자
CREATE POLICY "project_write" ON projects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE id=auth.uid() AND (role IN ('master','admin') OR (dept = ANY(depts) AND can_write=true)) AND active=true)
);
CREATE POLICY "project_update" ON projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id=auth.uid() AND (role IN ('master','admin') OR (dept = ANY(projects.depts) AND can_write=true)) AND active=true)
);

-- ════════════════════════════════════════════════════
-- 3. 실행계획서 버전
-- ════════════════════════════════════════════════════
CREATE TABLE project_versions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  version_name  TEXT NOT NULL,  -- 'v1.0 최초', 'v2.0 1차변경' 등
  version_date  DATE,
  reason        TEXT,
  labor_cost    BIGINT DEFAULT 0,
  direct_exp    BIGINT DEFAULT 0,
  sub_contract  BIGINT DEFAULT 0,
  indirect      BIGINT,
  profit        BIGINT,
  created_by    UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "version_read" ON project_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects p JOIN user_profiles u ON u.id=auth.uid()
    WHERE p.id=project_id AND (u.role IN ('master','admin') OR u.dept=ANY(p.depts) OR u.role='executive') AND u.active=true)
);
CREATE POLICY "version_write" ON project_versions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects p JOIN user_profiles u ON u.id=auth.uid()
    WHERE p.id=project_id AND (u.role IN ('master','admin') OR (u.dept=ANY(p.depts) AND u.can_write=true)) AND u.active=true)
);

-- ════════════════════════════════════════════════════
-- 4. 협력업체 비용 (VAT 분리)
-- ════════════════════════════════════════════════════
CREATE TABLE project_vendors (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id    UUID REFERENCES project_versions(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  cat           TEXT NOT NULL,  -- 분야 (구조, 토목, 조경...)
  vendor_name   TEXT NOT NULL,
  -- VAT별도 금액 (원)
  contract_excl BIGINT DEFAULT 0,  -- 원가견적 (VAT별도)
  nego1_excl    BIGINT DEFAULT 0,  -- 1차NEGO (VAT별도)
  nego2_excl    BIGINT DEFAULT 0,  -- 2차NEGO (VAT별도)
  -- VAT 처리
  vat_type      TEXT DEFAULT 'taxable' CHECK (vat_type IN ('taxable','exempt','partial')),
  -- taxable=과세(10%), exempt=면세(0%), partial=혼합
  vat_ratio     NUMERIC DEFAULT 1.0,  -- partial일 때 과세 비율
  -- 계산 컬럼 (자동)
  contract_vat  BIGINT GENERATED ALWAYS AS (
    CASE vat_type
      WHEN 'taxable' THEN ROUND(contract_excl * 0.1)
      WHEN 'partial' THEN ROUND(contract_excl * vat_ratio * 0.1)
      ELSE 0
    END
  ) STORED,
  contract_incl BIGINT GENERATED ALWAYS AS (
    CASE vat_type
      WHEN 'taxable' THEN ROUND(contract_excl * 1.1)
      WHEN 'partial' THEN contract_excl + ROUND(contract_excl * vat_ratio * 0.1)
      ELSE contract_excl
    END
  ) STORED,
  area_basis    TEXT DEFAULT '연면적' CHECK (area_basis IN ('연면적','대지면적','1식')),
  sort_order    INT DEFAULT 0,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE project_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor_read" ON project_vendors FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects p JOIN user_profiles u ON u.id=auth.uid()
    WHERE p.id=project_id AND (u.role IN ('master','admin') OR u.dept=ANY(p.depts) OR u.role='executive') AND u.active=true)
);

-- ════════════════════════════════════════════════════
-- 5. 월별 기성수금
-- ════════════════════════════════════════════════════
CREATE TABLE cashflow (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year          INT NOT NULL,
  month         INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  dept          TEXT,  -- NULL이면 전사 합계
  cash_amt      NUMERIC DEFAULT 0,   -- 현금 (VAT포함, 억원)
  note_amt      NUMERIC DEFAULT 0,   -- 어음 (VAT포함, 억원)
  blue_amt      NUMERIC DEFAULT 0,   -- 민간위험
  is_actual     BOOLEAN DEFAULT false,
  memo          TEXT,
  UNIQUE(year, month, dept)
);

ALTER TABLE cashflow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cashflow_read" ON cashflow FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id=auth.uid() AND active=true)
);
CREATE POLICY "cashflow_write" ON cashflow FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id=auth.uid() AND role IN ('master','admin') AND active=true)
);

-- ════════════════════════════════════════════════════
-- 6. 월별 손익 (부서별)
-- ════════════════════════════════════════════════════
CREATE TABLE pnl_monthly (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year          INT NOT NULL,
  month         INT NOT NULL,
  dept          TEXT,  -- NULL=전사
  -- 매출 (VAT포함)
  revenue       NUMERIC DEFAULT 0,
  -- 인건비
  salary        NUMERIC DEFAULT 0,   -- 급여
  overtime      NUMERIC DEFAULT 0,   -- 야근보조금
  other_labor   NUMERIC DEFAULT 0,   -- 기타인건비
  -- 외주비 (VAT별도 기준으로 입력, 계산은 vat_type으로)
  sub_direct    NUMERIC DEFAULT 0,   -- 직접외주비 (VAT별도)
  sub_direct_vat_type TEXT DEFAULT 'taxable',
  sub_settle    NUMERIC DEFAULT 0,   -- 외주정산금 (VAT별도)
  sub_settle_vat_type TEXT DEFAULT 'taxable',
  -- 경비
  expense       NUMERIC DEFAULT 0,
  biz_expense   NUMERIC DEFAULT 0,   -- 업무추진비
  fixed_exp     NUMERIC DEFAULT 0,   -- 집기여비
  misc_exp      NUMERIC DEFAULT 0,   -- 기타경비
  -- 공동비
  shared_cost   NUMERIC DEFAULT 0,
  is_confirmed  BOOLEAN DEFAULT false,  -- 결산 확정 여부
  UNIQUE(year, month, dept)
);

ALTER TABLE pnl_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pnl_read" ON pnl_monthly FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id=auth.uid()
    AND (role IN ('master','admin','executive') OR (dept IS NULL OR dept = (SELECT u.dept FROM user_profiles u WHERE u.id=auth.uid()))) AND active=true)
);
CREATE POLICY "pnl_write" ON pnl_monthly FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id=auth.uid() AND (role IN ('master','admin') OR can_write=true) AND active=true)
);

-- ════════════════════════════════════════════════════
-- 7. 직원 (인사)
-- ════════════════════════════════════════════════════
CREATE TABLE staff (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES user_profiles(id),
  name          TEXT NOT NULL,
  dept          TEXT,
  position      TEXT,  -- 직책
  rank          TEXT,  -- 직급
  email         TEXT,
  join_date     DATE,
  leave_date    DATE,
  is_active     BOOLEAN DEFAULT true,
  specialties   TEXT[] DEFAULT '{}',  -- 전문분야 태그
  licenses      TEXT[] DEFAULT '{}',  -- 자격증
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════
-- 8. 아카이브 (핵심: 프로젝트 문서·도면·계약서)
-- ════════════════════════════════════════════════════
CREATE TABLE archive_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL CHECK (category IN (
    '계약서','도면','사진','회의록','보고서','견적서','인허가','설계안전','기타'
  )),
  project_id    UUID REFERENCES projects(id),  -- 연결 프로젝트 (선택)
  dept          TEXT,  -- 담당 본부
  file_url      TEXT,  -- Supabase Storage URL
  file_type     TEXT,  -- 'pdf','dwg','xlsx','jpg','png'...
  file_size_kb  INT,
  thumbnail_url TEXT,  -- 미리보기 이미지
  tags          TEXT[] DEFAULT '{}',
  date_created  DATE,
  version       TEXT DEFAULT '1.0',
  is_public     BOOLEAN DEFAULT false,  -- 전체 공개 여부
  created_by    UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  -- 전문 검색용
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', COALESCE(title,'') || ' ' || COALESCE(description,'') || ' ' || COALESCE(array_to_string(tags,' '),''))
  ) STORED
);

CREATE INDEX archive_search_idx ON archive_items USING GIN(search_vector);
CREATE INDEX archive_project_idx ON archive_items(project_id);
CREATE INDEX archive_category_idx ON archive_items(category);

ALTER TABLE archive_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "archive_read" ON archive_items FOR SELECT USING (
  is_public = true OR
  EXISTS (SELECT 1 FROM user_profiles u WHERE u.id=auth.uid()
    AND (u.role IN ('master','admin','executive')
      OR u.dept = archive_items.dept
      OR (project_id IS NOT NULL AND u.dept = ANY(
        SELECT unnest(depts) FROM projects WHERE id=archive_items.project_id
      ))
    ) AND u.active=true)
);
CREATE POLICY "archive_write" ON archive_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE id=auth.uid() AND (role IN ('master','admin') OR can_write=true) AND active=true)
);

-- ════════════════════════════════════════════════════
-- 9. 3개년 집계
-- ════════════════════════════════════════════════════
CREATE TABLE yearly_summary (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year          INT UNIQUE NOT NULL,
  order_target  NUMERIC,
  order_actual  NUMERIC,
  revenue_target NUMERIC,
  revenue_actual NUMERIC,
  avg_staff     NUMERIC,
  is_confirmed  BOOLEAN DEFAULT false,
  note          TEXT
);

-- ════════════════════════════════════════════════════
-- 10. 본부별 인원 현황
-- ════════════════════════════════════════════════════
CREATE TABLE dept_headcount (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year       INT NOT NULL,
  month      INT NOT NULL,
  dept       TEXT NOT NULL,
  headcount  NUMERIC NOT NULL,
  UNIQUE(year, month, dept)
);

-- ════════════════════════════════════════════════════
-- 초기 데이터 시드 (관리자 역할)
-- ════════════════════════════════════════════════════
-- user_profiles는 Auth 가입 후 자동 생성
-- 아래 함수로 역할 부여
CREATE OR REPLACE FUNCTION set_user_role(user_email TEXT, user_role TEXT, user_dept TEXT)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles SET role=user_role, dept=user_dept,
    can_write=(user_role IN ('master','admin','executive')),
    can_manage_users=(user_role IN ('master','admin'))
  WHERE email=user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- sogum25@gmail.com → master 권한 (최초 가입 후 실행)
-- SELECT set_user_role('sogum25@gmail.com', 'master', '경영지원');

