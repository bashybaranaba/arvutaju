import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arvutaju",
  description: "Mõtlemine nähtavaks! õpetaja abiline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="et" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
