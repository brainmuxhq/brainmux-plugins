import { FAQ } from "./faq";

// schema.org JSON-LD for SEO + GEO (AI answer engines): Organization + WebSite +
// SoftwareApplication (llmproxy) + FAQPage (derived from the shared FAQ source).
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://brainmux.com/#org",
      name: "brainmux",
      url: "https://brainmux.com",
      logo: "https://brainmux.com/icon.svg",
      description: "LLM tooling for Claude Code.",
      sameAs: ["https://github.com/brainmuxhq/brainmux"],
    },
    {
      "@type": "WebSite",
      "@id": "https://brainmux.com/#website",
      url: "https://brainmux.com",
      name: "brainmux",
      publisher: { "@id": "https://brainmux.com/#org" },
    },
    {
      "@type": "SoftwareApplication",
      name: "llmproxy",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Docker (Linux, macOS, Windows)",
      softwareVersion: "0.1.1",
      url: "https://brainmux.com",
      description:
        "Run Claude Code on cheap OpenRouter models via local LiteLLM proxies and delegate grunt work to them, keeping your Opus quota for architecture and review.",
      license: "https://opensource.org/licenses/MIT",
      author: { "@id": "https://brainmux.com/#org" },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "FAQPage",
      "@id": "https://brainmux.com/#faq",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
