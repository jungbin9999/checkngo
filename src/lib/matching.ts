// 체크앤고 정책 매칭 로직
// 근거: docs/프로젝트_로드맵.md "정책 정의서(필터링/매칭 로직)"
//   - 1. 필드별 매칭 규칙 / 소득 매칭 규칙
//   - 2. 전체 결합 규칙(AND, 제한없음 자동 통과)
//   - 3. 예외 처리 규칙(준비중, 나이 범위, 초기화, 기준일 고정)
//   - 소득 배지·하단 배치
// 타입은 Supabase 테이블 행(snake_case)을 그대로 받도록 맞춤.

import { supabase } from './supabase';

// 기준일 고정(freeze): 마감 여부·나이 계산 등 "오늘"이 필요한 곳은 실제 시스템 날짜(new Date()) 대신
// 이 상수를 사용한다. (CLAUDE.md "기준일 고정" 규칙)
export const REFERENCE_DATE = '2026-08-15';

// "제한없음" 센티넬. 조건 배열에 이 값이 있으면 해당 필드는 자동 통과.
export const UNRESTRICTED = '제한없음';

// ---- 도메인 값 타입 ----
export type AgeRange = '19~24' | '25~29' | '30~34' | '35~39';
export type EmploymentStatus = '재직자' | '자영업자·프리랜서' | '미취업자' | '기타';
export type IncomeLevel = '100만원미만' | '100~200' | '200~300' | '300초과' | '모름';
export type HousingType = '자가' | '전세' | '월세' | '무상거주';
export type PolicyCategory = '국가단위' | '지역단위(서울)';
export type DeadlineType = '회차마감' | '상시';

// 사용자 프로필 (profiles 테이블 행)
export interface UserProfile {
  birth_date: string; // 'YYYY-MM-DD' — 나이는 여기서 계산(프론트에서 구간 직접 선택 금지)
  employment_status: EmploymentStatus;
  income_level: IncomeLevel;
  housing_type: HousingType;
  region: string; // 시/도. 서울 여부로 지역 정책 분기
}

// 정책 (policies 테이블 행)
export interface Policy {
  policy_id: string;
  policy_group_id: string;
  round_label: string | null;
  title: string;
  category: PolicyCategory;
  deadline_type: DeadlineType;
  deadline: string | null; // 'YYYY-MM-DD', 상시형은 null
  age_condition: string[];
  employment_condition: string[];
  has_income_condition: boolean;
  housing_condition: string[] | null;
  required_documents: string[];
  apply_url: string;
  description: string;
  source: string;
}

// 소득 배지 (소득 매칭 규칙 결과)
export type IncomeBadge =
  | { level: 'none' } // 배지 없음(안전권 또는 소득조건 없는 정책)
  | { level: 'check'; label: string } // 소득 "모름"
  | { level: 'caution'; label: string } // 200~300 경계 구간
  | { level: 'warning'; label: string }; // 300초과 강한 경고

// 매칭 상태: matched(매칭 성공) / pending_region(준비중 - 지역 미지원) / excluded(미노출)
export type MatchStatus = 'matched' | 'pending_region' | 'excluded';

export interface MatchResult {
  policy: Policy;
  status: MatchStatus;
  incomeBadge: IncomeBadge;
  demote: boolean; // 300초과 → 목록 하단 배치
}

export interface MatchGroups {
  matched: MatchResult[]; // 매칭 성공 (기본순 정렬 적용)
  pendingRegion: MatchResult[]; // 준비중(서울 정책이지만 거주지역이 서울 아님)
  excluded: MatchResult[]; // 미노출
}

// ------------------------------------------------------------------
// 나이 계산: 생년월일 → 만 나이 → 구간. 기준일(2026-08-15)로 계산(기준일 고정).
// 19~39 범위 밖이면 null → 매칭 결과 0건(빈 상태) 처리.
// ------------------------------------------------------------------
export function computeAgeRange(
  birthDate: string,
  referenceDate: string = REFERENCE_DATE,
): AgeRange | null {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ry, rm, rd] = referenceDate.split('-').map(Number);
  let age = ry - by;
  // 기준일 기준으로 아직 생일이 지나지 않았으면 한 살 뺀다.
  if (rm < bm || (rm === bm && rd < bd)) age -= 1;

  if (age >= 19 && age <= 24) return '19~24';
  if (age >= 25 && age <= 29) return '25~29';
  if (age >= 30 && age <= 34) return '30~34';
  if (age >= 35 && age <= 39) return '35~39';
  return null;
}

// ------------------------------------------------------------------
// 배열 조건 통과 판정 (나이/취업/주거 공통)
// 규칙: 조건이 없거나(null) "제한없음"을 포함하면 자동 통과.
//       안전장치로 "제한없음"이 다른 값과 섞여 있어도 "제한없음"을 우선 적용.
// ------------------------------------------------------------------
export function passesArrayCondition(
  condition: string[] | null,
  userValue: string,
): boolean {
  if (condition == null) return true;
  if (condition.includes(UNRESTRICTED)) return true;
  return condition.includes(userValue);
}

// ------------------------------------------------------------------
// 소득 매칭 규칙: 소득은 "제외"하지 않고 항상 통과시키되 배지/하단배치만 결정.
//   100미만·100~200 → 안전권(배지 없음)
//   200~300         → 경계(직접확인)
//   300초과         → 강한 경고 + 하단 배치(정직 입력이 "모름"보다 불리해지는 역설 방지)
//   모름            → 직접확인
//   소득조건 없는 정책(has_income_condition=false) → 항상 통과, 배지 없음
// ------------------------------------------------------------------
export function evaluateIncome(
  policy: Policy,
  income: IncomeLevel,
): { badge: IncomeBadge; demote: boolean } {
  if (!policy.has_income_condition) {
    return { badge: { level: 'none' }, demote: false };
  }
  switch (income) {
    case '100만원미만':
    case '100~200':
      return { badge: { level: 'none' }, demote: false };
    case '200~300':
      return {
        badge: { level: 'caution', label: '소득기준 초과 가능성 있음 - 직접확인' },
        demote: false,
      };
    case '300초과':
      return {
        badge: { level: 'warning', label: '소득기준 초과 가능성 높음 - 직접확인' },
        demote: true,
      };
    case '모름':
      return { badge: { level: 'check', label: '직접확인' }, demote: false };
  }
}

// ------------------------------------------------------------------
// 단일 정책 매칭 (전체 결합 규칙: 나이 AND 취업 AND 주거, 소득은 항상 통과)
//   - 나이 범위 밖(computeAgeRange=null)이면 나이 조건이 "제한없음"이어도 불통과 → 0건 규칙
//   - 거주지역: 국가단위는 항상 통과. 지역단위(서울)는 서울 거주자만 매칭,
//     그 외 지역은 "나머지 조건이 모두 일치할 때만" 준비중으로 노출(아니면 미노출).
//   - 마감 여부는 매칭 판단에 넣지 않는다(디스플레이 속성). isExpired 참고.
// ------------------------------------------------------------------
export function matchPolicy(
  user: UserProfile,
  policy: Policy,
  referenceDate: string = REFERENCE_DATE,
): MatchResult {
  const ageRange = computeAgeRange(user.birth_date, referenceDate);

  const okAge =
    ageRange !== null && passesArrayCondition(policy.age_condition, ageRange);
  const okEmployment = passesArrayCondition(
    policy.employment_condition,
    user.employment_status,
  );
  const okHousing = passesArrayCondition(
    policy.housing_condition,
    user.housing_type,
  );

  const income = evaluateIncome(policy, user.income_level); // 소득은 통과 여부에 영향 없음
  const otherConditionsPass = okAge && okEmployment && okHousing;

  const isRegional = policy.category === '지역단위(서울)';
  const regionMatches = !isRegional || user.region === '서울';

  let status: MatchStatus;
  if (!otherConditionsPass) {
    status = 'excluded';
  } else if (regionMatches) {
    status = 'matched';
  } else {
    status = 'pending_region';
  }

  return { policy, status, incomeBadge: income.badge, demote: income.demote };
}

// 기본순 정렬 가중치: 무배지 정확 매칭(0) → 모름/경계 배지(1) → 300초과 강경고·하단(2)
function defaultSortWeight(r: MatchResult): number {
  if (r.demote) return 2;
  if (r.incomeBadge.level !== 'none') return 1;
  return 0;
}

// ------------------------------------------------------------------
// 기본순 정렬: 배지 없는 정확 매칭 → 소득 모름/경계 배지 → 소득 초과 강경고(하단).
// 동일 가중치 내에서는 원래 순서를 유지(안정 정렬).
// ------------------------------------------------------------------
export function sortByDefault(results: MatchResult[]): MatchResult[] {
  return [...results].sort((a, b) => defaultSortWeight(a) - defaultSortWeight(b));
}

// ------------------------------------------------------------------
// 마감임박순 정렬: 진행중 회차마감(deadline 오름차순) → 상시 접수(별도 그룹) →
//   마감된 정책(최하단). 상시형은 D-day가 없어 임박 정렬 대상에서 제외해 별도 그룹으로,
//   마감된 정책은 순위와 무관하게 최하단 고정(반투명 처리는 화면단에서).
// ------------------------------------------------------------------
export function sortByDeadline(
  results: MatchResult[],
  referenceDate: string = REFERENCE_DATE,
): MatchResult[] {
  const active: MatchResult[] = []; // 진행중 회차마감
  const standing: MatchResult[] = []; // 상시 접수
  const expired: MatchResult[] = []; // 마감됨
  for (const r of results) {
    if (r.policy.deadline_type === '상시') standing.push(r);
    else if (isExpired(r.policy, referenceDate)) expired.push(r);
    else active.push(r);
  }
  active.sort((a, b) => {
    // 진행중 회차마감형은 deadline이 항상 존재
    const da = a.policy.deadline ?? '';
    const db = b.policy.deadline ?? '';
    return da < db ? -1 : da > db ? 1 : 0;
  });
  return [...active, ...standing, ...expired];
}

// ------------------------------------------------------------------
// 프로필로 전체 정책 매칭 → 상태별 분류. matched는 기본순 정렬(기본값).
//   마감임박순이 필요하면 호출측에서 sortByDeadline(groups.matched)로 재정렬.
// ------------------------------------------------------------------
export function matchPolicies(
  user: UserProfile,
  policies: Policy[],
  referenceDate: string = REFERENCE_DATE,
): MatchGroups {
  const results = policies.map((p) => matchPolicy(user, p, referenceDate));
  const matched = sortByDefault(results.filter((r) => r.status === 'matched'));
  const pendingRegion = results.filter((r) => r.status === 'pending_region');
  const excluded = results.filter((r) => r.status === 'excluded');
  return { matched, pendingRegion, excluded };
}

// ------------------------------------------------------------------
// 초기화 버튼: 프로필 기반 필터링을 끄고 전체 정책을 배지 없이 원본 그대로 노출.
// ------------------------------------------------------------------
export function resetToAllPolicies(policies: Policy[]): Policy[] {
  return policies;
}

// ------------------------------------------------------------------
// 마감 여부(디스플레이 전용, 매칭과 무관). 기준일 고정으로 판정.
//   상시형(deadline 없음)은 항상 false.
// ------------------------------------------------------------------
export function isExpired(
  policy: Policy,
  referenceDate: string = REFERENCE_DATE,
): boolean {
  if (policy.deadline_type === '상시' || !policy.deadline) return false;
  return policy.deadline < referenceDate; // 'YYYY-MM-DD' 문자열 비교
}

// ------------------------------------------------------------------
// Supabase policies 테이블 조회 → 매칭 대상 전체 정책.
//   (매칭은 실시간 외부 API가 아니라 배치 동기화로 채워진 우리 DB 기준으로 실행)
// ------------------------------------------------------------------
export async function getPolicies(): Promise<Policy[]> {
  const { data, error } = await supabase.from('policies').select('*');
  if (error) throw new Error(`정책 조회 실패: ${error.message}`);
  return (data ?? []) as Policy[];
}
