import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";

const kanit = Kanit({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "thai"],
  variable: "--font-kanit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DTC - DevTest By Siranat.Ta",
  description: "ค้นหา แสดงเส้นทาง และเพิ่มสถานที่บนแผนที่ด้วย Next.js + Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={kanit.variable}>
      <body className={`${kanit.variable} ${kanit.className}`}>{children}</body>
    </html>
  );
}
