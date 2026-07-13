import { redirect } from 'next/navigation';

// 아직 홈(대시보드) 화면이 없어 로그인 화면으로 보낸다. (추후 매칭 홈으로 교체 예정)
export default function Home() {
  redirect('/login');
}
