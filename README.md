# check&go (체크앤고)

내 조건에 맞는 청년 지원 정책을 한 번에 매칭하고, 서류 준비와 마감까지 챙겨주는 웹 서비스.
자격 확인 → 서류 체크리스트 → 마감 관리로 흩어져 있던 과정을 **프로필 하나**로 이어줍니다. (MVP 타깃: 1인가구 청년)

> ⚠️ **포트폴리오 데모**입니다. 정책 데이터는 **2026-08-15 기준**으로 고정되어 있어 마감/D-day가 그 시점 기준으로 표시되며, 실제 신청 페이지는 이미 마감되었을 수 있습니다.

## 주요 기능

- **조건 매칭**: 나이·취업상태·소득·주거형태·거주지역 5개 조건으로 나에게 맞는 정책만 필터링 (기본순/마감임박순 정렬, 소득 경계/초과 배지, 지역 미지원 "준비중" 처리)
- **정책 상세**: 자격조건·신청기간·설명 + 서류 체크리스트 + 스크랩 + 신청 사이트 바로가기
- **마이페이지**: 스크랩한 정책 목록, 서류 준비 진행률, 신청완료/삭제, 마감 알림 on/off (개별·전체)
- **캘린더**: 월별 마감 정책을 달력 + 마감일 순 리스트로 확인, 별 클릭으로 바로 스크랩

## 기술 스택

- **Next.js (App Router) · TypeScript · Tailwind CSS**
- **Supabase** (Auth 이메일/비밀번호, Postgres + RLS)
- 배포: **Vercel**

매칭 규칙은 `src/lib/matching.ts`, DB 스키마는 `supabase/migrations/`, 정책 시드는 `supabase/seed.sql` 참고.
기획·정책 정의서 등 상세 문서는 `docs/`, 구현 스펙은 `SPEC.md`.

## 로컬 실행

```bash
npm install

# 프로젝트 루트에 .env.local 생성
# NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-anon-key>

npm run dev   # http://localhost:3000
```

DB를 처음 세팅한다면 Supabase SQL Editor에서 `supabase/migrations/`의 스키마 → `supabase/seed.sql`(정책 12건) 순으로 실행하세요.
