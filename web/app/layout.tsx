import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const title = "brainmux — işinizi yürüten 7/24 yapay zeka ekibi";
const description =
  "brainmux, işinizi yürüten 7/24 çalışan bir yapay zeka ekibidir. Ekip ve veritabanı sizin makinenizde bir kutu içinde çalışır; bulut yalnızca giriş ve aboneliği yönetir. Böylece veriniz dışarı çıkmaz.";

export const metadata: Metadata = {
  metadataBase: new URL("https://brainmux.com"),
  title,
  description,
  applicationName: "brainmux",
  keywords: [
    "brainmux", "yapay zeka agent platformu", "yapay zeka ekibi", "iş otomasyonu",
    "yerel çalışan yapay zeka", "veri gizliliği", "KVKK", "7/24 agent", "zamanlı görev",
    "sosyal medya otomasyonu", "evrak otomasyonu", "e-posta yanıtlama",
    "AI agent platform", "agent fleet", "local-first AI", "self-hosted agents",
    "llmproxy", "graphmux", "Claude Code", "OpenRouter", "cheap LLM", "code graph",
  ],
  authors: [{ name: "brainmux", url: "https://github.com/brainmuxhq/brainmux-plugins" }],
  creator: "brainmux",
  publisher: "brainmux",
  category: "technology",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: "https://brainmux.com" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    title,
    description: "İşinizi yürüten 7/24 yapay zeka ekibi. Ekip ve veriniz sizin makinenizde bir kutu içinde çalışır — veriniz dışarı çıkmaz.",
    url: "https://brainmux.com",
    siteName: "brainmux",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: "İşinizi yürüten 7/24 yapay zeka ekibi — veriniz sizde kalır.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
