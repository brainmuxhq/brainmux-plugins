import { FAQ } from "./faq";

// schema.org JSON-LD for SEO + GEO (AI answer engines): Organization + WebSite +
// SoftwareApplication (brainmux platform + open engines llmproxy, graphmux) +
// FAQPage (derived from the shared FAQ source).
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://brainmux.com/#org",
      name: "brainmux",
      url: "https://brainmux.com",
      logo: "https://brainmux.com/icon.svg",
      description: "İşinizi yürüten 7/24 yapay zeka ekibi platformu — ekip ve veriniz sizin makinenizde çalışır, veriniz dışarı çıkmaz.",
      sameAs: ["https://github.com/brainmuxhq/brainmux-plugins"],
    },
    {
      "@type": "WebSite",
      "@id": "https://brainmux.com/#website",
      url: "https://brainmux.com",
      name: "brainmux",
      inLanguage: "tr-TR",
      publisher: { "@id": "https://brainmux.com/#org" },
    },
    {
      "@type": "SoftwareApplication",
      name: "brainmux",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Docker (Linux, macOS, Windows)",
      url: "https://brainmux.com/#platform",
      description:
        "İşinizi yürüten 7/24 yapay zeka ekibi. Görevleri kendi arasında paylaşır, zamanı gelince otomatik çalışır ve verdiğiniz işleri tamamlar. Ekip ve veritabanı sizin makinenizde bir kutu (container) içinde çalışır; bulut yalnızca giriş ve aboneliği yönetir — veriniz dışarı çıkmaz.",
      author: { "@id": "https://brainmux.com/#org" },
    },
    {
      "@type": "SoftwareApplication",
      name: "llmproxy",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Docker (Linux, macOS, Windows)",
      softwareVersion: "0.1.19",
      url: "https://brainmux.com/#llmproxy",
      description:
        "Claude Code'u yerel LiteLLM proxy'leri üzerinden ucuz OpenRouter modellerinde çalıştırın ve yorucu işi onlara devredin; Opus kotanız mimari ve incelemeye kalsın.",
      license: "https://opensource.org/licenses/MIT",
      author: { "@id": "https://brainmux.com/#org" },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "SoftwareApplication",
      name: "graphmux",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Linux, macOS, Windows",
      softwareVersion: "0.1.2",
      url: "https://brainmux.com/#graphmux",
      description:
        "Claude Code ve bmux agent'larına kodunuzun yerel, kesin haritasını verir — çağıranlar, çağrılanlar, etki ve birebir kaynak — böylece agent'lar tahmin yürütmek yerine gerçek yapıya bakar. CodeGraph motorunun ince sarmalı (tree-sitter, yerel SQLite, embedding yok).",
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
