import { ImageResponse } from 'next/og';

// 링크 공유 시 미리보기 카드 이미지 (1200x630). next/og로 동적 생성.
export const alt = 'check&go — 청년 지원 정책 매칭';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c5cfc 0%, #574fe0 100%)',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', fontSize: 132, fontWeight: 800, letterSpacing: -4 }}>
          Check<span style={{ opacity: 0.6 }}>&</span>Go
        </div>
        <div style={{ marginTop: 12, fontSize: 42, fontWeight: 600, opacity: 0.92 }}>
          Youth Policy Matcher
        </div>
        <div style={{ marginTop: 40, fontSize: 28, opacity: 0.72 }}>checkngo.vercel.app</div>
      </div>
    ),
    { ...size },
  );
}
