# brainmux — proje talimatları

> Global çalışma tarzı `~/.claude/CLAUDE.md`'de (test-önce, direkt/öz, over-engineering yok,
> yama/paralel-katman yok). Bu dosya **brainmux'a özel** teknik kurallar + karar kaydıdır.

## Ne bu proje
**brainmux** = LLM tooling markası + monorepo. Claude Code için plugin ailesi barındırır.
- **İlk plugin: `llmproxy`** (paket: `llmproxy` / `@brainmux/llmproxy`, komut: `bmux`) —
  Claude Code'u ucuz/alternatif LiteLLM "beyinleri" arasında yönlendirir ve grunt/tespit
  işini onlara **delege** eder, böylece Opus (Anthropic abonelik kotası) sadece mimari +
  review + fix'te kullanılır.
  (Not: public ad `llmproxy` — "claude" adı PUBLIC üründe kullanılmaz → Anthropic marka riski.
  Prototip `claude-proxy` klasörü migration sonrası silindi.)
- **Repo:** `brainmuxhq/brainmux` (monorepo). **Marketplace:** `/plugin marketplace add brainmuxhq/brainmux`.
- **Değer:** darboğaz Anthropic kotası (Pro 5x). Proxy beyinleri OpenRouter'da ayrı sayaçta
  çalışır → abonelik kotasına dokunmaz.

## Marka / altyapı
- Domain: **brainmux.com** (Cloudflare'de register, 2026-09-01).
- GitHub org: **`brainmuxhq`** (bare `brainmux` handle dolu — 2012 ölü kullanıcı). Marketplace repo bunun altında.
- npm scope: **`@brainmux/*`**.
- Sahiplik: Ali'nin şahıs firması (yazılım) altında.
- Claude Code = **kullanıcının kendi kurulumu** (proprietary, biz bundle/dağıtım YAPMAYIZ; sadece env set ederiz).

## Mimari kararlar (onaylı — 2026-09-01)
- **Dağıtım:** Claude Code **plugin**'i (marketplace) birincil; npm opsiyonel. Monorepo (npm workspaces), `plugins/<ad>/`, `.claude-plugin/marketplace.json`.
- **Dil:** Node/TypeScript.
- **Kod ↔ state ayrımı:** kod = plugin (versiyonlu). State = `~/.brainmux/` (BRAINMUX_HOME): `brains.yaml` · `.env` · `generated/` · `data/postgres`.
- **Config SSOT:** `brains.yaml` (zod) → **generate** → LiteLLM config + compose + init sql. "beyin ekle" = tek yaml düzenleme → regen → up.
- **Runtime:** Docker. Beyin başına 1 LiteLLM (wildcard `*`), **1 Postgres** (per-brain DB, spend/UI/growth için tutulur).
- **Routing = PORT.** Claude Code proxy'ye **opak/hash model id** yollar (test edildi 2026-09-01) → model-adına göre tek-instance routing İMKANSIZ. Beyin ayrımı port ile (bmux `ANTHROPIC_BASE_URL` set eder).
- **Kontrol paneli:** Claude Code + `bmux` **birincil** (declarative, `brains.yaml`+`.env` SSOT). **LiteLLM UI = gözlem** (spend/log/param) — link ver, tekrar yazma. **Kendi web UI YAZMA.**
- **Delege disiplini:** ucuz beyin çıktısını Opus **doğrular** (rubber-stamp yok). Task/Agent tool bu beyinlere erişemez (Opus'u miras alır) — sadece `bmux delegate`.
- **Doğal dil çalıştırma (NL → komut):** kullanıcı bir `bmux`/brainmux işini doğal dille isterse Claude uygun komutu **kendisi Bash'le çalıştırır** (elle yazdırma) ve **ne çalıştırdığını tek satır bildirir** (şeffaflık — sonuç + varsa uyarı).
  - **Güvenlik riski yoksa → doğrudan koş:** `statusline install`, `spend`, `up|down|restart|ps|health|logs`, `config list|set-model|add-brain|remove-brain`, `models`, `test`.
  - **Riskli/geri-alınamaz/secret/dışa-dönük → önce komutu + etkisini açıkla, onay al:** `delegate --yolo`, `config add-key <değer>` (secret), `statusline install --force` (mevcut ayarı ezer), veri/beyin silen ya da dış servise yazan her iş.
  - **Emin değilsen çalıştırma:** komutu ve ne yapacağını açıkla, kullanıcıya bırak. (En azından komut hakkında bilgi ver.)

## Motor: LiteLLM
- Rol: **Anthropic↔OpenAI çeviri** (streaming + tool-use). Vendored dependency, bizim kod değil.
- Lisans: çekirdek **MIT** (fork/rebrand/dağıtım serbest, notu koru). **`enterprise/` dizini proprietary → ASLA dağıtma.**
- Image: **pinle (digest) + kendi registry'ne mirrorla** (upstream ölürse etkilenme). Pinli digest: `ghcr.io/berriai/litellm-database@sha256:5ead13edd4efd89f32dab349c1f19447d395affca53f3aeae00f5e6e01b8c08d`.

## Güvenlik (public repo)
- **`.env` / gerçek key ASLA commit edilmez.** `.gitignore` zorunlu tutar. `.env.example` (template) commit'lenir.
- Postgres data (`data/`, `~/.brainmux/data`) commit edilmez.

## Test
- Unit: manifest parse/validate, **generator golden-file** (brains.yaml → compose birebir), env r/w.
- Integration: smoke — `bmux up` sonrası her beyne gerçek `/v1/messages` (text VEYA thinking-only = ayakta).
- CI: unit docker'sız, smoke docker-gated. **Test etmeden "çalışır" deme.**

## Kod disiplini
- **Katmanlar tek yön:** `cli → commands → core` (paths·manifest·env·generate·docker). Ters/atlamalı bağımlılık yok.
- **Dosya küçük + odaklı:** bir dosya = bir sorumluluk; ~500 satırı aşmadan sorumluluğa göre böl.
- **Hata yutma yok:** her komut/async yol anlamlı mesaj + doğru exit code döner; sessiz catch yok.
- **Commit hijyeni:** küçük commit (~50–200 satır), Conventional Commits; commit/push sadece Ali isteyince.
- **Docs:** konu başına tek dosya — `_v2/_FINAL` kopya yok, mevcut dosyayı yerinde düzenle; yeni doc'tan önce `docs/`'a bak.
- **README hep güncel:** her yeni komut/bayrak/özellikte `plugins/llmproxy/README.md`'yi (komut listesi + örnek) AYNI commit'te güncelle — README shipped davranıştan asla geri kalmaz.
- **Delege dengesi:** tek/bilinen-dosya işi için subagent açma (inline hızlı); subagent'ı yalnız geniş-arama/paralellik + Ali isteyince kullan.

## Referans
- Mimari spec: `docs/specs/2026-09-01-brainmux-architecture-design.md` (mevcut `claude-proxy` çalışmasından taşınacak).
- Göç: sh prototip (`claude-proxy`) → `plugins/llmproxy/` Node/TS'e taşındı (golden-parity), prototip silindi.
- Control-plane spec: `docs/specs/2026-09-02-llmproxy-control-plane-design.md`. Planlar: `docs/plans/2026-09-0{1,2}-*.md`.

## Durum & sıradaki adımlar (handoff — 2026-09-02)

> Yeni oturum bunu okusun. (Bu CLAUDE.md üst dizinden otomatik yüklenir.)

**BİTTİ — main'de (`brainmuxhq/brainmux`), user-doğrulandı:**
- Migration + control-plane tamam. Plugin marketplace'ten kurulur:
  `/plugin marketplace add brainmuxhq/brainmux` → `/plugin install llmproxy@brainmux`.
- `bmux` CLI (Node/TS; ship = self-contained esbuild bundle `dist/bmux.js`, runtime dep yok):
  init · up/down/restart · ps/logs/health · chat|deep|coder (launch) · delegate · config · spend · models · test.
- SSOT: `brains.yaml` (zod) → generate → compose + per-brain config + init sql (golden-parity).
  State `~/.brainmux/` (BRAINMUX_HOME): brains.yaml · .env (chmod 600) · generated/ · data/postgres.
- Routing = PORT; her beyin `model_name:"*"` + `drop_params:true`. 1 LiteLLM/brain + 1 Postgres.
- Skills: `delegate` + `brainmux` (plugin içinde; eski `~/.claude/skills/delegate` silindi). Slash: `/brainmux <alt-komut>`.
- LiteLLM image mirror: `ghcr.io/brainmuxhq/brainmux-litellm@sha256:693d839d50828a094b82d1c897fc0dafc526df6b27baee81eb3c2711af3d161e` (generated compose ona bakar).
- Doğrulama: 39 unit/golden test + canlı smoke (3 beyin gerçek `/v1/messages`) + fresh-clone install. CI: `.github/workflows/ci.yml` (dist-check + test).
- Prototip `claude-proxy` + fish/settings kalıntısı silindi.
- Referans: `docs/specs/2026-09-01-brainmux-architecture-design.md`, `docs/specs/2026-09-02-llmproxy-control-plane-design.md`, `docs/plans/2026-09-0{1,2}-*.md`.

**Plan 3 (OpenRouter model-picker) — BİTTİ (main `16ae4ce`):**
- SSOT: `src/core/openrouter.ts` (embedded const: api endpoint + use-case rehberi, zod-doğrulanır). Dosya değil constant (bundle-path güvenli, generate/init deseniyle tutarlı).
- `bmux models [query]` (canlı OpenRouter kataloğu, Node'da parse — uydurma yok) · `--use-cases` · `--json` (detay: benchmarks/params/reasoning/modality). Fiyat 1M-token başına. Canlı doğrulandı (421 model).
- `brainmux` skill: model/fiyat/use-case → canlı listeden öner (memory'den değil); setup **default OpenRouter** (provider menüsü yok). add-key gizli-prompt.
- Spec `docs/specs/2026-09-02-openrouter-model-picker-design.md`, plan `docs/plans/2026-09-02-openrouter-model-picker.md`. 44 test.

**Delege gözlemlenebilirlik + izolasyon — BİTTİ (main, 0.1.1→0.1.5):**
- `bmux spend` (0.1.1): beyin başına istek/token/spend (LiteLLM'den).
- `bmux delegate --stream|-v` (0.1.2→0.1.3): **insan-terminali** için tek satır canlı gösterge
  (`⏳ brain · 5/34 · <adım>` → `✅ done`; X/Y worker TodoWrite tutarsa, yoksa `step N`). TTY-only,
  dosya yok, ekstra token yok; stdout = temiz cevap. (0.1.7) Kapanışta "ne yaptı" özeti:
  `↳ N files: a.ts, b.ts · M edits` (event stream'den parse, ekstra token yok).
- `bmux delegate --mcp` (0.1.4): worker default'ta host MCP **almaz** (`--strict-mcp-config`) —
  ölçüm 147→30 tool, ~69k→~33k input token, sıfır fayda kaybı; `--mcp` (alias `--with-mcp`) ile
  opt-in. Her çağrı config'i stderr'e basar: `brain · mode · mcp on/off`.
- Delege skill (0.1.5): orchestrator flag dayatmaz; **her delegeden sonra kullanıcıya tek satır
  özet raporlar** (Claude Code best-practice: sonuç tarif et; canlı stream parent'a gitmez, cost için `--json`).
- `bmux statusline install` (0.1.6): opt-in Claude Code status line (dir·git·brain/model·effort·
  context%·cost·OpenRouter bakiye·±satır·süre). Brain adı **launcher env'inden** (`BRAINMUX_BRAIN`,
  launch.ts set eder) → port hardcode YOK, drift YOK. Script embedded const (bundle-safe), settings.json'ı
  **ezmez** (--force gerekir). Plugin `statusLine` otomatik veremez (sadece agent/subagentStatusLine) → opt-in.
- Test: 68 unit/golden. Commit'ler: `5ccca9c` (stream) · `6296daf` (mcp) · `3df3502` (skill) · `9069cb1` (statusline 0.1.6) · summary (0.1.7).

**Yayın/sertleştirme:**
- ✅ Multi-arch mirror: `ghcr.io/brainmuxhq/brainmux-litellm` (amd64+arm64), IMAGE_REF = manifest-list `sha256:693d839d…`.
- ✅ Version **0.1.17** (plugin.json + marketplace plugin entry + package.json; release zinciri 0.1.0→0.1.17).
  (0.1.17: `bmux delegate --retry [n]` — boş/hata sonuçta otomatik tekrar (net sinyal, fuzzy değil), opt-in+parametrik, non-stream yol.)
  (0.1.16: `bmux delegate --template <ad>` — hazır görev şablonları. SSOT `core/templates.ts` (embedded built-in'ler
   audit/drift-scan/review/todo-scan + `~/.brainmux/templates.yaml` user kayıtları, user override eder).
   `bmux config add-template/list-templates`. README-güncel konvansiyonu eklendi.)
  (0.1.15: `bmux delegate --verify` (opt-in) — iki-geçiş: taslak → grounded doğrulama (brave default, agent aracı seçer/sorabilir)
   her iddiayı `✅ kaynak URL`/`⚠ kaynak yok` işaretler. Canlı doğrulandı (Node LTS nüansı yakalandı). ~2x maliyet, sadece kullanınca.)
  (0.1.14: `bmux delegate --json` katı şema — `{brain,ok,result,input_tokens,output_tokens,num_turns,duration_ms,cost_usd_estimate}` (claude zarfından reshape; cost "estimate" — opak model, `bmux spend` yetkili).)
  (0.1.13: feedback backlog batch — `bmux spend --since 1h|30m|7d` (startTime pencere filtresi) ·
   `bmux install-shim` (sürüm-agnostik `~/.local/bin/bmux` launcher, sort -V + CLAUDE_CONFIG_DIR → non-interactive shell'de çalışır).)
  (0.1.12: canlı doğrulama — `--allow-tools` permission-duvarını kaldırıyor (permission_denials=[], --yolo'suz brave
   yüklü+izinli) AMA ucuz model aracı atlayıp hafızadan uydurabiliyor → delege skill'e "aracı prompt'ta ZORLA +
   tool-call gerçekten oldu mu doğrula (--stream 🔧 / boş ↳)" notu.)
  (0.1.11: Riskmatik kullanım-geri-bildirimi batch — `bmux delegate --allow-tools <csv>` (headless MCP/tool grounding,
   --yolo'suz; `mcp__…` → --mcp otomatik) · stderr "connectors disabled" gürültüsü filtrelendi (stream+sync) ·
   delegate skill grounding/halüsinasyon + concurrency notları. Roadmap: `docs/2026-09-02-bmux-usage-feedback.md`.)
  (0.1.10: 7-boyut askeri review fix'leri — model zod regex (config.yaml YAML-injection kapatıldı) ·
   statusline macOS `stat -f %m` fallback + `CLAUDE_CONFIG_DIR`/`XDG_CACHE_HOME` + atomik cache · spend all-unreachable
   exit 1 · cli non-Error catch · config set-model arg doğrulama. allowedTools "bug"u verify'da elendi — comma/space ikisi de geçerli.)
  (0.1.8: `↳` özet satırı sadece `file_path`'i sayar — Grep/Glob `path`'i dosya sanmaz.)
  (0.1.9: dsflash delege-audit fix'leri — brainmux.md add-key gizli-prompt · spend/test net "key eksik" hatası ·
   config add-brain port int doğrulama · test paralel prob (allSettled) · delegate tırnaksız task join ·
   statusline OpenRouter key `-H @-` stdin (argv/proc sızıntısı yok) · README/SKILL --mcp/--with-mcp.)
- ⏳ **GHCR paketini public yap** (org UI: brainmuxhq/packages → brainmux-litellm → settings → Change visibility → Public). Dış kullanıcıların `bmux up`'ta image çekmesi için ŞART; şu an private.
- (opsiyonel) `?category=` doğrula + `bmux models --category`; direkt-provider (`deepseek`/`openai`) /models listeleri.
