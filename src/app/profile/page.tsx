'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  computeAgeRange,
  type EmploymentStatus,
  type IncomeLevel,
  type HousingType,
} from '@/lib/matching';

const EMPLOYMENT_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: '재직자', label: '재직자' },
  { value: '자영업자·프리랜서', label: '자영업자·프리랜서' },
  { value: '미취업자', label: '미취업자' },
  { value: '기타', label: '기타' },
];

const INCOME_OPTIONS: { value: IncomeLevel; label: string }[] = [
  { value: '100만원미만', label: '100만원 미만' },
  { value: '100~200', label: '100~200만원' },
  { value: '200~300', label: '200~300만원' },
  { value: '300초과', label: '300만원 초과' },
  { value: '모름', label: '모름' },
];

const HOUSING_OPTIONS: { value: HousingType; label: string }[] = [
  { value: '자가', label: '자가' },
  { value: '전세', label: '전세' },
  { value: '월세', label: '월세' },
  { value: '무상거주', label: '무상거주' },
];

const REGION_OPTIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [hasProfile, setHasProfile] = useState(false);

  const [birthDate, setBirthDate] = useState('');
  const [employment, setEmployment] = useState<EmploymentStatus | ''>('');
  const [income, setIncome] = useState<IncomeLevel | ''>('');
  const [housing, setHousing] = useState<HousingType | ''>('');
  const [region, setRegion] = useState('');

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
      setUserId(session.user.id);
      setEmail(session.user.email ?? '');

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (!active) return;
      if (data) {
        setHasProfile(true);
        setBirthDate(data.birth_date ?? '');
        setEmployment(data.employment_status ?? '');
        setIncome(data.income_level ?? '');
        setHousing(data.housing_type ?? '');
        setRegion(data.region ?? '');
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const ageRange = birthDate ? computeAgeRange(birthDate) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);

    if (!birthDate || !employment || !income || !housing || !region) {
      setError('모든 항목을 입력해 주세요.');
      return;
    }

    setSaving(true);
    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: userId,
      email,
      birth_date: birthDate,
      employment_status: employment,
      income_level: income,
      housing_type: housing,
      region,
    });
    setSaving(false);

    if (upsertError) {
      setError('저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    router.push('/home');
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
        불러오는 중…
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-violet-50 px-4 py-12">
      <div className="fixed inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-500" />

      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {hasProfile ? '프로필 수정' : '프로필 입력'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            5가지만 입력하면 나에게 맞는 정책만 골라드려요.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-7 rounded-3xl bg-white p-8 shadow-[0_20px_60px_-20px_rgba(79,70,229,0.35)] ring-1 ring-slate-100 sm:p-10"
        >
          {/* 생년월일 */}
          <div>
            <label htmlFor="birth" className="text-sm font-semibold text-slate-800">
              생년월일
            </label>
            <input
              id="birth"
              type="date"
              value={birthDate}
              max="2020-12-31"
              onChange={(e) => setBirthDate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
            {birthDate && (
              <p className="mt-2 text-xs text-slate-500">
                {ageRange ? (
                  <>만 나이 구간: <span className="font-semibold text-indigo-600">{ageRange}</span></>
                ) : (
                  <span className="text-amber-600">
                    만 19~39세 청년 대상 서비스예요. 이 범위 밖이면 매칭 결과가 없을 수 있어요.
                  </span>
                )}
              </p>
            )}
          </div>

          {/* 취업상태 */}
          <Field label="취업상태">
            <ChipGroup options={EMPLOYMENT_OPTIONS} value={employment} onChange={setEmployment} />
          </Field>

          {/* 소득수준 */}
          <Field label="월 소득수준" hint="정확히 모르면 ‘모름’을 선택해도 돼요.">
            <ChipGroup options={INCOME_OPTIONS} value={income} onChange={setIncome} />
          </Field>

          {/* 주거형태 */}
          <Field label="주거형태">
            <ChipGroup options={HOUSING_OPTIONS} value={housing} onChange={setHousing} />
          </Field>

          {/* 거주지역 */}
          <div>
            <label htmlFor="region" className="text-sm font-semibold text-slate-800">
              거주지역
            </label>
            <p className="mt-0.5 text-xs text-slate-400">현재 지역 정책은 서울만 지원돼요.</p>
            <select
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            >
              <option value="" disabled>
                시/도를 선택하세요
              </option>
              {REGION_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}

          <div className="flex items-center gap-3 pt-1">
            {hasProfile && (
              <Link
                href="/home"
                className="flex-1 rounded-xl border border-slate-200 py-3.5 text-center text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                취소
              </Link>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? '저장 중…' : hasProfile ? '수정 완료' : '저장하고 매칭 보기'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            value === o.value
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
