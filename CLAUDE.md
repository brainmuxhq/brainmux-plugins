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
  init · up/down/restart · ps/logs/health · chat|deep|coder (launch) · delegate · config · test.
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

**Sıradaki iş — yayın/sertleştirme (opsiyonel):**
1. GHCR paketini public yap (`ghcr.io/brainmuxhq/brainmux-litellm`) + multi-arch mirror (şu an amd64 tek-platform).
2. marketplace/plugin `version` 0.0.0 → semver bump (yayın anında).
3. (istenirse) `?category=` doğrula + `bmux models --category`; direkt-provider (`deepseek`/`openai`) /models listeleri.
