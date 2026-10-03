import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExpertAI",
  description: "An AI apprentice for any desk job",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
