import { FAQ } from "../faq";

// /llms.txt — yapay zeka yanıt motorları için düz-metin özet (GEO). Sayfa ve JSON-LD
// ile aynı FAQ kaynağından türetilir.
export const dynamic = "force-static";

export function GET() {
  const faq = FAQ.map((f) => `S: ${f.q}\nC: ${f.a}`).join("\n\n");

  const body = `# brainmux

> İşinizi yürüten 7/24 yapay zeka ekibi. Ekip ve veritabanı sizin makinenizde bir kutu
> (container) içinde çalışır; bulut yalnızca giriş ve aboneliği yönetir. Böylece veriniz
> dışarı çıkmaz.

## Ne yapar
brainmux, 7/24 çalışan bir yapay zeka ekibidir. İş verirsiniz (bir görev ya da zamanlanmış
bir plan); bir gözetmen agent işi böler ve ucuz agent'lara paslar, her biri harekete
geçmeden önce verinize dayanır, gözetmen sonucu denetler. Ekip ve veritabanı sizin
makinenizde bir kutu içinde çalışır — veriniz dışarı çıkmaz. İki seçenek vardır: verinin
hiç çıkmadığı "kendi makinenizde" ya da kurulum istemeyen "bizde". Giriş ve fatura her
ikisinde de buluttandır. Modeli siz seçersiniz: kendi yerel modeliniz, kendi uzak modeliniz
ya da bizim havuzumuz.

## Önemli noktalar
- Kendi makinenizde seçeneğinde veri makinede kalır; ne bize gelir ne bizde işlenir.
- Bulut yalnızca kimlik + abonelik/faturadır; iş verisi bulutta tutulmaz (bizde seçeneğinde faturadan ayrı bir yerde durur).
- Model sizin: kendi yerel modelinizi çalıştırın, kendi uzak modelinizi bağlayın ya da bizim havuzumuzu kullanın.
- İşçiler ucuz OpenRouter modellerinde ayrı sayaçta çalışır — Anthropic abonelik kotanıza dokunulmaz.
- Ekip siz isteyince ya da zamanlı (cron) çalışır; dışarıya giden her çıktıyı siz onaylarsınız.
- Ekibin üstünde çalıştığı motorlar (llmproxy, graphmux) açık kaynak ve MIT lisanslı, tek başına da kullanılır.

## Modüller
Evrak & doküman · sosyal medya (tüm platformlar) · e-posta · kod & terminal — ve sürekli yeni modül.

## Açık motorları kur (Claude Code içinde)
/plugin marketplace add brainmuxhq/brainmux-plugins
/plugin install llmproxy@brainmux

## Hızlı başlangıç (terminal)
bmux init
bmux config add-key OPENROUTER_API_KEY   # gizli istem; anahtar ekrana yazılmaz
bmux up
bmux test

## Komutlar
bmux init | up | down | restart | ps | logs [brain] | health
bmux <brain> [claude args]        # bir beyinde Claude Code başlat (chat/deep/coder)
bmux delegate <brain> "<görev>"   # headless yorucu iş; Opus doğrular
bmux config add-brain | remove-brain | set-model | add-key | list
bmux models [sorgu] | --use-cases | --json   # canlı OpenRouter kataloğu
bmux spend                        # beyin başına istek/token/harcama
bmux test                         # her beyni /v1/messages ile dener

## graphmux (komut: gmux)
- Claude Code ve bmux agent'ları için yerel, kesin kod grafiği — embedding yok, bulut yok, telemetri kapalı.
- Kur: /plugin install graphmux@brainmux
- gmux install                 # sabitlenmiş CodeGraph ikilisini indir + SHA256 doğrula, MCP yapılandırmasını yaz
- gmux index [yol]             # bir depo için kod grafiğini oluştur/yenile
- gmux status | sync [yol]     # grafik istatistikleri / değişiklikleri eşitle
- gmux -- explore | callers | callees | impact | node   # grafiği sorgula
- bmux delegate <brain> --memory "<görev>"   # ucuz beyni kod grafiğine dayandır (halüsinasyonu keser)

## Bağlantılar
- GitHub: https://github.com/brainmuxhq/brainmux-plugins
- Site: https://brainmux.com
- Motorlar: LiteLLM (MIT) + CodeGraph (MIT)

## SSS
${faq}
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
