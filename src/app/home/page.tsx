'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/Header';
import {
  getPolicies,
  matchPolicies,
  sortByDeadline,
  sortByDefault,
  computeAgeRange,
  isExpired,
  REFERENCE_DATE,
  type Policy,
  type MatchResult,
  type UserProfile,
} from '@/lib/matching';

type SortMode = 'default' | 'deadline';

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sort, setSort] = useState<SortMode>('default');
  const [showAll, setShowAll] = useState(false); // 초기화(전체 정책 보기)

  // 인증 가드 + 데이터 로드
  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      if (!active) return;
      setChecking(false);

      try {
        const [pols, profRes] = await Promise.all([
          getPolicies(),
          supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
        ]);
        if (!active) return;
        setPolicies(pols);
        setProfile((profRes.data as UserProfile | null) ?? null);
      } catch {
        if (active) setError('정책 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      } finally {
        if (active) setLoadingData(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const personalized = profile !== null && !showAll;

  const { items, pending } = useMemo(() => {
    let base: MatchResult[];
    let pend: MatchResult[] = [];
    if (personalized && profile) {
      const groups = matchPolicies(profile, policies);
      base = groups.matched;
      pend = groups.pendingRegion;
    } else {
      // 프로필 없음 또는 초기화: 전체 정책을 배지 없이 노출
      base = policies.map((p) => ({
        policy: p,
        status: 'matched' as const,
        incomeBadge: { level: 'none' as const },
        demote: false,
      }));
    }
    const sorted = sort === 'deadline' ? sortByDeadline(base) : sortByDefault(base);
    return { items: sorted, pending: pend };
  }, [personalized, profile, policies, sort]);

  // 현재 적용된 필터 조건 칩 (읽기 전용, 클릭 시 프로필 수정으로 이동)
  const chipLabels =
    personalized && profile
      ? [
          computeAgeRange(profile.birth_date)
            ? `${computeAgeRange(profile.birth_date)}세`
            : '만 19~39세 외',
          profile.employment_status,
          displayIncome(profile.income_level),
          profile.housing_type,
          profile.region,
        ]
      : [];

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
        불러오는 중…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Header />

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* 데이터 기준일 안내 (데모) */}
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-indigo-50/70 px-4 py-2.5 text-xs text-indigo-600">
          <span aria-hidden>📌</span>
          <span>
            <b className="font-semibold">2026.08.15 기준</b>의 포트폴리오 데모예요. 마감·D-day도 이 날짜
            기준으로 표시됩니다.
          </span>
        </div>

        {/* 타이틀 + 컨트롤 */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {personalized ? '나에게 맞는 정책' : '전체 청년 정책'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {loadingData ? '불러오는 중…' : `${items.length}건${personalized ? ' 매칭' : ''}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-slate-100 p-1">
              {(['default', 'deadline'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    sort === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {s === 'default' ? '기본순' : '마감임박순'}
                </button>
              ))}
            </div>
            {profile && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                {showAll ? '내 맞춤만' : '전체 보기'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {!profile && !loadingData && policies.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-indigo-700">
              프로필을 입력하면 내 조건에 맞는 정책만 골라서 보여드려요.
            </p>
            <Link
              href="/profile"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-violet-700 hover:to-indigo-700"
            >
              프로필 입력하기
            </Link>
          </div>
        )}

        {/* 현재 적용된 필터 조건 칩 (전체보기 상태에선 숨김) */}
        {personalized && !loadingData && policies.length > 0 && chipLabels.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-400">내 조건</span>
            {chipLabels.map((label, i) => (
              <Link
                key={i}
                href="/profile"
                className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:text-indigo-600 hover:ring-indigo-300"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/profile"
              className="ml-1 text-xs font-medium text-indigo-500 hover:text-indigo-600"
            >
              필터 수정
            </Link>
          </div>
        )}

        {/* 본문 */}
        {loadingData ? (
          <CardsSkeleton />
        ) : policies.length === 0 ? (
          <EmptyState
            title="정책 데이터가 아직 없어요"
            desc="Supabase 대시보드 SQL 에디터에서 supabase/seed.sql을 실행하면 정책 카드가 표시돼요."
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="조건에 맞는 정책이 없어요"
            desc="‘전체 보기’로 조건을 넓혀 모든 정책을 확인해 보세요."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((r) => (
              <PolicyCard key={r.policy.policy_id} result={r} />
            ))}
          </div>
        )}

        {/* 준비중(지역 미지원) */}
        {pending.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-bold text-slate-900">
              준비중{' '}
              <span className="text-sm font-normal text-slate-400">지역 미지원 · {pending.length}건</span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((r) => (
                <PolicyCard key={r.policy.policy_id} result={r} pending />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

// ---- 카드 ----
function PolicyCard({ result, pending }: { result: MatchResult; pending?: boolean }) {
  const p = result.policy;
  const d = deadlineInfo(p);
  const expired = d.tone === 'expired';
  const badge = result.incomeBadge;

  return (
    <Link
      href={`/policy/${p.policy_id}`}
      className={`flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md hover:ring-indigo-200 ${
        expired ? 'opacity-60' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={categoryChip(p.category)}>
          {p.category === '국가단위' ? '국가' : '서울'}
        </span>
        <span className={deadlineChip(d.tone)}>{d.label}</span>
      </div>

      <h3 className="text-base font-semibold leading-snug text-slate-900">{p.title}</h3>
      <p className="mt-1 text-xs text-slate-400">{p.source}</p>

      {(pending || badge.level !== 'none') && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pending && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              준비중 · 지역 미지원
            </span>
          )}
          {badge.level !== 'none' && <span className={incomeBadgeChip(badge.level)}>{badge.label}</span>}
        </div>
      )}

      <p className="mt-3 line-clamp-2 text-sm text-slate-500">{p.description}</p>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">필요서류 {p.required_documents.length}개</span>
        <span className="text-sm font-semibold text-indigo-600">자세히 →</span>
      </div>
    </Link>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <p className="text-base font-semibold text-slate-700">{title}</p>
      <p className="mt-2 text-sm text-slate-400">{desc}</p>
    </div>
  );
}

// ---- 표시용 헬퍼 ----
type DeadlineTone = 'urgent' | 'normal' | 'standing' | 'expired';

function deadlineInfo(policy: Policy): { label: string; tone: DeadlineTone } {
  if (policy.deadline_type === '상시' || !policy.deadline) {
    return { label: '상시 접수', tone: 'standing' };
  }
  if (isExpired(policy)) return { label: '마감됨', tone: 'expired' };
  const days = daysBetween(REFERENCE_DATE, policy.deadline);
  if (days <= 0) return { label: 'D-day', tone: 'urgent' };
  return { label: `D-${days}`, tone: days <= 7 ? 'urgent' : 'normal' };
}

function daysBetween(fromStr: string, toStr: string): number {
  const from = new Date(`${fromStr}T00:00:00`).getTime();
  const to = new Date(`${toStr}T00:00:00`).getTime();
  return Math.round((to - from) / 86_400_000);
}

function displayIncome(level: string): string {
  switch (level) {
    case '100만원미만':
      return '100만원 미만';
    case '100~200':
      return '100~200만원';
    case '200~300':
      return '200~300만원';
    case '300초과':
      return '300만원 초과';
    case '모름':
      return '소득 모름';
    default:
      return level;
  }
}

function categoryChip(category: Policy['category']): string {
  const base = 'rounded-full px-2.5 py-1 text-xs font-medium ';
  return category === '국가단위'
    ? `${base}bg-sky-50 text-sky-700`
    : `${base}bg-violet-50 text-violet-700`;
}

function deadlineChip(tone: DeadlineTone): string {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold ';
  switch (tone) {
    case 'urgent':
      return `${base}bg-rose-50 text-rose-600`;
    case 'standing':
      return `${base}bg-emerald-50 text-emerald-600`;
    case 'expired':
      return `${base}bg-slate-100 text-slate-400`;
    default:
      return `${base}bg-slate-100 text-slate-600`;
  }
}

function incomeBadgeChip(level: 'check' | 'caution' | 'warning'): string {
  const base = 'rounded-full px-2.5 py-1 text-xs font-medium ';
  switch (level) {
    case 'warning':
      return `${base}bg-rose-50 text-rose-700`;
    case 'caution':
      return `${base}bg-amber-50 text-amber-700`;
    default:
      return `${base}bg-indigo-50 text-indigo-700`;
  }
}
