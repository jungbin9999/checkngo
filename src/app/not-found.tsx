import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <p className="text-5xl font-extrabold text-indigo-600">404</p>
      <p className="text-base font-semibold text-slate-700">페이지를 찾을 수 없어요</p>
      <p className="text-sm text-slate-400">주소가 바뀌었거나 없는 페이지예요.</p>
      <Link
        href="/home"
        className="mt-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-violet-700 hover:to-indigo-700"
      >
        홈으로 가기
      </Link>
    </main>
  );
}
