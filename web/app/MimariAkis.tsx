// Mimari akış diyagramı — landing'in görsel omurgası. Her yapıya ayrı SVG (kutu/ekip/
// veritabanı/MCP/plugin/model/bulut) → "ne nerede koşar" bir bakışta anlaşılsın.
// Statik: client JS yok. Stiller globals.css'te .arch* altında.

function Ico({ id, color, className }: { id: string; color?: string; className?: string }) {
  return (
    <svg className={`arch-ico ${className ?? ""}`} style={color ? { color } : undefined} aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}

export default function MimariAkis() {
  return (
    <div className="arch">
      {/* ikon tanımları (bir kez) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <g id="a-fleet">
            <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
              <path d="M5 12h4M11 12 19 6M11 12h8M11 12 19 18" />
            </g>
            <g fill="currentColor">
              <circle cx="4" cy="12" r="1.7" /><circle cx="11" cy="12" r="2.3" />
              <circle cx="19" cy="6" r="1.8" /><circle cx="19" cy="12" r="1.8" /><circle cx="19" cy="18" r="1.8" />
            </g>
          </g>
          <g id="a-db" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="6" rx="7" ry="2.8" />
            <path d="M5 6v12c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8V6" />
            <path d="M5 12c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8" />
          </g>
          <g id="a-mcp" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3v4M15 3v4" /><rect x="7" y="7" width="10" height="6" rx="1.5" />
            <path d="M12 13v3.5a3 3 0 0 0 3 3h1.5" />
          </g>
          <g id="a-plugin" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
            <rect x="4" y="4" width="7" height="7" rx="1.3" /><rect x="13" y="4" width="7" height="7" rx="1.3" />
            <rect x="4" y="13" width="7" height="7" rx="1.3" /><rect x="13.5" y="13.5" width="6" height="6" rx="1.3" strokeDasharray="2.4 2.2" />
          </g>
          <g id="a-model" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <rect x="7" y="7" width="10" height="10" rx="1.6" /><rect x="10" y="10" width="4" height="4" rx="0.6" />
            <path d="M10 7V4.5M14 7V4.5M10 19.5V17M14 19.5V17M7 10H4.5M7 14H4.5M19.5 10H17M19.5 14H17" />
          </g>
          <g id="a-cloud" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.5 18a3.7 3.7 0 0 1 .4-7.4 4.8 4.8 0 0 1 9.2 1.4A3.3 3.3 0 0 1 16.5 18z" />
            <rect x="9.7" y="13" width="4.6" height="3.6" rx="1" /><path d="M10.7 13v-1a1.3 1.3 0 0 1 2.6 0v1" />
          </g>
          <g id="a-container" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
            <rect x="3" y="7" width="18" height="12" rx="1.6" /><path d="M7.2 7v12M11 7v12M14.8 7v12" strokeWidth={1.3} />
          </g>
          <g id="a-user" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
            <circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
          </g>
        </defs>
      </svg>

      {/* açıklama şeridi (ikon → anlam) */}
      <div className="arch-legend">
        <span className="arch-leg"><Ico id="a-container" color="var(--muted)" className="sm" /><b>kutu</b> (container)</span>
        <span className="arch-leg"><Ico id="a-fleet" color="var(--teal)" className="sm" /><b>ekip</b> (yapay zeka)</span>
        <span className="arch-leg"><Ico id="a-db" color="var(--teal)" className="sm" /><b>veritabanı</b></span>
        <span className="arch-leg"><Ico id="a-mcp" color="var(--iris)" className="sm" /><b>bağlantı</b> (MCP)</span>
        <span className="arch-leg"><Ico id="a-plugin" color="var(--amber)" className="sm" /><b>eklenti</b> (plugin)</span>
        <span className="arch-leg"><Ico id="a-model" color="var(--amber)" className="sm" /><b>model</b> (beyin)</span>
        <span className="arch-leg"><Ico id="a-cloud" color="var(--amber)" className="sm" /><b>bulut</b> (giriş+fatura)</span>
      </div>

      {/* akış */}
      <div className="arch-flow">
        <div className="arch-node">
          <div className="arch-top"><Ico id="a-user" color="var(--muted)" /><div><div className="arch-lab">kullanıcı</div><div className="arch-big">İşletme / Kullanıcı</div></div></div>
        </div>
        <div className="arch-arrow">↓ <span className="arch-cap">giriş yapar</span></div>

        <div className="arch-node control">
          <div className="arch-top"><Ico id="a-cloud" /><div><div className="arch-lab">herkese ortak · bulut (bizde)</div><div className="arch-big">Giriş + Abonelik / Fatura</div></div></div>
          <div className="arch-sub">Kim olduğunuzu ve aboneliğinizi doğrular. <b>İşinizin verisi burada YOK.</b></div>
        </div>
        <div className="arch-arrow">↓ <span className="arch-cap">seçtiğiniz yerde, bir kutu içinde çalışır</span></div>

        <div className="arch-split">
          {/* KENDİ MAKİNENİZDE */}
          <div className="arch-tier local">
            <div className="arch-head"><span className="arch-name">◈ Kendi makinenizde</span><span className="arch-tag hot">veri çıkmaz</span></div>
            <div className="arch-where">Nerede: <b>sizin sunucunuz / bilgisayarınız</b> — tek komutla kurulur</div>
            <div className="arch-cframe">
              <span className="arch-cbadge"><Ico id="a-container" className="sm" />kutu · sizin makinenizde</span>
              <div className="arch-comp"><Ico id="a-fleet" color="var(--teal)" /><div className="arch-txt"><span className="arch-nm">Yapay zeka ekibi</span><span className="arch-nt">agent'lar görevleri yapar</span></div></div>
              <div className="arch-comp"><Ico id="a-db" color="var(--teal)" /><div className="arch-txt"><span className="arch-nm">Veritabanı</span><span className="arch-nt">veriniz burada durur</span></div></div>
              <div className="arch-comp"><Ico id="a-mcp" color="var(--iris)" /><div className="arch-txt"><span className="arch-nm">Bağlantılar</span><span className="arch-nt">kendi araç + verilerinize</span></div></div>
            </div>
            <div className="arch-comp solo"><Ico id="a-model" color="var(--amber)" /><div className="arch-txt"><span className="arch-nm">Model — 3 yol</span><span className="arch-nt">kendi yerel modeliniz · kendi uzak modeliniz · bizim havuzumuz</span></div></div>
            <div className="arch-foot">Veri + ekip hep <b>sizde</b>. Sadece prompt modele göre gider.</div>
          </div>

          {/* BİZDE */}
          <div className="arch-tier managed">
            <div className="arch-head"><span className="arch-name">☁ Bizde (kolay)</span><span className="arch-tag">hazır</span></div>
            <div className="arch-where">Nerede: <b>bizim sunucumuz</b> — kurulum yok, aç kullan</div>
            <div className="arch-cframe">
              <span className="arch-cbadge"><Ico id="a-container" className="sm" />kutu · bizim sunucumuzda</span>
              <div className="arch-comp"><Ico id="a-fleet" color="var(--amber)" /><div className="arch-txt"><span className="arch-nm">Yapay zeka ekibi</span><span className="arch-nt">bizde çalışır</span></div></div>
              <div className="arch-comp"><Ico id="a-db" color="var(--amber)" /><div className="arch-txt"><span className="arch-nm">Veritabanı</span><span className="arch-nt">bizde · faturadan ayrı</span></div></div>
              <div className="arch-comp"><Ico id="a-mcp" color="var(--iris)" /><div className="arch-txt"><span className="arch-nm">Bağlantılar</span><span className="arch-nt">buluttaki araçlara</span></div></div>
            </div>
            <div className="arch-comp solo"><Ico id="a-model" color="var(--amber)" /><div className="arch-txt"><span className="arch-nm">Model</span><span className="arch-nt">bizim havuzumuz ya da kendi modeliniz</span></div></div>
            <div className="arch-foot">Kolay + hızlı; verinizi biz tutarız (siz kabul edersiniz).</div>
          </div>
        </div>

        {/* eklenti katmanı */}
        <div className="arch-bridge">
          <div className="arch-brow"><Ico id="a-mcp" color="var(--iris)" /><div><div className="arch-bt">Bağlantılar (MCP) — yakın ile uzağı bağlar</div><p>Her veri, araç ve dış servis bir bağlantıdır; ekip hepsine tek adresten ulaşır — birbirinden yalıtık, iki yönlü.</p></div></div>
          <div className="arch-brow"><Ico id="a-plugin" color="var(--amber)" /><div><div className="arch-bt">Eklentiler (plugin) — hazır yetenekler</div><p>Ucuz-beyin yönlendirme, koda dayalı çalışma gibi yetenekler mağazadan tek tıkla eklenir.</p></div></div>
        </div>
      </div>
    </div>
  );
}
