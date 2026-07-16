import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 링크 공유 시 미리보기 카드 (1200x630). next/og로 동적 생성.
export const alt = 'check&go — 내 조건에 맞는 청년 정책, 한눈에 확인하기';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 실제 브랜드 로고(public/logo-v3.png = Check&go 워드마크)를 임베드
const LOGO_SRC = `data:image/png;base64,${readFileSync(
  join(process.cwd(), 'public', 'logo-v3.png'),
).toString('base64')}`;

// 한글 폰트(Noto Sans KR — 이 카드에 쓰는 글자만 서브셋). 저장소에 번들해 빌드 시 네트워크 불필요.
// (Satori는 기본 한글 폰트가 없어 폰트 지정 필수. 카드 문구를 바꾸면 이 서브셋도 갱신해야 함.)
const OG_FONT = readFileSync(join(process.cwd(), 'assets', 'og-font.ttf'));

const CHIP = {
  fontSize: 26,
  fontWeight: 700,
  color: '#4f3fd6',
  background: '#ffffff',
  padding: '12px 22px',
  borderRadius: 999,
  boxShadow: '0 14px 30px -16px rgba(79,63,214,0.4)',
};

function MiniCard({
  cat,
  status,
  statusColor,
  title,
}: {
  cat: '국가' | '서울';
  status: string;
  statusColor: string;
  title: string;
}) {
  const tag =
    cat === '국가'
      ? { color: '#0369a1', background: '#e0f2fe' }
      : { color: '#6d28d9', background: '#ede9fe' };
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: '#ffffff',
        borderRadius: 22,
        padding: '22px 26px',
        boxShadow: '0 24px 48px -24px rgba(79,63,214,0.45)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: tag.color,
            background: tag.background,
            padding: '4px 14px',
            borderRadius: 999,
          }}
        >
          {cat}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 700, color: statusColor }}>
          {status}
        </span>
      </div>
      <span style={{ fontSize: 30, fontWeight: 700, color: '#1e1b2e' }}>{title}</span>
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #eef0ff 0%, #f8f7fc 60%)',
          fontFamily: 'NotoKR',
          color: '#1e1b2e',
        }}
      >
        {/* 왼쪽: 로고 + 후킹 + 기능 */}
        <div
          style={{
            width: 700,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: 40,
            padding: '0 62px',
          }}
        >
          <img src={LOGO_SRC} width={300} height={85} alt="check&go" />
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 54, fontWeight: 700, letterSpacing: -2, lineHeight: 1.18 }}>
            <span>내 조건에 맞는</span>
            <span>청년 정책,</span>
            <span>한눈에 확인하기</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={CHIP}>조건 매칭</span>
            <span style={CHIP}>서류 체크리스트</span>
            <span style={CHIP}>마감 캘린더</span>
          </div>
        </div>

        {/* 오른쪽: 앱 정책 카드 (반듯하게) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 16,
            flex: 1,
            padding: '56px 52px 56px 0',
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, color: '#6c6890' }}>
            나에게 맞는 정책 · 9건
          </span>
          <MiniCard cat="국가" status="D-3" statusColor="#e11d48" title="청년미래적금" />
          <MiniCard cat="서울" status="진행중" statusColor="#0d9488" title="서울 청년수당" />
          <MiniCard cat="국가" status="D-14" statusColor="#e11d48" title="청년월세 특별지원" />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'NotoKR', data: OG_FONT, weight: 700, style: 'normal' }],
    },
  );
}
