import CopyButton from "./CopyButton";
import StructuredData from "./StructuredData";
import { FAQ } from "./faq";
import { BrainmuxMark, LlmproxyMark, GraphmuxMark } from "./marks";
import MimariAkis from "./MimariAkis";

// Sistem çevrimiçi mi (Render core). 30 sn cache — pazarlama sayfası hızlı kalsın, core'u dövmesin.
async function sistemAcik(): Promise<boolean> {
  const core = process.env.CORE_URL ?? "https://brainmux-core.onrender.com";
  try {
    const r = await fetch(`${core}/health`, { next: { revalidate: 30 } });
    return r.ok;
  } catch {
    return false;
  }
}

export default async function Home() {
  const acik = await sistemAcik();
  return (
    <>
      <StructuredData />
      <header>
        <div className="wrap nav">
          <a className="brand" href="#top">
            <BrainmuxMark size={20} />brain<span className="accent">mux</span>
          </a>
          <nav className="nav-right">
            <a href="#nasil">Nasıl çalışır</a>
            <a href="#gizlilik">Gizlilik</a>
            <a href="#moduller">Modüller</a>
            <a href="#acik">Açık kaynak</a>
          </nav>
        </div>
      </header>

      <main className="wrap" id="top">
        {/* HERO */}
        <section className="hero" style={{ borderTop: "none" }}>
          <div>
            <p className="eyebrow">yapay zeka agent platformu</p>
            <h1>İşinizi yürüten 7/24 yapay zeka ekibi — <span className="accent">veriniz sizde kalır</span>.</h1>
            <p className="lede">
              Görevleri kendi arasında paylaşan, zamanı gelince otomatik çalışan ve verdiğiniz işleri
              tamamlayan bir ekip. Veriniz ve modeliniz <strong>sizin makinenizde</strong> çalışır; bulut yalnızca
              giriş ve aboneliği yönetir — dışarı hiçbir şey çıkmaz.
            </p>
            <div className="cta-row">
              <a className="btn btn-primary" href="https://app.brainmux.com" target="_blank" rel="noopener noreferrer">Uygulamaya git →</a>
              <a className="btn btn-ghost" href="#nasil">Nasıl çalışır</a>
            </div>
            <div className="stat" aria-live="polite">
              <span className="stat-dot" data-up={acik ? "1" : "0"} />
              sistem: {acik ? "çevrimiçi" : "başlatılıyor"}
            </div>
          </div>

          <div className="term">
            <div className="term-bar"><i /><i /><i /><span className="t">brainmux · ekip</span></div>
            <div className="term-body">
              <div className="row"><span className="out">▸ gözetmen</span><span className="ok">çevrimiçi</span></div>
              <div className="row"><span className="out">▸ agent · evrak</span><span className="cmt">çalışıyor · 3 görev</span></div>
              <div className="row"><span className="out">▸ agent · sosyal medya</span><span className="cmt">onay bekliyor</span></div>
              <div className="row"><span className="out">▸ zamanlı · 09:00 gönderi</span><span className="cmt">hazırlanıyor</span><span className="cursor" /></div>
            </div>
          </div>
        </section>

        {/* NE — cevap-önce blok */}
        <section id="ne" aria-label="brainmux nedir">
          <p className="eyebrow">nedir</p>
          <p className="answer">
            brainmux, <strong>7/24 çalışan bir yapay zeka ekibidir</strong>. İş verirsiniz; ekip planlar, işleri
            kendi arasında paylaşır, zamanlanmış görevleri yürütür ve tamamlar — <strong>kendi verilerinize
            dayanarak</strong>. Ekip ve veritabanı <strong>sizin makinenizde bir kutu (container) içinde</strong>
            çalışır; bulut yalnızca giriş + faturadır. Böylece <strong>veriniz dışarı çıkmaz</strong> — dışarıya giden
            her çıktıyı da siz onaylarsınız.
          </p>
        </section>

        {/* GİZLİLİK — neden */}
        <section id="gizlilik">
          <div className="sec-head">
            <p className="eyebrow">neden brainmux</p>
            <h2>Veriniz makinenizde; ekip sizin için çalışır.</h2>
          </div>
          <div className="cards3">
            <div className="card">
              <span className="k" style={{ color: "var(--teal)" }}>gizlilik</span>
              <h3>Veriniz dışarı çıkmaz</h3>
              <p>Ekip ve veritabanı kendi makinenizde çalışır. Veriniz ne bize gelir ne bizde işlenir — tek komutla kurar, verinizi içe aktarırsınız.</p>
            </div>
            <div className="card">
              <span className="k" style={{ color: "var(--amber)" }}>esnek beyin</span>
              <h3>Modeli siz seçersiniz</h3>
              <p>Kendi yerel modelinizi çalıştırın, kendi uzak modelinizi bağlayın ya da bizim model havuzumuzu kullanın. Kararı siz verirsiniz.</p>
            </div>
            <div className="card">
              <span className="k" style={{ color: "#8B8CF9" }}>iki seçenek</span>
              <h3>Kendi makineniz ya da bizde</h3>
              <p>Verisi hiç çıkmayan <strong>kendi makinenizde</strong>, ya da kurulum istemeyen <strong>bizde (kolay)</strong>. Giriş + fatura her ikisinde de buluttan.</p>
            </div>
          </div>
        </section>

        {/* MODÜLLER */}
        <section id="moduller">
          <div className="sec-head">
            <p className="eyebrow">ne yapar · modüller</p>
            <h2>Ekip, işinizi modüllerle yürütür — sürekli büyür.</h2>
          </div>
          <div className="cards3">
            <div className="card"><span className="k" style={{ color: "var(--amber)" }}>evrak</span><h3>Evrak &amp; Doküman</h3><p>Resmî yazı, dilekçe, sözleşme, rapor taslakları — Türkçe, yerel formatlara uygun.</p></div>
            <div className="card"><span className="k" style={{ color: "#8B8CF9" }}>sosyal medya</span><h3>Tüm Platformlar</h3><p>İçerik hazırlar ve paylaşır: X, LinkedIn, Instagram, Facebook ve dahası.</p></div>
            <div className="card"><span className="k" style={{ color: "var(--teal)" }}>mail</span><h3>E-posta</h3><p>Gelen kutusunu okur, sınıflandırır, taslak yanıt hazırlar.</p></div>
            <div className="card"><span className="k" style={{ color: "#8B8CF9" }}>geliştirici</span><h3>Kod &amp; Terminal</h3><p>VS Code ve terminalle entegre — kendi kodunuzda, koda dayalı çalışır.</p></div>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 18 }}>
            <strong style={{ color: "var(--fg)" }}>⏰ İki türlü çalışır:</strong> siz isteyince ya da zamanlanmış (örn. &quot;her sabah 09:00&apos;da gönderiyi hazırla&quot;).
            Dışarıya giden her çıktıyı <strong style={{ color: "var(--fg)" }}>siz onaylarsınız</strong>. Yeni modüller sürekli eklenir.
          </p>
        </section>

        {/* NASIL ÇALIŞIR — mimari akış */}
        <section id="nasil">
          <div className="sec-head">
            <p className="eyebrow">nasıl çalışır · ne nerede koşar</p>
            <h2>Bulut kapı + kasa; makineniz fabrika.</h2>
            <p>
              Buluttan giriş yapar ve aboneliğinizi yönetirsiniz. Ekip ve veritabanı bir kutu (container)
              içinde çalışır — <strong>kendi makinenizde</strong> ya da isterseniz <strong>bizde</strong>.
              Veriniz makinenizde kalır; ekip hazırlar, dışarıya giden çıktıyı siz onaylarsınız.
            </p>
          </div>
          <MimariAkis />
        </section>

        {/* AÇIK KAYNAK — funnel */}
        <section id="acik">
          <div className="sec-head">
            <p className="eyebrow">açık kaynak</p>
            <h2>Ekibin çalıştığı motorlar açık. Tek başına, ücretsiz kullanın.</h2>
            <p>Ucuz-beyin yönlendirme ve koda dayalı çalışma, Claude Code için ücretsiz eklentiler olarak da var.</p>
          </div>
          <div className="prod">
            <div className="card">
              <div className="top"><span style={{ display: "flex", alignItems: "center", gap: 11 }}><LlmproxyMark size={26} /><h3>llmproxy</h3></span><span className="badge live">Ücretsiz · MIT</span></div>
              <p>Claude Code&apos;u ucuz modellerde çalıştırın ve yorucu işi onlara devredin — tek anahtar, binlerce model.</p>
              <a className="explore" href="https://github.com/brainmuxhq/brainmux-plugins" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
            </div>
            <div className="card">
              <div className="top"><span style={{ display: "flex", alignItems: "center", gap: 11 }}><GraphmuxMark size={26} /><h3>graphmux</h3></span><span className="badge live">Ücretsiz · MIT</span></div>
              <p>Yapay zekaya kodunuzun gerçek haritasını verir — tahmin yürütmek yerine gerçek yapıya bakar. %100 yerel.</p>
              <a className="explore" href="https://github.com/brainmuxhq/brainmux-plugins" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
            </div>
          </div>

          <div className="term" style={{ marginTop: 18 }}>
            <div className="term-bar"><i /><i /><i /><span className="t">kurulum · Claude Code</span></div>
            <div className="term-body">
              <div className="row"><span className="prompt">&gt;</span><span>/plugin marketplace add brainmuxhq/brainmux-plugins</span><CopyButton text="/plugin marketplace add brainmuxhq/brainmux-plugins" /></div>
              <div className="row"><span className="prompt">&gt;</span><span>/plugin install llmproxy@brainmux</span><CopyButton text="/plugin install llmproxy@brainmux" /></div>
              <div className="row"><span className="prompt">&gt;</span><span>/plugin install graphmux@brainmux</span><CopyButton text="/plugin install graphmux@brainmux" /></div>
              <div className="row"><span className="ok">✓ kuruldu: llmproxy · graphmux</span><span className="cursor" /></div>
            </div>
          </div>
        </section>

        {/* SSS */}
        <section id="sss">
          <div className="sec-head"><p className="eyebrow">SSS</p><h2>Sık sorulanlar.</h2></div>
          <div className="faq">
            {FAQ.map((f, i) => (
              <details className="qa" key={f.q} open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap foot">
          <span className="brand mono"><BrainmuxMark size={16} />brain<span className="accent">mux</span></span>
          <span>Türkiye&apos;nin yapay zeka agent platformu · veriniz sizde kalır</span>
          <span style={{ display: "flex", gap: 20 }}>
            <a href="https://app.brainmux.com" target="_blank" rel="noopener noreferrer">Uygulama</a>
            <a href="https://github.com/brainmuxhq/brainmux-plugins" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="/">brainmux.com</a>
          </span>
        </div>
      </footer>
    </>
  );
}
