import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arvutaju",
  description:
    "Õpetaja tööriist arvutaju, töövihiku materjali ja matemaatilise arutelu toetamiseks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="et" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
