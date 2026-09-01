# brainmux.com Website — Design

**Date:** 2026-09-02
**Status:** Approved (design) — pending spec review → implementation plan
**Deploy:** Vercel (root dir `web/`), domain `brainmux.com` (Cloudflare DNS → Vercel).

## 1. Purpose

A landing page for the brainmux brand + the `llmproxy` plugin: explain the value (run Claude Code
on cheap brains, save Opus quota), show the one-line install, and link to GitHub. Structured so
`/docs` and `/blog` can be added later without a rewrite.

## 2. Stack

- **Next.js** (App Router) + **TypeScript (strict/full)** + **Tailwind CSS**. Lives in `web/`.
- Static-first: the landing is a server component with no client JS beyond a tiny copy-to-clipboard
  button. Fast, no heavy assets.
- Deploy on **Vercel** (project root = `web/`). Domain `brainmux.com` via Cloudflare → Vercel.
- Language: **English** only (product + audience are English). No i18n, no CMS.

## 3. Aesthetic

Dark, developer-tool, **terminal motif** (brainmux is a CLI). Monospace accents for commands;
copyable terminal blocks; a restrained accent color; minimal, fast, no stock imagery. Text
wordmark "brainmux" + a small mark; emoji-or-SVG favicon. Accessible contrast, responsive
(mobile → desktop), no horizontal scroll (code blocks scroll inside their own container).

## 4. Structure

```
web/
├─ app/
│  ├─ layout.tsx          # root layout, metadata (title/description/OG), font, dark theme
│  ├─ page.tsx            # the landing (composes the sections below)
│  └─ globals.css         # Tailwind + a few tokens
├─ components/
│  ├─ Hero.tsx · ValueProps.tsx · HowItWorks.tsx · Features.tsx · Quickstart.tsx · Footer.tsx
│  └─ CopyCommand.tsx     # client: copy-to-clipboard for a command line
├─ package.json · tsconfig.json (strict) · next.config.ts · tailwind config · postcss
```
Each section is its own focused component. `/docs` later = new route under `app/`.

## 5. Content (copy — verbatim)

- **Hero:** headline "Run Claude Code on cheap brains." · sub "brainmux routes Claude Code to cheap
  OpenRouter models and delegates the grunt work to them — so your Opus quota goes to architecture
  and review, not busywork." · install block:
  `/plugin marketplace add brainmuxhq/brainmux` then `/plugin install llmproxy@brainmux` · buttons: **GitHub** (repo), **Get started** (→ Quickstart).
- **Value props** (3 cards): "One key, thousands of models — a single OpenRouter key reaches
  DeepSeek, Qwen, GLM, GPT, Gemini and more." · "Separate meter — the brains run pay-as-you-go on
  OpenRouter and never touch your Anthropic subscription quota." · "Opus stays the orchestrator —
  cheap brains do the volume; Opus reviews and fixes."
- **How it works:** "One `brains.yaml` (zod-validated) is the source of truth. `bmux` generates a
  Docker Compose stack — one LiteLLM proxy per brain, isolated by port — and points Claude Code at
  the brain you choose." Small terminal/diagram snippet.
- **Features** (4): **bmux CLI** (init · up/down · health · config add-brain/set-model · test) ·
  **Delegate** (offload bulk/detection to a cheap brain headless; Opus verifies — no rubber-stamp) ·
  **Live model picker** (`bmux models` browses the live OpenRouter catalog; pick per use-case) ·
  **Observability** (per-brain LiteLLM UI for spend, logs, params).
- **Quickstart** (terminal block):
  ```
  /plugin marketplace add brainmuxhq/brainmux
  /plugin install llmproxy@brainmux
  bmux init
  bmux config add-key OPENROUTER_API_KEY   # hidden prompt — key not echoed
  bmux up
  bmux test
  ```
- **Footer:** GitHub (brainmuxhq/brainmux) · brainmux.com · "Engine: LiteLLM (MIT)" · "MIT licensed" · requires Docker + an OpenRouter key.

## 6. Metadata / SEO

`<title>` "brainmux — run Claude Code on cheap brains" · meta description = the hero sub · Open
Graph title/description/site + a simple OG image (static). `robots` allow. Canonical `https://brainmux.com`.

## 7. Build / deploy

- `web/` is its own npm project (not part of the plugin workspace) → Vercel builds it independently.
- Vercel project: root directory `web/`, framework Next.js (auto), build `next build`.
- Domain `brainmux.com`: add in Vercel, set Cloudflare DNS (CNAME/A per Vercel) — Cloudflare proxy off or "DNS only" so Vercel serves.
- A **preview-first** loop: build the landing as a self-contained Artifact for fast visual approval, then port the approved layout into the Next components + deploy a Vercel preview → promote to production once it looks right.

## 8. Non-goals (YAGNI)

- Docs/blog content (structure-ready, not built now).
- i18n / language toggle, CMS, analytics beyond Vercel's built-in, auth, forms.
- Custom illustrations/animation beyond light CSS.
