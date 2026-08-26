import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Titipeen - Titip Apa Aja",
  description: "Jasa titip dan personal delivery Titipeen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
