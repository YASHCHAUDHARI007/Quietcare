import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({
  variable: "--font-manrope",
  src: [
    { path: "./fonts/manrope-400.ttf", weight: "400" },
    { path: "./fonts/manrope-500.ttf", weight: "500" },
    { path: "./fonts/manrope-600.ttf", weight: "600" },
    { path: "./fonts/manrope-700.ttf", weight: "700" },
    { path: "./fonts/manrope-800.ttf", weight: "800" },
  ],
});

export const metadata: Metadata = {
  title: "Quietcare",
  description: "A clear medicine routine for your parent",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
