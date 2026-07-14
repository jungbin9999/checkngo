'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/Header';
import {
  getPolicies,
  matchPolicies,
  REFERENCE_DATE,
  type Policy,
  type UserProfile,
} from '@/lib/matching';

// 기준일(고정) 파싱 — "오늘"은 실제 날짜가 아니라 REFERENCE_DATE 기준
const [REF_Y, REF_M1, REF_D] = REFERENCE_DATE.split('-').map(Number);
const REF_M0 = REF_M1 - 1; // 0-based month

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n: number) => String(n).padStart(2, '0');

export default function CalendarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [scrapped, setScrapped] = useState<Set<string>>(new Set());
  const [view, setView] = useState({ y: REF_Y, m: REF_M0 });

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user.id ?? null;
      try {
        const [pols, profRes, scrapRes] = await Promise.all([
          getPolicies(),
          uid
            ? supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
            : Promise.resolve({ data: null }),
          uid
            ? supabase.from('scraps').select('policy_id').eq('user_id', uid)
            : Promise.resolve({ data: [] }),
        ]);
        if (!active) return;
        setUserId(uid);
        setPolicies(pols);
        setProfile((profRes.data as UserProfile | null) ?? null);
        setScrapped(
          new Set(((scrapRes.data as { policy_id: string }[] | null) ?? []).map((s) => s.policy_id)),
        );
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : '데이터를 불러오지 못했어요.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 표시 대상: 로그인+프로필이면 매칭 정책, 아니면(또는 매칭 0건) 전체 정책.
  // 마감일 있고 상시형이 아닌 것만 → 날짜별로 그룹화.
  const policiesByDate = useMemo(() => {
    let base: Policy[];
    if (userId && profile) {
      const matched = matchPolicies(profile, policies).matched.map((m) => m.policy);
      base = matched.length > 0 ? matched : policies;
    } else {
      base = policies;
    }
    const map = new Map<string, Policy[]>();
    for (const p of base) {
      if (p.deadline_type === '상시' || !p.deadline) continue;
      const list = map.get(p.deadline) ?? [];
      list.push(p);
      map.set(p.deadline, list);
    }
    return map;
  }, [userId, profile, policies]);

  function shiftMonth(delta: number) {
    setView(({ y, m }) => {
      const t = y * 12 + m + delta;
      return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
    });
  }

  async function toggleScrap(policyId: string) {
    if (!userId) {
      router.push('/login'); // 비로그인 → 로그인 유도
      return;
    }
    const wasScrapped = scrapped.has(policyId);
    const prev = scrapped;
    const next = new Set(prev);
    if (wasScrapped) next.delete(policyId);
    else next.add(policyId);
    setScrapped(next); // 낙관적 업데이트
    setError(null);

    const res = wasScrapped
      ? await supabase.from('scraps').delete().eq('user_id', userId).eq('policy_id', policyId)
      : await supabase
          .from('scraps')
          .upsert(
            { user_id: userId, policy_id: policyId, status: '진행중' },
            { onConflict: 'user_id,policy_id' },
          );
    if (res.error) {
      setScrapped(prev); // 롤백
      setError('스크랩 변경에 실패했어요. 다시 시도해 주세요.');
    }
  }

  // 달력 셀 구성 (앞쪽 빈칸 + 날짜). new Date는 요일/일수 계산용이며 "오늘" 판단엔 쓰지 않음.
  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <main className="min-h-screen bg-slate-50">
      <Header />

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {view.y}.{pad(view.m + 1)}
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="이전 달"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            >
              ‹
            </button>
            <button
              onClick={() => setView({ y: REF_Y, m: REF_M0 })}
              className="h-8 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              오늘
            </button>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="다음 달"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            >
              ›
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {loading ? (
          <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-100">
            <div className="grid grid-cols-7 border-b border-slate-100">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className={`py-2 text-center text-xs font-semibold ${
                    i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-500' : 'text-slate-500'
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {cells.map((d, idx) => {
                const isToday = d !== null && view.y === REF_Y && view.m === REF_M0 && d === REF_D;
                const key = d !== null ? `${view.y}-${pad(view.m + 1)}-${pad(d)}` : '';
                const dayPolicies = d !== null ? (policiesByDate.get(key) ?? []) : [];
                return (
                  <div
                    key={idx}
                    className={`min-h-[92px] border-b border-r border-slate-100 p-1.5 ${
                      d === null ? 'bg-slate-50/40' : ''
                    }`}
                  >
                    {d !== null && (
                      <>
                        <div
                          className={`mb-1 text-xs font-semibold ${
                            isToday
                              ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white'
                              : 'text-slate-500'
                          }`}
                        >
                          {d}
                        </div>
                        <div className="space-y-0.5">
                          {dayPolicies.map((p) => {
                            const on = scrapped.has(p.policy_id);
                            return (
                              <div key={p.policy_id} className="flex items-center gap-0.5">
                                <button
                                  onClick={() => toggleScrap(p.policy_id)}
                                  aria-label={on ? '스크랩 해제' : '스크랩'}
                                  className={`shrink-0 transition ${
                                    on ? 'text-amber-400' : 'text-slate-300 hover:text-slate-400'
                                  }`}
                                >
                                  <StarIcon filled={on} className="h-3.5 w-3.5" />
                                </button>
                                <Link
                                  href={`/policy/${p.policy_id}`}
                                  className={`flex min-w-0 items-center gap-1 text-[11px] leading-tight hover:underline ${
                                    on ? 'font-bold text-indigo-600' : 'text-slate-600'
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                      p.category === '국가단위' ? 'bg-sky-400' : 'bg-violet-400'
                                    }`}
                                  />
                                  <span className="truncate">{p.title}</span>
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 범례 */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> 국가
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> 서울
          </span>
          <span className="flex items-center gap-1">
            <StarIcon filled className="h-3 w-3 text-amber-400" /> 스크랩(별 클릭으로 토글)
          </span>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          2026년 8월 15일 데이터 기준의 포트폴리오 데모입니다. 상시 접수 정책은 캘린더에 표시되지 않아요.
        </p>
      </div>
    </main>
  );
}

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
    </svg>
  );
}
