# brainmux.com Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. This is a visual landing page — verification is "`next build` clean + renders correctly", not unit tests.

**Goal:** Build the brainmux.com landing page (Next.js App Router + strict TS + Tailwind) in `web/`, then deploy it to Vercel on the `brainmux.com` domain.

**Architecture:** A static-first Next.js landing composed of focused section components (Hero, ValueProps, HowItWorks, Features, Quickstart, Footer) plus a tiny client `CopyCommand`. Content + copy come verbatim from the design spec. Preview-first: prototype the look as a self-contained Artifact for visual approval, then port it into the Next components and deploy.

**Tech Stack:** Next.js (App Router), TypeScript (strict), Tailwind CSS, Vercel.

## Global Constraints (from `docs/specs/2026-09-02-brainmux-website-design.md`)

- English only; no i18n/CMS/auth/forms. Dark, developer-tool, terminal motif. Fast, no heavy imagery; no horizontal scroll (code blocks scroll inside their own container).
- Stack: Next.js App Router + **TypeScript strict** + Tailwind, in `web/`. `web/` is a standalone npm project (NOT part of the plugin workspace).
- Copy is verbatim from spec §5; metadata/SEO from spec §6.
- Deploy: Vercel, project root `web/`, domain `brainmux.com` (Cloudflare DNS → Vercel).
- Install command shown on the site: `/plugin marketplace add brainmuxhq/brainmux` then `/plugin install llmproxy@brainmux`.

## File Structure

```
web/
├─ app/{layout.tsx, page.tsx, globals.css}
├─ components/{Hero,ValueProps,HowItWorks,Features,Quickstart,Footer,CopyCommand}.tsx
├─ public/{favicon, og image}
├─ package.json · tsconfig.json (strict) · next.config.ts · postcss.config.mjs · tailwind (v4 via @tailwindcss/postcss) · .gitignore
```

---

### Task 1: Visual preview (Artifact) — approve the look before building Next

**Files:** a scratch HTML file rendered via the Artifact tool (not committed to `web/`).

- [ ] **Step 1: Load the `artifact-design` skill** (required before using the Artifact tool) to calibrate design investment.
- [ ] **Step 2: Build a self-contained landing** (single HTML, inline CSS, the spec §5 copy, terminal-motif dark theme, all six sections) and render it via the Artifact tool for the user to see.
- [ ] **Step 3: Iterate** on layout/color/type with the user until they approve the look. This is the visual design gate — the approved Artifact is the reference for the Next port.

---

### Task 2: Scaffold the Next.js app in `web/`

**Files:** Create `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`, `web/postcss.config.mjs`, `web/app/globals.css`, `web/app/layout.tsx`, `web/app/page.tsx` (placeholder), `web/.gitignore`. Modify root `.gitignore` if needed (ignore `web/.next`, `web/node_modules`).

**Interfaces:**
- Produces: a Next app that `next build`s clean and serves an (interim) page, ready for the section components.

- [ ] **Step 1: `package.json`** — Next + React + TS + Tailwind v4:
```json
{
  "name": "brainmux-web",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start", "lint": "next lint" },
  "dependencies": { "next": "^15.1.0", "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": {
    "typescript": "^5.6.0", "@types/node": "^20.14.0", "@types/react": "^19.0.0", "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0", "@tailwindcss/postcss": "^4.0.0", "postcss": "^8.4.0"
  }
}
```
- [ ] **Step 2: `tsconfig.json`** — strict, Next defaults:
```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["dom","dom.iterable","esnext"], "jsx": "preserve",
    "module": "esnext", "moduleResolution": "bundler", "strict": true, "noEmit": true,
    "esModuleInterop": true, "skipLibCheck": true, "resolveJsonModule": true, "isolatedModules": true,
    "incremental": true, "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```
- [ ] **Step 3: `postcss.config.mjs`** → `export default { plugins: { "@tailwindcss/postcss": {} } };`. `next.config.ts` → `import type { NextConfig } from "next"; const c: NextConfig = {}; export default c;`. `app/globals.css` → `@import "tailwindcss";` + a few CSS tokens (dark bg, mono font var). `web/.gitignore` → `node_modules`, `.next`, `next-env.d.ts`, `.vercel`.
- [ ] **Step 4: `app/layout.tsx`** — root layout: dark `<html>`, font, and the spec §6 `metadata` export (title, description, openGraph, canonical `https://brainmux.com`).
- [ ] **Step 5: Install + build.**
  Run: `cd ~/Development/Projects/brainmux/web && npm install && npm run build`
  Expected: `next build` exits 0 (compiles the placeholder page).
- [ ] **Step 6: Commit.**
```bash
cd ~/Development/Projects/brainmux
git add web/ .gitignore
git commit -m "feat(web): scaffold Next.js + strict TS + Tailwind landing app"
```

### Task 3: Build the landing sections (port the approved Artifact)

**Files:** Create the six section components + `CopyCommand.tsx`; fill `app/page.tsx` to compose them; add `public/` favicon + OG image.

**Interfaces:**
- Consumes: the approved Artifact layout (Task 1); copy from spec §5.
- Produces: the finished landing at `/`.

- [ ] **Step 1:** Implement `components/CopyCommand.tsx` (client component: renders a command line + a copy-to-clipboard button using `navigator.clipboard`).
- [ ] **Step 2:** Implement `Hero`, `ValueProps`, `HowItWorks`, `Features`, `Quickstart`, `Footer` as server components with Tailwind, using the verbatim copy from spec §5 and the approved visual style. Terminal blocks use `CopyCommand` where a command should be copyable.
- [ ] **Step 3:** Compose them in `app/page.tsx` (in order). Add `public/` favicon + a static OG image.
- [ ] **Step 4: Build + local render check.**
  Run: `cd ~/Development/Projects/brainmux/web && npm run build && npm run start &` then fetch `http://localhost:3000` (curl for 200 + key strings like "Run Claude Code on cheap brains") ; stop the server.
  Expected: build clean; page contains the hero headline, the install command, and all section headings; no console errors; responsive (no horizontal scroll).
- [ ] **Step 5: Commit.**
```bash
cd ~/Development/Projects/brainmux
git add web/
git commit -m "feat(web): landing sections (hero, value, how-it-works, features, quickstart, footer)"
```

### Task 4: Deploy to Vercel + connect brainmux.com

**Files:** none in-repo (Vercel project settings).

- [ ] **Step 1:** Create/point a Vercel project at this repo with **root directory `web/`** (framework auto-detected Next.js). Deploy a **preview** first (via the Vercel MCP `deploy_to_vercel` or `git push` if the repo is connected).
- [ ] **Step 2:** Verify the preview URL renders correctly (all sections, mobile + desktop).
- [ ] **Step 3:** Promote to production. Add domain `brainmux.com` in Vercel; set Cloudflare DNS per Vercel's instructions (CNAME/A, proxy "DNS only" so Vercel serves + issues TLS).
- [ ] **Step 4:** Verify `https://brainmux.com` serves the landing over HTTPS.

---

## Self-Review

**Spec coverage:** §2 stack → Task 2. §3 aesthetic → Tasks 1–3. §4 structure → Tasks 2–3. §5 copy → Task 3 (verbatim from spec). §6 metadata → Task 2 Step 4. §7 deploy → Task 4. §8 non-goals respected (no docs/i18n/CMS/auth). Preview-first loop → Task 1.

**Placeholder scan:** none — config is complete/exact; copy is referenced verbatim from spec §5 (DRY, not duplicated); component JSX is built from the approved Artifact in Task 3.

**Consistency:** stack versions (Next 15 / React 19 / Tailwind v4 / TS strict) identical across Tasks 2–3. `CopyCommand` (Task 3 Step 1) consumed by the section components (Step 2). Root dir `web/` used consistently in build (Tasks 2–3) and deploy (Task 4).

## Execution
Inline. Order: Artifact preview (approve look) → scaffold → sections → deploy. `web/` is standalone (not the plugin workspace).
