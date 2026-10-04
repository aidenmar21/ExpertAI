import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExpertAI",
  description: "An AI apprentice for any desk job",
};

/** Root shell: system font stack, semantic tokens from globals.css. Always dark: the `dark` class overrides the system setting. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full font-sans antialiased">
      <body className="min-h-full bg-canvas text-ink">{children}</body>
    </html>
  );
}
