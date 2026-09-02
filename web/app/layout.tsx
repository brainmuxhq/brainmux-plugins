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
  keywords: [
    "brainmux", "llmproxy", "graphmux", "Claude Code", "OpenRouter", "LiteLLM", "LLM proxy",
    "cheap LLM", "delegate", "Opus quota", "AI coding agent", "DeepSeek", "Qwen",
    "code graph", "codebase memory", "CodeGraph", "MCP", "call graph", "tree-sitter",
  ],
  authors: [{ name: "brainmux", url: "https://github.com/brainmuxhq/brainmux" }],
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
