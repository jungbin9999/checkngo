'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, getValidSession } from '@/lib/supabase';
import { Header } from '@/components/Header';
import { isExpired, REFERENCE_DATE, type Policy } from '@/lib/matching';

export default function PolicyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const policyId = params.id;

  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [scrapped, setScrapped] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // 만료 토큰 대비: 저장된 세션이 만료/임박이면 쿼리 전에 미리 갱신한다.
      const session = await getValidSession();
      const uid = session?.user.id ?? null;

      const [policyRes, scrapRes] = await Promise.all([
        supabase.from('policies').select('*').eq('policy_id', policyId).maybeSingle(),
        uid
          ? supabase
              .from('scraps')
              .select('checklist_status')
              .eq('user_id', uid)
              .eq('policy_id', policyId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!active) return;

      setUserId(uid);
      setPolicy((policyRes.data as Policy | null) ?? null);
      if (scrapRes.data) {
        setScrapped(true);
        setChecklist((scrapRes.data.checklist_status as Record<string, boolean>) ?? {});
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [policyId]);

  async function toggleScrap() {
    if (!userId) {
      router.push('/login'); // 비로그인 → 로그인 유도
      return;
    }
    if (busy || !policy) return;
    setBusy(true);
    setMessage(null);
    if (scrapped) {
      const { error } = await supabase
        .from('scraps')
        .delete()
        .eq('user_id', userId)
        .eq('policy_id', policy.policy_id);
      if (error) setMessage('스크랩 해제에 실패했어요. 다시 시도해 주세요.');
      else {
        setScrapped(false);
        setChecklist({});
      }
    } else {
      const { error } = await supabase
        .from('scraps')
        .upsert(
          {
            user_id: userId,
            policy_id: policy.policy_id,
            checklist_status: checklist,
            status: '진행중',
          },
          { onConflict: 'user_id,policy_id' },
        );
      if (error) setMessage('스크랩에 실패했어요. 다시 시도해 주세요.');
      else setScrapped(true);
    }
    setBusy(false);
  }

  async function toggleCheck(doc: string) {
    if (!userId || !policy) return; // 비로그인은 체크 불가(목록만 노출)
    const next = { ...checklist, [doc]: !checklist[doc] };
    setChecklist(next); // 낙관적 업데이트
    const { error } = await supabase.from('scraps').upsert(
      {
        user_id: userId,
        policy_id: policy.policy_id,
        checklist_status: next,
        status: '진행중',
      },
      { onConflict: 'user_id,policy_id' },
    );
    if (error) {
      setChecklist(checklist); // 롤백
      setMessage('체크 상태 저장에 실패했어요.');
    } else {
      setScrapped(true); // 체크하면 자동으로 스크랩에 담김
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
        불러오는 중…
      </main>
    );
  }

  if (!policy) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
        <p className="text-lg font-semibold text-slate-700">정책을 찾을 수 없어요</p>
        <Link href="/home" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          ← 홈으로 돌아가기
        </Link>
      </main>
    );
  }

  const checkedCount = policy.required_documents.filter((d) => checklist[d]).length;
  const [descMain, descIncome] = splitDescription(policy.description);

  return (
    <main className="min-h-screen bg-slate-50">
      <Header />

      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  policy.category === '국가단위'
                    ? 'bg-sky-50 text-sky-700'
                    : 'bg-violet-50 text-violet-700'
                }`}
              >
                {policy.category}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {deadlineText(policy)}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{policy.title}</h1>
            <p className="mt-1 text-sm text-slate-400">출처 · {policy.source}</p>
          </div>
          <button
            onClick={toggleScrap}
            disabled={busy}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-60 ${
              scrapped
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BookmarkIcon filled={scrapped} className="h-4 w-4" />
            {scrapped ? '스크랩됨' : '스크랩'}
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>
        )}

        {/* 자격조건 */}
        <Section title="자격조건">
          <dl className="divide-y divide-slate-100">
            <Row label="나이" value={condText(policy.age_condition)} />
            <Row label="취업상태" value={condText(policy.employment_condition)} />
            <Row
              label="소득"
              value={policy.has_income_condition ? '소득 조건 있음 (자세한 기준은 아래 설명 참고)' : '소득 조건 없음'}
            />
            <Row label="주거형태" value={condText(policy.housing_condition)} />
          </dl>
        </Section>

        {/* 신청기간 */}
        <Section title="신청기간">
          <p className="text-sm text-slate-700">{deadlineText(policy)}</p>
        </Section>

        {/* 필요서류 체크리스트 */}
        <Section
          title="필요서류 체크리스트"
          right={
            userId ? (
              <span className="text-xs text-slate-400">
                {checkedCount}/{policy.required_documents.length}
              </span>
            ) : undefined
          }
        >
          {!userId && (
            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              로그인하면 준비한 서류를 체크할 수 있어요.
            </p>
          )}
          <ul className="space-y-2">
            {policy.required_documents.map((doc) => (
              <li key={doc}>
                <label
                  className={`flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 text-sm ${
                    userId ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!userId}
                    checked={!!checklist[doc]}
                    onChange={() => toggleCheck(doc)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 disabled:opacity-50"
                  />
                  <span className={checklist[doc] ? 'text-slate-400 line-through' : 'text-slate-700'}>
                    {doc}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Section>

        {/* 설명 */}
        <Section title="정책 설명">
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{descMain}</p>
        </Section>

        {descIncome && (
          <Section title="소득 기준 (원문)">
            <p className="text-sm leading-relaxed text-slate-600">{descIncome}</p>
          </Section>
        )}

        {/* 신청하러 가기 */}
        <a
          href={policy.apply_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-violet-700 hover:to-indigo-700"
        >
          신청 사이트로 이동 ↗
        </a>

        <p className="mt-8 text-center text-xs text-slate-400">
          2026년 8월 15일 데이터 기준의 포트폴리오 데모입니다. 실제 신청 페이지는 마감되었을 수 있어요.
        </p>
      </div>
    </main>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-2.5 text-sm">
      <dt className="w-20 shrink-0 text-slate-400">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}

function BookmarkIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 3.5h14v17l-7-4-7 4v-17Z" />
    </svg>
  );
}

// ---- 헬퍼 ----
// 시드에서 description 끝에 " · 소득기준: <원문>"으로 붙여둔 소득 기준을 분리
function splitDescription(desc: string): [string, string | null] {
  const sep = ' · 소득기준: ';
  const i = desc.indexOf(sep);
  if (i === -1) return [desc.trim(), null];
  return [desc.slice(0, i).trim(), desc.slice(i + sep.length).trim()];
}

function condText(arr: string[] | null): string {
  if (!arr || arr.length === 0) return '제한없음';
  if (arr.includes('제한없음')) return '제한없음';
  return arr.join(', ');
}

function deadlineText(policy: Policy): string {
  if (policy.deadline_type === '상시' || !policy.deadline) return '상시 접수 (마감 없음)';
  if (isExpired(policy)) return `마감됨 (${policy.deadline})`;
  const days = Math.round(
    (new Date(`${policy.deadline}T00:00:00`).getTime() -
      new Date(`${REFERENCE_DATE}T00:00:00`).getTime()) /
      86_400_000,
  );
  return `~${policy.deadline} (D-${days})`;
}
