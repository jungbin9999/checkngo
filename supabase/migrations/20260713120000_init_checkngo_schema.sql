-- 체크앤고 초기 스키마: profiles / policies / scraps
-- 근거: docs/프로젝트_로드맵.md "데이터 구조 설계" · "정책 정의서(필터링/매칭 로직)"
-- 주의: 이 파일은 Supabase 대시보드 SQL 에디터에서 직접 검토/실행하기 위한 것.
--       (자동 실행 안 함)

-- =========================================
-- 1. Enum 타입 (프로필 단일선택 필드)
-- =========================================
create type employment_status as enum ('재직자', '자영업자·프리랜서', '미취업자', '기타');
create type income_level as enum ('100만원미만', '100~200', '200~300', '300초과', '모름');
create type housing_type as enum ('자가', '전세', '월세', '무상거주');
create type policy_category as enum ('국가단위', '지역단위(서울)');
create type deadline_type as enum ('회차마감', '상시');
create type scrap_status as enum ('진행중', '신청완료');

-- =========================================
-- 2. profiles — Supabase Auth(auth.users)와 1:1 연결
--    age_range는 저장하지 않음. birth_date에서 앱이 고정 기준일(2026-08-15) 기준으로 계산.
-- =========================================
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  birth_date date,
  employment_status employment_status,
  income_level income_level,
  housing_type housing_type,
  region text,
  created_at timestamptz not null default now()
);

-- =========================================
-- 3. policies
--    *_condition 배열은 각 항목의 표준 어휘 + 센티넬 '제한없음'을 담는다.
--    (정책정의서: "제한없음"은 항상 단독값으로만 입력)
-- =========================================
create table policies (
  policy_id text primary key,
  policy_group_id text not null,                     -- 상시형은 policy_id와 동일값
  round_label text,                                  -- 회차 라벨 (상시형은 null)
  title text not null,
  category policy_category not null,
  deadline_type deadline_type not null,
  deadline date,                                     -- 상시형은 null
  age_condition text[] not null default '{}',        -- 19~24 / 25~29 / 30~34 / 35~39 / 제한없음
  employment_condition text[] not null default '{}', -- 재직자 / 자영업자·프리랜서 / 미취업자 / 기타 / 제한없음
  has_income_condition boolean not null default false,
  housing_condition text[],                          -- 자가 / 전세 / 월세 / 무상거주 / 제한없음 (null 허용)
  required_documents text[] not null default '{}',
  apply_url text,
  description text,                                   -- 소득기준 원문 등 비구조화 세부조건 포함
  source text,
  created_at timestamptz not null default now()
);

-- 마감임박순 정렬용
create index policies_deadline_idx on policies (deadline);

-- =========================================
-- 4. scraps — 사용자-정책 관계 (체크리스트/알림/신청상태)
-- =========================================
create table scraps (
  scrap_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  policy_id text not null references policies (policy_id) on delete cascade,
  checklist_status jsonb not null default '{}',      -- 서류별 체크 여부
  status scrap_status not null default '진행중',
  notification_on boolean not null default true,     -- 개별 정책 알림 on/off
  scrapped_at timestamptz not null default now(),
  unique (user_id, policy_id)                        -- 같은 정책 중복 스크랩 방지
);

create index scraps_user_id_idx on scraps (user_id);

-- =========================================
-- 5. RLS (Row Level Security)
-- =========================================

-- profiles: 본인 행만 접근 (id = 로그인 사용자)
alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());
create policy "profiles_insert_own" on profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_delete_own" on profiles
  for delete using (id = auth.uid());

-- policies: 전체 읽기 공개(비로그인 포함). 쓰기 정책 없음
--   → 클라이언트 쓰기 차단, 배치 동기화는 service_role(RLS 우회)로만 수행
alter table policies enable row level security;

create policy "policies_select_all" on policies
  for select using (true);

-- scraps: 본인 행만 접근 (user_id = 로그인 사용자)
alter table scraps enable row level security;

create policy "scraps_select_own" on scraps
  for select using (user_id = auth.uid());
create policy "scraps_insert_own" on scraps
  for insert with check (user_id = auth.uid());
create policy "scraps_update_own" on scraps
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "scraps_delete_own" on scraps
  for delete using (user_id = auth.uid());
