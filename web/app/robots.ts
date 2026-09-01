import type { MetadataRoute } from "next";

// Allow everyone — including AI answer-engine crawlers (GPTBot, ClaudeBot,
// PerplexityBot, Google-Extended, …) so brainmux can be cited in AI answers (GEO).
// A blanket allow covers named AI bots; we list them explicitly as an intent signal.
export default function robots(): MetadataRoute.Robots {
  const aiBots = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "Claude-Web",
    "PerplexityBot",
    "Google-Extended",
    "Applebot-Extended",
    "CCBot",
  ];
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: aiBots, allow: "/" },
    ],
    sitemap: "https://brainmux.com/sitemap.xml",
    host: "https://brainmux.com",
  };
}
