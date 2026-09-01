# OpenRouter Model Picker Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `bmux models` — fetch the live OpenRouter catalog (parsed in Node, no LLM guessing) — plus an embedded SSOT of the API endpoint + use-case guidance, and teach the `brainmux` skill to recommend models per use-case from the live list and default setup to OpenRouter.

**Architecture:** A single embedded constant `OPENROUTER` in `src/core/openrouter.ts` holds the models endpoint + a use-case guidance catalog (zod-validated at load). Pure helpers parse the raw `/models` JSON into `ModelRow[]` and format a compact table; `fetchModels()` does the HTTPS GET. `src/commands/models.ts` exposes `bmux models [query] | --json | --use-cases`. The `brainmux` skill points Claude at these (live data, never memory) and defaults setup to OpenRouter.

**Tech Stack:** Node/TypeScript (ESM, NodeNext), zod, node:https, node:test. Ships in the esbuild bundle like the rest of the CLI.

## Global Constraints

- **Parse in Node, never via an LLM summary.** `bmux models` reads the raw OpenRouter JSON and maps it in code — model ids/prices are never produced from memory or a summarizer (they hallucinate).
- **SSOT is an embedded constant** in `src/core/openrouter.ts` (not a separate file) — bundle-path-safe, consistent with `generate.ts`/`init.ts`; one authoritative place, no parallel copy.
- **OpenRouter `/models` is public** (no API key). Endpoint: `https://openrouter.ai/api/v1/models`.
- **Use-case judgment lives in the skill**, from the live list — the SSOT carries guidance text only (no executable filters, no hardcoded model ids, no `?category=` — unverified).
- **ESM/NodeNext:** relative imports use `.js`. `src/` is source of truth; the shipped `dist/bmux.js` bundle is regenerated (`npm run bundle`) and dist-checked.
- Pricing displayed **per 1M tokens** (API gives per-token).
- Keep the existing 39 tests green; commit after each task.

## File Structure

| File | Responsibility |
|---|---|
| `plugins/llmproxy/src/core/openrouter.ts` | SSOT constant + zod validate + `ModelRow`, `parseModelsPayload`, `fetchModels`, `formatModels`, `getUseCases`. |
| `plugins/llmproxy/test/openrouter.test.ts` | Unit: validate SSOT, parse fixture payload, format (filter+sort), use-cases. |
| `plugins/llmproxy/src/commands/models.ts` | `runModels` — `--use-cases`, `--json`, `[query]`. |
| `plugins/llmproxy/test/models.test.ts` | Unit: `--use-cases` prints the catalog (no network). |
| `plugins/llmproxy/src/cli.ts` | Dispatch `models` + HELP line. |
| `plugins/llmproxy/skills/brainmux/SKILL.md` | Model-discovery section + OpenRouter-default setup. |

---

### Task 1: `core/openrouter.ts` — SSOT + parse + format + fetch

**Files:**
- Create: `plugins/llmproxy/src/core/openrouter.ts`
- Test: `plugins/llmproxy/test/openrouter.test.ts`

**Interfaces:**
- Consumes: `zod`, `node:https`.
- Produces:
  ```ts
  export interface UseCase { id: string; label: string; guidance: string; }
  export interface OpenRouterConfig { api: { models: string }; useCases: UseCase[]; }
  export const OPENROUTER: OpenRouterConfig;
  export function getUseCases(): UseCase[];
  export interface ModelRow { id: string; contextLength: number | null; promptPrice: number | null; completionPrice: number | null; modality: string; name: string; raw: unknown; }
  export function parseModelsPayload(json: unknown): ModelRow[];
  export function fetchModels(): Promise<ModelRow[]>;
  export function formatModels(rows: ModelRow[], opts?: { query?: string }): string;
  ```

- [ ] **Step 1: Write the failing test.** Create `plugins/llmproxy/test/openrouter.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getUseCases, parseModelsPayload, formatModels } from "../src/core/openrouter.js";

const payload = {
  data: [
    { id: "z/expensive", name: "Exp", context_length: 8000, pricing: { prompt: 0.00001, completion: 0.00003 }, architecture: { modality: "text->text" } },
    { id: "a/cheap-coder", name: "Cheap Coder", context_length: 131072, pricing: { prompt: 0.0000001, completion: 0.0000002 }, architecture: { modality: "text->text" } },
    { id: "b/no-price", name: "NoPrice", context_length: null, pricing: {}, architecture: {} },
  ],
};

test("getUseCases returns the guidance catalog", () => {
  const ids = getUseCases().map((u) => u.id);
  assert.deepEqual(ids, ["chat", "coding", "deep", "cheap", "long"]);
  assert.ok(getUseCases().every((u) => u.label && u.guidance));
});

test("parseModelsPayload maps fields and tolerates missing pricing/modality", () => {
  const rows = parseModelsPayload(payload);
  assert.equal(rows.length, 3);
  const coder = rows.find((r) => r.id === "a/cheap-coder")!;
  assert.equal(coder.contextLength, 131072);
  assert.equal(coder.promptPrice, 0.0000001);
  assert.equal(coder.modality, "text->text");
  const np = rows.find((r) => r.id === "b/no-price")!;
  assert.equal(np.promptPrice, null);
  assert.equal(np.contextLength, null);
  assert.equal(np.modality, "text->text"); // default
});

test("parseModelsPayload throws on a bad shape", () => {
  assert.throws(() => parseModelsPayload({ nope: 1 }), /data/i);
});

test("formatModels filters by query and sorts by prompt price asc", () => {
  const out = formatModels(parseModelsPayload(payload));
  const lines = out.split("\n").slice(1); // drop header
  assert.ok(lines[0].startsWith("b/no-price") || lines[0].startsWith("a/cheap-coder"));
  // cheapest priced model appears before the expensive one
  assert.ok(out.indexOf("a/cheap-coder") < out.indexOf("z/expensive"));
  const filtered = formatModels(parseModelsPayload(payload), { query: "coder" });
  assert.ok(filtered.includes("a/cheap-coder"));
  assert.ok(!filtered.includes("z/expensive"));
});
```

- [ ] **Step 2: Run test → RED.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: fail — `Cannot find module '../src/core/openrouter.js'`.

- [ ] **Step 3: Implement.** Create `plugins/llmproxy/src/core/openrouter.ts`:

```ts
import https from "node:https";
import { z } from "zod";

export interface UseCase { id: string; label: string; guidance: string; }
export interface OpenRouterConfig { api: { models: string }; useCases: UseCase[]; }

// SSOT — one authoritative place for the OpenRouter endpoint + use-case guidance.
// Embedded (not a separate file) so it resolves identically from tsc output and the
// esbuild bundle — same reasoning as core/generate.ts and commands/init.ts.
export const OPENROUTER: OpenRouterConfig = {
  api: { models: "https://openrouter.ai/api/v1/models" }, // public, no key
  useCases: [
    { id: "chat",   label: "Chat / summary", guidance: "cheap, fast, wide context; grunt & summarize" },
    { id: "coding", label: "Coding",         guidance: "high SWE-bench, 128k+ context, good price/perf" },
    { id: "deep",   label: "Deep reasoning", guidance: "strongest reasoning; price secondary" },
    { id: "cheap",  label: "Cheapest",       guidance: "lowest $/token; quality secondary" },
    { id: "long",   label: "Long context",   guidance: "largest context window (1M+)" },
  ],
};

const ConfigSchema = z.object({
  api: z.object({ models: z.string().url() }),
  useCases: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), guidance: z.string().min(1) })).min(1),
});
ConfigSchema.parse(OPENROUTER); // fail loudly if the embedded SSOT is edited wrong

export function getUseCases(): UseCase[] {
  return OPENROUTER.useCases;
}

export interface ModelRow {
  id: string;
  contextLength: number | null;
  promptPrice: number | null;      // per-token USD
  completionPrice: number | null;  // per-token USD
  modality: string;
  name: string;
  raw: unknown;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

export function parseModelsPayload(json: unknown): ModelRow[] {
  const data = (json as { data?: unknown }).data;
  if (!Array.isArray(data)) throw new Error("unexpected OpenRouter /models response: no data[] array");
  return data.map((m) => {
    const o = (m ?? {}) as Record<string, any>;
    return {
      id: String(o.id ?? ""),
      contextLength: num(o.context_length),
      promptPrice: num(o.pricing?.prompt),
      completionPrice: num(o.pricing?.completion),
      modality: typeof o.architecture?.modality === "string" ? o.architecture.modality : "text->text",
      name: String(o.name ?? o.id ?? ""),
      raw: m,
    };
  });
}

export function fetchModels(): Promise<ModelRow[]> {
  return new Promise((resolve, reject) => {
    const req = https.get(OPENROUTER.api.models, { timeout: 20000 }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 400) { res.resume(); reject(new Error(`could not fetch OpenRouter catalog: HTTP ${status}`)); return; }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { resolve(parseModelsPayload(JSON.parse(body))); }
        catch (e) { reject(new Error(`could not parse OpenRouter catalog: ${(e as Error).message}`)); }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("could not fetch OpenRouter catalog: timed out")); });
    req.on("error", (e) => reject(new Error(`could not fetch OpenRouter catalog: ${e.message}`)));
  });
}

function per1M(price: number | null): string {
  return price == null ? "?" : `$${(price * 1_000_000).toFixed(2)}`;
}

export function formatModels(rows: ModelRow[], opts: { query?: string } = {}): string {
  const q = opts.query?.toLowerCase();
  const filtered = (q ? rows.filter((r) => r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) : rows)
    .slice()
    .sort((a, b) => (a.promptPrice ?? Infinity) - (b.promptPrice ?? Infinity));
  const header = `${"model".padEnd(44)} ${"ctx".padStart(10)}  ${"$in/1M".padStart(9)} ${"$out/1M".padStart(9)}  modality`;
  const lines = filtered.map((r) => {
    const ctx = r.contextLength != null ? r.contextLength.toLocaleString("en-US") : "?";
    return `${r.id.padEnd(44)} ${ctx.padStart(10)}  ${per1M(r.promptPrice).padStart(9)} ${per1M(r.completionPrice).padStart(9)}  ${r.modality}`;
  });
  return [header, ...lines].join("\n");
}
```

- [ ] **Step 4: Run test → GREEN.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: 4 openrouter tests pass + existing 39 (= 43).

- [ ] **Step 5: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/core/openrouter.ts plugins/llmproxy/test/openrouter.test.ts
git commit -m "feat(llmproxy): add core/openrouter — SSOT + live catalog fetch/parse/format"
```

---

### Task 2: `commands/models.ts` + CLI wiring

**Files:**
- Create: `plugins/llmproxy/src/commands/models.ts`
- Modify: `plugins/llmproxy/src/cli.ts`
- Test: `plugins/llmproxy/test/models.test.ts`

**Interfaces:**
- Consumes: `getUseCases`, `fetchModels`, `formatModels` (Task 1).
- Produces: `export function runModels(rest: string[], env?: NodeJS.ProcessEnv): Promise<number>;`

- [ ] **Step 1: Write the failing test.** Create `plugins/llmproxy/test/models.test.ts` (offline path only — `--use-cases` never hits the network):

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { runModels } from "../src/commands/models.js";

test("bmux models --use-cases prints the catalog offline", async () => {
  const out: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { out.push(a.join(" ")); };
  try {
    const code = await runModels(["--use-cases"]);
    assert.equal(code, 0);
  } finally {
    console.log = orig;
  }
  const text = out.join("\n");
  assert.ok(text.includes("coding"));
  assert.ok(text.includes("chat"));
});
```

- [ ] **Step 2: Run test → RED.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: fail — `Cannot find module '../src/commands/models.js'`.

- [ ] **Step 3: Implement `models.ts`.** Create `plugins/llmproxy/src/commands/models.ts`:

```ts
import { getUseCases, fetchModels, formatModels } from "../core/openrouter.js";

export async function runModels(rest: string[], _env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (rest.includes("--use-cases")) {
    console.log("Use-cases (guidance for picking a model from `bmux models`):");
    for (const uc of getUseCases()) console.log(`  ${uc.id.padEnd(8)} ${uc.label.padEnd(16)} ${uc.guidance}`);
    return 0;
  }
  const wantJson = rest.includes("--json");
  const query = rest.find((a) => !a.startsWith("-"));
  try {
    const rows = await fetchModels();
    if (wantJson) {
      const q = query?.toLowerCase();
      const out = q ? rows.filter((r) => r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) : rows;
      console.log(JSON.stringify(out.map((r) => r.raw), null, 2));
    } else {
      console.log("Live from OpenRouter · prices per 1M tokens · sorted by input price\n");
      console.log(formatModels(rows, { query }));
    }
    return 0;
  } catch (e) {
    process.stderr.write(`bmux models: ${(e as Error).message}\n`);
    return 1;
  }
}
```

- [ ] **Step 4: Wire into `cli.ts`.** Add the import after the other command imports:

```ts
import { runModels } from "./commands/models.js";
```
Add the dispatch line (next to the other non-stack commands, before the brain-launch fallthrough):

```ts
    if (cmd === "models") return await runModels(rest, env);
```
Add a HELP line inside the `HELP` template, after the `test` line:

```
  bmux models [query] | --use-cases | --json   list OpenRouter models (live) / use-cases
```

- [ ] **Step 5: Run test → GREEN.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | tail -20`
Expected: models test passes + all prior (= 44). Build clean.

- [ ] **Step 6: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/src/commands/models.ts plugins/llmproxy/src/cli.ts plugins/llmproxy/test/models.test.ts
git commit -m "feat(llmproxy): add bmux models (live OpenRouter catalog + use-cases)"
```

---

### Task 3: `brainmux` skill — model discovery + OpenRouter-default setup

**Files:**
- Modify: `plugins/llmproxy/skills/brainmux/SKILL.md`

**Interfaces:**
- Consumes: `bmux models` (Task 2), `bmux config` (existing).
- Produces: skill guidance; no code.

- [ ] **Step 1: Add a "Model discovery" section** to `plugins/llmproxy/skills/brainmux/SKILL.md`, after the "Config" section:

```markdown
## Model discovery (OpenRouter)
For "which model / how much / what's good for X" questions, use the **live** catalog — never
recommend a model slug from memory (models + prices change):
- `bmux models --use-cases` — the use-case guidance catalog (chat/coding/deep/cheap/long).
- `bmux models [query]` — live OpenRouter models: `id · ctx · $in/out per 1M · modality`, cheapest first.
- `bmux models --json [query]` — full records (benchmarks, supported_parameters, reasoning, modalities) for deeper judgment.

Flow: run `bmux models --use-cases` + `bmux models [query]`, pick per the use-case guidance from the
**live output**, propose it to the user, and on confirmation wire it with `bmux config set-model <brain> <id>`
(or `add-brain`), then `bmux up`. Verify a new slug actually works with `bmux test`.
```

- [ ] **Step 2: Add the OpenRouter-default setup rule** to the `## Discipline` section (as a new bullet at the top):

```markdown
- **Default provider = OpenRouter; do NOT present a provider-choice menu on setup.** One OpenRouter
  key reaches thousands of models across providers (DeepSeek/Qwen/GLM/GPT/Gemini…), so setup assumes
  OpenRouter: have the user add `OPENROUTER_API_KEY` (hidden, separate terminal) — nothing else. Use a
  direct provider (`deepseek/…`, `openai/…`) only if the user explicitly asks; never ask them to pick a provider first.
```

- [ ] **Step 3: Verify.**

Run: `grep -c 'bmux models' ~/Development/Projects/brainmux/plugins/llmproxy/skills/brainmux/SKILL.md; grep -c 'provider-choice menu' ~/Development/Projects/brainmux/plugins/llmproxy/skills/brainmux/SKILL.md`
Expected: `bmux models` ≥ 3; `provider-choice menu` = 1.

- [ ] **Step 4: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/skills/brainmux/SKILL.md
git commit -m "docs(llmproxy): brainmux skill — model discovery + OpenRouter-default setup"
```

---

### Task 4: Integrate — bundle, dist-check, live check, push

**Files:** none new (rebundles `dist/bmux.js`).

- [ ] **Step 1: Rebuild bundle + full suite.**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm test 2>&1 | grep -E '^. (tests|pass|fail)'`
Expected: 44/44 pass (39 prior + 4 openrouter + 1 models), pristine.

- [ ] **Step 2: Live check (network) — the shipped bundle fetches the real catalog.**

```bash
cd ~/Development/Projects/brainmux
node plugins/llmproxy/bin/bmux models --use-cases
node plugins/llmproxy/bin/bmux models qwen | head -8
node plugins/llmproxy/bin/bmux models 2>&1 | head -3
```
Expected: use-cases print; `qwen` filter returns real Qwen rows with ctx/price; the full list prints a header + rows. If offline, `bmux models: could not fetch OpenRouter catalog: …` + exit 1 (acceptable — network-gated).

- [ ] **Step 3: Stage the rebuilt bundle + dist-check.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/dist/bmux.js
(cd plugins/llmproxy && npm run dist-check) ; echo "dist-check exit=$?"
```
Expected: `dist-check exit=0` after the bundle is committed (Step 4).

- [ ] **Step 4: Commit the bundle + push.**

```bash
cd ~/Development/Projects/brainmux
git commit -m "build(llmproxy): rebundle dist/bmux.js with bmux models"
git push origin main
```

---

## Self-Review

**Spec coverage (2026-09-02 model-picker spec):** §2 SSOT embedded constant → Task 1 (`OPENROUTER` + zod). §3 openrouter.ts (ModelRow, parseModelsPayload, fetchModels, formatModels, getUseCases, --json raw) → Task 1. §4 `bmux models`/`--use-cases`/`--json` → Task 2. §5 cli + skill (discovery + OpenRouter-default) → Tasks 2 + 3. §6 error handling (readable fetch errors, zod on load) → Task 1 (`fetchModels` reject messages, `ConfigSchema.parse`). §7 testing (validate/parse/format/use-cases unit; live manual) → Tasks 1, 2, 4. §8 non-goals respected (no direct-provider lists, no cache, no executable filters/allowlist, no auto-write).

**Placeholder scan:** none. `?category=` is an explicit documented deferral, not a gap.

**Type consistency:** `ModelRow`/`UseCase`/`OpenRouterConfig` defined in Task 1, consumed unchanged in Task 2. `parseModelsPayload`/`fetchModels`/`formatModels`/`getUseCases` signatures identical across tasks. `runModels(rest, env?)` async → cli awaits it (Task 2 Step 4), matching the existing `runConfig`/`runTest` async dispatch pattern. All relative imports use `.js`.

## Execution
Inline (executing-plans) — small, additive (2 new modules + wiring + skill), no cross-file risk. After push, the user runs `/plugin marketplace update brainmux` + `/reload-plugins` to get `bmux models` + the updated skill.
