import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Supabase 무료 플랜은 약 7일간 활동이 없으면 프로젝트를 자동 일시정지(pause)한다.
// 이 서비스는 기준일 freeze(2026-08-15) 이후 데이터 동기화가 멈춰 트래픽이 적어
// pause되기 쉽다. Vercel Cron이 하루 1회 이 엔드포인트를 호출해 DB에 가벼운 read
// 쿼리를 날려서 "활동"으로 인식되게 함으로써 자동 일시정지를 막는다.
//
// 중요: freeze 원칙을 지키기 위해 데이터는 절대 쓰지 않고 read(count)만 한다.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  // Vercel Cron은 CRON_SECRET 환경변수가 설정돼 있으면 요청에
  // Authorization: Bearer <CRON_SECRET> 헤더를 자동으로 붙인다.
  // 외부에서 임의로 호출하지 못하도록 검증한다.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  // 요청 단위로 서버 전용 클라이언트 생성 (세션 유지 불필요)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  // policies는 공개 조회 가능(RLS 허용). 실제 행은 안 가져오고 count만 조회해
  // DB에 최소 부하로 접속 흔적만 남긴다.
  const { count, error } = await supabase
    .from("policies")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, policyCount: count ?? 0 });
}
