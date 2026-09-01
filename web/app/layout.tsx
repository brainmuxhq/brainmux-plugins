import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const title = "brainmux — LLM tooling for Claude Code";
const description =
  "brainmux builds tools that route your work to the right model — so Claude Code spends your Opus quota on architecture and review, not busywork.";

export const metadata: Metadata = {
  metadataBase: new URL("https://brainmux.com"),
  title,
  description,
  applicationName: "brainmux",
  alternates: { canonical: "https://brainmux.com" },
  openGraph: {
    title,
    description: "Run Claude Code on cheap brains. One OpenRouter key, thousands of models, your Opus quota untouched.",
    url: "https://brainmux.com",
    siteName: "brainmux",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: "Run Claude Code on cheap brains.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
