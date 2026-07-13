'use client';

import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

type Mode = 'login' | 'signup';
type Message = { type: 'success' | 'error' | 'info'; text: string } | null;

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const isSignup = mode === 'signup';

  function switchMode(next: Mode) {
    setMode(next);
    setMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setMessage(null);

    if (!email || !password) {
      setMessage({ type: 'error', text: '이메일과 비밀번호를 모두 입력해 주세요.' });
      return;
    }
    if (isSignup && password.length < 6) {
      setMessage({ type: 'error', text: '비밀번호는 6자 이상이어야 해요.' });
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setMessage({ type: 'error', text: error.message });
        } else if (data.session) {
          setMessage({ type: 'success', text: '회원가입이 완료됐어요! 바로 이용할 수 있어요.' });
        } else {
          setMessage({
            type: 'info',
            text: '확인 메일을 보냈어요. 메일의 링크를 눌러 인증을 완료해 주세요.',
          });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage({ type: 'error', text: '이메일 또는 비밀번호를 다시 확인해 주세요.' });
        } else {
          setMessage({
            type: 'success',
            text: `환영합니다! ${data.user?.email ?? ''} 님으로 로그인됐어요.`,
          });
        }
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '알 수 없는 오류가 발생했어요.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-slate-50 via-white to-violet-50 px-4 py-12">
      {/* 상단 그라데이션 액센트 라인 (참고 이미지 톤) */}
      <div className="fixed inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-500" />

      <div className="w-full max-w-md">
        {/* 브랜드 */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-indigo-500/30">
            <CheckIcon className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">체크앤고</h1>
          <p className="mt-1 text-sm text-slate-500">내 조건에 맞는 청년 정책, 한 번에 매칭</p>
        </div>

        {/* 카드 */}
        <div className="rounded-3xl bg-white p-8 shadow-[0_20px_60px_-20px_rgba(79,70,229,0.35)] ring-1 ring-slate-100 sm:p-10">
          {/* 로그인 / 회원가입 탭 */}
          <div className="mb-8 flex rounded-full bg-slate-100 p-1">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition ${
                  mode === m
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                이메일
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                비밀번호
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? '6자 이상' : '비밀번호'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 pr-14 text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-xs font-medium text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? '숨기기' : '보기'}
                </button>
              </div>
            </div>

            {message && (
              <div
                className={`rounded-xl px-4 py-3 text-sm ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : message.type === 'info'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'bg-rose-50 text-rose-700'
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '처리 중…' : isSignup ? '회원가입' : '로그인'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            {isSignup ? '이미 계정이 있으신가요? ' : '아직 계정이 없으신가요? '}
            <button
              type="button"
              onClick={() => switchMode(isSignup ? 'login' : 'signup')}
              className="font-medium text-indigo-500 hover:text-indigo-600"
            >
              {isSignup ? '로그인' : '회원가입'}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          이메일/비밀번호로 간편하게 시작하세요.
        </p>
      </div>
    </main>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}
