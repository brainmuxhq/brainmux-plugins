# brainmux — proje talimatları

> Global çalışma tarzı `~/.claude/CLAUDE.md`'de (test-önce, direkt/öz, over-engineering yok,
> yama/paralel-katman yok). Bu dosya **brainmux'a özel** teknik kurallar + karar kaydıdır.

## Ne bu proje
**brainmux** = LLM tooling markası + monorepo. Claude Code için plugin ailesi barındırır.
- **İlk plugin: `llmproxy`** (paket: `llmproxy` / `@brainmux/llmproxy`, komut: `bmux`) —
  Claude Code'u ucuz/alternatif LiteLLM "beyinleri" arasında yönlendirir ve grunt/tespit
  işini onlara **delege** eder, böylece Opus (Anthropic abonelik kotası) sadece mimari +
  review + fix'te kullanılır.
  (Not: yerel prototip klasörü `claude-proxy` adıyla kalır — özel klasör, marka sorunu yok.
  "claude" adı yalnız PUBLIC üründe kullanılmaz → Anthropic marka riski. Bu yüzden public
  ad `llmproxy`.)
- **Repo:** `brainmuxhq/brainmux` (monorepo). **Marketplace:** `/plugin marketplace add brainmuxhq/brainmux`.
- **Değer:** darboğaz Anthropic kotası (Pro 5x). Proxy beyinleri OpenRouter'da ayrı sayaçta
  çalışır → abonelik kotasına dokunmaz.

## Marka / altyapı
- Domain: **brainmux.com** (Cloudflare'de register, 2026-09-01).
- GitHub org: **`brainmuxhq`** (bare `brainmux` handle dolu — 2012 ölü kullanıcı). Marketplace repo bunun altında.
- npm scope: **`@brainmux/*`**.
- Sahiplik: Ali'nin şahıs firması (yazılım) altında. (WeCodeApps = ayrı/eski portfolio markası, karıştırma.)
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

## Referans
- Mimari spec: `docs/specs/2026-09-01-brainmux-architecture-design.md` (mevcut `claude-proxy` çalışmasından taşınacak).
- Göç: mevcut `~/Development/Projects/claude-proxy` (çalışan sh prototip, klasör adı kalır) → `plugins/llmproxy/`'a Node olarak taşınır; brains.yaml'dan golden-parity ile üretilir.
