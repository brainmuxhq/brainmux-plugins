// FAQ içeriği tek kaynak (SSoT) — görünür SSS bölümünü, FAQPage JSON-LD'yi (SEO)
// ve /llms.txt'yi (GEO) besler. Yalnızca burayı düzenle.
export interface Faq {
  q: string;
  a: string;
}

export const FAQ: Faq[] = [
  {
    q: "brainmux nedir?",
    a: "brainmux, işinizi yürüten 7/24 çalışan bir yapay zeka ekibidir. İş verirsiniz; ekip planlar, görevleri kendi arasında paylaşır, zamanı gelince otomatik çalışır ve tamamlar — kendi verilerinize dayanarak. Ekip ve veritabanı sizin makinenizde bir kutu (container) içinde çalışır; bulut yalnızca giriş ve aboneliği yönetir. Böylece veriniz dışarı çıkmaz.",
  },
  {
    q: "Verim dışarı çıkar mı? Güvenli mi?",
    a: "Kendi makinenizde seçeneğinde hayır. Ekip ve veritabanı sizin makinenizde çalışır; veriniz ne bize gelir ne bizde işlenir — tek komutla kurar, verinizi içe aktarırsınız. Yalnızca seçtiğiniz modele göre prompt gider (kendi yerel modeliniz → hiçbir yere çıkmaz). Dışarıya giden her çıktıyı da siz onaylarsınız.",
  },
  {
    q: "Ekip nasıl çalışır?",
    a: "Bir görev ya da bir zaman planı (örn. her sabah 09:00) verirsiniz. Bir gözetmen agent işi sınırlı görevlere böler ve diğer agent'lara paslar; her agent harekete geçmeden önce verinize dayanır, gözetmen sonucu denetler. Zamanlı görevlerde ekip siz yokken çalışır ve size rapor verir.",
  },
  {
    q: "Modeli kim seçer? (kendi modelinizi getirin)",
    a: "Siz seçersiniz. Üç yol var: kendi yerel modelinizi çalıştırın (ör. Ollama), kendi uzak modelinizi bağlayın (kendi anahtarınızla) ya da bizim model havuzumuzu kullanın. Kararı siz verirsiniz.",
  },
  {
    q: "Kendi makinemde mi, sizde mi çalışır?",
    a: "İkisi de olur. Kendi makinenizde: veri hiç çıkmaz, tek komutla kurulur, tarayıcıdan açılır. Bizde (kolay): kurulum yok, aç kullan. Giriş ve fatura her iki durumda da buluttan yönetilir; iş verisi bizde tuttuğunuzda faturadan ayrı bir yerde durur.",
  },
  {
    q: "Anthropic ya da Opus kotamı harcar mı?",
    a: "Hayır. Ekibin agent'ları OpenRouter modellerinde kullandıkça-öde çalışır; bu, Anthropic abonelik kotanıza hiç dokunmayan ayrı bir sayaçtır. Daha güçlü bir model gözetir, ucuz beyinler hacimli işi yapar — rutin iş için pahalı token ödemezsiniz.",
  },
  {
    q: "Ne işler yapar? Modüller neler?",
    a: "Evrak & doküman, sosyal medya (tüm platformlar), e-posta ve kod & terminal modülleriyle başlar — ve sürekli yeni modül eklenir. Modüler yapı sayesinde aklınıza gelen her iş tipi tak-çıkar eklenir. Siz isteyince ya da zamanlı çalışır; dışarıya giden her çıktıyı siz onaylarsınız.",
  },
  {
    q: "llmproxy ve graphmux nedir?",
    a: "Ekibin üstünde çalıştığı açık kaynak motorlar — Claude Code için ücretsiz eklenti olarak da var. llmproxy (komut: bmux) Claude Code'u ucuz modellerde çalıştırır ve yorucu işi onlara devreder. graphmux (komut: gmux) agent'lara kodunuzun yerel, kesin haritasını verir; böylece tahmin yürütmek yerine gerçek yapıya bakarlar. Her biri olgun bir açık çekirdeğin (LiteLLM, CodeGraph) ince, sürüm-sabitli sarmalıdır.",
  },
  {
    q: "Nasıl başlarım?",
    a: "Barındırılan platform için app.brainmux.com adresinden uygulamayı açın. Açık motorları tek başına denemek için Claude Code'da `/plugin marketplace add brainmuxhq/brainmux-plugins`, ardından `/plugin install llmproxy@brainmux` (ve `graphmux@brainmux`); sonra `bmux init`, OpenRouter anahtarınızı ekleyin, `bmux up`, `bmux test`.",
  },
];
