import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "듀얼모멘텀 대시보드",
  description: "듀얼모멘텀 전략 기반 포트폴리오 시그널 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
