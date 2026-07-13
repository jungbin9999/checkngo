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
