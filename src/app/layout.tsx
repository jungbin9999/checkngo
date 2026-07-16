import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://checkngo.vercel.app"),
  title: "check&go — 청년 지원 정책 서비스",
  description: "내 조건에 맞는 청년 정책을 한 번에 매칭하고 서류·마감까지 챙겨주는 서비스",
  openGraph: {
    title: "check&go — 청년 지원 정책 서비스",
    description:
      "내 조건(나이·취업·소득·주거·지역)에 맞는 청년 정책을 한 번에 매칭. 서류 체크리스트·마감 캘린더까지.",
    url: "https://checkngo.vercel.app",
    siteName: "check&go",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "check&go — 청년 지원 정책 서비스",
    description: "내 조건에 맞는 청년 정책을 한 번에 매칭. 서류 체크리스트·마감 캘린더까지.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
