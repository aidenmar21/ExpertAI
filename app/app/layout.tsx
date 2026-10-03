import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExpertAI",
  description: "An AI apprentice for any desk job",
};

/** Root shell: system font stack, semantic tokens from globals.css, light/dark via color-scheme. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full font-sans antialiased">
      <body className="min-h-full bg-canvas text-ink">{children}</body>
    </html>
  );
}
