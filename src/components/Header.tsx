'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';

// 모든 화면 공통 헤더 (로그인 화면 제외).
//  - 로고 클릭 → 홈
//  - 비로그인: 로고만 / 로그인: 로고 + 이메일 + 프로필·마이페이지·캘린더 링크 + 로그아웃
export function Header() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-20 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-500" />
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/home" aria-label="홈으로" className="flex items-center">
            <Logo className="h-9 w-auto" priority />
          </Link>

          {ready && email && (
            <nav className="flex items-center gap-1 sm:gap-2">
              <span className="mr-1 hidden max-w-[180px] truncate text-sm text-slate-500 sm:inline">
                {email}
              </span>
              <HeaderLink href="/profile">프로필</HeaderLink>
              <HeaderLink href="/mypage">마이페이지</HeaderLink>
              <HeaderLink href="/calendar">캘린더</HeaderLink>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                로그아웃
              </button>
            </nav>
          )}
        </div>
      </header>
    </>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
    >
      {children}
    </Link>
  );
}
