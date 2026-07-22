import { createClient } from "@supabase/supabase-js";

// .env.local에 정의된 Supabase 접속 정보 (anon 키는 클라이언트 노출 안전)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase 환경변수가 없습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.",
  );
}

// 앱 전역에서 재사용하는 Supabase 클라이언트 (싱글턴)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 저장된 세션의 액세스 토큰(JWT)이 이미 만료됐거나 곧 만료면 쿼리 전에 미리 갱신해
 * 항상 유효한 세션을 돌려준다. 세션이 없으면 null.
 *
 * 왜 필요한가: JWT는 기본 1시간 만료라, 오래(예: 하루) 뒤 재방문하면 localStorage에
 * 남은 토큰이 만료된 상태로 보호 페이지에 바로 진입한다. 자동 갱신이 끝나기 전
 * 만료 토큰으로 첫 쿼리가 나가면 PostgREST가 401을 던져(공개 테이블 조회 포함)
 * "정책 정보를 불러오지 못했어요"가 뜬다. 새로고침하면 그 사이 갱신돼서 정상 동작하던
 * 증상과 동일하다. 이 헬퍼가 그 수동 새로고침을 대신한다.
 *
 * 여기서 쓰는 Date.now()는 실시간 인증 토큰 만료 판단용이며, 데이터 마감·나이 계산에
 * 쓰는 고정 기준일(REFERENCE_DATE)과는 전혀 무관하다.
 */
export async function getValidSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? 0;
  // 만료됐거나 60초 이내 만료 예정이면 미리 갱신
  if (expiresAt - nowSec <= 60) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) return data.session;
  }
  return session;
}
