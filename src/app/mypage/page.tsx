'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/Header';
import { isExpired, REFERENCE_DATE, type Policy } from '@/lib/matching';

type ScrapStatus = '진행중' | '신청완료';

interface ScrapRow {
  scrap_id: string;
  policy_id: string;
  status: ScrapStatus;
  checklist_status: Record<string, boolean> | null;
  policy: Policy | null;
}

export default function MyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [scraps, setScraps] = useState<ScrapRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

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
      setEmail(session.user.email ?? '');

      const { data, error } = await supabase
        .from('scraps')
        .select('scrap_id, policy_id, status, checklist_status, policies(*)')
        .eq('user_id', session.user.id)
        .order('scrapped_at', { ascending: false });

      if (!active) return;
      if (error) {
        setMessage('스크랩 목록을 불러오지 못했어요.');
      } else {
        setScraps(
          (data ?? []).map((row) => {
            const raw = row as unknown as {
              scrap_id: string;
              policy_id: string;
              status: ScrapStatus;
              checklist_status: Record<string, boolean> | null;
              policies: Policy | Policy[] | null;
            };
            const policy = Array.isArray(raw.policies) ? (raw.policies[0] ?? null) : raw.policies;
            return {
              scrap_id: raw.scrap_id,
              policy_id: raw.policy_id,
              status: raw.status,
              checklist_status: raw.checklist_status,
              policy,
            };
          }),
        );
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  async function toggleDone(scrap: ScrapRow) {
    const next: ScrapStatus = scrap.status === '신청완료' ? '진행중' : '신청완료';
    setScraps((prev) => prev.map((s) => (s.scrap_id === scrap.scrap_id ? { ...s, status: next } : s)));
    const { error } = await supabase
      .from('scraps')
      .update({ status: next })
      .eq('scrap_id', scrap.scrap_id);
    if (error) {
      // 롤백
      setScraps((prev) =>
        prev.map((s) => (s.scrap_id === scrap.scrap_id ? { ...s, status: scrap.status } : s)),
      );
      setMessage('상태 변경에 실패했어요.');
    }
  }

  async function removeScrap(scrap: ScrapRow) {
    const prev = scraps;
    setScraps((cur) => cur.filter((s) => s.scrap_id !== scrap.scrap_id));
    const { error } = await supabase.from('scraps').delete().eq('scrap_id', scrap.scrap_id);
    if (error) {
      setScraps(prev); // 롤백
      setMessage('삭제에 실패했어요.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Header />

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* 프로필 요약 */}
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-900">마이페이지</p>
            <p className="mt-0.5 text-xs text-slate-400">{email}</p>
          </div>
          <Link
            href="/profile"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            프로필 수정
          </Link>
        </div>

        <div className="mb-4 flex items-end justify-between">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">스크랩한 정책</h1>
          {!loading && <span className="text-sm text-slate-400">{scraps.length}건</span>}
        </div>

        {message && (
          <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : scraps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
            <p className="text-base font-semibold text-slate-700">아직 스크랩한 정책이 없어요</p>
            <p className="mt-2 text-sm text-slate-400">
              홈에서 관심 있는 정책을 스크랩하면 여기에 모여요.
            </p>
            <Link
              href="/home"
              className="mt-4 inline-flex rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-violet-700 hover:to-indigo-700"
            >
              정책 보러 가기
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {scraps.map((scrap) => (
              <ScrapCard
                key={scrap.scrap_id}
                scrap={scrap}
                onToggleDone={() => toggleDone(scrap)}
                onRemove={() => removeScrap(scrap)}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function ScrapCard({
  scrap,
  onToggleDone,
  onRemove,
}: {
  scrap: ScrapRow;
  onToggleDone: () => void;
  onRemove: () => void;
}) {
  const policy = scrap.policy;
  if (!policy) return null;

  const expired = isExpired(policy);
  const total = policy.required_documents.length;
  const done = policy.required_documents.filter((d) => scrap.checklist_status?.[d]).length;
  const isDone = scrap.status === '신청완료';

  return (
    <li
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 ${expired ? 'opacity-70' : ''}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {deadlineText(policy)}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
          }`}
        >
          {scrap.status}
        </span>
      </div>

      <Link href={`/policy/${policy.policy_id}`} className="block">
        <h2 className="text-base font-semibold text-slate-900 hover:text-indigo-600">
          {policy.title}
        </h2>
      </Link>
      <p className="mt-1 text-xs text-slate-400">{policy.source}</p>

      {/* 체크리스트 진행현황 */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
          <span>서류 준비</span>
          <span>
            {done}/{total}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
            style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={onToggleDone}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            isDone
              ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              : 'bg-emerald-500 text-white hover:bg-emerald-600'
          }`}
        >
          {isDone ? '완료 취소' : '신청완료 표시'}
        </button>
        <button
          onClick={onRemove}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-rose-500 transition hover:bg-rose-50"
        >
          삭제
        </button>
      </div>
    </li>
  );
}

function deadlineText(policy: Policy): string {
  if (policy.deadline_type === '상시' || !policy.deadline) return '상시 접수';
  if (isExpired(policy)) return '마감됨';
  const days = Math.round(
    (new Date(`${policy.deadline}T00:00:00`).getTime() -
      new Date(`${REFERENCE_DATE}T00:00:00`).getTime()) /
      86_400_000,
  );
  return `D-${days}`;
}
